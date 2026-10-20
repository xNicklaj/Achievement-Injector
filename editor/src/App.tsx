import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "./components/Canvas";
import { DialogHost } from "./components/Dialog";
import { GroupProperties } from "./components/GroupProperties";
import { JsonView } from "./components/JsonView";
import { LocalizationTable } from "./components/LocalizationTable";
import { MenuBar } from "./components/MenuBar";
import { NodePanel } from "./components/NodePanel";
import { Sidebar } from "./components/Sidebar";
import { saveFile } from "./io/fileActions";
import { isDirty, useApp } from "./store";

const MIN_PANEL = 80;

export function App() {
  const view = useApp((s) => s.view);
  const [panelH, setPanelH] = useState(220);
  const dragging = useRef(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Ctrl+S saves even from a text field; undo/redo must leave text fields to the browser.
      if (e.key === "s") return (e.preventDefault(), saveFile());
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      const t = useApp.temporal.getState();
      if (e.key === "z") (e.preventDefault(), e.shiftKey ? t.redo() : t.undo());
      if (e.key === "y") (e.preventDefault(), t.redo());
    };
    // Closing the tab with unsaved changes asks first (HANDOVER 3.8).
    const leave = (e: BeforeUnloadEvent) => isDirty() && e.preventDefault();
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    return () => (window.removeEventListener("keydown", key), window.removeEventListener("beforeunload", leave));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <DialogHost />
      <MenuBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          {view === "group" ? (
            <GroupProperties />
          ) : view === "localization" ? (
            <LocalizationTable />
          ) : view === "json" ? (
            <JsonView />
          ) : (
            <ReactFlowProvider>
              <div className="min-h-0 flex-1">
                <Canvas />
              </div>
              <div
                className="h-1 shrink-0 cursor-row-resize bg-[var(--border)] hover:bg-zinc-400"
                onPointerDown={(e) => ((dragging.current = true), e.currentTarget.setPointerCapture(e.pointerId))}
                onPointerUp={() => (dragging.current = false)}
                onPointerMove={(e) => {
                  if (dragging.current) setPanelH((h) => Math.max(MIN_PANEL, h - e.movementY));
                }}
                onDoubleClick={() => setPanelH(panelH > MIN_PANEL ? MIN_PANEL : 220)}
                title="Drag to resize, double-click to collapse"
              />
              <div style={{ height: panelH }} className="shrink-0">
                <NodePanel />
              </div>
            </ReactFlowProvider>
          )}
        </main>
      </div>
    </div>
  );
}
