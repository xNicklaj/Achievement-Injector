import type { Edge, NodeChange, Rect } from "@xyflow/react";
import { downstream, type AppNode } from "./graph";
import { incoming, nodeIndex, outgoing } from "@nicklaj/knotwork";
import { estimateHeight, W } from "./io/importGroup";
import { isCondition, registry } from "./registry";

/** One achievement on the canvas: its nodes, and the box around them. */
export type Band = { id: string; members: string[]; rect: Rect };

// An achievement's members follow from the wires and the node kinds, never from positions: they are kept per `edges` array,
// so dragging (which replaces `nodes` on every frame) does not walk the graph again.
const memberCache = new WeakMap<Edge[], Map<string, string[]>>();

/**
 * The nodes that make up one achievement: its Create Achievement node, the chain after it (Add Conditions, Join Type, actions),
 * every condition collected by Add Conditions (through Live / Negate and Conditions Met, to any depth) and each condition's own
 * On Unlock actions. Shared nodes (Localized Text, Icon, Plugin Override) belong to no achievement.
 */
export function membersOf(nodes: AppNode[], edges: Edge[], createId: string): string[] {
  let per = memberCache.get(edges);
  if (!per) memberCache.set(edges, (per = new Map()));
  const hit = per.get(createId);
  if (hit) return hit;

  const byId = nodeIndex(nodes);
  const out = new Set<string>([createId]);
  const visit = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    for (const e of incoming(edges, id)) if (e.targetHandle === "cond-in") visit(e.source);
    if (isCondition(byId.get(id)?.data.kind ?? "")) for (const a of downstream(edges, id)) out.add(a);
  };
  for (const id of downstream(edges, createId)) {
    out.add(id);
    if (byId.get(id)?.data.kind === "AddConditions") for (const e of incoming(edges, id)) if (e.targetHandle === "cond-in") visit(e.source);
  }
  const members = [...out];
  per.set(createId, members);
  return members;
}

/** The size a node takes on the canvas: measured when it has been, otherwise the importer's estimate. */
const sizeOf = (n: AppNode) => ({ width: n.measured?.width ?? W, height: n.measured?.height ?? estimateHeight(registry[n.data.kind], n.data.values) });

/** Achievements shown as their one Create Achievement node: a view setting, so it is never saved and not in the undo history. */
export type Collapsed = Record<string, true>;
const NOTHING: Collapsed = {};

/** The nodes that a collapsed achievement hides: all of its members but the Create Achievement node itself. */
export function hiddenOf(nodes: AppNode[], edges: Edge[], collapsed: Collapsed): Set<string> {
  const hidden = new Set<string>();
  for (const id of Object.keys(collapsed)) for (const m of membersOf(nodes, edges, id)) if (m !== id) hidden.add(m);
  return hidden;
}

// A hidden node is the same node with `hidden` set. One copy per source node, so React Flow sees the same object while nothing changes.
const hiddenCopy = new WeakMap<AppNode, AppNode>();
const asHidden = (n: AppNode) => hiddenCopy.get(n) ?? (hiddenCopy.set(n, { ...n, hidden: true }), hiddenCopy.get(n)!);

/**
 * Moving a collapsed achievement's one node moves what it hides by the same offset, so they come back together when it is expanded.
 * Returns `changes` with a position change added for each hidden node (the same array when nothing collapsed moved).
 */
export function followMoves(changes: NodeChange<AppNode>[], nodes: AppNode[], edges: Edge[], collapsed: Collapsed): NodeChange<AppNode>[] {
  if (!Object.keys(collapsed).length) return changes;
  const byId = nodeIndex(nodes);
  const extra: NodeChange<AppNode>[] = [];
  for (const c of changes) {
    if (c.type !== "position" || !c.position || !collapsed[c.id]) continue;
    const from = byId.get(c.id)?.position;
    if (!from) continue;
    const [dx, dy] = [c.position.x - from.x, c.position.y - from.y];
    if (!dx && !dy) continue;
    for (const id of membersOf(nodes, edges, c.id)) {
      const m = id === c.id ? undefined : byId.get(id);
      // Absolute positions, so a batch that names the node twice still ends where its last change puts it.
      if (m) extra.push({ type: "position", id, position: { x: m.position.x + dx, y: m.position.y + dy } });
    }
  }
  return extra.length ? [...changes, ...extra] : changes;
}

/** The nodes to give React Flow with those in `hidden` hidden; the array itself when there are none. */
export const hideNodes = (nodes: AppNode[], hidden: Set<string>): AppNode[] => (hidden.size ? nodes.map((n) => (hidden.has(n.id) ? asHidden(n) : n)) : nodes);

/** The worst problem among some nodes: `error`, else `warning`, else nothing. `byNode` is the validation's (`error|...` per node). */
export function worstLevel(byNode: Record<string, string>, ids: string[]): "error" | "warning" | undefined {
  let worst: "warning" | undefined;
  for (const id of ids) {
    const level = byNode[id]?.split("|", 1)[0];
    if (level === "error") return "error";
    if (level) worst = "warning";
  }
  return worst;
}

let last: { nodes?: AppNode[]; edges?: Edge[]; collapsed?: Collapsed; bands: Band[] } = { bands: [] };

/**
 * Every achievement, in the order of the file, with the box around its nodes. A collapsed one is only its Create Achievement
 * node, so that is the box (its `members` stay whole, to bring them all into view).
 */
export function bandsOf(nodes: AppNode[], edges: Edge[], collapsed: Collapsed = NOTHING): Band[] {
  // The viewport selector asks on every pan frame and the document has not changed in between.
  if (last.nodes === nodes && last.edges === edges && last.collapsed === collapsed) return last.bands;
  const byId = nodeIndex(nodes);
  const bands: Band[] = [];
  for (const create of nodes) {
    if (create.data.kind !== "CreateAchievement") continue;
    const members = membersOf(nodes, edges, create.id);
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of collapsed[create.id] ? [create.id] : members) {
      const n = byId.get(id);
      if (!n) continue;
      const { width, height } = sizeOf(n);
      [x0, y0, x1, y1] = [Math.min(x0, n.position.x), Math.min(y0, n.position.y), Math.max(x1, n.position.x + width), Math.max(y1, n.position.y + height)];
    }
    bands.push({ id: create.id, members, rect: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  }
  last = { nodes, edges, collapsed, bands };
  return bands;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The achievements with any part of their box in `view`, and the one nearest its centre (the one to call "current"). */
export function visibleBands(bands: Band[], view: Rect): { ids: string[]; current: string | undefined } {
  const inside = bands.filter((b) => overlaps(b.rect, view));
  const [cx, cy] = [view.x + view.width / 2, view.y + view.height / 2];
  const dist = (b: Band) => (b.rect.x + b.rect.width / 2 - cx) ** 2 + (b.rect.y + b.rect.height / 2 - cy) ** 2;
  const current = inside.reduce<Band | undefined>((best, b) => (!best || dist(b) < dist(best) ? b : best), undefined);
  return { ids: inside.map((b) => b.id), current: current?.id };
}

/** The part of the flow the canvas is showing, from React Flow's transform and the size of its pane. */
export const viewRect = ([tx, ty, zoom]: [number, number, number], width: number, height: number): Rect => ({ x: -tx / zoom, y: -ty / zoom, width: width / zoom, height: height / zoom });

/** The order after moving `id` next to `target`: before it, or after it. The same array when it would not move. */
export function movedOrder(order: string[], id: string, target: string, after: boolean): string[] {
  const rest = order.filter((x) => x !== id);
  const at = rest.indexOf(target);
  if (id === target || at < 0 || !order.includes(id)) return order;
  rest.splice(at + (after ? 1 : 0), 0, id);
  return rest.every((x, i) => x === order[i]) ? order : rest;
}

// Shared nodes that carry no achievement of their own: they go with an achievement only when it is the only one that uses them.
const SHARED = new Set(["LocalizedText", "Icon", "PluginOverride"]);

/** Per achievement: the nodes that move with it (its members, and the shared nodes only it uses) and the box around them. */
function groupsOf(nodes: AppNode[], edges: Edge[]): Map<string, { ids: string[]; rect: Rect }> {
  const byId = nodeIndex(nodes);
  const owner = new Map<string, string>();
  const ids = new Map<string, string[]>();
  for (const create of nodes) {
    if (create.data.kind !== "CreateAchievement") continue;
    const members = membersOf(nodes, edges, create.id);
    ids.set(create.id, [...members]);
    for (const id of members) owner.set(id, create.id);
  }
  for (const n of nodes) {
    if (!SHARED.has(n.data.kind)) continue;
    const users = new Set(outgoing(edges, n.id).map((e) => owner.get(e.target)));
    const only = users.size === 1 ? [...users][0] : undefined;
    if (only) ids.get(only)?.push(n.id);
  }
  const out = new Map<string, { ids: string[]; rect: Rect }>();
  for (const [create, list] of ids) {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of list) {
      const n = byId.get(id);
      if (!n) continue;
      const { width, height } = sizeOf(n);
      [x0, y0, x1, y1] = [Math.min(x0, n.position.x), Math.min(y0, n.position.y), Math.max(x1, n.position.x + width), Math.max(y1, n.position.y + height)];
    }
    out.set(create, { ids: list, rect: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  }
  return out;
}

/**
 * Where nodes go when the achievements are put in `order` down the canvas. The slots stay as they are (the top of the highest
 * achievement, and the gap between each pair of neighbours) and the achievements take them in the new order: each keeps its own
 * shape and its horizontal place and is moved vertically. Only nodes that move are in the answer; none when `order` is the order
 * they are already in. `order` is every Create Achievement id.
 */
export function restack(nodes: AppNode[], edges: Edge[], order: string[]): Map<string, { x: number; y: number }> {
  const groups = groupsOf(nodes, edges);
  const byId = nodeIndex(nodes);
  const moved = new Map<string, { x: number; y: number }>();
  const top = [...groups].sort(([, a], [, b]) => a.rect.y - b.rect.y);
  if (!top.length || order.every((id, i) => top[i]?.[0] === id)) return moved;
  // Neighbours that overlap (side by side) get no gap, rather than a negative one.
  const gaps = top.slice(1).map(([, g], i) => Math.max(0, g.rect.y - (top[i][1].rect.y + top[i][1].rect.height)));
  let y = top[0][1].rect.y;
  order.forEach((id, k) => {
    const g = groups.get(id);
    if (!g) return;
    const dy = y - g.rect.y;
    if (dy) for (const nid of g.ids) { const p = byId.get(nid)?.position; if (p) moved.set(nid, { x: p.x, y: Math.round(p.y + dy) }); }
    y += g.rect.height + (gaps[k] ?? 0);
  });
  return moved;
}
