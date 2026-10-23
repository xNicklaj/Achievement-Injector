import type { Edge, Node } from "@xyflow/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";

/** A problem pinned to a node (and optionally one of its fields). `X` carries the app's own references, e.g. a design-tool node id. */
export type Issue<X = unknown> = { level: "error" | "warning"; message: string; detail?: string; nodeId?: string; field?: string } & X;

/**
 * Issues per node as two maps of strings, so a node's selector returns a primitive and re-renders only when its own text changes.
 * `byNode`: `error|warning`, then `|`, then the messages joined by newlines. `fieldsByNode`: comma-joined names of fields with an
 * error (a warning, such as a missing required value, does not turn a field red).
 */
export function groupIssues(issues: Issue[]): { byNode: Record<string, string>; fieldsByNode: Record<string, string> } {
  const grouped = new Map<string, Issue[]>();
  for (const i of issues) if (i.nodeId) grouped.set(i.nodeId, [...(grouped.get(i.nodeId) ?? []), i]);
  const byNode: Record<string, string> = {};
  const fieldsByNode: Record<string, string> = {};
  for (const [id, list] of grouped) {
    byNode[id] = `${list.some((i) => i.level === "error") ? "error" : "warning"}|${list.map((i) => i.detail ?? i.message).join("\n")}`;
    const bad = [...new Set(list.flatMap((i) => (i.level === "error" && i.field ? [i.field] : [])))].sort();
    if (bad.length) fieldsByNode[id] = bad.join(",");
  }
  return { byNode, fieldsByNode };
}

/** Split a `byNode` entry into its level and messages. */
export function parseNodeStatus(v: string | undefined): { level: "error" | "warning" | null; messages: string[] } {
  if (!v) return { level: null, messages: [] };
  const sep = v.indexOf("|");
  return { level: v.slice(0, sep) === "error" ? "error" : "warning", messages: v.slice(sep + 1).split("\n") };
}

const sameWire = (a: Edge, b: Edge) => a === b || (a.id === b.id && a.source === b.source && a.target === b.target && a.sourceHandle === b.sourceHandle && a.targetHandle === b.targetHandle);
const sameNode = (a: Node, b: Node) => a === b || (a.id === b.id && a.data === b.data && a.position.x === b.position.x && a.position.y === b.position.y);
const sameList = <T,>(a: T[], b: T[], same: (x: T, y: T) => boolean) => a === b || (a.length === b.length && a.every((x, i) => same(x, b[i])));

/**
 * Could the graph differ in anything validation reads? Selecting, measuring and a drag in progress replace node and wire objects
 * without changing their id, data, position or ends, and a pass costs milliseconds per hundred nodes.
 */
export const graphChanged = (a: { nodes: Node[]; edges: Edge[] }, b: { nodes: Node[]; edges: Edge[] }) =>
  !sameList(a.nodes, b.nodes, sameNode) || !sameList(a.edges, b.edges, sameWire);

/**
 * The one source of validation (CLAUDE.md "Validation has one source"): `compute` runs once per change, debounced, and every
 * node, minimap and view reads `use`. `start` takes watchers: each subscribes to something and calls `schedule` when validation
 * may be stale; it returns the function that stops them.
 */
export function createValidation<R extends object>(o: { compute: () => R; wait?: number }): {
  use: UseBoundStore<StoreApi<R>>;
  start(watchers: ((schedule: () => void) => () => void)[]): () => void;
} {
  const use = create<R>(() => o.compute());
  return {
    use,
    start(watchers) {
      let t: ReturnType<typeof setTimeout>;
      const run = () => use.setState(o.compute(), true);
      const later = () => (clearTimeout(t), (t = setTimeout(run, o.wait ?? 150)));
      const offs = watchers.map((w) => w(later));
      run();
      return () => (offs.forEach((f) => f()), clearTimeout(t));
    },
  };
}
