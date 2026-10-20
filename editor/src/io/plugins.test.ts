import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { computeValidation } from "../validation";
import { registry } from "../registry";
import { importGroup } from "./importGroup";
import { parsePlugin, searchFor, searchRecords } from "./plugins";

const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const sub = (sig: string, data: Buffer) => Buffer.concat([Buffer.from(sig), Buffer.from([data.length & 255, data.length >> 8]), data]);
const z = (s: string) => Buffer.from(s + "\0", "latin1");
const record = (type: string, id: number, body: Buffer, flags = 0) =>
  Buffer.concat([Buffer.from(type), u32(body.length), u32(flags), u32(id), Buffer.alloc(8), body]);
const grup = (inner: Buffer) => Buffer.concat([Buffer.from("GRUP"), u32(24 + inner.length), Buffer.alloc(16), inner]);

/** One master (so own records start 0x01), a quest, a compressed perk, a placed reference, and an override of a master record. */
const plugin = (flags = 0) => {
  const perkBody = Buffer.concat([sub("EDID", z("MyPerk")), sub("FULL", z("A Perk"))]);
  const packed = Buffer.concat([u32(perkBody.length), deflateSync(perkBody)]);
  return Buffer.concat([
    record("TES4", 0, Buffer.concat([sub("MAST", z("Skyrim.esm"))]), flags),
    grup(Buffer.concat([
      record("QUST", 0x01000800, Buffer.concat([
        sub("EDID", z("MyQuest")), sub("VMAD", vmad), sub("FULL", z("My Quest")),
        sub("INDX", Buffer.concat([u16(10), Buffer.alloc(2)])), sub("CNAM", z("Started")),
        sub("INDX", Buffer.concat([u16(20), Buffer.alloc(2)])), sub("CNAM", z("Done")),
        sub("QOBJ", u16(5)), sub("NNAM", z("Find it")),
      ])),
      record("PERK", 0x01000801, packed, 0x40000),
      record("QUST", 0x00012345, sub("EDID", z("Override"))),
    ])),
    grup(record("REFR", 0x01000802, sub("EDID", z("MyRef")))),
  ]);
};
const u16 = (n: number) => Buffer.from([n & 255, n >> 8]);
const wstr = (s: string) => Buffer.concat([u16(s.length), Buffer.from(s, "latin1")]);
/** VMAD v5: one script with an int property, an object property, a string array and a float. */
const vmad = Buffer.concat([
  u16(5), u16(2), u16(1), wstr("MyScript"), Buffer.from([0]), u16(4),
  wstr("count"), Buffer.from([3, 1]), u32(7),
  wstr("target"), Buffer.from([1, 1]), Buffer.alloc(8),
  wstr("names"), Buffer.from([12, 1]), u32(2), wstr("a"), wstr("bc"),
  wstr("ratio"), Buffer.from([4, 1]), u32(0),
]);
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer;

describe("plugin reader", () => {
  it("indexes own records, inflates compressed ones, skips overrides", async () => {
    const p = await parsePlugin(ab(plugin()), "My.esp");
    expect([...p.records.keys()].sort()).toEqual([0x800, 0x801, 0x802]);
    expect(p.records.get(0x800)).toMatchObject({
      type: "QUST", editorId: "MyQuest", name: "My Quest",
      stages: [{ index: 10, text: "Started" }, { index: 20, text: "Done" }],
      objectives: [{ index: 5, text: "Find it" }],
      scripts: [{ name: "MyScript", props: [{ name: "count", type: 3 }, { name: "target", type: 1 }, { name: "names", type: 12 }, { name: "ratio", type: 4 }] }],
    });
    expect(p.records.get(0x801)).toEqual({ type: "PERK", editorId: "MyPerk", name: "A Perk" });
  });

  it("searches by EditorID, name or ID, narrowed by record type and kind", async () => {
    const p = await parsePlugin(ab(plugin()), "My.esp");
    const ids = (...a: Parameters<typeof searchRecords> extends [unknown, ...infer R] ? R : never) => searchRecords(p, ...a).map((r) => r.id);
    expect(ids("quest")).toEqual(["000800"]);
    expect(ids("a perk")).toEqual(["000801"]);
    expect(ids("801")).toEqual(["000801"]);
    expect(ids("", "base")).toEqual(["000800", "000801"]);
    expect(ids("", "reference")).toEqual(["000802"]);
    expect(ids("", "base", "PERK")).toEqual(["000801"]);
  });

  it("offers searches for stages, objectives, scripts, variables and EditorIDs", async () => {
    const plugins = [await parsePlugin(ab(plugin()), "My.esp")];
    const field = (kind: string, name: string) => registry[kind].fields.find((f) => f.name === name)!;
    const run = (kind: string, name: string, values: Record<string, unknown>, term = "") => searchFor(plugins, kind, field(kind, name), values, "My.esp")?.run(term).map((c) => c.value);
    expect(run("QuestStageDone", "stage", { formID: "800" })).toEqual([10, 20]);
    expect(run("QuestStageDone", "stage", { formID: "800" }, "done")).toEqual([20]);
    expect(run("QuestObjectiveDone", "objective", { formID: "800" })).toEqual([5]);
    expect(run("QuestStageDone", "stage", {})).toBeUndefined();
    expect(run("PapyrusVariable", "script", { formID: "800" })).toEqual(["MyScript"]);
    expect(run("PapyrusVariable", "variable", { formID: "800", script: "myscript" })).toEqual(["count"]);
    expect(run("PapyrusVariable", "script", { formID: "801" })).toEqual([]);
    expect(run("PapyrusVariable", "script", { formID: "999" })).toBeUndefined();
    expect(run("BookRead", "bookID", {})).toEqual([]);
    expect(run("PlayerLevel", "level", {})).toBeUndefined();
  });

  it("warns about a stage or objective the quest does not have", async () => {
    const plugins = [await parsePlugin(ab(plugin()), "My.esp")];
    const check = (c: object) => computeValidation({ ...importGroup({ groupName: "G", plugin: "My.esp", achievements: [{ achievementName: "A", description: "d", conditions: [c] }] }), loc: {}, plugins }).issues;
    expect(check({ type: "QuestStageDone", formID: "800", stage: 20 })).toEqual([]);
    expect(check({ type: "QuestStageDone", formID: "800", stage: 15 })[0]).toMatchObject({ level: "warning", field: "stage" });
    expect(check({ type: "QuestObjectiveDone", formID: "800", objective: 6 })[0]).toMatchObject({ field: "objective" });
  });

  it("rejects a file that is not a plugin", async () => {
    await expect(parsePlugin(ab(Buffer.alloc(64)), "x.esp")).rejects.toThrow("not a Skyrim plugin");
  });

  it("flags missing IDs and wrong record types, only for loaded plugins", async () => {
    const plugins = [await parsePlugin(ab(plugin()), "My.esp")];
    const check = (conds: object[], plugin = "My.esp") => {
      const snap = importGroup({ groupName: "G", plugin, achievements: [{ achievementName: "A", description: "d", conditions: conds }] });
      return computeValidation({ ...snap, loc: {}, plugins });
    };
    expect(check([{ type: "QuestStageDone", formID: "800", stage: 10 }]).issues).toEqual([]);
    expect(check([{ type: "QuestStageDone", formID: "999", stage: 1 }]).issues[0]).toMatchObject({ level: "error", field: "formID" });
    expect(check([{ type: "QuestStageDone", formID: "801", stage: 1 }]).issues[0]).toMatchObject({ level: "warning" });
    expect(check([{ type: "ActorDeath", formID: "800" }]).issues[0].detail).toContain("not a placed reference");
    expect(check([{ type: "ActorDeath", formID: "802" }]).issues).toEqual([]);
    expect(check([{ type: "HasPerks", perks: ["801", "800"], threshold: 1 }]).issues).toHaveLength(1);
    expect(check([{ type: "QuestStageDone", formID: "999", stage: 1 }], "Other.esp").issues).toEqual([]);
  });
});
