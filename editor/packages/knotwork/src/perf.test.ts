import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { incoming, nodeIndex, outgoing } from "./graphIndex";
import { walk } from "./pins";
import { composeRules, noLoop, noSelfLink, onePerChain, pinsMatch, pinUsedOnce } from "./rules";

/** The best of three: the first run pays for compiling; a quadratic is slow every time. */
const took = (f: () => void) =>
  Math.min(
    ...[0, 1, 2].map(() => {
      const t = performance.now();
      f();
      return performance.now() - t;
    }),
  );

const N = 5000;
const nodes: Node[] = Array.from({ length: N }, (_, i) => ({ id: `n${i}`, position: { x: i, y: 0 }, data: { kind: i === 0 ? "once" : "plain" } }));
const mk = (): Edge[] => Array.from({ length: N - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, sourceHandle: "flow-out", targetHandle: "flow-in" }));

describe("kit stays linear on a 5000-node chain", () => {
  it("index and a whole-chain walk", () => {
    expect(
      took(() => {
        const edges = mk();
        nodeIndex(nodes);
        incoming(edges, "n1");
        outgoing(edges, "n1");
        expect(walk(edges, `n${N - 1}`, "flow", "up").size).toBe(N - 1);
        expect(walk(edges, "n0", "flow", "down").size).toBe(N - 1);
      }),
    ).toBeLessThan(100);
  });
  it("200 connections through composeRules", () => {
    const edges = mk();
    const once = (x: Node) => (x.data.kind === "once" ? { key: "once", title: "Once" } : undefined);
    const link = { source: `n${N - 1}`, target: "n0", sourceHandle: "flow-out", targetHandle: "flow-in" };
    const base = [pinsMatch(), noSelfLink(), pinUsedOnce("flow", "both", "used")];
    const loop = composeRules(...base, noLoop("flow"));
    const chain = composeRules(...base, onePerChain("flow", once));
    expect(loop(nodes, edges, link)).toBe("Would create a loop");
    expect(chain(nodes, edges, link)).toBe("A chain can have only one Once");
    const t = took(() => {
      for (let i = 0; i < 200; i++) (loop(nodes, edges, link), chain(nodes, edges, link));
    });
    expect(t).toBeLessThan(1500);
  });
});
