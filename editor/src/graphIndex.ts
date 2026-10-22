import type { Edge } from "@xyflow/react";

/**
 * Lookups over the nodes and wires, built once per array and shared by every caller. Arrays are replaced, never edited, by the store
 * and the importer, so the array itself is the cache key; the length check only guards a test or script that pushes onto one.
 * A helper that scans `nodes` or `edges` for each node it visits is quadratic in the size of the document: use these instead.
 */
const cache = new WeakMap<object, { len: number; value: unknown }>();
function memo<T>(list: unknown[], build: () => T): T {
  const hit = cache.get(list);
  if (hit && hit.len === list.length) return hit.value as T;
  const value = build();
  cache.set(list, { len: list.length, value });
  return value;
}

/** Node by id. */
export const nodeIndex = <N extends { id: string }>(nodes: N[]): Map<string, N> => memo(nodes, () => new Map(nodes.map((n) => [n.id, n])));

type Wires = { into: Map<string, Edge[]>; outOf: Map<string, Edge[]> };
const wires = (edges: Edge[]): Wires =>
  memo(edges, () => {
    const into = new Map<string, Edge[]>();
    const outOf = new Map<string, Edge[]>();
    for (const e of edges) {
      (into.get(e.target) ?? into.set(e.target, []).get(e.target)!).push(e);
      (outOf.get(e.source) ?? outOf.set(e.source, []).get(e.source)!).push(e);
    }
    return { into, outOf };
  });

const NONE: Edge[] = [];
/** Wires ending at node `id`, in the order they were made (the order conditions are written to the file). */
export const incoming = (edges: Edge[], id: string): Edge[] => wires(edges).into.get(id) ?? NONE;
/** Wires starting at node `id`. */
export const outgoing = (edges: Edge[], id: string): Edge[] => wires(edges).outOf.get(id) ?? NONE;
