import { beforeEach, describe, expect, it } from "vitest";
import { exportGroup } from "./io/exportGroup";
import { importGroup, mkEdge } from "./io/importGroup";
import { changedLocFiles, getText, parseLoc } from "./io/localization";
import { linkedText } from "./graph";
import { beginDrag, endDrag, isDirty, useApp } from "./store";

const raw = {
  groupName: "G",
  plugin: "A.esp",
  achievements: [{ achievementName: "$NAME", description: "d", conditions: [{ type: "PlayerLevel", level: 5 }] }],
};
const en = () => parseLoc("G_EN.txt", "$NAME\tHello\r\n$OTHER\tx\r\n");

const open = () => useApp.getState().load(importGroup(raw), "G.json", { EN: en() }, null);
const keyNode = () => useApp.getState().nodes.find((n) => n.data.kind === "LocalizedText")!;

beforeEach(open);

describe("document state", () => {
  it("is clean after opening, dirty after an edit, clean again after saving", () => {
    expect(isDirty()).toBe(false);
    useApp.getState().setTranslation("EN", "NAME", "Hi");
    expect(isDirty()).toBe(true);
    useApp.getState().markSaved("G.json");
    expect(isDirty()).toBe(false);
  });

  it("selecting or measuring a node is not an edit", () => {
    const n = useApp.getState().nodes[0];
    useApp.getState().onNodesChange([{ type: "select", id: n.id, selected: true }]);
    expect(isDirty()).toBe(false);
  });

  it("writes only changed locale files, and never an empty new language", () => {
    const s = () => useApp.getState();
    expect(changedLocFiles(s().loc, s().locOriginal)).toEqual([]);
    s().addLanguage("fr");
    expect(s().loc.FR.fileName).toBe("G_FR.txt");
    expect(changedLocFiles(s().loc, s().locOriginal)).toEqual([]);
    s().setTranslation("FR", "NAME", "Salut");
    s().setTranslation("EN", "NAME", "Hi");
    expect(changedLocFiles(s().loc, s().locOriginal).map((f) => f.name).sort()).toEqual(["G_EN.txt", "G_FR.txt"]);
    expect(changedLocFiles(s().loc, s().locOriginal).find((f) => f.name === "G_EN.txt")!.text).toBe("$NAME\tHi\r\n$OTHER\tx\r\n");
  });
});

describe("languages", () => {
  it("removes an empty language but never one with translations", () => {
    useApp.getState().addLanguage("PO");
    expect(useApp.getState().loc.PO).toBeDefined();
    useApp.getState().removeLanguage("PO");
    expect(useApp.getState().loc.PO).toBeUndefined();
    useApp.getState().removeLanguage("EN");
    expect(useApp.getState().loc.EN).toBeDefined();
  });
});

describe("LocalizedText keys", () => {
  it("renaming a key moves its translations, in one undo step", () => {
    const { setValue } = useApp.getState();
    setValue(keyNode().id, "key", "TITLE");
    expect(getText(useApp.getState().loc.EN, "TITLE")).toBe("Hello");
    expect(getText(useApp.getState().loc.EN, "NAME")).toBeUndefined();
    useApp.temporal.getState().undo();
    expect(keyNode().data.values.key).toBe("NAME");
    expect(getText(useApp.getState().loc.EN, "NAME")).toBe("Hello");
  });

  it("exports the renamed key and keeps unused keys in the language file", () => {
    useApp.getState().setValue(keyNode().id, "key", "TITLE");
    const { json } = exportGroup(useApp.getState());
    expect((json.achievements as { achievementName: string }[])[0].achievementName).toBe("$TITLE");
    expect(getText(useApp.getState().loc.EN, "OTHER")).toBe("x");
  });
});

describe("translation warnings on export", () => {
  const messages = () => exportGroup(useApp.getState()).issues.map((i) => i.message);

  it("is quiet when every language has the key", () => {
    expect(messages()).toEqual([]);
  });
  it("names the languages that lack a translation", () => {
    useApp.getState().addLanguage("GE");
    expect(messages()).toEqual(['Localized Text "NAME" has no translation for GE.']);
  });
  it("warns when languages exist but English, the fallback, does not", () => {
    useApp.getState().load(importGroup(raw), "G.json", { GE: parseLoc("G_GE.txt", "$NAME\tHallo\r\n") }, null);
    expect(messages()).toEqual([expect.stringContaining("no English (EN) file")]);
  });
  it("warns once when a used key has no languages at all", () => {
    useApp.getState().load(importGroup(raw), "G.json", {}, null);
    expect(messages()).toEqual([expect.stringContaining("No languages are set up")]);
  });
});

describe("deleting Localized Text", () => {
  const field = (kind: string, name: string) => useApp.getState().nodes.find((n) => n.data.kind === kind)?.data.values[name];
  const wired = () => useApp.getState().edges.filter((e) => e.sourceHandle === "loc-out");
  /** Delete the way React Flow reports it: the node's wires first, then the node. */
  const deleteKey = (id: string) => {
    const s = useApp.getState();
    s.onEdgesChange(s.edges.filter((e) => e.source === id).map((e) => ({ type: "remove" as const, id: e.id })));
    s.onNodesChange([{ type: "remove", id }]);
  };

  it("fields keep the English text as plain text, in one undo step", () => {
    deleteKey(keyNode().id);
    expect(field("CreateAchievement", "achievementName")).toBe("Hello");
    expect(useApp.getState().nodes.some((n) => n.data.kind === "LocalizedText")).toBe(false);
    expect(wired()).toHaveLength(0);
    useApp.temporal.getState().undo();
    expect(keyNode()).toBeDefined();
    expect(wired()).toHaveLength(1);
    expect(field("CreateAchievement", "achievementName")).toBeUndefined();
  });

  it("falls back to the next language when there is no English, and leaves the field empty with no text at all", () => {
    useApp.getState().load(importGroup(raw), "G.json", { GE: parseLoc("G_GE.txt", "$NAME\tHallo\r\n") }, null);
    deleteKey(keyNode().id);
    expect(field("CreateAchievement", "achievementName")).toBe("Hallo");

    useApp.getState().load(importGroup(raw), "G.json", {}, null);
    deleteKey(keyNode().id);
    expect(field("CreateAchievement", "achievementName")).toBeUndefined();
  });

  it("removing only the wire does the same", () => {
    const e = wired()[0];
    useApp.getState().onEdgesChange([{ type: "remove", id: e.id }]);
    expect(field("CreateAchievement", "achievementName")).toBe("Hello");
    expect(keyNode()).toBeDefined();
  });

  it("keeps the translations: the key becomes an unused entry", () => {
    deleteKey(keyNode().id);
    expect(getText(useApp.getState().loc.EN, "NAME")).toBe("Hello");
  });

  it("unrelated deletes are unaffected", () => {
    const cond = useApp.getState().nodes.find((n) => n.data.kind === "PlayerLevel")!;
    useApp.getState().onNodesChange([{ type: "remove", id: cond.id }]);
    expect(useApp.getState().nodes.some((n) => n.id === cond.id)).toBe(false);
    expect(field("CreateAchievement", "achievementName")).toBeUndefined();
  });
});

describe("renaming an achievement", () => {
  const two = {
    groupName: "G",
    plugin: "A.esp",
    achievements: [
      { achievementName: "First", description: "d", conditions: [{ type: "PlayerLevel", level: 1 }] },
      {
        achievementName: "Second",
        description: "d",
        conditions: [
          { type: "AchievementUnlocked", achievement: "First" },
          { type: "AchievementUnlocked", achievement: "First", group: "G" },
          { type: "AchievementUnlocked", achievement: "First", group: "Other" },
          { type: "AchievementUnlocked", achievement: "Third" },
        ],
      },
    ],
  };
  const named = (n: string) => useApp.getState().nodes.find((x) => x.data.kind === "CreateAchievement" && x.data.values.achievementName === n)!;
  // A reference is a wire to its achievement when it names one of this group, otherwise typed text.
  const refs = () => {
    const { nodes, edges, loc } = useApp.getState();
    return nodes
      .filter((x) => x.data.kind === "AchievementUnlocked")
      .map((x) => {
        const wire = edges.find((e) => e.target === x.id && e.targetHandle === "ach:achievement");
        const name = wire ? linkedText(nodes, edges, loc, nodes.find((n) => n.id === wire.source)!, "ach") : x.data.values.achievement;
        return `${name}${x.data.values.group ? "@" + x.data.values.group : ""}`;
      });
  };
  const openTwo = () => useApp.getState().load(importGroup(two), "G.json", {}, null);

  it("updates references in this group, but not ones pointing at another group", () => {
    openTwo();
    const r = useApp.getState().renameAchievement(named("First").id, "Renamed");
    expect(r).toEqual({ old: "First", updated: 2, existed: true });
    expect(refs()).toEqual(["Renamed", "Renamed@G", "First@Other", "Third"]);
    expect(named("Renamed")).toBeDefined();
  });

  it("is one undo step that restores the name and every reference", () => {
    openTwo();
    useApp.getState().renameAchievement(named("First").id, "Renamed");
    expect(useApp.temporal.getState().pastStates).toHaveLength(1);
    useApp.temporal.getState().undo();
    expect(refs()).toEqual(["First", "First@G", "First@Other", "Third"]);
    expect(named("First")).toBeDefined();
  });

  it("only warns for names that are already in the opened or saved file", () => {
    openTwo();
    const fresh = useApp.getState();
    fresh.addNode("CreateAchievement", { x: 0, y: 0 });
    const id = useApp.getState().nodes.at(-1)!.id;
    useApp.getState().setValue(id, "achievementName", "Brand new");
    expect(useApp.getState().renameAchievement(id, "Brand newer").existed).toBe(false);
    expect(useApp.getState().renameAchievement(named("Second").id, "Second!").existed).toBe(true);
    useApp.getState().markSaved("G.json");
    // After saving, the renamed name is the one on disk.
    expect(useApp.getState().renameAchievement(named("Second!").id, "Second?").existed).toBe(true);
    expect(useApp.getState().renameAchievement(id, "Again").existed).toBe(true);
  });

  it("leaves typed references alone when the new name is empty or unchanged; a wire just has no name until there is one", () => {
    openTwo();
    expect(useApp.getState().renameAchievement(named("First").id, "First").updated).toBe(0);
    useApp.getState().renameAchievement(named("First").id, "");
    expect(refs()).toEqual(["undefined", "First@G", "First@Other", "Third"]);
  });
});

describe("undo while typing", () => {
  const wait = () => new Promise((r) => setTimeout(r, 40));
  const type = async (id: string, texts: string[]) => {
    for (const t of texts) {
      useApp.getState().setValue(id, "description", t);
      await wait();
    }
  };
  const desc = (id: string) => useApp.getState().nodes.find((n) => n.id === id)!.data.values.description;

  it("undoes one word at a time", async () => {
    open();
    const id = useApp.getState().nodes.find((n) => n.data.kind === "CreateAchievement")!.id;
    useApp.getState().setValue(id, "icon", "x.dds");
    await wait();
    useApp.temporal.getState().clear();
    await type(id, ["h", "he", "hel", "hello ", "hello w", "hello wo"]);
    expect(useApp.temporal.getState().pastStates).toHaveLength(2);
    useApp.temporal.getState().undo();
    expect(desc(id)).toBe("hello ");
    useApp.temporal.getState().undo();
    expect(desc(id)).toBe("d");
  });
  it("does not join edits to different fields or after another change", async () => {
    open();
    const id = useApp.getState().nodes.find((n) => n.data.kind === "CreateAchievement")!.id;
    useApp.temporal.getState().clear();
    await type(id, ["a", "ab"]);
    useApp.getState().setValue(id, "icon", "x.dds");
    await wait();
    await type(id, ["abc"]);
    expect(useApp.temporal.getState().pastStates).toHaveLength(3);
  });
});

describe("naming a new achievement", () => {
  it("keeps the name typed into a field that was empty", () => {
    useApp.getState().load({ nodes: [], edges: [], group: { groupName: "G", plugin: "A.esp" }, groupExtra: {} }, "G.json", {}, null);
    useApp.getState().addNode("CreateAchievement", { x: 0, y: 0 });
    const id = useApp.getState().nodes[0].id;
    const r = useApp.getState().renameAchievement(id, "Brand new");
    expect(useApp.getState().nodes[0].data.values.achievementName).toBe("Brand new");
    expect(r).toMatchObject({ updated: 0, existed: false });
  });
  it("keeps it after a Localized Text wire into the field is removed", () => {
    useApp.getState().load({ nodes: [], edges: [], group: { groupName: "G", plugin: "A.esp" }, groupExtra: {} }, "G.json", {}, null);
    useApp.getState().addNode("CreateAchievement", { x: 0, y: 0 });
    useApp.getState().addNode("LocalizedText", { x: 0, y: 0 });
    const [create, text] = useApp.getState().nodes.map((n) => n.id);
    const wire = mkEdge(text, "loc-out", create, "loc:achievementName");
    useApp.setState({ edges: [wire] });
    useApp.getState().onEdgesChange([{ type: "remove", id: wire.id }]);
    expect(useApp.getState().nodes.find((n) => n.id === create)!.data.values.achievementName).toBeUndefined();
    useApp.getState().renameAchievement(create, "Typed after");
    expect(useApp.getState().nodes.find((n) => n.id === create)!.data.values.achievementName).toBe("Typed after");
  });
});

describe("history keeps measured sizes", () => {
  // With only the visible nodes mounted, a node that loses its measured size is mounted again to be measured: restoring
  // history without them would mount the whole document on every undo.
  it("undo and redo restore nodes with their measured size", () => {
    const s = () => useApp.getState();
    s().onNodesChange(s().nodes.map((n) => ({ type: "dimensions" as const, id: n.id, dimensions: { width: 288, height: 120 } })));
    const level = s().nodes.find((n) => n.data.kind === "PlayerLevel")!;
    s().setValue(level.id, "level", 9);
    s().setValue(level.id, "level", 10);
    expect(s().nodes.every((n) => n.measured?.width === 288)).toBe(true);
    s().setValue(level.id, "level", 11);
    useApp.temporal.getState().undo();
    expect(s().nodes.find((n) => n.id === level.id)!.data.values.level).not.toBe(11);
    expect(s().nodes.every((n) => n.measured?.width === 288 && n.measured?.height === 120)).toBe(true);
    useApp.temporal.getState().redo();
    expect(s().nodes.every((n) => n.measured?.width === 288)).toBe(true);
  });
});

describe("replacing an unknown condition", () => {
  const future = { type: "FutureThing", formID: "1A2B", amount: 3, onUnlock: [{ type: "command", command: "x" }] };
  const openFuture = () =>
    useApp.getState().load(importGroup({ groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d", conditions: [future, { type: "PlayerLevel", level: 5 }] }] }), "G.json", {}, null);
  const unknown = () => useApp.getState().nodes.find((n) => n.data.kind === "UnknownCondition")!;

  it("keeps the node, its place and its wires, and moves matching keys into fields", () => {
    openFuture();
    const before = unknown();
    const wires = useApp.getState().edges;
    useApp.getState().replaceConditions([before.id], "HasPerk");
    const after = useApp.getState().nodes.find((n) => n.id === before.id)!;
    expect(after.data).toEqual({ kind: "HasPerk", values: { formID: "1A2B" }, extra: { amount: 3 } });
    expect(after.position).toEqual(before.position);
    expect(useApp.getState().edges).toBe(wires);
    expect(after.measured).toBeUndefined();
  });

  it("writes the new type, still carrying what the file had and the condition's own actions", () => {
    openFuture();
    useApp.getState().replaceConditions([unknown().id], "HasPerk");
    const { json, issues } = exportGroup(useApp.getState() as never);
    const c = (json.achievements as { conditions: Record<string, unknown>[] }[])[0].conditions[0];
    expect(c).toMatchObject({ type: "HasPerk", formID: "1A2B", amount: 3, onUnlock: [{ type: "command", command: "x" }] });
    expect(issues.some((i) => /not a condition type/.test(i.message))).toBe(false);
  });

  it("is one undo step", () => {
    openFuture();
    const id = unknown().id;
    useApp.getState().replaceConditions([id], "HasPerk");
    useApp.temporal.getState().undo();
    expect(useApp.getState().nodes.find((n) => n.id === id)!.data.kind).toBe("UnknownCondition");
  });

  it("replaces several at once, each keeping its own keys, in one undo step", () => {
    useApp.getState().load(
      importGroup({
        groupName: "G",
        plugin: "A.esp",
        achievements: [{ achievementName: "A", description: "d", conditions: [{ type: "FutureThing", formID: "1" }, { type: "OtherThing", formID: "2", amount: 4 }, { type: "PlayerLevel", level: 5 }] }],
      }),
      "G.json",
      {},
      null,
    );
    const unknowns = () => useApp.getState().nodes.filter((n) => n.data.kind === "UnknownCondition");
    // A known condition in the selection is replaced with the rest; the Add Conditions node is not a condition and stays.
    const ids = [...useApp.getState().nodes.filter((n) => ["UnknownCondition", "PlayerLevel", "AddConditions"].includes(n.data.kind)).map((n) => n.id)];
    useApp.getState().replaceConditions(ids, "HasPerk");
    const nodes = useApp.getState().nodes;
    expect(unknowns()).toHaveLength(0);
    expect(nodes.filter((n) => n.data.kind === "HasPerk").map((n) => [n.data.values, n.data.extra])).toEqual([[{ formID: "1" }, undefined], [{ formID: "2" }, { amount: 4 }], [{}, undefined]]);
    expect(nodes.filter((n) => n.data.kind === "AddConditions")).toHaveLength(1);
    useApp.temporal.getState().undo();
    expect(unknowns()).toHaveLength(2);
    expect(useApp.getState().nodes.filter((n) => n.data.kind === "PlayerLevel")).toHaveLength(1);
  });

  it("only replaces conditions, and only with a real condition type", () => {
    openFuture();
    const run = useApp.getState().nodes.find((n) => n.data.kind === "RunCommand") ?? { id: "none" };
    useApp.getState().replaceConditions([run.id, unknown().id], "RunCommand");
    useApp.getState().replaceConditions([unknown().id], "UnknownCondition");
    expect(unknown()).toBeTruthy();
    expect(useApp.getState().nodes.some((n) => n.data.kind === "RunCommand")).toBe(true); // the action from the file, untouched
  });
});

describe("replacing a known condition", () => {
  const raw = (conditions: object[]) => importGroup({ groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d", conditions }] });
  const open = (conditions: object[]) => useApp.getState().load(raw(conditions), "G.json", {}, null);
  const kind = (k: string) => useApp.getState().nodes.find((n) => n.data.kind === k)!;

  it("carries over the fields the new type shares and drops the ones it does not have", () => {
    open([{ type: "ItemInInventory", formID: "0896F5", quantity: 3, futureKey: true }]);
    const id = kind("ItemInInventory").id;
    useApp.getState().replaceConditions([id], "SpellCast"); // both have formID and quantity
    expect(kind("SpellCast").data).toEqual({ kind: "SpellCast", values: { formID: "0896F5", quantity: 3 }, extra: { futureKey: true } });
    useApp.getState().replaceConditions([id], "PlayerLevel"); // neither field exists on it
    expect(kind("PlayerLevel").data).toEqual({ kind: "PlayerLevel", values: {}, extra: { futureKey: true } });
    expect(useApp.getState().nodes.find((n) => n.id === id)!.position).toEqual(kind("PlayerLevel").position);
  });

  it("removes the wires the new type cannot hold, and keeps the rest", () => {
    open([{ type: "ConditionsMet", quantity: 1, conditions: [{ type: "PlayerLevel", level: 1 }, { type: "HasPerk", formID: "1" }] }]);
    const met = kind("ConditionsMet");
    const into = (id: string) => useApp.getState().edges.filter((e) => e.target === id).length;
    expect(into(met.id)).toBe(2); // the two conditions wired into it (its own output goes to Add Conditions)
    useApp.getState().replaceConditions([met.id], "ItemEquipped");
    expect(into(met.id)).toBe(0);
    expect(useApp.getState().edges.some((e) => e.source === met.id && e.sourceHandle === "cond-out")).toBe(true);
    useApp.temporal.getState().undo(); // one step puts the node and its wires back
    expect(into(met.id)).toBe(2);
    expect(kind("ConditionsMet")).toBeTruthy();
  });

  it("leaves a condition that already has the type alone", () => {
    open([{ type: "PlayerLevel", level: 4 }]);
    const before = useApp.getState().nodes;
    useApp.getState().replaceConditions([kind("PlayerLevel").id], "PlayerLevel");
    expect(useApp.getState().nodes).toBe(before);
  });
});

describe("collapsing an achievement", () => {
  const s = () => useApp.getState();
  const create = () => s().nodes.find((n) => n.data.kind === "CreateAchievement")!;

  it("toggles, and is a view setting: not unsaved changes, not in the undo history", () => {
    const past = useApp.temporal.getState().pastStates.length;
    s().toggleCollapsed(create().id);
    expect(s().collapsed).toEqual({ [create().id]: true });
    expect(isDirty()).toBe(false);
    expect(useApp.temporal.getState().pastStates.length).toBe(past);
    s().toggleCollapsed(create().id);
    expect(s().collapsed).toEqual({});
  });

  it("deselects the nodes it hides, so Delete cannot reach them", () => {
    const level = s().nodes.find((n) => n.data.kind === "PlayerLevel")!;
    s().onNodesChange([{ type: "select", id: level.id, selected: true }, { type: "select", id: create().id, selected: true }]);
    s().toggleCollapsed(create().id);
    expect(s().nodes.find((n) => n.id === level.id)!.selected).toBe(false);
    expect(s().nodes.find((n) => n.id === create().id)!.selected).toBe(true);
  });

  it("carries what it hides along when its one node is moved, so they come back together", () => {
    const level = () => s().nodes.find((n) => n.data.kind === "PlayerLevel")!;
    const [c0, l0] = [create().position, level().position];
    s().toggleCollapsed(create().id);
    s().onNodesChange([{ type: "position", id: create().id, position: { x: c0.x + 120, y: c0.y + 60 }, dragging: false }]);
    s().toggleCollapsed(create().id);
    expect(level().position).toEqual({ x: l0.x + 120, y: l0.y + 60 });
    expect(level().position.x - create().position.x).toBe(l0.x - c0.x); // the layout between them is as it was
  });

  it("is one undo step, which puts the hidden nodes back too", () => {
    const level = () => s().nodes.find((n) => n.data.kind === "PlayerLevel")!;
    const [c0, l0] = [create().position, level().position];
    s().toggleCollapsed(create().id);
    beginDrag();
    for (const step of [20, 60, 100]) s().onNodesChange([{ type: "position", id: create().id, position: { x: c0.x + step, y: c0.y }, dragging: true }]);
    endDrag();
    expect(level().position.x).toBe(l0.x + 100);
    useApp.temporal.getState().undo();
    expect(create().position).toEqual(c0);
    expect(level().position).toEqual(l0);
  });

  it("does not move the rest of an achievement when it is expanded", () => {
    const level = () => s().nodes.find((n) => n.data.kind === "PlayerLevel")!;
    const l0 = level().position;
    s().onNodesChange([{ type: "position", id: create().id, position: { x: create().position.x + 50, y: create().position.y }, dragging: false }]);
    expect(level().position).toEqual(l0);
  });

  it("starts over when another document is opened", () => {
    s().toggleCollapsed(create().id);
    open();
    expect(s().collapsed).toEqual({});
  });
});

describe("reordering achievements", () => {
  const s = () => useApp.getState();
  const three = () =>
    s().load(
      importGroup({
        groupName: "G",
        plugin: "A.esp",
        achievements: ["One", "Two", "Three"].map((name, i) => ({ achievementName: name, description: "d", conditions: [{ type: "PlayerLevel", level: i + 1 }] })),
      }),
      "G.json",
      {},
      null,
    );
  const creates = () => s().nodes.filter((n) => n.data.kind === "CreateAchievement");
  const names = () => creates().map((n) => n.data.values.achievementName);
  const jsonNames = () => ((exportGroup(s() as never).json.achievements as { achievementName: string }[]).map((a) => a.achievementName));

  it("changes the order of the file and the order down the canvas, in one undo step", () => {
    three();
    const [one, two, three_] = creates();
    const ys = () => Object.fromEntries(creates().map((n) => [n.data.values.achievementName, n.position.y]));
    const before = ys();
    expect(before.One).toBeLessThan(before.Two);
    s().reorderAchievements([three_.id, one.id, two.id]);
    expect(names()).toEqual(["Three", "One", "Two"]);
    expect(jsonNames()).toEqual(["Three", "One", "Two"]);
    expect(ys().Three).toBeLessThan(ys().One);
    expect(ys().One).toBeLessThan(ys().Two);
    // each one's conditions moved with it
    const level = (n: number) => s().nodes.find((x) => x.data.kind === "PlayerLevel" && x.data.values.level === n)!;
    expect(level(3).position.y).toBeLessThan(level(1).position.y);
    expect(isDirty()).toBe(true);
    useApp.temporal.getState().undo();
    expect(names()).toEqual(["One", "Two", "Three"]);
    expect(ys()).toEqual(before);
  });

  it("leaves the other nodes where they are in the node list", () => {
    three();
    const [one, , three_] = creates();
    const others = () => s().nodes.map((n, i) => [i, n.id] as const).filter(([, id]) => !creates().some((c) => c.id === id));
    const was = others();
    s().reorderAchievements([three_.id, creates()[1].id, one.id]);
    expect(others()).toEqual(was);
  });

  it("ignores an order that is not every achievement exactly once, and one that changes nothing", () => {
    three();
    const [one, two, three_] = creates();
    const before = s().nodes;
    s().reorderAchievements([one.id, two.id]);
    s().reorderAchievements([one.id, one.id, two.id]);
    s().reorderAchievements([one.id, two.id, "nobody"]);
    s().reorderAchievements([one.id, two.id, three_.id]);
    expect(s().nodes).toBe(before);
  });
});
