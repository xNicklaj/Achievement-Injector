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
import { createHistory } from "@xnicklaj/knotwork";
import { followMoves, membersOf, restack, type Collapsed } from "./achievements";
import { type AppNode, isInternalGroup, refuseReason, restoreInline } from "./graph";
import type { Draft } from "./io/draftStore";
import { mkEdge, type Snapshot } from "./io/importGroup";
import type { SpawnFrom } from "./spawn";
import { newLocFile, renameKey, serializeLoc, setText, type LocFile } from "./io/localization";
import { groupId, type Workspace } from "./io/workspace";
import { linkKind, registry, UNKNOWN_CONDITION } from "./registry";
import { remembered } from "./viewport";

export type View = "graph" | "group" | "localization" | "plugins" | "json";

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
  /** File names in `Icons/<group>/` as the workspace sees them; null when it cannot see icons. Not in undo history. */
  iconFiles: string[] | null;
  /** Icons chosen but not saved yet, by path under AchievementsData (`Icons/<group>/<file>.dds`). Written on Save. */
  pendingIcons: Record<string, Uint8Array>;
  /** Bumped whenever icon files change, so previews reload. */
  iconVersion: number;
  /** Achievement names as last opened or saved: renaming one of these breaks saved progress, so it warns. Not in undo history. */
  savedNames: string[];
  /** `docKey` of the document as last opened or saved; differs from the current key when there are unsaved changes. */
  savedKey: string;
  /** Name of the file the document came from; the group identifier on disk, so reused for saving. */
  fileName: string | null;
  view: View;
  /** Achievements shown as one node (their Create Achievement ids). Not in the file, the undo history or the unsaved-changes check. */
  collapsed: Collapsed;
  /** Collapse an achievement into its Create Achievement node, or expand it again. Nodes it hides are deselected, so Delete cannot reach them. */
  toggleCollapsed: (id: string) => void;
  /**
   * Put the achievements in a new order, given as every Create Achievement id: the order of the file, and the order down the canvas
   * (each achievement, with the shared nodes only it uses, is moved to follow the one before it). One undo step. Ignored unless
   * `order` names each achievement once.
   */
  reorderAchievements: (order: string[]) => void;
  onNodesChange: (c: NodeChange<AppNode>[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  isValid: (c: Connection | Edge) => boolean;
  addNode: (kind: string, position: XYPosition) => void;
  /** Create a node and, when it was made from a dragged wire, connect that wire to `wire.pin`: one update, one undo step. */
  addNodeConnected: (kind: string, position: XYPosition, wire?: { from: SpawnFrom; pin: string }) => void;
  /**
   * Change conditions into another type, in place: same position, one undo step for all of them. Values that are fields of the new
   * type carry over and the rest of a known condition's values go; an unknown condition's keys are never dropped (the ones that
   * fit become values, the others stay as unknown keys). Wires the new type cannot hold (what a Conditions Met collects, links to
   * fields it does not have) are removed. Anything in `ids` that is not a condition, or already has that type, is left alone.
   */
  replaceConditions: (ids: string[], kind: string) => void;
  /** `undefined` removes the key: unset is not serialized. */
  setValue: (id: string, name: string, value: unknown) => void;
  setGroup: (patch: Partial<GroupValues>) => void;
  setView: (v: View) => void;
  /** Replace the whole document (open/new). Clears undo history. */
  load: (s: Snapshot, fileName: string | null, loc?: Record<string, LocFile>, workspace?: Workspace | null) => void;
  /**
   * Rename an achievement and update `AchievementUnlocked` references to it in this group (HANDOVER 3.1), in one undo step.
   * Returns the old name and how many references were updated; `existed` says the old name was in the last opened or saved file.
   */
  renameAchievement: (id: string, name: string) => { old?: string; updated: number; existed: boolean };
  /** Re-read which icons exist for the open group. */
  refreshIcons: () => Promise<void>;
  /** Queue an icon file to be written on Save. */
  addPendingIcon: (path: string, bytes: Uint8Array) => void;
  /** Put a recovered draft back, still unsaved. Clears undo history. */
  restore: (d: Draft, workspace: Workspace | null) => void;
  setTranslation: (locale: string, key: string, value: string) => void;
  /** Adds an empty language; it is saved once it has a translation. */
  addLanguage: (locale: string) => void;
  /** Drops a language that has no translations yet; one with translations stays (its file is not ours to delete). */
  removeLanguage: (locale: string) => void;
  /** Mark the current locale files as saved. */
  markSaved: (fileName: string) => void;
};

// History tracks the document only: selection, dragging and measured sizes are transient (HANDOVER 3.11).
const doc = (s: Pick<State, "nodes" | "edges" | "group" | "groupExtra" | "loc"> & Partial<Pick<State, "pendingIcons">>) => ({
  nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
  edges: s.edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
  group: s.group,
  groupExtra: s.groupExtra,
  loc: s.loc,
  // Only which icons are waiting counts as a change; their bytes are too big to compare on every edit.
  pendingIcons: Object.keys(s.pendingIcons ?? {}).sort(),
});

/** Names of the achievements as plain text; a localized name has no inline value. */
const plainNames = (nodes: AppNode[]) => nodes.flatMap((n) => (n.data.kind === "CreateAchievement" && typeof n.data.values.achievementName === "string" ? [n.data.values.achievementName] : []));

type Doc = Pick<State, "nodes" | "edges" | "group" | "groupExtra" | "loc" | "pendingIcons">;
export const docKey = (s: Doc) => JSON.stringify(doc(s));
export const isDirty = () => {
  const s = useApp.getState();
  return docKey(s) !== s.savedKey;
};

type Snap = Pick<State, "nodes" | "edges" | "group" | "groupExtra" | "loc">;
const history = createHistory<State, Snap>({
  partialize: (s) => ({ nodes: s.nodes, edges: s.edges, group: s.group, groupExtra: s.groupExtra, loc: s.loc }),
  key: (p) => JSON.stringify(doc(p)),
  slices: (s) => [s.nodes, s.loc],
});

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
      iconFiles: null,
      pendingIcons: {},
      iconVersion: 0,
      savedKey: "",
      savedNames: [],
      fileName: null,
      view: "graph",
      collapsed: {},
      toggleCollapsed: (id) => {
        const { collapsed, nodes, edges } = get();
        if (collapsed[id]) return set({ collapsed: Object.fromEntries(Object.entries(collapsed).filter(([k]) => k !== id)) });
        const inside = new Set(membersOf(nodes, edges, id));
        inside.delete(id);
        set({ collapsed: { ...collapsed, [id]: true }, nodes: nodes.some((n) => n.selected && inside.has(n.id)) ? nodes.map((n) => (n.selected && inside.has(n.id) ? { ...n, selected: false } : n)) : nodes });
      },
      reorderAchievements: (order) => {
        const { nodes, edges } = get();
        const creates = new Map(nodes.filter((n) => n.data.kind === "CreateAchievement").map((n) => [n.id, n]));
        if (order.length !== creates.size || new Set(order).size !== order.length || !order.every((id) => creates.has(id))) return;
        if (order.every((id, i) => id === [...creates.keys()][i])) return;
        const moved = restack(nodes, edges, order);
        // The file lists achievements in the order of these nodes: they take each other's places in the array, the rest stay put.
        let next = 0;
        set({ nodes: nodes.map((n) => { const m = n.data.kind === "CreateAchievement" ? creates.get(order[next++])! : n; const to = moved.get(m.id); return to ? { ...m, position: to } : m; }) });
      },
      onNodesChange: (changes) => {
        const { nodes, edges, loc, collapsed } = get();
        // A collapsed achievement drags what it hides along with it.
        const c = followMoves(changes, nodes, edges, collapsed);
        const removed = new Set(c.flatMap((x) => (x.type === "remove" ? [x.id] : [])));
        if (!removed.size) return set({ nodes: applyNodeChanges(c, nodes) });
        // Wires of a deleted node go with it in this same update, and the fields they fed keep their text.
        const gone = edges.filter((e) => removed.has(e.source) || removed.has(e.target));
        set({ nodes: applyNodeChanges(c, restoreInline(nodes, gone, loc, edges)), edges: edges.filter((e) => !gone.includes(e)) });
      },
      onEdgesChange: (c) => {
        const { nodes, edges, loc } = get();
        const ids = new Set(c.flatMap((x) => (x.type === "remove" ? [x.id] : [])));
        set({ edges: applyEdgeChanges(c, edges), nodes: ids.size ? restoreInline(nodes, edges.filter((e) => ids.has(e.id)), loc, edges) : nodes });
      },
      onConnect: (c) => {
        const { nodes, edges } = get();
        if (!refuseReason(nodes, edges, c as never)) set({ edges: addEdge({ ...c, type: "default" }, edges) });
      },
      isValid: (c) => !refuseReason(get().nodes, get().edges, c as never),
      addNode: (kind, position) => {
        if (!registry[kind]) return;
        set({ nodes: [...get().nodes, { id: crypto.randomUUID(), type: "ae", position, data: { kind, values: {} } }] });
      },
      addNodeConnected: (kind, position, wire) => {
        if (!registry[kind]) return;
        const id = crypto.randomUUID();
        const node: AppNode = { id, type: "ae", position, data: { kind, values: {} } };
        const { nodes, edges } = get();
        let next = edges;
        if (wire) {
          const { from, pin } = wire;
          const l =
            from.handleType === "source"
              ? { source: from.nodeId, sourceHandle: from.handleId, target: id, targetHandle: pin }
              : { source: id, sourceHandle: pin, target: from.nodeId, targetHandle: from.handleId };
          if (!refuseReason([...nodes, node], edges, l)) next = [...edges, mkEdge(l.source, l.sourceHandle, l.target, l.targetHandle)];
        }
        set({ nodes: [...nodes, node], edges: next });
      },
      setValue: (id, name, value) => {
        const node = get().nodes.find((n) => n.id === id);
        // Translations follow a LocalizedText node when its key is edited (the key is the identity, 3.13).
        const old = node?.data.kind === "LocalizedText" && name === "key" ? node.data.values.key : undefined;
        const renamed = typeof old === "string" && typeof value === "string";
        // One set, so one undo step covers both the node and its translations.
        history.edit(`${id}:${name}`, value, get, () =>
          set({
            ...(renamed && { loc: Object.fromEntries(Object.entries(get().loc).map(([l, f]) => [l, renameKey(f, old, value)])) }),
            nodes: get().nodes.map((n) => {
              if (n.id !== id) return n;
              const { [name]: _, ...rest } = n.data.values;
              return { ...n, data: { ...n.data, values: value === undefined ? rest : { ...rest, [name]: value } } };
            }),
          }),
        );
      },
      replaceConditions: (ids, kind) => {
        const def = registry[kind];
        if (def?.category !== "condition" || def.hidden) return;
        const { nodes, edges } = get();
        const swap = new Set(nodes.filter((n) => ids.includes(n.id) && registry[n.data.kind]?.category === "condition" && n.data.kind !== kind).map((n) => n.id));
        if (!swap.size) return;
        const fields = new Set(def.fields.map((f) => f.name));
        const holds = (handle: string | null | undefined, side: "source" | "target") => {
          if (side === "source") return handle === "flow-out" || handle === "cond-out";
          if (handle === "cond-in") return def.condIn;
          const at = handle?.indexOf(":") ?? -1;
          return at > 0 && def.fields.some((f) => f.name === handle!.slice(at + 1) && linkKind(def, f) === handle!.slice(0, at));
        };
        // Untouched when no wire goes, so what is indexed by the wire list stays valid.
        const kept = edges.filter((e) => !(swap.has(e.target) && !holds(e.targetHandle, "target")) && !(swap.has(e.source) && !holds(e.sourceHandle, "source")));
        set({
          edges: kept.length === edges.length ? edges : kept,
          nodes: nodes.map((old) => {
            if (!swap.has(old.id)) return old;
            const values: Record<string, unknown> = {};
            let extra = old.data.extra;
            if (old.data.kind === UNKNOWN_CONDITION) {
              const { type: _type, ...rest } = old.data.extra ?? {};
              const other: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(rest)) (fields.has(k) ? values : other)[k] = v;
              extra = Object.keys(other).length ? other : undefined;
            } else for (const [k, v] of Object.entries(old.data.values)) if (fields.has(k)) values[k] = v;
            // Without `measured` the node is measured again, so its pins are found where the new type puts them.
            const { measured: _measured, ...node } = old;
            return { ...node, data: { kind, values, ...(extra && { extra }) } };
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
          iconFiles: null,
          pendingIcons: {},
          iconVersion: get().iconVersion + 1,
          view: "graph",
          collapsed: {},
        });
        set({ savedKey: docKey(get()), savedNames: plainNames(get().nodes) });
        void get().refreshIcons();
        history.reset(useApp);
        remembered.viewport = null;
      },
      renameAchievement: (id, name) => {
        const { nodes, edges, fileName, savedNames } = get();
        const raw = nodes.find((n) => n.id === id)?.data.values.achievementName;
        // An unset name (a new node, or a field whose Localized Text wire was removed) is "", so typing a first name works.
        const old = typeof raw === "string" ? raw : undefined;
        if ((old ?? "") === name) return { old, updated: 0, existed: false };
        let updated = 0;
        set({
          nodes: nodes.map((n) => {
            const v = n.data.values;
            if (n.id === id) {
              const { achievementName: _, ...rest } = v;
              return { ...n, data: { ...n.data, values: name ? { ...rest, achievementName: name } : rest } };
            }
            // References to the old name follow it, but never ones that point into another group.
            if (name && old && n.data.kind === "AchievementUnlocked" && v.achievement === old && isInternalGroup(v.group, fileName)) {
              updated++;
              return { ...n, data: { ...n.data, values: { ...v, achievement: name } } };
            }
            return n;
          }),
        });
        // Wires follow the achievement by themselves; they count as updated references too.
        if (old) updated += edges.filter((e) => e.source === id && e.sourceHandle === "ach-out").length;
        return { old, updated, existed: !!old && savedNames.includes(old) };
      },
      restore: (d, workspace) => {
        set({
          nodes: d.nodes as AppNode[],
          edges: d.edges,
          group: d.group,
          groupExtra: d.groupExtra,
          loc: d.loc,
          locOriginal: d.locOriginal,
          savedKey: d.savedKey,
          savedNames: d.savedNames ?? [],
          pendingIcons: d.pendingIcons ?? {},
          iconFiles: null,
          iconVersion: get().iconVersion + 1,
          fileName: d.fileName,
          workspace,
          view: "graph",
          collapsed: {},
        });
        void get().refreshIcons();
        history.reset(useApp);
        remembered.viewport = null;
      },
      setTranslation: (locale, key, value) => {
        const f = get().loc[locale];
        if (f) history.edit(`t:${locale}:${key}`, value, get, () => set({ loc: { ...get().loc, [locale]: setText(f, key, value) } }));
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
      refreshIcons: async () => {
        const { workspace, fileName } = get();
        const files = workspace?.icons && fileName ? await workspace.icons.list(groupId(fileName)).catch(() => null) : null;
        // The document may have changed while listing; only keep the answer if it is still for this group.
        if (get().workspace === workspace && get().fileName === fileName) set({ iconFiles: files, iconVersion: get().iconVersion + 1 });
      },
      addPendingIcon: (path, bytes) => set({ pendingIcons: { ...get().pendingIcons, [path]: bytes }, iconVersion: get().iconVersion + 1 }),
      markSaved: (fileName) => {
        set({ fileName, pendingIcons: {}, iconVersion: get().iconVersion + 1, locOriginal: Object.fromEntries(Object.entries(get().loc).map(([l, f]) => [l, serializeLoc(f)])) });
        set({ savedKey: docKey(get()), savedNames: plainNames(get().nodes) });
      },
    }),
    history.options,
  ),
);

// A blank editor is not "unsaved": its saved state is itself.
useApp.setState({ savedKey: docKey(useApp.getState()) });

/** One undo entry per node drag: pause on start, record the pre-drag state on drop. */
export const beginDrag = () => history.beginDrag(useApp);
export const endDrag = () => history.endDrag(useApp);
