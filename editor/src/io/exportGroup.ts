import type { Edge } from "@xyflow/react";
import type { AppNode } from "../graph";
import { isLocalizable, registry } from "../registry";
import { GroupSchema, SCHEMA_VERSION } from "../schema";
import type { GroupValues } from "../store";
import type { Json } from "./importGroup";
import { getText, type LocFile } from "./localization";

export type Issue = { level: "error" | "warning"; message: string };
export type ExportState = { nodes: AppNode[]; edges: Edge[]; group: GroupValues; groupExtra: Json; loc?: Record<string, LocFile> };

/** The JSON without editor metadata, for reading. `_editor` is still written to the file. */
export const withoutEditor = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(withoutEditor) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "_editor").map(([k, x]) => [k, withoutEditor(x)])) : v;

const round = (n: number) => Math.round(n);
const xy = (n: AppNode) => ({ x: round(n.position.x), y: round(n.position.y) });

/**
 * Graph -> JSON. Unset fields are omitted, unknown keys come back from `extra`, so a file imported and
 * exported untouched is identical apart from `_editor` (HANDOVER 3.3). Problems are returned, never thrown:
 * saving with errors is allowed behind a confirmation (3.8).
 */
export function exportGroup(s: ExportState): { json: Json; issues: Issue[] } {
  const issues: Issue[] = [];
  const byId = new Map(s.nodes.map((n) => [n.id, n]));
  const flowNext = (id: string) => s.edges.find((e) => e.source === id && e.sourceHandle === "flow-out")?.target;
  const keyOf = (n: AppNode) => (typeof n.data.values.key === "string" ? n.data.values.key : "");

  // Two LocalizedText nodes with the same key are an error (HANDOVER 3.13).
  const keyNodes = s.nodes.filter((n) => n.data.kind === "LocalizedText");
  const seenKeys = new Set<string>();
  for (const n of keyNodes) {
    const k = keyOf(n);
    if (!k) issues.push({ level: "error", message: "A Localized Text node has no key." });
    else if (seenKeys.has(k)) issues.push({ level: "error", message: `Localized Text key "${k}" is used by more than one node.` });
    seenKeys.add(k);
  }

  // A used key without text in some language falls back to English, then to the raw `$key` in game (LocalizationManager).
  const loc = s.loc ?? {};
  const langs = Object.keys(loc).sort();
  const usedKeys = keyNodes.filter((n) => keyOf(n) && s.edges.some((e) => e.source === n.id));
  if (usedKeys.length && !langs.length)
    issues.push({ level: "warning", message: "No languages are set up, so localized fields show their raw $key in game. Add one on Group Properties." });
  // English is the fallback for every other language, so keys without it show raw `$key` text to those players.
  if (usedKeys.length && langs.length && !loc.EN)
    issues.push({ level: "warning", message: "There is no English (EN) file. English is the fallback for languages without a translation." });
  for (const n of usedKeys) {
    const missing = langs.filter((l) => !getText(loc[l], keyOf(n)));
    if (missing.length) issues.push({ level: "warning", message: `Localized Text "${keyOf(n)}" has no translation for ${missing.join(", ")}.` });
  }

  /** Field values of one node, with localized pins resolved to `$key`, then its unknown keys. */
  const fields = (n: AppNode): Json => {
    const out: Json = {};
    for (const f of registry[n.data.kind].fields) {
      const wire = isLocalizable(f) ? s.edges.find((e) => e.target === n.id && e.targetHandle === `loc:${f.name}`) : undefined;
      if (wire) {
        const k = keyOf(byId.get(wire.source)!);
        if (k) out[f.name] = `$${k}`;
      } else if (n.data.values[f.name] !== undefined) out[f.name] = n.data.values[f.name];
    }
    return out;
  };

  const used = new Set<string>();
  const achievements: Json[] = [];
  for (const create of s.nodes.filter((n) => n.data.kind === "CreateAchievement")) {
    used.add(create.id);
    const chain: AppNode[] = [];
    for (let id = flowNext(create.id); id && !used.has(id); id = flowNext(id)) {
      const n = byId.get(id);
      if (!n) break;
      used.add(id);
      chain.push(n);
    }

    const out: Json = fields(create);
    const adds = chain.filter((n) => n.data.kind === "AddConditions");
    const joins = chain.filter((n) => n.data.kind === "JoinType");
    const name = typeof out.achievementName === "string" ? out.achievementName : "(unnamed)";
    if (adds.length > 1) issues.push({ level: "error", message: `Achievement "${name}" has more than one Add Conditions node.` });
    if (joins.length > 1) issues.push({ level: "error", message: `Achievement "${name}" has more than one Join Type node.` });

    const joinType = joins[0]?.data.values.joinType;
    if (joinType !== undefined) out.joinType = joinType;

        if (adds[0]) {
      out.conditions = s.edges
        .filter((e) => e.target === adds[0].id && e.targetHandle === "cond-in")
        .map((e) => {
          const c = byId.get(e.source)!;
          used.add(c.id);
          return { type: c.data.kind, ...fields(c), ...c.data.extra, _editor: { id: c.id, ...xy(c) } };
        });
    }

    const actions = chain
      .filter((n) => n.data.kind === "RunCommand" || n.data.kind === "CallPapyrus")
      .map((n) => ({ type: n.data.kind === "RunCommand" ? "command" : "papyrus", ...fields(n), ...n.data.extra }));
    if (actions.length) out.onUnlock = actions;

    // Unknown keys last; an actions list from the chain wins over a placeholder `onUnlock: []` kept in extra.
    for (const [k, v] of Object.entries(create.data.extra ?? {})) if (!(k in out)) out[k] = v;
    out._editor = { id: create.id, ...xy(create), chain: chain.map(xy) };
    achievements.push(out);
  }

  // Anything not reached from an achievement would vanish on save: say so.
  for (const n of s.nodes) {
    if (used.has(n.id) || n.data.kind === "LocalizedText") continue;
    issues.push({ level: "warning", message: `${registry[n.data.kind].title} is not connected to an achievement and will not be saved.` });
  }
  for (const n of keyNodes) {
    if (!s.edges.some((e) => e.source === n.id)) issues.push({ level: "warning", message: `Localized Text "${keyOf(n)}" is not used by any field.` });
  }

  const keys: Record<string, { x: number; y: number }> = {};
  for (const n of keyNodes) if (keyOf(n)) keys[keyOf(n)] = xy(n);

  const json: Json = { ...s.group, ...s.groupExtra, achievements, _editor: { schemaVersion: SCHEMA_VERSION, ...(keyNodes.length ? { keys } : {}) } };

  const parsed = GroupSchema.safeParse(json);
  if (!parsed.success)
    for (const i of parsed.error.issues) {
      const [, idx, ...rest] = i.path;
      const a = typeof idx === "number" ? achievements[idx] : undefined;
      const where = a ? `Achievement "${String(a.achievementName ?? "(unnamed)")}": ` : "";
      issues.push({ level: "error", message: `${where}${(a ? rest : i.path).join(".")} ${i.message}`.trim() });
    }
  return { json, issues };
}
