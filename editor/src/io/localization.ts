// Localizations/<Group>_<LANG>.txt, read by src/LocalizationManager.cpp: `$key<TAB>value` lines.
// The DLL ignores every other line, skips repeated tabs after the key, and a BOM would hide the first key,
// so files are kept as lines (unknown lines and untouched entries are written back byte for byte) and never get a BOM.

export type LocLine = { raw: string; key?: string; value?: string };
export type LocFile = { fileName: string; lines: LocLine[]; eol: string; finalEol: boolean };

function parseLine(raw: string): LocLine {
  const tab = raw.indexOf("\t");
  if (tab === -1 || raw[0] !== "$") return { raw };
  let v = tab + 1;
  while (raw[v] === "\t") v++;
  return { raw, key: raw.slice(1, tab), value: raw.slice(v) };
}

export function parseLoc(fileName: string, text: string): LocFile {
  const t = text.replace(/^﻿/, "");
  const finalEol = t.endsWith("\n");
  const parts = t === "" ? [] : t.split(/\r?\n/);
  if (finalEol) parts.pop();
  return { fileName, lines: parts.map(parseLine), eol: t.includes("\r\n") ? "\r\n" : "\n", finalEol };
}

export const newLocFile = (fileName: string): LocFile => ({ fileName, lines: [], eol: "\r\n", finalEol: true });

export const serializeLoc = (f: LocFile) => f.lines.map((l) => l.raw).join(f.eol) + (f.finalEol && f.lines.length ? f.eol : "");

/** Same as the DLL: the last line for a key wins. Keys are stored without the leading `$`. */
export function getText(f: LocFile | undefined, key: string): string | undefined {
  if (!f) return undefined;
  for (let i = f.lines.length - 1; i >= 0; i--) if (f.lines[i].key === key) return f.lines[i].value;
  return undefined;
}

export const locKeys = (f: LocFile) => new Set(f.lines.flatMap((l) => (l.key !== undefined ? [l.key] : [])));

/** A value cannot span lines, and leading tabs would be skipped by the DLL. */
const clean = (v: string) => v.replace(/[\r\n]+/g, " ").replace(/^\t+/, "");
const entry = (key: string, value: string): LocLine => ({ raw: `$${key}\t${value}`, key, value });

/** Set a translation. Never creates an entry for an empty value, and never deletes one (orphans are kept). */
export function setText(f: LocFile, key: string, value: string): LocFile {
  const v = clean(value);
  const cur = getText(f, key);
  if (cur === v || (cur === undefined && v === "")) return f;
  if (cur === undefined) return { ...f, lines: [...f.lines, entry(key, v)] };
  const at = f.lines.findLastIndex((l) => l.key === key);
  return { ...f, lines: f.lines.map((l, i) => (i === at ? entry(key, v) : l)) };
}

/** Move a key's translations to a new name, unless the new name already has some. */
export function renameKey(f: LocFile, from: string, to: string): LocFile {
  if (!from || !to || from === to || locKeys(f).has(to) || !locKeys(f).has(from)) return f;
  return { ...f, lines: f.lines.map((l) => (l.key === from ? entry(to, l.value ?? "") : l)) };
}

export type LocRow = { key: string; used: boolean };

/** Locales in display order: English (the fallback) first, then alphabetical. */
export const sortedLocales = (loc: Record<string, LocFile>) => Object.keys(loc).sort((a, b) => (a === "EN" ? -1 : b === "EN" ? 1 : a.localeCompare(b)));

/** Every key in the language files, in the order authors wrote them (first language first), then keys only a node uses. */
export function locRows(loc: Record<string, LocFile>, used: ReadonlySet<string>): LocRow[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const l of sortedLocales(loc)) for (const k of locKeys(loc[l])) if (!seen.has(k)) (seen.add(k), keys.push(k));
  for (const k of [...used].sort()) if (!seen.has(k)) (seen.add(k), keys.push(k));
  return keys.map((key) => ({ key, used: used.has(key) }));
}

/** Problems worth a warning sign next to a key in the table. Empty when the key is fine. */
export function keyWarnings(loc: Record<string, LocFile>, key: string, used: boolean): string[] {
  const langs = sortedLocales(loc);
  const out: string[] = [];
  if (!used) out.push("Not used by any Localized Text node. It is kept when you save.");
  const missing = langs.filter((l) => !getText(loc[l], key));
  if (missing.length) out.push(`No translation for ${missing.join(", ")}.`);
  const twice = langs.filter((l) => loc[l].lines.filter((x) => x.key === key).length > 1);
  if (twice.length) out.push(`Defined more than once in ${twice.map((l) => loc[l].fileName).join(", ")}; the last entry is used.`);
  return out;
}

/** Keys present in any language file that no LocalizedText node uses. */
export function orphanKeys(loc: Record<string, LocFile>, used: Set<string>) {
  const all = new Set(Object.values(loc).flatMap((f) => [...locKeys(f)]));
  return [...all].filter((k) => !used.has(k)).sort();
}

/** Locale files that must be written: changed since they were read or saved, and never an empty new one. */
export function changedLocFiles(loc: Record<string, LocFile>, original: Record<string, string>) {
  return Object.entries(loc).flatMap(([locale, f]) => {
    const text = serializeLoc(f);
    return text !== (original[locale] ?? "") && f.lines.length ? [{ name: f.fileName, text, dir: "Localizations" as const }] : [];
  });
}

/** UTF-8 when valid, otherwise Windows-1252 (the DLL also accepts ANSI files). Files are always written as UTF-8. */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** The DLL derives group and locale from the last underscore of the file name; locales compare uppercase. */
export function splitLocName(fileName: string): { group: string; locale: string } | null {
  const us = fileName.lastIndexOf("_");
  if (us < 1 || !/\.txt$/i.test(fileName)) return null;
  return { group: fileName.slice(0, us), locale: fileName.slice(us + 1).replace(/\.txt$/i, "").toUpperCase() };
}

