import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addIconFile } from "../io/iconActions";
import { achievementIconPath, groupIconPath, groupId } from "../io/workspace";
import { useApp } from "../store";
import { IconThumb, iconProblems, useIcon } from "./icons";
import { Button } from "./Dialog";
import { inputClass } from "./Widgets";

/** File names usable for this group: those on disk plus any added and not yet saved. */
function useIconNames(): string[] {
  const fileName = useApp((s) => s.fileName);
  const files = useApp((s) => s.iconFiles);
  const pending = useApp((s) => s.pendingIcons);
  return useMemo(() => {
    if (!fileName) return [];
    const prefix = `Icons/${groupId(fileName)}/`;
    const added = Object.keys(pending).filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/")).map((p) => p.slice(prefix.length));
    return [...new Set([...(files ?? []), ...added])].sort((a, b) => a.localeCompare(b));
  }, [fileName, files, pending]);
}

/**
 * The achievement's `icon`: a thumbnail, the file name (free text), and a picker that previews every .dds in
 * `Icons/<Group>/` (HANDOVER 3.1). New icons can be added from here; they are written when you save.
 */
export function IconField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const fileName = useApp((s) => s.fileName);
  const known = useApp((s) => s.iconFiles !== null);
  const names = useIconNames();
  const name = typeof value === "string" ? value : "";
  const gid = fileName ? groupId(fileName) : null;
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <>
      <IconThumb path={gid && name ? achievementIconPath(gid, name) : undefined} size={22} title={name} />
      <input className={inputClass} value={name} placeholder="Icon file, e.g. Icon.dds" onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} />
      <button ref={button} type="button" title="Choose an icon" className="nodrag shrink-0 rounded border border-[var(--border)] px-1.5 text-[12px] hover:bg-white/10" onClick={() => setOpen(!open)}>
        …
      </button>
      {open && <IconPicker anchor={button.current!} gid={gid} names={names} known={known} current={name} onPick={(n) => (onChange(n || undefined), setOpen(false))} onClose={() => setOpen(false)} />}
    </>
  );
}

function IconPicker({ anchor, gid, names, known, current, onPick, onClose }: { anchor: HTMLElement; gid: string | null; names: string[]; known: boolean; current: string; onPick: (name: string) => void; onClose: () => void }) {
  const r = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.right - 360, window.innerWidth - 368));
  const top = r.bottom + 4 + 340 > window.innerHeight ? Math.max(8, r.top - 344) : r.bottom + 4;
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const away = (e: PointerEvent) => !(e.target as HTMLElement).closest("[data-icon-picker]") && e.target !== anchor && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => (window.removeEventListener("pointerdown", away), window.removeEventListener("keydown", esc));
  }, [anchor, onClose]);

  const add = async (file: File) => {
    if (!gid) return;
    const n = await addIconFile(file, (f) => achievementIconPath(gid, f), (f) => names.some((x) => x.toLowerCase() === f.toLowerCase()));
    if (n) onPick(n);
  };

  return createPortal(
    <div data-icon-picker className="nowheel nodrag fixed z-[90] flex w-[360px] flex-col rounded-md border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] shadow-2xl" style={{ left, top, maxHeight: 340 }}>
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <span className="flex-1 truncate text-[var(--text-dim)]">{gid ? `Icons/${gid}/` : "Create or open a group first"}</span>
        <Button disabled={!gid} onClick={() => picker.current?.click()}>Add icon…</Button>
        <input ref={picker} type="file" accept=".dds,image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void add(f); }} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-auto p-2">
        <button className="grid h-[88px] place-items-center rounded border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:bg-white/5" onClick={() => onPick("")}>No icon</button>
        {names.map((n) => (
          <button key={n} title={n} onClick={() => onPick(n)} className={`flex flex-col items-center gap-1 rounded p-1 hover:bg-white/10 ${n === current ? "bg-white/10 ring-1 ring-white/40" : ""}`}>
            <IconThumb path={gid ? achievementIconPath(gid, n) : undefined} size={64} title={n} />
            <span className="w-full truncate text-center text-[10px]">{n}</span>
          </button>
        ))}
        {!names.length && (
          <p className="col-span-3 self-center text-[var(--text-dim)]">
            {known ? "No icons in this folder yet. Add one." : "This browser view cannot list icons. Open the folder to browse them, or type a file name or add one."}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The group's own icon (`Icons/<Group>.dds`), shown on the group page. */
export function GroupIcon() {
  const fileName = useApp((s) => s.fileName);
  const known = useApp((s) => s.iconFiles !== null);
  const gid = fileName ? groupId(fileName) : null;
  const path = gid ? groupIconPath(gid) : undefined;
  const state = useIcon(path, 128);
  const picker = useRef<HTMLInputElement>(null);
  const problems = iconProblems(state);

  return (
    <div className="flex max-w-xl items-start gap-4">
      <IconThumb path={path} size={128} title={path} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-[var(--text-dim)]">{path ?? "Create or open a group first"}</div>
        {state.status === "ready" && <div>{state.info.width}×{state.info.height} · {state.info.label}{problems.length === 0 && " ✓"}</div>}
        {state.status === "missing" && <div className="text-[var(--text-dim)]">{known ? "No icon yet: the game shows its default." : "Open the folder to see the current icon."}</div>}
        {problems.map((p) => (
          <div key={p} className="text-[var(--status-warning)]">{p}</div>
        ))}
        <Button disabled={!gid} onClick={() => picker.current?.click()}>Choose icon…</Button>
        <input ref={picker} type="file" accept=".dds,image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && gid) void addIconFile(f, () => groupIconPath(gid)); }} />
      </div>
    </div>
  );
}
