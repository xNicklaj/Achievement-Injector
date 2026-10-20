import type { Edge } from "@xyflow/react";
import type { AppNode } from "../graph";
import { isLocalizable, registry, UNKNOWN_CONDITION, type NodeDef } from "../registry";
import { compareVersions, SCHEMA_VERSION, TARGET_VERSION } from "../schema";
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
export const W = 288;
export const GAP = 110;
export const COL = W + GAP;
export const estimateHeight = (def: NodeDef, values: Json = {}) => {
  const required = def.fields.filter((f) => !f.optional).length;
  // Mirrors GraphNode: with no required field every field shows. Otherwise optional ones fold into one summary row,
  // unless one is already set, which opens them all.
  const open = def.fields.some((f) => f.optional && values[f.name] !== undefined);
  const rows = required === 0 || open ? def.fields.length + (required === 0 ? 0 : 1) : required + 1;
  // Plus the condition's On Unlock row, or an unknown condition's notice.
  return 40 + (def.condIn ? 26 : 0) + (def.category === "condition" ? 26 : 0) + (def.kind === UNKNOWN_CONDITION ? 26 : 0) + rows * 26 + (def.kind === "LocalizedText" ? 26 : 0);
};

const FLOW_KIND = { command: "RunCommand", papyrus: "CallPapyrus" } as const;

const actionSpec = (list: Json[]) =>
  list.map((r) => {
    const kind = FLOW_KIND[r.type as keyof typeof FLOW_KIND];
    return { kind, ...split(r, registry[kind], ["type"]) };
  });

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
  // A file written for a newer mod (or by a newer editor) may hold things this editor would damage: do not open it.
  const stamp = isObj(raw._editor) ? raw._editor : {};
  if (typeof stamp.modVersion === "string" && compareVersions(stamp.modVersion, TARGET_VERSION) > 0)
    throw new ImportError(`This file needs Achievement Injector ${stamp.modVersion} or newer; this editor supports up to ${TARGET_VERSION}. Update the editor to open it.`);
  if (typeof stamp.schemaVersion === "number" && stamp.schemaVersion > SCHEMA_VERSION)
    throw new ImportError("This file was saved by a newer version of the editor. Update the editor to open it.");

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

  // Refuse unknown actions up front: the DLL would skip them, but dropping them silently here would lose data.
  const unknown: string[] = [];
  const badAction = (r: unknown, where: string) => {
    if (!isObj(r) || !(typeof r.type === "string" && Object.hasOwn(FLOW_KIND, r.type))) unknown.push(`onUnlock ${isObj(r) ? String(r.type) : "entry"} (${where})`);
  };
  raw.achievements.forEach((a, i) => {
    if (!isObj(a)) throw new ImportError(`Achievement #${i + 1} is not an object.`);
    if ("conditions" in a && !Array.isArray(a.conditions)) throw new ImportError(`Achievement #${i + 1}: "conditions" must be an array.`);
    if ("onUnlock" in a && !Array.isArray(a.onUnlock)) throw new ImportError(`Achievement #${i + 1}: "onUnlock" must be an array.`);
    for (const c of (a.conditions as unknown[]) ?? []) {
      if (!isObj(c)) throw new ImportError(`Achievement #${i + 1}: a condition is not an object.`);
      // An unknown condition type is kept as a flagged node; it only has to be an object with a type.
      if (typeof c.type !== "string") throw new ImportError(`Achievement #${i + 1}: a condition has no "type".`);
      if ("onUnlock" in c && !Array.isArray(c.onUnlock)) throw new ImportError(`Achievement #${i + 1}: a condition's "onUnlock" must be an array.`);
      for (const r of (c.onUnlock as unknown[]) ?? []) badAction(r, `${c.type} in achievement #${i + 1}`);
    }
    for (const r of (a.onUnlock as unknown[]) ?? []) badAction(r, `achievement #${i + 1}`);
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
    chainSpec.push(...actionSpec(actions));

    // Positions: saved `_editor` when present, otherwise a row layout per achievement band.
    const saved = Array.isArray(ed.chain) && ed.chain.length === chainSpec.length && ed.chain.every((p) => isObj(p) && num(p.x) && num(p.y)) ? (ed.chain as { x: number; y: number }[]) : null;
    const condHeights = conds.map((c) => estimateHeight(registry[c.type as string]?.category === "condition" ? registry[c.type as string] : registry[UNKNOWN_CONDITION], c) + 20);
    const bandH = Math.max(estimateHeight(registry.CreateAchievement, a), condHeights.reduce((s, h) => s + h, 0));
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
      const known = registry[c.type as string]?.category === "condition";
      const def = known ? registry[c.type as string] : registry[UNKNOWN_CONDITION];
      // An unknown type keeps every key (its `type` included) in `extra`, so it is written back unchanged.
      const cs = split(c, def, known ? ["type", "_editor", "onUnlock"] : ["_editor", "onUnlock"]);
      const cEd = isObj(c._editor) ? c._editor : {};
      const pos = num(cEd.x) && num(cEd.y) ? { x: cEd.x, y: cEd.y } : { x: COL, y };
      y += condHeights[j];
      const cn = add(def.kind, cs.values, cs.extra, pos, cEd.id);
      edges.push(mkEdge(cn.id, "cond-out", addNode!.id, "cond-in"));
      localize(cn);

      // The condition's own `onUnlock` is a chain of action nodes hanging off its flow pin, placed past the achievement's chain.
      const list = (Array.isArray(c.onUnlock) ? c.onUnlock : []) as Json[];
      if (Array.isArray(c.onUnlock) && !list.length) cn.data.extra = { ...cn.data.extra, onUnlock: [] };
      const spec = actionSpec(list);
      const savedChain = Array.isArray(cEd.chain) && cEd.chain.length === spec.length && cEd.chain.every((p) => isObj(p) && num(p.x) && num(p.y)) ? (cEd.chain as { x: number; y: number }[]) : null;
      let from = cn;
      spec.forEach((sp, k) => {
        const an = add(sp.kind, sp.values, sp.extra, savedChain ? savedChain[k] : { x: chainX(chainSpec.length) + k * COL, y: pos.y });
        edges.push(mkEdge(from.id, "flow-out", an.id, "flow-in"));
        from = an;
      });
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
