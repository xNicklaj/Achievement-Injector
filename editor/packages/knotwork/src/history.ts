import type { Node } from "@xyflow/react";
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";

export type TemporalHost<S, P> = StoreApi<S> & { temporal: StoreApi<TemporalState<P>> };

type Typing = { field: string; at: number; space: boolean; slices: unknown[] };

/** Undo plumbing for a zundo store: 30ms entry merging, per-word typing coalescing, one entry per drag. State is per instance. */
export function createHistory<S, P extends { nodes: Node[] }>(o: {
  partialize: (s: S) => P;
  key: (p: P) => string;
  slices: (s: S) => unknown[];
}) {
  // Time of the last history entry; opening a document starts a fresh window.
  let lastRecorded = -Infinity;
  // Edits to the same field within a moment, with no whitespace typed before them, join the entry the word started.
  let typing: Typing | null = null;
  let coalesce = false;
  let dragStart: P | null = null;

  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const typed = (v: unknown) => typeof v === "string" || typeof v === "number" || Array.isArray(v);
  const joinsTyping = (field: string, s: S) =>
    !!typing && typing.field === field && performance.now() - typing.at < 1500 && !typing.space && same(typing.slices, o.slices(s));
  const markTyping = (field: string, value: unknown, s: S) => {
    typing = typed(value) ? { field, at: performance.now(), space: typeof value === "string" && /\s$/.test(value), slices: o.slices(s) } : null;
  };

  return {
    options: {
      partialize: o.partialize,
      equality: (a: P, b: P) => o.key(a) === o.key(b),
      // Updates within 30ms of the last recorded one share its entry, so one Delete (several store updates) is one undo step.
      handleSet: (handleSet: unknown) => {
        return (pastState: unknown, replace: unknown, ...rest: unknown[]) => {
          if (coalesce) return;
          const t = performance.now();
          if (t - lastRecorded < 30) return;
          lastRecorded = t;
          (handleSet as (...a: unknown[]) => void)(pastState, replace, ...rest);
        };
      },
    },
    /** Run an update that continues the current word, so history does not record it separately. */
    edit(field: string, value: unknown, get: () => S, update: () => void) {
      coalesce = typed(value) && joinsTyping(field, get());
      update();
      coalesce = false;
      markTyping(field, value, get());
    },
    /** Pause history while a drag runs. */
    beginDrag(store: TemporalHost<S, P>) {
      dragStart = o.partialize(store.getState());
      store.temporal.getState().pause();
    },
    /** Resume; if the document changed, push one past entry holding the pre-drag positions. */
    endDrag(store: TemporalHost<S, P>) {
      const t = store.temporal.getState();
      t.resume();
      const now = o.partialize(store.getState());
      if (dragStart && o.key(dragStart) !== o.key(now)) {
        const start = new Map(dragStart.nodes.map((n) => [n.id, n.position]));
        const snapshot = { ...now, nodes: now.nodes.map((n) => ({ ...n, position: start.get(n.id) ?? n.position })) };
        store.temporal.setState({ pastStates: [...t.pastStates, snapshot], futureStates: [] });
      }
      dragStart = null;
    },
    reset(store: TemporalHost<S, P>) {
      store.temporal.getState().clear();
      lastRecorded = -Infinity;
    },
  };
}
