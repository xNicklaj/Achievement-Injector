import { decodeText, parseLoc, splitLocName, type LocFile } from "./localization";

/** One group as read from disk: its JSON, and the Localizations files that belong to it, keyed by locale. */
export type Bundle = { fileName: string; json: unknown; loc: Record<string, LocFile> };
export type OutFile = { name: string; text: string; dir?: "Localizations" };

/**
 * Where groups come from and go to. A folder workspace (Chromium, File System Access API) reads and writes
 * the AchievementsData folder in place; a files workspace (any browser) reads picked files and saves by download.
 */
export type Workspace = {
  kind: "folder" | "files";
  label: string;
  list(): Promise<string[]>;
  load(fileName: string): Promise<Bundle>;
  write(files: OutFile[]): Promise<void>;
};

export const groupId = (fileName: string) => fileName.replace(/\.json$/i, "");

/** Valid as a file name on Windows, and as the group identifier used in the console command and icon folder. */
export function groupNameError(name: string, existing: readonly string[] = []): string | null {
  if (!name.trim()) return "Enter a name";
  if (name !== name.trim() || /[. ]$/.test(name)) return "No leading or trailing spaces, and no trailing dot";
  if (/[\\/:*?"<>|\x00-\x1f]/.test(name)) return 'Cannot contain \\ / : * ? " < > |';
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) return "Reserved file name";
  if (existing.some((e) => groupId(e).toLowerCase() === name.toLowerCase())) return "A group with this name already exists";
  return null;
}

const parseJson = (bytes: ArrayBuffer) => JSON.parse(decodeText(bytes).replace(/^﻿/, "")) as unknown;

/** Locale files whose name resolves to this group, exactly as the DLL matches them. */
function addLoc(loc: Record<string, LocFile>, group: string, fileName: string, text: string) {
  const parts = splitLocName(fileName);
  if (parts?.group === group) loc[parts.locale] = parseLoc(fileName, text);
}

// The subset of the File System Access API used here, so tests can supply an in-memory folder.
type Writable = { write(data: string): Promise<void>; close(): Promise<void> };
export type FileH = { kind: "file"; getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>; createWritable(): Promise<Writable> };
export type DirH = {
  kind: "directory";
  name: string;
  entries(): AsyncIterable<[string, FileH | DirH]>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileH>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirH>;
};

export function folderWorkspace(dir: DirH): Workspace {
  const files = async (d: DirH) => {
    const out: [string, FileH][] = [];
    for await (const [name, h] of d.entries()) if (h.kind === "file") out.push([name, h]);
    return out;
  };
  return {
    kind: "folder",
    label: dir.name,
    async list() {
      return (await files(dir)).map(([n]) => n).filter((n) => /\.json$/i.test(n)).sort((a, b) => a.localeCompare(b));
    },
    async load(fileName) {
      const json = parseJson(await (await (await dir.getFileHandle(fileName)).getFile()).arrayBuffer());
      const loc: Record<string, LocFile> = {};
      const sub = await dir.getDirectoryHandle("Localizations").catch(() => null);
      if (sub)
        for (const [name, h] of await files(sub)) addLoc(loc, groupId(fileName), name, decodeText(await (await h.getFile()).arrayBuffer()));
      return { fileName, json, loc };
    },
    async write(out) {
      for (const f of out) {
        const target = f.dir ? await dir.getDirectoryHandle(f.dir, { create: true }) : dir;
        const w = await (await target.getFileHandle(f.name, { create: true })).createWritable();
        await w.write(f.text);
        await w.close();
      }
    },
  };
}

/** Save by download. Browsers may ask before allowing several downloads at once. */
export function downloadFiles(files: OutFile[]) {
  for (const f of files) {
    const url = URL.createObjectURL(new Blob([f.text], { type: "text/plain;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: f.name }).click();
    URL.revokeObjectURL(url);
  }
}

/** Any browser: the user picks a group's JSON and, optionally, its `<Group>_<LANG>.txt` files. */
export function filesWorkspace(picked: File[]): Workspace {
  const json = picked.filter((f) => /\.json$/i.test(f.name));
  return {
    kind: "files",
    label: "Selected files",
    list: async () => json.map((f) => f.name),
    async load(fileName) {
      const file = json.find((f) => f.name === fileName);
      if (!file) throw new Error(`${fileName} was not selected.`);
      const loc: Record<string, LocFile> = {};
      for (const f of picked) if (/\.txt$/i.test(f.name)) addLoc(loc, groupId(fileName), f.name, decodeText(await f.arrayBuffer()));
      return { fileName, json: parseJson(await file.arrayBuffer()), loc };
    },
    write: async (out) => downloadFiles(out),
  };
}

/**
 * Any browser: the user picks the AchievementsData folder through a directory `<input>` (Firefox has no
 * File System Access API). Read-only: saving downloads files. Also accepts a parent folder that contains AchievementsData.
 */
export function pickedFolderWorkspace(picked: File[]): Workspace {
  const rel = picked.map((f) => ({ f, parts: f.webkitRelativePath.split("/") }));
  const at = rel.find((r) => r.parts.includes("AchievementsData"))?.parts.indexOf("AchievementsData");
  const depth = (at ?? 0) + 1; // number of leading path segments that name the root
  const inRoot = rel.filter((r) => at === undefined || r.parts[at] === "AchievementsData");
  const label = (rel[0]?.parts[at ?? 0] ?? "Selected folder");
  const json = inRoot.filter((r) => r.parts.length === depth + 1 && /\.json$/i.test(r.parts[depth]));
  const txt = inRoot.filter((r) => r.parts.length === depth + 2 && r.parts[depth].toLowerCase() === "localizations" && /\.txt$/i.test(r.parts[depth + 1]));
  return {
    kind: "files",
    label,
    list: async () => json.map((r) => r.parts[depth]).sort((a, b) => a.localeCompare(b)),
    async load(fileName) {
      const file = json.find((r) => r.parts[depth] === fileName)?.f;
      if (!file) throw new Error(`${fileName} is not in the selected folder.`);
      const loc: Record<string, LocFile> = {};
      for (const r of txt) addLoc(loc, groupId(fileName), r.parts[depth + 1], decodeText(await r.f.arrayBuffer()));
      return { fileName, json: parseJson(await file.arrayBuffer()), loc };
    },
    write: async (out) => downloadFiles(out),
  };
}

export const downloadWorkspace: Workspace = {
  kind: "files",
  label: "Downloads",
  list: async () => [],
  load: async () => {
    throw new Error("Nothing to load.");
  },
  write: async (out) => downloadFiles(out),
};
