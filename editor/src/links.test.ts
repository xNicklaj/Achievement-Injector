import { beforeEach, describe, expect, it } from "vitest";
import { copySelection, paste } from "./clipboard";
import { refuseReason, pinKind, pluginOf, type AppNode } from "./graph";
import { exportGroup, withoutEditor } from "./io/exportGroup";
import { importGroup, mkEdge, type Json } from "./io/importGroup";
import { parseLoc } from "./io/localization";
import { spawnOptions } from "./spawn";
import { useApp } from "./store";

const group = (achievements: Json[]) => ({ groupName: "G", plugin: "A.esp", achievements });
const A = { achievementName: "First", description: "d" };
const needs = (name: string, extra: Json = {}) => ({ achievementName: "Second", description: "d", conditions: [{ type: "AchievementUnlocked", achievement: name, ...extra }] });
const strip = (v: unknown) => withoutEditor(v);
const wires = (snap: ReturnType<typeof importGroup>) => snap.edges.filter((e) => e.sourceHandle === "ach-out");

describe("AchievementUnlocked wires on import", () => {
  const raw = group([A, needs("First")]);
  it("wires a reference to an achievement of this group by plain name, and writes the same JSON back", () => {
    const snap = importGroup(raw);
    expect(wires(snap)).toHaveLength(1);
    const cond = snap.nodes.find((n) => n.data.kind === "AchievementUnlocked")!;
    expect(cond.data.values.achievement).toBeUndefined();
    expect(strip(exportGroup(snap).json)).toEqual(raw);
    expect(exportGroup(snap).issues).toEqual([]);
  });
  it("leaves typed what it cannot wire: another group, an unknown name, a duplicate name, its own achievement", () => {
    expect(wires(importGroup(group([A, needs("First", { group: "Other" })])))).toHaveLength(0);
    expect(wires(importGroup(group([A, needs("Nobody")])))).toHaveLength(0);
    expect(wires(importGroup(group([A, { ...A }, needs("First")])))).toHaveLength(0);
    expect(wires(importGroup(group([{ ...A, conditions: [{ type: "AchievementUnlocked", achievement: "First" }] }])))).toHaveLength(0);
  });
  it("follows a rename by itself and exports the new name", () => {
    const snap = importGroup(raw);
    const first = snap.nodes.find((n) => n.data.values.achievementName === "First")!;
    first.data.values.achievementName = "Renamed";
    const out = exportGroup(snap).json.achievements as Json[];
    expect((out[1].conditions as Json[])[0].achievement).toBe("Renamed");
  });
});

describe("achievement link rules", () => {
  const snap = importGroup(group([A, { achievementName: "Third", description: "d", conditions: [{ type: "PlayerLevel", level: 1 }, { type: "AchievementUnlocked", achievement: "x" }] }]));
  const create = snap.nodes.find((n) => n.data.values.achievementName === "First")!;
  const third = snap.nodes.find((n) => n.data.values.achievementName === "Third")!;
  const cond = snap.nodes.find((n) => n.data.kind === "AchievementUnlocked")!;
  const link = (source: string, target: string) => ({ source, target, sourceHandle: "ach-out", targetHandle: "ach:achievement" });

  it("recognises the pin kinds", () => {
    expect(pinKind("ach-out")).toBe("ach");
    expect(pinKind("ach:achievement")).toBe("ach");
    expect(pinKind("icon-out")).toBe("icon");
    expect(pinKind("icon:icon")).toBe("icon");
    expect(pinKind("loc:description")).toBe("loc");
  });
  it("takes an achievement into an achievement field, one wire per field", () => {
    expect(refuseReason(snap.nodes, snap.edges, link(create.id, cond.id))).toBeNull();
    const taken = [...snap.edges, mkEdge(create.id, "ach-out", cond.id, "ach:achievement")];
    expect(refuseReason(snap.nodes, taken, link(third.id, cond.id))).toMatch(/already linked/);
  });
  it("refuses other pin pairs and an achievement waiting for itself", () => {
    expect(refuseReason(snap.nodes, snap.edges, { source: create.id, target: cond.id, sourceHandle: "ach-out", targetHandle: "loc:description" })).toMatch(/differ/);
    expect(refuseReason(snap.nodes, snap.edges, link(third.id, cond.id))).toMatch(/itself/);
  });
});

describe("deleting what an achievement link points at", () => {
  beforeEach(() => useApp.getState().load(importGroup(group([A, needs("First")])), "G.json", {}, null));
  const cond = () => useApp.getState().nodes.find((n) => n.data.kind === "AchievementUnlocked")!;

  it("keeps the name as typed text when the wire is removed", () => {
    const wire = useApp.getState().edges.find((e) => e.sourceHandle === "ach-out")!;
    useApp.getState().onEdgesChange([{ type: "remove", id: wire.id }]);
    expect(cond().data.values.achievement).toBe("First");
  });
  it("keeps the name when the achievement itself is deleted", () => {
    const first = useApp.getState().nodes.find((n) => n.data.values.achievementName === "First")!;
    useApp.getState().onNodesChange([{ type: "remove", id: first.id }]);
    expect(cond().data.values.achievement).toBe("First");
  });
});

describe("achievements that wait for each other", () => {
  it("is an error on each achievement in the loop, for wired and typed references alike", () => {
    const loop = group([
      { achievementName: "A", description: "d", conditions: [{ type: "AchievementUnlocked", achievement: "B" }] },
      { achievementName: "B", description: "d", conditions: [{ type: "AchievementUnlocked", achievement: "A" }] },
      { achievementName: "C", description: "d", conditions: [{ type: "AchievementUnlocked", achievement: "A" }] },
    ]);
    const issues = exportGroup(importGroup(loop)).issues.filter((i) => /waits for itself/.test(i.message));
    expect(issues.map((i) => i.message.match(/"(\w)"/)![1]).sort()).toEqual(["A", "B"]);
    expect(issues.every((i) => i.level === "error" && i.nodeId)).toBe(true);
  });
  it("is fine when the dependencies run one way", () => {
    const chain = group([A, needs("First")]);
    expect(exportGroup(importGroup(chain)).issues.filter((i) => /waits/.test(i.message))).toEqual([]);
  });
});

describe("Icon node", () => {
  const snap = () => {
    const s = importGroup(group([A]));
    const create = s.nodes.find((n) => n.data.kind === "CreateAchievement")!;
    create.data.values.icon = "Old.dds";
    const icon: AppNode = { id: "icon1", type: "ae", position: { x: 0, y: 0 }, data: { kind: "Icon", values: { file: "New.dds" } } };
    return { ...s, create, nodes: [...s.nodes, icon], edges: [...s.edges, mkEdge("icon1", "icon-out", create.id, "icon:icon")] };
  };
  it("sets the achievement's icon from its file, and wins over the typed value", () => {
    const s = snap();
    expect((exportGroup(s).json.achievements as Json[])[0].icon).toBe("New.dds");
  });
  it("can be shared, and an unused or empty one is only a warning", () => {
    const s = snap();
    const a = refuseReason(s.nodes, s.edges, { source: "icon1", target: s.create.id, sourceHandle: "icon-out", targetHandle: "icon:icon" });
    expect(a).toMatch(/already linked/);
    s.edges.pop();
    s.nodes[s.nodes.length - 1].data.values = {};
    const msgs = exportGroup(s).issues.map((i) => i.message);
    expect(msgs).toContain("An Icon node has no file.");
    expect(msgs).toContain("An Icon node is not used by any achievement.");
    expect(exportGroup(s).issues.every((i) => i.level === "warning")).toBe(true);
  });
  it("has no input pin of its own", () => {
    const s = snap();
    expect(refuseReason(s.nodes, s.edges, { source: "icon1", target: "icon1", sourceHandle: "icon-out", targetHandle: "icon:file" })).not.toBeNull();
  });
});

describe("spawn menu for the new pins", () => {
  const s = importGroup(group([A]));
  const create = s.nodes.find((n) => n.data.kind === "CreateAchievement")!;
  it("offers Achievement Unlocked from an achievement's output, and Create Achievement from the field's pin", () => {
    const out = spawnOptions(s.nodes, s.edges, { nodeId: create.id, handleId: "ach-out", handleType: "source" });
    expect(out.map((o) => o.pin)).toEqual(["ach:achievement"]);
    expect(out[0].def.kind).toBe("AchievementUnlocked");
    const back = spawnOptions(s.nodes, s.edges, { nodeId: "x", handleId: "ach:achievement", handleType: "target" });
    expect(back.map((o) => o.def.kind)).toEqual(["CreateAchievement"]);
  });
  it("offers an Icon node for an icon field", () => {
    const out = spawnOptions(s.nodes, s.edges, { nodeId: create.id, handleId: "icon:icon", handleType: "target" });
    expect(out.map((o) => o.def.kind)).toEqual(["Icon"]);
  });
});

describe("pasting nodes that were wired to what is not copied", () => {
  it("turns achievement and icon wires into typed values", () => {
    const base = importGroup(group([A, needs("First")]));
    useApp.getState().load(base, "G.json", { EN: parseLoc("G_EN.txt", "") }, null);
    const cond = useApp.getState().nodes.find((n) => n.data.kind === "AchievementUnlocked")!;
    useApp.setState({ nodes: useApp.getState().nodes.map((n) => ({ ...n, selected: n.id === cond.id })) });
    copySelection();
    paste();
    const copies = useApp.getState().nodes.filter((n) => n.data.kind === "AchievementUnlocked");
    expect(copies).toHaveLength(2);
    expect(copies.find((n) => n.id !== cond.id)!.data.values.achievement).toBe("First");
  });
});

describe("Icon nodes on import", () => {
  const raw = group([
    { ...A, icon: "Shared.dds" },
    { achievementName: "Second", description: "d", icon: "Shared.dds" },
    { achievementName: "Third", description: "d", icon: "Other.dds" },
    { achievementName: "Fourth", description: "d" },
  ]);
  it("makes one Icon node per file, shared by the achievements that use it, and writes the same JSON back", () => {
    const snap = importGroup(raw);
    const icons = snap.nodes.filter((n) => n.data.kind === "Icon");
    expect(icons.map((n) => n.data.values.file).sort()).toEqual(["Other.dds", "Shared.dds"]);
    expect(snap.edges.filter((e) => e.sourceHandle === "icon-out")).toHaveLength(3);
    expect(snap.nodes.filter((n) => n.data.kind === "CreateAchievement").every((n) => n.data.values.icon === undefined)).toBe(true);
    expect(strip(exportGroup(snap).json)).toEqual(raw);
    expect(exportGroup(snap).issues).toEqual([]);
  });
  it("keeps where the Icon nodes were put", () => {
    const first = exportGroup(importGroup(raw)).json;
    const moved = importGroup(first);
    moved.nodes.find((n) => n.data.kind === "Icon" && n.data.values.file === "Other.dds")!.position = { x: 123, y: 456 };
    const again = exportGroup(importGroup(exportGroup(moved).json)).json;
    expect((again._editor as { icons: Record<string, unknown> }).icons["Other.dds"]).toEqual({ x: 123, y: 456 });
  });
  it("gives the typed name back when its Icon node is deleted", () => {
    useApp.getState().load(importGroup(raw), "G.json", {}, null);
    const icon = useApp.getState().nodes.find((n) => n.data.kind === "Icon" && n.data.values.file === "Shared.dds")!;
    useApp.getState().onNodesChange([{ type: "remove", id: icon.id }]);
    const icons = useApp.getState().nodes.filter((n) => n.data.kind === "CreateAchievement").map((n) => n.data.values.icon);
    expect(icons).toEqual(["Shared.dds", "Shared.dds", undefined, undefined]);
  });
});

describe("Plugin Override node", () => {
  const raw = group([{ ...A, pluginOverride: "B.esp", conditions: [{ type: "HasPerk", formID: "1" }, { type: "HasPerk", formID: "2", pluginOverride: "C.esp" }] }]);
  it("imports as shared nodes, one per file, and writes the same JSON back", () => {
    const snap = importGroup(raw);
    expect(snap.nodes.filter((n) => n.data.kind === "PluginOverride").map((n) => n.data.values.plugin).sort()).toEqual(["B.esp", "C.esp"]);
    expect(strip(exportGroup(snap).json)).toEqual(raw);
    expect(exportGroup(snap).issues).toEqual([]);
  });
  it("is inherited achievement -> condition, and the condition's own override wins", () => {
    const snap = importGroup(raw);
    const [inherits, own] = snap.nodes.filter((n) => n.data.kind === "HasPerk");
    const create = snap.nodes.find((n) => n.data.kind === "CreateAchievement")!;
    expect(pluginOf(snap.nodes, snap.edges, create, "A.esp")).toBe("B.esp");
    expect(pluginOf(snap.nodes, snap.edges, inherits, "A.esp")).toBe("B.esp");
    expect(pluginOf(snap.nodes, snap.edges, own, "A.esp")).toBe("C.esp");
    const plain = importGroup(group([{ ...A, conditions: [{ type: "HasPerk", formID: "1" }] }]));
    expect(pluginOf(plain.nodes, plain.edges, plain.nodes.find((n) => n.data.kind === "HasPerk")!, "A.esp")).toBe("A.esp");
  });
});
