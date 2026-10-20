import { LANGUAGES, LOOKALIKES, languageOf } from "../io/languages";
import { locKeys, orphanKeys } from "../io/localization";
import { GroupSchema, describeFields } from "../schema";
import { useApp, type GroupValues } from "../store";
import { GroupIcon } from "./IconField";
import { FieldWidget, pascal } from "./Widgets";

// Rows come from the group schema, so the form matches validation (HANDOVER 3.4).
const fields = describeFields(GroupSchema as never, new Set(["achievements", "_editor"]));

/** Mod Info page. The group icon arrives with icon support. */
export function GroupProperties() {
  const group = useApp((s) => s.group);
  const setGroup = useApp((s) => s.setGroup);
  const { loc, nodes, fileName, addLanguage, removeLanguage } = useApp();
  const locales = Object.keys(loc).sort();
  const used = new Set(nodes.flatMap((n) => (n.data.kind === "LocalizedText" && typeof n.data.values.key === "string" ? [n.data.values.key] : [])));
  const orphans = orphanKeys(loc, used);
  return (
    <div className="h-full overflow-auto bg-[var(--bg-panel)] p-6">
      <h1 className="mb-4 text-lg font-semibold">Group Properties</h1>
      <div className="grid max-w-xl gap-2">
        {fields.map((f) => (
          <label key={f.name} className="flex items-center gap-3">
            <span className="w-32 shrink-0 whitespace-nowrap text-[var(--text-dim)]" title={f.description}>{pascal(f.name)}{f.optional ? "" : " *"}</span>
            <FieldWidget info={f} value={group[f.name as keyof GroupValues]} onChange={(v) => setGroup({ [f.name]: v })} />
          </label>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-[14px] font-semibold">Icon</h2>
      <p className="mb-2 max-w-xl text-[var(--text-dim)]">Shown for the group in the menu. 512×512, BC3 (DXT5) or lower. It is written to Icons/ when you save.</p>
      <GroupIcon />

      <h2 className="mb-2 mt-8 text-[14px] font-semibold">Languages</h2>
      <p className="mb-2 max-w-xl text-[var(--text-dim)]">
        The languages Skyrim ships. Each one is a file in Localizations/, and every Localized Text node shows a row for each checked language. A language is saved once it has a translation. English is the fallback for the others.
      </p>
      <ul className="mb-2 max-w-xl space-y-1">
        {LANGUAGES.map((l) => {
          const f = loc[l.code];
          const keys = f ? locKeys(f).size : 0;
          const locked = !fileName || keys > 0;
          return (
            <li key={l.code}>
              <label className="flex items-center gap-3" title={keys > 0 ? "This language has translations; delete its file to remove it" : undefined}>
                <input type="checkbox" className="h-3.5 w-3.5" checked={!!f} disabled={!fileName || (!!f && locked)} onChange={(e) => (e.target.checked ? addLanguage(l.code) : removeLanguage(l.code))} />
                <span className="w-20">{l.name}</span>
                <span className="w-8 font-mono">{l.code}</span>
                <span className="text-[var(--text-dim)]">
                  {f ? `${f.fileName} · ${keys} keys` : `sLanguage=${l.sLanguage}`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {!fileName && <p className="mb-2 text-[var(--text-dim)]">Create or open a group to choose languages.</p>}
      {locales.filter((l) => !languageOf(l)).map((l) => (
        <p key={l} className="mb-1 max-w-xl text-[var(--status-warning)]">
          {loc[l].fileName}: {l} is not a code Skyrim produces, so this file never loads.
          {LOOKALIKES[l] && ` The game's ${languageOf(LOOKALIKES[l])!.name} is ${LOOKALIKES[l]}; rename the file to ${loc[l].fileName.replace(/_[^_]+\.txt$/i, `_${LOOKALIKES[l]}.txt`)}.`}
        </p>
      ))}

      {orphans.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-[14px] font-semibold">Unused keys ({orphans.length})</h2>
          <p className="mb-2 max-w-xl text-[var(--text-dim)]">In the language files but not used by any Localized Text node. They are kept when you save, never deleted.</p>
          <ul className="max-w-xl columns-2 font-mono text-[12px] text-[var(--text-dim)]">
            {orphans.map((k) => (
              <li key={k} className="truncate" title={k}>${k}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
