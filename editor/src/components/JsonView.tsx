import { Check, Copy } from "lucide-react";
import { tokenizeJson, type JsonTokenKind } from "./jsonTokens";
import { useEffect, useMemo, useState } from "react";
import { exportGroup, withoutEditor, type ExportState, type Issue } from "../io/exportGroup";
import { useApp } from "../store";
import { Button } from "./Dialog";

/** The group file as it would be saved, rebuilt as the document changes (debounced, so dragging stays smooth). */
function useBuilt() {
  const [built, setBuilt] = useState(() => exportGroup(useApp.getState() as ExportState));
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = useApp.subscribe(() => (clearTimeout(t), (t = setTimeout(() => setBuilt(exportGroup(useApp.getState() as ExportState)), 200))));
    return () => (off(), clearTimeout(t));
  }, []);
  return built;
}

const COLOR: Record<JsonTokenKind, string | undefined> = {
  key: "var(--syn-key)",
  string: "var(--syn-string)",
  localized: "var(--pin-localized)",
  number: "var(--syn-number)",
  literal: "var(--syn-literal)",
  punct: "var(--syn-punct)",
  plain: undefined,
};

const levelClass = (i: Issue) => (i.level === "error" ? "text-[var(--status-error)]" : "text-[var(--status-warning)]");

export function JsonView() {
  const { json, issues } = useBuilt();
  const fileName = useApp((s) => s.fileName);
  const [copied, setCopied] = useState(false);

  // Same formatting as Save, so what you read is what is written.
  const text = useMemo(() => JSON.stringify(withoutEditor(json), null, 4) + "\n", [json]);
  const lines = text.split("\n").length - 1;
  const tokens = useMemo(() => tokenizeJson(text), [text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-panel)]">
      <div className="flex shrink-0 items-center gap-4 border-b border-[var(--border)] px-4 py-2">
        <h1 className="text-[14px] font-semibold">JSON</h1>
        <span className="text-[var(--text-dim)]">{fileName ?? "unsaved group"} · {lines} lines · {(text.length / 1024).toFixed(1)} KB</span>
        <span className="ml-auto" />
        <Button onClick={copy}>
          {copied ? <Check size={12} className="mr-1 inline" /> : <Copy size={12} className="mr-1 inline" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {issues.length > 0 && (
        <ul className="max-h-32 shrink-0 overflow-auto border-b border-[var(--border)] px-4 py-2 text-[12px]">
          {issues.map((i, n) => (
            <li key={n} className={levelClass(i)}>{i.level === "error" ? "Error" : "Warning"}: {i.message}</li>
          ))}
        </ul>
      )}
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-[1.5] text-[var(--text)]" tabIndex={0}>
        {tokens.map((t, i) => (t.kind === "plain" ? t.text : <span key={i} style={{ color: COLOR[t.kind] }}>{t.text}</span>))}
      </pre>
    </div>
  );
}
