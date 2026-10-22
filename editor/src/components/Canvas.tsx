import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, SelectionMode, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { pinKind, type AppNode } from "../graph";
import { LIVE_TYPES } from "../schema";
import { isCondition, nodeDefs, registry, UNKNOWN_CONDITION } from "../registry";
import { beginDrag, endDrag, useApp } from "../store";
import { useValidation } from "../validation";
import { remembered } from "../viewport";
import { createWheelClassifier, wheelPixels, zoomFactor } from "../wheel";
import { spawnOptions, type SpawnFrom, type SpawnOption } from "../spawn";
import { AeEdge } from "./AeEdge";
import { hiddenOf, hideNodes } from "../achievements";
import { AchievementList } from "./AchievementList";
import { FindBar } from "./FindBar";
import { GraphNode } from "./GraphNode";
import { SpawnMenu } from "./SpawnMenu";

export const DRAG_MIME = "application/ae-node";
const nodeTypes = { ae: GraphNode };
const edgeTypes = { ae: AeEdge };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

const EDGE_COLOR = { flow: "var(--pin-flow)", cond: "var(--pin-condition)", loc: "var(--pin-localized)", ach: "var(--pin-achievement)", icon: "var(--pin-icon)", plugin: "var(--pin-plugin)" };

export function Canvas() {
  const { nodes, edges, collapsed, onNodesChange, onEdgesChange, onConnect, isValid, addNode, addNodeConnected } = useApp();
  const [menu, setMenu] = useState<{ x: number; y: number; from: SpawnFrom | null } | null>(null);
  // Right-click on a condition: the same menu, listing the condition types to replace it with.
  const [replace, setReplace] = useState<{ x: number; y: number; ids: string[]; title: string; kinds: string[]; live: boolean } | null>(null);
  const closeMenu = useCallback(() => (setMenu(null), setReplace(null)), []);
  const { screenToFlowPosition, getViewport, setViewport, fitView } = useReactFlow();
  const box = useRef<HTMLDivElement>(null);

  // Mouse and touchpad share one canvas: a touchpad scroll pans, a mouse notch zooms at the cursor.
  // Ctrl+wheel and pinch fall through to React Flow, which always zooms. Fields and the minimap keep their own wheel.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const classify = createWheelClassifier();
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement).closest(".nowheel, .react-flow__minimap, .react-flow__controls")) return;
      e.preventDefault();
      e.stopPropagation();
      const { x, y, zoom } = getViewport();
      if (classify(e) === "pan") return void setViewport({ x: x - e.deltaX, y: y - e.deltaY, zoom });
      // Mouse wheel: Shift pans sideways, otherwise zoom keeping the point under the cursor fixed.
      if (e.shiftKey) return void setViewport({ x: x - wheelPixels(e), y, zoom });
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor(e)));
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      setViewport({ x: cx - ((cx - x) * next) / zoom, y: cy - ((cy - y) * next) / zoom, zoom: next });
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [getViewport, setViewport]);

  // Space opens the same menu as right-click, at the pointer (or the middle of the canvas when it has not been over it).
  // It opens on release, and only if the canvas was not panned meanwhile, because Space + drag pans.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const spaceArmed = useRef(false);
  const [find, setFind] = useState(false);
  useEffect(() => {
    const typing = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest("input, textarea, select, button, [contenteditable]");
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") return (e.preventDefault(), setFind(true));
      if (e.code === "Space" && !e.repeat) spaceArmed.current = !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !spaceArmed.current) return;
      spaceArmed.current = false;
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenu({ x: pointer.current?.x ?? r.left + r.width / 2, y: pointer.current?.y ?? r.top + r.height / 2, from: null });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => (window.removeEventListener("keydown", down), window.removeEventListener("keyup", up));
  }, []);

  // "Tidy up" moves every node; look at the result.
  useEffect(() => {
    const fit = () => void fitView({ duration: 300 });
    window.addEventListener("ae-fit", fit);
    return () => window.removeEventListener("ae-fit", fit);
  }, [fitView]);

  // Flow lines are white, data lines are coloured by type (HANDOVER 3.6). The inline stroke beats React Flow's own selected
  // colour, so a selected wire gets a halo like a selected node does (AeEdge).
  // A collapsed achievement hides its nodes and the wires that touch them (React Flow does not hide those by itself). Which ones follows from
  // the wires, not the positions, so it is not worked out again on every drag frame.
  const hidden = useMemo(() => hiddenOf(nodes, edges, collapsed), [edges, collapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => hideNodes(nodes, hidden), [nodes, hidden]);
  const styledEdges = useMemo(
    () => edges.map((e) => ({ ...e, type: "ae", ...((hidden.has(e.source) || hidden.has(e.target)) && { hidden: true }), style: { stroke: EDGE_COLOR[pinKind(e.sourceHandle) ?? "flow"] } })),
    [edges, hidden],
  );

  const options = useMemo(() => (menu ? spawnOptions(nodes, edges, menu.from) : []), [menu, nodes, edges]);
  const openReplace = (e: { clientX: number; clientY: number; preventDefault: () => void }, group: AppNode[]) => {
    group = group.filter((n) => isCondition(n.data.kind));
    if (!group.length) return; // nothing to replace: leave the browser's menu alone
    e.preventDefault();
    setMenu(null);
    const name = (n: AppNode) => (n.data.kind === UNKNOWN_CONDITION ? String(n.data.extra?.type ?? "unknown") : registry[n.data.kind].title);
    const names = [...new Set(group.map(name))];
    const what = names.length === 1 ? `"${names[0]}" ` : "";
    // A condition that feeds Live or Negate can only become a type that supports them.
    const live = group.some((n) => edges.some((x) => x.source === n.id && x.sourceHandle === "cond-out" && registry[nodes.find((m) => m.id === x.target)?.data.kind ?? ""]?.modifier));
    setReplace({ x: e.clientX, y: e.clientY, ids: group.map((n) => n.id), kinds: [...new Set(group.map((n) => n.data.kind))], live, title: group.length > 1 ? `Replace ${group.length} ${what}conditions with` : `Replace ${what}with` });
  };
  const replacements = useMemo(
    () => nodeDefs.filter((d) => d.category === "condition").map((def) => ({ def, label: def.title })).sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );
  const pick = (o: SpawnOption) => {
    if (!menu) return;
    const at = screenToFlowPosition({ x: menu.x, y: menu.y });
    // A node made from an input pin sits to the left of the cursor so its output meets the wire; otherwise its input does.
    const left = menu.from?.handleType === "target";
    addNodeConnected(o.def.kind, { x: at.x - (left ? 288 : 0), y: at.y - 14 }, menu.from && o.pin ? { from: menu.from, pin: o.pin } : undefined);
    setMenu(null);
  };

  const onDrop = (e: DragEvent) => {
    const kind = e.dataTransfer.getData(DRAG_MIME);
    if (!kind) return;
    e.preventDefault();
    addNode(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  return (
    <div ref={box} className="h-full w-full" onPointerMove={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}>
    <ReactFlow
      colorMode="dark"
      nodes={shown}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValid}
      onNodeDragStart={beginDrag}
      onNodeDragStop={endDrag}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) (e.preventDefault(), (e.dataTransfer.dropEffect = "copy"));
      }}
      onDrop={onDrop}
      // Dropping a wire on empty canvas opens the node menu for what can take it; right-click opens every node (HANDOVER 3.5).
      onConnectEnd={(event, state) => {
        if (state.isValid || state.toNode || !state.fromNode || !state.fromHandle?.id) return;
        const p = "changedTouches" in event ? event.changedTouches[0] : event;
        setMenu({ x: p.clientX, y: p.clientY, from: { nodeId: state.fromNode.id, handleId: state.fromHandle.id, handleType: state.fromHandle.type } });
      }}
      onNodeDoubleClick={(e, node) => {
        // Double-clicking a field selects text; only the node's frame and title focus it.
        if (!(e.target as HTMLElement).closest("input, textarea, select, button")) void fitView({ nodes: [{ id: node.id }], duration: 300, maxZoom: 1.2, padding: 0.3 });
      }}
      onNodeContextMenu={(e, node) => {
        // On one of several selected nodes it replaces the conditions among them together; otherwise just this one.
        // A text field keeps the browser's own menu (copy and paste), and so does any node that is not a condition.
        if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
        const picked = node.selected ? nodes.filter((n) => n.selected && isCondition(n.data.kind)) : [];
        openReplace(e, picked.length > 1 ? picked : [node as AppNode]);
      }}
      // With several nodes selected React Flow puts a rectangle over them that takes the right-click, so no node gets it.
      onSelectionContextMenu={(e, selected) => openReplace(e, selected as AppNode[])}
      onPaneContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: (e as unknown as MouseEvent).clientX, y: (e as unknown as MouseEvent).clientY, from: null });
      }}
      onPaneClick={closeMenu}
      onMoveStart={() => ((spaceArmed.current = false), closeMenu())}
      deleteKeyCode={["Delete", "Backspace"]}
      // Only nodes and wires in view are mounted, so a big group costs what is on screen. A node is always mounted until it has been
      // measured once (so a freshly opened file mounts everything one time), and undo keeps the measured sizes (store.test.ts).
      onlyRenderVisibleElements
      fitView={!remembered.viewport}
      defaultViewport={remembered.viewport ?? undefined}
      onMoveEnd={(_, v) => (remembered.viewport = v)}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      // A touchpad tap jitters; without a threshold it nudges nodes. A double-tap must not zoom.
      nodeDragThreshold={4}
      zoomOnDoubleClick={false}
      connectionRadius={32}
      // Same for every device: left-drag on empty space selects; right-drag, middle-drag or Space+drag pans; pinch and
      // ctrl+wheel zoom. Plain wheel is handled above, so React Flow's own scroll handling is off.
      zoomOnScroll={false}
      panOnScroll={false}
      zoomOnPinch
      selectionOnDrag
      panOnDrag={[1, 2]}
      selectionMode={SelectionMode.Partial}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} />
      <Controls />
      <AchievementList />
      <MiniMap
        pannable
        zoomable
        // A selected node gets a bright outline here too.
        nodeStrokeColor={(n) => (n.selected ? "var(--select)" : "transparent")}
        nodeStrokeWidth={4}
        // Invalid nodes show red/amber on the minimap (HANDOVER 3.9).
        nodeColor={(n) => {
          const d = (n as AppNode).data;
          const level = useValidation.getState().byNode[n.id]?.split("|")[0];
          return level === "error" ? "var(--status-error)" : level === "warning" ? "var(--status-warning)" : `var(--cat-${registry[d.kind].category})`;
        }}
      />
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[var(--text-dim)]">
          Drag a node from the list below onto the canvas
        </div>
      )}
    </ReactFlow>
    {replace && (
      <SpawnMenu
        x={replace.x}
        y={replace.y}
        options={replacements.filter((o) => (replace.kinds.length !== 1 || o.def.kind !== replace.kinds[0]) && (!replace.live || LIVE_TYPES.has(o.def.kind)))}
        onPick={(o) => (useApp.getState().replaceConditions(replace.ids, o.def.kind), setReplace(null))}
        onClose={closeMenu}
        title={replace.title}
      />
    )}
    {find && <FindBar nodes={shown} hidden={hidden} onClose={() => setFind(false)} />}
    {menu && <SpawnMenu x={menu.x} y={menu.y} options={options} onPick={pick} onClose={closeMenu} title={menu.from ? "Create a node that connects here" : "Add a node"} />}
    </div>
  );
}
