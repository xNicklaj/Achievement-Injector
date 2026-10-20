import { describe, expect, it } from "vitest";
import { getText } from "./localization";
import { filesWorkspace, folderWorkspace, groupNameError, pickedFolderWorkspace, zipFiles, type DirH, type FileH } from "./workspace";
import { writeFileSync } from "node:fs";

type Content = string | Uint8Array;
type Mem = DirH & { files: Record<string, Content>; dirs: Record<string, Mem> };

/** In-memory folder with the File System Access API shape. */
function memDir(name: string, files: Record<string, Content> = {}, dirs: Record<string, Mem> = {}): Mem {
  const fileH = (n: string): FileH => ({
    kind: "file",
    getFile: async () => ({ arrayBuffer: async () => (typeof files[n] === "string" ? new TextEncoder().encode(files[n] as string) : (files[n] as Uint8Array)).buffer as ArrayBuffer }),
    createWritable: async () => ({ write: async (d) => void (files[n] = d), close: async () => {} }),
  });
  return {
    kind: "directory",
    name,
    files,
    dirs,
    async *entries() {
      for (const n of Object.keys(files)) yield [n, fileH(n)] as [string, FileH];
      for (const [n, d] of Object.entries(dirs)) yield [n, d] as [string, DirH];
    },
    async getFileHandle(n, o) {
      if (!(n in files)) {
        if (!o?.create) throw new Error("NotFound");
        files[n] = "";
      }
      return fileH(n);
    },
    async getDirectoryHandle(n, o) {
      if (!(n in dirs)) {
        if (!o?.create) throw new Error("NotFound");
        dirs[n] = memDir(n);
      }
      return dirs[n];
    },
  };
}

const group = JSON.stringify({ groupName: "G", plugin: "A.esp", achievements: [] });

describe("folder workspace", () => {
  it("lists groups, loads one with its own localization files only", async () => {
    const loc = memDir("Localizations", { "G_EN.txt": "$A\thello\r\n", "G_fr.txt": "$A\tsalut\r\n", "Other_EN.txt": "$A\tno\r\n", "G_X_EN.txt": "$A\tno\r\n" });
    const ws = folderWorkspace(memDir("AchievementsData", { "G.json": group, "H.json": group, "readme.md": "" }, { Localizations: loc }));
    expect(await ws.list()).toEqual(["G.json", "H.json"]);
    const b = await ws.load("G.json");
    expect(Object.keys(b.loc).sort()).toEqual(["EN", "FR"]);
    expect(getText(b.loc.FR, "A")).toBe("salut");
    expect(b.loc.FR.fileName).toBe("G_fr.txt");
  });

  it("loads a group that has no Localizations folder", async () => {
    const b = await folderWorkspace(memDir("d", { "G.json": group })).load("G.json");
    expect(b.loc).toEqual({});
  });

  it("writes JSON beside it and localization files into Localizations, creating the folder", async () => {
    const d = memDir("d", { "G.json": group });
    await folderWorkspace(d).write([
      { name: "G.json", text: "{}" },
      { name: "G_EN.txt", text: "$A\tx\r\n", dir: "Localizations" },
    ]);
    expect(d.files["G.json"]).toBe("{}");
    expect(d.dirs.Localizations.files["G_EN.txt"]).toBe("$A\tx\r\n");
  });

  it("tolerates a BOM on the JSON", async () => {
    const d = memDir("d", { "G.json": "﻿" + group });
    expect((await folderWorkspace(d).load("G.json")).json).toMatchObject({ groupName: "G" });
  });
});

describe("files workspace", () => {
  it("pairs the picked JSON with matching localization files", async () => {
    const ws = filesWorkspace([new File([group], "G.json"), new File(["$A\tx"], "G_EN.txt"), new File(["$A\ty"], "H_EN.txt")]);
    expect(await ws.list()).toEqual(["G.json"]);
    expect(Object.keys((await ws.load("G.json")).loc)).toEqual(["EN"]);
  });
});

describe("group names", () => {
  it.each([
    ["", /Enter/],
    ["a:b", /Cannot/],
    ["a ", /spaces/],
    ["nul", /Reserved/],
    ["g", /exists/],
  ])("rejects %j", (n, re) => {
    expect(groupNameError(n, ["G.json"])).toMatch(re);
  });
  it("accepts names with spaces and underscores", () => {
    expect(groupNameError("My Group_2", ["G.json"])).toBeNull();
  });
});

describe("picked folder workspace (directory input)", () => {
  const file = (path: string, text = "x") => Object.assign(new File([text], path.split("/").pop()!), { webkitRelativePath: path });
  const picked = [
    file("AchievementsData/G.json", group),
    file("AchievementsData/H.json", group),
    file("AchievementsData/Localizations/G_EN.txt", "$A\thi\r\n"),
    file("AchievementsData/Localizations/G_PO.txt", "$A\tcześć\r\n"),
    file("AchievementsData/Localizations/H_EN.txt", "$A\tno\r\n"),
    file("AchievementsData/Icons/G.dds"),
    file("AchievementsData/Icons/G/icon.json"),
  ];

  it("lists the group files and loads one with its own localization files", async () => {
    const ws = pickedFolderWorkspace(picked);
    expect(ws.label).toBe("AchievementsData");
    expect(await ws.list()).toEqual(["G.json", "H.json"]);
    const b = await ws.load("G.json");
    expect(Object.keys(b.loc).sort()).toEqual(["EN", "PO"]);
    expect(getText(b.loc.PO, "A")).toBe("cześć");
  });

  it("finds AchievementsData inside a parent folder, ignoring other folders", async () => {
    const ws = pickedFolderWorkspace([
      ...picked.map((f) => file(`Plugins/${f.webkitRelativePath}`)),
      file("Plugins/Other/Z.json", group),
    ]);
    expect(await ws.list()).toEqual(["G.json", "H.json"]);
  });

  it("reports nothing for a folder without group files", async () => {
    expect(await pickedFolderWorkspace([file("Mods/readme.txt")]).list()).toEqual([]);
  });
});

describe("icons in a folder workspace", () => {
  const bytes = (...n: number[]) => new Uint8Array(n);
  const root = () =>
    memDir("AchievementsData", { "G.json": group }, {
      Icons: memDir("Icons", { "G.dds": bytes(1) }, { G: memDir("G", { "One.dds": bytes(2), "two.DDS": bytes(3), "notes.txt": "x" }), Other: memDir("Other", { "Z.dds": bytes(9) }) }),
    });

  it("lists the .dds files of one group's folder only", async () => {
    expect(await folderWorkspace(root()).icons!.list("G")).toEqual(["One.dds", "two.DDS"]);
    expect(await folderWorkspace(root()).icons!.list("Nope")).toEqual([]);
  });
  it("reads an icon by path, and returns undefined for a missing one", async () => {
    const ws = folderWorkspace(root());
    expect([...(await ws.icons!.read("Icons/G/One.dds"))!]).toEqual([2]);
    expect([...(await ws.icons!.read("Icons/G.dds"))!]).toEqual([1]);
    expect(await ws.icons!.read("Icons/G/missing.dds")).toBeUndefined();
  });
  it("writes binary files into nested folders it creates", async () => {
    const d = memDir("d", { "G.json": group });
    await folderWorkspace(d).write([{ name: "New.dds", dir: "Icons/G", data: bytes(7, 8) }]);
    expect([...(d.dirs.Icons.dirs.G.files["New.dds"] as Uint8Array)]).toEqual([7, 8]);
  });
});

describe("icons in a picked folder (directory input)", () => {
  const file = (path: string, data = [0]) => Object.assign(new File([new Uint8Array(data)], path.split("/").pop()!), { webkitRelativePath: path });
  const ws = pickedFolderWorkspace([
    file("AchievementsData/G.json", []),
    file("AchievementsData/Icons/G.dds", [1]),
    file("AchievementsData/Icons/G/One.dds", [2]),
    file("AchievementsData/Icons/g/Two.dds", [3]),
    file("AchievementsData/Icons/Other/Z.dds", [9]),
  ]);

  it("lists and reads icons ignoring case, like Windows", async () => {
    expect((await ws.icons!.list("G")).sort()).toEqual(["One.dds", "Two.dds"]);
    expect([...(await ws.icons!.read("icons/G/one.DDS"))!]).toEqual([2]);
    expect(await ws.icons!.read("Icons/G/none.dds")).toBeUndefined();
  });
});

describe("zipFiles", () => {
  it("writes a ZIP that standard tools can read, with folder paths", () => {
    const nl = "\n", tab = "\t";
    const zip = zipFiles([{ name: "G.json", text: "{}" + nl }, { name: "G_EN.txt", text: "$a" + tab + "Ä" + nl, dir: "Localizations" }, { name: "x.dds", data: new Uint8Array([1, 2, 3]), dir: "Icons/G" }]);
    if (process.env.ZIP_OUT) writeFileSync(process.env.ZIP_OUT, zip);
    expect(new DataView(zip.buffer).getUint16(zip.length - 14, true)).toBe(3);
  });
});
