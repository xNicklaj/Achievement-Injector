import { beforeEach, describe, expect, it } from "vitest";
import { exportGroup } from "./io/exportGroup";
import { importGroup } from "./io/importGroup";
import { changedLocFiles, getText, parseLoc } from "./io/localization";
import { isDirty, useApp } from "./store";

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
  const refs = () => useApp.getState().nodes.filter((x) => x.data.kind === "AchievementUnlocked").map((x) => `${x.data.values.achievement}${x.data.values.group ? "@" + x.data.values.group : ""}`);
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

  it("leaves references alone when the new name is empty or unchanged", () => {
    openTwo();
    expect(useApp.getState().renameAchievement(named("First").id, "First").updated).toBe(0);
    useApp.getState().renameAchievement(named("First").id, "");
    expect(refs()).toEqual(["First", "First@G", "First@Other", "Third"]);
  });
});
