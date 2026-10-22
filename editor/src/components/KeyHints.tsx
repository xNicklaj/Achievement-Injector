import { Panel, useStore } from "@xyflow/react";
import { useLayoutEffect, useRef, useState } from "react";
import { isCondition } from "../registry";
import { useApp } from "../store";

type Hint = [keys: string, what: string];

/** What the selection is, as one string so the overlay re-renders only when its answer changes, not on every drag frame. */
function useSelection() {
  return useApp((s) => {
    const sel = s.nodes.filter((n) => n.selected);
    const creates = sel.filter((n) => n.data.kind === "CreateAchievement");
    const folded = creates.length > 0 && creates.every((n) => s.collapsed[n.id]);
    return [sel.length, creates.length, folded ? 1 : 0, sel.some((n) => isCondition(n.data.kind)) ? 1 : 0, s.edges.some((e) => e.selected) ? 1 : 0].join("|");
  });
}

/** The hints as groups, most used first: create or edit, organize, navigate, history. */
function hintsFor(key: string): Hint[][] {
  const [nodes, creates, folded, conditions, wires] = key.split("|").map(Number);
  const nav: Hint = ["Alt ↑ ↓", "Previous / next achievement"];
  const history: Hint[] = [["Ctrl Z", "Undo"], ["Ctrl Y", "Redo"]];
  const groups: Hint[][] = nodes
    ? [
        [["Ctrl C", "Copy"], ["Ctrl D", "Duplicate"], ["Del", nodes > 1 ? `Delete ${nodes} nodes` : "Delete node"]],
        [...(creates ? [["H", folded ? "Unfold achievement" : "Fold achievement"] as Hint] : []), ...(conditions ? [["Right-click", "Replace condition type"] as Hint] : [])],
        [["F", "Zoom to selection"], nav],
      ]
    : wires
      ? [[["Del", "Delete wire"]], [nav]]
      : [[["Space", "Add a node"], ["Ctrl V", "Paste"], ["Ctrl A", "Select all"]], [["Ctrl F", "Find nodes"], ["F", "Zoom to all"], nav], [["Shift H", "Fold all"]]];
  return [...groups, history].filter((g) => g.length);
}

/** Faint, click-through cheat sheet of the keys that do something for the current selection. It gets a background only while a node is behind it. */
export function KeyHints() {
  const selection = useSelection();
  const hints = hintsFor(selection);
  const list = useRef<HTMLUListElement>(null);
  const [overNode, setOverNode] = useState(false);
  // Only the nodes in view are mounted (Canvas), so asking the DOM costs what is on screen. Re-checked when the view, the nodes or the list change.
  const transform = useStore((s) => s.transform);
  const nodes = useApp((s) => s.nodes);
  useLayoutEffect(() => {
    const r = list.current?.getBoundingClientRect();
    if (!r) return;
    const hit = [...document.querySelectorAll(".react-flow__node:not(.hidden)")].some((el) => {
      const n = el.getBoundingClientRect();
      return n.left < r.right && n.right > r.left && n.top < r.bottom && n.bottom > r.top;
    });
    setOverNode(hit);
  }, [transform, nodes, selection]);
  return (
    <Panel position="bottom-right" className="pointer-events-none select-none" style={{ marginBottom: 170 }}>
      <ul ref={list} aria-label="Keyboard shortcuts" className={`rounded-md px-3 py-2 text-[12px] ${overNode ? "bg-black/60" : ""} text-[var(--text-dim)] [text-shadow:0_0_3px_#000,0_1px_2px_#000]`}>
        {hints.map((group, g) =>
          group.map(([keys, what], i) => (
            <li key={keys} className={`flex items-center justify-between gap-4 py-0.5 ${g && !i ? "mt-2" : ""}`}>
              <span>{what}</span>
              <kbd className="rounded border border-white/20 bg-white/5 px-1.5 font-sans text-[11px] text-[var(--text)]">{keys}</kbd>
            </li>
          )),
        )}
      </ul>
    </Panel>
  );
}
