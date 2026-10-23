import { afterEach, describe, expect, it, vi } from "vitest";
import { createValidation, graphChanged, groupIssues, parseNodeStatus, type Issue } from "./validation";

describe("groupIssues", () => {
  it("pins issues to nodes; an error wins and only errors redden fields", () => {
    const issues: Issue<{ figma?: string }>[] = [
      { level: "warning", message: "incomplete", nodeId: "a", field: "x", figma: "1:2" },
      { level: "error", message: "bad", detail: "bad value", nodeId: "a", field: "y" },
      { level: "warning", message: "meh", nodeId: "b", field: "z" },
      { level: "error", message: "free floating" },
    ];
    const { byNode, fieldsByNode } = groupIssues(issues);
    expect(byNode).toEqual({ a: "error|incomplete\nbad value", b: "warning|meh" });
    expect(fieldsByNode).toEqual({ a: "y" });
    expect(parseNodeStatus(byNode.a)).toEqual({ level: "error", messages: ["incomplete", "bad value"] });
    expect(parseNodeStatus(undefined)).toEqual({ level: null, messages: [] });
  });
});

describe("graphChanged", () => {
  const n = (id: string, x = 0) => ({ id, position: { x, y: 0 }, data: {} });
  it("ignores selection and measuring, sees moves and wires", () => {
    const a = n("a");
    expect(graphChanged({ nodes: [a], edges: [] }, { nodes: [{ ...a, selected: true }], edges: [] })).toBe(false);
    expect(graphChanged({ nodes: [a], edges: [] }, { nodes: [{ ...a, position: { x: 5, y: 0 } }], edges: [] })).toBe(true);
    expect(graphChanged({ nodes: [a], edges: [] }, { nodes: [a], edges: [{ id: "e", source: "a", target: "a" }] })).toBe(true);
  });
});

describe("createValidation", () => {
  afterEach(() => vi.useRealTimers());
  it("runs once now, then once after the changes stop", () => {
    vi.useFakeTimers();
    let n = 0;
    const v = createValidation({ compute: () => ({ n: ++n }), wait: 100 });
    let poke = () => {};
    const stop = v.start([(schedule) => ((poke = schedule), () => {})]);
    expect(v.use.getState().n).toBe(2); // created once, started once
    poke();
    poke();
    vi.advanceTimersByTime(99);
    expect(v.use.getState().n).toBe(2);
    vi.advanceTimersByTime(2);
    expect(v.use.getState().n).toBe(3);
    stop();
  });
});
