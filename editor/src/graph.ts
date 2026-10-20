import type { Edge, Node } from "@xyflow/react";
import { fallbackText, type LocFile } from "./io/localization";
import { isAction, isCondition, missingRequired, registry, wiredFields } from "./registry";

/** `values`: fields the editor has a widget for (unset = absent). `extra`: unknown keys, kept so import/export is lossless. */
export type NodeData = { kind: string; values: Record<string, unknown>; extra?: Record<string, unknown> };
export type AppNode = Node<NodeData, "ae">;

// Handle ids: `flow-in|flow-out`, `cond-in|cond-out`, `loc-out`, and `loc:<field>` for a localizable field's input pin.
export type PinKind = "flow" | "cond" | "loc";
export const pinKind = (handle: string | null | undefined): PinKind | null =>
  handle?.startsWith("flow") ? "flow" : handle?.startsWith("cond") ? "cond" : handle?.startsWith("loc") ? "loc" : null;

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
  if (kind === "loc" && used(c.targetHandle, "target", c.target)) return "Field already localized";
  return null;
}

/**
 * Names `AchievementUnlocked` can refer to in this group. A localized name counts as its fallback text, because the DLL
 * compares the reference with the achievement's final (localized) name as plain text.
 */
export function achievementNames(nodes: AppNode[], edges: Edge[], loc: Record<string, LocFile>): string[] {
  const names = new Set<string>();
  for (const n of nodes) {
    if (n.data.kind !== "CreateAchievement") continue;
    const wire = edges.find((e) => e.target === n.id && e.targetHandle === "loc:achievementName");
    const key = wire ? nodes.find((x) => x.id === wire.source)?.data.values.key : undefined;
    const name = wire ? (typeof key === "string" ? fallbackText(loc, key) : undefined) : n.data.values.achievementName;
    if (typeof name === "string" && name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** An `AchievementUnlocked` reference is inside this group when it names no group or this group's file name. */
export const isInternalGroup = (group: unknown, groupFile: string | null | undefined) =>
  group === undefined || group === "" || (typeof group === "string" && !!groupFile && group.toLowerCase() === groupFile.replace(/\.json$/i, "").toLowerCase());

/**
 * Fields fed by a LocalizedText wire that is going away keep the text as plain inline text, so removing the node
 * (or only its wire) never silently empties a field. No translation anywhere means the field stays empty.
 */
export function restoreInline(nodes: AppNode[], gone: Edge[], loc: Record<string, LocFile>): AppNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const patches = new Map<string, Record<string, string>>();
  for (const e of gone) {
    if (e.sourceHandle !== "loc-out" || !e.targetHandle?.startsWith("loc:") || !byId.has(e.target)) continue;
    const key = byId.get(e.source)?.data.values.key;
    const text = typeof key === "string" && key ? fallbackText(loc, key) : undefined;
    if (text !== undefined) patches.set(e.target, { ...patches.get(e.target), [e.targetHandle.slice(4)]: text });
  }
  if (!patches.size) return nodes;
  return nodes.map((n) => (patches.has(n.id) ? { ...n, data: { ...n.data, values: { ...n.data.values, ...patches.get(n.id) } } } : n));
}

/** Human summary of an AddConditions node, derived from edges (HANDOVER 3.2), never stored. */
export function conditionsSummary(nodes: AppNode[], edges: Edge[], id: string) {
  const incomplete = (n: AppNode) => missingRequired(registry[n.data.kind], n.data.values, wiredFields(edges, n.id));
  const fed = edges.filter((e) => e.target === id && e.targetHandle === "cond-in").map((e) => nodes.find((n) => n.id === e.source)!);
  if (!fed.length) return { text: "No conditions", level: "error" as const };
  const bad = fed.filter(incomplete).length;
  const join = [...upstream(edges, id), ...downstream(edges, id)].map((n) => nodes.find((x) => x.id === n)).find((n) => n?.data.kind === "JoinType");
  const joinText = join ? "" : " · OR (default)";
  return {
    text: `${fed.length} condition${fed.length > 1 ? "s" : ""}${bad ? ` · ${bad} incomplete` : ""}${joinText}`,
    level: bad ? ("warning" as const) : ("ok" as const),
  };
}
