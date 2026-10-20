import type { Edge } from "@xyflow/react";
import { achievementNames, type AppNode } from "./graph";
import { mkEdge } from "./io/importGroup";
import { fallbackText } from "./io/localization";
import { useApp } from "./store";

let clip: { nodes: AppNode[]; edges: Edge[]; pastes: number } | null = null;
export const hasClipboard = () => clip !== null;

/**
 * Copy the selected nodes and the wires between them. Localized Text nodes are never copied (a key belongs to one node, so a
 * copy would clash): a field they fed is copied as plain text instead, so the pasted node reads the same.
 */
export function copySelection(): number {
  const { nodes, edges, loc } = useApp.getState();
  const picked = nodes.filter((n) => n.selected && n.data.kind !== "LocalizedText");
  if (!picked.length) return 0;
  const ids = new Set(picked.map((n) => n.id));
  const inline = new Map<string, Record<string, string>>();
  for (const e of edges) {
    if (e.sourceHandle !== "loc-out" || !e.targetHandle?.startsWith("loc:") || !ids.has(e.target)) continue;
    const key = nodes.find((n) => n.id === e.source)?.data.values.key;
    const text = typeof key === "string" && key ? fallbackText(loc, key) : undefined;
    if (text !== undefined) inline.set(e.target, { ...inline.get(e.target), [e.targetHandle.slice(4)]: text });
  }
  clip = {
    nodes: picked.map((n) => ({ ...n, selected: false, data: structuredClone({ ...n.data, values: { ...n.data.values, ...inline.get(n.id) } }) })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.sourceHandle !== "loc-out"),
    pastes: 0,
  };
  return picked.length;
}

/** `Name` -> `Name (copy)`, `Name (copy 2)`..., skipping names in use: achievement names are unique. */
const unused = (name: string, taken: Set<string>) => {
  let n = `${name} (copy)`;
  for (let i = 2; taken.has(n); i++) n = `${name} (copy ${i})`;
  taken.add(n);
  return n;
};

/** Paste the copied nodes with new ids, a little down and right of where they were, selected. One undo step. */
export function paste(): number {
  if (!clip) return 0;
  const s = useApp.getState();
  const offset = 40 * ++clip.pastes;
  const ids = new Map(clip.nodes.map((n) => [n.id, crypto.randomUUID()]));
  const taken = new Set(achievementNames(s.nodes, s.edges, s.loc));
  const fresh: AppNode[] = clip.nodes.map((n) => {
    const data = structuredClone(n.data);
    if (data.kind === "CreateAchievement" && typeof data.values.achievementName === "string") data.values.achievementName = unused(data.values.achievementName, taken);
    return { id: ids.get(n.id)!, type: "ae", position: { x: n.position.x + offset, y: n.position.y + offset }, data, selected: true };
  });
  const wires = clip.edges.map((e) => mkEdge(ids.get(e.source)!, e.sourceHandle!, ids.get(e.target)!, e.targetHandle!));
  useApp.setState({ nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...fresh], edges: [...s.edges, ...wires] });
  return fresh.length;
}

export function duplicateSelection(): number {
  return copySelection() ? paste() : 0;
}
