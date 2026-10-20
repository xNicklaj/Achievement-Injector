import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES } from "../registry";
import { matchesSpawn, type SpawnOption } from "../spawn";

const WIDTH = 300;
const HEIGHT = 380;

/**
 * Searchable node menu at the cursor (HANDOVER 3.5). Opened by dropping a wire on empty canvas (only the types that
 * can take that wire) or by right-clicking it (every type). Arrow keys move, Enter creates, Escape closes.
 */
export function SpawnMenu({ x, y, options, onPick, onClose, title }: { x: number; y: number; options: SpawnOption[]; onPick: (o: SpawnOption) => void; onClose: () => void; title: string }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const shown = useMemo(() => options.filter((o) => matchesSpawn(o, q)), [options, q]);

  // Keep the menu on screen near the cursor.
  const left = Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - HEIGHT - 8));

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector("[data-active=true]")?.scrollIntoView({ block: "nearest" });
  }, [active, shown]);
  useEffect(() => {
    const away = (e: PointerEvent) => !(e.target as HTMLElement).closest("[data-spawn-menu]") && onClose();
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [onClose]);

  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") return (e.preventDefault(), setActive((a) => Math.min(a + 1, shown.length - 1)));
    if (e.key === "ArrowUp") return (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    if (e.key === "Enter" && shown[active]) return (e.preventDefault(), onPick(shown[active]));
  };

  let lastCategory = "";
  return (
    <div
      data-spawn-menu
      role="dialog"
      aria-label={title}
      className="nowheel nodrag fixed z-[90] flex flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl"
      style={{ left, top, width: WIDTH, maxHeight: HEIGHT }}
      onKeyDown={key}
    >
      <div className="border-b border-[var(--border)] px-2 py-1.5">
        <div className="mb-1 text-[11px] text-[var(--text-dim)]">{title}</div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search nodes"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-1 text-[12px] outline-none focus:border-zinc-400"
        />
      </div>
      <ul ref={list} className="min-h-0 flex-1 overflow-auto py-1" role="listbox">
        {shown.map((o, i) => {
          const cat = o.def.category;
          const header = cat !== lastCategory ? ((lastCategory = cat), CATEGORIES.find((c) => c.id === cat)?.label) : null;
          return (
            <li key={`${o.def.kind}:${o.pin ?? ""}`} role="presentation">
              {header && <div className="px-3 pb-0.5 pt-1.5 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{header}</div>}
              <button
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${i === active ? "bg-white/10" : "hover:bg-white/5"}`}
                onMouseMove={() => setActive(i)}
                onClick={() => onPick(o)}
              >
                <span className="h-3 w-1 shrink-0 rounded-sm" style={{ background: `var(--cat-${cat})` }} />
                <span className="truncate">{o.label}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-2 text-[var(--text-dim)]">{options.length ? "No matching nodes" : "Nothing can connect to this pin"}</li>}
      </ul>
    </div>
  );
}
