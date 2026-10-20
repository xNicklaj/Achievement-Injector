import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GroupSchema, conditionRegistry, conditionSchemas } from "./index";

const dataDir = join(__dirname, "../../../Skyrim/Data/SKSE/Plugins/AchievementsData");
const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));

describe("shipped configs", () => {
  it.each(files)("%s parses and survives a round-trip untouched", (f) => {
    const raw = JSON.parse(readFileSync(join(dataDir, f), "utf8"));
    const r = GroupSchema.safeParse(raw);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
    expect(r.data).toEqual(raw); // no defaults injected, no keys dropped
  });
});

describe("schema", () => {
  it("covers all 31 condition types, each once", () => {
    expect(conditionSchemas.length).toBe(31);
    expect(new Set(Object.keys(conditionRegistry)).size).toBe(31);
  });

  const base = { groupName: "G", plugin: "A.esp" };
  const ach = (conditions: unknown[]) => ({
    ...base,
    achievements: [{ achievementName: "A", description: "d", conditions }],
  });

  it.each([
    [{ type: "Nope" }],
    [{ type: "PlayerLevel", level: "10" }], // string: nlohmann throws on get<int>
    [{ type: "QuestStageDone", formID: "0x1234", stage: 1 }],
    [{ type: "QueryStatValue", stat: "x", value: 1, operation: "OP" }],
    [{ type: "BookRead" }],
    [{ type: "BaseActorDeath", quantity: 2 }],
    [{ type: "SkillLevel", skill: "archery", level: 5 }],
  ])("rejects %j", (c) => {
    expect(GroupSchema.safeParse(ach([c])).success).toBe(false);
  });

  it("accepts the 1.4.1 operators and live/negate", () => {
    expect(GroupSchema.safeParse(ach([{ type: "PlayerLevel", level: 5, operation: "<=" }])).success).toBe(true);
    expect(GroupSchema.safeParse(ach([{ type: "HasPerk", formID: "1", negate: true, live: true }])).success).toBe(true);
  });

  it("accepts case-insensitive skills and omitted optional fields", () => {
    expect(GroupSchema.safeParse(ach([{ type: "SkillLevel", skill: "OneHanded", level: 5 }])).success).toBe(true);
    expect(GroupSchema.safeParse(ach([{ type: "PlayerActivation", formID: "1A" }])).success).toBe(true);
  });

  it("flags duplicate achievement names", () => {
    const a = { achievementName: "A", description: "d" };
    expect(GroupSchema.safeParse({ ...base, achievements: [a, a] }).success).toBe(false);
  });

  it("keeps unknown keys", () => {
    const r = GroupSchema.parse({ ...base, achievements: [], extra: 1 });
    expect((r as Record<string, unknown>).extra).toBe(1);
  });

  it("exposes version tags and form kinds through the registry", () => {
    const q = conditionRegistry.PlayerActivation.fields.find((f) => f.name === "quantity");
    expect(q).toMatchObject({ since: "1.4.1", optional: true, default: 1 });
    expect(conditionRegistry.ObjectState.fields[0]).toMatchObject({ widget: "formId", formKind: "reference" });
  });

  it("emits a JSON Schema", () => {
    const js = z.toJSONSchema(GroupSchema, { io: "input" });
    expect(JSON.stringify(js)).toContain("QuestStageDone");
  });
});
