import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { isDirty, useApp } from "../store";
import { snapshotDraft, startAutosave } from "./autosave";
import { deleteDraft, getDraft, listDrafts, putDraft, UNSAVED, type Draft } from "./draftStore";
import { importGroup } from "./importGroup";
import { parseLoc } from "./localization";

const raw = {
  groupName: "G",
  plugin: "A.esp",
  achievements: [{ achievementName: "$NAME", description: "d", conditions: [{ type: "PlayerLevel", level: 5 }] }],
};
const open = () => useApp.getState().load(importGroup(raw), "G.json", { EN: parseLoc("G_EN.txt", "$NAME\tHello\r\n") }, null);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const edit = () => useApp.getState().setTranslation("EN", "NAME", "Edited");

beforeEach(async () => {
  for (const d of await listDrafts()) await deleteDraft(d.name);
  open();
});

describe("draft store", () => {
  it("puts, gets, lists and deletes drafts by name, replacing on the same name", async () => {
    const d = (name: string, savedAt: number): Draft => ({ ...snapshotDraft(), name, savedAt });
    await putDraft(d("A.json", 1));
    await putDraft(d("B.json", 2));
    await putDraft(d("A.json", 3));
    expect((await listDrafts()).map((x) => [x.name, x.savedAt]).sort()).toEqual([["A.json", 3], ["B.json", 2]]);
    expect((await getDraft("B.json"))?.savedAt).toBe(2);
    await deleteDraft("A.json");
    expect(await getDraft("A.json")).toBeUndefined();
  });

  it("a document without a file name uses its own slot", () => {
    useApp.getState().load({ nodes: [], edges: [], group: {}, groupExtra: {} }, null, {}, null);
    expect(snapshotDraft().name).toBe(UNSAVED);
  });
});

describe("autosave", () => {
  it("keeps a draft while there are unsaved changes, and drops it once saved", async () => {
    const stop = startAutosave(10);
    edit();
    await wait(60);
    const d = await getDraft("G.json");
    expect(d?.fileName).toBe("G.json");
    expect(d?.nodes.length).toBe(4);

    useApp.getState().markSaved("G.json");
    await wait(60);
    expect(await getDraft("G.json")).toBeUndefined();
    stop();
  });

  it("drops the draft when the edits are undone back to the saved state", async () => {
    const stop = startAutosave(10);
    edit();
    await wait(60);
    expect(await getDraft("G.json")).toBeDefined();
    useApp.temporal.getState().undo();
    await wait(60);
    expect(isDirty()).toBe(false);
    expect(await getDraft("G.json")).toBeUndefined();
    stop();
  });

  it("writes nothing for an untouched document", async () => {
    const stop = startAutosave(10);
    useApp.getState().setView("json");
    await wait(60);
    expect(await listDrafts()).toEqual([]);
    stop();
  });
});

describe("restoring after a crash", () => {
  it("brings back the edits, still unsaved, with the language files and a clean undo history", async () => {
    edit();
    useApp.getState().addLanguage("PO");
    await putDraft(snapshotDraft());

    // "Crash": the editor starts again with nothing open.
    useApp.getState().load({ nodes: [], edges: [], group: {}, groupExtra: {} }, null, {}, null);
    expect(isDirty()).toBe(false);

    const [d] = await listDrafts();
    useApp.getState().restore(d, null);
    const s = useApp.getState();
    expect(s.fileName).toBe("G.json");
    expect(s.nodes).toHaveLength(4);
    expect(s.loc.EN.lines[0].value).toBe("Edited");
    expect(s.loc.PO.fileName).toBe("G_PO.txt");
    expect(isDirty()).toBe(true); // still differs from what is on disk
    expect(useApp.temporal.getState().pastStates).toHaveLength(0);
  });

  it("saving after a restore writes the recovered language text, not the old file", async () => {
    edit();
    await putDraft(snapshotDraft());
    useApp.getState().load(importGroup(raw), "G.json", { EN: parseLoc("G_EN.txt", "$NAME\tHello\r\n") }, null);
    useApp.getState().restore((await listDrafts())[0], null);
    const { changedLocFiles } = await import("./localization");
    const files = changedLocFiles(useApp.getState().loc, useApp.getState().locOriginal);
    expect(files.map((f) => [f.name, f.text])).toEqual([["G_EN.txt", "$NAME\tEdited\r\n"]]);
  });
});

describe("a fresh editor", () => {
  it("has nothing unsaved, so no tab-close warning and no draft", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    const fresh = await import("../store");
    expect(fresh.isDirty()).toBe(false);
  });
});
