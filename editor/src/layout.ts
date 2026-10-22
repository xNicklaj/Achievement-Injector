import type { Edge } from "@xyflow/react";
import { behind, isGroupCondition, type AppNode } from "./graph";
import { COL, estimateHeight } from "./io/importGroup";
import { registry } from "./registry";
import { useApp } from "./store";

type Pos = { x: number; y: number };

/**
 * Where every node goes in the layout the importer uses: one band per achievement, top to bottom in their current order.
 * Text nodes in the left column, the achievement, its conditions, then its chain; a condition's On Unlock actions follow
 * past the end of the chain. Nodes not reached from an achievement are gathered in a grid below.
 */
export function tidyPositions(nodes: AppNode[], edges: Edge[]): Map<string, Pos> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const height = (n: AppNode) => n.measured?.height ?? estimateHeight(registry[n.data.kind], n.data.values);
  const target = (id: string, handle: string) => edges.find((e) => e.source === id && e.sourceHandle === handle)?.target;
  const chain = (id: string) => {
    const out: AppNode[] = [];
    const seen = new Set([id]);
    for (let t = target(id, "flow-out"); t && !seen.has(t) && byId.has(t); t = target(t, "flow-out")) (seen.add(t), out.push(byId.get(t)!));
    return out;
  };

  const placed = new Map<string, Pos>();
  const put = (n: AppNode, x: number, y: number) => void placed.set(n.id, { x, y });
  let y = 0;

  const creates = nodes.filter((n) => n.data.kind === "CreateAchievement").sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  for (const create of creates) {
    const bandY = y;
    let loc = bandY; // next free row in the left column
    const text = (n: AppNode) => {
      for (const e of edges) {
        const src = e.target === n.id && (e.sourceHandle === "loc-out" || e.sourceHandle === "icon-out" || e.sourceHandle === "plugin-out") ? byId.get(e.source) : undefined;
        if (src && !placed.has(src.id)) (put(src, -COL, loc), (loc += height(src) + 20));
      }
    };

    put(create, 0, bandY);
    text(create);
    const main = chain(create.id);
    const add = main.find((n) => n.data.kind === "AddConditions");
    type Fed = ReturnType<typeof behind>;
    /** The conditions wired into `id`, each with its Live / Negate nodes. */
    const fedBy = (id: string): Fed[] => edges.filter((x) => x.target === id && x.targetHandle === "cond-in").map((e) => behind(nodes, edges, e.source));
    /** A Conditions Met sits past the columns of what it holds, which are to its left. */
    const columnX = (f: Fed): number => Math.max(COL, ...(f.root && isGroupCondition(f.root.data.kind) ? fedBy(f.root.id) : []).map((k) => columnX(k) + COL * (1 + k.mods.length)));
    // Live / Negate nodes sit in columns between the conditions and Add Conditions.
    const fed = add ? fedBy(add.id) : [];
    const condEnd = Math.max(2 * COL, ...fed.map((f) => columnX(f) + COL * (1 + f.mods.length)));
    const chainX = (i: number) => (add ? condEnd : COL) + i * COL;
    main.forEach((n, i) => put(n, chainX(i), bandY));

    /** Places one condition, then the conditions inside it. Returns the vertical room used. */
    const place = (f: Fed, cy: number): number => {
      const c = f.root;
      if (!c || placed.has(c.id)) return 0;
      const x = columnX(f);
      put(c, x, cy);
      f.mods.forEach((m, k) => put(m, x + COL * (1 + k), cy));
      text(c);
      const actions = chain(c.id);
      actions.forEach((a, k) => put(a, chainX(main.length) + k * COL, cy));
      let inner = 0;
      if (isGroupCondition(c.data.kind)) for (const k of fedBy(c.id)) inner += place(k, cy + inner);
      return Math.max(Math.max(height(c), ...actions.map(height)) + 20, inner);
    };
    let cy = bandY;
    for (const f of fed) cy += place(f, cy);
    y += Math.max(height(create), cy - bandY, loc - bandY) + 80;
  }

  // Unused keys and anything not reached from an achievement.
  const rest = nodes.filter((n) => !placed.has(n.id));
  const per = 4;
  rest.forEach((n, i) => put(n, (i % per) * COL, y + Math.floor(i / per) * 200));
  return placed;
}

/** Rearrange the graph; one undo step. */
export function tidyUp() {
  const { nodes, edges } = useApp.getState();
  const at = tidyPositions(nodes, edges);
  useApp.setState({ nodes: nodes.map((n) => ({ ...n, position: at.get(n.id) ?? n.position })) });
}
