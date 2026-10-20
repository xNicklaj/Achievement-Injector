import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadIcon } from "../components/icons";
import { isDirty, useApp } from "../store";
import { computeValidation, parseNodeStatus } from "../validation";
import { snapshotDraft } from "./autosave";
import { saveFile } from "./fileActions";
import { importGroup } from "./importGroup";
import type { OutFile, Workspace } from "./workspace";

const icons = join(__dirname, "../../../Skyrim/Data/SKSE/Plugins/AchievementsData/Icons");
const real = new Uint8Array(readFileSync(join(icons, "Dragonborn", "ACH_DragonAspect.dds")));

const raw = (icon?: string) => ({ groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d", ...(icon ? { icon } : {}) }] });

/** A folder workspace with a few icons on "disk"; `written` records what Save wrote. */
function fakeWorkspace(onDisk: Record<string, Uint8Array>) {
  const written: OutFile[] = [];
  const ws: Workspace = {
    kind: "folder",
    label: "AchievementsData",
    icons: {
      list: async (g) => Object.keys(onDisk).filter((p) => p.startsWith(`Icons/${g}/`)).map((p) => p.split("/").pop()!),
      read: async (p) => onDisk[p],
    },
    list: async () => ["G.json"],
    load: async () => {
      throw new Error("unused");
    },
    write: async (files) => void written.push(...files),
  };
  return { ws, written };
}
const open = (ws: Workspace | null, icon?: string) => useApp.getState().load(importGroup(raw(icon)), "G.json", {}, ws);
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => vi.restoreAllMocks());

describe("icon files in the store", () => {
  it("lists the group's icons from the workspace after opening", async () => {
    open(fakeWorkspace({ "Icons/G/A.dds": real, "Icons/G/B.dds": real, "Icons/Other/Z.dds": real }).ws);
    await tick();
    expect(useApp.getState().iconFiles).toEqual(["A.dds", "B.dds"]);
  });
  it("is null (unknown) for a workspace that cannot see icons, or none", async () => {
    open(null);
    await tick();
    expect(useApp.getState().iconFiles).toBeNull();
  });
  it("an added icon makes the document unsaved, and saving writes it and clears the queue", async () => {
    const { ws, written } = fakeWorkspace({ "Icons/G/A.dds": real });
    open(ws);
    await tick();
    expect(isDirty()).toBe(false);

    useApp.getState().addPendingIcon("Icons/G/New.dds", real);
    useApp.getState().addPendingIcon("Icons/G.dds", real);
    expect(isDirty()).toBe(true);

    await saveFile();
    const icons = written.filter((f) => f.data);
    expect(icons.map((f) => [f.dir, f.name]).sort()).toEqual([["Icons", "G.dds"], ["Icons/G", "New.dds"]]);
    expect(icons[0].data).toBe(real);
    expect(useApp.getState().pendingIcons).toEqual({});
    expect(isDirty()).toBe(false);
  });
  it("a draft keeps queued icons", () => {
    open(null);
    useApp.getState().addPendingIcon("Icons/G/New.dds", real);
    const d = snapshotDraft();
    open(null);
    useApp.getState().restore(d, null);
    expect(Object.keys(useApp.getState().pendingIcons)).toEqual(["Icons/G/New.dds"]);
  });
});

describe("icon preview", () => {
  it("decodes a shipped icon to the requested size, from disk or from the queue", async () => {
    open(fakeWorkspace({ "Icons/G/A.dds": real }).ws);
    const r = await loadIcon("Icons/G/A.dds", 64);
    expect(r).toMatchObject({ status: "ready", info: { width: 512, height: 512, format: "BC3", problems: [] } });
    if (r.status === "ready") expect(r.image.data).toHaveLength(64 * 64 * 4);

    useApp.getState().addPendingIcon("Icons/G/Queued.dds", real);
    expect((await loadIcon("Icons/G/Queued.dds", 32)).status).toBe("ready");
  });
  it("says missing for a file that is not there, error for one that is not DDS, and keeps format problems", async () => {
    open(fakeWorkspace({ "Icons/G/Bad.dds": new Uint8Array(300) }).ws);
    expect((await loadIcon("Icons/G/none.dds", 32)).status).toBe("missing");
    expect(await loadIcon("Icons/G/Bad.dds", 32)).toMatchObject({ status: "error", message: "Not a DDS file." });
  });
});

describe("icon validation", () => {
  const check = (icon: string, iconFiles: string[] | null, pendingIcons: Record<string, unknown> = {}) => {
    const snap = importGroup(raw(icon));
    return computeValidation({ ...snap, loc: {}, fileName: "G.json", iconFiles, pendingIcons });
  };
  const node = (v: ReturnType<typeof check>) => Object.keys(v.byNode)[0];

  it("warns, on the Icon node's file field, when the file is not in the group's icon folder", () => {
    const v = check("Gone.dds", ["A.dds"]);
    expect(parseNodeStatus(v.byNode[node(v)])).toEqual({ level: "warning", messages: ['file: "Gone.dds" is not in Icons/G/'] });
  });
  it("accepts an icon that exists, ignoring case, or one queued to be saved", () => {
    expect(check("a.DDS", ["A.dds"]).issues).toEqual([]);
    expect(check("New.dds", [], { "Icons/G/New.dds": new Uint8Array() }).issues).toEqual([]);
  });
  it("checks nothing when the folder cannot be listed", () => {
    expect(check("Anything.dds", null).issues).toEqual([]);
  });
});

describe("download saves", () => {
  it("are the complete package: unchanged icons and translations too", async () => {
    const { ws, written } = fakeWorkspace({ "Icons/G/A.dds": real, "Icons/G.dds": real });
    const files: Workspace = { ...ws, kind: "files", write: ws.write };
    open(files);
    await tick();
    await saveFile();
    expect(written.filter((f) => f.data).map((f) => [f.dir, f.name]).sort()).toEqual([["Icons", "G.dds"], ["Icons/G", "A.dds"]]);
  });
});
