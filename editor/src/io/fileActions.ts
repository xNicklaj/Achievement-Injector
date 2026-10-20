import { confirmDialog, message, newGroupDialog, pickGroupDialog } from "../components/dialogs";
import { isDirty, useApp } from "../store";
import { exportGroup } from "./exportGroup";
import { groupId } from "./workspace";
import { ImportError, importGroup } from "./importGroup";
import { changedLocFiles } from "./localization";
import { downloadWorkspace, filesWorkspace, folderWorkspace, pickedFolderWorkspace, type DirH, type OutFile, type Workspace } from "./workspace";

const reason = (e: unknown) =>
  e instanceof SyntaxError ? `Not valid JSON (${e.message})` : e instanceof ImportError ? e.message : e instanceof Error ? e.message : String(e);

/** True when it is fine to replace the document: nothing edited since it was opened, or the user agrees. */
async function canDiscard() {
  if (!isDirty()) return true;
  return confirmDialog("Discard changes?", [], "Discard", "The open group has edits that were not saved.");
}

async function openGroup(ws: Workspace, fileName: string) {
  try {
    const b = await ws.load(fileName);
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
  out.push(...changedLocFiles(s.loc, s.locOriginal));
  try {
    await (s.workspace ?? downloadWorkspace).write(out);
    s.markSaved(s.fileName);
  } catch (e) {
    await message("Could not save", reason(e));
  }
}
