import type { FieldInfo } from "../schema";

/** Field names are shown in PascalCase; the JSON keys stay camelCase. */
export const pascal = (s: string) => s[0].toUpperCase() + s.slice(1);

export const inputClass = "nodrag nowheel w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-[3px] text-[13px] text-[var(--text)] outline-none focus:border-zinc-400";

type Props = { info: FieldInfo; value: unknown; onChange: (v: unknown) => void; /** Red border: this field has an error. */ invalid?: boolean };

/** One widget per field type; empty input removes the key so unset is never serialized. */
export function FieldWidget({ info, value, onChange, invalid }: Props) {
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
      return (
        <input style={bad}
          className={`${inputClass} ${info.widget === "formId" ? "font-mono" : ""}`}
          value={typeof value === "string" ? value : ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      );
  }
}
