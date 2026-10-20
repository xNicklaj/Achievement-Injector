import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { achievementNames, conditionsSummary, isInternalGroup, type AppNode } from "../graph";
import { getText } from "../io/localization";
import { isLocalizable, registry } from "../registry";
import { useState } from "react";
import { confirmDialog } from "./dialogs";
import { useApp } from "../store";
import { parseNodeStatus, useValidation } from "../validation";
import { IconField } from "./IconField";
import { FieldWidget, inputClass, pascal } from "./Widgets";

const flowHandle = "!h-3 !w-3 !rounded-sm !border-0 !bg-[var(--pin-flow)]";
// Inline, not a Tailwind class: the colour is a runtime string Tailwind cannot scan.
const dot = (color: string) => ({ background: color, width: 12, height: 12, border: 0 });

/**
 * The achievement's name. It is committed on blur or Enter (Escape reverts), because a rename is one decision:
 * references in this group follow it, and renaming a name that is already on disk warns that progress keys off it (HANDOVER 3.1).
 */
function NameField({ id, value, invalid }: { id: string; value: unknown; invalid: boolean }) {
  const current = typeof value === "string" ? value : "";
  const [draft, setDraft] = useState(current);
  const [editing, setEditing] = useState(false);
  const shown = editing ? draft : current;

  const commit = async () => {
    setEditing(false);
    if (draft === current) return;
    const r = useApp.getState().renameAchievement(id, draft);
    if (!r.old || !r.existed) return;
    const lines = [
      "Saved progress, the Papyrus API and the console command use the achievement name, so players' progress under the old name is not carried over.",
      r.updated ? `${r.updated} reference${r.updated > 1 ? "s" : ""} to it in this group ${r.updated > 1 ? "were" : "was"} updated.` : "No references to it in this group.",
      "References from other groups are not updated.",
    ];
    // Enter commits by blurring; opening the dialog in the same keypress would let that Enter press its focused button.
    await new Promise((r) => setTimeout(r, 50));
    if (!(await confirmDialog("Rename achievement?", lines, "Keep new name", `"${r.old}" becomes "${draft}".`, "Undo rename"))) useApp.temporal.getState().undo();
  };

  return (
    <input
      className={inputClass}
      style={invalid ? { borderColor: "var(--status-error)" } : undefined}
      value={shown}
      placeholder="Unique within the group"
      onFocus={() => (setDraft(current), setEditing(true))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") (setDraft(current), setEditing(false), e.currentTarget.blur());
      }}
    />
  );
}

/** An achievement reference: suggests this group's achievements; for another group it is free text and not validated. */
function AchievementRefField({ id, value, group, onChange, invalid }: { id: string; value: unknown; group: unknown; onChange: (v: unknown) => void; invalid: boolean }) {
  const fileName = useApp((s) => s.fileName);
  // A JSON string keeps the selector stable, so the field re-renders only when the list changes.
  const names = JSON.parse(useApp((s) => JSON.stringify(achievementNames(s.nodes, s.edges, s.loc)))) as string[];
  const external = !isInternalGroup(group, fileName);
  const listId = `ach-${id}`;
  return (
    <>
      <input
        className={inputClass}
        style={invalid ? { borderColor: "var(--status-error)" } : undefined}
        list={external ? undefined : listId}
        value={typeof value === "string" ? value : ""}
        placeholder={external ? "Name in the other group" : "Achievement name"}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      />
      {!external && <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>}
      {external && <span className="shrink-0 text-[10px] text-[var(--text-dim)]" title="This group is not open, so the name cannot be checked">external</span>}
    </>
  );
}

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
  // Problems come from the shared validation (one pass over the whole file); the AddConditions summary is live and local.
  const checked = parseNodeStatus(useValidation((s) => s.byNode[id]));
  const invalid = (useValidation((s) => s.fieldsByNode[id]) ?? "").split(",");
  const summaryLevel = level === "error" || level === "warning" ? level : null;
  const status = checked.level === "error" || summaryLevel === "error" ? "error" : (checked.level ?? summaryLevel);
  const problems = [...(def.condIn && summaryLevel ? [text] : []), ...checked.messages].join("\n");
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
        ) : def.kind === "CreateAchievement" && f.name === "achievementName" ? (
          <NameField id={id} value={data.values.achievementName} invalid={invalid.includes("achievementName")} />
        ) : f.widget === "iconPath" ? (
          <IconField value={data.values[f.name]} onChange={(v) => setValue(id, f.name, v)} />
        ) : f.widget === "achievementRef" ? (
          <AchievementRefField id={id} value={data.values[f.name]} group={data.values.group} invalid={invalid.includes(f.name)} onChange={(v) => setValue(id, f.name, v)} />
        ) : (
          <FieldWidget info={f} value={data.values[f.name]} invalid={invalid.includes(f.name)} onChange={(v) => setValue(id, f.name, v)} />
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
        {status && (
          <span title={problems} aria-label={problems} tabIndex={0} className="cursor-help">
            {status === "error" ? <CircleAlert size={14} /> : <AlertTriangle size={14} />}
          </span>
        )}
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
