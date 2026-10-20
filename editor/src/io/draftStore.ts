import type { Edge } from "@xyflow/react";
import type { AppNode } from "../graph";
import type { GroupValues } from "../store";
import type { LocFile } from "./localization";
import type { DirH } from "./workspace";

/**
 * Crash-recovery draft (HANDOVER 3.8): the open document, autosaved to IndexedDB while it has unsaved changes.
 * Never written to the mod folder. One draft per group file name; an unnamed document uses `UNSAVED`.
 */
export type Draft = {
  /** Store key: the group file name, or `UNSAVED`. */
  name: string;
  fileName: string | null;
  savedAt: number;
  nodes: Pick<AppNode, "id" | "type" | "position" | "data">[];
  edges: Edge[];
  group: GroupValues;
  groupExtra: Record<string, unknown>;
  loc: Record<string, LocFile>;
  /** What the language files looked like when last read or saved, so "unsaved" survives a restore. */
  locOriginal: Record<string, string>;
  savedKey: string;
  savedNames: string[];
  /** Icons chosen but not saved, so a restore does not lose them. */
  pendingIcons?: Record<string, Uint8Array>;
  /** The folder the group was open in (Chromium can keep the handle), so a restore can save in place again. */
  handle?: DirH;
};

export const UNSAVED = "(unsaved)";
export const draftName = (fileName: string | null) => fileName ?? UNSAVED;

const DB = "ae-editor";
const STORE = "drafts";
let db: Promise<IDBDatabase> | undefined;

const open = () =>
  (db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "name" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const t = (await open()).transaction(STORE, mode);
  const req = fn(t.objectStore(STORE));
  return new Promise<T>((resolve, reject) => {
    t.oncomplete = () => resolve(req.result);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

// IndexedDB can be missing or blocked (private windows, site data cleared). A draft is a convenience, so every call
// degrades to "no draft" instead of throwing, and the editor works the same without it.
const safe = async <T>(fallback: T, fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch {
    db = undefined;
    return fallback;
  }
};

export const putDraft = (d: Draft) => safe(false, async () => (await run("readwrite", (s) => s.put(d)), true));
export const getDraft = (name: string) => safe<Draft | undefined>(undefined, () => run("readonly", (s) => s.get(name)));
export const listDrafts = () => safe<Draft[]>([], () => run("readonly", (s) => s.getAll()));
export const deleteDraft = (name: string) => safe(undefined, async () => void (await run("readwrite", (s) => s.delete(name))));
