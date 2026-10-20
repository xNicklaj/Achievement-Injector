import { expect, it } from "vitest";
import { nodeDefs } from "./registry";

it("every node is named in Title Case", () => {
  for (const d of nodeDefs) expect(d.title, d.kind).toBe(d.title.replace(/(^| )[a-z]/g, (m) => m.toUpperCase()));
  expect(nodeDefs.find((d) => d.kind === "QuestStageDone")!.title).toBe("Quest Stage Done");
});
