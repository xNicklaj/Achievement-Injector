import { Search } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, nodeDefs, type Category } from "../registry";
import { DRAG_MIME } from "./Canvas";

/** Node group tabs + searchable node list (HANDOVER 3.15). Items are dragged onto the canvas. */
export function NodePanel() {
  const [tab, setTab] = useState<Category>("condition");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const items = nodeDefs.filter(
    (d) => d.category === tab && (!term || [d.title, d.kind, ...d.keywords].some((k) => k.toLowerCase().includes(term))),
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-panel)]">
      <div className="flex shrink-0 items-center gap-1 border-y border-[var(--border)] bg-[var(--bg-app)] px-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setTab(c.id)}
            className={`px-3 py-1 text-[12px] ${tab === c.id ? "bg-[var(--bg-panel)] text-white" : "text-[var(--text-dim)] hover:bg-white/5"}`}
          >
            {c.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-0.5">
          <Search size={12} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search nodes"
            className="w-40 bg-transparent text-[12px] outline-none placeholder:text-[var(--text-dim)]"
          />
        </label>
      </div>
      <ul className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(180px,1fr))] content-start gap-1 overflow-auto p-2">
        {items.map((d) => (
          <li
            key={d.kind}
            draggable
            title={d.description ?? d.title}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, d.kind);
              e.dataTransfer.effectAllowed = "copy";
            }}
            className="flex cursor-grab items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg-node)] px-2 py-1 hover:border-zinc-400 active:cursor-grabbing"
          >
            <span className="h-3 w-1 rounded-sm" style={{ background: `var(--cat-${d.category})` }} />
            <span className="truncate">{d.title}</span>
          </li>
        ))}
        {items.length === 0 && <li className="col-span-full text-[var(--text-dim)]">No matching nodes</li>}
      </ul>
    </div>
  );
}
