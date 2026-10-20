import { describe, expect, it } from "vitest";
import { LANGUAGES, LOOKALIKES, languageOf } from "./languages";

describe("languages", () => {
  it("codes follow the DLL rule: first two letters of sLanguage", () => {
    for (const l of LANGUAGES) expect(l.sLanguage.slice(0, 2)).toBe(l.code);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
  });
  it("lookalike codes point at real ones and are not themselves languages", () => {
    for (const [wrong, right] of Object.entries(LOOKALIKES)) {
      expect(languageOf(wrong)).toBeUndefined();
      expect(languageOf(right)).toBeDefined();
    }
  });
});
