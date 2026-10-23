import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import { create } from "zustand";
import { temporal } from "zundo";
import { createHistory } from "./history";

type S = { nodes: Node[]; edges: unknown[]; text: string; other: number; setText: (v: string) => void };
type P = { nodes: Node[]; edges: unknown[]; text: string };

const make = () => {
  const history = createHistory<S, P>({
    partialize: (s) => ({ nodes: s.nodes, edges: s.edges, text: s.text }),
    key: (p) => JSON.stringify({ n: p.nodes.map(({ id, position }) => ({ id, position })), e: p.edges, t: p.text }),
    slices: (s) => [s.nodes],
  });
  const store = create<S>()(
    temporal(
      (set, get) => ({
        nodes: [{ id: "a", position: { x: 0, y: 0 }, data: {}, measured: { width: 5, height: 5 } }] as Node[],
        edges: [],
        text: "",
        other: 0,
        setText: (v) => history.edit("t", v, get, () => set({ text: v })),
      }),
      history.options,
    ),
  );
  return { history, store };
};

let now = 0;
beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

const past = (s: ReturnType<typeof make>["store"]) => s.temporal.getState().pastStates.length;

describe("history", () => {
  it("does not record an unchanged update", () => {
    const { store } = make();
    store.setState({ other: 1 });
    expect(past(store)).toBe(0);
  });

  it("merges updates within 30ms into one entry", () => {
    const { store } = make();
    store.setState({ edges: [1] });
    now += 10;
    store.setState({ edges: [1, 2] });
    now += 50;
    store.setState({ edges: [1, 2, 3] });
    expect(past(store)).toBe(2);
  });

  it("coalesces typing per word and starts a new word after a space", () => {
    const { store } = make();
    for (const v of ["h", "he", "hel"]) {
      now += 100;
      store.getState().setText(v);
    }
    expect(past(store)).toBe(1);
    now += 100;
    store.getState().setText("hel ");
    now += 100;
    store.getState().setText("hel w");
    now += 100;
    store.getState().setText("hel wo");
    expect(past(store)).toBe(2);
  });

  it("ends the word when a slice identity changes", () => {
    const { store } = make();
    now += 100;
    store.getState().setText("a");
    now += 100;
    store.getState().setText("ab");
    now += 100;
    store.setState({ nodes: [...store.getState().nodes] });
    now += 100;
    store.getState().setText("abc");
    expect(past(store)).toBe(2);
  });

  it("records one entry per drag, restoring pre-drag positions and keeping measured", () => {
    const { store, history } = make();
    history.beginDrag(store);
    for (const x of [5, 10, 20]) {
      now += 100;
      store.setState({ nodes: [{ ...store.getState().nodes[0], position: { x, y: 0 } }] });
    }
    expect(past(store)).toBe(0);
    history.endDrag(store);
    expect(past(store)).toBe(1);
    const kept = store.temporal.getState().pastStates[0] as { nodes: { measured?: unknown }[] };
    expect(kept.nodes[0]?.measured).toEqual({ width: 5, height: 5 });
    store.temporal.getState().undo();
    expect(store.getState().nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it("reset clears history and restarts the window", () => {
    const { store, history } = make();
    store.setState({ edges: [1] });
    history.reset(store);
    expect(past(store)).toBe(0);
    store.setState({ edges: [1, 2] });
    expect(past(store)).toBe(1);
  });
});
