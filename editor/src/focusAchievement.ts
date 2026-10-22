import type { ReactFlowInstance } from "@xyflow/react";
import { membersOf } from "./achievements";
import type { AppNode } from "./graph";
import { useApp } from "./store";

/** Select one achievement's Create node (and nothing else) and fit the view to what it shows. */
export function focusAchievement(id: string, fitView: ReactFlowInstance<AppNode>["fitView"]) {
  const { nodes, edges, collapsed, onNodesChange } = useApp.getState();
  onNodesChange([...nodes.filter((n) => n.selected && n.id !== id).map((n) => ({ type: "select" as const, id: n.id, selected: false })), { type: "select" as const, id, selected: true }]);
  void fitView({ nodes: (collapsed[id] ? [id] : membersOf(nodes, edges, id)).map((m) => ({ id: m })), duration: 300, padding: 0.2, maxZoom: 1 });
}
