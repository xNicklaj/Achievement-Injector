import { describe, expect, it, vi } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { createStore } from "zustand/vanilla";
import { createClipboard } from "./clipboard";

type S = { nodes: Node[]; edges: Edge[] };
type Opts = Partial<Omit<Parameters<typeof createClipboard<Node, S>>[0], "store" | "edge">>;
const node = (id: string, selected = false, kind = "a"): Node => ({ id, type: "t", position: { x: 10, y: 20 }, data: { kind, v: { x: 1 } }, selected });
const wire = (s: string, t: string): Edge => ({ id: `${s}>${t}`, source: s, sourceHandle: "o", target: t, targetHandle: "i" });
const edge = (s: string, sh: string, t: string, th: string): Edge => ({ id: `w${s}${t}`, source: s, sourceHandle: sh, target: t, targetHandle: th });
const make = (nodes: Node[], edges: Edge[] = [], extra: Opts = {}) => {
  const store = createStore<S>(() => ({ nodes, edges }));
  return { store, cb: createClipboard<Node, S>({ store, edge, ...extra }) };
};

describe("createClipboard", () => {
  it("copy counts the selected nodes; nothing selected returns 0 and keeps the old clip", () => {
    const { store, cb } = make([node("a", true), node("b", true), node("c")]);
    expect(cb.has()).toBe(false);
    expect(cb.copy()).toBe(2);
    expect(cb.has()).toBe(true);
    store.setState({ nodes: [node("a"), node("b"), node("c")] });
    expect(cb.copy()).toBe(0);
    expect(cb.paste()).toBe(2);
  });

  it("paste with no clip does nothing", () => {
    const { store, cb } = make([node("a", true)]);
    const before = store.getState();
    expect(cb.paste()).toBe(0);
    expect(store.getState()).toBe(before);
  });

  it("exclude skips nodes", () => {
    const { cb } = make([node("a", true), node("b", true, "skip")], [], { exclude: (n) => n.data.kind === "skip" });
    expect(cb.copy()).toBe(1);
  });

  it("copies only wires between copied nodes, remapped to the new ids", () => {
    const { store, cb } = make([node("a", true), node("b", true), node("c")], [wire("a", "b"), wire("b", "c"), wire("c", "a")]);
    cb.copy();
    cb.paste();
    const { nodes, edges } = store.getState();
    expect(edges).toHaveLength(4);
    const fresh = nodes.filter((n) => n.selected);
    const w = edges[3];
    expect([w.source, w.target]).toEqual([fresh[0].id, fresh[1].id]);
    expect([w.sourceHandle, w.targetHandle]).toEqual(["o", "i"]);
  });

  it("offset grows per paste; new ids, selected, old selection cleared, data cloned", () => {
    const { store, cb } = make([node("a", true)]);
    cb.copy();
    expect(cb.paste()).toBe(1);
    cb.paste();
    const { nodes } = store.getState();
    expect(nodes.map((n) => n.selected)).toEqual([false, false, true]);
    expect(nodes[1].id).not.toBe("a");
    expect(nodes[1].id).not.toBe(nodes[2].id);
    expect(nodes[1].position).toEqual({ x: 50, y: 60 });
    expect(nodes[2].position).toEqual({ x: 90, y: 100 });
    expect(nodes[1].data).toEqual(nodes[0].data);
    expect(nodes[1].data).not.toBe(nodes[0].data);
  });

  it("paste is one store update", () => {
    const { store, cb } = make([node("a", true), node("b", true)], [wire("a", "b")]);
    cb.copy();
    const sub = vi.fn();
    store.subscribe(sub);
    cb.paste();
    expect(sub).toHaveBeenCalledTimes(1);
  });

  it("copy and paste hooks run on the clones and the fresh nodes", () => {
    const copy = vi.fn((p: Node[]) => p.map((n) => ({ ...n, data: { ...n.data, v: "copied" } })));
    const paste = vi.fn((f: Node[]) => f.map((n) => ({ ...n, data: { ...n.data, w: "pasted" } })));
    const { store, cb } = make([node("a", true)], [], { copy, paste });
    cb.copy();
    expect(copy.mock.calls[0][0][0].selected).toBe(false);
    expect((copy.mock.calls[0] as unknown[])[1]).toBe(store.getState());
    cb.paste();
    expect(paste).toHaveBeenCalledTimes(1);
    expect(store.getState().nodes[1].data).toEqual({ kind: "a", v: "copied", w: "pasted" });
    expect(store.getState().nodes[0].data.v).toEqual({ x: 1 });
  });

  it("duplicate copies and pastes; 0 when nothing is selected", () => {
    const { store, cb } = make([node("a", true)]);
    expect(cb.duplicate()).toBe(1);
    expect(store.getState().nodes).toHaveLength(2);
    store.setState({ nodes: store.getState().nodes.map((n) => ({ ...n, selected: false })) });
    expect(cb.duplicate()).toBe(0);
  });
});
