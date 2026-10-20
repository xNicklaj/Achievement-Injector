import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportGroup, withoutEditor } from "./exportGroup";
import { ImportError, importGroup, type Json } from "./importGroup";

const dir = join(__dirname, "../../../Skyrim/Data/SKSE/Plugins/AchievementsData");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

/** Editor metadata is allowed to differ; everything else must match (key order is irrelevant to toEqual). */
const stripEditor = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(stripEditor) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "_editor").map(([k, x]) => [k, stripEditor(x)])) : v;

const roundTrip = (raw: unknown) => exportGroup(importGroup(raw));

describe("shipped configs", () => {
  it.each(files)("%s: JSON -> graph -> JSON is lossless", (f) => {
    const raw = load(f);
    const { json, issues } = roundTrip(raw);
    expect(stripEditor(json)).toEqual(stripEditor(raw));
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it.each(files)("%s: graph -> JSON -> graph is stable, including positions", (f) => {
    const first = roundTrip(load(f)).json;
    const second = roundTrip(first).json;
    expect(second).toEqual(first);
  });
});

describe("import", () => {
  const base = { groupName: "G", plugin: "A.esp" };
  const ach = (a: Json) => ({ ...base, achievements: [{ achievementName: "A", description: "d", ...a }] });
  const kinds = (raw: unknown) => importGroup(raw).nodes.map((n) => n.data.kind);

  it("creates nodes only for what the file has", () => {
    expect(kinds(ach({}))).toEqual(["CreateAchievement"]);
    expect(kinds(ach({ conditions: [] }))).toEqual(["CreateAchievement", "AddConditions"]);
    expect(kinds(ach({ conditions: [{ type: "PlayerLevel", level: 5 }], joinType: "AND", onUnlock: [{ type: "command", command: "x" }] }))).toEqual([
      "CreateAchievement", "AddConditions", "JoinType", "RunCommand", "PlayerLevel",
    ]);
  });

  it("keeps unknown keys, explicit defaults, empty onUnlock and condition-level onUnlock", () => {
    const raw = ach({ custom: 1, onUnlock: [], conditions: [{ type: "QuestStageDone", formID: "1", stage: 1, operation: ">=", onUnlock: [{ type: "command", command: "y" }], more: true }] });
    expect(stripEditor(roundTrip(raw).json)).toEqual(raw);
  });

  it("turns $keys into one shared LocalizedText node and writes them back", () => {
    const raw = ach({ achievementName: "$name", description: "$name", conditions: [{ type: "BookRead", bookID: "$book" }] });
    const snap = importGroup(raw);
    expect(snap.nodes.filter((n) => n.data.kind === "LocalizedText").map((n) => n.data.values.key).sort()).toEqual(["book", "name"]);
    expect(snap.edges.filter((e) => e.sourceHandle === "loc-out")).toHaveLength(3);
    expect(stripEditor(exportGroup(snap).json)).toEqual(raw);
  });

  it("assigns unique ids when ids repeat or are missing", () => {
    const c = { type: "PlayerLevel", level: 1, _editor: { id: "dup", x: 0, y: 0 } };
    const ids = importGroup(ach({ conditions: [c, c] })).nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refuses files it cannot represent without data loss", () => {
    expect(() => importGroup([])).toThrow(ImportError);
    expect(() => importGroup({ ...base })).toThrow(/achievements/);
    expect(() => importGroup(ach({ conditions: [{ type: "Nope" }] }))).toThrow(/Nope/);
    expect(() => importGroup(ach({ onUnlock: [{ type: "weird" }] }))).toThrow(/weird/);
  });
});

describe("export", () => {
  it("reports problems instead of throwing, and omits unset fields", () => {
    const snap = importGroup({ groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d", conditions: [{ type: "PlayerLevel", level: 1 }] }] });
    const level = snap.nodes.find((n) => n.data.kind === "PlayerLevel")!;
    delete level.data.values.level;
    const { json, issues } = exportGroup(snap);
    expect(JSON.stringify(json)).not.toContain("null");
    expect(issues.find((i) => /level/.test(i.message))).toMatchObject({ level: "warning", nodeId: level.id, field: "level" });
  });

  it("warns about nodes that would be lost", () => {
    const snap = importGroup({ groupName: "G", plugin: "A.esp", achievements: [] });
    snap.nodes.push({ id: "x", type: "ae", position: { x: 0, y: 0 }, data: { kind: "PlayerLevel", values: { level: 1 } } });
    expect(exportGroup(snap).issues.some((i) => i.level === "warning" && /not connected/.test(i.message))).toBe(true);
  });
});

describe("withoutEditor", () => {
  it("removes _editor at every depth and leaves everything else", () => {
    const raw = load(files[0]);
    const { json } = roundTrip(raw);
    expect(withoutEditor(json)).toEqual(stripEditor(raw));
    expect(JSON.stringify(withoutEditor(json))).not.toContain("_editor");
  });
});

describe("auto-layout", () => {
  it("stacks conditions without overlap, including nodes that show every field", () => {
    const raw = {
      groupName: "G",
      plugin: "A.esp",
      achievements: [{ achievementName: "A", description: "d", conditions: [{ type: "BaseActorDeath", formID: "1" }, { type: "BaseActorDeath", formID: "2" }, { type: "PlayerLevel", level: 1 }] }],
    };
    const conds = importGroup(raw).nodes.filter((n) => n.data.kind === "BaseActorDeath" || n.data.kind === "PlayerLevel");
    // BaseActorDeath shows 5 fields (formID, editorID, name, quantity, pluginOverride) under a 28px header.
    expect(conds[1].position.y - conds[0].position.y).toBeGreaterThanOrEqual(28 + 5 * 24);
    expect(conds[2].position.y - conds[1].position.y).toBeGreaterThanOrEqual(28 + 5 * 24);
  });
});

describe("auto-layout with optional fields set", () => {
  it("leaves room for a node whose optional section opens because a field is set", () => {
    const raw = { groupName: "G", plugin: "A.esp", achievements: [{ achievementName: "A", description: "d", icon: "x.dds", showPopup: false }, { achievementName: "B", description: "d" }] };
    const [first, second] = importGroup(raw).nodes.filter((n) => n.data.kind === "CreateAchievement");
    // 7 fields (name, description and the five optional ones) under a header, all showing.
    expect(second.position.y - first.position.y).toBeGreaterThanOrEqual(28 + 7 * 24);
  });
});
