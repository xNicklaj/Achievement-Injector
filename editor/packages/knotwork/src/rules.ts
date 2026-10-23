import type { Edge, Node } from "@xyflow/react";
import { incoming, nodeIndex, outgoing } from "./graphIndex";
import { pinKind, walk } from "./pins";

export type Link = { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };
/** `node()` also sees the virtual node passed to the composed rule, which is not in `nodes`. */
export type RuleCtx<N extends Node> = { nodes: N[]; edges: Edge[]; node(id: string): N | undefined };
export type Rule<N extends Node> = (l: Link, ctx: RuleCtx<N>) => string | null;

/** Runs the rules in order and returns the first reason. `extra` is a node that does not exist yet (a spawn candidate). */
export const composeRules =
  <N extends Node>(...rules: Rule<N>[]) =>
  (nodes: N[], edges: Edge[], link: Link, extra?: N): string | null => {
    const ctx: RuleCtx<N> = { nodes, edges, node: (id) => (extra && id === extra.id ? extra : nodeIndex(nodes).get(id)) };
    for (const r of rules) {
      const why = r(link, ctx);
      if (why) return why;
    }
    return null;
  };

export const pinsMatch =
  (compatible: (from: string, to: string) => boolean = (a, b) => a === b, msg = "Pin types differ"): Rule<Node> =>
  (l) => {
    const a = pinKind(l.sourceHandle);
    const b = pinKind(l.targetHandle);
    return a && b && compatible(a, b) ? null : msg;
  };

export const noSelfLink =
  (msg = "Cannot connect a node to itself"): Rule<Node> =>
  (l) => (l.source === l.target ? msg : null);

/** A pin of `kind` takes one wire: refuses when the pin on that side (or either, for "both") already has one. */
export const pinUsedOnce =
  (kind: string, side: "source" | "target" | "both", msg: string): Rule<Node> =>
  (l, { edges }) => {
    const src = side !== "target" && pinKind(l.sourceHandle) === kind && outgoing(edges, l.source).some((e) => e.sourceHandle === l.sourceHandle);
    const dst = side !== "source" && pinKind(l.targetHandle) === kind && incoming(edges, l.target).some((e) => e.targetHandle === l.targetHandle);
    return src || dst ? msg : null;
  };

/** Refuses a wire of `kind` that would close a loop. */
export const noLoop =
  (kind: string, msg = "Would create a loop"): Rule<Node> =>
  (l, { edges }) => (pinKind(l.sourceHandle) === kind && walk(edges, l.source, kind, "up").add(l.source).has(l.target) ? msg : null);

/** A chain may hold one node per `unique(n).key`; `title` names it in the message. */
export const onePerChain =
  <N extends Node>(kind: string, unique: (n: N) => { key: string; title: string } | undefined): Rule<N> =>
  (l, { edges, node }) => {
    if (pinKind(l.sourceHandle) !== kind) return null;
    const ids = [...walk(edges, l.source, kind, "up").add(l.source), ...walk(edges, l.target, kind, "down").add(l.target)];
    const count = new Map<string, { n: number; title: string }>();
    for (const id of ids) {
      const n = node(id);
      const u = n && unique(n);
      if (u) count.set(u.key, { n: (count.get(u.key)?.n ?? 0) + 1, title: u.title });
    }
    for (const { n, title } of count.values()) if (n > 1) return `A chain can have only one ${title}`;
    return null;
  };
