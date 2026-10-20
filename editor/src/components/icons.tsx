import { useEffect, useRef, useState } from "react";
import { decodeDds, parseDds, scaleRgba, type DdsInfo, type Rgba } from "../io/dds";
import { useApp } from "../store";

export type IconState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string; info?: DdsInfo }
  | { status: "ready"; info: DdsInfo; image: Rgba };

// Decoding a 512x512 icon is cheap, but a picker shows dozens; decoded thumbnails are kept until icon files change.
const cache = new Map<string, Promise<IconState>>();
let cacheVersion = -1;

async function bytesOf(path: string): Promise<Uint8Array | undefined> {
  const s = useApp.getState();
  return s.pendingIcons[path] ?? (await s.workspace?.icons?.read(path));
}

export function loadIcon(path: string, size: number): Promise<IconState> {
  const s = useApp.getState();
  if (cacheVersion !== s.iconVersion) (cache.clear(), (cacheVersion = s.iconVersion));
  const key = `${s.workspace?.label}|${path}|${size}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async (): Promise<IconState> => {
      const bytes = await bytesOf(path);
      if (!bytes) return { status: "missing" };
      const parsed = parseDds(bytes);
      if (!parsed.ok) return { status: "error", message: parsed.error };
      try {
        return { status: "ready", info: parsed.info, image: scaleRgba(decodeDds(bytes, parsed.info), size) };
      } catch (e) {
        return { status: "error", message: e instanceof Error ? e.message : String(e), info: parsed.info };
      }
    })();
    cache.set(key, hit);
  }
  return hit;
}

/** The icon at `path` (under AchievementsData), scaled to `size`. Reloads when icon files change. */
export function useIcon(path: string | undefined, size: number): IconState {
  const version = useApp((s) => s.iconVersion);
  const workspace = useApp((s) => s.workspace);
  const [state, setState] = useState<IconState>({ status: "loading" });
  useEffect(() => {
    if (!path) return setState({ status: "missing" });
    let live = true;
    void loadIcon(path, size).then((r) => live && setState(r));
    return () => void (live = false);
  }, [path, size, version, workspace]);
  return state;
}

const checker = "repeating-conic-gradient(#3a3a40 0% 25%, #28282c 0% 50%) 50% / 8px 8px";

/** What to tell the author about an icon, or nothing when it is fine. */
export const iconProblems = (s: IconState) => (s.status === "ready" ? s.info.problems : s.status === "error" ? [s.message, ...(s.info?.problems ?? [])] : []);

/** An icon preview. Amber when the file has a problem (wrong size, format the game cannot read), dashed when it is missing. */
export function IconThumb({ path, size, title }: { path: string | undefined; size: number; title?: string }) {
  const state = useIcon(path, size);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || state.status !== "ready") return;
    c.getContext("2d")?.putImageData(new ImageData(state.image.data as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
  }, [state, size]);

  const problems = iconProblems(state);
  const border = state.status === "error" ? "var(--status-error)" : problems.length ? "var(--status-warning)" : state.status === "missing" ? "var(--border)" : "var(--border)";
  const tip = [title ?? path, state.status === "ready" ? `${state.info.width}×${state.info.height} · ${state.info.label}` : state.status === "missing" ? "Not found" : "", ...problems].filter(Boolean).join("\n");

  return (
    <span
      title={tip}
      className="relative inline-block shrink-0 overflow-hidden rounded-sm"
      style={{ width: size, height: size, border: `1px ${state.status === "missing" ? "dashed" : "solid"} ${border}`, background: state.status === "ready" ? checker : undefined }}
    >
      {state.status === "ready" && <canvas ref={canvas} width={size} height={size} style={{ width: size, height: size, display: "block" }} />}
      {(state.status === "missing" || state.status === "error") && (
        <span className="absolute inset-0 grid place-items-center text-[10px] text-[var(--text-dim)]">{state.status === "missing" ? "?" : "!"}</span>
      )}
    </span>
  );
}
