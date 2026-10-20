import { useStore } from "@xyflow/react";
import { useDeferredValue, useState } from "react";
import type { FieldInfo } from "../schema";
import { findPlugin, lookup, searchRecords, usePlugins } from "../io/plugins";

/** Field names are shown in PascalCase; the JSON keys stay camelCase. */
export const pascal = (s: string) => s[0].toUpperCase() + s.slice(1);

export const inputClass = "nodrag nowheel w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-[3px] text-[13px] text-[var(--text)] outline-none focus:border-zinc-400";

type Props = { info: FieldInfo; value: unknown; onChange: (v: unknown) => void; /** Red border: this field has an error. */ invalid?: boolean; /** The plugin this field's FormID belongs to, to name the record when it is loaded. */ plugin?: string; /** Record type this field must point at, to narrow the search. */ want?: string };

/** What a loaded plugin says the FormID is: type, EditorID, name. */
function FormHint({ plugin, value }: { plugin?: string; value: unknown }) {
  const plugins = usePlugins((s) => s.plugins);
  const hit = typeof value === "string" ? lookup(plugins, plugin, value) : undefined;
  if (!hit) return null;
  const r = hit.record;
  return <Marquee text={r ? [r.type, r.editorId, r.name].filter(Boolean).join(" · ") : `not in ${hit.plugin.file}`} />;
}

/**
 * A FormID input. Clicking it opens a search of the field's plugin, when that plugin is loaded: pick a record by
 * EditorID, name or ID and its ID is written to the input. Esc closes the search, and the input can then be typed in as usual.
 */
function FormIdField({ info, value, onChange, plugin, want, style, placeholder }: Pick<Props, "info" | "value" | "onChange" | "plugin" | "want"> & { style?: React.CSSProperties; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const term = useDeferredValue(q);
  const loaded = usePlugins((s) => findPlugin(s.plugins, plugin));
  const rows = open && loaded ? searchRecords(loaded, term, info.formKind, want) : [];
  const [shift, setShift] = useState({ x: 0, y: 0 });
  // The node is scaled by the canvas zoom, so a screen-pixel drag is divided by it to follow the pointer.
  const zoom = useStore((s) => s.transform[2]);
  const close = () => (setOpen(false), setQ(""), setShift({ x: 0, y: 0 }));
  const pick = (id: string) => (onChange(id), close());
  return (
    <div
      className="relative min-w-0 flex-1"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && close()}
      onKeyDown={(e) => e.key === "Escape" && open && (close(), e.currentTarget.querySelector("input")?.focus())}
    >
      <input style={style}
        className={`${inputClass} font-mono`}
        value={typeof value === "string" ? value : ""}
        placeholder={placeholder}
        onClick={() => loaded && setOpen(true)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      />
      <FormHint plugin={plugin} value={value} />
      {open && loaded && (
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
            placeholder={`Search ${want ?? "records"} by EditorID or name`}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rows[0] && pick(rows[0].id)}
          />
          <ul className="max-h-48 overflow-auto text-[12px]">
            {rows.map((r) => (
              <li key={r.id}>
                <button className="block w-full truncate px-2 py-1 text-left hover:bg-white/10" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r.id)}>
                  <span className="font-mono">{r.id}</span> <span className="text-[var(--text-dim)]">{r.record.type}</span> {r.record.editorId} {r.record.name}
                </button>
              </li>
            ))}
            {!rows.length && <li className="px-2 py-1 text-[var(--text-dim)]">No match in {loaded.file}</li>}
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

/** One widget per field type; empty input removes the key so unset is never serialized. */
export function FieldWidget({ info, value, onChange, invalid, plugin, want }: Props) {
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
    case "float":
      return (
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
      return (
        <input style={bad}
          className={`${inputClass} font-mono`}
          value={Array.isArray(value) ? value.join(", ") : ""}
          placeholder="comma separated"
          onChange={(e) => {
            const items = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            onChange(items.length ? items : undefined);
          }}
        />
      );
    default:
      return info.widget === "formId" ? (
        <FormIdField {...{ info, value, onChange, plugin, want }} style={bad} placeholder={placeholder} />
      ) : (
        <input style={bad}
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      );
  }
}
