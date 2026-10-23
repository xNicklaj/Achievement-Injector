import type { NodeDef } from "./defs";
import { pinField, pinKind } from "./pins";
import type { Link } from "./rules";

export const SPAWN_NEW = "__new__";

/** The pin a wire was dragged from. `source` is an output pin, `target` an input pin. */
export type SpawnFrom = { nodeId: string; handleId: string; handleType: "source" | "target" };

/** One thing the menu can create: a node type, and (when a wire is attached) the pin on it that the wire ends at. */
export type SpawnOption<D extends NodeDef> = { def: D; pin?: string; label: string };

/**
 * Node types that can be created for a wire dragged from `from`, or every type when there is no wire.
 * Each candidate is tried with `refuse` as a hand-drawn wire to a new node with id `SPAWN_NEW`.
 */
export function spawnOptions<D extends NodeDef>(o: { defs: D[]; from: SpawnFrom | null; order: string[]; refuse: (l: Link, def: D) => string | null }): SpawnOption<D>[] {
  const { defs, from, order, refuse } = o;
  const sort = (list: SpawnOption<D>[]) => {
    const rank = (x: SpawnOption<D>) => order.indexOf(x.def.category);
    return [...list].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  };
  if (!from) return sort(defs.map((def) => ({ def, label: def.title })));

  const kind = pinKind(from.handleId);
  const side = from.handleType === "source" ? "in" : "out";
  const out: SpawnOption<D>[] = [];
  for (const def of defs)
    for (const p of def.pins) {
      // shortcut: kind equality only; add a `compatible` option when kinds can convert
      if (p.side !== side || pinKind(p.id) !== kind) continue;
      const link: Link =
        from.handleType === "source"
          ? { source: from.nodeId, sourceHandle: from.handleId, target: SPAWN_NEW, targetHandle: p.id }
          : { source: SPAWN_NEW, sourceHandle: p.id, target: from.nodeId, targetHandle: from.handleId };
      if (refuse(link, def) !== null) continue;
      const f = pinField(p.id);
      out.push({ def, pin: p.id, label: f ? `${def.title} · ${f[0].toUpperCase()}${f.slice(1)}` : def.title });
    }
  return sort(out);
}

/** Does `q` match this option by title, type name, keyword or field? Every word of `q` must match. */
export const matchesSpawn = (o: SpawnOption<NodeDef>, q: string) => {
  const hay = [o.label, o.def.kind, ...o.def.keywords].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};
