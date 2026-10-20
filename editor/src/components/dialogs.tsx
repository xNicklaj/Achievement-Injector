import { useState } from "react";
import type { Draft } from "../io/draftStore";
import { groupNameError } from "../io/workspace";
import { openDialog, Button, Frame } from "./Dialog";

export const message = (title: string, text: string) =>
  openDialog<void>(
    (done) => (
      <Frame title={title} footer={<Button primary autoFocus onClick={() => done()}>OK</Button>}>
        <p className="whitespace-pre-wrap">{text}</p>
      </Frame>
    ),
    undefined,
  );

export const confirmDialog = (title: string, lines: string[], ok: string, intro?: string, cancel = "Cancel") =>
  openDialog<boolean>(
    (done) => (
      <Frame
        title={title}
        footer={
          <>
            <Button onClick={() => done(false)}>{cancel}</Button>
            <Button primary autoFocus onClick={() => done(true)}>{ok}</Button>
          </>
        }
      >
        {intro && <p className="mb-2">{intro}</p>}
        <ul className="space-y-1">
          {lines.map((l, i) => (
            <li key={i} className="text-[12px] text-[var(--text-dim)]">{l}</li>
          ))}
        </ul>
      </Frame>
    ),
    false,
  );

/** Asks for the file name (the group identifier) and the base plugin (HANDOVER 3.10). */
export const newGroupDialog = (existing: string[]) =>
  openDialog<{ name: string; plugin: string } | null>(
    (done) => <NewGroup existing={existing} done={done} />,
    null,
  );

function NewGroup({ existing, done }: { existing: string[]; done: (v: { name: string; plugin: string } | null) => void }) {
  const [name, setName] = useState("");
  const [plugin, setPlugin] = useState("");
  const nameError = name ? groupNameError(name, existing) : null;
  const pluginError = plugin && !/\.(esp|esm|esl)$/i.test(plugin) ? "Expected a .esp/.esm/.esl file name" : null;
  const ready = name && !groupNameError(name, existing) && plugin && !pluginError;
  const field = "w-full rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-1 outline-none focus:border-zinc-400";
  return (
    <form
      onSubmit={(e) => (e.preventDefault(), ready && done({ name, plugin }))}
    >
      <Frame
        title="New group"
        footer={
          <>
            <Button type="button" onClick={() => done(null)}>Cancel</Button>
            <Button primary type="submit" disabled={!ready}>Create</Button>
          </>
        }
      >
        <label className="mb-3 block">
          <span className="text-[var(--text-dim)]">Group name (the file name, used by the console command and the icon folder)</span>
          <input autoFocus className={field} value={name} onChange={(e) => setName(e.target.value)} />
          {nameError && <span className="text-[var(--status-error)]">{nameError}</span>}
        </label>
        <label className="block">
          <span className="text-[var(--text-dim)]">Base plugin</span>
          <input className={field} placeholder="MyMod.esp" value={plugin} onChange={(e) => setPlugin(e.target.value)} />
          {pluginError && <span className="text-[var(--status-error)]">{pluginError}</span>}
        </label>
        <p className="mt-3 text-[12px] text-[var(--text-dim)]">Renaming the file later breaks saved progress, icons and references to this group.</p>
      </Frame>
    </form>
  );
}

export type GroupChoice = { open: string } | { create: true } | null;

export const pickGroupDialog = (folder: string, names: string[]) =>
  openDialog<GroupChoice>(
    (done) => (
      <Frame title={`Open a group from ${folder}`} footer={<><Button onClick={() => done(null)}>Cancel</Button><Button primary onClick={() => done({ create: true })}>New group…</Button></>}>
        {names.length === 0 && <p className="text-[var(--text-dim)]">No group files (.json) in this folder.</p>}
        <ul>
          {names.map((n) => (
            <li key={n}>
              <button className="w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => done({ open: n })}>{n}</button>
            </li>
          ))}
        </ul>
      </Frame>
    ),
    null,
  );

export type RecoverChoice = { restore: Draft } | { discard: string } | null;

/** Unsaved edits found after a crash or an accidental close. Closing the dialog keeps them for next time. */
export const recoverDialog = (drafts: Draft[]) =>
  openDialog<RecoverChoice>(
    (done) => (
      <Frame title="Recover unsaved edits?" footer={<Button onClick={() => done(null)}>Not now</Button>}>
        <p className="mb-2 text-[var(--text-dim)]">The editor found edits that were never saved. Drafts live only in this browser.</p>
        <ul className="space-y-1">
          {drafts.map((d) => (
            <li key={d.name} className="flex items-center gap-2 rounded border border-[var(--border)] px-2 py-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.fileName ?? "Unsaved group"}</span>
                <span className="block text-[11px] text-[var(--text-dim)]">{new Date(d.savedAt).toLocaleString()} · {d.nodes.length} nodes</span>
              </span>
              <Button primary onClick={() => done({ restore: d })}>Restore</Button>
              <Button onClick={() => done({ discard: d.name })}>Discard</Button>
            </li>
          ))}
        </ul>
      </Frame>
    ),
    null,
  );
