import type { Edge } from "@xyflow/react";
import { pinKind, refuseReason, type AppNode } from "./graph";
import { CATEGORIES, isLocalizable, nodeDefs, type NodeDef } from "./registry";

/** The pin a wire was dragged from. `source` is an output pin, `target` an input pin. */
export type SpawnFrom = { nodeId: string; handleId: string; handleType: "source" | "target" };

/** One thing the menu can create: a node type, and (when a wire is attached) the pin on it that the wire ends at. */
export type SpawnOption = { def: NodeDef; pin?: string; label: string };

const NEW = "__new__";

/**
 * Node types that can be created for a wire dragged from `from`, or every type when there is no wire (HANDOVER 3.5).
 * Each candidate is tried against the same connection rules as a hand-drawn wire, so a second AddConditions in a
 * chain, or a pin that is already used, is simply not offered.
 */
export function spawnOptions(nodes: AppNode[], edges: Edge[], from: SpawnFrom | null): SpawnOption[] {
  if (!from) return order(nodeDefs.map((def) => ({ def, label: def.title })));

  const kind = pinKind(from.handleId);
  const pins = (def: NodeDef): { pin: string; label: string }[] => {
    if (from.handleType === "source") {
      if (kind === "flow") return def.flowIn ? [{ pin: "flow-in", label: def.title }] : [];
      if (kind === "cond") return def.condIn ? [{ pin: "cond-in", label: def.title }] : [];
      // A text output can feed any localizable field; each field is its own choice.
      return def.fields.filter(isLocalizable).map((f) => ({ pin: `loc:${f.name}`, label: `${def.title} · ${f.name[0].toUpperCase()}${f.name.slice(1)}` }));
    }
    if (kind === "flow") return def.flowOut ? [{ pin: "flow-out", label: def.title }] : [];
    if (kind === "cond") return def.condOut ? [{ pin: "cond-out", label: def.title }] : [];
    return def.locOut ? [{ pin: "loc-out", label: def.title }] : [];
  };

  const out: SpawnOption[] = [];
  for (const def of nodeDefs) {
    for (const { pin, label } of pins(def)) {
      const fresh = { id: NEW, type: "ae", position: { x: 0, y: 0 }, data: { kind: def.kind, values: {} } } as AppNode;
      const link =
        from.handleType === "source"
          ? { source: from.nodeId, sourceHandle: from.handleId, target: NEW, targetHandle: pin }
          : { source: NEW, sourceHandle: pin, target: from.nodeId, targetHandle: from.handleId };
      if (refuseReason([...nodes, fresh], edges, link) === null) out.push({ def, pin, label });
    }
  }
  return order(out);
}

const order = (options: SpawnOption[]) => {
  const rank = (o: SpawnOption) => CATEGORIES.findIndex((c) => c.id === o.def.category);
  return [...options].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
};

/** Does `q` match this option by title, type name, keyword or field? Every word of `q` must match. */
export const matchesSpawn = (o: SpawnOption, q: string) => {
  const hay = [o.label, o.def.kind, ...o.def.keywords].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};
