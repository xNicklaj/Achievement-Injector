import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { computeValidation } from "../validation";
import { importGroup } from "./importGroup";
import { parsePlugin, searchRecords } from "./plugins";

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
      record("QUST", 0x01000800, Buffer.concat([sub("EDID", z("MyQuest")), sub("FULL", z("My Quest"))])),
      record("PERK", 0x01000801, packed, 0x40000),
      record("QUST", 0x00012345, sub("EDID", z("Override"))),
    ])),
    grup(record("REFR", 0x01000802, sub("EDID", z("MyRef")))),
  ]);
};
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer;

describe("plugin reader", () => {
  it("indexes own records, inflates compressed ones, skips overrides", async () => {
    const p = await parsePlugin(ab(plugin()), "My.esp");
    expect([...p.records.keys()].sort()).toEqual([0x800, 0x801, 0x802]);
    expect(p.records.get(0x800)).toEqual({ type: "QUST", editorId: "MyQuest", name: "My Quest" });
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

  it("rejects a file that is not a plugin", async () => {
    await expect(parsePlugin(ab(Buffer.alloc(64)), "x.esp")).rejects.toThrow("not a Skyrim plugin");
  });

  it("flags missing IDs and wrong record types, only for loaded plugins", async () => {
    const plugins = [await parsePlugin(ab(plugin()), "My.esp")];
    const check = (conds: object[], plugin = "My.esp") => {
      const snap = importGroup({ groupName: "G", plugin, achievements: [{ achievementName: "A", description: "d", conditions: conds }] });
      return computeValidation({ ...snap, loc: {}, plugins });
    };
    expect(check([{ type: "QuestStageDone", formID: "800", stage: 1 }]).issues).toEqual([]);
    expect(check([{ type: "QuestStageDone", formID: "999", stage: 1 }]).issues[0]).toMatchObject({ level: "error", field: "formID" });
    expect(check([{ type: "QuestStageDone", formID: "801", stage: 1 }]).issues[0]).toMatchObject({ level: "warning" });
    expect(check([{ type: "ActorDeath", formID: "800" }]).issues[0].detail).toContain("not a placed reference");
    expect(check([{ type: "ActorDeath", formID: "802" }]).issues).toEqual([]);
    expect(check([{ type: "HasPerks", perks: ["801", "800"], threshold: 1 }]).issues).toHaveLength(1);
    expect(check([{ type: "QuestStageDone", formID: "999", stage: 1 }], "Other.esp").issues).toEqual([]);
  });
});
