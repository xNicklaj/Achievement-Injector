import { describe, expect, it } from "vitest";
import { importGroup, type Json } from "./io/importGroup";
import { computeValidation, docChanged, parseNodeStatus } from "./validation";

const group = (a: Json): Json => ({ groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d", ...a }] });
const check = (raw: Json, edit?: (nodes: ReturnType<typeof importGroup>["nodes"]) => void) => {
  const snap = importGroup(raw);
  edit?.(snap.nodes);
  return { snap, v: computeValidation({ ...snap, loc: {} }) };
};
const kind = (snap: ReturnType<typeof importGroup>, k: string) => snap.nodes.filter((n) => n.data.kind === k);

describe("validation pinned on nodes", () => {
  it("is quiet for a valid group", () => {
    const { v } = check(group({ conditions: [{ type: "PlayerLevel", level: 5 }] }));
    expect(v.issues).toEqual([]);
    expect(v.byNode).toEqual({});
  });

  it("pins a bad value on the condition node and its field, as an error", () => {
    const { snap, v } = check(group({ conditions: [{ type: "ItemInInventory", formID: "0x12", quantity: 1 }] }));
    const node = kind(snap, "ItemInInventory")[0];
    expect(parseNodeStatus(v.byNode[node.id]).level).toBe("error");
    expect(v.fieldsByNode[node.id]).toBe("formID");
    expect(v.byNode[node.id]).toContain("formID:");
  });

  it("finds the right condition among several", () => {
    const { snap, v } = check(group({ conditions: [{ type: "PlayerLevel", level: 5 }, { type: "QuestStageDone", formID: "zz", stage: 1 }, { type: "PlayerLevel", level: 7 }] }));
    expect(Object.keys(v.byNode)).toEqual([kind(snap, "QuestStageDone")[0].id]);
  });

  it("treats a missing required value as incomplete (warning), without a red field", () => {
    const { snap, v } = check(group({ conditions: [{ type: "PlayerLevel", level: 5 }] }), (nodes) => {
      delete nodes.find((n) => n.data.kind === "PlayerLevel")!.data.values.level;
    });
    const node = kind(snap, "PlayerLevel")[0];
    expect(parseNodeStatus(v.byNode[node.id])).toEqual({ level: "warning", messages: ["level is required"] });
    expect(v.fieldsByNode[node.id]).toBeUndefined();
  });

  it("pins a duplicate achievement name on the achievement node", () => {
    const raw = { groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d" }, { achievementName: "A", description: "d" }] };
    const { snap, v } = check(raw);
    const second = kind(snap, "CreateAchievement")[1];
    expect(parseNodeStatus(v.byNode[second.id]).level).toBe("error");
    expect(v.fieldsByNode[second.id]).toBe("achievementName");
  });

  it("pins joinType and onUnlock problems on their own nodes", () => {
    const { snap, v } = check(group({ joinType: "XOR", onUnlock: [{ type: "command", command: "ok" }, { type: "papyrus", script: "S" }] }));
    expect(v.fieldsByNode[kind(snap, "JoinType")[0].id]).toBe("joinType");
    expect(parseNodeStatus(v.byNode[kind(snap, "CallPapyrus")[0].id]).messages[0]).toBe("function is required");
    expect(v.byNode[kind(snap, "RunCommand")[0].id]).toBeUndefined();
  });

  it("pins structural problems: unconnected nodes and an empty localized key", () => {
    const { snap, v } = check(group({}), (nodes) => {
      nodes.push({ id: "lone", type: "ae", position: { x: 0, y: 0 }, data: { kind: "PlayerLevel", values: { level: 1 } } });
      nodes.push({ id: "k", type: "ae", position: { x: 0, y: 0 }, data: { kind: "LocalizedText", values: {} } });
    });
    expect(snap.nodes).toHaveLength(3);
    expect(parseNodeStatus(v.byNode.lone).messages[0]).toMatch(/Not connected/);
    expect(parseNodeStatus(v.byNode.k).level).toBe("error");
    expect(v.fieldsByNode.k).toBe("key");
  });

  it("pins missing translations on the Localized Text node", () => {
    const snap = importGroup(group({ achievementName: "$N" }));
    const v = computeValidation({ ...snap, loc: { EN: { fileName: "G_EN.txt", lines: [], eol: "\r\n", finalEol: true } } });
    const key = kind(snap, "LocalizedText")[0];
    expect(parseNodeStatus(v.byNode[key.id])).toEqual({ level: "warning", messages: ["No translation for EN."] });
  });
});

describe("AchievementUnlocked references", () => {
  const two = (refs: Json[]): Json => ({
    groupName: "G",
    plugin: "A.esp",
    achievements: [
      { achievementName: "First", description: "d" },
      { achievementName: "Second", description: "d", conditions: refs.map((r) => ({ type: "AchievementUnlocked", ...r })) },
    ],
  });
  const run = (refs: Json[]) => {
    const snap = importGroup(two(refs));
    return { snap, v: computeValidation({ ...snap, loc: {}, fileName: "G.json" }) };
  };

  it("accepts a name that exists in this group, with or without the group written out", () => {
    expect(run([{ achievement: "First" }, { achievement: "First", group: "G" }]).v.issues).toEqual([]);
  });
  it("warns about a name that does not exist in this group, pinned on the condition's field", () => {
    const { snap, v } = run([{ achievement: "Nope" }]);
    const node = snap.nodes.find((n) => n.data.kind === "AchievementUnlocked")!;
    expect(parseNodeStatus(v.byNode[node.id])).toEqual({ level: "warning", messages: ['achievement: no achievement named "Nope" in this group'] });
  });
  it("does not check a reference into another group", () => {
    expect(run([{ achievement: "Anything", group: "Other" }]).v.issues).toEqual([]);
  });
  it("counts a localized name as its fallback text", () => {
    const snap = importGroup({ groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "$N", description: "d" }, { achievementName: "B", description: "d", conditions: [{ type: "AchievementUnlocked", achievement: "Hello" }] }] });
    const en = { fileName: "G_EN.txt", lines: [{ raw: "$N\tHello", key: "N", value: "Hello" }], eol: "\r\n", finalEol: true };
    expect(computeValidation({ ...snap, loc: { EN: en }, fileName: "G.json" }).issues).toEqual([]);
  });
});

describe("docChanged: when validation has to run again", () => {
  const snap = importGroup(group({ conditions: [{ type: "PlayerLevel", level: 5 }, { type: "HasPerk", formID: "1" }] }));
  const doc = (s: typeof snap = snap) => ({ ...s, loc: {}, fileName: "G.json", iconFiles: null, pendingIcons: {} });
  const before = doc();

  it("ignores selecting, measuring and dragging, which only replace the node and wire objects", () => {
    const touched = {
      ...snap,
      nodes: snap.nodes.map((n, i) => ({ ...n, selected: i % 2 === 0, dragging: true, measured: { width: 288, height: 100 } })),
      edges: snap.edges.map((e) => ({ ...e, selected: true })),
    };
    expect(docChanged(before, { ...before, ...touched })).toBe(false);
  });

  it("sees a node moved (the file records positions), a value edited and a wire added or removed", () => {
    const moved = snap.nodes.map((n, i) => (i === 0 ? { ...n, position: { x: n.position.x + 10, y: n.position.y } } : n));
    expect(docChanged(before, { ...before, nodes: moved })).toBe(true);
    const edited = snap.nodes.map((n) => (n.data.kind === "PlayerLevel" ? { ...n, data: { ...n.data, values: { level: 6 } } } : n));
    expect(docChanged(before, { ...before, nodes: edited })).toBe(true);
    expect(docChanged(before, { ...before, edges: snap.edges.slice(1) })).toBe(true);
    expect(docChanged(before, { ...before, nodes: snap.nodes.slice(1) })).toBe(true);
  });

  it("sees the group, translations and file name change", () => {
    expect(docChanged(before, { ...before, group: { ...snap.group, plugin: "B.esp" } })).toBe(true);
    expect(docChanged(before, { ...before, loc: {} })).toBe(true); // a new object: the store only makes one when it changed
    expect(docChanged(before, { ...before, fileName: "H.json" })).toBe(true);
  });
});
