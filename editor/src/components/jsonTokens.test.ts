import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tokenizeJson } from "./jsonTokens";

const kinds = (s: string) => tokenizeJson(s).filter((t) => t.kind !== "plain").map((t) => `${t.kind}:${t.text}`);

describe("tokenizeJson", () => {
  it("classifies keys, strings, numbers, literals and punctuation", () => {
    expect(kinds('{"a": "x", "b": [1, -2.5e3, true, null]}')).toEqual([
      "punct:{", 'key:"a"', "punct::", 'string:"x"', "punct:,", 'key:"b"', "punct::", "punct:[",
      "number:1", "punct:,", "number:-2.5e3", "punct:,", "literal:true", "punct:,", "literal:null", "punct:]", "punct:}",
    ]);
  });
  it("marks $key values as localized, but not keys that start with $", () => {
    expect(kinds('{"name": "$NAME_A", "$odd": "plain"}')).toContain('localized:"$NAME_A"');
    expect(kinds('{"$odd": 1}')).toContain('key:"$odd"');
  });
  it("never reads inside a string", () => {
    expect(kinds('"true 12 {x}"')).toEqual(['string:"true 12 {x}"']);
    expect(kinds(String.raw`{"a": "he said \"hi\": ok"}`)).toContain(String.raw`string:"he said \"hi\": ok"`);
  });
  it("gives the text back exactly, on a real config", () => {
    const file = join(__dirname, "../../../Skyrim/Data/SKSE/Plugins/AchievementsData/TheSinisterSeven.json");
    const text = JSON.stringify(JSON.parse(readFileSync(file, "utf8")), null, 4);
    expect(tokenizeJson(text).map((t) => t.text).join("")).toBe(text);
  });
});
