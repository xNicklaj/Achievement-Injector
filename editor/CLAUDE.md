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

## Rules that are easy to break

- **Build the schema from the DLL's code** (`../src/Achievement.cpp`, `plugin.cpp`, `Runnable.cpp`, `Conditions/*`), not the wiki, which has drifted. When the DLL changes, update the schema, tag new fields with `since`, bump `TARGET_VERSION`, and run `npm test`.
- **Parsing never applies defaults.** Defaults live in field `.meta({ default })` only, so explicit defaults survive a round-trip. No `.default()` in Zod.
- **Unset means not serialized.** An empty input removes the key (`setValue(..., undefined)`); never write `""`, `null` or the default.
- **Keep unknown keys** (loose objects). Lossless JSON -> graph -> JSON is the goal.
- **Colours live only in CSS variables** in `src/index.css`. Handle and edge colours are inline styles because Tailwind cannot scan runtime class strings. Inline fields have no type icons (decided); field names show in PascalCase (`pascal()`), JSON keys stay camelCase.
- **Graph rules belong in `graph.ts`** (pure, tested), not in components. New "only one X per chain" rules reuse the `unique` flag on the node def.
- **Undo history tracks the document only** (nodes, edges, group), not selection or measured size. Drags record one entry via `beginDrag`/`endDrag`.
- **Icons** are `.dds`, BC3 (DXT5) or lower, 512×512; paths are `Icons/<group file name>/<icon>` and `Icons/<group>.dds`. `io/dds.ts` is the only place that reads the format.
- **Version stamp.** Export writes `_editor.modVersion` = largest `since` among fields in use; import refuses files newer than `TARGET_VERSION`. New condition types or fields must carry `since`. Unknown condition types load as `UnknownCondition` (type kept in `extra.type`) and are never lost or rewritten.
- **A condition's `onUnlock`** is a flow chain from the condition node, actions only (`graph.ts`); the achievement's own `onUnlock` is the chain after its Create node.
- **Link pins** (`loc`, `ach`, `icon`) are one mechanism: add a kind in `registry.ts` (`LINK_KINDS`, `linkKind`, the node def flag), `linkedText` in `graph.ts`, and a colour; export, delete-fallback, paste, spawn and the pin kinds then follow. A wired field has no inline value; a deleted wire writes the value back as text.
- **History**: typing coalesces per word in `store.ts` (`edit`); new text-edit actions should go through it.
- **Never scan `nodes` or `edges` once per node.** Every node's store selectors, validation, export and Tidy up visit each node, so a `find` or `filter` over the whole list inside them is quadratic (it made a 438-node file cost half a second per store update). Use `graphIndex.ts` (`nodeIndex`, `incoming`, `outgoing`: built once per array, keyed on its identity) and keep helpers free of per-call `new Map(nodes...)`. `perf.test.ts` holds the time budgets for a 300-achievement group.
- **Validation has one source.** `exportGroup` returns issues pinned to nodes (`nodeId`, `field`); `validation.ts` runs it once, debounced, and nodes, minimap and the JSON view all read that. Do not recompute problems in components.
- **Tests that touch IndexedDB** use `fake-indexeddb`. In a real-browser script never `deleteDatabase` while the page has the DB open: the request stays pending and wipes the data when the page closes. Delete records instead.
- **Locale codes are not ISO.** They are the first two letters of `sLanguage` (`EN FR GE IT SP PO RU JA CH`, see `src/io/languages.ts`). Never offer `DE`, `ES`, `PL` or `ZH`: such files never load.
- **The editor is local-only except the Ask panel**, which sends the typed question (never group data) to DeepWiki (`io/deepwiki.ts`). Do not add other network calls without saying so in the UI.
- Editor UI is English only. Targets the latest DLL version; show it in the footer/menu bar.
