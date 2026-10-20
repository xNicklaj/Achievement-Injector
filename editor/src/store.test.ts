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
