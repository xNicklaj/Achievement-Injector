import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { ArrowUpDown, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { bandsOf, membersOf, movedOrder, viewRect, visibleBands, worstLevel } from "../achievements";
import { focusAchievement } from "../focusAchievement";
import { linkedText } from "../graph";
import { useApp } from "../store";
import { useValidation } from "../validation";
import { remembered } from "../viewport";

type Row = [id: string, name: string];

type ItemProps = {
  id: string;
  name: string;
  level?: string;
  inView: boolean;
  current: boolean;
  folded: boolean;
  /** Can be dragged to a new place (not while the list is filtered, when its places are not all in view). */
  reorder: boolean;
  dragging: boolean;
  /** Where a dragged achievement would land relative to this one. */
  drop?: "before" | "after";
  onJump: (id: string) => void;
  onToggle: (id: string) => void;
  onDragStart: (id: string, e: DragEvent<HTMLElement>) => void;
  onDragOver: (id: string, e: DragEvent<HTMLElement>) => void;
  onDrop: (id: string, e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMove: (id: string, by: -1 | 1) => void;
  setRef: (id: string, el: HTMLDivElement | null) => void;
};

const Item = memo(function Item({ id, name, level, inView, current, folded, reorder, dragging, drop, onJump, onToggle, onDragStart, onDragOver, onDrop, onDragEnd, onMove, setRef }: ItemProps) {
  return (
    <div
      ref={(el) => setRef(id, el)}
      data-row
      onDragOver={(e) => onDragOver(id, e)}
      onDrop={(e) => onDrop(id, e)}
      className={`group relative flex items-center ${dragging ? "opacity-40" : ""} ${current ? "bg-white/20 shadow-[inset_3px_0_0_var(--select)]" : inView ? "bg-white/10" : "hover:bg-white/5"}`}
    >
      {drop && <span className={`pointer-events-none absolute inset-x-0 h-0.5 bg-[var(--select)] ${drop === "before" ? "top-0" : "bottom-0"}`} />}
      {reorder ? (
        <button
          type="button"
          draggable
          aria-label={`Move ${name}: drag it, or press the up or down arrow`}
          title="Drag to reorder"
          onDragStart={(e) => onDragStart(id, e)}
          onDragEnd={onDragEnd}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            onMove(id, e.key === "ArrowUp" ? -1 : 1);
          }}
          // Shown on hover or keyboard focus, like the eye.
          className="ml-1 shrink-0 cursor-grab rounded p-0.5 text-[var(--text-dim)] opacity-0 hover:bg-white/10 group-focus-within:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
        >
          <ArrowUpDown size={13} />
        </button>
      ) : (
        <span className="ml-1 w-[17px] shrink-0" />
      )}
      <button
        type="button"
        aria-current={current ? "location" : undefined}
        title={level ? `${name}\n${level === "error" ? "Has an error" : "Has a warning"}` : name}
        onClick={() => onJump(id)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 pl-1 text-left"
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: level === "error" ? "var(--status-error)" : level === "warning" ? "var(--status-warning)" : "transparent" }} />
        <span className="truncate">{name || "(unnamed)"}</span>
      </button>
      <button
        type="button"
        aria-pressed={folded}
        aria-label={folded ? `Expand ${name}` : `Collapse ${name} into one node`}
        title={folded ? "Collapsed into one node: click to expand" : "Collapse into one node"}
        onClick={() => onToggle(id)}
        // The open eye shows on hover or keyboard focus; the shut one stays, since it is what marks a collapsed achievement.
        className={`mx-1 shrink-0 cursor-pointer rounded p-1 hover:bg-white/10 ${folded ? "text-[var(--text)]" : "text-[var(--text-dim)] opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"}`}
      >
        {folded ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
});

/**
 * Every achievement of the group, with the ones in view marked and the nearest to the centre of the canvas stronger;
 * clicking one selects it and brings all of its nodes into view, its eye collapses the whole achievement into its one Create Achievement node (and back),
 * and dragging its handle puts the achievements in a new order, in the file and down the canvas. Kept in a panel over the canvas, so it follows what you look at.
 */
export function AchievementList() {
  const { fitView } = useReactFlow();
  const [open, setOpen] = useState(remembered.listOpen);
  const [q, setQ] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, HTMLDivElement>());
  const hovering = useRef(false);

  // Each of these is a string, so the panel re-renders only when its own answer changes, not on every drag frame or pan.
  const rowsKey = useApp((s) => JSON.stringify(s.nodes.flatMap((n) => (n.data.kind === "CreateAchievement" ? [[n.id, linkedText(s.nodes, s.edges, s.loc, n, "ach") ?? ""]] : []))));
  const levelsKey = useValidation((v) => {
    const { nodes, edges } = useApp.getState();
    const out: Record<string, string> = {};
    for (const n of nodes) {
      const level = n.data.kind === "CreateAchievement" ? worstLevel(v.byNode, membersOf(nodes, edges, n.id)) : undefined;
      if (level) out[n.id] = level;
    }
    return JSON.stringify(out);
  });
  const viewKey = useStore((s) => {
    const { nodes, edges, collapsed } = useApp.getState();
    const { ids, current } = visibleBands(bandsOf(nodes, edges, collapsed), viewRect(s.transform, s.width, s.height));
    return `${current ?? ""}|${ids.join(",")}`;
  });

  const folded = useApp((s) => s.collapsed);
  const rows = useMemo(() => JSON.parse(rowsKey) as Row[], [rowsKey]);
  const levels = useMemo(() => JSON.parse(levelsKey) as Record<string, string>, [levelsKey]);
  const [current, seen] = useMemo(() => {
    const [c, ids] = viewKey.split("|");
    return [c, new Set(ids ? ids.split(",") : [])] as const;
  }, [viewKey]);
  const shown = useMemo(() => (q.trim() ? rows.filter(([, name]) => name.toLowerCase().includes(q.trim().toLowerCase())) : rows), [rows, q]);

  // Follow the canvas, unless the list is being used: scrolling it under the pointer would run away from the hand.
  useEffect(() => {
    const box = list.current;
    const el = current ? items.current.get(current) : undefined;
    if (!open || !box || !el || hovering.current) return;
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight;
  }, [current, open, shown]);

  // Selects it too, so it is marked on the canvas as well as in the list.
  const jump = useMemo(() => (id: string) => focusAchievement(id, fitView), [fitView]);
  const toggle = useApp((s) => s.toggleCollapsed);

  // Reordering: the handle of a row is dragged onto another row, above or below its middle.
  const reorder = useApp((s) => s.reorderAchievements);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const from = useRef<string | null>(null);
  const order = useRef<string[]>([]);
  order.current = rows.map(([id]) => id);
  const after = (e: DragEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2;
  };
  const drag = useMemo(
    () => ({
      start: (id: string, e: DragEvent<HTMLElement>) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id); // Firefox starts no drag without it
        const row = e.currentTarget.closest("[data-row]");
        if (row) e.dataTransfer.setDragImage(row, 16, 10);
        from.current = id;
        setDragging(id);
      },
      over: (id: string, e: DragEvent<HTMLElement>) => {
        if (!from.current) return; // something else is being dragged over the list
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const a = after(e);
        setDrop((d) => (d?.id === id && d.after === a ? d : { id, after: a }));
      },
      drop: (id: string, e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        const moving = from.current;
        const next = moving ? movedOrder(order.current, moving, id, after(e)) : order.current;
        if (next !== order.current) reorder(next);
        drag.end();
      },
      end: () => {
        from.current = null;
        setDragging(null);
        setDrop(null);
      },
      move: (id: string, by: -1 | 1) => {
        const at = order.current.indexOf(id) + by;
        const next = order.current[at] ? movedOrder(order.current, id, order.current[at], by > 0) : order.current;
        if (next !== order.current) reorder(next);
      },
    }),
    [reorder],
  );
  const setRef = useMemo(() => (id: string, el: HTMLDivElement | null) => void (el ? items.current.set(id, el) : items.current.delete(id)), []);

  if (!rows.length) return null;
  return (
    <Panel position="top-left" className="nodrag nowheel nopan" style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100% - 210px)", width: 224 }}>
      <div className="flex min-h-0 flex-1 flex-col rounded-md border border-[var(--border)] bg-[var(--bg-panel)]/95 text-[12px] shadow-lg">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((remembered.listOpen = !open))}
          className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-1.5 text-left font-semibold"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Achievements
          <span className="ml-auto font-normal text-[var(--text-dim)]">{q.trim() ? `${shown.length} of ${rows.length}` : rows.length}</span>
        </button>
        {open && (
          <>
            {rows.length > 6 && (
              <input
                className="mx-2 mb-1 rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-[3px] text-[12px] text-[var(--text)] outline-none focus:border-zinc-400"
                placeholder="Filter"
                aria-label="Filter achievements"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            )}
            <div
              ref={list}
              className="relative min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)] py-1"
              onPointerEnter={() => (hovering.current = true)}
              onPointerLeave={() => (hovering.current = false)}
            >
              {shown.map(([id, name]) => (
                <Item
                  key={id}
                  id={id}
                  name={name}
                  level={levels[id]}
                  inView={seen.has(id)}
                  current={id === current}
                  folded={!!folded[id]}
                  reorder={!q.trim()}
                  dragging={dragging === id}
                  drop={drop?.id === id && dragging !== id ? (drop.after ? "after" : "before") : undefined}
                  onJump={jump}
                  onToggle={toggle}
                  onDragStart={drag.start}
                  onDragOver={drag.over}
                  onDrop={drag.drop}
                  onDragEnd={drag.end}
                  onMove={drag.move}
                  setRef={setRef}
                />
              ))}
              {!shown.length && <div className="px-2 py-1 text-[var(--text-dim)]">No match</div>}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
