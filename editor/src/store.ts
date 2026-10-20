import {
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
} from "@xyflow/react";
import { create } from "zustand";
import { temporal } from "zundo";
import { type AppNode, refuseReason } from "./graph";
import type { Snapshot } from "./io/importGroup";
import { newLocFile, renameKey, serializeLoc, setText, type LocFile } from "./io/localization";
import { groupId, type Workspace } from "./io/workspace";
import { registry } from "./registry";

export type View = "graph" | "group" | "localization" | "json";

/** Group-level fields (HANDOVER 3.4). Unset = not serialized. */
export type GroupValues = { groupName?: string; plugin?: string; showInMenu?: boolean };

type State = {
  nodes: AppNode[];
  edges: Edge[];
  group: GroupValues;
  /** Unknown root keys, preserved for a lossless save. */
  groupExtra: Record<string, unknown>;
  /** Translations per locale (`EN`, `FR`...), one file each (HANDOVER 3.13). */
  loc: Record<string, LocFile>;
  /** Serialized text of each locale file as last read or saved; a file is written only when it differs. Not in undo history. */
  locOriginal: Record<string, string>;
  workspace: Workspace | null;
  /** `docKey` of the document as last opened or saved; differs from the current key when there are unsaved changes. */
  savedKey: string;
  /** Name of the file the document came from; the group identifier on disk, so reused for saving. */
  fileName: string | null;
  view: View;
  onNodesChange: (c: NodeChange<AppNode>[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  isValid: (c: Connection | Edge) => boolean;
  addNode: (kind: string, position: XYPosition) => void;
  /** `undefined` removes the key: unset is not serialized. */
  setValue: (id: string, name: string, value: unknown) => void;
  setGroup: (patch: Partial<GroupValues>) => void;
  setView: (v: View) => void;
  /** Replace the whole document (open/new). Clears undo history. */
  load: (s: Snapshot, fileName: string | null, loc?: Record<string, LocFile>, workspace?: Workspace | null) => void;
  setTranslation: (locale: string, key: string, value: string) => void;
  /** Adds an empty language; it is saved once it has a translation. */
  addLanguage: (locale: string) => void;
  /** Drops a language that has no translations yet; one with translations stays (its file is not ours to delete). */
  removeLanguage: (locale: string) => void;
  /** Mark the current locale files as saved. */
  markSaved: (fileName: string) => void;
};

// History tracks the document only: selection, dragging and measured sizes are transient (HANDOVER 3.11).
const doc = (s: Pick<State, "nodes" | "edges" | "group" | "groupExtra" | "loc">) => ({
  nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
  edges: s.edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
  group: s.group,
  groupExtra: s.groupExtra,
  loc: s.loc,
});

type Doc = Pick<State, "nodes" | "edges" | "group" | "groupExtra" | "loc">;
export const docKey = (s: Doc) => JSON.stringify(doc(s));
export const isDirty = () => {
  const s = useApp.getState();
  return docKey(s) !== s.savedKey;
};

export const useApp = create<State>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      group: {},
      groupExtra: {},
      loc: {},
      locOriginal: {},
      workspace: null,
      savedKey: "",
      fileName: null,
      view: "graph",
      onNodesChange: (c) => set({ nodes: applyNodeChanges(c, get().nodes) }),
      onEdgesChange: (c) => set({ edges: applyEdgeChanges(c, get().edges) }),
      onConnect: (c) => {
        const { nodes, edges } = get();
        if (!refuseReason(nodes, edges, c as never)) set({ edges: addEdge({ ...c, type: "default" }, edges) });
      },
      isValid: (c) => !refuseReason(get().nodes, get().edges, c as never),
      addNode: (kind, position) => {
        if (!registry[kind]) return;
        set({ nodes: [...get().nodes, { id: crypto.randomUUID(), type: "ae", position, data: { kind, values: {} } }] });
      },
      setValue: (id, name, value) => {
        const node = get().nodes.find((n) => n.id === id);
        // Translations follow a LocalizedText node when its key is edited (the key is the identity, 3.13).
        const old = node?.data.kind === "LocalizedText" && name === "key" ? node.data.values.key : undefined;
        const renamed = typeof old === "string" && typeof value === "string";
        // One set, so one undo step covers both the node and its translations.
        set({
          ...(renamed && { loc: Object.fromEntries(Object.entries(get().loc).map(([l, f]) => [l, renameKey(f, old, value)])) }),
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n;
            const { [name]: _, ...rest } = n.data.values;
            return { ...n, data: { ...n.data, values: value === undefined ? rest : { ...rest, [name]: value } } };
          }),
        });
      },
      setGroup: (patch) => {
        const next = { ...get().group, ...patch };
        for (const k of Object.keys(next) as (keyof GroupValues)[]) if (next[k] === undefined) delete next[k];
        set({ group: next });
      },
      setView: (view) => set({ view }),
      load: (snap, fileName, loc = {}, workspace = get().workspace) => {
        set({
          ...snap,
          fileName,
          loc,
          locOriginal: Object.fromEntries(Object.entries(loc).map(([l, f]) => [l, serializeLoc(f)])),
          workspace,
          view: "graph",
        });
        set({ savedKey: docKey(get()) });
        useApp.temporal.getState().clear();
      },
      setTranslation: (locale, key, value) => {
        const f = get().loc[locale];
        if (f) set({ loc: { ...get().loc, [locale]: setText(f, key, value) } });
      },
      addLanguage: (locale) => {
        const { loc, fileName } = get();
        const l = locale.toUpperCase();
        if (loc[l] || !fileName) return;
        set({ loc: { ...loc, [l]: newLocFile(`${groupId(fileName)}_${l}.txt`) } });
      },
      removeLanguage: (locale) => {
        const { loc } = get();
        if (loc[locale]?.lines.length !== 0) return;
        const { [locale]: _, ...rest } = loc;
        set({ loc: rest });
      },
      markSaved: (fileName) => {
        set({ fileName, locOriginal: Object.fromEntries(Object.entries(get().loc).map(([l, f]) => [l, serializeLoc(f)])) });
        set({ savedKey: docKey(get()) });
      },
    }),
    {
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges, group: s.group, groupExtra: s.groupExtra, loc: s.loc }),
      equality: (a, b) => JSON.stringify(doc(a as State)) === JSON.stringify(doc(b as State)),
    },
  ),
);

/** One undo entry per node drag: pause on start, record the pre-drag state on drop. */
let dragStart: ReturnType<typeof doc> | null = null;
export function beginDrag() {
  const s = useApp.getState();
  dragStart = doc(s);
  useApp.temporal.getState().pause();
}
export function endDrag() {
  const t = useApp.temporal.getState();
  t.resume();
  const now = doc(useApp.getState());
  if (dragStart && JSON.stringify(dragStart) !== JSON.stringify(now)) {
    const before = useApp.getState();
    // Past entries hold the partialized state: current nodes moved back to their pre-drag positions.
    const start = new Map(dragStart.nodes.map((n) => [n.id, n.position]));
    const snapshot = {
      nodes: before.nodes.map((n) => ({ ...n, position: start.get(n.id) ?? n.position })),
      edges: before.edges,
      group: before.group,
      groupExtra: before.groupExtra,
      loc: before.loc,
    };
    useApp.temporal.setState({ pastStates: [...t.pastStates, snapshot], futureStates: [] });
  }
  dragStart = null;
}
