import { Braces, ChevronsLeft, ChevronsRight, Database, FileCog, Languages, Workflow } from "lucide-react";
import { useState } from "react";
import { useApp, type View } from "../store";

const ITEMS: { id: View; label: string; icon: typeof Workflow }[] = [
  { id: "group", label: "Group Properties", icon: FileCog },
  { id: "graph", label: "Graph", icon: Workflow },
  { id: "localization", label: "Localization", icon: Languages },
  { id: "plugins", label: "Plugins", icon: Database },
  { id: "json", label: "JSON", icon: Braces },
];

/** Foldable menu: only switches views (HANDOVER 3.15). Folds to an icon rail. */
export function Sidebar() {
  const [open, setOpen] = useState(true);
  const { view, setView } = useApp();
  return (
    <nav className={`flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-panel)] ${open ? "w-48" : "w-10"}`}>
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          title={label}
          onClick={() => setView(id)}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-left ${view === id ? "bg-white/10 text-white" : "text-[var(--text-dim)] hover:bg-white/5"}`}
        >
          <Icon size={16} className="shrink-0" />
          {open && <span className="truncate">{label}</span>}
        </button>
      ))}
      <button title={open ? "Fold menu" : "Unfold menu"} onClick={() => setOpen(!open)} className="mt-auto flex items-center justify-center py-2 hover:bg-white/10">
        {open ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
      </button>
    </nav>
  );
}
