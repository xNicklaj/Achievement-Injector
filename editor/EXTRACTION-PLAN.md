# Extraction plan: Knotwork Graph Kit

Status: **extraction done** (phases 1-5). Decisions taken after review: the kit ships built `dist/` only in build commits (`build/<main sha>`, made by CI) and release tags, never in `main` and with no `prepare` script; `createValidation` kept; `Dialog` stays in the editor; the editor pins a build commit SHA and the tag is created last, from that commit. Phases 2 and 3 were done together (each module group was extracted and generalized in one step). Sections 1-6 below are the original plan; where the code differs (for example `noSelfLink(msg?)`, `onePerChain` taking a `{key,title}` callback, `PinDef` without `multi`), the kit source and its README are authoritative.

Goal: move the generic node-graph foundations into `@nicklaj/knotwork`, make the editor consume it, change no user-visible behaviour. Inkwell is not built here; it only constrains what the kit must not assume.

## 1. Inventory

| Candidate | What it does | App dependencies | Verdict |
|---|---|---|---|
| `graphIndex.ts` | `nodeIndex`, `incoming`, `outgoing`, memoized on array identity | none | **Generic**, move verbatim |
| `graph.ts` walks | `upstream` / `downstream` along `flow-out` wires | handle string `flow-out` | **Generic**, parametrize by pin kind |
| `graph.ts` `refuseReason` | pin-kind match, self link, flow pin used, loop, unique per chain, cond pin used, link pin used | `registry`, `LIVE_TYPES`, kind strings (`ConditionsMet`, `Live`, `CreateAchievement`, `AddConditions`) | **Splittable**: generic rules move; Conditions Met / Live / Negate / On Unlock-actions-only / achievement-waits-for-itself stay as app rules |
| `graph.ts` rest | `behind`, `ownerOf`, `linkedText`, `pluginOf`, `achievementNames`, `restoreInline`, `conditionsSummary`, `isInternalGroup` | schema, localization | **App-only** |
| `registry.ts` | `NodeDef`, categories, `LINK_KINDS`/`linkKind`/`linkOut`/`wiredFields`, schema-derived defs | Zod schema | **Splittable**: `NodeDef` shape, `wiredFields` move; every concrete def, `LinkKind` union and `LINK_WIDGET` stay |
| `store.ts` | one big Zustand store | whole document model, io, workspace | **Splittable**: history machinery moves (`handleSet` 30 ms merge, equality, `edit` typing coalescing, `beginDrag`/`endDrag`); all state and actions stay |
| `validation.ts` | grouping issues by node, `parseNodeStatus`, debounced runner | `exportGroup`, `usePlugins`, `Doc` fields | **Splittable**: grouping, parser, runner move; `computeValidation`'s call to `exportGroup` and `docChanged`'s field list stay |
| `spawn.ts` | options for a dropped wire, ordering, `matchesSpawn` | `registry`, `pinKind`, `refuseReason`, `CATEGORIES` | **Splittable**: becomes generic over `PinDef`; app passes defs, order, `refuse` |
| `components/SpawnMenu.tsx` | searchable menu | `CATEGORIES`, Tailwind | **Generic** once categories are a prop; restyle to `--kw-*` CSS |
| `clipboard.ts` | copy / paste / duplicate | `linkedText`, `LocalizedText`, `CreateAchievement` rename, `useApp` | **Splittable**: copy, offset, new ids, one undo step move; the three app behaviours become hooks |
| `layout.ts` | `tidyPositions` plus `tidyUp` | `registry`, `COL`, `FLOW_CLEAR`, achievement bands | **App-only** (the algorithm is the achievement band layout). The wrapper is 3 lines, not extracted |
| `wheel.ts` | mouse vs touchpad classifier, zoom curve | none | **Generic**, move verbatim |
| `viewport.ts` | `remembered.viewport` + `listOpen` | `listOpen` is app | **App-only** (one object, reset in `load`) |
| `Canvas.tsx` | ReactFlow host | store, achievements, validation, replace menu, H / Alt+arrows keys | **Splittable**: wheel effect, Space-to-menu, nav props move as hooks / a preset; the component stays |
| `GraphNode.tsx` | node card | everything | **App-only** (see 4) |
| `AeEdge.tsx` | bezier edge with selection halo | `--select-soft` | **Generic**, rename `HaloEdge` |
| `KeyHints.tsx` | cheat sheet overlay | selection logic, hint table | **App-only** for now (see 4) |
| `FindBar.tsx` | Ctrl+F box | `registry`, `useApp.onNodesChange` | **Splittable**: props `titleOf`, `onPick`, optional `accent` |
| `Dialog.tsx` | promise modal host | none | **Generic but not graph-related**: leave (see 4) |

## 2. Kit modules and public API

Contract the kit adopts (the editor already follows it): **handle ids are `<kind>-in`, `<kind>-out` or `<kind>:<name>`**; kind names contain no `-` or `:`. `pinKind` is the text before the first `-` or `:`; `pinField` is the text after `:`. This replaces a configured prefix table, and gives Inkwell typed per-parameter inputs (`Number:x`) and named exec outputs (`exec:then`) without extra API. The editor's ids (`flow-in`, `cond-out`, `loc:achievementName`) are unchanged.

```ts
// index
export const nodeIndex: <N extends {id:string}>(nodes: N[]) => Map<string, N>;
export const incoming: (edges: Edge[], id: string) => Edge[];
export const outgoing: (edges: Edge[], id: string) => Edge[];

// pins
export const pinKind:  (h?: string|null) => string | null;
export const pinField: (h?: string|null) => string | null;
export const wiredFields: (edges: Edge[], id: string) => Set<string>;   // fields with a wire into `<kind>:<field>`
export const walk: (edges: Edge[], start: string, kind: string, dir: "up"|"down") => Set<string>;

// defs
export type PinDef  = { id: string; side: "in"|"out"; label?: string };
export type NodeDef = { kind: string; category: string; title: string; keywords: string[]; hidden?: boolean; pins: PinDef[] };

// rules (pure; messages are only asserted in tests, never shown, so rule order changes a message, not the yes/no)
export type Link = { source: string; target: string; sourceHandle?: string|null; targetHandle?: string|null };
export type RuleCtx<N extends Node> = { nodes: N[]; edges: Edge[]; node(id: string): N | undefined };  // node() also sees the virtual node
export type Rule<N extends Node> = (l: Link, ctx: RuleCtx<N>) => string | null;
export function composeRules<N extends Node>(...r: Rule<N>[]): (nodes: N[], edges: Edge[], l: Link, extra?: N) => string | null;
export const pinsMatch:   (compatible?: (from: string, to: string) => boolean, msg?: string) => Rule<Node>;
export const noSelfLink:  Rule<Node>;
export const pinUsedOnce: (kind: string, side: "source"|"target"|"both", msg: string) => Rule<Node>;
export const noLoop:      (kind: string, msg?: string) => Rule<Node>;
export const onePerChain: <N extends Node>(kind: string, uniqueTitle: (n: N) => string|undefined) => Rule<N>;

// spawn
export type SpawnFrom = { nodeId: string; handleId: string; handleType: "source"|"target" };
export type SpawnOption<D extends NodeDef> = { def: D; pin?: string; label: string };
export function spawnOptions<D extends NodeDef>(o: { defs: D[]; from: SpawnFrom|null; order: string[]; refuse: (l: Link, def: D) => string|null }): SpawnOption<D>[];
export const matchesSpawn: (o: SpawnOption<NodeDef>, q: string) => boolean;
export function SpawnMenu<D extends NodeDef>(p: { x:number; y:number; title:string; options: SpawnOption<D>[]; categories:{id:string;label:string}[]; onPick(o: SpawnOption<D>): void; onClose(): void }): JSX.Element;

// history
export function createHistory<S, P extends { nodes: Node[] }>(o: {
  partialize: (s: S) => P;          // keeps `measured` and `selected`, so undo does not remount every node
  key: (p: P) => string;            // what counts as a change (the editor's doc())
  slices: (s: S) => unknown[];      // identities that must be unchanged for typing to continue a word
}): {
  options: ZundoOptions<S, P>;      // partialize, equality via key, 30 ms merge, typing coalescing
  edit(field: string, value: unknown, get: () => S, update: () => void): void;
  beginDrag(store: TemporalStore<S,P>): void;
  endDrag(store: TemporalStore<S,P>): void;
  reset(store: TemporalStore<S,P>): void;   // clear() + restart the 30 ms window
};

// validation
export type Issue<X = {}> = { level: "error"|"warning"; message: string; detail?: string; nodeId?: string; field?: string } & X;
export function groupIssues(issues: Issue[]): { byNode: Record<string,string>; fieldsByNode: Record<string,string> };  // same "error|a\nb" strings
export function parseNodeStatus(v: string|undefined): { level: "error"|"warning"|null; messages: string[] };
export function createValidation<R>(o: { compute: () => R; wait?: number }): { use: UseBoundStore<StoreApi<R>>; schedule(): void; start(watch: ((schedule: () => void) => () => void)[]): () => void };

// clipboard
export function createClipboard<N extends Node>(o: {
  store: StoreApi<{ nodes: N[]; edges: Edge[] }>;
  edge: (s:string, sh:string, t:string, th:string) => Edge;   // the app's mkEdge: ids stay in the app's format
  copy?: (picked: N[], all: { nodes: N[]; edges: Edge[] }) => N[];  // editor: drop Localized Text, inline linked text
  paste?: (fresh: N[]) => N[];                                      // editor: "Name (copy)"
}): { copy(): number; paste(): number; duplicate(): number; has(): boolean };

// canvas
export const NAVIGATION_PROPS: Partial<ReactFlowProps>;   // zoom/pan/select props, nodeDragThreshold, connectionRadius, onlyRenderVisibleElements
export function useWheelNavigation(ref: RefObject<HTMLElement>): void;
export function useSpaceMenu(ref: RefObject<HTMLElement>, open: (p: {x:number;y:number}) => void): { cancel(): void };
export const createWheelClassifier, wheelPixels, zoomFactor;   // verbatim from wheel.ts
export function FindBar<N extends Node>(p: { nodes: N[]; titleOf(n: N): string; accent?(n: N): string; onPick(id: string): void; onClose(): void }): JSX.Element;
export function HaloEdge(p: EdgeProps): JSX.Element;
```

Styling: `knotwork.css` with `--kw-bg-panel`, `--kw-border`, `--kw-text`, `--kw-text-dim`, `--kw-select`, `--kw-select-soft`, `--kw-cat-<id>`, `--kw-pin-<kind>`, defaults included. The editor's `index.css` maps them (`--kw-select: var(--select)`), so CLAUDE.md's "colours live only in CSS variables" still holds. No Tailwind in the kit. Peers: react, react-dom, `@xyflow/react ^12.12`, zustand `^5`, zundo `^2.3`.

## 3. Stays in the app, and why

- **Zod schema, conditions, import/export, io/\*, DeepWiki, visual identity:** as stated.
- **Conditions Met / Live / Negate / On-Unlock-actions / achievement-waits rules, `behind`, `ownerOf`, `conditionsSummary`:** specific to achievement chains; they become app `Rule`s on the kit's `RuleCtx`.
- **`NodeDef` booleans (`flowIn`, `condOut`, `locOut`…):** the editor keeps them; `pins` is derived once per def when the registry is built, in `def.fields` order (spawn lists options in that order). `unique` stays an app flag fed to `onePerChain`.
- **`tidyPositions` / `tidyUp`:** the algorithm is the achievement band layout; the wrapper is three lines. Behaviour Inkwell wants (one undo step, measured heights, fit afterwards) is documented in the kit README rather than coded until Inkwell proves the shape.
- **`GraphNode`, `NodeFrame`/`Pin`:** handle placement differs per node row (GraphNode.tsx:221-238, 283-288), and moving Tailwind to `--kw-*` CSS changes measured sizes, which the perf and history tests depend on. Extract once Inkwell has built a node.
- **`KeyHints`:** nearly all content is the app's selection logic and hint table. The shell (overNode hit-test) is ~15 lines; extract later.
- **`Dialog.tsx`:** generic but not a graph foundation; Inkwell (Electron) will have its own chrome. Left; say so if you want it moved.
- **`viewport.ts`:** one object, reset in `load`; left.
- **`Canvas.tsx`:** stays, composing the kit's hooks. A `<GraphCanvas>` would need options for the replace menu, fold keys, achievement list and empty-state text, which is the awkward-options case.
- **`defineNodes`, a `Meta` generic on `NodeDef`:** left out; the app writes `type AeDef = NodeDef & {...}` and kit functions take `D extends NodeDef`.

## 4. Decisions for you

1. **Distribution: build + `prepare`, or ship TS source?** You specified a built ESM package with a `prepare` script, and the plan follows that. The review flagged real risks: `prepare` is skipped under `--ignore-scripts`, clones and builds devDependencies on every install (slow, Windows antivirus lock failures), and the editor deploys via Cloudflare (`wrangler.jsonc`; the GitHub Pages workflow was removed in 57e7801), so Cloudflare's build must be able to clone and build the kit. Alternative: export TS source and `knotwork.css` directly (Vite and tsc handle it; Vitest needs `server.deps.inline` for the package). **Recommendation: build as you asked, and also pin a `git+https://` spec in the lockfile to avoid SSH entries.** Say if you prefer source-only.
2. **Typing coalescing.** The draft generalization would compare the whole partialized state to decide whether a word continues. To keep exact parity I use `slices` (the editor passes `nodes` and `loc`, as today). No behaviour change.
3. **Validation runner.** Included as a small `createValidation` (the editor passes its two sources, `useApp` and `usePlugins`), since you asked for it, though it is ~10 lines. Drop if you would rather not.

## 5. Phases

2. **Extract in place:** `editor/packages/knotwork/`, npm workspace, TS source consumed directly. Order: index/pins/rules, history, validation, spawn + SpawnMenu, clipboard, canvas hooks/wheel/FindBar/HaloEdge. One Sonnet agent per group, never two on the same files. Tests move with code (`graphIndex.test.ts`, `wheel.test.ts`; `graph.test.ts` and `spawn.test.ts` and `store.test.ts` split into kit vs app). Commit per group, checks after each.
3. **Generalize:** the editor supplies its pins (`flow`, `cond`, `loc`, `ach`, `icon`, `plugin`) and rules. The kit gains its own `perf.test.ts` (5k-node graph: index, walks, `composeRules`, `spawnOptions`) alongside the editor's unchanged one.
4. **Kit repo:** scaffold, build, CHANGELOG, CLAUDE.md, README (license undecided, no LICENSE file), CI, tag `v0.1.0`, push to main of the empty repo. This is the first outward-facing step.
5. **Consume:** git dependency, remove `packages/knotwork/`, update CLAUDE.md and HANDOVER.md.

## 6. Parity risks (checked against the code)

1. **Spawn's virtual node** (`spawn.ts:108-113`): `graph.ts:106, 111, 116, 119, 134` use `nodes.find`; each must go through `ctx.node`, or the new node is invisible to the Conditions Met, unique-per-chain and On Unlock rules. Tests in `spawn.test.ts` cover this.
2. **Persisted strings:** `edgeId`/`mkEdge` format (`importGroup.ts:16`), React Flow's `addEdge` ids (`store.ts:195`), `docKey` (drafts, `savedKey`), and hard-coded handles (`graph.ts:211`, `store.ts:242-247`, `layout.ts`). Must stay byte-identical; `mkEdge` stays in the app and is injected.
3. **History snapshots:** partialized state keeps `measured` and `selected` while equality ignores them (`store.ts:103-111, 371-372`); `endDrag` builds the past entry from the partialized state with pre-drag positions (`store.ts:405-413`). Stripping to `doc()` would remount every node on undo (`store.test.ts` checks it).
4. **Typing coalescing is synchronous:** `coalesce` is set before `update()` and read inside `handleSet`. State becomes closure state per `createHistory`, never shared or batched. Verified in zundo's source that equality runs before `handleSet`, so selection or measure updates do not move the 30 ms window (an earlier review claim to the contrary was wrong).
5. **Validation strings** (`byNode` is `level|detail ?? message`, split at `Canvas.tsx:262` and in `parseNodeStatus`); keep `setState(..., true)` and the plugins subscription.
6. **Wheel listener:** capture phase, excludes `.nowheel, .react-flow__minimap, .react-flow__controls`; `onMoveStart` must call the Space menu's `cancel`.
7. **Performance:** kit rules use `incoming`/`outgoing` and `ctx.node` instead of `edges.some` / `nodes.find` (a speed-up, same answers). `perf.test.ts` budgets stay.
8. **Dependencies:** `react`, `@xyflow/react`, `zustand`, `zundo` are peers only; a second `@xyflow/react` copy breaks `useReactFlow`. The kit's tests use the editor's copies via the workspace.

Unverified: that Vitest handles the package as-is in the final git-dependency form (only matters under the source-only option).
