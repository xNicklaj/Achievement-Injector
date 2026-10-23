import type { Edge } from "@xyflow/react";
import { incoming, outgoing } from "./graphIndex";

/** Handle ids are `<kind>-in`, `<kind>-out` or `<kind>:<field>`; kind names contain no `-` or `:`. */
export const pinKind = (h?: string | null): string | null => (h ? h.split(/[-:]/, 1)[0] || null : null);
/** The text after the first `:`, or null when the handle has none. */
export const pinField = (h?: string | null): string | null => {
  const i = h ? h.indexOf(":") : -1;
  return h && i >= 0 ? h.slice(i + 1) : null;
};

/** Names of the fields of node `id` that have a wire into a `<kind>:<field>` handle. */
export const wiredFields = (edges: Edge[], id: string): Set<string> =>
  new Set(incoming(edges, id).flatMap((e) => pinField(e.targetHandle) ?? []));

/** Nodes reached from `start` (not including it) along wires leaving a `<kind>-out` handle, going up (against the wires) or down. */
export function walk(edges: Edge[], start: string, kind: string, dir: "up" | "down"): Set<string> {
  const out = `${kind}-out`;
  const next = (id: string) =>
    dir === "up" ? incoming(edges, id).filter((e) => e.sourceHandle === out).map((e) => e.source) : outgoing(edges, id).filter((e) => e.sourceHandle === out).map((e) => e.target);
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) for (const n of next(stack.pop()!)) if (!seen.has(n)) (seen.add(n), stack.push(n));
  return seen;
}
