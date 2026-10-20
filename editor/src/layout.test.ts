import { describe, expect, it } from "vitest";
import { estimateHeight, importGroup, W } from "./io/importGroup";
import { tidyPositions } from "./layout";
import { registry } from "./registry";

const doc = {
  groupName: "G",
  plugin: "A.esp",
  achievements: [
    { achievementName: "$one", description: "$d", conditions: [{ type: "PlayerLevel", level: 1, onUnlock: [{ type: "command", command: "a" }, { type: "command", command: "b" }] }, { type: "PlayerLevel", level: 2 }], onUnlock: [{ type: "command", command: "c" }] },
    { achievementName: "Two", description: "d", joinType: "AND", conditions: [{ type: "PlayerLevel", level: 3 }, { type: "AchievementUnlocked", achievement: "$one" }] },
    { achievementName: "Three", description: "$d" },
  ],
};

describe("tidyPositions", () => {
  const snap = importGroup(doc);
  // Scatter everything first, as a user would.
  const messy = snap.nodes.map((n, i) => ({ ...n, position: { x: (i * 37) % 200, y: (i * 91) % 300 } }));
  const at = tidyPositions(messy, snap.edges);

  it("places every node and leaves no two overlapping", () => {
    expect(at.size).toBe(messy.length);
    const box = messy.map((n) => ({ id: n.id, ...at.get(n.id)!, h: estimateHeight(registry[n.data.kind], n.data.values) }));
    for (const a of box)
      for (const b of box)
        if (a.id < b.id) expect(a.x < b.x + W && b.x < a.x + W && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(false);
  });
  it("keeps the achievement order and puts conditions between the achievement and its chain", () => {
    const pos = (kind: string, pick?: (n: (typeof messy)[number]) => boolean) => at.get(messy.find((n) => n.data.kind === kind && (pick?.(n) ?? true))!.id)!;
    const creates = messy.filter((n) => n.data.kind === "CreateAchievement").sort((a, b) => a.position.y - b.position.y);
    const ys = creates.map((n) => at.get(n.id)!.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(new Set(ys).size).toBe(3);
    const create = pos("CreateAchievement");
    const cond = pos("PlayerLevel", (n) => n.data.values.level === 1);
    const add = pos("AddConditions");
    expect(create.x).toBeLessThan(cond.x);
    expect(cond.x).toBeLessThan(add.x);
  });
  it("is stable: tidying a tidied graph changes nothing", () => {
    const again = tidyPositions(messy.map((n) => ({ ...n, position: at.get(n.id)! })), snap.edges);
    for (const [id, p] of at) expect(again.get(id)).toEqual(p);
  });
});
