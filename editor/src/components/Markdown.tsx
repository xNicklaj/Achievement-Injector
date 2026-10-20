import { Fragment, type ReactNode } from "react";

const DEEPWIKI = "https://deepwiki.com";

/** Inline: `code`, **bold**, [text](url) and bare links. Anything else is text. Never injects HTML. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const link = (href: string, label: string, k: string) => (
    <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">
      {label}
    </a>
  );
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${m.index}`;
    if (m[1] !== undefined) out.push(<code key={k} className="rounded bg-white/10 px-1 font-mono text-[12px]">{m[1]}</code>);
    else if (m[2] !== undefined) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3] !== undefined) {
      // Wiki links are relative to deepwiki.com; only web links are followed.
      const href = m[4].startsWith("/") ? DEEPWIKI + m[4] : m[4];
      out.push(/^https?:\/\//.test(href) ? link(href, m[3], k) : m[3]);
    } else out.push(link(m[5], m[5], k));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The small subset of markdown DeepWiki answers use: headings, bullets, code blocks, paragraphs. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      blocks.push(<pre key={i} className="overflow-auto rounded bg-black/30 p-2 font-mono text-[12px]">{code.join("\n")}</pre>);
    } else if (/^#{1,6} /.test(line)) {
      blocks.push(<h4 key={i} className="mt-2 font-semibold">{inline(line.replace(/^#+ /, ""), `h${i}`)}</h4>);
    } else if (/^\s*[*-] /.test(line)) {
      const items: string[] = [];
      for (; i < lines.length && /^\s*[*-] /.test(lines[i]); i++) items.push(lines[i].replace(/^\s*[*-] /, ""));
      i--;
      blocks.push(
        <ul key={i} className="list-disc space-y-0.5 pl-5">
          {items.map((it, j) => <li key={j}>{inline(it, `li${i}-${j}`)}</li>)}
        </ul>,
      );
    } else if (line.trim()) {
      blocks.push(<p key={i}>{inline(line, `p${i}`)}</p>);
    }
  }
  return <div className="space-y-2 leading-relaxed">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
