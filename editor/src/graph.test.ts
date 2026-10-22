import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { conditionsSummary, refuseReason, type AppNode } from "./graph";
import { nodeDefs, registry } from "./registry";

const node = (id: string, kind: string, values = {}): AppNode => ({ id, type: "ae", position: { x: 0, y: 0 }, data: { kind, values } });
const flow = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target, sourceHandle: "flow-out", targetHandle: "flow-in" });

const nodes = [node("live", "Live"), node("neg", "Negate"), node("drag", "DragonSoulAbsorbed"), node("c", "CreateAchievement"), node("a1", "AddConditions"), node("a2", "AddConditions"), node("j", "JoinType"), node("q", "PlayerLevel"), node("r", "RunCommand")];
const link = (source: string, target: string, sourceHandle: string, targetHandle: string) => ({ source, target, sourceHandle, targetHandle });

describe("registry", () => {
  it("has every condition type plus ten non-condition nodes", () => {
    expect(nodeDefs.filter((d) => d.category === "condition")).toHaveLength(32);
    expect(nodeDefs).toHaveLength(42);
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

describe("Live and Negate nodes", () => {
  const cond = (source: string, target: string, sh = "cond-out", th = "cond-in"): Edge => ({ id: `${source}-${target}`, source, target, sourceHandle: sh, targetHandle: th });
  it("sit between a condition and Add Conditions", () => {
    expect(refuseReason(nodes, [], link("q", "live", "cond-out", "cond-in"))).toBeNull();
    expect(refuseReason(nodes, [cond("q", "live")], link("live", "a1", "cond-out", "cond-in"))).toBeNull();
    expect(refuseReason(nodes, [cond("q", "live")], link("live", "neg", "cond-out", "cond-in"))).toBeNull();
  });
  it("refuse a condition the mod cannot evaluate live, a second input and a loop", () => {
    expect(refuseReason(nodes, [], link("drag", "live", "cond-out", "cond-in"))).toMatch(/does not support/);
    expect(refuseReason(nodes, [cond("q", "live")], link("drag", "live", "cond-out", "cond-in"))).toMatch(/already has/i);
    expect(refuseReason(nodes, [cond("live", "neg")], link("neg", "live", "cond-out", "cond-in"))).toMatch(/loop/);
  });
});

describe("Conditions Met", () => {
  const cm = [node("m1", "ConditionsMet", { quantity: 1 }), node("m2", "ConditionsMet", { quantity: 1 }), node("p", "PlayerLevel", { level: 1 }), node("hp", "HasPerk", { formID: "1" }), node("lv", "Live"), node("ng", "Negate"), node("add", "AddConditions"), node("cr", "CreateAchievement")];
  const wire = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target, sourceHandle: "cond-out", targetHandle: "cond-in" });

  it("takes conditions, and feeds Add Conditions or another Conditions Met", () => {
    expect(refuseReason(cm, [], link("p", "m1", "cond-out", "cond-in"))).toBeNull();
    expect(refuseReason(cm, [wire("p", "m1")], link("hp", "m1", "cond-out", "cond-in"))).toBeNull(); // several in
    expect(refuseReason(cm, [], link("m1", "add", "cond-out", "cond-in"))).toBeNull();
    expect(refuseReason(cm, [], link("m2", "m1", "cond-out", "cond-in"))).toBeNull();
  });
  it("refuses a Conditions Met that holds itself, directly or through others", () => {
    expect(refuseReason(cm, [wire("m2", "m1")], link("m1", "m2", "cond-out", "cond-in"))).toMatch(/loop/);
    expect(refuseReason(cm, [], link("m1", "m1", "cond-out", "cond-in"))).not.toBeNull();
  });
  it("refuses Live and Negate inside it, from either end, and on itself", () => {
    expect(refuseReason(cm, [], link("lv", "m1", "cond-out", "cond-in"))).toMatch(/not supported inside/);
    expect(refuseReason(cm, [wire("lv", "m1")], link("hp", "lv", "cond-out", "cond-in"))).toMatch(/not supported inside/);
    expect(refuseReason(cm, [], link("m1", "lv", "cond-out", "cond-in"))).toMatch(/does not support Live/);
  });
  it("summarises what it holds against its quantity", () => {
    const two = [wire("p", "m1"), wire("hp", "m1")];
    expect(conditionsSummary(cm, [], "m1")).toEqual({ text: "No conditions", level: "error" });
    expect(conditionsSummary(cm, two, "m1")).toEqual({ text: "1 of 2 conditions", level: "ok" });
    const three = cm.map((n) => (n.id === "m1" ? node("m1", "ConditionsMet", { quantity: 3 }) : n));
    expect(conditionsSummary(three, two, "m1")).toEqual({ text: "Needs 3, but has 2 conditions", level: "error" });
  });
});
