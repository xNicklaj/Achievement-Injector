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

describe("tidyPositions with Conditions Met", () => {
  const lvl = (level: number) => ({ type: "PlayerLevel", level });
  const snap = importGroup({
    groupName: "G",
    plugin: "A.esp",
    achievements: [{ achievementName: "A", description: "d", conditions: [{ type: "ConditionsMet", quantity: 2, conditions: [{ type: "ConditionsMet", quantity: 1, conditions: [lvl(1), lvl(2)] }, lvl(3)] }, lvl(4)] }],
  });
  const messy = snap.nodes.map((n, i) => ({ ...n, position: { x: (i * 37) % 200, y: (i * 91) % 300 } }));
  const at = tidyPositions(messy, snap.edges);
  const pos = (pick: (n: (typeof messy)[number]) => boolean) => at.get(messy.find(pick)!.id)!;

  it("places everything without overlaps", () => {
    expect(at.size).toBe(messy.length);
    const box = messy.map((n) => ({ id: n.id, ...at.get(n.id)!, h: estimateHeight(registry[n.data.kind], n.data.values) }));
    for (const a of box)
      for (const b of box)
        if (a.id < b.id) expect(a.x < b.x + W && b.x < a.x + W && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(false);
  });
  it("puts what a Conditions Met holds to its left, and the chain past all of it", () => {
    const outer = pos((n) => n.data.kind === "ConditionsMet" && n.data.values.quantity === 2);
    const inner = pos((n) => n.data.kind === "ConditionsMet" && n.data.values.quantity === 1);
    const leaf = pos((n) => n.data.kind === "PlayerLevel" && n.data.values.level === 1);
    const add = pos((n) => n.data.kind === "AddConditions");
    expect(leaf.x).toBeLessThan(inner.x);
    expect(inner.x).toBeLessThan(outer.x);
    expect(outer.x).toBeLessThan(add.x);
  });
  it("lays out a freshly imported file the same way", () => {
    const fresh = new Map(snap.nodes.map((n) => [n.id, n.position]));
    for (const [id, p] of at) expect(fresh.get(id)).toEqual({ x: Math.round(p.x), y: Math.round(p.y) });
  });
});

describe("tidyPositions and the flow wire", () => {
  it("keeps conditions off the wire from the achievement to Add Conditions", () => {
    const snap = importGroup(doc);
    const at = tidyPositions(snap.nodes, snap.edges);
    const create = snap.nodes.find((n) => n.data.kind === "CreateAchievement")!;
    const wireY = at.get(create.id)!.y + 14; // the flow pin sits in the header
    for (const n of snap.nodes.filter((n) => n.data.kind === "PlayerLevel" && n.data.values.level === 1)) expect(at.get(n.id)!.y).toBeGreaterThan(wireY);
  });
});
