import { AlertTriangle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getText, keyWarnings, locRows, sortedLocales } from "../io/localization";
import { useApp } from "../store";
import { inputClass } from "./Widgets";

/** The key, with a warning sign after it when something is off; hovering the sign shows what. */
function KeyCell({ k, warnings }: { k: string; warnings: string[] }) {
  const text = warnings.join("\n");
  return (
    <div role="cell" className="flex min-w-0 items-center gap-1.5 px-4 py-1.5">
      <span className="truncate font-mono text-[12px]" title={`$${k}`}>${k}</span>
      {warnings.length > 0 && (
        <span title={text} aria-label={text} tabIndex={0} className="shrink-0 cursor-help text-[var(--status-warning)]">
          <AlertTriangle size={14} />
        </span>
      )}
    </div>
  );
}

/** Every localization entry in one table: one row per key, one column per language. Cells are editable. */
export function LocalizationTable() {
  const loc = useApp((s) => s.loc);
  const nodes = useApp((s) => s.nodes);
  const setTranslation = useApp((s) => s.setTranslation);
  const [q, setQ] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);

  const locales = sortedLocales(loc);
  const used = useMemo(
    () => new Set(nodes.flatMap((n) => (n.data.kind === "LocalizedText" && typeof n.data.values.key === "string" && n.data.values.key ? [n.data.values.key] : []))),
    [nodes],
  );
  const rows = useMemo(() => locRows(loc, used), [loc, used]);

  const isMissing = (key: string) => locales.some((l) => !getText(loc[l], key));
  const term = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!term || r.key.toLowerCase().includes(term) || locales.some((l) => (getText(loc[l], r.key) ?? "").toLowerCase().includes(term))) &&
      (!missingOnly || isMissing(r.key)),
  );
  const missingCells = rows.reduce((n, r) => n + locales.filter((l) => !getText(loc[l], r.key)).length, 0);
  const cols = `minmax(16rem,1.1fr) repeat(${Math.max(locales.length, 1)}, minmax(13rem,1fr))`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-panel)]">
      <div className="flex shrink-0 items-center gap-4 border-b border-[var(--border)] px-4 py-2">
        <h1 className="text-[14px] font-semibold">Localization</h1>
        <label className="flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-0.5">
          <Search size={12} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search keys and text"
            className="w-64 bg-transparent text-[12px] outline-none placeholder:text-[var(--text-dim)]"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="h-3.5 w-3.5" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Missing translations only
        </label>
        <span className="ml-auto text-[var(--text-dim)]">
          {shown.length === rows.length ? `${rows.length} keys` : `${shown.length} of ${rows.length} keys`}
          {locales.length > 0 && ` · ${missingCells} missing`}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="p-6 text-[var(--text-dim)]">
          No localization entries yet. Connect a Localized Text node to a field, or open a group that has Localizations files.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div role="table" className="min-w-max">
            <div role="row" className="sticky top-0 z-10 grid border-b border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-dim)]" style={{ gridTemplateColumns: cols }}>
              <div role="columnheader" className="px-4 py-1.5">Key</div>
              {locales.map((l) => (
                <div role="columnheader" key={l} className="px-2 py-1.5 font-mono" title={loc[l].fileName}>{l}</div>
              ))}
              {!locales.length && <div role="columnheader" className="px-2 py-1.5">No languages yet: add one on Group Properties</div>}
            </div>
            {shown.map((r) => (
              <div role="row" key={r.key} className="grid items-center border-b border-[var(--border)]/50 hover:bg-white/[0.03]" style={{ gridTemplateColumns: cols }}>
                <KeyCell k={r.key} warnings={keyWarnings(loc, r.key, r.used)} />
                {locales.map((l) => {
                  const v = getText(loc[l], r.key) ?? "";
                  return (
                    <div role="cell" key={l} className="px-2 py-1">
                      <input
                        className={inputClass}
                        style={!v ? { borderColor: "var(--status-warning)" } : undefined}
                        placeholder="missing"
                        value={v}
                        onChange={(e) => setTranslation(l, r.key, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            {shown.length === 0 && <p className="p-6 text-[var(--text-dim)]">No keys match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
