import { decodeText, parseLoc, splitLocName, type LocFile } from "./localization";

/** One group as read from disk: its JSON, and the Localizations files that belong to it, keyed by locale. */
/** `modified`: when the JSON file was last written, to tell whether a recovered draft is newer. */
export type Bundle = { fileName: string; json: unknown; loc: Record<string, LocFile>; modified?: number };
/** A file to save. `dir` may be nested (`Icons/MyGroup`); give `data` for binary files such as icons, else `text`. */
export type OutFile = { name: string; text?: string; data?: Uint8Array; dir?: string };

/** Icons of the open group (HANDOVER 3.4). Paths are relative to AchievementsData, e.g. `Icons/MyGroup/Icon.dds`. */
export type IconAccess = {
  /** File names in `Icons/<group>/`. */
  list(group: string): Promise<string[]>;
  read(path: string): Promise<Uint8Array | undefined>;
};

export const groupIconPath = (group: string) => `Icons/${group}.dds`;
export const achievementIconPath = (group: string, file: string) => `Icons/${group}/${file}`;

/**
 * Where groups come from and go to. A folder workspace (Chromium, File System Access API) reads and writes
 * the AchievementsData folder in place; a files workspace (any browser) reads picked files and saves by download.
 */
export type Workspace = {
  kind: "folder" | "files";
  label: string;
  /** The folder handle of a folder workspace, so a draft can be restored with saving in place. */
  handle?: DirH;
  /** Absent when the workspace cannot see icon files (a few picked files). */
  icons?: IconAccess;
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

const parseJson = (bytes: ArrayBuffer) => JSON.parse(decodeText(bytes).replace(/^\uFEFF/, "")) as unknown;

/** Locale files whose name resolves to this group, exactly as the DLL matches them. */
function addLoc(loc: Record<string, LocFile>, group: string, fileName: string, text: string) {
  const parts = splitLocName(fileName);
  if (parts?.group === group) loc[parts.locale] = parseLoc(fileName, text);
}

// The subset of the File System Access API used here, so tests can supply an in-memory folder.
type Writable = { write(data: string | Uint8Array): Promise<void>; close(): Promise<void> };
export type FileH = { kind: "file"; getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; lastModified?: number }>; createWritable(): Promise<Writable> };
export type DirH = {
  kind: "directory";
  name: string;
  requestPermission?(opts: { mode: "readwrite" }): Promise<"granted" | "denied" | "prompt">;
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
  const walk = async (parts: string[], create = false) => {
    let d = dir;
    for (const p of parts) d = await d.getDirectoryHandle(p, { create });
    return d;
  };
  return {
    kind: "folder",
    label: dir.name,
    handle: dir,
    icons: {
      async list(group) {
        try {
          return (await files(await walk(["Icons", group]))).map(([n]) => n).filter((n) => /\.dds$/i.test(n)).sort((a, b) => a.localeCompare(b));
        } catch {
          return [];
        }
      },
      async read(path) {
        const parts = path.split("/");
        const name = parts.pop()!;
        try {
          return new Uint8Array(await (await (await (await walk(parts)).getFileHandle(name)).getFile()).arrayBuffer());
        } catch {
          return undefined;
        }
      },
    },
    async list() {
      return (await files(dir)).map(([n]) => n).filter((n) => /\.json$/i.test(n)).sort((a, b) => a.localeCompare(b));
    },
    async load(fileName) {
      const file = await (await dir.getFileHandle(fileName)).getFile();
      const json = parseJson(await file.arrayBuffer());
      const loc: Record<string, LocFile> = {};
      const sub = await dir.getDirectoryHandle("Localizations").catch(() => null);
      if (sub)
        for (const [name, h] of await files(sub)) addLoc(loc, groupId(fileName), name, decodeText(await (await h.getFile()).arrayBuffer()));
      return { fileName, json, loc, modified: file.lastModified };
    },
    async write(out) {
      for (const f of out) {
        const target = f.dir ? await walk(f.dir.split("/"), true) : dir;
        const w = await (await target.getFileHandle(f.name, { create: true })).createWritable();
        await w.write(f.data ?? f.text ?? "");
        await w.close();
      }
    },
  };
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = (d: Uint8Array) => (d.reduce((c, b) => CRC[(c ^ b) & 255] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

/** A ZIP of the files at their folder paths. Stored, not compressed: the files are small and this needs no library. */
export function zipFiles(files: OutFile[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let at = 0;
  for (const f of files) {
    const name = enc.encode(f.dir ? `${f.dir}/${f.name}` : f.name);
    const data = f.data ?? enc.encode(f.text ?? "");
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    // version 20, flag 0x800 (UTF-8 names), method 0 (stored), time/date 0, crc, sizes, name length
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x800, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2]].forEach(([o, v, n]) => (n === 4 ? head.setUint32(o, v, true) : head.setUint16(o, v, true)));
    const entry = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x800, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, at, 4]].forEach(([o, v, n]) => (n === 4 ? entry.setUint32(o, v, true) : entry.setUint16(o, v, true)));
    central.push(new Uint8Array(entry.buffer), name);
    parts.push(new Uint8Array(head.buffer), name, data);
    at += 30 + name.length + data.length;
  }
  const size = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, at, true);
  return concat([...parts, ...central, new Uint8Array(end.buffer)]);
}
const concat = (chunks: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) (out.set(c, o), (o += c.length));
  return out;
};

const save = (name: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
};

/** Where the mod reads its data, relative to the game's Data folder: the ZIP extracts straight over it. */
export const DATA_PATH = "SKSE/Plugins/AchievementsData";

/** Save by download: always one ZIP laid out as it sits in the Data folder (JSON, Localizations, Icons). */
export function downloadFiles(files: OutFile[]) {
  const rooted = files.map((f) => ({ ...f, dir: f.dir ? `${DATA_PATH}/${f.dir}` : DATA_PATH }));
  save(`${files[0].name.replace(/\.json$/i, "")}.zip`, new Blob([zipFiles(rooted) as BlobPart], { type: "application/zip" }));
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
      return { fileName, json: parseJson(await file.arrayBuffer()), loc, modified: file.lastModified };
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
  // Icon files by lower-cased path under the root, so lookups ignore case like Windows does.
  const iconFiles = new Map(inRoot.filter((r) => r.parts[depth]?.toLowerCase() === "icons" && /\.dds$/i.test(r.parts.at(-1)!)).map((r) => [r.parts.slice(depth).join("/").toLowerCase(), r.f]));
  return {
    kind: "files",
    label,
    icons: {
      list: async (group) => [...iconFiles].filter(([p]) => p.startsWith(`icons/${group.toLowerCase()}/`) && p.split("/").length === 3).map(([, f]) => f.name).sort((a, b) => a.localeCompare(b)),
      read: async (path) => {
        const f = iconFiles.get(path.toLowerCase());
        return f ? new Uint8Array(await f.arrayBuffer()) : undefined;
      },
    },
    list: async () => json.map((r) => r.parts[depth]).sort((a, b) => a.localeCompare(b)),
    async load(fileName) {
      const file = json.find((r) => r.parts[depth] === fileName)?.f;
      if (!file) throw new Error(`${fileName} is not in the selected folder.`);
      const loc: Record<string, LocFile> = {};
      for (const r of txt) addLoc(loc, groupId(fileName), r.parts[depth + 1], decodeText(await r.f.arrayBuffer()));
      return { fileName, json: parseJson(await file.arrayBuffer()), loc, modified: file.lastModified };
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
