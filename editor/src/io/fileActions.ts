import { confirmDialog, message, newGroupDialog, pickGroupDialog, recoverDialog } from "../components/dialogs";
import { isDirty, useApp } from "../store";
import { deleteDraft, draftName, getDraft, listDrafts, type Draft } from "./draftStore";
import { exportGroup } from "./exportGroup";
import { groupId } from "./workspace";
import { ImportError, importGroup } from "./importGroup";
import { changedLocFiles } from "./localization";
import { achievementIconPath, downloadWorkspace, groupIconPath, filesWorkspace, folderWorkspace, pickedFolderWorkspace, type DirH, type OutFile, type Workspace } from "./workspace";

const reason = (e: unknown) =>
  e instanceof SyntaxError ? `Not valid JSON (${e.message})` : e instanceof ImportError ? e.message : e instanceof Error ? e.message : String(e);

/** True when it is fine to replace the document: nothing edited since it was opened, or the user agrees. */
async function canDiscard() {
  if (!isDirty()) return true;
  const ok = await confirmDialog("Discard changes?", [], "Discard", "The open group has edits that were not saved.");
  // Discarding is explicit: do not offer the same edits back after the next start.
  if (ok) await deleteDraft(draftName(useApp.getState().fileName));
  return ok;
}

/** Put a recovered draft back. A folder draft asks permission again so Save can write in place; otherwise Save downloads. */
async function applyDraft(d: Draft, ws: Workspace | null) {
  let workspace = ws;
  if (!workspace && d.handle) {
    const granted = (await d.handle.requestPermission?.({ mode: "readwrite" }).catch(() => "denied")) === "granted";
    if (granted) workspace = folderWorkspace(d.handle);
  }
  useApp.getState().restore(d, workspace);
  if (!workspace && d.handle) await message("Restored without folder access", "Edits are back, but saving will download files. Use File > Open folder to save in place.");
}

let recoveryOffered = false;

/** At start: offer any unsaved drafts left behind. "Not now" keeps them. */
export async function offerRecovery() {
  if (recoveryOffered) return;
  recoveryOffered = true;
  let drafts = (await listDrafts()).sort((a, b) => b.savedAt - a.savedAt);
  while (drafts.length) {
    const choice = await recoverDialog(drafts);
    if (!choice) return;
    if ("restore" in choice) return void (await applyDraft(choice.restore, null));
    await deleteDraft(choice.discard);
    drafts = drafts.filter((d) => d.name !== choice.discard);
  }
}

async function openGroup(ws: Workspace, fileName: string) {
  try {
    const b = await ws.load(fileName);
    // Edits recovered from an earlier session win only if they are newer than the file; otherwise the file moved on.
    const draft = await getDraft(b.fileName);
    if (draft) {
      const newer = draft.savedAt > (b.modified ?? 0);
      const keep = newer && (await confirmDialog("Recovered edits", [], "Restore edits", `${b.fileName} has unsaved edits from ${new Date(draft.savedAt).toLocaleString()}, newer than the file. Using the file discards them.`, "Use the file"));
      if (keep) return void (await applyDraft(draft, ws));
      await deleteDraft(draft.name);
    }
    const snap = importGroup(b.json);
    useApp.getState().load(snap, b.fileName, b.loc, ws);
    // A group that uses $keys but found no language files would show raw keys in game; say so instead of failing quietly.
    if (!Object.keys(b.loc).length && snap.nodes.some((n) => n.data.kind === "LocalizedText"))
      await message(
        "No localization files found",
        `${fileName} uses localized text ($keys), but no ${groupId(fileName)}_<LANG>.txt files were found` +
          (ws.kind === "folder" ? " in the Localizations folder." : ". Pick them together with the JSON, or use File > Open folder to load a group with its localization files."),
      );
  } catch (e) {
    await message(`Could not open ${fileName}`, reason(e));
  }
}

async function createGroup(ws: Workspace | null, existing: string[]) {
  const d = await newGroupDialog(existing);
  if (!d) return;
  // A new group starts with an empty canvas (HANDOVER 3.10).
  useApp.getState().load({ nodes: [], edges: [], group: { groupName: d.name, plugin: d.plugin }, groupExtra: {} }, `${d.name}.json`, {}, ws);
}

/**
 * Open the AchievementsData folder, so a group loads together with its localization files.
 * Chromium edits the folder in place; with `picked` files (a directory `<input>`, e.g. Firefox) it is read-only and saves by download.
 */
export async function openFolder(picked?: File[]) {
  let ws: Workspace;
  if (picked) {
    ws = pickedFolderWorkspace(picked);
    if (!(await ws.list()).length) return void (await message("No group files found", "Choose the AchievementsData folder: it holds the group .json files and a Localizations folder."));
    if (!(await canDiscard())) return;
  } else {
    const pick = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<DirH> }).showDirectoryPicker;
    if (!pick) return void (await message("Folder access is not available", "This browser cannot edit folders in place."));
    if (!(await canDiscard())) return;
    try {
      ws = folderWorkspace(await pick.call(window, { id: "achievement-data", mode: "readwrite" }));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      return void (await message("Could not open the folder", reason(e)));
    }
  }
  const names = await ws.list();
  const choice = await pickGroupDialog(ws.label, names);
  if (!choice) return;
  if ("open" in choice) await openGroup(ws, choice.open);
  else await createGroup(ws, names);
}

/** Any browser: pick a group's JSON, plus its `<Group>_<LANG>.txt` files if it uses localization. */
export async function openFiles(files: File[]) {
  const ws = filesWorkspace(files);
  const names = await ws.list();
  if (!names.length) return void (await message("No group file selected", "Select the group's .json file, and its <Group>_<LANG>.txt files if it has any."));
  if (!(await canDiscard())) return;
  const choice = names.length === 1 ? { open: names[0] } : await pickGroupDialog(ws.label, names);
  if (choice && "open" in choice) await openGroup(ws, choice.open);
}

export async function newGroup() {
  if (!(await canDiscard())) return;
  const ws = useApp.getState().workspace;
  await createGroup(ws, ws ? await ws.list().catch(() => []) : []);
}

/** Explicit save only; problems are allowed through a confirmation that lists them (HANDOVER 3.8). */
export async function saveFile() {
  const s = useApp.getState();
  if (!s.fileName) return void (await message("Nothing to save", "Create or open a group first (File > New)."));
  const { json, issues } = exportGroup(s);
  if (issues.length) {
    const lines = issues.map((i) => `${i.level === "error" ? "Error" : "Warning"}: ${i.message}`);
    const shown = lines.slice(0, 15);
    if (lines.length > shown.length) shown.push(`…and ${lines.length - shown.length} more`);
    if (!(await confirmDialog("Save with problems?", shown, "Save anyway", `This group has ${issues.length} problem${issues.length > 1 ? "s" : ""}.`))) return;
  }
  const out: OutFile[] = [{ name: s.fileName, text: JSON.stringify(json, null, 4) + "\n" }];
  // A download has nowhere to merge into, so it is the complete package: every translation and icon, not only what changed.
  const download = !s.workspace || s.workspace.kind === "files";
  out.push(...changedLocFiles(s.loc, download ? {} : s.locOriginal));
  // Icons chosen in this session are written beside the JSON (Icons/<group>.dds, Icons/<group>/<file>.dds).
  const icons: Record<string, Uint8Array> = {};
  if (download && s.workspace?.icons) {
    const id = groupId(s.fileName);
    const paths = [groupIconPath(id), ...(s.iconFiles ?? []).map((n) => achievementIconPath(id, n))];
    for (const path of paths) {
      const data = await s.workspace.icons.read(path);
      if (data) icons[path] = data;
    }
  }
  for (const [path, data] of Object.entries({ ...icons, ...s.pendingIcons })) {
    const slash = path.lastIndexOf("/");
    out.push({ name: path.slice(slash + 1), dir: path.slice(0, slash), data });
  }
  try {
    await (s.workspace ?? downloadWorkspace).write(out);
    s.markSaved(s.fileName);
    await deleteDraft(draftName(s.fileName));
    await useApp.getState().refreshIcons();
  } catch (e) {
    await message("Could not save", reason(e));
  }
}
