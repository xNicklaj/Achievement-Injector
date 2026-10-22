import { describe, expect, it } from "vitest";
import { bandsOf, followMoves, hiddenOf, hideNodes, membersOf, movedOrder, restack, viewRect, visibleBands, worstLevel } from "./achievements";
import { importGroup } from "./io/importGroup";

const lvl = (level: number) => ({ type: "PlayerLevel", level });
const snap = importGroup({
  groupName: "G",
  plugin: "A.esp",
  achievements: [
    {
      achievementName: "$one",
      description: "d",
      joinType: "AND",
      conditions: [
        { type: "ConditionsMet", quantity: 1, conditions: [lvl(1), { type: "HasPerk", formID: "1", live: true }], onUnlock: [{ type: "command", command: "inner" }] },
        lvl(2),
      ],
      onUnlock: [{ type: "command", command: "done" }],
    },
    { achievementName: "Two", description: "d", conditions: [lvl(3), lvl(4)] },
    { achievementName: "Three", description: "d" },
  ],
});
const create = (name: string) => snap.nodes.find((n) => n.data.kind === "CreateAchievement" && (n.data.values.achievementName === name || (name === "$one" && !n.data.values.achievementName)))!;
const kinds = (ids: string[]) => ids.map((id) => snap.nodes.find((n) => n.id === id)!.data.kind).sort();

describe("what makes up an achievement", () => {
  const one = create("$one");
  const two = create("Two");

  it("has its chain, its conditions at any depth, Live nodes and the conditions' own actions", () => {
    expect(kinds(membersOf(snap.nodes, snap.edges, one.id))).toEqual(
      ["AddConditions", "ConditionsMet", "CreateAchievement", "HasPerk", "JoinType", "Live", "PlayerLevel", "PlayerLevel", "RunCommand", "RunCommand"].sort(),
    );
  });
  it("leaves out shared nodes and other achievements", () => {
    const mine = new Set(membersOf(snap.nodes, snap.edges, one.id));
    expect(snap.nodes.find((n) => n.data.kind === "LocalizedText" && mine.has(n.id))).toBeUndefined();
    expect(membersOf(snap.nodes, snap.edges, two.id).some((id) => mine.has(id))).toBe(false);
    expect(kinds(membersOf(snap.nodes, snap.edges, two.id))).toEqual(["AddConditions", "CreateAchievement", "PlayerLevel", "PlayerLevel"]);
  });
  it("is just the node for an achievement with no conditions", () => {
    expect(membersOf(snap.nodes, snap.edges, create("Three").id)).toEqual([create("Three").id]);
  });
  it("is worked out once per set of wires", () => {
    expect(membersOf(snap.nodes, snap.edges, one.id)).toBe(membersOf(snap.nodes, snap.edges, one.id));
  });
});

describe("boxes and what is in view", () => {
  const bands = bandsOf(snap.nodes, snap.edges);
  const band = (id: string) => bands.find((b) => b.id === id)!;

  it("lists the achievements in the order of the file, each box around all of its nodes", () => {
    expect(bands.map((b) => b.id)).toEqual(snap.nodes.filter((n) => n.data.kind === "CreateAchievement").map((n) => n.id));
    for (const b of bands)
      for (const id of b.members) {
        const p = snap.nodes.find((n) => n.id === id)!.position;
        expect(p.x).toBeGreaterThanOrEqual(b.rect.x);
        expect(p.y).toBeGreaterThanOrEqual(b.rect.y);
        expect(p.x).toBeLessThan(b.rect.x + b.rect.width);
        expect(p.y).toBeLessThan(b.rect.y + b.rect.height);
      }
  });

  it("marks the achievements in view and calls the one nearest the centre current", () => {
    const [a, b] = [band(bands[0].id).rect, band(bands[1].id).rect];
    const onlyFirst = { x: a.x, y: a.y, width: a.width, height: a.height };
    expect(visibleBands(bands, onlyFirst)).toEqual({ ids: [bands[0].id], current: bands[0].id });
    const both = { x: 0, y: a.y, width: Math.max(a.width, b.width), height: b.y + b.height - a.y };
    const seen = visibleBands(bands, both);
    expect(seen.ids).toEqual(expect.arrayContaining([bands[0].id, bands[1].id]));
    // Centred on the second one, it is the current one.
    expect(visibleBands(bands, { x: b.x, y: b.y + b.height / 2 - 5, width: b.width, height: 10 }).current).toBe(bands[1].id);
  });

  it("is quiet when nothing is in view", () => {
    expect(visibleBands(bands, { x: -50000, y: -50000, width: 100, height: 100 })).toEqual({ ids: [], current: undefined });
  });

  it("turns React Flow's transform into the part of the flow on screen", () => {
    expect(viewRect([100, 50, 2], 800, 400)).toEqual({ x: -50, y: -25, width: 400, height: 200 });
  });
});

describe("collapsing an achievement", () => {
  const one = snap.nodes.find((n) => n.data.kind === "CreateAchievement" && !n.data.values.achievementName)!;
  const collapsed = { [one.id]: true } as const;

  it("hides everything of it but its Create Achievement node", () => {
    const hidden = hiddenOf(snap.nodes, snap.edges, collapsed);
    const members = membersOf(snap.nodes, snap.edges, one.id);
    expect(hidden.size).toBe(members.length - 1);
    expect(hidden.has(one.id)).toBe(false);
    expect(hiddenOf(snap.nodes, snap.edges, {}).size).toBe(0);
  });

  it("gives React Flow the same nodes when nothing is hidden, and the same hidden copy while a node is unchanged", () => {
    expect(hideNodes(snap.nodes, new Set())).toBe(snap.nodes);
    const hidden = hiddenOf(snap.nodes, snap.edges, collapsed);
    const a = hideNodes(snap.nodes, hidden);
    const b = hideNodes(snap.nodes, hidden);
    expect(a.filter((n) => n.hidden)).toHaveLength(hidden.size);
    a.forEach((n, i) => expect(n).toBe(b[i]));
    expect(a.filter((n) => !n.hidden).every((n) => snap.nodes.includes(n))).toBe(true); // the others are the very objects they were
    expect(snap.nodes.some((n) => n.hidden)).toBe(false); // the source nodes are not touched
  });

  it("is only the Create Achievement node when it comes to what is in view, but still brings every node into view", () => {
    const full = bandsOf(snap.nodes, snap.edges).find((b) => b.id === one.id)!;
    const folded = bandsOf(snap.nodes, snap.edges, collapsed).find((b) => b.id === one.id)!;
    expect(folded.members).toEqual(full.members);
    expect(folded.rect.x).toBe(one.position.x);
    expect(folded.rect.y).toBe(one.position.y);
    expect(folded.rect.width).toBeLessThan(full.rect.width);
  });

  it("reports the worst problem among some nodes", () => {
    const byNode = { a: "warning|x", b: "error|y", c: "warning|z" };
    expect(worstLevel(byNode, ["a", "c"])).toBe("warning");
    expect(worstLevel(byNode, ["a", "b", "c"])).toBe("error");
    expect(worstLevel(byNode, ["d"])).toBeUndefined();
  });
});

describe("moving a collapsed achievement", () => {
  const one = snap.nodes.find((n) => n.data.kind === "CreateAchievement" && !n.data.values.achievementName)!;
  const move = (to: { x: number; y: number }) => [{ type: "position" as const, id: one.id, position: to, dragging: true }];
  const [dx, dy] = [40, -25];
  const to = { x: one.position.x + dx, y: one.position.y + dy };

  it("moves what it hides by the same offset", () => {
    const out = followMoves(move(to), snap.nodes, snap.edges, { [one.id]: true });
    const hidden = hiddenOf(snap.nodes, snap.edges, { [one.id]: true });
    expect(out).toHaveLength(1 + hidden.size);
    for (const c of out.slice(1)) {
      if (c.type !== "position" || !c.position) throw new Error("expected a position change");
      const before = snap.nodes.find((n) => n.id === c.id)!.position;
      expect(hidden.has(c.id)).toBe(true);
      expect(c.position).toEqual({ x: before.x + dx, y: before.y + dy });
    }
  });

  it("leaves everything else alone: expanded, another achievement, or no movement", () => {
    const moved = move(to);
    expect(followMoves(moved, snap.nodes, snap.edges, {})).toBe(moved);
    const other = snap.nodes.find((n) => n.data.kind === "CreateAchievement" && n.id !== one.id)!;
    expect(followMoves(moved, snap.nodes, snap.edges, { [other.id]: true })).toBe(moved);
    expect(followMoves(move(one.position), snap.nodes, snap.edges, { [one.id]: true })).toHaveLength(1);
    expect(followMoves([{ type: "select", id: one.id, selected: true }], snap.nodes, snap.edges, { [one.id]: true })).toHaveLength(1);
  });
});

describe("reordering achievements", () => {
  const doc = importGroup({
    groupName: "G",
    plugin: "A.esp",
    achievements: [
      { achievementName: "$a", description: "$shared", conditions: [lvl(1), lvl(2)] },
      { achievementName: "B", description: "$shared", conditions: [lvl(3)] },
      { achievementName: "C", description: "d", conditions: [lvl(4), lvl(5), lvl(6)] },
    ],
  });
  const creates = doc.nodes.filter((n) => n.data.kind === "CreateAchievement");
  const [a, b, c] = creates;
  const text = (key: string) => doc.nodes.find((n) => n.data.kind === "LocalizedText" && n.data.values.key === key)!;

  it("moves an achievement next to another, before or after it, and says nothing when it would not move", () => {
    const order = ["a", "b", "c", "d"];
    expect(movedOrder(order, "d", "a", false)).toEqual(["d", "a", "b", "c"]);
    expect(movedOrder(order, "a", "c", true)).toEqual(["b", "c", "a", "d"]);
    expect(movedOrder(order, "b", "a", true)).toBe(order);
    expect(movedOrder(order, "b", "b", true)).toBe(order);
    expect(movedOrder(order, "b", "missing", true)).toBe(order);
  });

  it("stacks the achievements down the canvas in the new order, each keeping its shape and its column", () => {
    const moved = restack(doc.nodes, doc.edges, [c.id, a.id, b.id]);
    const next = doc.nodes.map((n) => (moved.has(n.id) ? { ...n, position: moved.get(n.id)! } : n));
    const bands = bandsOf(next, doc.edges).sort((p, q) => p.rect.y - q.rect.y);
    expect(bands.map((x) => x.id)).toEqual([c.id, a.id, b.id]);
    bands.forEach((band, i) => i && expect(bands[i - 1].rect.y + bands[i - 1].rect.height).toBeLessThanOrEqual(band.rect.y));
    for (const [id, to] of moved) expect(to.x).toBe(doc.nodes.find((n) => n.id === id)!.position.x);
    // Inside an achievement nothing moves relative to its Create Achievement node.
    for (const band of bands) {
      const before = bandsOf(doc.nodes, doc.edges).find((x) => x.id === band.id)!;
      expect(band.rect.height).toBe(before.rect.height);
    }
  });

  it("takes along the shared nodes only one achievement uses, and leaves the ones several use", () => {
    const moved = restack(doc.nodes, doc.edges, [c.id, a.id, b.id]);
    expect(moved.has(text("a").id)).toBe(true); // only "$a" uses it
    expect(moved.has(text("shared").id)).toBe(false); // two achievements use it
  });

  it("keeps the gaps between neighbours as they are, so only who sits in each place changes", () => {
    const plain = importGroup({
      groupName: "G",
      plugin: "A.esp",
      achievements: [
        { achievementName: "P", description: "d", conditions: [lvl(1), lvl(2)] },
        { achievementName: "Q", description: "d", conditions: [lvl(3)] },
        { achievementName: "R", description: "d", conditions: [lvl(4), lvl(5), lvl(6)] },
        { achievementName: "S", description: "d" },
      ],
    });
    // Give the gaps different sizes, as a hand-arranged canvas would have.
    const spread = plain.nodes.map((n) => ({ ...n, position: { x: n.position.x, y: n.position.y + 37 * plain.nodes.indexOf(n) } }));
    const gapsOf = (list: typeof spread) => {
      const sorted = bandsOf(list, plain.edges).sort((p, q) => p.rect.y - q.rect.y);
      return sorted.slice(1).map((b, i) => b.rect.y - (sorted[i].rect.y + sorted[i].rect.height));
    };
    const ids = spread.filter((n) => n.data.kind === "CreateAchievement").map((n) => n.id);
    const moved = restack(spread, plain.edges, [ids[3], ids[0], ids[2], ids[1]]);
    const next = spread.map((n) => (moved.has(n.id) ? { ...n, position: moved.get(n.id)! } : n));
    expect(gapsOf(next)).toEqual(gapsOf(spread));
  });

  it("moves nothing when the order is the one on the canvas", () => {
    expect(restack(doc.nodes, doc.edges, [a.id, b.id, c.id]).size).toBe(0);
  });
});
