import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import { AlertTriangle, CircleAlert, CircleHelp } from "lucide-react";
import { incoming, nodeIndex } from "../graphIndex";
import { achievementNames, conditionsSummary, isInternalGroup, linkedText, pluginOf, type AppNode } from "../graph";
import { searchFor, usePlugins } from "../io/plugins";
import { getText } from "../io/localization";
import { linkKind, registry, UNKNOWN_CONDITION, wiredFields, type LinkKind } from "../registry";
import { achievementIconPath, groupId } from "../io/workspace";
import { BASELINE_VERSION, compareVersions } from "../schema";
import { useState } from "react";
import { confirmDialog } from "./dialogs";
import { useApp } from "../store";
import { parseNodeStatus, useValidation } from "../validation";
import { IconField } from "./IconField";
import { IconThumb } from "./icons";
import { FieldWidget, inputClass, pascal } from "./Widgets";

const flowHandle = "!h-3.5 !w-3.5 !rounded-sm !border-0 !bg-[var(--pin-flow)]";
/** Pin colours by link kind, as CSS variables. */
const LINK_COLOR: Record<LinkKind, string> = { loc: "var(--pin-localized)", ach: "var(--pin-achievement)", icon: "var(--pin-icon)", plugin: "var(--pin-plugin)" };

/** What a linked field shows in place of its input: the achievement name or icon file its wire stands for. */
function LinkedValue({ id, field, kind }: { id: string; field: string; kind: LinkKind }) {
  const value = useApp((s) => {
    const wire = incoming(s.edges, id).find((e) => e.targetHandle === `${kind}:${field}`);
    const source = wire && nodeIndex(s.nodes).get(wire.source);
    return source ? (linkedText(s.nodes, s.edges, s.loc, source, kind) ?? "") : "";
  });
  return (
    <span className="min-w-0 flex-1 truncate text-[12px] italic" style={{ color: LINK_COLOR[kind] }} title={value}>
      {kind === "loc" ? "localized" : value ? `→ ${value}` : "linked (no value yet)"}
    </span>
  );
}

/** A large look at the icon an Icon node names. */
function IconPreview({ file }: { file: unknown }) {
  const fileName = useApp((s) => s.fileName);
  const name = typeof file === "string" ? file : "";
  return (
    <div className="px-3.5 py-1">
      <IconThumb path={fileName && name ? achievementIconPath(groupId(fileName), name) : undefined} size={96} title={name} />
    </div>
  );
}

// Inline, not a Tailwind class: the colour is a runtime string Tailwind cannot scan.
const dot = (color: string) => ({ background: color, width: 14, height: 14, border: 0 });

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
export function TranslationRows({ keyName }: { keyName: string }) {
  const loc = useApp((s) => s.loc);
  const setTranslation = useApp((s) => s.setTranslation);
  const locales = Object.keys(loc).sort();
  if (!locales.length) return <div className="px-3.5 py-1 text-[12px] text-[var(--text-dim)]">No languages yet: add one on Group Properties.</div>;
  return (
    <>
      {locales.map((l) => {
        const v = getText(loc[l], keyName) ?? "";
        return (
          <div key={l} className="flex items-center gap-2 py-1 pl-3.5 pr-3">
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
  // The Controls lock button turns all three off; the fields must stop taking input too.
  const locked = useStore((s) => !(s.nodesDraggable || s.nodesConnectable || s.elementsSelectable));
  // Own override (wired or typed), else the achievement's, else the group's.
  const plugin = useApp((s) => {
    const self = nodeIndex(s.nodes).get(id);
    return self ? pluginOf(s.nodes, s.edges, self, s.group.plugin) : s.group.plugin;
  });
  const plugins = usePlugins((s) => s.plugins);
  // Strings keep the selector stable, so the node only re-renders when its own summary changes.
  const summary = useApp((s) => {
    if (!def.condIn) return "";
    const r = conditionsSummary(s.nodes, s.edges, id);
    return `${r.level}|${r.text}`;
  });
  // Fields fed by a wire (text, achievement or icon), as a string so the selector stays stable.
  const linked = useApp((s) => [...wiredFields(s.edges, id)].sort().join(",")).split(",");
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
  const [help, setHelp] = useState(false);
  const [opened, setOpened] = useState(() => optional.some((f) => data.values[f.name] !== undefined));
  // A folded row has no pin of its own, so the pins of wired optional fields move to the "Optional" header while it is
  // folded and the wires stay attached.
  const folded = !opened ? optional.filter((f) => linkKind(def, f) && linked.includes(f.name)) : [];

  const row = (f: (typeof def.fields)[number]) => {
    const lk = linkKind(def, f);
    const connected = lk !== null && linked.includes(f.name);
    return (
      <div key={f.name} className={`relative flex gap-2 py-1 pl-3.5 pr-3 ${f.widget === "list" ? "items-start" : "items-center"}`}>
        {lk && <Handle type="target" id={`${lk}:${f.name}`} position={Position.Left} style={dot(LINK_COLOR[lk])} />}
        <span className={`flex w-28 shrink-0 items-center gap-1 text-[var(--text-dim)] ${f.widget === "list" ? "pt-1" : ""}`} title={f.description ? `${f.name}: ${f.description}` : f.name}>
          <span className="truncate">{pascal(f.name)}</span>
          {f.since && compareVersions(f.since, BASELINE_VERSION) > 0 && (
            <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] leading-tight" title={`Needs Achievement Injector ${f.since} or newer`}>{f.since}</span>
          )}
        </span>
        {connected ? (
          <LinkedValue id={id} field={f.name} kind={lk} />
        ) : def.kind === "CreateAchievement" && f.name === "achievementName" ? (
          <NameField id={id} value={data.values.achievementName} invalid={invalid.includes("achievementName")} />
        ) : f.widget === "iconPath" ? (
          <IconField value={data.values[f.name]} onChange={(v) => setValue(id, f.name, v)} />
        ) : f.widget === "achievementRef" ? (
          <AchievementRefField id={id} value={data.values[f.name]} group={data.values.group} invalid={invalid.includes(f.name)} onChange={(v) => setValue(id, f.name, v)} />
        ) : (
          <FieldWidget info={f} value={data.values[f.name]} plugin={plugin} search={searchFor(plugins, data.kind, f, data.values, plugin)} invalid={invalid.includes(f.name)} onChange={(v) => setValue(id, f.name, v)} />
        )}
      </div>
    );
  };

  return (
    <div
      className="w-72 rounded-md bg-[var(--bg-node)] text-[13px] shadow-lg"
      style={{
        // Selection is a soft glow; status is a solid border (HANDOVER 3.9).
        border: `2px solid ${status === "error" ? "var(--status-error)" : status === "warning" ? "var(--status-warning)" : "var(--border)"}`,
        boxShadow: selected ? "0 0 0 3px var(--select), 0 0 16px 4px var(--select-soft)" : undefined,
      }}
    >
      <div className="relative flex items-center gap-1.5 rounded-t-sm px-3.5 py-2 font-semibold text-white" style={{ background: `var(--cat-${def.category})` }}>
        {def.modifier && <Handle type="target" id="cond-in" position={Position.Left} style={dot("var(--pin-condition)")} />}
        {def.flowIn && <Handle type="target" id="flow-in" position={Position.Left} className={flowHandle} />}
        <span className="flex-1 truncate">{data.kind === UNKNOWN_CONDITION ? `Unknown: ${String(data.extra?.type)}` : def.title}</span>
        {def.description && (
          <button type="button" aria-label="Info" aria-expanded={help} title="Info" onClick={() => setHelp(!help)} className="nodrag cursor-pointer text-white/80 hover:text-white">
            <CircleHelp size={14} />
          </button>
        )}
        {status && (
          <span title={problems} aria-label={problems} tabIndex={0} className="cursor-help">
            {status === "error" ? <CircleAlert size={14} /> : <AlertTriangle size={14} />}
          </span>
        )}
        {def.flowOut && <Handle type="source" id="flow-out" position={Position.Right} className={flowHandle} title={def.category === "condition" ? "On Unlock: commands and Papyrus calls to run when this condition is met" : undefined} />}
        {def.condOut && def.category !== "condition" && <Handle type="source" id="cond-out" position={Position.Right} style={dot("var(--pin-condition)")} />}
        {def.locOut && <Handle type="source" id="loc-out" position={Position.Right} style={dot("var(--pin-localized)")} />}
        {def.pluginOut && <Handle type="source" id="plugin-out" position={Position.Right} style={dot("var(--pin-plugin)")} />}
        {def.iconOut && <Handle type="source" id="icon-out" position={Position.Right} style={dot("var(--pin-icon)")} />}
      </div>
      <div className="py-2" inert={locked}>
        {def.condIn && (
          <div className="relative py-1 pl-3.5 pr-3">
            <Handle type="target" id="cond-in" position={Position.Left} style={dot("var(--pin-condition)")} />
            <span className={level === "error" ? "text-[var(--status-error)]" : level === "warning" ? "text-[var(--status-warning)]" : "text-[var(--text-dim)]"}>
              {text}
            </span>
          </div>
        )}
        {data.kind === UNKNOWN_CONDITION && <div className="px-3.5 py-1 text-[12px] text-[var(--text-dim)]">Not a type this editor knows. It is kept as it is.</div>}
        {(flat ? def.fields : required).map(row)}
        {data.kind === "Icon" && <IconPreview file={data.values.file} />}
        {data.kind === "LocalizedText" && <TranslationRows keyName={typeof data.values.key === "string" ? data.values.key : ""} />}
        {!flat && optional.length > 0 && (
          <div className="nodrag">
            <button type="button" aria-expanded={opened} onClick={() => setOpened(!opened)} className="relative flex w-full cursor-pointer select-none items-center gap-1 px-3.5 py-1 text-left text-[12px] text-[var(--text-dim)]">
              <span className="w-3 text-[9px]">{opened ? "▼" : "▶"}</span>
              Optional ({optional.filter((f) => data.values[f.name] !== undefined || linked.includes(f.name)).length}/{optional.length})
              {folded.map((f) => {
                const lk = linkKind(def, f)!;
                return <Handle key={f.name} type="target" id={`${lk}:${f.name}`} position={Position.Left} style={dot(LINK_COLOR[lk])} />;
              })}
            </button>
            {opened && optional.map(row)}
          </div>
        )}
        {def.achOut && (
          <div className="relative py-1 pl-3.5 pr-4 text-right text-[12px] text-[var(--text-dim)]" title="Connect to an Achievement Unlocked condition that waits for this achievement">
            Unlock
            <Handle type="source" id="ach-out" position={Position.Right} style={dot(LINK_COLOR.ach)} />
          </div>
        )}
        {def.category === "condition" && (
          // The flow pin sits in the header like every other node's; the condition output moves to its own row.
          <div className="relative py-1 pl-3.5 pr-4 text-right text-[12px] text-[var(--text-dim)]" title="Connect to Add Conditions, or to a Conditions Met node">
            Condition
            <Handle type="source" id="cond-out" position={Position.Right} style={dot("var(--pin-condition)")} />
          </div>
        )}
        {help && def.description && <div className="px-3.5 py-1 text-[12px] text-[var(--text-dim)]">{def.description}</div>}
      </div>
    </div>
  );
}
