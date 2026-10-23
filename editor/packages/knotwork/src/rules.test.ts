import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { composeRules, noLoop, noSelfLink, onePerChain, pinsMatch, pinUsedOnce } from "./rules";

const n = (id: string, kind = "plain"): Node => ({ id, position: { x: 0, y: 0 }, data: { kind } });
const e = (source: string, target: string, sh = "flow-out", th = "flow-in"): Edge => ({ id: `${source}>${target}`, source, target, sourceHandle: sh, targetHandle: th });
const flow = (source: string, target: string) => ({ source, target, sourceHandle: "flow-out", targetHandle: "flow-in" });

describe("rules", () => {
  it("pinsMatch refuses different or missing kinds", () => {
    const r = composeRules(pinsMatch());
    expect(r([], [], flow("a", "b"))).toBeNull();
    expect(r([], [], { source: "a", target: "b", sourceHandle: "flow-out", targetHandle: "cond-in" })).toBe("Pin types differ");
    expect(r([], [], { source: "a", target: "b", sourceHandle: null, targetHandle: null })).toBe("Pin types differ");
  });
  it("noSelfLink", () => {
    expect(composeRules(noSelfLink())([], [], flow("a", "a"))).toBe("Cannot connect a node to itself");
  });
  it("pinUsedOnce checks the chosen side and only its kind", () => {
    const edges = [e("a", "b")];
    expect(composeRules(pinUsedOnce("flow", "source", "src"))([], edges, flow("a", "c"))).toBe("src");
    expect(composeRules(pinUsedOnce("flow", "source", "src"))([], edges, flow("c", "b"))).toBeNull();
    expect(composeRules(pinUsedOnce("flow", "target", "dst"))([], edges, flow("c", "b"))).toBe("dst");
    expect(composeRules(pinUsedOnce("flow", "both", "any"))([], edges, flow("c", "b"))).toBe("any");
    expect(composeRules(pinUsedOnce("cond", "both", "any"))([], edges, flow("a", "b"))).toBeNull();
  });
  it("noLoop", () => {
    const edges = [e("a", "b"), e("b", "c")];
    const r = composeRules(noLoop("flow"));
    expect(r([], edges, flow("c", "a"))).toBe("Would create a loop");
    expect(r([], edges, flow("c", "d"))).toBeNull();
    expect(r([], edges, { source: "c", target: "a", sourceHandle: "cond-out", targetHandle: "cond-in" })).toBeNull();
  });
  const unique = (x: Node) => (x.data.kind === "once" ? { key: "once", title: "Once" } : undefined);
  it("onePerChain counts along the joined chain", () => {
    const nodes = [n("a", "once"), n("b"), n("c", "once"), n("d")];
    const r = composeRules(onePerChain("flow", unique));
    expect(r(nodes, [e("a", "b")], flow("b", "c"))).toBe("A chain can have only one Once");
    expect(r(nodes, [e("a", "b")], flow("b", "d"))).toBeNull();
  });
  it("sees a virtual node through extra, not in nodes", () => {
    const nodes = [n("a", "once")];
    const r = composeRules(onePerChain("flow", unique));
    expect(r(nodes, [], flow("a", "new"))).toBeNull();
    expect(r(nodes, [], flow("a", "new"), n("new", "once"))).toBe("A chain can have only one Once");
    expect(nodes).toHaveLength(1);
  });
  it("composeRules returns the first reason in order", () => {
    const r = composeRules(noSelfLink("self"), pinsMatch(undefined, "types"));
    expect(r([], [], { source: "a", target: "a", sourceHandle: "x-out", targetHandle: "y-in" })).toBe("self");
    expect(composeRules(pinsMatch(undefined, "types"), noSelfLink("self"))([], [], { source: "a", target: "a", sourceHandle: "x-out", targetHandle: "y-in" })).toBe("types");
  });
});
