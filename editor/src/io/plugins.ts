import { create } from "zustand";
import { registry } from "../registry";
import type { AppNode } from "../graph";
import type { Issue } from "./exportGroup";

/** What the editor keeps of one record a plugin defines: enough to name a FormID, not the record body. */
export type PluginRecord = { type: string; editorId?: string; name?: string };
export type Plugin = {
  file: string;
  light: boolean;
  /** Names are string-table ids (`.STRINGS` files), so `name` stays empty. */
  localized: boolean;
  /** Keyed by the local id (`FormID & 0xFFFFFF`, or `& 0xFFF` for a light plugin): what a config's `formID` holds. */
  records: Map<number, PluginRecord>;
};

const latin = new TextDecoder("windows-1252");
const COMPRESSED = 0x40000;

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** EditorID and, when the plugin is not localized, the display name: the first of each in a record's subrecords. */
function names(b: Uint8Array, localized: boolean): { editorId?: string; name?: string } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: { editorId?: string; name?: string } = {};
  const text = (p: number, n: number) => latin.decode(b.subarray(p, p + Math.max(0, n - 1)));
  for (let p = 0; p + 6 <= b.length; ) {
    const sig = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    const size = dv.getUint16(p + 4, true);
    if (sig === "XXXX") break; // shortcut: an oversized subrecord ends the scan, only matters for records with no name before it
    if (sig === "EDID") out.editorId = text(p + 6, size);
    else if (sig === "FULL" && !localized) out.name = text(p + 6, size);
    if (out.editorId !== undefined && (out.name !== undefined || localized)) break;
    p += 6 + size;
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
      records.set(id & mask, { type, ...names(body, localized) });
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

/** FormIDs that are not in their loaded plugin, or point at the wrong kind of record. Fields of plugins that are not loaded are not checked. */
export function formIssues(nodes: AppNode[], groupPlugin: string | undefined, plugins: Plugin[]): Issue[] {
  const issues: Issue[] = [];
  for (const n of nodes) {
    const file = (typeof n.data.values.pluginOverride === "string" && n.data.values.pluginOverride) || groupPlugin;
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
  return issues;
}
