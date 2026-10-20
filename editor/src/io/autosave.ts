import { isDirty, useApp } from "../store";
import { deleteDraft, draftName, putDraft, type Draft } from "./draftStore";

export function snapshotDraft(): Draft {
  const s = useApp.getState();
  return {
    name: draftName(s.fileName),
    fileName: s.fileName,
    savedAt: Date.now(),
    nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: s.edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
    group: s.group,
    groupExtra: s.groupExtra,
    loc: s.loc,
    locOriginal: s.locOriginal,
    savedKey: s.savedKey,
    savedNames: s.savedNames,
    pendingIcons: s.pendingIcons,
    handle: s.workspace?.handle,
  };
}

/**
 * Keep a draft while the document has unsaved changes, a moment after they stop. When it is clean again
 * (saved, or undone back to the saved state) the draft goes away.
 */
export function startAutosave(wait = 1000) {
  let t: ReturnType<typeof setTimeout>;
  const run = async () => {
    if (isDirty()) await putDraft(snapshotDraft());
    else await deleteDraft(draftName(useApp.getState().fileName));
  };
  const off = useApp.subscribe(() => (clearTimeout(t), (t = setTimeout(run, wait))));
  return () => (off(), clearTimeout(t));
}
