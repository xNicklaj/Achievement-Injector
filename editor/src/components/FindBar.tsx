import { useReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import type { AppNode } from "../graph";
import { registry, UNKNOWN_CONDITION } from "../registry";
import { useApp } from "../store";

const MAX = 50;

const titleOf = (n: AppNode) => (n.data.kind === UNKNOWN_CONDITION ? `Unknown: ${String(n.data.extra?.type ?? "")}` : registry[n.data.kind]?.title ?? n.data.kind);
const text = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** The first field value containing `q` (lower case), as "key: value"; the node title alone counts as a match too. */
function hit(n: AppNode, q: string): string | null {
  for (const [k, v] of Object.entries(n.data.values)) {
    const s = v == null ? "" : text(v);
    if (s.toLowerCase().includes(q)) return `${k}: ${s}`;
  }
  return titleOf(n).toLowerCase().includes(q) ? "" : null;
}

/** Ctrl+F on the graph: find existing nodes by title or field value; Enter or a click selects the node and zooms to it. */
export function FindBar({ nodes, hidden, onClose }: { nodes: AppNode[]; hidden: Set<string>; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { fitView } = useReactFlow();

  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: { node: AppNode; snippet: string }[] = [];
    for (const node of nodes) {
      if (hidden.has(node.id)) continue; // inside a collapsed achievement: nothing to show
      const snippet = hit(node, needle);
      if (snippet !== null && out.push({ node, snippet }) >= MAX) break;
    }
    return out;
  }, [q, nodes, hidden]);

  useEffect(() => setActive(0), [q]);

  const go = (id: string) => {
    useApp.getState().onNodesChange(nodes.map((n) => ({ type: "select" as const, id: n.id, selected: n.id === id })));
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2, padding: 0.3 });
  };

  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") return (e.preventDefault(), setActive((a) => Math.min(a + 1, found.length - 1)));
    if (e.key === "ArrowUp") return (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    if (e.key === "Enter" && found[active]) return (e.preventDefault(), go(found[active].node.id));
  };

  return (
    <div role="search" className="nowheel nodrag absolute left-1/2 top-2 z-[80] w-[340px] -translate-x-1/2 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl" onKeyDown={key}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="Find nodes by title or value"
        aria-label="Find nodes"
        className="w-full border-b border-[var(--border)] bg-[var(--bg-app)] px-2 py-1.5 text-[12px] outline-none focus:border-zinc-400"
      />
      {q.trim() && (
        <ul className="max-h-[300px] overflow-auto py-1" role="listbox">
          {found.map(({ node, snippet }, i) => (
            <li key={node.id} role="presentation">
              <button
                role="option"
                aria-selected={i === active}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${i === active ? "bg-white/20 shadow-[inset_3px_0_0_var(--select)]" : "hover:bg-white/5"}`}
                onMouseMove={() => setActive(i)}
                onClick={() => go(node.id)}
              >
                <span className="h-3 w-1 shrink-0 rounded-sm" style={{ background: `var(--cat-${registry[node.data.kind]?.category})` }} />
                <span className="shrink-0">{titleOf(node)}</span>
                {snippet && <span className="truncate text-[var(--text-dim)]">{snippet}</span>}
              </button>
            </li>
          ))}
          {found.length === 0 && <li className="px-3 py-2 text-[var(--text-dim)]">No matching nodes</li>}
          {found.length === MAX && <li className="px-3 py-1 text-[11px] text-[var(--text-dim)]">First {MAX} shown; type more to narrow</li>}
        </ul>
      )}
    </div>
  );
}
