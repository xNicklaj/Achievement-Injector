import { describe, expect, it } from "vitest";
import { importGroup } from "./io/importGroup";
import { matchesSpawn, spawnOptions, type SpawnFrom } from "./spawn";
import { nodeDefs } from "./registry";
import { useApp } from "./store";

const load = (a: object) => importGroup({ groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d", ...a }] });
const kinds = (o: { def: { kind: string } }[]) => o.map((x) => x.def.kind).sort();
const node = (snap: ReturnType<typeof load>, kind: string) => snap.nodes.find((n) => n.data.kind === kind)!;
const from = (id: string, handleId: string, handleType: "source" | "target"): SpawnFrom => ({ nodeId: id, handleId, handleType });

describe("spawn menu options", () => {
  it("offers every node type when there is no wire", () => {
    const snap = load({});
    expect(spawnOptions(snap.nodes, snap.edges, null)).toHaveLength(nodeDefs.length);
  });

  it("from a flow output: only nodes with a flow input, and never a second AddConditions in the chain", () => {
    const bare = load({});
    const afterCreate = spawnOptions(bare.nodes, bare.edges, from(node(bare, "CreateAchievement").id, "flow-out", "source"));
    expect(kinds(afterCreate)).toEqual(["AddConditions", "CallPapyrus", "JoinType", "RunCommand"]);

    const chained = load({ conditions: [] });
    const afterAdd = spawnOptions(chained.nodes, chained.edges, from(node(chained, "AddConditions").id, "flow-out", "source"));
    expect(kinds(afterAdd)).toEqual(["CallPapyrus", "JoinType", "RunCommand"]);
  });

  it("from a flow input: nodes with a flow output (the entry node and chain nodes), minus what would break a rule", () => {
    const snap = load({ conditions: [] });
    const into = spawnOptions(snap.nodes, snap.edges, from(node(snap, "AddConditions").id, "flow-in", "target"));
    // Its flow-in is already wired, so nothing can attach there.
    expect(into).toEqual([]);
  });

  it("from a condition output: AddConditions, Live and Negate (it joins a chain later, so the chain rule does not apply yet)", () => {
    const snap = load({});
    snap.nodes.push({ id: "c", type: "ae", position: { x: 0, y: 0 }, data: { kind: "PlayerLevel", values: { level: 1 } } });
    expect(kinds(spawnOptions(snap.nodes, snap.edges, from("c", "cond-out", "source")))).toEqual(["AddConditions", "Live", "Negate"]);
  });

  it("offers nothing from a condition output that already feeds an AddConditions", () => {
    const snap = load({ conditions: [{ type: "PlayerLevel", level: 1 }] });
    expect(spawnOptions(snap.nodes, snap.edges, from(node(snap, "PlayerLevel").id, "cond-out", "source"))).toEqual([]);
  });

  it("from a condition input: every condition type", () => {
    const snap = load({ conditions: [] });
    const opts = spawnOptions(snap.nodes, snap.edges, from(node(snap, "AddConditions").id, "cond-in", "target"));
    // every condition type, plus Live and Negate
    expect(opts).toHaveLength(33);
    expect(opts.every((o) => o.pin === "cond-out")).toBe(true);
  });

  it("from a localizable field: Localized Text; from a Localized Text output: one choice per localizable field", () => {
    const snap = load({});
    const text = spawnOptions(snap.nodes, snap.edges, from(node(snap, "CreateAchievement").id, "loc:achievementName", "target"));
    expect(text.map((o) => [o.def.kind, o.pin])).toEqual([["LocalizedText", "loc-out"]]);

    const withKey = load({});
    withKey.nodes.push({ id: "k", type: "ae", position: { x: 0, y: 0 }, data: { kind: "LocalizedText", values: { key: "K" } } });
    const fields = spawnOptions(withKey.nodes, withKey.edges, from("k", "loc-out", "source"));
    expect(fields.map((o) => o.label)).toEqual(
      expect.arrayContaining(["Create Achievement · AchievementName", "Create Achievement · Description", "Book Read · BookID", "Location Discovery · LocationID", "Base Actor Death · Name"]),
    );
    expect(fields.every((o) => o.pin?.startsWith("loc:"))).toBe(true);
  });

  it("searches by title, type name and keywords, every word must match", () => {
    const [quest] = spawnOptions([], [], null).filter((o) => o.def.kind === "QuestStageDone");
    expect(matchesSpawn(quest, "quest")).toBe(true);
    expect(matchesSpawn(quest, "stage done")).toBe(true);
    expect(matchesSpawn(quest, "QuestStageDone")).toBe(true);
    expect(matchesSpawn(quest, "quest dragon")).toBe(false);
  });
});

describe("creating a node from a wire", () => {
  it("adds the node and the wire in one undo step", () => {
    useApp.getState().load(load({}), "G.json", {}, null);
    const create = useApp.getState().nodes.find((n) => n.data.kind === "CreateAchievement")!;
    useApp.getState().addNodeConnected("AddConditions", { x: 400, y: 0 }, { from: from(create.id, "flow-out", "source"), pin: "flow-in" });
    const s = useApp.getState();
    expect(s.nodes.map((n) => n.data.kind)).toEqual(["CreateAchievement", "AddConditions"]);
    expect(s.edges).toHaveLength(1);
    expect(s.edges[0]).toMatchObject({ source: create.id, sourceHandle: "flow-out", targetHandle: "flow-in" });
    expect(useApp.temporal.getState().pastStates).toHaveLength(1);
    useApp.temporal.getState().undo();
    expect(useApp.getState().nodes).toHaveLength(1);
    expect(useApp.getState().edges).toHaveLength(0);
  });

  it("from an input pin the new node's output ends at it", () => {
    useApp.getState().load(load({ conditions: [] }), "G.json", {}, null);
    const add = useApp.getState().nodes.find((n) => n.data.kind === "AddConditions")!;
    useApp.getState().addNodeConnected("PlayerLevel", { x: 0, y: 0 }, { from: from(add.id, "cond-in", "target"), pin: "cond-out" });
    const e = useApp.getState().edges.find((x) => x.sourceHandle === "cond-out")!;
    expect(e.target).toBe(add.id);
    expect(e.targetHandle).toBe("cond-in");
  });

  it("still creates the node, without a wire, when the wire is no longer allowed", () => {
    useApp.getState().load(load({ conditions: [] }), "G.json", {}, null);
    const add = useApp.getState().nodes.find((n) => n.data.kind === "AddConditions")!;
    useApp.getState().addNodeConnected("AddConditions", { x: 0, y: 0 }, { from: from(add.id, "flow-out", "source"), pin: "flow-in" });
    expect(useApp.getState().nodes).toHaveLength(3);
    expect(useApp.getState().edges.filter((e) => e.sourceHandle === "flow-out" && e.source === add.id)).toHaveLength(0);
  });
});
