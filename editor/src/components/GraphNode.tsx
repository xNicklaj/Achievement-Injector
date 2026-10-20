import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { conditionsSummary, type AppNode } from "../graph";
import { getText } from "../io/localization";
import { isLocalizable, missingRequired, registry } from "../registry";
import { useState } from "react";
import { useApp } from "../store";
import { FieldWidget, inputClass, pascal } from "./Widgets";

const flowHandle = "!h-3 !w-3 !rounded-sm !border-0 !bg-[var(--pin-flow)]";
// Inline, not a Tailwind class: the colour is a runtime string Tailwind cannot scan.
const dot = (color: string) => ({ background: color, width: 12, height: 12, border: 0 });

/** One row per language found in the group's Localizations files (HANDOVER 3.13). */
function TranslationRows({ keyName }: { keyName: string }) {
  const loc = useApp((s) => s.loc);
  const setTranslation = useApp((s) => s.setTranslation);
  const locales = Object.keys(loc).sort();
  if (!locales.length) return <div className="px-3 py-0.5 text-[11px] text-[var(--text-dim)]">No languages yet: add one on Group Properties.</div>;
  return (
    <>
      {locales.map((l) => {
        const v = getText(loc[l], keyName) ?? "";
        return (
          <div key={l} className="flex items-center gap-1.5 py-0.5 pl-3 pr-2">
            <span className="w-28 shrink-0 font-mono text-[var(--text-dim)]" title={loc[l].fileName}>{l}</span>
            <input
              className={inputClass}
              style={!v && keyName ? { borderColor: "var(--status-warning)" } : undefined}
              disabled={!keyName}
              placeholder={keyName ? "missing translation" : "set a key first"}
              value={v}
              onChange={(e) => setTranslation(l, keyName, e.target.value)}
            />
          </div>
        );
      })}
    </>
  );
}

export function GraphNode({ id, data, selected }: NodeProps<AppNode>) {
  const def = registry[data.kind];
  const setValue = useApp((s) => s.setValue);
  // Strings keep the selector stable, so the node only re-renders when its own summary changes.
  const summary = useApp((s) => {
    if (!def.condIn) return "";
    const r = conditionsSummary(s.nodes, s.edges, id);
    return `${r.level}|${r.text}`;
  });
  const localized = useApp((s) => {
    const set = new Set<string>();
    for (const e of s.edges) if (e.target === id && e.targetHandle?.startsWith("loc:")) set.add(e.targetHandle.slice(4));
    return [...set].sort().join(",");
  }).split(",");
  const [level, text] = summary.split("|");
  // A LocalizedText node is incomplete while any language lacks its translation.
  const missingLang = useApp((s) =>
    data.kind === "LocalizedText" && typeof data.values.key === "string" && data.values.key
      ? Object.values(s.loc).some((f) => !getText(f, data.values.key as string))
      : false,
  );

  const status = missingRequired(def, data.values, new Set(localized)) || missingLang ? "warning" : level === "error" ? "error" : level === "warning" ? "warning" : null;
  const required = def.fields.filter((f) => !f.optional);
  const optional = def.fields.filter((f) => f.optional);
  // Nodes with no required field (e.g. the one-of conditions) show everything; the rest fold optional rows away,
  // opened on first render when one is already set.
  const flat = required.length === 0;
  const [startOpen] = useState(() => optional.some((f) => data.values[f.name] !== undefined));

  const row = (f: (typeof def.fields)[number]) => {
    const isLoc = isLocalizable(f);
    const connected = isLoc && localized.includes(f.name);
    return (
      <div key={f.name} className="relative flex items-center gap-1.5 py-0.5 pl-3 pr-2">
        {isLoc && <Handle type="target" id={`loc:${f.name}`} position={Position.Left} style={dot("var(--pin-localized)")} />}
        <span className="w-28 shrink-0 truncate text-[var(--text-dim)]" title={f.description ? `${f.name}: ${f.description}` : f.name}>{pascal(f.name)}</span>
        {connected ? (
          <span className="text-[11px] italic text-[var(--pin-localized)]">localized</span>
        ) : (
          <FieldWidget info={f} value={data.values[f.name]} onChange={(v) => setValue(id, f.name, v)} />
        )}
      </div>
    );
  };

  return (
    <div
      className="w-72 rounded-md bg-[var(--bg-node)] text-[12px] shadow-lg"
      style={{
        // Selection is a soft glow; status is a solid border (HANDOVER 3.9).
        border: `2px solid ${status === "error" ? "var(--status-error)" : status === "warning" ? "var(--status-warning)" : "var(--border)"}`,
        boxShadow: selected ? "0 0 0 3px rgba(255,255,255,.18)" : undefined,
      }}
    >
      <div className="relative flex items-center gap-1.5 rounded-t-sm px-3 py-1 font-semibold text-white" style={{ background: `var(--cat-${def.category})` }}>
        {def.flowIn && <Handle type="target" id="flow-in" position={Position.Left} className={flowHandle} />}
        <span className="flex-1 truncate">{def.title}</span>
        {status === "error" && <CircleAlert size={14} />}
        {status === "warning" && <AlertTriangle size={14} />}
        {def.flowOut && <Handle type="source" id="flow-out" position={Position.Right} className={flowHandle} />}
        {def.condOut && <Handle type="source" id="cond-out" position={Position.Right} style={dot("var(--pin-condition)")} />}
        {def.locOut && <Handle type="source" id="loc-out" position={Position.Right} style={dot("var(--pin-localized)")} />}
      </div>
      <div className="py-1">
        {def.condIn && (
          <div className="relative py-0.5 pl-3 pr-2">
            <Handle type="target" id="cond-in" position={Position.Left} style={dot("var(--pin-condition)")} />
            <span className={level === "error" ? "text-[var(--status-error)]" : level === "warning" ? "text-[var(--status-warning)]" : "text-[var(--text-dim)]"}>
              {text}
            </span>
          </div>
        )}
        {(flat ? def.fields : required).map(row)}
        {data.kind === "LocalizedText" && <TranslationRows keyName={typeof data.values.key === "string" ? data.values.key : ""} />}
        {!flat && optional.length > 0 && (
          <details className="nodrag" open={startOpen}>
            <summary className="cursor-pointer select-none px-3 py-0.5 text-[11px] text-[var(--text-dim)]">
              Optional ({optional.filter((f) => data.values[f.name] !== undefined).length}/{optional.length})
            </summary>
            {optional.map(row)}
          </details>
        )}
      </div>
    </div>
  );
}
