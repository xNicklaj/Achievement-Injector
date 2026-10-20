import { beforeEach, describe, expect, it } from "vitest";
import { copySelection, duplicateSelection, paste } from "./clipboard";
import { importGroup } from "./io/importGroup";
import { parseLoc } from "./io/localization";
import { useApp } from "./store";

const raw = {
  groupName: "G",
  plugin: "A.esp",
  achievements: [{ achievementName: "A", description: "$d", conditions: [{ type: "PlayerLevel", level: 1, onUnlock: [{ type: "command", command: "x" }] }] }],
};
const open = () => useApp.getState().load(importGroup(raw), "G.json", { EN: parseLoc("G_EN.txt", "$d\tHello\r\n") }, null);
const select = (pred: (kind: string) => boolean) => useApp.setState({ nodes: useApp.getState().nodes.map((n) => ({ ...n, selected: pred(n.data.kind) })) });
const wait = () => new Promise((r) => setTimeout(r, 40));

beforeEach(open);

describe("copy and paste", () => {
  it("pastes the selected nodes and the wires between them, with new ids and a unique name", () => {
    select((k) => k !== "LocalizedText");
    const before = useApp.getState();
    const n = before.nodes.length;
    expect(copySelection()).toBe(4);
    expect(paste()).toBe(4);
    const s = useApp.getState();
    expect(s.nodes).toHaveLength(n + 4);
    expect(new Set(s.nodes.map((x) => x.id)).size).toBe(s.nodes.length);
    expect(s.nodes.find((x) => x.data.values.achievementName === "A (copy)")).toBeDefined();
    expect(s.edges.filter((e) => e.sourceHandle === "flow-out")).toHaveLength(2 * before.edges.filter((e) => e.sourceHandle === "flow-out").length);
    expect(s.nodes.filter((x) => x.selected)).toHaveLength(4);
  });
  it("turns text fed by a Localized Text node into plain text, and never copies the key node", () => {
    select((k) => k === "CreateAchievement");
    copySelection();
    paste();
    const copy = useApp.getState().nodes.find((x) => x.data.values.achievementName === "A (copy)")!;
    expect(copy.data.values.description).toBe("Hello");
    expect(useApp.getState().nodes.filter((x) => x.data.kind === "LocalizedText")).toHaveLength(1);
  });
  it("is one undo step, and repeated pastes do not stack", async () => {
    select((k) => k === "PlayerLevel");
    useApp.temporal.getState().clear();
    await wait();
    duplicateSelection();
    await wait();
    paste();
    expect(useApp.temporal.getState().pastStates).toHaveLength(2);
    useApp.temporal.getState().undo();
    expect(useApp.getState().nodes.filter((x) => x.data.kind === "PlayerLevel")).toHaveLength(2);
    const [a, b] = useApp.getState().nodes.filter((x) => x.data.kind === "PlayerLevel").map((x) => x.position);
    expect(a).not.toEqual(b);
  });
  it("copies nothing when nothing, or only a Localized Text node, is selected", () => {
    select(() => false);
    expect(copySelection()).toBe(0);
    select((k) => k === "LocalizedText");
    expect(copySelection()).toBe(0);
  });
});
