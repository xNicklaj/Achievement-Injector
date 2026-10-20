import type { Edge } from "@xyflow/react";
import type { AppNode } from "../graph";
import { isLocalizable, registry, UNKNOWN_CONDITION, type NodeDef } from "../registry";
import { compareVersions, LIVE_TYPES, SCHEMA_VERSION, TARGET_VERSION } from "../schema";
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
  const listRows = def.fields.reduce((n, f) => n + (f.widget === "list" && Array.isArray(values[f.name]) ? (values[f.name] as unknown[]).length : 0), 0);
  return 48 + listRows * 36 + (def.condIn ? 32 : 0) + (def.category === "condition" ? 32 : 0) + (def.kind === UNKNOWN_CONDITION ? 32 : 0) + (def.kind === "Icon" ? 120 : 0) + rows * 36 + (def.kind === "LocalizedText" ? 36 : 0);
};

/** `live`/`negate` on a type that supports them become Live / Negate nodes; on any other type they stay as plain keys. */
const MODIFIER_KIND = { live: "Live", negate: "Negate" } as const;
const modifiersOf = (c: Json) =>
  (Object.keys(MODIFIER_KIND) as (keyof typeof MODIFIER_KIND)[]).filter((k) => typeof c.type === "string" && LIVE_TYPES.has(c.type) && c[k] === true);

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

  // An `icon` file name becomes one Icon node shared by every achievement that names it, wired to each.
  const iconNodes = new Map<string, AppNode>();
  const iconPos = isObj(editor.icons) ? editor.icons : {};
  const linkIcon = (node: AppNode) => {
    const file = node.data.values.icon;
    if (node.data.kind !== "CreateAchievement" || typeof file !== "string" || !file) return;
    let icon = iconNodes.get(file);
    if (!icon) {
      const at = iconPos[file];
      const p = isObj(at) && num(at.x) && num(at.y) ? { x: at.x, y: at.y } : { x: -COL, y: locY };
      locY += 230;
      icon = add("Icon", { file }, {}, p);
      iconNodes.set(file, icon);
    }
    delete node.data.values.icon;
    edges.push(mkEdge(icon.id, "icon-out", node.id, "icon:icon"));
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
  const owner = new Map<string, string>(); // condition node -> its achievement
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
    // Live / Negate nodes sit in columns between the conditions and Add Conditions.
    const modCols = Math.max(0, ...conds.map((c) => modifiersOf(c).length));
    const chainX = (i: number) => (hasConds ? COL * (2 + modCols) : COL) + i * COL;

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
      const flags = modifiersOf(c);
      for (const k of flags) delete cs.extra[k];
      const cn = add(def.kind, cs.values, cs.extra, pos, cEd.id);
      owner.set(cn.id, create.id);
      const savedMods = Array.isArray(cEd.mods) ? cEd.mods.filter(isObj) : [];
      let last = cn;
      flags.forEach((k, m) => {
        const sm = savedMods.find((x) => x.kind === MODIFIER_KIND[k] && num(x.x) && num(x.y));
        const mn = add(MODIFIER_KIND[k], {}, {}, sm ? { x: sm.x as number, y: sm.y as number } : { x: pos.x + (m + 1) * COL, y: pos.y }, sm?.id);
        edges.push(mkEdge(last.id, "cond-out", mn.id, "cond-in"));
        last = mn;
      });
      edges.push(mkEdge(last.id, "cond-out", addNode!.id, "cond-in"));
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
    linkIcon(create);
    bandY += bandH + 80;
  }

  // A reference to an achievement of this group by plain name becomes a wire to it. Names that are localized, ambiguous,
  // point into another group or name the condition's own achievement stay as typed text.
  const byName = new Map<string, AppNode[]>();
  for (const n of nodes) {
    const name = n.data.kind === "CreateAchievement" ? n.data.values.achievementName : undefined;
    if (typeof name === "string" && name) byName.set(name, [...(byName.get(name) ?? []), n]);
  }
  for (const n of nodes) {
    const { achievement, group } = n.data.values;
    if (n.data.kind !== "AchievementUnlocked" || typeof achievement !== "string" || (group !== undefined && group !== "")) continue;
    const hit = byName.get(achievement);
    if (hit?.length !== 1 || hit[0].id === owner.get(n.id)) continue;
    delete n.data.values.achievement;
    edges.push(mkEdge(hit[0].id, "ach-out", n.id, "ach:achievement"));
  }

  const group: GroupValues = {};
  for (const k of ["groupName", "plugin", "showInMenu"] as const) if (k in raw) (group as Json)[k] = raw[k];
  const groupExtra: Json = {};
  for (const [k, v] of Object.entries(raw)) if (!["groupName", "plugin", "showInMenu", "achievements", "_editor"].includes(k)) groupExtra[k] = v;

  return { nodes, edges, group, groupExtra };
}
