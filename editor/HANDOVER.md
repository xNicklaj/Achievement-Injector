# Handover — Achievement Injector Config Editor

_Last updated: 2026-10-20_

## 0. Status (2026-10-20)

Built in `editor/` (Vite 8, React 19, `@xyflow/react`, Tailwind 4, Zustand + zundo, Lucide); run with `npm run dev`, `npm test`, `npm run build`:
- **Schema** (`src/schema/`): done, see 3.12.
- **Node registry** (`src/registry.ts`): derived from the schema, 38 node types (32 conditions + `CreateAchievement`, `AddConditions`, `JoinType`, `RunCommand`, `CallPapyrus`, `LocalizedText`).
- **Graph rules** (`src/graph.ts`, tested): pin-type matching, one flow in/out per node, no loops, one `AddConditions`/`JoinType` per chain (generic helper), a condition node feeds one `AddConditions`, live `AddConditions` summary.
- **App shell** (3.15): menu bar, foldable menu, canvas, resizable node panel with category tabs, search and drag-to-canvas, Group Properties pane. Undo/redo works (one entry per drag).
- **Import/export** (`src/io/`): JSON <-> graph, in both browsers via file pick and download (see File menu below). `src/io/io.test.ts` checks that all 8 shipped configs survive JSON -> graph -> JSON unchanged (ignoring `_editor` and key order) and that graph -> JSON -> graph is stable. Behaviour:
  - Nodes exist only for what the file has: `conditions` key -> `AddConditions`, `joinType` -> `JoinType`, `onUnlock` entries -> action nodes. `$key` values become one shared `LocalizedText` node per key (key only; translations arrive with file access).
  - Unknown keys, condition-level `onUnlock` and an empty `onUnlock: []` are kept in `node.data.extra`. Explicit defaults are kept.
  - `_editor` carries positions: `{id,x,y}` on achievements and conditions, `chain: [{x,y}]` on an achievement for its chain nodes, `keys` at the root for `LocalizedText` nodes. Files without it get a row auto-layout.
  - Import **refuses** (with a message) files with an unknown condition type or `onUnlock` type, a non-array `conditions`/`onUnlock`, or no `achievements`, rather than dropping data. The DLL would skip those entries.
  - Export never throws. It returns issues (schema errors, duplicate or empty localized keys, unconnected nodes that would not be saved), and Save shows them in a confirm dialog (3.8) that lets you save anyway.
  - Condition order in the JSON follows the order of wires into `AddConditions`.
- **File access and localization** (`src/io/workspace.ts`, `localization.ts`, `fileActions.ts`):
  - **File menu:** New group, Open folder, Open files, Save (Ctrl+S). **Open folder is the way to load a group with its localization files**, in every browser: Chromium uses the File System Access API (edit in place); Firefox uses a directory `<input>` (read-only, saves by download). Either accepts the AchievementsData folder or a parent that contains it. Open files (any browser) loads a picked JSON plus any `<Group>_<LANG>.txt` picked with it; a browser cannot look beside a single picked file. When a group uses `$keys` but no language files were found, a dialog says so and points to Open folder.
  - **Folder mode (Chromium)** reads and writes `AchievementsData/` in place, including `Localizations/`. Files mode saves by download (JSON plus each changed locale file). Folder logic is tested against an in-memory folder only; the real File System Access picker has not been exercised.
  - **New group** asks for a name (validated as a Windows file name, the group identifier) and the base plugin; the canvas starts empty.
  - **Locale files** follow `LocalizationManager.cpp`: group and locale come from the last underscore, `$key<TAB>value` lines, other lines ignored. They are kept as lines, so untouched entries and unknown lines are written back byte for byte (all shipped files round-trip exactly). Never written with a BOM (it would hide the first key), always UTF-8 (ANSI is read). Only changed files are written; a new language with no translations is not created.
  - **Languages** are two letters, added on Group Properties. Every `LocalizedText` node shows one row per language, amber when empty. Editing a node's key moves its translations (one undo step). Unused keys are listed on Group Properties and never deleted.
  - **Export warns** when a used key lacks a translation for a language, or when no language exists.
  - **Unsaved changes:** a `●` next to the file name (debounced compare with the last open/save), a `beforeunload` warning, and a discard confirmation before New/Open. All dialogs are real modals (`components/Dialog.tsx`), not `confirm`/`alert`.
- **Canvas navigation** for mouse and touchpad: see 3.16.
- **Localization and JSON views:** see 3.15. Leaving the Graph view unmounts the canvas, so its viewport resets to fit-all on return.
- **Data safety and validation** (done):
  - **Deleting a Localized Text node (or only its wire)** turns the fields it fed back into plain text: English if present, else the next language with text, else empty (3.13). Translations stay as unused keys. Node, wires and fields change in one update, so one undo restores everything (`restoreInline` in `graph.ts`).
  - **One Delete = one undo step.** React Flow reports a deletion as several store updates; history updates within 30ms of the last recorded one are merged (`handleSet` in `store.ts`, reset on `load`).
  - **Crash-recovery draft** (`io/draftStore.ts`, `autosave.ts`): while the document has unsaved changes, it is autosaved to IndexedDB 1s after the last edit, one draft per group file (`(unsaved)` for an unnamed one), never in the mod folder. A clean document (saved, or undone back) removes its draft; Save and an explicit Discard also delete it. At start a dialog offers each draft (Restore / Discard / Not now). Opening a group that has a draft newer than the file asks whether to restore; an older draft is dropped. A restore keeps the document unsaved, with the original language-file text for "changed" detection. Chromium keeps the folder handle in the draft and re-asks permission so Save writes in place again. IndexedDB failures degrade to "no draft".
  - **Unsaved changes:** a blank editor is clean (it has no tab-close warning).
  - **Validation on the canvas** (`validation.ts`): one debounced pass (150ms) builds the file and every problem, each pinned to a node and field (`Issue.nodeId/field/detail`). Nodes get a red (error) or amber (warning) border, a badge whose tooltip lists the problems, and red borders on invalid fields; the minimap uses the same colours; the JSON view reads the same result. A missing required value is an amber "incomplete" warning, anything else wrong (bad form ID, wrong type, duplicate name, one-of rules, two `AddConditions`) is an error. Nodes not connected to an achievement and Localized Text problems are pinned too. The `AddConditions` summary stays live and local.
- **Spawn menu** (`spawn.ts`, `components/SpawnMenu.tsx`, 3.5): dropping a wire on empty canvas lists only the node types that can take it, each tried against the same connection rules as a hand-drawn wire (so a second `AddConditions` in a chain, or a used pin, is not offered); right-click lists every type. A text output offers one choice per localizable field. Arrow keys, Enter and Escape work; the node and its wire are created in one undo step, placed so the pin meets the cursor. Own small menu instead of cmdk (no new dependency).
- **Icons** (`io/dds.ts`, `components/icons.tsx`, `IconField.tsx`, `io/iconActions.ts`, 3.1/3.4): a `.dds` reader (BC1 to BC3 and 32-bit decode; BC4/BC5/BC6H/BC7 are flagged as unsupported, "BC3 max"; size must be 512×512). Folder and picked-folder workspaces list and read `Icons/<Group>/` and `Icons/<Group>.dds`, case-insensitively; a few picked files cannot see icons. The `icon` field is a thumbnail, a free-text name and a picker with previews; the Group Properties page shows the group icon with its format check. Add icon / Choose icon check the file (refuse unsupported, confirm a wrong size or an overwrite) and queue it; queued icons count as unsaved changes, survive a draft restore, and Save writes them (`Icons/<group>/<file>` or `Icons/<group>.dds`) in place or as downloads. Export warns when `icon` names a file that is not in the group's folder (only when the folder can be listed).
- **Renaming an achievement** (3.1): the name field commits on blur or Enter (Escape reverts). `AchievementUnlocked` references to the old name in this group (none or this group's file name) follow it, references into other groups are left alone, all in one undo step. Renaming a name that is already on disk (opened or last saved) asks to keep it or undo, noting that progress, the Papyrus API and the console command use the name and other groups are not updated. `AchievementUnlocked.achievement` suggests this group's achievement names; with another group in `group` it is free text tagged "external", and a name that does not exist in this group is a warning. A localized name counts as its fallback text, because the DLL compares plain text.
- **Conditions Met** (1.4.2, `ConditionsMet.cpp`): a condition node that is also a collector. It has its own Condition input pin (like Add Conditions) and its output feeds Add Conditions or another Conditions Met, so nesting is wires, to any depth. `quantity` is a field; the nested `conditions` array is never a field, it is the wires into the node (import splits it out, export rebuilds it in wire order). The mod rejects, and so skips the whole achievement for, a `quantity` outside 1..N, an invalid or unknown sub-condition, and a live or negated one: the editor refuses wiring Live / Negate into it (`refuseReason`), refuses a loop, and export reports all of them pinned on the node (errors pinned by `pinCondition` through the nested path). It has no `pluginOverride` field because the mod passes sub-conditions the achievement's plugin, not the override of the node that holds them. Layout (import and Tidy up): what it holds sits to its left, stacked, and it sits past those columns. Progress is saved by position in the mod, so reordering or inserting sub-conditions on a live achievement shifts it onto the wrong ones. The node carries `since: "1.4.2"`, so a file using it is stamped 1.4.2.
- **Condition `onUnlock`** (3.2): every condition node has an "On Unlock" row with a flow pin. A chain of Run Command / Call Papyrus nodes hanging off it exports as that condition's `onUnlock`; a chain that starts at a condition can hold actions only (`refuseReason`). Positions of those nodes are saved in the condition's `_editor.chain`, like an achievement's.
- **Unknown condition types:** a file with a condition type this editor does not know opens, with that condition as a generic "Unknown: <type>" node that keeps every key and writes back unchanged, flagged as an error. A file that needs a newer mod is refused instead: export stamps `_editor.modVersion` (the largest `since` of any field in use, at least the baseline) and `_editor.schemaVersion`; import refuses a file whose stamp is newer than `TARGET_VERSION` / `SCHEMA_VERSION`. Unknown `onUnlock` action types are still refused. A future condition type must tag its fields with `since`, or the stamp cannot tell it is new. Right-clicking any condition (not only an unknown one) opens the node menu with the condition types; picking one replaces the node in place (`replaceConditions`: same id and position, one undo step), and right-clicking one of several selected conditions, or the selection rectangle React Flow puts over them (`onSelectionContextMenu`), replaces all the conditions among them together. For an unknown condition every key is kept: the ones that are fields of the new type become values, the rest stay as unknown keys, and a `live` / `negate` key stays a plain key (it is not turned into Live / Negate nodes). For a known condition the values that are fields of the new type carry over and the others go (a stray key on the wrong type would only bloat the file); its own unknown keys stay. Wires the new type cannot hold are removed: what a Conditions Met collects, and links to fields the new type lacks. A condition that feeds Live or Negate is only offered types that support them. A right-click inside a text field keeps the browser's menu (copy and paste), and so does any node that is not a condition.
- **Version badges:** a field newer than the baseline shows its `since` ("1.4.1") beside its name on the node.
- **Tidy up** (`layout.ts`, menu bar): rearranges every node in the importer's layout (one band per achievement in their current order; text nodes left, then achievement, conditions, chain, condition actions); unreached nodes go in a grid below. Uses measured node heights; one undo step; fits the view afterwards.
- **Copy / paste / duplicate** (`clipboard.ts`, Ctrl+C / V / D on the graph): copies the selected nodes and the wires between them, with new ids, offset, selected. Localized Text nodes are not copied (a key belongs to one node); text they fed is pasted as plain text. A copied achievement name becomes "Name (copy)". One undo step. The clipboard is in memory only.
- **Find and quick-add keys** (`components/FindBar.tsx`, `Canvas.tsx`): Ctrl+F on the graph opens a find box (replaces the browser's) that searches the nodes' titles and field values (not nodes hidden inside a collapsed achievement); Enter or a click selects the node and zooms to it. Space (not Ctrl+Space) opens the add-node menu at the pointer; it fires on key release and only if the canvas was not panned meanwhile, because Space + drag pans. Ignored in text fields and buttons. H folds or unfolds the selected Create Achievement nodes (same as the eye: all fold unless all are folded already).
- **Key hints** (`components/KeyHints.tsx`): a faint, click-through overlay at the right of the canvas above the minimap listing the keys that apply to the selection (nothing: add, find, paste; nodes: copy, duplicate, delete, plus H for achievements and right-click replace for conditions; a wire: delete). Its selector returns one string, so it re-renders only when the answer changes.
- **Canvas position** is kept while another view is open and reset when a document opens (`viewport.ts`).
- **Typing undo**: edits to one text field within 1.5 s join one history entry per word (a space ends the word); any other change ends it.
- **Group name** accepts a `$key` (suggestions from the keys in use and in the language files), edits its translations on Group Properties, counts as using the key, and warns on missing translations.
- **Ask the DeepWiki** (3.17): a side panel on the graph for asking the DeepWiki chatbot about the mod; the only feature that talks to a server.
- **Link pins** (`registry.ts` `linkKind`, `graph.ts` `linkedText`): a field can be fed by a wire instead of typed. Three kinds, each `<kind>-out` to `<kind>:<field>`: `loc` (Localized Text to a localizable field), `ach` (a Create Achievement's "Unlock" pin to an `AchievementUnlocked.achievement` field) and `icon` (an Icon node to an achievement's `icon`). One wire per field; deleting the wire or the source keeps the value as typed text. Import wires `AchievementUnlocked` references that name one achievement of this group by plain name (not another group, not its own achievement, not ambiguous, not localized). Renaming an achievement needs no fix-up for wired references. Export reports achievements that wait for each other, through wires or typed names, as errors. Import turns every `icon` file name into one Icon node shared by the achievements that name it (its position is saved in the root `_editor.icons`, like `keys`). The Icon node (Assets tab) shows a large preview and can be shared; an Icon with no file or no use is a warning. Folded optional rows open when one of their fields is wired.
- **List fields** (FormID lists such as `PlayerCrime.factions`): one row per FormID with add/remove, a per-row plugin search and name hint, and a red border for a value that is not 1 to 8 hex digits.
- **Achievement list** (`achievements.ts`, `components/AchievementList.tsx`): a panel over the top-left of the canvas listing every achievement in file order. Those with any part of their box in view are tinted and the one nearest the centre is marked (and kept scrolled into view unless the pointer is over the list); a red or amber dot means a node of that achievement has an error or warning; a filter appears past six. Clicking one selects it and fits all of its nodes (`membersOf`: the chain, every condition at any depth with its Live / Negate nodes, each condition's actions; shared Localized Text / Icon / Plugin Override nodes belong to none). It can be folded (`remembered.listOpen`, so it survives a view change). A handle at the left of each row (shown on hover or focus, not while the list is filtered) reorders the achievements: dragged onto another row, above or below its middle (native drag and drop, a line marks the place), or with the up and down arrow keys while it has focus. `reorderAchievements(order)` is one update and one undo step: the order of the Create Achievement nodes in the node list is the order of the file, and `restack` moves each achievement (its members plus the Localized Text, Icon and Plugin Override nodes only it uses; shared ones stay) vertically into the slots, keeping the top, the gap between each pair of neighbours and every horizontal place, so an unchanged order moves nothing. Each row's eye collapses the achievement into its one Create Achievement node (closed eye) and back: `collapsed` in the store holds the Create ids, as a view setting that is never saved, not in the undo history and not unsaved changes, reset when a document opens. `Canvas` gives React Flow the achievement's other nodes with `hidden` set (`hiddenOf` / `hideNodes`: one cached copy per source node, worked out from the wires, not per drag frame) and sets `hidden` on every wire touching them, which React Flow does not do itself. Collapsing deselects what it hides, so Delete cannot reach it. Moving the one node moves what it hides by the same offset (`followMoves`, added to the batch in the store's `onNodesChange`), so expanding keeps the layout; the drag is still one undo step, since the drag snapshot holds every node's position. An expanded achievement still moves node by node. The Create node says how many nodes are hidden and carries the worst error or warning among them, with a button to expand. Shared Localized Text / Icon / Plugin Override nodes stay, and Tidy up still lays out the full band. Every selector returns a string, so it re-renders only when its answer changes; the members are cached per `edges`, and a drag frame costs about 2 ms at 8,000 nodes.
- **Not built yet:** error count next to Save (4.1), the round-trip CI test (4.3; the Pages deploy workflow exists), a README.
- **Deviations:** plain Tailwind instead of shadcn/ui and the React Flow UI kit so far. Checked in Edge with a scripted session: import rendering, translation rows, the Languages section, the File menu and dialogs.

## 1. Goal

A browser-based, **local-only** editor for Achievement Injector configuration files (the per-plugin JSON files in `Data/SKSE/Plugins/AchievementsData/`).

- Built with **React**, hosted as a static site (GitHub Pages).
- **Nothing leaves the user's browser**: no backend, no uploads.
- The core editing experience is a **node graph modelled on the UE5 Blueprint editor**, with separate **flow (exec) lines** and **data lines**.

## 2. Background: Achievement Injector

- SKSE plugin (CommonLibSSE-NG), Nexus mod [126220](https://www.nexusmods.com/skyrimspecialedition/mods/126220), current version **1.4.2**.
- One JSON file = one achievement **group** = one plugin. Root fields: `groupName`, `plugin`, `achievements[]` (plus group-level `showInMenu`).
- Achievement fields: `achievementName`, `description`, `conditions[]`, `joinType` (AND/OR), `hideDescription`, `showInMenu`, `icon`, `notificationSound`, `onUnlock[]`.
- 32 condition types (incl. the `PapyrusBinding` pseudo-condition and the nesting `ConditionsMet`). Each has its own required/optional fields. Common modifiers: `pluginOverride`, `quantity`, `operation`.
- `onUnlock` actions: `command`, `papyrus`. Can sit on an achievement or on a condition.
- Localization: `Localizations/<Group>_<LANG>.txt`, tab-separated `$key<TAB>value` lines.
- Icons: 512×512 `.dds`, **BC3 max** (BC5/BC7 unsupported). Group icon `Icons/<Group>.dds`, per-achievement icons `Icons/<Group>/<file>.dds`.
- The DLL **ignores unknown JSON keys**; default `joinType` is **OR**.
- Reference: [wiki](https://github.com/xNicklaj/Achievement-Injector/wiki).

## 3. Decisions made

### 3.1 Graph model

| Node | Lines | Role |
|---|---|---|
| `CreateAchievement` | flow out | Entry node for one achievement. Each one is its own root (like multiple events in a UE graph). Achievement fields are inline widgets on this node. |
| `AddConditions` | flow in, flow out, **multi data in** | Collects all condition nodes for the achievement. |
| `JoinType` | flow in / out | Sets AND or OR for the conditions collected by `AddConditions`. |
| `RunCommand`, `CallPapyrus` | flow in / out | Achievement-level `onUnlock` actions, chained after the conditions part. |
| Condition nodes (one per type) | data out (+ localized-string inputs, see 3.13) | Pure data nodes. Field values are **inline widgets on the node**. |
| `LocalizedText` | data out | Supplies a `$key` and its translations to a localizable field (see 3.13). |

Canonical chain: `CreateAchievement → AddConditions → JoinType → RunCommand/CallPapyrus…`, with condition nodes wired into `AddConditions` via data lines.

**Node details**
- **Inline widgets** are rendered generically from the registry's field schema; mark inputs with React Flow's `nodrag` / `nowheel` classes so typing and scrolling don't pan the canvas.
- **`CreateAchievement` fields:** `achievementName`, `description`, `hideDescription`, `showInMenu`, `icon`, `notificationSound` (optional ones in a collapsible section). `notificationSound` is played via `RE::PlaySound` and is ignored when the player enables the MCM sound override. `achievementName` must be unique in the group. Renaming updates `AchievementUnlocked` references in the file and warns that saved progress, the Papyrus API and the console command key off the name, and that other groups referencing it won't be updated. Icon picker previews from `Icons/<Group>/`.
- **`onUnlock`:** for achievement-level actions, flow order is meaningful: export writes `onUnlock[]` in chain order. Condition-level `onUnlock` is an inline list field on the condition node. `CallPapyrus` is safe to expose: the `papyrus` action works since 1.3.0, which switched it to `DispatchStaticCall`, so the target must be a `Global` function in the named script.
- **`AchievementUnlocked` across groups:** when `group` names another file, use free-text inputs and mark the reference "external, not validated".

### 3.2 Rules

- **Only one `AddConditions` per chain.** Enforced at two levels:
  - While editing: `isValidConnection` walks upstream along the flow chain and refuses a second one; the spawn menu hides it for that chain.
  - On export: validation catches bad chains created by paste, undo/redo or import, and flags the offending node.
  - Implement as a generic "chain already contains node type X" helper (reuse for `JoinType`).
- **`JoinType` is optional.** With no node, the DLL default applies (**OR**). Since users may assume AND, show a soft hint when 2+ conditions are wired with no `JoinType` node.
- **`AddConditions` shows a live summary** derived from edges (`useNodeConnections`), never stored state:
  - "3 conditions" — all complete
  - "3 conditions · 1 incomplete" — warning colour
  - "No conditions" — error state
  - Show the implied join when there's no `JoinType` node, e.g. "3 conditions · OR (default)".
- **A condition node feeds one `AddConditions` or `ConditionsMet` only** (v1). `isValidConnection` refuses a second outgoing wire, so condition nodes are never shared between achievements and import never has to merge copies. Reuse can return later (see 3.3).

### 3.3 Round-trip (JSON is the source of truth)

- **Export:** no `JoinType` node → no `joinType` key.
- **Import:** `joinType` present → create the node; absent → no node.
- **All optional fields:** unset means not serialized; the key doesn't appear in the JSON and the DLL applies its own default.
- **Explicit defaults are kept (decided).** If a file writes a default (e.g. `"operation": ">="`), export writes it back, so a no-op save produces no diff. The store tracks "has value" separately from the value, and the schema never applies defaults when parsing (they live in field metadata only). Unknown keys are preserved too (loose objects).
- **Layout (decided: `_editor` stays inline in the JSON):** node positions are stored per object as `_editor: {id, x, y}` on each achievement and condition. Files without `_editor` (hand-written) get auto-layout on load.
- **Schema version:** the root carries `_editor: {schemaVersion}`, so future editor versions can migrate files on import if property names change.
- **Reused condition nodes:** not supported in v1 (see 3.2), so every condition is one node and `_editor.id` is just that node's id. If reuse returns, the old design was: duplicate on export with the same id, merge on import only when id and content both match.
- Goal: lossless both ways, JSON → graph → JSON and graph → JSON → graph.

### 3.4 Mod Info page (not in the graph)

Group-level settings live on a separate form page:
- `groupName` (with `$key` picker), base `plugin`, group `showInMenu`
- Group icon (with BC3 check + preview)
- Languages (add a language here; it's file-level) and orphan localization keys

Condition nodes show the inherited base plugin as a greyed-out placeholder in `pluginOverride`.

### 3.5 Spawn menu (UE-style context-sensitive wiring)

- Dragging a wire into empty space opens a searchable menu at the cursor, filtered to node types with a compatible input pin.
- Implementation: `onConnectEnd` (connection not valid → dropped on pane), `screenToFlowPosition` for placement, add node + edge in one state update.
- Right-click on empty canvas opens the same menu unfiltered.
- Search UI: shadcn's Command component (cmdk).

### 3.6 Visual design

- **Styling stack: Tailwind CSS + shadcn/ui**, using the official React Flow UI kit (components copied into the project; restyle `<BaseNode />` first, everything else inherits it). Lucide icons.
- **Flow lines are white; data is coloured by type.** Only real pins are coloured (condition, localized text, flow). **Inline fields carry no icon or dot (decided):** the widget itself says the type (checkbox, number, select, text), and the tooltip on the name gives the key and hint. The type palette below still applies to pins, edges and the node list.
- **Field types** (one widget component each): bool, number (with an `integer` flag; float otherwise), string, localized string, EditorID, FormID split into **base** vs **reference**, enum, list of X (`perks`, `factions`), plugin filename, achievement reference, icon path. Pin types: **Condition**, **localized string**, **flow**.
- **Palette (UE conventions):** bool red · integer teal · float green · string magenta · localized string pink/salmon · EditorID violet · base FormID blue · reference FormID light blue · enum dark teal · Condition gold/orange · flow white.
- **Not colour alone:** pins differ by position and label as well as colour. Field names are shown in PascalCase; JSON keys stay camelCase.
- **Blueprint look:** dark canvas with React Flow's dot-grid `Background`; node headers coloured by category: entry (`CreateAchievement`), flow (`AddConditions`, `JoinType`, actions), condition, localization (`LocalizedText`). Header colours are CSS variables too, separate from the field-type palette.
- **Palette lives in one place:** CSS variables keyed by field type, referenced from the node registry. Pin dots, edges and spawn-menu icons read from it; a light theme is a variable swap.

### 3.7 Version targeting

- The editor **always targets the latest DLL version**; when the API changes significantly, the editor's validation is updated to match.
- The UI shows the targeted version (e.g. footer "Targets Achievement Injector 1.4.2"), so authors know what minimum version to list on their mod page.

### 3.8 Saving

- **Explicit save only** (Ctrl+S / Save button); the editor never writes to the mod folder on its own. Unsaved-changes indicator; warn on tab close (`beforeunload`).
- **Crash-recovery draft in IndexedDB**, never in the mod folder. On reopen, offer to restore it if it's newer than the file on disk.
- **Saving with validation errors is allowed**, behind a confirmation dialog that lists the problems.

### 3.9 Validation display

- **Node outline shows status** (red = error, amber = warning), visually distinct from React Flow's selection outline (e.g. selection as a soft glow, errors as a solid border).
- **Status badge** (icon) in the node header, so status doesn't rely on colour alone.
- **Invalid nodes are coloured on the `MiniMap`** (via `nodeColor`), same red/amber.
- No problems panel for now.

### 3.10 Scope and file access

- **One achievement group (one JSON file) at a time.** No multi-file workspace.
- The user **opens the `AchievementsData` folder** (File System Access API) and either **picks an existing group** or **creates a new one**. Folder access lets the editor read and write that group's `Localizations/` and `Icons/` files. **Chromium and Firefox are both supported:** Firefox has no folder access, so it uses upload of the JSON plus its localization/icon files and download on save.
- **Creating a new group** creates `<name>.json` (and asks for the base `plugin`). The file name is the group identifier used by `AchievementUnlocked`, the console command and the icon folder, so validate it and warn against renaming it later.
- **A new group starts with an empty canvas** (no starter chain).

### 3.11 State management and undo/redo

- **Zustand store with the zundo middleware.** Nodes and edges are controlled from the store (the pattern React Flow recommends).
- **zundo's `partialize`** excludes transient UI state (selection, viewport, hover) from history.
- **Drags:** history is paused during a node drag and one entry is recorded on drop.
- **Typing:** inline-widget edits are grouped by word, so undo removes a word rather than a character.
- **One store, several consumers:** the IndexedDB crash-recovery draft (debounced subscriber) and the unsaved-changes indicator ("current state differs from last save") both subscribe to the same store.
- **Copy/paste:** a pasted node always gets a **new `_editor` id**, so it can't merge with its original on re-import. Pasting between groups works through the system clipboard as JSON.

### 3.12 Schema

- **Single schema source in Zod 4: written** in `editor/src/schema/` (`fields.ts`, `conditions.ts`, `group.ts`), built from `Achievement.cpp`, `plugin.cpp`, `Runnable.cpp` and `src/Conditions/*`, not the wiki. It drives validation, the node registry (`conditionRegistry`, field rows via `describeFields`) and the published JSON Schema (`npm run schema` → `editor/schema/achievement-injector.schema.json`).
  - **Field metadata** (Zod `.meta()`): `widget`, `since`, `default`, `formKind` (base/reference), `options`, `requires`. Defaults are metadata only, never applied by parsing.
  - **Version tags:** `since` defaults to 1.4.0 (the oldest version the schema covers). Only the 1.4.1 additions are tagged: `quantity` on `PlayerActivation`/`ItemCrafted` and `operation` on `GlobalVariableState`/`QueryStatValue`. The editor should warn when a tagged field is used and the author lists an older minimum version (the DLL ignores unknown keys silently).
  - **Cross-field rules in the schema:** one-of requirements (`LocationDiscovery`: `formID`/`locationID`; `BookRead`: `formID`/`bookID`; `BaseActorDeath`: `formID`/`name`/`editorID`), unique `achievementName`, strict `operation` and skill values.
  - **Not in the schema (needs file context):** whether an `AchievementUnlocked.group` exists, `$key` resolution, icon checks.
  - **Found while reading the code:** `showPopup` (default true) is a real achievement field not listed in 3.1. `CreateAchievement` should expose it. `BaseActorDeath` with `editorID` needs PO3 Tweaks; the condition is skipped without it. Any `joinType` other than `"OR"` behaves as AND.
  - `schema.test.ts` parses every shipped config and requires `parse(x)` to equal `x`.

### 3.13 Localization

- Localizable string fields (`achievementName`, `description`, `locationID`, `bookID`, `BaseActorDeath.name`) are **inline text by default but also expose an input pin**. Connecting a **`LocalizedText`** node makes the field localized. Like a UE split pin, the inline widget hides while connected.
- **`LocalizedText` node:** a `key` field plus one row per language found in `Localizations/<Group>_*.txt`. Missing translation → amber outline. On save, writes `$key` into the JSON and the values into each language file.
- **The key is the identity:** one node per key, wired to every field that uses it. On import, each distinct `$key` becomes one node connected to all its uses. Two nodes with the same key is a validation error.
- **Orphan keys** (in the `.txt` files but unused): kept on save, never deleted silently; listed on the Mod Info page.
- **Adding a language** happens on the Mod Info page, as a **checklist of the nine languages Skyrim ships** (read from `Skyrim - Interface.bsa`): English, French, German, Italian, Spanish, Polish, Russian, Japanese, Chinese. Czech and others are not in the game. Checking one adds an empty row to every `LocalizedText` node; a language with translations cannot be unchecked (its file is not ours to delete).
  - **Codes are not ISO.** The DLL uses the first two letters of the ini's `sLanguage`, uppercased: `EN FR GE IT SP PO RU JA CH`. So German is `GE` (not `DE`), Spanish `SP`, Polish `PO`, Chinese `CH`. A file named `Group_DE.txt` is never loaded; the checklist flags such files and suggests the right name (`src/io/languages.ts`).
  - English is the fallback for every other language, so Save warns when languages exist but `EN` does not.
- **`groupName`** stays on the Mod Info page with a `$key` picker.
- **Deleting a `LocalizedText` node:** connected fields keep the **English** value as plain inline text. If there's no English, use the next available language; if there are no translations at all, the field is left empty.

### 3.14 Repo and UI language

- **Code lives on a dedicated branch of the main Achievement-Injector repo, in an `editor/` subfolder** (keeps merges from main conflict-free). When the mod is updated, merge main into the editor branch, update the schema/validation, and redeploy. A GitHub Actions workflow on pushes to the editor branch builds and deploys to GitHub Pages.
- **Editor UI is English only.**

### 3.15 App layout (from the user's mockup; layout only, styling per 3.6)

Four views share a **menu bar** (top) and a **foldable menu** (left sidebar):

| View | Main area |
|---|---|
| **Graph** | **Canvas** on top; below it a **node group tabs** strip and a **node list** panel. |
| **Group Properties** | A full-width **Group Properties pane**, which is the Mod Info page from 3.4. It replaces the canvas and node panel. |
| **Localization** | A searchable, editable **table of every localization entry**: one row per key (file order, English first, then keys only a node uses), one column per language, a **warning sign after a key name** that has a problem (hover it for the text: not used by any Localized Text node (kept on save), no translation for some languages, or defined more than once in a file where the last entry wins), search over keys and translation text, a "Missing translations only" filter, and a missing count. Cells edit the language files directly (`setTranslation`); keys are renamed on their Localized Text node. |
| **JSON** | A read-only **live view of the group file as Save would write it**, rebuilt (debounced 200ms) from the graph with the same formatting (4-space indent). Lists the export issues above the text, shows line count and size, and has Copy. `_editor` metadata is always hidden here (no toggle); it is still written to the file. Syntax-highlighted by a small tokenizer (`components/jsonTokens.ts`, which gives the text back exactly): keys, strings, numbers, `true`/`false`/`null`, punctuation, and `$key` values in the localized pin colour. Colours are `--syn-*` variables in `index.css`. |

Reading of the regions:
- **Menu bar:** file and app actions: open folder, new group, Save (Ctrl+S), undo/redo, the targeted-version label from 3.7, and the error count from 4.1.
- **Foldable menu (decided):** only switches between the four views, and collapses to an icon rail. Listing the group's achievements (click to focus one root) is a possible later addition, not v1.
- **Node group tabs (decided):** one tab per node category from 3.6 (entry, flow, conditions, localization). All 31 condition types sit under a single **Conditions** tab, with no sub-grouping. The node list's search box covers finding one.
- **Node list:** the node types in the selected tab, as a searchable list. **Drag** one onto the canvas (decided); it is placed at the drop point via `screenToFlowPosition`. It is a second route to the spawn menu in 3.5 and uses the same node registry (4.4), so the two cannot disagree.
- **Canvas:** unchanged from 3.1 to 3.11. The bottom panel should be resizable and collapsible so the canvas can take the full height.

### 3.16 Canvas navigation (one scheme for mouse and touchpad)

No mode switch. The scheme is Blueprint/Figma-like and works on any device:
- **Wheel, classified per event** (`src/wheel.ts`): a touchpad scroll (small, fractional or horizontal deltas) **pans**; a mouse notch (one jump of about 100px, or line units in Firefox) **zooms at the cursor**; Shift + mouse wheel pans sideways. A gesture that looks like a touchpad stays one for 300ms, so a large event in the middle of a flick or inertia does not zoom.
- **Pinch and Ctrl + wheel** always zoom (React Flow's own handling), which also overrides a misclassified wheel.
- **Left-drag on empty space** box-selects (partial overlap counts); **right-drag, middle-drag or Space + drag** pans.
- **Touchpad ergonomics:** pins have an 8px invisible hit ring and a 32px connect radius, node drags start only after 4px (taps jitter), double-click does not zoom, number fields blur on wheel so scrolling cannot edit them, and fields and the minimap keep their own wheel (`nowheel`).
- A **Controls** button in the menu bar lists these gestures.
- The wheel classifier is a heuristic. Known weak spot: a free-spinning mouse wheel (small deltas) reads as a touchpad and pans; Ctrl + wheel zooms instead. Verified with scripted wheel, pinch and drag events in Edge; not on a physical touchpad or mouse.

### 3.17 Ask the DeepWiki

A side panel on the graph view (menu bar "Ask", `components/AskPanel.tsx`) that sends one question to DeepWiki's public MCP server (`https://mcp.deepwiki.com/mcp`, tool `ask_question`, repo `xNicklaj/Achievement-Injector`; no key, CORS open, so no backend). Each question stands alone (the tool has no memory); answers are markdown, shown by a small renderer (`Markdown.tsx`: headings, bullets, code, links; never raw HTML; wiki links resolve to deepwiki.com). The panel says the question goes to a third party and that answers come from DeepWiki's index and can lag the code (they used the old wiki's condition names), so the schema stays the reference. A chip asks about the selected node. This is the only network call the editor makes, and it sends only what the user types, never group files.

## 4. Proposed, not yet confirmed

1. **Error count next to Save** ("2 errors · 1 warning"); clicking cycles the viewport through invalid nodes.
2. ~~Keep explicit defaults on import~~ — **decided, moved to 3.3.** (Number kept so references to 4.4 stay valid.)
3. **Round-trip CI test** using community configs (Sinister Seven, Vigilant, Legacy of the Dragonborn, etc.): import → export → diff, ignoring whitespace, key order and `_editor`. Run on pushes to the editor branch.
4. **Node registry** as the central abstraction: per node type, declare pins, category, keywords and field schema. Drives the spawn menu, connection validation, inline widgets and JSON export; generated from the Zod schema.
5. **"Tidy up" button:** re-run auto-layout on demand (undoable), in addition to auto-layout on files without `_editor` positions.
6. **Empty-state hint:** while the canvas is empty, a faint centred message such as "Right-click to add a node" that disappears once the first node exists.

## 5. Out of scope for v1

- `FormRef` reusable data nodes (could return later as an opt-in "promote field to pin").
- Problems panel.
- Multi-file workspace.

## 6. Tech stack

- React + **React Flow (xyflow)**: custom nodes, typed handles, `isValidConnection`, `useNodeConnections`, `MiniMap`
- **Tailwind CSS + shadcn/ui** + React Flow UI kit; Lucide icons
- **Zustand + zundo** for state and undo/redo
- **cmdk** (via shadcn Command) for the spawn menu
- **elkjs** or **dagre** for auto-layout
- **Zod 4** for schema, validation and JSON Schema generation
- **File System Access API** for the `AchievementsData` folder (Chromium); upload/download fallback for Firefox
- **IndexedDB** for crash-recovery drafts
- Small in-browser BC3 `.dds` decoder for icon previews

## 7. Roadmap

1. ~~Zod schema~~ — **done** (see 3.12). App scaffold, registry and layout shell done (see section 0). Import/export done (section 0). File access and localization done (section 0). Next: `onUnlock` lists, version badges, Tidy up and copy/paste, then CI and deploy.
2. **v1:** graph editor, Mod Info page, validation, localization, import/export, spawn menu.
3. **FormID search** for small, non-localized plugins: parse `.esp`/`.esm` locally in a Web Worker (fflate for compressed records).
4. **Vanilla masters:** Skyrim.esm (~250 MB, localized) needs a BSA reader for `.STRINGS` files.
5. **Nested condition groups** (`(A AND B) OR C`): a group node bundling an `AddConditions → JoinType` pair with a data output that feeds another `AddConditions`. Requires a format + DLL change; v1 design already accommodates it.
