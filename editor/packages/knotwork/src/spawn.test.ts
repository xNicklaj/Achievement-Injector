import { describe, expect, it } from "vitest";
import type { NodeDef } from "./defs";
import { matchesSpawn, SPAWN_NEW, spawnOptions, type SpawnFrom } from "./spawn";
import type { Link } from "./rules";

const def = (kind: string, category: string, title: string, pins: NodeDef["pins"], keywords: string[] = []): NodeDef => ({ kind, category, title, keywords, pins });
const defs = [
  def("Print", "flow", "Print", [{ id: "flow-in", side: "in" }, { id: "String:text", side: "in" }, { id: "flow-out", side: "out" }]),
  def("Start", "entry", "Start", [{ id: "flow-out", side: "out" }]),
  def("Name", "data", "Name", [{ id: "String-out", side: "out" }], ["text"]),
  def("Label", "data", "Label", [{ id: "String:value", side: "in" }, { id: "String:fallback", side: "in" }]),
];
const order = ["entry", "flow", "data"];
const ok = () => null;
const kinds = (o: { def: NodeDef }[]) => o.map((x) => x.def.kind);
const from = (handleId: string, handleType: "source" | "target"): SpawnFrom => ({ nodeId: "n1", handleId, handleType });

describe("spawnOptions", () => {
  it("offers every def, ordered by category then label, with no wire", () => {
    const o = spawnOptions({ defs, from: null, order, refuse: ok });
    expect(kinds(o)).toEqual(["Start", "Print", "Label", "Name"]);
    expect(o.map((x) => x.label)).toEqual(["Start", "Print", "Label", "Name"]);
  });

  it("from a flow output: defs with a flow input; from a flow input: defs with a flow output", () => {
    expect(kinds(spawnOptions({ defs, from: from("flow-out", "source"), order, refuse: ok }))).toEqual(["Print"]);
    expect(kinds(spawnOptions({ defs, from: from("flow-in", "target"), order, refuse: ok }))).toEqual(["Start", "Print"]);
  });

  it("from a typed output: each matching input pin is its own option, labelled Title · Field", () => {
    const o = spawnOptions({ defs, from: from("String-out", "source"), order, refuse: ok });
    expect(o.map((x) => [x.pin, x.label])).toEqual([
      ["String:text", "Print · Text"],
      ["String:fallback", "Label · Fallback"],
      ["String:value", "Label · Value"],
    ]);
  });

  it("from a typed input: defs with a matching output", () => {
    const o = spawnOptions({ defs, from: from("String:text", "target"), order, refuse: ok });
    expect(o.map((x) => [x.def.kind, x.pin, x.label])).toEqual([["Name", "String-out", "Name"]]);
  });

  it("asks refuse about the SPAWN_NEW node and drops refused pins", () => {
    const seen: Link[] = [];
    const o = spawnOptions({
      defs,
      from: from("String-out", "source"),
      order,
      refuse: (l) => (seen.push(l), l.targetHandle === "String:value" ? "no" : null),
    });
    expect(seen.every((l) => l.source === "n1" && l.sourceHandle === "String-out" && l.target === SPAWN_NEW)).toBe(true);
    expect(o.map((x) => x.pin)).not.toContain("String:value");
    expect(o.map((x) => x.pin)).toContain("String:fallback");

    const back: Link[] = [];
    spawnOptions({ defs, from: from("String:text", "target"), order, refuse: (l) => (back.push(l), null) });
    expect(back).toEqual([{ source: SPAWN_NEW, sourceHandle: "String-out", target: "n1", targetHandle: "String:text" }]);
  });
});

describe("matchesSpawn", () => {
  const o = { def: defs[2], label: "Name" };
  it("matches every word against label, kind and keywords", () => {
    expect(matchesSpawn(o, "")).toBe(true);
    expect(matchesSpawn(o, "TEXT na")).toBe(true);
    expect(matchesSpawn(o, "name zzz")).toBe(false);
  });
});
