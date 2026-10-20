import { X } from "lucide-react";
import { useDeferredValue, useRef, useState } from "react";
import { parsePlugin, usePlugins } from "../io/plugins";
import { message } from "./dialogs";
import { inputClass } from "./Widgets";

const MAX_ROWS = 200;

/** Load .esp/.esm/.esl files to name FormIDs and check them. Parsed in the browser; the files never leave it. */
export function PluginsView() {
  const { plugins, add, remove } = usePlugins();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const term = useDeferredValue(q).trim().toLowerCase();

  const load = async (files: File[]) => {
    for (const f of files) {
      setBusy(f.name);
      try {
        add(await parsePlugin(await f.arrayBuffer(), f.name));
      } catch (e) {
        await message("Cannot read plugin", e instanceof Error ? e.message : String(e));
      }
    }
    setBusy(null);
  };

  const rows: { file: string; id: string; type: string; editorId?: string; name?: string }[] = [];
  if (term)
    for (const p of plugins) {
      const width = p.light ? 3 : 6;
      for (const [id, r] of p.records) {
        const hex = id.toString(16).padStart(width, "0").toUpperCase();
        if (hex.toLowerCase().includes(term) || r.editorId?.toLowerCase().includes(term) || r.name?.toLowerCase().includes(term)) rows.push({ file: p.file, id: hex, ...r });
        if (rows.length >= MAX_ROWS) break;
      }
      if (rows.length >= MAX_ROWS) break;
    }

  return (
    <div className="h-full overflow-auto bg-[var(--bg-panel)] p-8">
      <h1 className="mb-2 text-lg font-semibold">Plugins</h1>
      <p className="mb-4 max-w-xl text-[var(--text-dim)]">
        Load the plugins your group refers to. FormID fields then show what each ID is, and an ID that is missing, or the wrong kind of record, is flagged. Plugins stay in memory and are not saved; load them again next session. Only records a plugin defines are read, as a config's FormID is local to its plugin. Names of localized plugins (such as Skyrim.esm) are not shown, only EditorIDs.
      </p>
      <button className="rounded border border-[var(--border)] px-3 py-1 hover:bg-white/10" onClick={() => picker.current?.click()}>Load plugins…</button>
      <input ref={picker} type="file" hidden multiple accept=".esp,.esm,.esl" onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; void load(files); }} />
      {busy && <span className="ml-3 text-[var(--text-dim)]">Reading {busy}…</span>}

      <ul className="my-4 max-w-xl space-y-1">
        {plugins.map((p) => (
          <li key={p.file} className="flex items-center gap-2">
            <span className="flex-1 truncate">{p.file}</span>
            <span className="text-[var(--text-dim)]">{p.records.size.toLocaleString()} records{p.light ? " · light" : ""}{p.localized ? " · localized" : ""}</span>
            <button title="Unload" className="rounded p-1 hover:bg-white/10" onClick={() => remove(p.file)}><X size={14} /></button>
          </li>
        ))}
        {!plugins.length && <li className="text-[var(--text-dim)]">No plugins loaded.</li>}
      </ul>

      {plugins.length > 0 && (
        <>
          <input className={`${inputClass} max-w-xl`} value={q} placeholder="Search by EditorID, name or FormID" onChange={(e) => setQ(e.target.value)} />
          <table className="mt-3 w-full max-w-4xl text-left text-[13px]">
            <tbody>
              {rows.map((r) => (
                <tr key={r.file + r.id} className="cursor-copy hover:bg-white/5" title="Copy the FormID" onClick={() => void navigator.clipboard?.writeText(r.id)}>
                  <td className="py-0.5 pr-4 font-mono">{r.id}</td>
                  <td className="pr-4 text-[var(--text-dim)]">{r.type}</td>
                  <td className="pr-4">{r.editorId}</td>
                  <td className="pr-4">{r.name}</td>
                  <td className="text-[var(--text-dim)]">{r.file}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= MAX_ROWS && <p className="mt-2 text-[var(--text-dim)]">Showing the first {MAX_ROWS}. Narrow the search.</p>}
        </>
      )}
    </div>
  );
}
