import { describe, expect, it } from "vitest";
import { getText } from "./localization";
import { filesWorkspace, folderWorkspace, groupNameError, pickedFolderWorkspace, type DirH, type FileH } from "./workspace";

type Mem = DirH & { files: Record<string, string>; dirs: Record<string, Mem> };

/** In-memory folder with the File System Access API shape. */
function memDir(name: string, files: Record<string, string> = {}, dirs: Record<string, Mem> = {}): Mem {
  const fileH = (n: string): FileH => ({
    kind: "file",
    getFile: async () => ({ arrayBuffer: async () => new TextEncoder().encode(files[n]).buffer as ArrayBuffer }),
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
