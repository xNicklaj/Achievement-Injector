import type { Edge, Node } from "@xyflow/react";
import type { StoreApi } from "zustand";

/**
 * An in-memory clipboard over a store of `nodes` and `edges`, one per call. Copy takes the selected nodes and the wires between
 * them; paste adds them again with new ids, a little further down and right on each paste, selected, as ONE store update (one undo step).
 */
export function createClipboard<N extends Node, S extends { nodes: N[]; edges: Edge[] }>(o: {
  store: StoreApi<S>;
  /** The app's wire factory, so wire ids stay in the app's format. */
  edge: (source: string, sourceHandle: string, target: string, targetHandle: string) => Edge;
  /** Nodes that are never copied. */
  exclude?: (n: N) => boolean;
  /** After cloning: rewrite the copied nodes (the clones) given the state they were copied from. */
  copy?: (picked: N[], state: S) => N[];
  /** Before insertion: rewrite the fresh nodes given the state they are pasted into. */
  paste?: (fresh: N[], state: S) => N[];
}): { copy(): number; paste(): number; duplicate(): number; has(): boolean } {
  let clip: { nodes: N[]; edges: Edge[]; pastes: number } | null = null;

  const copy = () => {
    const s = o.store.getState();
    const picked = s.nodes.filter((n) => n.selected && !o.exclude?.(n));
    if (!picked.length) return 0;
    const ids = new Set(picked.map((n) => n.id));
    const clones = picked.map((n) => ({ ...n, selected: false, data: structuredClone(n.data) }));
    clip = {
      nodes: o.copy ? o.copy(clones, s) : clones,
      edges: s.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
      pastes: 0,
    };
    return picked.length;
  };

  const paste = () => {
    if (!clip) return 0;
    const s = o.store.getState();
    const offset = 40 * ++clip.pastes;
    const ids = new Map(clip.nodes.map((n) => [n.id, crypto.randomUUID()]));
    let fresh = clip.nodes.map((n) => ({ id: ids.get(n.id)!, type: n.type, position: { x: n.position.x + offset, y: n.position.y + offset }, data: structuredClone(n.data), selected: true }) as N);
    if (o.paste) fresh = o.paste(fresh, s);
    const wires = clip.edges.map((e) => o.edge(ids.get(e.source)!, e.sourceHandle!, ids.get(e.target)!, e.targetHandle!));
    o.store.setState({ nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...fresh], edges: [...s.edges, ...wires] } as Partial<S>);
    return fresh.length;
  };

  return { copy, paste, duplicate: () => (copy() ? paste() : 0), has: () => clip !== null };
}
