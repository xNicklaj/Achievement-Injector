import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { findNodes } from "./FindBar";

const n = (id: string, values: Record<string, unknown> = {}): Node => ({ id, position: { x: 0, y: 0 }, data: { values } });
const title = (x: Node) => `T-${x.id}`;

describe("findNodes", () => {
  it("matches a title with an empty snippet", () => {
    expect(findNodes([n("a")], undefined, " t-A ", title, 50)).toEqual([{ node: expect.objectContaining({ id: "a" }), snippet: "" }]);
  });
  it("matches a value, stringifying non-strings", () => {
    const r = findNodes([n("a", { Name: "Hello", Count: 42 }), n("b", { x: null })], undefined, "42", title, 50);
    expect(r.map((x) => x.snippet)).toEqual(["Count: 42"]);
  });
  it("skips hidden nodes and an empty query", () => {
    expect(findNodes([n("a")], new Set(["a"]), "t-a", title, 50)).toEqual([]);
    expect(findNodes([n("a")], undefined, "  ", title, 50)).toEqual([]);
  });
  it("stops at max", () => {
    const nodes = Array.from({ length: 10 }, (_, i) => n(String(i)));
    expect(findNodes(nodes, undefined, "t-", title, 3)).toHaveLength(3);
  });
});
