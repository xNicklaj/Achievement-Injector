import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getText, keyWarnings, locKeys, locRows, newLocFile, orphanKeys, parseLoc, renameKey, serializeLoc, setText, sortedLocales, splitLocName } from "./localization";

const dir = join(__dirname, "../../../Skyrim/Data/SKSE/Plugins/AchievementsData/Localizations");
const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));

describe("shipped localization files", () => {
  it.each(files)("%s survives parse -> serialize unchanged", (f) => {
    const text = readFileSync(join(dir, f), "utf8");
    expect(serializeLoc(parseLoc(f, text))).toBe(text);
    expect(locKeys(parseLoc(f, text)).size).toBeGreaterThan(0);
  });
});

describe("localization model", () => {
  const text = "// comment\n$A\tone\n$B\t\ttwo\n\n$A\tlast wins\n";
  const f = parseLoc("G_EN.txt", text);

  it("reads like the DLL: $-lines only, repeated tabs skipped, last duplicate wins", () => {
    expect(getText(f, "B")).toBe("two");
    expect(getText(f, "A")).toBe("last wins");
    expect(locKeys(f)).toEqual(new Set(["A", "B"]));
    expect(serializeLoc(f)).toBe(text);
  });
  it("drops a BOM, which would hide the first key from the DLL", () => {
    expect(serializeLoc(parseLoc("G_EN.txt", "﻿$A\tx\r\n"))).toBe("$A\tx\r\n");
  });
  it("edits one entry and leaves the rest untouched", () => {
    expect(serializeLoc(setText(f, "B", "new"))).toBe("// comment\n$A\tone\n$B\tnew\n\n$A\tlast wins\n");
  });
  it("appends new keys, never creates empty ones, never deletes", () => {
    expect(setText(f, "C", "") ).toBe(f);
    expect(serializeLoc(setText(newLocFile("G_FR.txt"), "C", "salut"))).toBe("$C\tsalut\r\n");
    expect(getText(setText(f, "B", ""), "B")).toBe("");
  });
  it("keeps values on one line", () => {
    expect(getText(setText(f, "B", "a\nb"), "B")).toBe("a b");
  });
  it("renames a key unless the target exists, and reports orphans", () => {
    expect(getText(renameKey(f, "B", "Z"), "Z")).toBe("two");
    expect(renameKey(f, "B", "A")).toBe(f);
    expect(orphanKeys({ EN: f }, new Set(["A"]))).toEqual(["B"]);
  });
  it("splits file names like the DLL", () => {
    expect(splitLocName("Test_CSF_EN.txt")).toEqual({ group: "Test_CSF", locale: "EN" });
    expect(splitLocName("hotm_en.txt")).toEqual({ group: "hotm", locale: "EN" });
    expect(splitLocName("nounderscore.txt")).toBeNull();
  });
});

describe("localization table rows", () => {
  const en = parseLoc("G_EN.txt", "$B\tb\r\n$A\ta\r\n");
  const fr = parseLoc("G_FR.txt", "$C\tc\r\n$A\ta\r\n");

  it("lists keys in file order, English first, then keys only a node uses", () => {
    expect(locRows({ FR: fr, EN: en }, new Set(["A", "Z"]))).toEqual([
      { key: "B", used: false },
      { key: "A", used: true },
      { key: "C", used: false },
      { key: "Z", used: true },
    ]);
  });
  it("puts English first in the column order", () => {
    expect(sortedLocales({ GE: en, FR: fr, EN: en })).toEqual(["EN", "FR", "GE"]);
  });
});

describe("key warnings", () => {
  const en = parseLoc("G_EN.txt", "$A\ta\r\n$B\tb\r\n$B\tb2\r\n");
  const fr = parseLoc("G_FR.txt", "$A\tx\r\n");

  it("is empty for a key used and translated everywhere", () => {
    expect(keyWarnings({ EN: en, FR: fr }, "A", true)).toEqual([]);
  });
  it("flags unused keys", () => {
    expect(keyWarnings({ EN: en }, "A", false)).toEqual(["Not used by any Localized Text node. It is kept when you save."]);
  });
  it("names the languages missing a translation", () => {
    expect(keyWarnings({ EN: en, FR: fr }, "B", true)[0]).toBe("No translation for FR.");
  });
  it("flags a key defined twice in one file", () => {
    expect(keyWarnings({ EN: en, FR: fr }, "B", true)).toContain("Defined more than once in G_EN.txt; the last entry is used.");
  });
  it("does not warn about missing translations when there are no languages", () => {
    expect(keyWarnings({}, "A", true)).toEqual([]);
  });
});
