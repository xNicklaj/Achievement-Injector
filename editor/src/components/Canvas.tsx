import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, SelectionMode, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { pinKind, type AppNode } from "../graph";
import { registry } from "../registry";
import { beginDrag, endDrag, useApp } from "../store";
import { useValidation } from "../validation";
import { remembered } from "../viewport";
import { createWheelClassifier, wheelPixels, zoomFactor } from "../wheel";
import { spawnOptions, type SpawnFrom, type SpawnOption } from "../spawn";
import { GraphNode } from "./GraphNode";
import { SpawnMenu } from "./SpawnMenu";

export const DRAG_MIME = "application/ae-node";
const nodeTypes = { ae: GraphNode };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

const EDGE_COLOR = { flow: "var(--pin-flow)", cond: "var(--pin-condition)", loc: "var(--pin-localized)", ach: "var(--pin-achievement)", icon: "var(--pin-icon)", plugin: "var(--pin-plugin)" };

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, isValid, addNode, addNodeConnected } = useApp();
  const [menu, setMenu] = useState<{ x: number; y: number; from: SpawnFrom | null } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
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

  // Ctrl+Space opens the same menu as right-click, at the pointer (or the middle of the canvas when it has not been over it).
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.code !== "Space" || (e.target as HTMLElement).closest("input, textarea, select")) return;
      const el = box.current;
      if (!el) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setMenu({ x: pointer.current?.x ?? r.left + r.width / 2, y: pointer.current?.y ?? r.top + r.height / 2, from: null });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // "Tidy up" moves every node; look at the result.
  useEffect(() => {
    const fit = () => void fitView({ duration: 300 });
    window.addEventListener("ae-fit", fit);
    return () => window.removeEventListener("ae-fit", fit);
  }, [fitView]);

  // Flow lines are white, data lines are coloured by type (HANDOVER 3.6).
  const styledEdges = useMemo(
    () => edges.map((e) => ({ ...e, style: { stroke: EDGE_COLOR[pinKind(e.sourceHandle) ?? "flow"] } })),
    [edges],
  );

  const options = useMemo(() => (menu ? spawnOptions(nodes, edges, menu.from) : []), [menu, nodes, edges]);
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
      nodes={nodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
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
      onPaneContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: (e as unknown as MouseEvent).clientX, y: (e as unknown as MouseEvent).clientY, from: null });
      }}
      onPaneClick={closeMenu}
      onMoveStart={closeMenu}
      deleteKeyCode={["Delete", "Backspace"]}
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
      <MiniMap
        pannable
        zoomable
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
    {menu && <SpawnMenu x={menu.x} y={menu.y} options={options} onPick={pick} onClose={closeMenu} title={menu.from ? "Create a node that connects here" : "Add a node"} />}
    </div>
  );
}
