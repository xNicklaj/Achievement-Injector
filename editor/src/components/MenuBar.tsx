import { CircleHelp, Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { message } from "./dialogs";
import { newGroup, openFiles, openFolder, saveFile } from "../io/fileActions";
import { TARGET_VERSION } from "../schema";
import { isDirty, useApp } from "../store";

const btn = "flex items-center gap-1 rounded px-2 py-0.5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent";
const item = "flex w-full items-center justify-between gap-6 px-3 py-1 text-left hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent";

const NAV_HELP = [
  "Scroll (touchpad two-finger or mouse wheel): a touchpad scroll pans, a mouse wheel zooms at the cursor.",
  "Pinch, or Ctrl + scroll: zoom, on any device.",
  "Shift + mouse wheel: pan sideways.",
  "Drag on empty space: select several nodes.",
  "Right-drag, middle-drag or Space + drag: pan.",
  "Delete or Backspace: remove the selected nodes or wires.",
].join("\n");

const hasFolderAccess = typeof window !== "undefined" && "showDirectoryPicker" in window;

/** Unsaved-changes flag. Debounced: comparing the whole document on every drag frame would be wasteful. */
export function useDirty() {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const check = () => (clearTimeout(t), (t = setTimeout(() => setDirty(isDirty()), 250)));
    check();
    const off = useApp.subscribe(check);
    return () => (off(), clearTimeout(t));
  }, []);
  return dirty;
}

function FileMenu() {
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const dirPicker = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const run = (fn: () => void) => () => (setOpen(false), fn());
  return (
    <div ref={root} className="relative">
      <button className={btn} onClick={() => setOpen(!open)}>File</button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-56 rounded-b border border-[var(--border)] bg-[var(--bg-panel)] py-1 shadow-xl">
          <button className={item} onClick={run(newGroup)}>New group…</button>
          <button
            className={item}
            title={hasFolderAccess ? "Open the AchievementsData folder: a group loads with its localization files and saves in place" : "Open the AchievementsData folder: a group loads with its localization files; saving downloads files"}
            onClick={run(() => (hasFolderAccess ? void openFolder() : dirPicker.current?.click()))}
          >
            Open folder…
          </button>
          <button className={item} onClick={run(() => picker.current?.click())} title="Pick a group's .json and, optionally, its localization .txt files">Open files…</button>
          <button className={item} onClick={run(saveFile)}>Save <span className="text-[var(--text-dim)]">Ctrl+S</span></button>
        </div>
      )}
      <input
        ref={dirPicker}
        type="file"
        hidden
        // Directory picker for browsers without the File System Access API (Firefox).
        {...{ webkitdirectory: "", directory: "" }}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void openFolder(files);
        }}
      />
      <input
        ref={picker}
        type="file"
        multiple
        accept=".json,.txt,application/json,text/plain"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ""; // allow re-opening the same files
          if (files.length) void openFiles(files);
        }}
      />
    </div>
  );
}

export function MenuBar() {
  const { undo, redo, pastStates, futureStates } = useStore(useApp.temporal, (s) => s);
  const fileName = useApp((s) => s.fileName);
  const workspace = useApp((s) => s.workspace);
  const dirty = useDirty();
  return (
    <header className="flex h-6 shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--bg-panel)] px-2 text-[12px]">
      <FileMenu />
      <button className={btn} onClick={() => undo()} disabled={!pastStates.length} title="Undo (Ctrl+Z)"><Undo2 size={13} />Undo</button>
      <button className={btn} onClick={() => redo()} disabled={!futureStates.length} title="Redo (Ctrl+Shift+Z)"><Redo2 size={13} />Redo</button>
      {fileName && (
        <span className="ml-3 text-[var(--text-dim)]" title={dirty ? "Unsaved changes" : workspace ? `In ${workspace.label}` : undefined}>
          {workspace?.kind === "folder" && `${workspace.label} / `}
          {fileName}
          {dirty && <span className="ml-1 text-[var(--status-warning)]">●</span>}
        </span>
      )}
      <button className={`${btn} ml-auto`} onClick={() => void message("Moving around the canvas", NAV_HELP)}><CircleHelp size={13} />Controls</button>
      <span className="ml-3 text-[var(--text-dim)]">Targets Achievement Injector {TARGET_VERSION}</span>
    </header>
  );
}
