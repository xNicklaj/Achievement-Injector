import type { Edge } from "@xyflow/react";
import type { AppNode } from "../graph";
import { isLocalizable, registry, type NodeDef } from "../registry";
import type { GroupValues } from "../store";

export type Json = Record<string, unknown>;
export type Snapshot = { nodes: AppNode[]; edges: Edge[]; group: GroupValues; groupExtra: Json };

/** The file cannot be represented as a graph without losing data; nothing is imported. */
export class ImportError extends Error {}

export const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const edgeId = (source: string, sh: string, target: string, th: string) => `${source}:${sh}->${target}:${th}`;
export const mkEdge = (source: string, sh: string, target: string, th: string): Edge => ({
  id: edgeId(source, sh, target, th),
  source,
  sourceHandle: sh,
  target,
  targetHandle: th,
});

// Auto-layout for files without `_editor` positions. Heights are estimates; a "Tidy up" button can refine later.
const W = 288;
const GAP = 110;
const COL = W + GAP;
const estimateHeight = (def: NodeDef) => {
  const optional = def.fields.filter((f) => f.optional).length;
  return 40 + (def.condIn ? 26 : 0) + def.fields.filter((f) => !f.optional).length * 26 + (optional ? 22 : 0);
};

const FLOW_KIND = { command: "RunCommand", papyrus: "CallPapyrus" } as const;

/** Split a JSON object into widget values (fields the registry knows) and everything else. */
function split(obj: Json, def: NodeDef, skip: string[]) {
  const known = new Set(def.fields.map((f) => f.name));
  const values: Json = {};
  const extra: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (skip.includes(k)) continue;
    (known.has(k) ? values : extra)[k] = v;
  }
  return { values, extra };
}

export function importGroup(raw: unknown): Snapshot {
  if (!isObj(raw)) throw new ImportError("The file is not a JSON object.");
  if (!Array.isArray(raw.achievements)) throw new ImportError('"achievements" must be an array.');

  const nodes: AppNode[] = [];
  const edges: Edge[] = [];
  const ids = new Set<string>();
  const newId = (preferred: unknown) => {
    let id = typeof preferred === "string" && preferred && !ids.has(preferred) ? preferred : crypto.randomUUID();
    while (ids.has(id)) id = crypto.randomUUID();
    ids.add(id);
    return id;
  };

  const editor = isObj(raw._editor) ? raw._editor : {};
  const keyPos = isObj(editor.keys) ? editor.keys : {};
  const keyNodes = new Map<string, AppNode>();
  let locY = 0;

  const add = (kind: string, values: Json, extra: Json, pos: { x: number; y: number }, preferredId?: unknown) => {
    const node: AppNode = {
      id: newId(preferredId),
      type: "ae",
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
      data: { kind, values, ...(Object.keys(extra).length && { extra }) },
    };
    nodes.push(node);
    return node;
  };

  /** `$key` in a localizable field becomes one shared LocalizedText node wired to every use (HANDOVER 3.13). */
  const localize = (node: AppNode) => {
    for (const f of registry[node.data.kind].fields.filter(isLocalizable)) {
      const v = node.data.values[f.name];
      if (typeof v !== "string" || v.length < 2 || !v.startsWith("$")) continue;
      const key = v.slice(1);
      let kn = keyNodes.get(key);
      if (!kn) {
        const p = isObj(keyPos[key]) && num(keyPos[key].x) && num(keyPos[key].y) ? (keyPos[key] as { x: number; y: number }) : { x: -COL, y: locY };
        locY += 120;
        kn = add("LocalizedText", { key }, {}, p);
        keyNodes.set(key, kn);
      }
      delete node.data.values[f.name];
      edges.push(mkEdge(kn.id, "loc-out", node.id, `loc:${f.name}`));
    }
  };

  // Refuse unknown types up front: the DLL would skip them, but dropping them silently here would lose data.
  const unknown: string[] = [];
  raw.achievements.forEach((a, i) => {
    if (!isObj(a)) throw new ImportError(`Achievement #${i + 1} is not an object.`);
    if ("conditions" in a && !Array.isArray(a.conditions)) throw new ImportError(`Achievement #${i + 1}: "conditions" must be an array.`);
    if ("onUnlock" in a && !Array.isArray(a.onUnlock)) throw new ImportError(`Achievement #${i + 1}: "onUnlock" must be an array.`);
    for (const c of (a.conditions as unknown[]) ?? []) {
      if (!isObj(c)) throw new ImportError(`Achievement #${i + 1}: a condition is not an object.`);
      if (typeof c.type !== "string" || registry[c.type]?.category !== "condition") unknown.push(`${String(c.type)} (achievement #${i + 1})`);
    }
    for (const r of (a.onUnlock as unknown[]) ?? [])
      if (!isObj(r) || !(typeof r.type === "string" && Object.hasOwn(FLOW_KIND, r.type))) unknown.push(`onUnlock ${isObj(r) ? String(r.type) : "entry"} (achievement #${i + 1})`);
  });
  if (unknown.length) throw new ImportError(`Unsupported entries: ${unknown.join(", ")}.`);

  let bandY = 0;
  for (const a of raw.achievements as Json[]) {
    const ed = isObj(a._editor) ? a._editor : {};
    const hasPos = num(ed.x) && num(ed.y);
    const conds = (Array.isArray(a.conditions) ? a.conditions : []) as Json[];
    const hasConds = Array.isArray(a.conditions);
    const actions = (Array.isArray(a.onUnlock) ? a.onUnlock : []) as Json[];

    const created = split(a, registry.CreateAchievement, ["joinType", "conditions", "onUnlock", "_editor"]);
    // An empty onUnlock has no nodes to carry it, so it rides along as an unknown key.
    if (Array.isArray(a.onUnlock) && !actions.length) created.extra.onUnlock = [];

    const chainSpec: { kind: string; values: Json; extra: Json }[] = [];
    if (hasConds) chainSpec.push({ kind: "AddConditions", values: {}, extra: {} });
    if ("joinType" in a) chainSpec.push({ kind: "JoinType", values: { joinType: a.joinType }, extra: {} });
    for (const r of actions) {
      const kind = FLOW_KIND[r.type as keyof typeof FLOW_KIND];
      chainSpec.push({ kind, ...split(r, registry[kind], ["type"]) });
    }

    // Positions: saved `_editor` when present, otherwise a row layout per achievement band.
    const saved = Array.isArray(ed.chain) && ed.chain.length === chainSpec.length && ed.chain.every((p) => isObj(p) && num(p.x) && num(p.y)) ? (ed.chain as { x: number; y: number }[]) : null;
    const condHeights = conds.map((c) => estimateHeight(registry[c.type as string]) + 20);
    const bandH = Math.max(estimateHeight(registry.CreateAchievement), condHeights.reduce((s, h) => s + h, 0));
    const chainX = (i: number) => (hasConds ? COL * 2 : COL) + i * COL;

    const create = add("CreateAchievement", created.values, created.extra, hasPos ? { x: ed.x as number, y: ed.y as number } : { x: 0, y: bandY }, ed.id);
    const chain = chainSpec.map((s, i) => add(s.kind, s.values, s.extra, saved ? saved[i] : { x: chainX(i), y: bandY }));
    const addNode = chain.find((n) => n.data.kind === "AddConditions");

    let prev = create;
    for (const n of chain) {
      edges.push(mkEdge(prev.id, "flow-out", n.id, "flow-in"));
      prev = n;
    }

    let y = bandY;
    conds.forEach((c, j) => {
      const cs = split(c, registry[c.type as string], ["type", "_editor"]);
      const cEd = isObj(c._editor) ? c._editor : {};
      const pos = num(cEd.x) && num(cEd.y) ? { x: cEd.x, y: cEd.y } : { x: COL, y };
      y += condHeights[j];
      const cn = add(c.type as string, cs.values, cs.extra, pos, cEd.id);
      edges.push(mkEdge(cn.id, "cond-out", addNode!.id, "cond-in"));
      localize(cn);
    });
    localize(create);
    bandY += bandH + 80;
  }

  const group: GroupValues = {};
  for (const k of ["groupName", "plugin", "showInMenu"] as const) if (k in raw) (group as Json)[k] = raw[k];
  const groupExtra: Json = {};
  for (const [k, v] of Object.entries(raw)) if (!["groupName", "plugin", "showInMenu", "achievements", "_editor"].includes(k)) groupExtra[k] = v;

  return { nodes, edges, group, groupExtra };
}
