import { createValidation, graphChanged, groupIssues, parseNodeStatus } from "@nicklaj/knotwork";
import { exportGroup, type ExportState, type Issue } from "./io/exportGroup";
import type { Json } from "./io/importGroup";
import { usePlugins } from "./io/plugins";
import { useApp } from "./store";

export { parseNodeStatus };

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
  return { json, issues, ...groupIssues(issues) };
}

const current = () => ({ ...useApp.getState(), plugins: usePlugins.getState().plugins }) as ExportState;

const validation = createValidation({ compute: () => computeValidation(current()) });
export const useValidation = validation.use;

type Doc = Pick<ExportState, "nodes" | "edges" | "group" | "groupExtra" | "loc" | "fileName" | "iconFiles" | "pendingIcons">;

/** Could the file, or a problem in it, differ between these two states? */
export const docChanged = (a: Doc, b: Doc): boolean =>
  a.group !== b.group || a.groupExtra !== b.groupExtra || a.loc !== b.loc || a.fileName !== b.fileName || a.iconFiles !== b.iconFiles || a.pendingIcons !== b.pendingIcons || graphChanged(a, b);

/** Recompute shortly after the document stops changing, so dragging a node stays smooth. */
export const startValidation = () =>
  validation.start([(later) => useApp.subscribe((s, was) => docChanged(was, s) && later()), (later) => usePlugins.subscribe(later)]);
