import type { Edge, Node } from "@xyflow/react";
import { fallbackText, type LocFile } from "./io/localization";
import { composeRules, wiredFields, incoming, nodeIndex, noLoop, noSelfLink, onePerChain, outgoing, pinKind as kitPinKind, pinsMatch, pinUsedOnce, walk, type Link, type Rule, type RuleCtx } from "@xnicklaj/knotwork";
import { LIVE_TYPES } from "./schema";
import { isAction, isCondition, LINK_KINDS, missingRequired, registry, type LinkKind } from "./registry";

/** `values`: fields the editor has a widget for (unset = absent). `extra`: unknown keys, kept so import/export is lossless. */
export type NodeData = { kind: string; values: Record<string, unknown>; extra?: Record<string, unknown> };
export type AppNode = Node<NodeData, "ae">;

// Handle ids: `flow-in|flow-out`, `cond-in|cond-out`, and for text, achievement, icon and plugin links `<kind>-out` and `<kind>:<field>`.
export type PinKind = "flow" | "cond" | LinkKind;
export const pinKind = (handle: string | null | undefined): PinKind | null => {
  const k = kitPinKind(handle);
  return k === "flow" || k === "cond" ? k : LINK_KINDS.find((l) => l === k) ?? null;
};

export const isModifier = (kind: string) => !!registry[kind]?.modifier;
/** A condition that collects other conditions through its own `cond-in` pin. */
export const isGroupCondition = (kind: string) => kind === "ConditionsMet";
const NO_LIVE_INSIDE = "Live and Negate are not supported inside Conditions Met";

/** The condition behind a wire from `id`, looking back through Live / Negate nodes. `mods` run from the condition towards `id`; `seen` holds the modifiers passed. */
export function behind(nodes: AppNode[], edges: Edge[], id: string, node?: (id: string) => AppNode | undefined) {
  const byId = { get: node ?? ((i: string) => nodeIndex(nodes).get(i)) };
  const mods: AppNode[] = [];
  const seen = new Set<string>();
  let n = byId.get(id);
  while (n && isModifier(n.data.kind) && !seen.has(n.id)) {
    seen.add(n.id);
    mods.unshift(n);
    const from = incoming(edges, n.id).find((e) => e.targetHandle === "cond-in")?.source;
    n = from ? byId.get(from) : undefined;
  }
  return { root: n && !isModifier(n.data.kind) ? n : undefined, mods, seen };
}

/** Nodes upstream and downstream of `id` along flow edges (not including `id`). */
export const upstream = (edges: Edge[], id: string) => walk(edges, id, "flow", "up");
export const downstream = (edges: Edge[], id: string) => walk(edges, id, "flow", "down");

export type { Link };

const flowReason = "Flow pin already connected";
type Ctx = RuleCtx<AppNode>;

// A chain that starts at a condition is that condition's `onUnlock`: it can hold actions only.
const onUnlockActionsOnly: Rule<AppNode> = (l, { edges, node }) => {
  if (pinKind(l.sourceHandle) !== "flow") return null;
  const ids = [...walk(edges, l.source, "flow", "up").add(l.source), ...walk(edges, l.target, "flow", "down").add(l.target)];
  const kinds = ids.map((id) => node(id)?.data.kind ?? "");
  return kinds.some(isCondition) && !kinds.every((k) => isCondition(k) || isAction(k)) ? "A condition's On Unlock can only run commands and Papyrus calls" : null;
};

// Conditions Met takes its sub-conditions as they are: the mod rejects a live or negated one, and a loop would never end.
const conditionsMetRules: Rule<AppNode> = (l, { edges, node }: Ctx) => {
  const into = node(l.target);
  if (pinKind(l.sourceHandle) !== "cond" || !into || !isGroupCondition(into.data.kind)) return null;
  const src = node(l.source);
  if (src && isModifier(src.data.kind)) return NO_LIVE_INSIDE;
  const seen = new Set<string>();
  for (const stack = [l.source]; stack.length; ) {
    const id = stack.pop()!;
    if (id === l.target) return "Would create a loop";
    if (!seen.has(id)) (seen.add(id), stack.push(...incoming(edges, id).filter((e) => e.targetHandle === "cond-in").map((e) => e.source)));
  }
  return null;
};

const modifierRules: Rule<AppNode> = (l, { nodes, edges, node }: Ctx) => {
  const into = node(l.target);
  if (pinKind(l.sourceHandle) !== "cond" || !into || !isModifier(into.data.kind)) return null;
  if (incoming(edges, l.target).some((e) => e.targetHandle === l.targetHandle)) return "Already has a condition";
  const { root, seen } = behind(nodes, edges, l.source, node);
  if (seen.has(l.target)) return "Would create a loop";
  if (root && !LIVE_TYPES.has(root.data.kind)) return `${registry[root.data.kind].title} does not support Live or Negate`;
  // The modifier already feeds a Conditions Met.
  const out = outgoing(edges, l.target).find((e) => e.sourceHandle === "cond-out")?.target;
  return isGroupCondition((out && node(out)?.data.kind) || "") ? NO_LIVE_INSIDE : null;
};

// An achievement cannot wait for itself: the condition's own achievement is the one whose chain holds it.
const achNoSelfWait: Rule<AppNode> = (l, { nodes, edges }) =>
  pinKind(l.sourceHandle) === "ach" && ownerOf(nodes, edges, l.target) === l.source ? "An achievement cannot wait for itself" : null;

const KNOWN_KINDS: readonly string[] = ["flow", "cond", ...LINK_KINDS];

/** Why a connection is refused, or null when it is fine. Shared by `isValidConnection`, spawn (`extra` is the node not yet in `nodes`) and tests. */
export const refuseReason = composeRules<AppNode>(
  pinsMatch((a, b) => a === b && KNOWN_KINDS.includes(a)),
  noSelfLink(),
  pinUsedOnce("flow", "both", flowReason),
  noLoop("flow"),
  // Generic "chain already contains node type X" rule (HANDOVER 3.2).
  onePerChain<AppNode>("flow", (n) => {
    const def = registry[n.data.kind];
    return def?.unique ? { key: def.kind, title: def.title } : undefined;
  }),
  onUnlockActionsOnly,
  // A condition node feeds one AddConditions only (HANDOVER 3.2); a localizable field takes one text node.
  pinUsedOnce("cond", "source", "Condition already used"),
  conditionsMetRules,
  modifierRules,
  pinUsedOnce("loc", "target", "Field already localized"),
  pinUsedOnce("ach", "target", "Field already linked"),
  pinUsedOnce("icon", "target", "Field already linked"),
  pinUsedOnce("plugin", "target", "Field already linked"),
  achNoSelfWait,
) as (nodes: AppNode[], edges: Edge[], c: Link, extra?: AppNode) => string | null;

/** The achievement a condition node belongs to: the Create Achievement at the head of the chain its Add Conditions is in. */
export function ownerOf(nodes: AppNode[], edges: Edge[], condition: string): string | undefined {
  // Follow the wire through any Live / Negate nodes and enclosing Conditions Met nodes to the Add Conditions.
  const byId = nodeIndex(nodes);
  let add: string | undefined = condition;
  for (const seen = new Set<string>(); add && !seen.has(add); ) {
    seen.add(add);
    add = outgoing(edges, add).find((e) => e.sourceHandle === "cond-out")?.target;
    const kind = (add && byId.get(add)?.data.kind) || "";
    if (!add || !(isModifier(kind) || isGroupCondition(kind))) break;
  }
  if (!add) return undefined;
  return [...upstream(edges, add)].find((id) => byId.get(id)?.data.kind === "CreateAchievement");
}

/** What a link wire stands for: the text of a Localized Text key, an achievement name, an icon file or a plugin. Undefined when the source has none yet. */
export function linkedText(nodes: AppNode[], edges: Edge[], loc: Record<string, LocFile>, source: AppNode, kind: LinkKind): string | undefined {
  const translated = (key: unknown) => (typeof key === "string" && key ? fallbackText(loc, key) : undefined);
  const plain = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  if (kind === "loc") return translated(source.data.values.key);
  if (kind === "icon") return plain(source.data.values.file);
  if (kind === "plugin") return plain(source.data.values.plugin);
  // A localized achievement name counts as its fallback text: the DLL compares plain text.
  const wire = incoming(edges, source.id).find((e) => e.targetHandle === "loc:achievementName");
  return wire ? translated(nodeIndex(nodes).get(wire.source)?.data.values.key) : plain(source.data.values.achievementName);
}

/** The plugin a node resolves forms in: its own override, else its achievement's, else the group's. An override is a wired Plugin Override node or a typed value. */
export function pluginOf(nodes: AppNode[], edges: Edge[], node: AppNode, groupPlugin: string | undefined): string | undefined {
  const byId = nodeIndex(nodes);
  const own = (n: AppNode | undefined) => {
    if (!n) return undefined;
    const wire = incoming(edges, n.id).find((e) => e.targetHandle === "plugin:pluginOverride");
    const v = wire ? byId.get(wire.source)?.data.values.plugin : n.data.values.pluginOverride;
    return typeof v === "string" && v ? v : undefined;
  };
  const ownerId = isCondition(node.data.kind) ? ownerOf(nodes, edges, node.id) : undefined;
  return own(node) ?? own(ownerId ? byId.get(ownerId) : undefined) ?? groupPlugin;
}

/**
 * Names `AchievementUnlocked` can refer to in this group. A localized name counts as its fallback text, because the DLL
 * compares the reference with the achievement's final (localized) name as plain text.
 */
export function achievementNames(nodes: AppNode[], edges: Edge[], loc: Record<string, LocFile>): string[] {
  // Every Achievement Unlocked field asks on each store update: the answer for the same document is computed once.
  if (lastNames.nodes === nodes && lastNames.edges === edges && lastNames.loc === loc) return lastNames.result;
  const found = new Set<string>();
  for (const n of nodes) if (n.data.kind === "CreateAchievement") found.add(linkedText(nodes, edges, loc, n, "ach") ?? "");
  found.delete("");
  const result = [...found].sort((a, b) => a.localeCompare(b));
  Object.assign(lastNames, { nodes, edges, loc, result });
  return result;
}
const lastNames: { nodes?: AppNode[]; edges?: Edge[]; loc?: Record<string, LocFile>; result: string[] } = { result: [] };

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

/** Human summary of an AddConditions or ConditionsMet node, derived from edges (HANDOVER 3.2), never stored. */
export function conditionsSummary(nodes: AppNode[], edges: Edge[], id: string) {
  const incomplete = (n: AppNode) => missingRequired(registry[n.data.kind], n.data.values, wiredFields(edges, n.id));
  const byId = nodeIndex(nodes);
  const fed = incoming(edges, id).filter((e) => e.targetHandle === "cond-in").flatMap((e) => behind(nodes, edges, e.source).root ?? []);
  if (!fed.length) return { text: "No conditions", level: "error" as const };
  const bad = fed.filter(incomplete).length;
  const self = byId.get(id);
  if (self && isGroupCondition(self.data.kind)) {
    const q = self.data.values.quantity;
    const need = typeof q === "number" ? q : undefined;
    const total = `${fed.length} condition${fed.length > 1 ? "s" : ""}`;
    if (need !== undefined && need > fed.length) return { text: `Needs ${need}, but has ${total}`, level: "error" as const };
    return { text: `${need !== undefined ? `${need} of ` : ""}${total}${bad ? ` · ${bad} incomplete` : ""}`, level: bad ? ("warning" as const) : ("ok" as const) };
  }
  const join = [...upstream(edges, id), ...downstream(edges, id)].map((n) => byId.get(n)).find((n) => n?.data.kind === "JoinType");
  const joinText = join ? "" : " · OR (default)";
  return {
    text: `${fed.length} condition${fed.length > 1 ? "s" : ""}${bad ? ` · ${bad} incomplete` : ""}${joinText}`,
    level: bad ? ("warning" as const) : ("ok" as const),
  };
}
