import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, SelectionMode, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, type DragEvent } from "react";
import { pinKind, type AppNode } from "../graph";
import { missingRequired, registry, wiredFields } from "../registry";
import { beginDrag, endDrag, useApp } from "../store";
import { createWheelClassifier, wheelPixels, zoomFactor } from "../wheel";
import { GraphNode } from "./GraphNode";

export const DRAG_MIME = "application/ae-node";
const nodeTypes = { ae: GraphNode };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

const EDGE_COLOR = { flow: "var(--pin-flow)", cond: "var(--pin-condition)", loc: "var(--pin-localized)" };

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, isValid, addNode } = useApp();
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();
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

  // Flow lines are white, data lines are coloured by type (HANDOVER 3.6).
  const styledEdges = useMemo(
    () => edges.map((e) => ({ ...e, style: { stroke: EDGE_COLOR[pinKind(e.sourceHandle) ?? "flow"] } })),
    [edges],
  );

  const onDrop = (e: DragEvent) => {
    const kind = e.dataTransfer.getData(DRAG_MIME);
    if (!kind) return;
    e.preventDefault();
    addNode(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  return (
    <div ref={box} className="h-full w-full">
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
      deleteKeyCode={["Delete", "Backspace"]}
      fitView
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
          return missingRequired(registry[d.kind], d.values, wiredFields(useApp.getState().edges, n.id)) ? "var(--status-warning)" : `var(--cat-${registry[d.kind].category})`;
        }}
      />
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[var(--text-dim)]">
          Drag a node from the list below onto the canvas
        </div>
      )}
    </ReactFlow>
    </div>
  );
}
