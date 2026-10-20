import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { conditionsSummary, refuseReason, type AppNode } from "./graph";
import { nodeDefs, registry } from "./registry";

const node = (id: string, kind: string, values = {}): AppNode => ({ id, type: "ae", position: { x: 0, y: 0 }, data: { kind, values } });
const flow = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target, sourceHandle: "flow-out", targetHandle: "flow-in" });

const nodes = [node("c", "CreateAchievement"), node("a1", "AddConditions"), node("a2", "AddConditions"), node("j", "JoinType"), node("q", "PlayerLevel"), node("r", "RunCommand")];
const link = (source: string, target: string, sourceHandle: string, targetHandle: string) => ({ source, target, sourceHandle, targetHandle });

describe("registry", () => {
  it("has every condition type plus the six non-condition nodes", () => {
    expect(nodeDefs.filter((d) => d.category === "condition")).toHaveLength(31);
    expect(nodeDefs).toHaveLength(37);
  });
  it("localizable fields come from the schema", () => {
    expect(registry.CreateAchievement.fields.filter((f) => f.widget === "localizedString").map((f) => f.name)).toEqual(["achievementName", "description"]);
    expect(registry.JoinType.fields.map((f) => f.name)).toEqual(["joinType"]);
  });
});

describe("connection rules", () => {
  it("allows the canonical chain", () => {
    expect(refuseReason(nodes, [], link("c", "a1", "flow-out", "flow-in"))).toBeNull();
    expect(refuseReason(nodes, [flow("c", "a1")], link("a1", "j", "flow-out", "flow-in"))).toBeNull();
  });
  it("refuses a second AddConditions in a chain, from either end", () => {
    expect(refuseReason(nodes, [flow("c", "a1")], link("a1", "a2", "flow-out", "flow-in"))).toMatch(/only one/);
    expect(refuseReason(nodes, [flow("a2", "r")], link("a1", "a2", "flow-out", "flow-in"))).not.toBeNull();
    expect(refuseReason(nodes, [flow("a1", "r")], link("c", "a2", "flow-out", "flow-in"))).toBeNull();
    expect(refuseReason(nodes, [flow("a1", "r"), flow("c", "j")], link("j", "a2", "flow-out", "flow-in"))).toBeNull();
  });
  it("refuses mismatched pins, loops and shared condition nodes", () => {
    expect(refuseReason(nodes, [], link("q", "a1", "cond-out", "flow-in"))).toMatch(/differ/);
    expect(refuseReason(nodes, [flow("c", "a1")], link("a1", "c", "flow-out", "flow-in"))).toMatch(/loop/);
    const e: Edge = { id: "e", source: "q", target: "a1", sourceHandle: "cond-out", targetHandle: "cond-in" };
    expect(refuseReason(nodes, [e], link("q", "a2", "cond-out", "cond-in"))).toMatch(/already used/);
  });
});

describe("AddConditions summary", () => {
  const e: Edge = { id: "e", source: "q", target: "a1", sourceHandle: "cond-out", targetHandle: "cond-in" };
  it("derives text from edges", () => {
    expect(conditionsSummary(nodes, [], "a1").level).toBe("error");
    expect(conditionsSummary(nodes, [e], "a1")).toEqual({ text: "1 condition · 1 incomplete · OR (default)", level: "warning" });
    expect(conditionsSummary([node("q", "PlayerLevel", { level: 5 }), ...nodes.filter((n) => n.id !== "q")], [e], "a1").level).toBe("ok");
  });
});

describe("a condition's On Unlock chain", () => {
  it("takes actions from the condition's flow pin, and nothing else", () => {
    expect(refuseReason(nodes, [], link("q", "r", "flow-out", "flow-in"))).toBeNull();
    expect(refuseReason(nodes, [], link("q", "a1", "flow-out", "flow-in"))).toMatch(/On Unlock/);
    expect(refuseReason(nodes, [], link("q", "j", "flow-out", "flow-in"))).toMatch(/On Unlock/);
    // An action already in a condition's chain cannot lead on to a Join Type.
    expect(refuseReason(nodes, [flow("q", "r")], link("r", "j", "flow-out", "flow-in"))).toMatch(/On Unlock/);
  });
  it("does not stop the achievement's own chain from running actions", () => {
    expect(refuseReason(nodes, [flow("c", "a1")], link("a1", "r", "flow-out", "flow-in"))).toBeNull();
  });
  it("is not offered a creatable unknown-condition node", () => {
    expect(nodeDefs.some((d) => d.kind === "UnknownCondition")).toBe(false);
    expect(registry.UnknownCondition.flowOut).toBe(true);
  });
});
