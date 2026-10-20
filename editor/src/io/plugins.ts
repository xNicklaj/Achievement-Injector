import { create } from "zustand";
import { registry } from "../registry";
import type { FieldInfo } from "../schema";
import { pluginOf, type AppNode } from "../graph";
import type { Edge } from "@xyflow/react";
import type { Issue } from "./exportGroup";

/** A quest stage or objective: its number and, when the plugin is not localized, its log or display text. */
export type Step = { index: number; text?: string };
/** A Papyrus script attached to a record, with its properties (`type` 3 is Int). */
export type Script = { name: string; props: { name: string; type: number }[] };
/** What the editor keeps of one record a plugin defines: enough to name a FormID, not the record body. */
export type PluginRecord = { type: string; editorId?: string; name?: string; stages?: Step[]; objectives?: Step[]; scripts?: Script[] };
export type Plugin = {
  file: string;
  light: boolean;
  /** Names are string-table ids (`.STRINGS` files), so `name` and step text stay empty. */
  localized: boolean;
  /** Keyed by the local id (`FormID & 0xFFFFFF`, or `& 0xFFF` for a light plugin): what a config's `formID` holds. */
  records: Map<number, PluginRecord>;
};

const latin = new TextDecoder("windows-1252");
const COMPRESSED = 0x40000;
const INT = 3;

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** The VMAD subrecord: scripts and their property names. Stops at a property type it cannot skip, keeping what it read. */
function vmad(b: Uint8Array): Script[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Script[] = [];
  let p = 0;
  const u16 = () => ((p += 2), dv.getUint16(p - 2, true));
  const u32 = () => ((p += 4), dv.getUint32(p - 4, true));
  const str = () => {
    const n = u16();
    p += n;
    return latin.decode(b.subarray(p - n, p));
  };
  try {
    const version = u16();
    p += 2; // object format; both layouts are 8 bytes
    for (let n = u16(); n > 0; n--) {
      const script: Script = { name: str(), props: [] };
      out.push(script);
      if (version >= 4) p += 1;
      for (let m = u16(); m > 0; m--) {
        const name = str();
        const type = b[p++];
        if (version >= 4) p += 1;
        script.props.push({ name, type });
        if (type === 1) p += 8;
        else if (type === 2) str();
        else if (type === 3 || type === 4) p += 4;
        else if (type === 5) p += 1;
        else if (type >= 11 && type <= 15) {
          const count = u32();
          if (type === 11) p += 8 * count;
          else if (type === 12) for (let i = 0; i < count; i++) str();
          else p += (type === 15 ? 1 : 4) * count;
        } else return out; // shortcut: struct and other newer property types are not skipped, so later scripts on that record are lost
      }
    }
  } catch {
    // truncated data: keep what was read
  }
  return out;
}

/** What a record's subrecords say that the editor shows: EditorID, name, scripts, and for quests the stages and objectives. */
function scan(b: Uint8Array, type: string, localized: boolean): Omit<PluginRecord, "type"> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Omit<PluginRecord, "type"> = {};
  const text = (p: number, n: number) => latin.decode(b.subarray(p, p + Math.max(0, n - 1)));
  let stage: Step | undefined;
  let objective: Step | undefined;
  let big = 0; // an XXXX subrecord gives the size of the next one
  for (let p = 0; p + 6 <= b.length; ) {
    const sig = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    const size = big || dv.getUint16(p + 4, true);
    const d = p + 6;
    big = 0;
    if (sig === "XXXX") big = dv.getUint32(d, true);
    else if (sig === "EDID") out.editorId = text(d, size);
    else if (sig === "FULL" && !localized && out.name === undefined) out.name = text(d, size);
    else if (sig === "VMAD") out.scripts = vmad(b.subarray(d, d + size));
    else if (type === "QUST") {
      if (sig === "INDX") ((stage = { index: dv.getUint16(d, true) }), (out.stages ??= []).push(stage), (objective = undefined));
      else if (sig === "QOBJ") ((objective = { index: dv.getUint16(d, true) }), (out.objectives ??= []).push(objective), (stage = undefined));
      else if (sig === "CNAM" && stage && !localized && stage.text === undefined) stage.text = text(d, size);
      else if (sig === "NNAM" && objective && !localized && objective.text === undefined) objective.text = text(d, size);
    }
    p = d + size;
  }
  return out;
}

/** Read the records a plugin defines (not the ones it overrides: a config's `formID` only reaches those). */
export async function parsePlugin(buf: ArrayBuffer, file: string): Promise<Plugin> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  const sig = (o: number) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (u8.length < 24 || sig(0) !== "TES4") throw new Error(`${file} is not a Skyrim plugin (no TES4 header).`);

  const headerSize = dv.getUint32(4, true);
  const flags = dv.getUint32(8, true);
  let masters = 0;
  for (let p = 24; p + 6 <= 24 + headerSize; p += 6 + dv.getUint16(p + 4, true)) if (sig(p) === "MAST") masters++;
  const light = (flags & 0x200) !== 0;
  const localized = (flags & 0x80) !== 0;
  const mask = light ? 0xfff : 0xffffff;
  const records = new Map<number, PluginRecord>();

  let count = 0;
  for (let o = 24 + headerSize; o + 24 <= u8.length; ) {
    const type = sig(o);
    // A group header is followed directly by its contents, so a flat walk visits every record.
    if (type === "GRUP") {
      o += 24;
      continue;
    }
    const size = dv.getUint32(o + 4, true);
    const id = dv.getUint32(o + 12, true);
    if (id >>> 24 === masters) {
      let body: Uint8Array = u8.subarray(o + 24, o + 24 + size);
      if (dv.getUint32(o + 8, true) & COMPRESSED) body = await inflate(body.subarray(4));
      records.set(id & mask, { type, ...scan(body, type, localized) });
    }
    o += 24 + size;
    // Keep the page responsive while a big master loads.
    if (++count % 20000 === 0) await new Promise((r) => setTimeout(r));
  }
  return { file, light, localized, records };
}

type Plugins = { plugins: Plugin[]; add: (p: Plugin) => void; remove: (file: string) => void };

/** Loaded plugins. Not persisted: they are big, and the files stay on the user's disk. */
export const usePlugins = create<Plugins>((set) => ({
  plugins: [],
  add: (p) => set((s) => ({ plugins: [...s.plugins.filter((x) => x.file.toLowerCase() !== p.file.toLowerCase()), p] })),
  remove: (file) => set((s) => ({ plugins: s.plugins.filter((x) => x.file !== file) })),
}));

const HEX = /^[0-9a-f]{1,8}$/i;

export const findPlugin = (plugins: Plugin[], file: string | undefined) => (file ? plugins.find((p) => p.file.toLowerCase() === file.toLowerCase()) : undefined);

/** The plugin named `file`, if loaded, and the record a config's local `formID` points at (undefined when absent). */
export function lookup(plugins: Plugin[], file: string | undefined, formId: string) {
  const plugin = findPlugin(plugins, file);
  if (!plugin || !HEX.test(formId)) return undefined;
  return { plugin, record: plugin.records.get(parseInt(formId, 16)) };
}

/** Placed references; a `reference` field wants one of these, a `base` field wants anything else. */
const REFERENCES = new Set(["REFR", "ACHR", "PHZD", "PGRE", "PMIS", "PARW", "PBAR", "PBEA", "PCON", "PFLA"]);
/** Record type a condition's field must point at, where the DLL only makes sense for one. */
const EXPECTED: Record<string, Record<string, string>> = {
  QuestStageDone: { formID: "QUST" },
  QuestObjectiveDone: { formID: "QUST" },
  FactionRank: { formID: "FACT" },
  PlayerCrime: { factions: "FACT" },
  FirstEnterCell: { cellID: "CELL" },
  GlobalVariableState: { formID: "GLOB" },
  SpellLearned: { formID: "SPEL" },
  ShoutLearned: { formID: "SHOU" },
  HasPerk: { formID: "PERK" },
  HasPerks: { perks: "PERK" },
  MagicEffectApplied: { formID: "MGEF" },
  LocationCleared: { formID: "LCTN" },
  BaseActorDeath: { formID: "NPC_" },
};

export const expectedType = (kind: string, field: string) => EXPECTED[kind]?.[field];

/** Records of one plugin matching `term` (EditorID, name or FormID), of the type the field wants; the first `max` in file order. */
export function searchRecords(plugin: Plugin, term: string, formKind?: "base" | "reference", want?: string, max = 50) {
  const t = term.trim().toLowerCase();
  const out: { id: string; record: PluginRecord }[] = [];
  for (const [n, record] of plugin.records) {
    if (want ? record.type !== want : formKind && REFERENCES.has(record.type) !== (formKind === "reference")) continue;
    const id = n.toString(16).padStart(plugin.light ? 3 : 6, "0").toUpperCase();
    if (t && !id.toLowerCase().includes(t) && !record.editorId?.toLowerCase().includes(t) && !record.name?.toLowerCase().includes(t)) continue;
    out.push({ id, record });
    if (out.length >= max) break;
  }
  return out;
}

/** One entry in a field's search list. */
export type Choice = { value: string | number; tag?: string; text?: string };
/** `empty` is shown when nothing matches. */
export type Search = { label: string; run: (term: string) => Choice[]; empty?: string };

/** Fields that take an EditorID or name from a record type, searched across every loaded plugin. */
const TEXT_SOURCES: Record<string, Record<string, { type: string; prop: "editorId" | "name" }>> = {
  WorldspaceDiscovery: { worldspaceID: { type: "WRLD", prop: "editorId" } },
  LocationDiscovery: { worldspaceID: { type: "WRLD", prop: "editorId" } },
  BaseActorDeath: { editorID: { type: "NPC_", prop: "editorId" }, name: { type: "NPC_", prop: "name" } },
  BookRead: { bookID: { type: "BOOK", prop: "name" } },
};
/** Number fields that pick one of the stages or objectives of the quest in the same node's `formID`. */
const STEPS: Record<string, Record<string, "stages" | "objectives">> = {
  QuestStageDone: { stage: "stages" },
  QuestObjectiveDone: { objective: "objectives" },
};
const MAX_CHOICES = 50;
const has = (s: string | undefined, t: string) => s?.toLowerCase().includes(t);

/**
 * The search a field offers, or undefined when the plugins loaded cannot say anything about it.
 * `file` is the plugin the node's FormIDs belong to; `values` are the node's field values.
 */
export function searchFor(plugins: Plugin[], kind: string, f: FieldInfo, values: Record<string, unknown>, file: string | undefined): Search | undefined {
  const own = findPlugin(plugins, file);
  const formIdOf = () => (typeof values.formID === "string" ? lookup(plugins, file, values.formID)?.record : undefined);

  if (f.widget === "formId" || (f.widget === "list" && f.item === "formId")) {
    const want = EXPECTED[kind]?.[f.name];
    return own && { label: `Search ${want ?? "records"} by EditorID or name`, run: (t) => searchRecords(own, t, f.formKind, want, MAX_CHOICES).map((r) => ({ value: r.id, tag: r.record.type, text: [r.record.editorId, r.record.name].filter(Boolean).join(" · ") })) };
  }
  const src = TEXT_SOURCES[kind]?.[f.name];
  if (src && plugins.length)
    return {
      label: `Search ${src.type} ${src.prop === "name" ? "names" : "EditorIDs"}`,
      run: (t) => {
        const seen = new Set<string>();
        const out: Choice[] = [];
        for (const p of plugins)
          for (const r of p.records.values()) {
            const v = r[src.prop];
            if (r.type !== src.type || !v || seen.has(v) || !(has(v, t.trim().toLowerCase()) || !t.trim())) continue;
            seen.add(v);
            out.push({ value: v, tag: r.type, text: src.prop === "editorId" ? r.name : r.editorId });
            if (out.length >= MAX_CHOICES) return out;
          }
        return out;
      },
    };
  const steps = STEPS[kind]?.[f.name];
  if (steps) {
    const list = formIdOf()?.[steps];
    return list && { label: `Search ${steps} of the quest`, run: (t) => list.filter((s) => !t.trim() || String(s.index).includes(t.trim()) || has(s.text, t.trim().toLowerCase())).slice(0, MAX_CHOICES).map((s) => ({ value: s.index, text: s.text })) };
  }
  if (kind === "PapyrusVariable" && (f.name === "script" || f.name === "variable")) {
    const record = formIdOf();
    if (!record) return undefined;
    const scripts = record.scripts ?? [];
    // Only Int properties are listed: that is all the condition reads.
    return {
      label: f.name === "script" ? "Scripts attached to this form" : "Int properties of the script",
      empty: "This record has no scripts in the plugin. Scripts on its base object, or added in game, are not listed.",
      run: (t) => {
        const q = t.trim().toLowerCase();
        if (f.name === "script") return scripts.filter((s) => !q || has(s.name, q)).map((s) => ({ value: s.name, tag: "script" }));
        const name = typeof values.script === "string" ? values.script.toLowerCase() : "";
        const chosen = scripts.some((s) => s.name.toLowerCase() === name) ? scripts.filter((s) => s.name.toLowerCase() === name) : scripts;
        return chosen.flatMap((s) => s.props.filter((pr) => pr.type === INT && (!q || has(pr.name, q))).map((pr) => ({ value: pr.name, tag: "int", text: s.name })));
      },
    };
  }
  return undefined;
}

/** FormIDs that are not in their loaded plugin, or point at the wrong kind of record. Fields of plugins that are not loaded are not checked. */
export function formIssues(nodes: AppNode[], edges: Edge[], groupPlugin: string | undefined, plugins: Plugin[]): Issue[] {
  const issues: Issue[] = [];
  for (const n of nodes) {
    const file = pluginOf(nodes, edges, n, groupPlugin);
    for (const f of registry[n.data.kind]?.fields ?? []) {
      if (f.widget !== "formId" && f.item !== "formId") continue;
      const v = n.data.values[f.name];
      for (const id of Array.isArray(v) ? v : [v]) {
        if (typeof id !== "string") continue;
        const hit = lookup(plugins, file, id);
        if (!hit) continue;
        const want = EXPECTED[n.data.kind]?.[f.name];
        const got = hit.record?.type;
        const ref = got !== undefined && REFERENCES.has(got);
        const problem = !got
          ? `${id} is not defined by ${hit.plugin.file}`
          : want && got !== want
            ? `${id} is a ${got} (${hit.record?.editorId ?? "no EditorID"}), expected a ${want}`
            : f.formKind === "reference" && !ref
              ? `${id} is a ${got}, not a placed reference`
              : f.formKind === "base" && ref
                ? `${id} is a placed reference (${got}), expected a base form`
                : undefined;
        if (problem) issues.push({ level: got ? "warning" : "error", message: `${registry[n.data.kind].title}: ${f.name} ${problem}.`, nodeId: n.id, field: f.name, detail: `${f.name}: ${problem}` });
      }
    }
  }
  for (const n of nodes) {
    const file = pluginOf(nodes, edges, n, groupPlugin);
    const form = typeof n.data.values.formID === "string" ? lookup(plugins, file, n.data.values.formID)?.record : undefined;
    for (const [field, steps] of Object.entries(STEPS[n.data.kind] ?? {})) {
      const v = n.data.values[field];
      const list = form?.[steps];
      if (typeof v !== "number" || !list || list.some((s) => s.index === v)) continue;
      const problem = `${v} is not one of the quest's ${steps === "stages" ? "stages" : "objectives"} (${list.map((s) => s.index).join(", ")})`;
      issues.push({ level: "warning", message: `${registry[n.data.kind].title}: ${field} ${problem}.`, nodeId: n.id, field, detail: `${field}: ${problem}` });
    }
  }
  return issues;
}
