import type { Edge } from "@xyflow/react";
import { matchesSpawn, spawnOptions as kitSpawn, SPAWN_NEW, type SpawnFrom, type SpawnOption as KitOption } from "@nicklaj/knotwork";
import { refuseReason, type AppNode } from "./graph";
import { CATEGORIES, nodeDefs, type NodeDef } from "./registry";

export { matchesSpawn, type SpawnFrom };
export type SpawnOption = KitOption<NodeDef>;

const order = CATEGORIES.map((c) => c.id);

/**
 * Node types that can be created for a wire dragged from `from`, or every type when there is no wire (HANDOVER 3.5).
 * Each candidate is tried against the same connection rules as a hand-drawn wire, so a second AddConditions in a
 * chain, or a pin that is already used, is simply not offered.
 */
export const spawnOptions = (nodes: AppNode[], edges: Edge[], from: SpawnFrom | null): SpawnOption[] =>
  kitSpawn({
    defs: nodeDefs,
    from,
    order,
    refuse: (l, def) => refuseReason(nodes, edges, l, { id: SPAWN_NEW, type: "ae", position: { x: 0, y: 0 }, data: { kind: def.kind, values: {} } }),
  });
