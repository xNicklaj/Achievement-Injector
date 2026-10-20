import { useStore } from "@xyflow/react";
import { useDeferredValue, useState } from "react";
import type { FieldInfo } from "../schema";
import { lookup, usePlugins, type Search } from "../io/plugins";
import type { ReactNode } from "react";

/** Field names are shown in PascalCase; the JSON keys stay camelCase. */
export const pascal = (s: string) => s[0].toUpperCase() + s.slice(1);

export const inputClass = "nodrag nowheel w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-[3px] text-[13px] text-[var(--text)] outline-none focus:border-zinc-400";

type Props = { info: FieldInfo; value: unknown; onChange: (v: unknown) => void; /** Red border: this field has an error. */ invalid?: boolean; /** The plugin this field's FormID belongs to, to name the record when it is loaded. */ plugin?: string; /** A search of the loaded plugins for this field; clicking the input opens it. */ search?: Search };

/** What a loaded plugin says the FormID is: type, EditorID, name. */
function FormHint({ plugin, value }: { plugin?: string; value: unknown }) {
  const plugins = usePlugins((s) => s.plugins);
  const hit = typeof value === "string" ? lookup(plugins, plugin, value) : undefined;
  if (!hit) return null;
  const r = hit.record;
  return <Marquee text={r ? [r.type, r.editorId, r.name].filter(Boolean).join(" · ") : `not in ${hit.plugin.file}`} />;
}

/**
 * Wraps an input with a search of the loaded plugins: clicking the input opens it, picking an entry writes its value.
 * Esc closes the search, and the input can then be typed in as usual.
 */
function Pickable({ search, onPick, children }: { search?: Search; onPick: (v: string | number) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const term = useDeferredValue(q);
  const rows = open && search ? search.run(term) : [];
  const [shift, setShift] = useState({ x: 0, y: 0 });
  // The node is scaled by the canvas zoom, so a screen-pixel drag is divided by it to follow the pointer.
  const zoom = useStore((s) => s.transform[2]);
  const close = () => (setOpen(false), setQ(""), setShift({ x: 0, y: 0 }));
  const pick = (v: string | number) => (onPick(v), close());
  return (
    <div
      className="relative min-w-0 flex-1"
      onClick={(e) => search && (e.target as HTMLElement).tagName === "INPUT" && setOpen(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && close()}
      onKeyDown={(e) => e.key === "Escape" && open && (close(), e.currentTarget.querySelector("input")?.focus())}
    >
      {children}
      {open && search && (
        <div style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }} className="nodrag nowheel absolute right-0 top-full z-50 mt-1 w-[28rem] rounded border border-[var(--border)] bg-[var(--bg-panel)] shadow-xl">
          <div
            title="Drag to move"
            className="h-3 cursor-move rounded-t bg-white/10 hover:bg-white/20"
            // Keep focus in the search box, or the blur handler would close the popup.
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={(e) => e.buttons && setShift((s) => ({ x: s.x + e.movementX / zoom, y: s.y + e.movementY / zoom }))}
          />
          <input
            autoFocus
            className={inputClass}
            value={q}
            placeholder={search.label}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rows[0] && pick(rows[0].value)}
          />
          <ul className="max-h-48 overflow-auto text-[12px]">
            {rows.map((r) => (
              <li key={`${r.value}${r.text ?? ""}`}>
                <button className="block w-full truncate px-2 py-1 text-left hover:bg-white/10" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r.value)}>
                  <span className="font-mono">{r.value}</span> <span className="text-[var(--text-dim)]">{r.tag}</span> {r.text}
                </button>
              </li>
            ))}
            {!rows.length && <li className="whitespace-normal px-2 py-1 text-[var(--text-dim)]">{search.empty ?? "No match"}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One line that is cut off with an ellipsis, and slides back and forth while hovered so the whole text can be read. */
function Marquee({ text }: { text: string }) {
  const [shift, setShift] = useState(0);
  return (
    <div
      className="overflow-hidden px-0.5 text-[11px] text-[var(--text-dim)]"
      // The span is truncated at rest, so its scrollWidth is the full text width.
      onMouseEnter={(e) => setShift(Math.max(0, (e.currentTarget.firstElementChild?.scrollWidth ?? 0) - e.currentTarget.clientWidth))}
      onMouseLeave={() => setShift(0)}
    >
      <span
        className={shift ? "inline-block whitespace-nowrap" : "block truncate"}
        style={shift ? ({ "--shift": `-${shift}px`, animation: `marquee ${Math.max(1, shift / 30)}s ease-in-out infinite alternate` } as React.CSSProperties) : undefined}
      >
        {text}
      </span>
    </div>
  );
}

const HEX_ID = /^[0-9a-fA-F]{1,8}$/;

/** A list of FormIDs, one row each: rows are added and removed, and each has its own plugin search and name hint. */
function ListEditor({ value, onChange, invalid, plugin, search }: Props) {
  const items = Array.isArray(value) ? value.map(String) : [];
  const set = (next: string[]) => onChange(next.length ? next : undefined);
  const edit = (i: number, v: string) => set(items.map((x, j) => (j === i ? v : x)));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {items.map((v, i) => (
        <div key={i} className="flex items-start gap-1">
          <Pickable search={search} onPick={(p) => edit(i, String(p))}>
            <input
              className={`${inputClass} font-mono`}
              style={(v ? !HEX_ID.test(v) : invalid) ? { borderColor: "var(--status-error)" } : undefined}
              value={v}
              placeholder="FormID"
              onChange={(e) => edit(i, e.target.value.trim())}
            />
            <FormHint plugin={plugin} value={v} />
          </Pickable>
          <button type="button" title="Remove" aria-label="Remove" className="nodrag shrink-0 rounded px-1.5 py-[3px] text-[var(--text-dim)] hover:bg-white/10" onClick={() => set(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="nodrag self-start rounded border border-[var(--border)] px-2 py-0.5 text-[12px] text-[var(--text-dim)] hover:bg-white/10" onClick={() => onChange([...items, ""])}>
        + Add
      </button>
    </div>
  );
}

/** One widget per field type; empty input removes the key so unset is never serialized. */
export function FieldWidget({ info, value, onChange, invalid, plugin, search }: Props) {
  const bad = invalid ? { borderColor: "var(--status-error)" } : undefined;
  const placeholder = info.default !== undefined ? `default: ${String(info.default)}` : info.description;
  switch (info.widget) {
    case "bool":
      return (
        <input
          type="checkbox"
          className="nodrag h-3.5 w-3.5"
          checked={value === undefined ? Boolean(info.default) : Boolean(value)}
          // An unset box shows the DLL default; touching it writes an explicit value.
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "integer":
    case "float": {
      const input = (
        <input style={bad}
          type="number"
          step={info.widget === "integer" ? 1 : "any"}
          className={inputClass}
          value={typeof value === "number" ? value : ""}
          placeholder={placeholder}
          // A focused number field changes value on wheel; a touchpad scroll must not edit it.
          onWheel={(e) => e.currentTarget.blur()}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
      return search ? <Pickable search={search} onPick={(v) => onChange(Number(v))}>{input}</Pickable> : input;
    }
    case "enum":
      return (
        <select style={bad}
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        >
          <option value="">{info.optional ? `(default${info.default !== undefined ? `: ${String(info.default)}` : ""})` : "—"}</option>
          {info.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case "list":
      return <ListEditor info={info} value={value} onChange={onChange} invalid={invalid} plugin={plugin} search={search} />;
    default: {
      const formId = info.widget === "formId";
      const input = (
        <input style={bad}
          className={`${inputClass} ${formId ? "font-mono" : ""}`}
          value={typeof value === "string" ? value : ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      );
      // A FormID always gets the wrapper, so its input is not remounted when a plugin is loaded.
      return formId ? (
        <Pickable search={search} onPick={(v) => onChange(String(v))}>{input}<FormHint plugin={plugin} value={value} /></Pickable>
      ) : search ? (
        <Pickable search={search} onPick={(v) => onChange(String(v))}>{input}</Pickable>
      ) : input;
    }
  }
}
