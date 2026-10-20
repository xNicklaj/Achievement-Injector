import type { Edge, Node } from "@xyflow/react";
import { fallbackText, type LocFile } from "./io/localization";
import { LIVE_TYPES } from "./schema";
import { isAction, isCondition, LINK_KINDS, missingRequired, registry, wiredFields, type LinkKind } from "./registry";

/** `values`: fields the editor has a widget for (unset = absent). `extra`: unknown keys, kept so import/export is lossless. */
export type NodeData = { kind: string; values: Record<string, unknown>; extra?: Record<string, unknown> };
export type AppNode = Node<NodeData, "ae">;

// Handle ids: `flow-in|flow-out`, `cond-in|cond-out`, and for text, achievement and icon links `<kind>-out` and `<kind>:<field>`.
export type PinKind = "flow" | "cond" | LinkKind;
export const pinKind = (handle: string | null | undefined): PinKind | null =>
  handle?.startsWith("flow") ? "flow" : handle?.startsWith("cond") ? "cond" : LINK_KINDS.find((k) => handle?.startsWith(k)) ?? null;

export const isModifier = (kind: string) => !!registry[kind]?.modifier;

/** The condition behind a wire from `id`, looking back through Live / Negate nodes. `mods` run from the condition towards `id`; `seen` holds the modifiers passed. */
export function behind(nodes: AppNode[], edges: Edge[], id: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const mods: AppNode[] = [];
  const seen = new Set<string>();
  let n = byId.get(id);
  while (n && isModifier(n.data.kind) && !seen.has(n.id)) {
    seen.add(n.id);
    mods.unshift(n);
    const from = edges.find((e) => e.target === n!.id && e.targetHandle === "cond-in")?.source;
    n = from ? byId.get(from) : undefined;
  }
  return { root: n && !isModifier(n.data.kind) ? n : undefined, mods, seen };
}

const walk = (edges: Edge[], start: string, next: (id: string) => string[]) => {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    for (const n of next(stack.pop()!)) if (!seen.has(n)) (seen.add(n), stack.push(n));
  }
  return seen;
};

const flowEdges = (edges: Edge[]) => edges.filter((e) => e.sourceHandle === "flow-out");

/** Nodes upstream and downstream of `id` along flow edges (not including `id`). */
export const upstream = (edges: Edge[], id: string) =>
  walk(edges, id, (n) => flowEdges(edges).filter((e) => e.target === n).map((e) => e.source));
export const downstream = (edges: Edge[], id: string) =>
  walk(edges, id, (n) => flowEdges(edges).filter((e) => e.source === n).map((e) => e.target));

export type Link = { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };

/** Why a connection is refused, or null when it is fine. Shared by `isValidConnection` and tests. */
export function refuseReason(nodes: AppNode[], edges: Edge[], c: Link): string | null {
  const kind = pinKind(c.sourceHandle);
  if (!kind || kind !== pinKind(c.targetHandle)) return "Pin types differ";
  if (c.source === c.target) return "Cannot connect a node to itself";

  const used = (handle: string | null | undefined, side: "source" | "target", id: string) =>
    edges.some((e) => e[side] === id && (side === "source" ? e.sourceHandle : e.targetHandle) === handle);

  if (kind === "flow") {
    if (used(c.sourceHandle, "source", c.source) || used(c.targetHandle, "target", c.target)) return "Flow pin already connected";
    const before = upstream(edges, c.source).add(c.source);
    const after = downstream(edges, c.target).add(c.target);
    if (before.has(c.target)) return "Would create a loop";
    // Generic "chain already contains node type X" rule (HANDOVER 3.2).
    const count = new Map<string, number>();
    for (const id of [...before, ...after]) {
      const def = registry[nodes.find((n) => n.id === id)?.data.kind ?? ""];
      if (def?.unique) count.set(def.kind, (count.get(def.kind) ?? 0) + 1);
    }
    for (const [k, n] of count) if (n > 1) return `A chain can have only one ${registry[k].title}`;
    // A chain that starts at a condition is that condition's `onUnlock`: it can hold actions only.
    const kinds = [...before, ...after].map((id) => nodes.find((n) => n.id === id)?.data.kind ?? "");
    if (kinds.some(isCondition) && !kinds.every((k) => isCondition(k) || isAction(k))) return "A condition's On Unlock can only run commands and Papyrus calls";
  }
  // A condition node feeds one AddConditions only (HANDOVER 3.2); a localizable field takes one text node.
  if (kind === "cond" && used(c.sourceHandle, "source", c.source)) return "Condition already used";
  const into = nodes.find((n) => n.id === c.target);
  if (kind === "cond" && into && isModifier(into.data.kind)) {
    if (used(c.targetHandle, "target", c.target)) return "Already has a condition";
    const { root, seen } = behind(nodes, edges, c.source);
    if (seen.has(c.target)) return "Would create a loop";
    if (root && !LIVE_TYPES.has(root.data.kind)) return `${registry[root.data.kind].title} does not support Live or Negate`;
  }
  if (kind !== "flow" && kind !== "cond" && used(c.targetHandle, "target", c.target)) return kind === "loc" ? "Field already localized" : "Field already linked";
  // An achievement cannot wait for itself: the condition's own achievement is the one whose chain holds it.
  if (kind === "ach" && ownerOf(nodes, edges, c.target) === c.source) return "An achievement cannot wait for itself";
  return null;
}

/** The achievement a condition node belongs to: the Create Achievement at the head of the chain its Add Conditions is in. */
export function ownerOf(nodes: AppNode[], edges: Edge[], condition: string): string | undefined {
  // Follow the wire through any Live / Negate nodes to the Add Conditions.
  let add: string | undefined = condition;
  for (const seen = new Set<string>(); add && !seen.has(add); ) {
    seen.add(add);
    add = edges.find((e) => e.source === add && e.sourceHandle === "cond-out")?.target;
    if (!add || !isModifier(nodes.find((n) => n.id === add)?.data.kind ?? "")) break;
  }
  if (!add) return undefined;
  return [...upstream(edges, add)].find((id) => nodes.find((n) => n.id === id)?.data.kind === "CreateAchievement");
}

/** What a link wire stands for: the text of a Localized Text key, an achievement name, or an icon file. Undefined when the source has none yet. */
export function linkedText(nodes: AppNode[], edges: Edge[], loc: Record<string, LocFile>, source: AppNode, kind: LinkKind): string | undefined {
  const translated = (key: unknown) => (typeof key === "string" && key ? fallbackText(loc, key) : undefined);
  const plain = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  if (kind === "loc") return translated(source.data.values.key);
  if (kind === "icon") return plain(source.data.values.file);
  // A localized achievement name counts as its fallback text: the DLL compares plain text.
  const wire = edges.find((e) => e.target === source.id && e.targetHandle === "loc:achievementName");
  return wire ? translated(nodes.find((n) => n.id === wire.source)?.data.values.key) : plain(source.data.values.achievementName);
}

/**
 * Names `AchievementUnlocked` can refer to in this group. A localized name counts as its fallback text, because the DLL
 * compares the reference with the achievement's final (localized) name as plain text.
 */
export function achievementNames(nodes: AppNode[], edges: Edge[], loc: Record<string, LocFile>): string[] {
  const names = new Set<string>();
  for (const n of nodes) if (n.data.kind === "CreateAchievement") names.add(linkedText(nodes, edges, loc, n, "ach") ?? "");
  names.delete("");
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** An `AchievementUnlocked` reference is inside this group when it names no group or this group's file name. */
export const isInternalGroup = (group: unknown, groupFile: string | null | undefined) =>
  group === undefined || group === "" || (typeof group === "string" && !!groupFile && group.toLowerCase() === groupFile.replace(/\.json$/i, "").toLowerCase());

/**
 * Fields fed by a link wire (text, achievement or icon) that is going away keep the value as plain inline text, so removing
 * the node (or only its wire) never silently empties a field. `edges` are all wires before the removal.
 * Nothing to keep (no translation, no name yet) means the field stays empty.
 */
export function restoreInline(nodes: AppNode[], gone: Edge[], loc: Record<string, LocFile>, edges: Edge[]): AppNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const patches = new Map<string, Record<string, string>>();
  for (const e of gone) {
    const kind = LINK_KINDS.find((k) => e.sourceHandle === `${k}-out` && e.targetHandle?.startsWith(`${k}:`));
    const source = byId.get(e.source);
    if (!kind || !source || !byId.has(e.target)) continue;
    const text = linkedText(nodes, edges, loc, source, kind);
    if (text !== undefined) patches.set(e.target, { ...patches.get(e.target), [e.targetHandle!.slice(kind.length + 1)]: text });
  }
  if (!patches.size) return nodes;
  return nodes.map((n) => (patches.has(n.id) ? { ...n, data: { ...n.data, values: { ...n.data.values, ...patches.get(n.id) } } } : n));
}

/** Human summary of an AddConditions node, derived from edges (HANDOVER 3.2), never stored. */
export function conditionsSummary(nodes: AppNode[], edges: Edge[], id: string) {
  const incomplete = (n: AppNode) => missingRequired(registry[n.data.kind], n.data.values, wiredFields(edges, n.id));
  const fed = edges.filter((e) => e.target === id && e.targetHandle === "cond-in").flatMap((e) => behind(nodes, edges, e.source).root ?? []);
  if (!fed.length) return { text: "No conditions", level: "error" as const };
  const bad = fed.filter(incomplete).length;
  const join = [...upstream(edges, id), ...downstream(edges, id)].map((n) => nodes.find((x) => x.id === n)).find((n) => n?.data.kind === "JoinType");
  const joinText = join ? "" : " · OR (default)";
  return {
    text: `${fed.length} condition${fed.length > 1 ? "s" : ""}${bad ? ` · ${bad} incomplete` : ""}${joinText}`,
    level: bad ? ("warning" as const) : ("ok" as const),
  };
}
