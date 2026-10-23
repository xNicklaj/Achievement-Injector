# Achievement Injector Config Editor

Local-only React app that edits Achievement Injector JSON configs as a node graph. Nothing leaves the browser. Design decisions and current status are in [HANDOVER.md](HANDOVER.md); read it before changing behaviour. Doc fixes for the mod's wiki are in [WIKI-FIXES.md](WIKI-FIXES.md).

## Commands

Run from `editor/`:
- `npm run dev` Vite dev server
- `npm test` vitest (schema against every shipped config, graph rules)
- `npm run typecheck`
- `npm run build` typecheck + production build
- `npm run schema` regenerate `schema/achievement-injector.schema.json`

Before finishing a change: `npm test` and `npm run typecheck` must pass.

## Layout

- `src/schema/` Zod 4 schema, the single source of truth. `fields.ts` (field factories + metadata), `conditions.ts` (32 condition types), `group.ts` (achievement + group).
- `src/registry.ts` node registry, derived from the schema. Drives the node list, widgets and pins.
- `src/graph.ts` pure connection rules and the `AddConditions` summary. `src/store.ts` Zustand + zundo.
- `src/components/` UI. Layout is in HANDOVER 3.15.
- The mod's C++ is in `../src`. The editor never imports it.
- **Knotwork Graph Kit** (`@xnicklaj/knotwork`, repo [xNicklaj/Knotwork-Graph-Kit](https://github.com/xNicklaj/Knotwork-Graph-Kit), pinned in `package.json` to a build commit SHA) holds the generic node-graph foundations: `nodeIndex`/`incoming`/`outgoing`, the pin grammar and `walk`, composable connection rules (`composeRules` and the built-in rules), undo history (`createHistory`: 30 ms merge, per-word typing, one entry per drag), validation plumbing (`createValidation`, `groupIssues`, `parseNodeStatus`), `spawnOptions` + `SpawnMenu`, `createClipboard`, canvas navigation (`NAVIGATION_PROPS`, `useWheelNavigation`, `useSpaceMenu`, wheel classifier), `FindBar`, `HaloEdge`. **Change those in the kit repo, not here**: edit there, let its `build-ref` workflow publish the build commit, pin that SHA here, run the checks, then release a tag from it (see the kit's CLAUDE.md). The editor keeps the app side: the node registry and its `pins`, the achievement rules in `graph.ts`, `store.ts` state, `validation.ts`'s `computeValidation`, the tidy-up layout, and `GraphNode`/`Canvas`. The kit is styled by `--kw-*` variables, which `src/index.css` maps onto the editor's own.

## Rules that are easy to break

- **Build the schema from the DLL's code** (`../src/Achievement.cpp`, `plugin.cpp`, `Runnable.cpp`, `Conditions/*`), not the wiki, which has drifted. When the DLL changes, update the schema, tag new fields with `since`, bump `TARGET_VERSION`, and run `npm test`.
- **Parsing never applies defaults.** Defaults live in field `.meta({ default })` only, so explicit defaults survive a round-trip. No `.default()` in Zod.
- **Unset means not serialized.** An empty input removes the key (`setValue(..., undefined)`); never write `""`, `null` or the default.
- **Keep unknown keys** (loose objects). Lossless JSON -> graph -> JSON is the goal.
- **Colours live only in CSS variables** in `src/index.css`. Handle and edge colours are inline styles because Tailwind cannot scan runtime class strings. Inline fields have no type icons (decided); field names show in PascalCase (`pascal()`), JSON keys stay camelCase.
- **Graph rules belong in `graph.ts`** (pure, tested), not in components. `refuseReason` is a `composeRules(...)` of the kit's rules plus this app's own `Rule` functions; inside a rule look nodes up with `ctx.node(id)`, never `nodes.find` (spawn passes a node that is not in `nodes`). New "only one X per chain" rules reuse the `unique` flag on the node def.
- **Undo history tracks the document only** (nodes, edges, group), not selection or measured size. Drags record one entry via `beginDrag`/`endDrag`.
- **Icons** are `.dds`, BC3 (DXT5) or lower, 512×512; paths are `Icons/<group file name>/<icon>` and `Icons/<group>.dds`. `io/dds.ts` is the only place that reads the format.
- **Version stamp.** Export writes `_editor.modVersion` = largest `since` among fields in use; import refuses files newer than `TARGET_VERSION`. New condition types or fields must carry `since`. Unknown condition types load as `UnknownCondition` (type kept in `extra.type`) and are never lost or rewritten.
- **A condition's `onUnlock`** is a flow chain from the condition node, actions only (`graph.ts`); the achievement's own `onUnlock` is the chain after its Create node.
- **Link pins** (`loc`, `ach`, `icon`, `plugin`) are one mechanism: add a kind in `registry.ts` (`LINK_KINDS`, `linkKind`, the node def flag), `linkedText` in `graph.ts`, and a colour (`refuseReason` already allows one wire per field for every kind in `LINK_KINDS`); export, delete-fallback, paste, spawn and the pin kinds then follow. A wired field has no inline value; a deleted wire writes the value back as text.
- **History**: typing coalesces per word through `history.edit` (the kit's `createHistory`, set up in `store.ts`); new text-edit actions should go through it.
- **Never scan `nodes` or `edges` once per node.** Every node's store selectors, validation, export and Tidy up visit each node, so a `find` or `filter` over the whole list inside them is quadratic (it made a 438-node file cost half a second per store update). Use the kit's `nodeIndex`, `incoming`, `outgoing` (built once per array, keyed on its identity) and keep helpers free of per-call `new Map(nodes...)`. `perf.test.ts` holds the time budgets for a 300-achievement group.
- **Only nodes in view are mounted** (`onlyRenderVisibleElements` in `Canvas.tsx`; a node is mounted once, unmeasured, when a file opens). A node component can unmount when scrolled away, so keep nothing in `useState` that must outlive that (the optional-rows fold and an uncommitted name draft do reset), never look a node up in the DOM, and keep `measured` on nodes in history (`store.test.ts` checks it): without it every node is mounted again on undo.
- **Validation has one source.** `exportGroup` returns issues pinned to nodes (`nodeId`, `field`); `validation.ts` runs it once, debounced, and nodes, minimap and the JSON view all read that. Do not recompute problems in components.
- **Tests that touch IndexedDB** use `fake-indexeddb`. In a real-browser script never `deleteDatabase` while the page has the DB open: the request stays pending and wipes the data when the page closes. Delete records instead.
- **Locale codes are not ISO.** They are the first two letters of `sLanguage` (`EN FR GE IT SP PO RU JA CH`, see `src/io/languages.ts`). Never offer `DE`, `ES`, `PL` or `ZH`: such files never load.
- **The editor is local-only except the Ask panel**, which sends the typed question (never group data) to DeepWiki (`io/deepwiki.ts`). Do not add other network calls without saying so in the UI.
- Editor UI is English only. Targets the latest DLL version; show it in the footer/menu bar.
