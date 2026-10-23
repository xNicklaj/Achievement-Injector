import { createClipboard, nodeIndex } from "@nicklaj/knotwork";
import { achievementNames, linkedText, type AppNode } from "./graph";
import { LINK_KINDS } from "./registry";
import { mkEdge } from "./io/importGroup";
import { useApp, type State } from "./store";

/** `Name` -> `Name (copy)`, `Name (copy 2)`..., skipping names in use: achievement names are unique. */
const unused = (name: string, taken: Set<string>) => {
  let n = `${name} (copy)`;
  for (let i = 2; taken.has(n); i++) n = `${name} (copy ${i})`;
  taken.add(n);
  return n;
};

/**
 * Localized Text nodes are never copied (a key belongs to one node, so a copy would clash): a field they fed is copied as plain
 * text instead, so the pasted node reads the same. Pasted achievements get a free name.
 */
const clip = createClipboard<AppNode, State>({
  store: useApp,
  edge: mkEdge,
  exclude: (n) => n.data.kind === "LocalizedText",
  copy: (picked, { nodes, edges, loc }) => {
    const ids = new Set(picked.map((n) => n.id));
    const index = nodeIndex(nodes);
    const inline = new Map<string, Record<string, string>>();
    // A wire from a node that is not copied (text, an achievement, an icon) is copied as its value, so the paste reads the same.
    for (const e of edges) {
      const kind = LINK_KINDS.find((k) => e.sourceHandle === `${k}-out` && e.targetHandle?.startsWith(`${k}:`));
      const source = index.get(e.source);
      if (!kind || !source || ids.has(e.source) || !ids.has(e.target)) continue;
      const text = linkedText(nodes, edges, loc, source, kind);
      if (text !== undefined) inline.set(e.target, { ...inline.get(e.target), [e.targetHandle!.slice(kind.length + 1)]: text });
    }
    return picked.map((n) => (inline.has(n.id) ? { ...n, data: { ...n.data, values: { ...n.data.values, ...inline.get(n.id) } } } : n));
  },
  paste: (fresh, s) => {
    const taken = new Set(achievementNames(s.nodes, s.edges, s.loc));
    for (const { data } of fresh) if (data.kind === "CreateAchievement" && typeof data.values.achievementName === "string") data.values.achievementName = unused(data.values.achievementName, taken);
    return fresh;
  },
});

export const hasClipboard = clip.has;
export const copySelection = clip.copy;
export const paste = clip.paste;
export const duplicateSelection = clip.duplicate;
