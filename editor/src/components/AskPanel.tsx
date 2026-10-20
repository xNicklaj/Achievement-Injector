import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { askDeepWiki } from "../io/deepwiki";
import { registry } from "../registry";
import { useApp } from "../store";
import { Markdown } from "./Markdown";

type Turn = { question: string; answer?: string; error?: string };

/** The panel's own state, kept while it is closed: whether it is open and what has been asked. Not part of the document. */
export const useAsk = create<{ open: boolean; turns: Turn[]; toggle: () => void; close: () => void }>((set, get) => ({
  open: false,
  turns: [],
  toggle: () => set({ open: !get().open }),
  close: () => set({ open: false }),
}));

const STARTERS = ["How do I localize an achievement name?", "What does joinType do?", "How do I run a command when an achievement unlocks?"];

/** A question about the selected node, when there is one worth asking about. */
function aboutSelection(): string | null {
  const n = useApp.getState().nodes.find((x) => x.selected);
  const def = n && registry[n.data.kind];
  if (!n || !def) return null;
  if (def.category === "condition") return def.hidden ? null : `What does the ${def.kind} condition do, and what fields does it take?`;
  if (def.kind === "CreateAchievement") return "What fields can an achievement have, and which are required?";
  if (def.kind === "RunCommand") return "How does the onUnlock command action work?";
  if (def.kind === "CallPapyrus") return "How does the onUnlock papyrus action work, and what must the function look like?";
  return null;
}

/** Ask the DeepWiki about the mod (HANDOVER 3.17). A side panel on the graph, so the answer sits next to the node it is about. */
export function AskPanel() {
  const { turns, close } = useAsk();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  // A string keeps the selector stable: the panel re-renders when the selection changes, not on every node move.
  const selected = useApp((s) => {
    const n = s.nodes.find((x) => x.selected);
    return n ? `${n.id}:${n.data.kind}` : "";
  });
  const about = selected ? aboutSelection() : null;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);
  useEffect(() => () => {
    abort.current?.abort();
  }, []);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setText("");
    setBusy(true);
    const i = useAsk.getState().turns.length;
    const put = (t: Turn) => useAsk.setState({ turns: useAsk.getState().turns.map((x, j) => (j === i ? t : x)) });
    useAsk.setState({ turns: [...useAsk.getState().turns, { question: q }] });
    abort.current = new AbortController();
    try {
      put({ question: q, answer: await askDeepWiki(q, abort.current.signal) });
    } catch (e) {
      const name = (e as Error).name;
      put({ question: q, error: name === "AbortError" ? "Stopped." : e instanceof TypeError ? "Could not reach DeepWiki. Check your connection." : (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const chip = "rounded border border-[var(--border)] px-2.5 py-1.5 text-left text-[12px] hover:bg-white/10 disabled:opacity-40";
  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-panel)]" aria-label="Ask the DeepWiki">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3.5 py-2">
        <h2 className="flex-1 text-[14px] font-semibold">Ask the DeepWiki</h2>
        <button title="Close" onClick={close} className="rounded p-1 hover:bg-white/10"><X size={14} /></button>
      </div>
      <p className="border-b border-[var(--border)] px-3.5 py-2 text-[12px] text-[var(--text-dim)]">
        Your question is sent to deepwiki.com. Answers come from their index of the repository and can be out of date; the editor's own fields are the reference. Each question is answered on its own.
      </p>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3.5 py-3">
        {!turns.length && <p className="text-[var(--text-dim)]">Ask anything about Achievement Injector: conditions, fields, localization, Papyrus.</p>}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="rounded bg-white/5 px-2.5 py-1.5 font-medium">{t.question}</div>
            {t.answer !== undefined ? <Markdown text={t.answer} /> : t.error ? <p className="text-[var(--status-error)]">{t.error}</p> : <p className="text-[var(--text-dim)]">Thinking…</p>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="space-y-2 border-t border-[var(--border)] p-3">
        <div className="flex flex-col gap-1.5">
          {about && <button className={`${chip} border-sky-500/50`} disabled={busy} onClick={() => void ask(about)}>About the selected node: {about}</button>}
          {!turns.length && STARTERS.map((s) => <button key={s} className={chip} disabled={busy} onClick={() => void ask(s)}>{s}</button>)}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            rows={2}
            placeholder="Ask a question (Enter to send)"
            className="nodrag nowheel min-w-0 flex-1 resize-none rounded border border-[var(--border)] bg-[var(--bg-app)] px-2 py-1.5 text-[13px] outline-none focus:border-zinc-400"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), void ask(text));
            }}
          />
          {busy ? (
            <button className="rounded border border-[var(--border)] px-3 py-1.5 hover:bg-white/10" onClick={() => abort.current?.abort()}>Stop</button>
          ) : (
            <button className="rounded bg-blue-600 p-2 text-white hover:bg-blue-500 disabled:opacity-40" disabled={!text.trim()} onClick={() => void ask(text)} title="Send"><Send size={14} /></button>
          )}
        </div>
      </div>
    </aside>
  );
}
