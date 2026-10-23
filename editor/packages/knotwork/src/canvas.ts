import { SelectionMode, useReactFlow } from "@xyflow/react";
import { useEffect, useRef, type RefObject } from "react";
import { createWheelClassifier, wheelPixels, zoomFactor } from "./wheel";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;

/** ReactFlow props for the navigation model; spread them on <ReactFlow>. */
export const NAVIGATION_PROPS = {
  // Only nodes and wires in view are mounted, so a big group costs what is on screen. A node is always mounted until it has been
  // measured once (so a freshly opened file mounts everything one time), and undo keeps the measured sizes (store.test.ts).
  onlyRenderVisibleElements: true,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  // A touchpad tap jitters; without a threshold it nudges nodes. A double-tap must not zoom.
  nodeDragThreshold: 4,
  zoomOnDoubleClick: false,
  connectionRadius: 32,
  // Same for every device: left-drag on empty space selects; right-drag, middle-drag or Space+drag pans; pinch and
  // ctrl+wheel zoom. Plain wheel is handled by useWheelNavigation, so React Flow's own scroll handling is off.
  zoomOnScroll: false,
  panOnScroll: false,
  zoomOnPinch: true,
  selectionOnDrag: true,
  panOnDrag: [1, 2],
  selectionMode: SelectionMode.Partial,
};

/**
 * Mouse and touchpad share one canvas: a touchpad scroll pans, a mouse notch zooms at the cursor.
 * Ctrl+wheel and pinch fall through to React Flow, which always zooms. Fields and the minimap keep their own wheel.
 * Call inside the ReactFlow provider.
 */
export function useWheelNavigation(ref: RefObject<HTMLElement | null>) {
  const { getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const el = ref.current;
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
  }, [ref, getViewport, setViewport]);
}

/** True while the key event comes from a text field or button, where shortcuts must not fire. */
export const isTyping = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest("input, textarea, select, button, [contenteditable]");

/**
 * Space opens a menu at the pointer (or the middle of `ref` when it has not been over it).
 * It opens on release, and only if not cancelled meanwhile, because Space + drag pans: call `cancel()` from onMoveStart.
 */
export function useSpaceMenu(ref: RefObject<HTMLElement | null>, open: (p: { x: number; y: number }) => void) {
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const armed = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const move = (e: PointerEvent) => (pointer.current = { x: e.clientX, y: e.clientY });
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e)) return;
      armed.current = !e.ctrlKey && !e.metaKey && !e.altKey;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !armed.current) return;
      armed.current = false;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      openRef.current({ x: pointer.current?.x ?? r.left + r.width / 2, y: pointer.current?.y ?? r.top + r.height / 2 });
    };
    const el = ref.current;
    el?.addEventListener("pointermove", move);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => (el?.removeEventListener("pointermove", move), window.removeEventListener("keydown", down), window.removeEventListener("keyup", up));
  }, [ref]);
  return { cancel: () => void (armed.current = false) };
}
