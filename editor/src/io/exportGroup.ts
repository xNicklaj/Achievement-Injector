import type { Edge } from "@xyflow/react";
import { incoming, outgoing } from "@nicklaj/knotwork";
import { achievementNames, behind, isGroupCondition, isInternalGroup, linkedText, type AppNode } from "../graph";
import { isAction, linkKind, registry, UNKNOWN_CONDITION } from "../registry";
import { BASELINE_VERSION, compareVersions, GroupSchema, LIVE_TYPES, SCHEMA_VERSION } from "../schema";
import type { GroupValues } from "../store";
import type { Json } from "./importGroup";
import { getText, type LocFile } from "./localization";
import { formIssues, type Plugin } from "./plugins";

/**
 * A problem found while building the file. `nodeId` and `field` say where it shows on the canvas;
 * `detail` is the short text for that node's tooltip (`message` is the full line for lists).
 * A missing required value is only a warning ("incomplete"), like the unfinished-condition count; everything else wrong is an error.
 */
export type Issue = { level: "error" | "warning"; message: string; nodeId?: string; field?: string; detail?: string };
export type ExportState = {
  nodes: AppNode[];
  edges: Edge[];
  group: GroupValues;
  groupExtra: Json;
  loc?: Record<string, LocFile>;
  fileName?: string | null;
  /** File names found in `Icons/<group>/`; null when they cannot be listed, so nothing is checked. */
  iconFiles?: string[] | null;
  pendingIcons?: Record<string, unknown>;
  /** Plugins loaded for FormID checks; fields of plugins that are not loaded are not checked. */
  plugins?: Plugin[];
};

/** The JSON without editor metadata, for reading. `_editor` is still written to the file. */
export const withoutEditor = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(withoutEditor) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "_editor").map(([k, x]) => [k, withoutEditor(x)])) : v;

const round = (n: number) => Math.round(n);
const xy = (n: AppNode) => ({ x: round(n.position.x), y: round(n.position.y) });

/** A condition as exported: its node, the nodes of the conditions inside it (Conditions Met) and of its On Unlock actions. */
type CondRef = { id: string; children: CondRef[]; actions: string[] };
const flat = (refs: CondRef[]): string[] => refs.flatMap((r) => [r.id, ...flat(r.children)]);

/** Where each part of an exported achievement came from, so schema errors can be pinned on nodes. */
type Refs = { create: string; add?: string; join?: string; conds: CondRef[]; actions: string[] };

/** The node and field a schema error at `path` (the part after `conditions`) belongs to. */
function pinCondition(r: Refs, path: PropertyKey[]): { nodeId?: string; field?: string } {
  let ref: CondRef | undefined;
  let p = path;
  while (p[0] === "conditions" && typeof p[1] === "number") {
    ref = (ref ? ref.children : r.conds)[p[1]];
    if (!ref) return {};
    p = p.slice(2);
  }
  if (!ref) return { nodeId: r.add ?? r.create };
  const [k0, k1, k2] = p;
  if (k0 === "onUnlock" && typeof k1 === "number") return { nodeId: ref.actions[k1], field: typeof k2 === "string" ? k2 : undefined };
  return { nodeId: ref.id, field: typeof k0 === "string" ? k0 : undefined };
}

/**
 * Graph -> JSON. Unset fields are omitted, unknown keys come back from `extra`, so a file imported and
 * exported untouched is identical apart from `_editor` (HANDOVER 3.3). Problems are returned, never thrown:
 * saving with errors is allowed behind a confirmation (3.8).
 */
export function exportGroup(s: ExportState): { json: Json; issues: Issue[] } {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], message: string, nodeId?: string, extra: Pick<Issue, "field" | "detail"> = {}) =>
    issues.push({ level, message, nodeId, ...extra });
  const byId = new Map(s.nodes.map((n) => [n.id, n]));
  const flowNext = (id: string) => outgoing(s.edges, id).find((e) => e.sourceHandle === "flow-out")?.target;
  const keyOf = (n: AppNode) => (typeof n.data.values.key === "string" ? n.data.values.key : "");

  // Two LocalizedText nodes with the same key are an error (HANDOVER 3.13).
  const keyNodes = s.nodes.filter((n) => n.data.kind === "LocalizedText");
  const seenKeys = new Set<string>();
  for (const n of keyNodes) {
    const k = keyOf(n);
    if (!k) add("error", "A Localized Text node has no key.", n.id, { field: "key", detail: "key: set a key" });
    else if (seenKeys.has(k)) add("error", `Localized Text key "${k}" is used by more than one node.`, n.id, { field: "key", detail: "key: another node uses this key" });
    seenKeys.add(k);
  }

  // A used key without text in some language falls back to English, then to the raw `$key` in game (LocalizationManager).
  const loc = s.loc ?? {};
  const langs = Object.keys(loc).sort();
  const usedKeys = keyNodes.filter((n) => keyOf(n) && outgoing(s.edges, n.id).length > 0);
  if (usedKeys.length && !langs.length)
    add("warning", "No languages are set up, so localized fields show their raw $key in game. Add one on Group Properties.");
  // English is the fallback for every other language, so keys without it show raw `$key` text to those players.
  if (usedKeys.length && langs.length && !loc.EN)
    add("warning", "There is no English (EN) file. English is the fallback for languages without a translation.");
  for (const n of usedKeys) {
    const missing = langs.filter((l) => !getText(loc[l], keyOf(n)));
    if (missing.length) add("warning", `Localized Text "${keyOf(n)}" has no translation for ${missing.join(", ")}.`, n.id, { detail: `No translation for ${missing.join(", ")}.` });
  }

  // The group name is a field like any other: a `$key` there needs translations too.
  const groupName = typeof s.group.groupName === "string" ? s.group.groupName : "";
  if (groupName.length > 1 && groupName.startsWith("$")) {
    const missing = langs.filter((l) => !getText(loc[l], groupName.slice(1)));
    if (!langs.length) add("warning", `The group name ${groupName} is a key, but no languages are set up, so it shows as raw text in game.`);
    else if (missing.length) add("warning", `The group name ${groupName} has no translation for ${missing.join(", ")}.`);
  }

  // `AchievementUnlocked` inside this group must name an achievement that exists; one in another group cannot be checked (HANDOVER 3.1).
  const names = new Set(achievementNames(s.nodes, s.edges, loc));
  for (const n of s.nodes) {
    const v = n.data.values;
    if (n.data.kind !== "AchievementUnlocked" || typeof v.achievement !== "string" || !v.achievement) continue;
    if (isInternalGroup(v.group, s.fileName) && !names.has(v.achievement))
      add("warning", `AchievementUnlocked refers to "${v.achievement}", which is not an achievement in this group.`, n.id, { field: "achievement", detail: `achievement: no achievement named "${v.achievement}" in this group` });
  }

  if (s.plugins?.length) issues.push(...formIssues(s.nodes, s.edges, typeof s.group.plugin === "string" ? s.group.plugin : undefined, s.plugins));

  // An icon that is not in Icons/<group>/ is skipped by the DLL with a log warning. Only checkable when the folder can be listed.
  if (s.iconFiles && s.fileName) {
    const folder = `Icons/${s.fileName.replace(/\.json$/i, "")}/`;
    const have = new Set([...s.iconFiles, ...Object.keys(s.pendingIcons ?? {}).filter((p) => p.startsWith(folder)).map((p) => p.slice(folder.length))].map((n) => n.toLowerCase()));
    for (const n of s.nodes) {
      const own = n.data.kind === "CreateAchievement" ? "icon" : n.data.kind === "Icon" ? "file" : undefined;
      const icon = own ? n.data.values[own] : undefined;
      if (own && typeof icon === "string" && icon && !have.has(icon.toLowerCase()))
        add("warning", `Icon "${icon}" is not in ${folder}.`, n.id, { field: own, detail: `${own}: "${icon}" is not in ${folder}` });
    }
  }
  for (const n of s.nodes.filter((x) => x.data.kind === "Icon")) {
    if (!n.data.values.file) add("warning", "An Icon node has no file.", n.id, { field: "file", detail: "file is required" });
    if (!outgoing(s.edges, n.id).length) add("warning", "An Icon node is not used by any achievement.", n.id, { detail: "Not used by any achievement" });
  }

  for (const n of s.nodes.filter((x) => x.data.kind === "PluginOverride")) {
    if (!n.data.values.plugin) add("warning", "A Plugin Override node has no plugin.", n.id, { field: "plugin", detail: "plugin is required" });
    if (!outgoing(s.edges, n.id).length) add("warning", "A Plugin Override node is not used by any achievement or condition.", n.id, { detail: "Not used by any achievement or condition" });
  }

  /** Field values of one node: wired fields take what their wire stands for (`$key`, achievement name, icon file), then its unknown keys. */
  const fields = (n: AppNode): Json => {
    const out: Json = {};
    const def = registry[n.data.kind];
    for (const f of def.fields) {
      const kind = linkKind(def, f);
      const wire = kind ? incoming(s.edges, n.id).find((e) => e.targetHandle === `${kind}:${f.name}`) : undefined;
      if (wire && kind) {
        const source = byId.get(wire.source)!;
        const value = kind === "loc" ? (keyOf(source) ? `$${keyOf(source)}` : undefined) : linkedText(s.nodes, s.edges, loc, source, kind);
        if (value) out[f.name] = value;
      } else if (n.data.values[f.name] !== undefined) out[f.name] = n.data.values[f.name];
    }
    return out;
  };

  /** Nodes reached by following flow wires from `id`, each claimed once. */
  const used = new Set<string>();
  const chainFrom = (id: string) => {
    const out: AppNode[] = [];
    for (let next = flowNext(id); next && !used.has(next); next = flowNext(next)) {
      const n = byId.get(next);
      if (!n) break;
      used.add(next);
      out.push(n);
    }
    return out;
  };
  const actionJson = (n: AppNode) => ({ type: n.data.kind === "RunCommand" ? "command" : "papyrus", ...fields(n), ...n.data.extra });
  const unknownConds = new Set<string>();
  const achievements: Json[] = [];
  const refs: Refs[] = [];
  for (const create of s.nodes.filter((n) => n.data.kind === "CreateAchievement")) {
    used.add(create.id);
    const chain = chainFrom(create.id);

    const out: Json = fields(create);
    const adds = chain.filter((n) => n.data.kind === "AddConditions");
    const joins = chain.filter((n) => n.data.kind === "JoinType");
    const name = typeof out.achievementName === "string" ? out.achievementName : "(unnamed)";
    for (const extra of adds.slice(1)) add("error", `Achievement "${name}" has more than one Add Conditions node.`, extra.id, { detail: "Only one Add Conditions per achievement" });
    for (const extra of joins.slice(1)) add("error", `Achievement "${name}" has more than one Join Type node.`, extra.id, { detail: "Only one Join Type per achievement" });

    const joinType = joins[0]?.data.values.joinType;
    if (joinType !== undefined) out.joinType = joinType;

    let tree: CondRef[] = [];
    /** The conditions wired into `into` (Add Conditions, or the Conditions Met `inside`), in wire order. */
    const condList = (into: AppNode, inside?: AppNode): { json: Json[]; refs: CondRef[] } => {
      const json: Json[] = [];
      const refs: CondRef[] = [];
      for (const e of incoming(s.edges, into.id).filter((x) => x.targetHandle === "cond-in")) {
        const { root: c, mods } = behind(s.nodes, s.edges, e.source);
        for (const m of mods) used.add(m.id);
        if (!c) {
          for (const m of mods) add("warning", `${registry[m.data.kind].title} has no condition, so it will not be saved.`, m.id, { detail: "No condition connected: it will not be saved" });
          continue;
        }
        used.add(c.id);
        if (c.data.kind === UNKNOWN_CONDITION) {
          unknownConds.add(c.id);
          const type = String(c.data.extra?.type);
          add("error", `Achievement "${name}": "${type}" is not a condition type this editor knows.`, c.id, { detail: `Unknown condition "${type}": it is kept as it is, but may be from a newer mod version or a typo` });
        }
        if (mods.length && !LIVE_TYPES.has(c.data.kind))
          add("error", `${registry[c.data.kind].title} does not support ${mods[0].data.kind}.`, mods[0].id, { detail: `${registry[c.data.kind].title} does not support Live or Negate: the mod skips it` });
        // The mod skips the whole achievement when a Conditions Met holds a live or negated condition.
        else if (mods.length && inside)
          add("error", `Achievement "${name}": ${mods[0].data.kind} is not supported inside Conditions Met.`, mods[0].id, { detail: "Live and Negate are not supported inside Conditions Met: the mod skips the achievement" });
        // The mod accepts Negate alone, but this editor requires an explicit Live before it.
        const negate = mods.findIndex((m) => m.data.kind === "Negate");
        if (negate >= 0 && !mods.slice(0, negate).some((m) => m.data.kind === "Live"))
          add("error", `Achievement "${name}": a Negate node needs a Live node between its condition and it.`, mods[negate].id, { detail: "Needs a Live node between the condition and this node" });
        // The condition's own actions: the chain hanging off its flow pin.
        const acts = chainFrom(c.id).filter((n) => isAction(n.data.kind));
        const o: Json = { type: c.data.kind, ...fields(c), ...c.data.extra };
        let children: CondRef[] = [];
        if (isGroupCondition(c.data.kind)) {
          const inner = condList(c, c);
          o.conditions = inner.json;
          children = inner.refs;
        }
        for (const m of mods) o[m.data.kind.toLowerCase()] = true;
        if (acts.length) o.onUnlock = acts.map(actionJson);
        o._editor = { id: c.id, ...xy(c), ...(acts.length ? { chain: acts.map(xy) } : {}), ...(mods.length ? { mods: mods.map((m) => ({ kind: m.data.kind, id: m.id, ...xy(m) })) } : {}) };
        json.push(o);
        refs.push({ id: c.id, children, actions: acts.map((n) => n.id) });
      }
      return { json, refs };
    };
    if (adds[0]) {
      const list = condList(adds[0]);
      out.conditions = list.json;
      tree = list.refs;
      // The mod only evaluates live conditions when another condition fires, so an all-live achievement never unlocks.
      if (list.json.length && list.json.every((o) => o.live || o.negate))
        add("warning", `Achievement "${name}" has only live conditions, so it can never unlock.`, adds[0].id, { detail: "Only live conditions: it can never unlock. Add a condition that is not live" });
    }

    const actionNodes = chain.filter((n) => isAction(n.data.kind));
    const actions = actionNodes.map(actionJson);
    if (actions.length) out.onUnlock = actions;

    // Unknown keys last; an actions list from the chain wins over a placeholder `onUnlock: []` kept in extra.
    for (const [k, v] of Object.entries(create.data.extra ?? {})) if (!(k in out)) out[k] = v;
    out._editor = { id: create.id, ...xy(create), chain: chain.map(xy) };
    achievements.push(out);
    refs.push({ create: create.id, add: adds[0]?.id, join: joins[0]?.id, conds: tree, actions: actionNodes.map((n) => n.id) });
  }

  // Achievements that wait for each other, directly or through others, can never unlock.
  const creates = new Map(s.nodes.filter((n) => n.data.kind === "CreateAchievement").map((n) => [n.id, n]));
  const byName = new Map([...creates.values()].map((n) => [linkedText(s.nodes, s.edges, loc, n, "ach") ?? "", n.id]));
  const waits = new Map<string, Set<string>>();
  refs.forEach((r) => {
    for (const id of flat(r.conds)) {
      const c = byId.get(id)!;
      if (c.data.kind !== "AchievementUnlocked") continue;
      const wire = incoming(s.edges, id).find((e) => e.targetHandle === "ach:achievement");
      const target = wire ? wire.source : isInternalGroup(c.data.values.group, s.fileName) ? byName.get(String(c.data.values.achievement ?? "")) : undefined;
      if (target) waits.set(r.create, (waits.get(r.create) ?? new Set()).add(target));
    }
  });
  const reaches = (from: string, goal: string, seen = new Set<string>()): boolean =>
    [...(waits.get(from) ?? [])].some((t) => t === goal || (!seen.has(t) && (seen.add(t), reaches(t, goal, seen))));
  for (const id of waits.keys()) {
    if (!reaches(id, id)) continue;
    const name = linkedText(s.nodes, s.edges, loc, creates.get(id)!, "ach") ?? "(unnamed)";
    add("error", `Achievement "${name}" waits for itself through AchievementUnlocked conditions, so it can never unlock.`, id, { detail: "Waits for itself through AchievementUnlocked conditions: it can never unlock" });
  }

  // Anything not reached from an achievement would vanish on save: say so.
  for (const n of s.nodes) {
    if (used.has(n.id) || n.data.kind === "LocalizedText" || n.data.kind === "Icon" || n.data.kind === "PluginOverride") continue;
    const msg = `${registry[n.data.kind].title} is not connected to an achievement and will not be saved.`;
    add("warning", msg, n.id, { detail: "Not connected to an achievement: it will not be saved" });
  }
  for (const n of keyNodes) {
    if (!outgoing(s.edges, n.id).length) add("warning", `Localized Text "${keyOf(n)}" is not used by any field.`, n.id, { detail: "Not used by any field" });
  }

  const keys: Record<string, { x: number; y: number }> = {};
  for (const n of keyNodes) if (keyOf(n)) keys[keyOf(n)] = xy(n);

  // The oldest mod version that reads every field in the file; an older editor refuses to open anything newer than itself.
  let modVersion = BASELINE_VERSION;
  for (const id of used) {
    const n = byId.get(id)!;
    const since = registry[n.data.kind].since;
    if (since && compareVersions(since, modVersion) > 0) modVersion = since;
    for (const f of registry[n.data.kind].fields) if (n.data.values[f.name] !== undefined && f.since && compareVersions(f.since, modVersion) > 0) modVersion = f.since;
  }

  const icons: Record<string, { x: number; y: number }> = {};
  for (const n of s.nodes) if (n.data.kind === "Icon" && typeof n.data.values.file === "string" && n.data.values.file) icons[n.data.values.file] = xy(n);

  const plugins: Record<string, { x: number; y: number }> = {};
  for (const n of s.nodes) if (n.data.kind === "PluginOverride" && typeof n.data.values.plugin === "string" && n.data.values.plugin) plugins[n.data.values.plugin] = xy(n);

  const json: Json = { ...s.group, ...s.groupExtra, achievements, _editor: { schemaVersion: SCHEMA_VERSION, modVersion, ...(keyNodes.length ? { keys } : {}), ...(Object.keys(icons).length ? { icons } : {}), ...(Object.keys(plugins).length ? { plugins } : {}) } };

  const parsed = GroupSchema.safeParse(json);
  if (!parsed.success)
    for (const i of parsed.error.issues) {
      const [root, idx, a, b, c] = i.path;
      const r = root === "achievements" && typeof idx === "number" ? refs[idx] : undefined;
      let nodeId: string | undefined;
      let field: string | undefined;
      if (r) {
        if (a === "conditions") ({ nodeId, field } = pinCondition(r, i.path.slice(2)));
        else if (a === "onUnlock" && typeof b === "number") (nodeId = r.actions[b]), (field = typeof c === "string" ? c : undefined);
        else if (a === "joinType") (nodeId = r.join ?? r.create), (field = "joinType");
        else (nodeId = r.create), (field = typeof a === "string" ? a : undefined);
      }
      // An unknown condition type already has its own message; the schema's "invalid input" adds nothing.
      if (nodeId && unknownConds.has(nodeId)) continue;
      const name = field ?? String(r ? (a ?? "") : (root ?? ""));
      const missing = i.code === "invalid_type" && /received undefined/.test(i.message);
      const text = missing ? `${name} is required` : i.message;
      const where = r ? `Achievement "${String(achievements[idx as number].achievementName ?? "(unnamed)")}": ` : "";
      const path = (r ? i.path.slice(2) : i.path).join(".");
      add(missing ? "warning" : "error", `${where}${missing ? text : `${path} ${text}`}`.trim(), nodeId, { field, detail: missing || !field ? text : `${field}: ${text}` });
    }
  return { json, issues };
}
