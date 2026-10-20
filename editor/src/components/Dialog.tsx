import { useEffect, type ReactNode } from "react";
import { create } from "zustand";

type Open = { render: (done: (v: never) => void) => ReactNode; cancel: unknown; resolve: (v: unknown) => void };
const useDialog = create<{ cur: Open | null }>(() => ({ cur: null }));

/** Show a modal and resolve with whatever it passes to `done`; Esc or a click outside resolves `cancel`. */
export function openDialog<T>(render: (done: (v: T) => void) => ReactNode, cancel: T): Promise<T> {
  return new Promise((resolve) => {
    useDialog.getState().cur?.resolve(useDialog.getState().cur!.cancel);
    useDialog.setState({ cur: { render: render as Open["render"], cancel, resolve: resolve as Open["resolve"] } });
  });
}

export function DialogHost() {
  const cur = useDialog((s) => s.cur);
  const done = (v: unknown) => {
    useDialog.setState({ cur: null });
    cur?.resolve(v);
  };
  useEffect(() => {
    if (!cur) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && done(cur.cancel);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (!cur) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60" onPointerDown={(e) => e.target === e.currentTarget && done(cur.cancel)}>
      {cur.render(done as (v: never) => void)}
    </div>
  );
}

export function Frame({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div role="dialog" aria-label={title} className="flex max-h-[80vh] w-[28rem] max-w-[92vw] flex-col rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
      <h2 className="border-b border-[var(--border)] px-4 py-2 text-[14px] font-semibold">{title}</h2>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
      <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-2">{footer}</div>
    </div>
  );
}

export const Button = ({ primary, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) => (
  <button
    {...p}
    className={`rounded px-4 py-1.5 text-[13px] disabled:opacity-40 ${primary ? "bg-blue-600 text-white hover:bg-blue-500" : "border border-[var(--border)] hover:bg-white/10"}`}
  />
);
