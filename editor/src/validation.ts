import { create } from "zustand";
import { exportGroup, type ExportState, type Issue } from "./io/exportGroup";
import type { Json } from "./io/importGroup";
import { usePlugins } from "./io/plugins";
import { useApp } from "./store";

export type Validation = {
  json: Json;
  issues: Issue[];
  /** Per node: `error|warning` then `|` then the messages joined by newlines. A string, so a node re-renders only when its own text changes. */
  byNode: Record<string, string>;
  /** Per node: comma-joined names of fields with an error, for red input borders. */
  fieldsByNode: Record<string, string>;
};

/** One pass over the document: the file as it would be saved, and where every problem shows on the canvas. */
export function computeValidation(s: ExportState): Validation {
  const { json, issues } = exportGroup(s);
  const grouped = new Map<string, Issue[]>();
  for (const i of issues) if (i.nodeId) grouped.set(i.nodeId, [...(grouped.get(i.nodeId) ?? []), i]);

  const byNode: Record<string, string> = {};
  const fieldsByNode: Record<string, string> = {};
  for (const [id, list] of grouped) {
    byNode[id] = `${list.some((i) => i.level === "error") ? "error" : "warning"}|${list.map((i) => i.detail ?? i.message).join("\n")}`;
    // Only errors turn a field red; a missing required value is just "incomplete" (amber on the node).
    const bad = [...new Set(list.flatMap((i) => (i.level === "error" && i.field ? [i.field] : [])))].sort();
    if (bad.length) fieldsByNode[id] = bad.join(",");
  }
  return { json, issues, byNode, fieldsByNode };
}

const current = () => ({ ...useApp.getState(), plugins: usePlugins.getState().plugins }) as ExportState;

export const useValidation = create<Validation>(() => computeValidation(current()));

/** Recompute shortly after the document stops changing, so dragging a node stays smooth. */
export function startValidation(wait = 150) {
  let t: ReturnType<typeof setTimeout>;
  const run = () => useValidation.setState(computeValidation(current()), true);
  const later = () => (clearTimeout(t), (t = setTimeout(run, wait)));
  const offs = [useApp.subscribe(later), usePlugins.subscribe(later)];
  run();
  return () => (offs.forEach((f) => f()), clearTimeout(t));
}

/** Split a `byNode` entry into its level and messages. */
export function parseNodeStatus(v: string | undefined): { level: "error" | "warning" | null; messages: string[] } {
  if (!v) return { level: null, messages: [] };
  const sep = v.indexOf("|");
  return { level: v.slice(0, sep) === "error" ? "error" : "warning", messages: v.slice(sep + 1).split("\n") };
}
