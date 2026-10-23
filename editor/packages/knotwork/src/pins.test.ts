import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { pinField, pinKind, walk, wiredFields } from "./pins";

const e = (source: string, target: string, sourceHandle: string, targetHandle: string): Edge => ({ id: `${source}>${target}`, source, target, sourceHandle, targetHandle });

describe("pins", () => {
  it("splits handle ids", () => {
    expect(pinKind("flow-in")).toBe("flow");
    expect(pinKind("loc:description")).toBe("loc");
    expect(pinKind("")).toBeNull();
    expect(pinKind(null)).toBeNull();
    expect(pinKind(undefined)).toBeNull();
    expect(pinField("loc:description")).toBe("description");
    expect(pinField("loc:a:b")).toBe("a:b");
    expect(pinField("flow-in")).toBeNull();
  });
  it("lists wired fields", () => {
    const edges = [e("a", "z", "loc-out", "loc:x"), e("b", "z", "flow-out", "flow-in"), e("c", "z", "ach-out", "ach:y"), e("d", "q", "loc-out", "loc:no")];
    expect([...wiredFields(edges, "z")].sort()).toEqual(["x", "y"]);
  });
  it("walks one kind of wire both ways", () => {
    const edges = [e("a", "b", "flow-out", "flow-in"), e("b", "c", "flow-out", "flow-in"), e("x", "b", "cond-out", "cond-in")];
    expect([...walk(edges, "b", "flow", "up")]).toEqual(["a"]);
    expect([...walk(edges, "b", "flow", "down")]).toEqual(["c"]);
    expect([...walk(edges, "b", "cond", "up")]).toEqual(["x"]);
  });
  it("terminates on a cycle", () => {
    const edges = [e("a", "b", "flow-out", "flow-in"), e("b", "a", "flow-out", "flow-in")];
    expect(walk(edges, "a", "flow", "down")).toEqual(new Set(["a", "b"]));
  });
});
