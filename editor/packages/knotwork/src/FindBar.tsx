import { useReactFlow, type Node } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";

const MAX = 50;
export const FIND_LABEL = "Find nodes";

const text = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** Nodes whose field values (or title) contain `q`, each with a "key: value" snippet (empty for a title-only match). Stops at `max`; `hidden` ids are skipped. */
export function findNodes<N extends Node>(nodes: N[], hidden: Set<string> | undefined, q: string, titleOf: (n: N) => string, max = MAX): { node: N; snippet: string }[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out: { node: N; snippet: string }[] = [];
  for (const node of nodes) {
    if (hidden?.has(node.id)) continue; // inside a collapsed group: nothing to show
    let snippet: string | null = null;
    for (const [k, v] of Object.entries((node.data as { values?: Record<string, unknown> }).values ?? {})) {
      const s = v == null ? "" : text(v);
      if (s.toLowerCase().includes(needle)) {
        snippet = `${k}: ${s}`;
        break;
      }
    }
    if (snippet === null && titleOf(node).toLowerCase().includes(needle)) snippet = "";
    if (snippet !== null && out.push({ node, snippet }) >= max) break;
  }
  return out;
}

/** Ctrl+F on the graph: find existing nodes by title or field value; Enter or a click picks the node (`onPick`) and zooms to it. */
export function FindBar<N extends Node>({ nodes, hidden, titleOf, accent, onPick, onClose }: { nodes: N[]; hidden?: Set<string>; titleOf: (n: N) => string; accent?: (n: N) => string | undefined; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const { fitView } = useReactFlow();

  const found = useMemo(() => findNodes(nodes, hidden, q, titleOf, MAX), [q, nodes, hidden, titleOf]);

  useEffect(() => setActive(0), [q]);

  const go = (id: string) => {
    onPick(id);
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2, padding: 0.3 });
  };

  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") return (e.preventDefault(), setActive((a) => Math.min(a + 1, found.length - 1)));
    if (e.key === "ArrowUp") return (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    if (e.key === "Enter" && found[active]) return (e.preventDefault(), go(found[active].node.id));
  };

  return (
    <div role="search" className="nowheel nodrag kw-find" style={{ transform: `translate(calc(-50% + ${shift.x}px), ${shift.y}px)` }} onKeyDown={key}>
      <div
        title="Drag to move"
        className="kw-find-drag"
        // Keep focus in the search box.
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => e.buttons && setShift((s) => ({ x: s.x + e.movementX, y: s.y + e.movementY }))}
      />
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onFocus={(e) => e.currentTarget.select()} placeholder="Find nodes by title or value" aria-label={FIND_LABEL} className="kw-find-input" />
      {q.trim() && (
        <ul className="kw-find-list" role="listbox">
          {found.map(({ node, snippet }, i) => (
            <li key={node.id} role="presentation">
              <button role="option" aria-selected={i === active} data-active={i === active} className="kw-find-item" onMouseMove={() => setActive(i)} onClick={() => go(node.id)}>
                <span className="kw-find-swatch" style={{ background: accent?.(node) }} />
                <span className="kw-find-title">{titleOf(node)}</span>
                {snippet && <span className="kw-find-snippet">{snippet}</span>}
              </button>
            </li>
          ))}
          {found.length === 0 && <li className="kw-find-empty">No matching nodes</li>}
          {found.length === MAX && <li className="kw-find-more">First {MAX} shown; type more to narrow</li>}
        </ul>
      )}
    </div>
  );
}
