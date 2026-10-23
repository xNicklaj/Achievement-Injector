import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeDef } from "./defs";
import { matchesSpawn, type SpawnOption } from "./spawn";

const WIDTH = 300;
const HEIGHT = 380;

/** Searchable node menu at the cursor. Arrow keys move, Enter creates, Escape closes, a pointer-down outside closes. */
export function SpawnMenu<D extends NodeDef>({ x, y, options, categories, onPick, onClose, title }: { x: number; y: number; title: string; options: SpawnOption<D>[]; categories: { id: string; label: string }[]; onPick: (o: SpawnOption<D>) => void; onClose: () => void }) {
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
    <div data-spawn-menu role="dialog" aria-label={title} className="nowheel nodrag kw-spawn" style={{ left, top, width: WIDTH, maxHeight: HEIGHT }} onKeyDown={key}>
      <div className="kw-spawn-head">
        <div className="kw-spawn-title">{title}</div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search nodes" className="kw-spawn-search" />
      </div>
      <ul ref={list} className="kw-spawn-list" role="listbox">
        {shown.map((o, i) => {
          const cat = o.def.category;
          const header = cat !== lastCategory ? ((lastCategory = cat), categories.find((c) => c.id === cat)?.label) : null;
          return (
            <li key={`${o.def.kind}:${o.pin ?? ""}`} role="presentation">
              {header && <div className="kw-spawn-cat">{header}</div>}
              <button role="option" aria-selected={i === active} data-active={i === active} className="kw-spawn-item" onMouseMove={() => setActive(i)} onClick={() => onPick(o)}>
                <span className="kw-spawn-swatch" style={{ background: `var(--kw-cat-${cat})` }} />
                <span className="kw-spawn-label">{o.label}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="kw-spawn-empty">{options.length ? "No matching nodes" : "Nothing can connect to this pin"}</li>}
      </ul>
    </div>
  );
}
