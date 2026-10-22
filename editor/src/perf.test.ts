import { describe, expect, it } from "vitest";
import { conditionsSummary, pluginOf } from "./graph";
import { exportGroup } from "./io/exportGroup";
import { importGroup, type Json } from "./io/importGroup";
import { tidyPositions } from "./layout";
import { wiredFields } from "./registry";

/**
 * Budgets for a large group (300 achievements, about 2,400 nodes). Every one used to be quadratic or worse: validating took
 * 330 ms, Tidy up 200 ms, and the selectors every node runs on every store update took close to a minute in total.
 * The budgets are 5 to 30 times what the linear versions take, and below what the quadratic ones took, so a return of the old shape fails them.
 */
const big = (): Json => ({
  groupName: "Big",
  plugin: "Skyrim.esm",
  achievements: Array.from({ length: 300 }, (_, i) => ({
    achievementName: `A${i}`,
    description: `$d${i}`,
    joinType: "AND",
    conditions: [
      { type: "ItemInInventory", formID: "0896F5", quantity: 1 },
      { type: "PlayerLevel", level: i % 80 },
      i % 20 === 0 ? { type: "ConditionsMet", quantity: 2, conditions: [{ type: "HasPerk", formID: "1" }, { type: "SpellLearned", formID: "2" }, { type: "ItemEquipped", formID: "3" }] } : { type: "SkillLevel", skill: "OneHanded", level: 10 },
      ...(i % 10 === 5 ? [{ type: "AchievementUnlocked", achievement: `A${i - 1}` }] : []),
    ],
    onUnlock: [{ type: "command", command: "player.additem f 1" }],
  })),
});

/** The best of three: the first run pays for compiling, and a busy machine makes any one run slow; a quadratic is slow every time. */
const took = (f: () => void) =>
  Math.min(
    ...[0, 1, 2].map(() => {
      const t = performance.now();
      f();
      return performance.now() - t;
    }),
  );

describe("a large group stays responsive", () => {
  const snap = importGroup(big());

  it("validates in well under a second", () => {
    expect(took(() => exportGroup({ ...snap, loc: {} }))).toBeLessThan(100);
  });
  it("tidies up in well under a second", () => {
    expect(took(() => tidyPositions(snap.nodes, snap.edges))).toBeLessThan(100);
  });
  it("answers what every node asks on a store update in a fraction of a frame budget", () => {
    const { nodes, edges, group } = snap;
    expect(
      took(() => {
        for (const n of nodes) {
          pluginOf(nodes, edges, n, group.plugin);
          wiredFields(edges, n.id);
          if (n.data.kind === "AddConditions") conditionsSummary(nodes, edges, n.id);
        }
      }),
    ).toBeLessThan(100);
  });
});
