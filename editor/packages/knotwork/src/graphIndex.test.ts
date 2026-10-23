import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { incoming, nodeIndex, outgoing } from "./graphIndex";

const edge = (source: string, target: string, id = `${source}>${target}`): Edge => ({ id, source, target });

describe("graph index", () => {
  it("finds wires by either end, in the order they were made", () => {
    const edges = [edge("a", "z", "1"), edge("b", "z", "2"), edge("a", "y", "3")];
    expect(incoming(edges, "z").map((e) => e.id)).toEqual(["1", "2"]);
    expect(outgoing(edges, "a").map((e) => e.id)).toEqual(["1", "3"]);
    expect(incoming(edges, "nobody")).toEqual([]);
  });

  it("looks nodes up by id", () => {
    const nodes = [{ id: "a" }, { id: "b" }];
    expect(nodeIndex(nodes).get("b")).toBe(nodes[1]);
  });

  it("is not fooled by an array that grew after it was first read", () => {
    const edges = [edge("a", "z")];
    expect(incoming(edges, "z")).toHaveLength(1);
    edges.push(edge("b", "z"));
    expect(incoming(edges, "z")).toHaveLength(2);
    const nodes = [{ id: "a" }];
    expect(nodeIndex(nodes).has("b")).toBe(false);
    nodes.push({ id: "b" });
    expect(nodeIndex(nodes).has("b")).toBe(true);
  });
});
