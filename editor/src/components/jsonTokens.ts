export type JsonTokenKind = "key" | "string" | "localized" | "number" | "literal" | "punct" | "plain";
export type JsonToken = { text: string; kind: JsonTokenKind };

// A string followed by a colon is a key; any other string is a value. Strings are matched first so
// words and digits inside them are never taken for literals or numbers.
const TOKEN = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;

/** Split JSON text into highlightable tokens. Joining every `text` gives the input back exactly. A `"$key"` value is marked `localized`. */
export function tokenizeJson(text: string): JsonToken[] {
  const out: JsonToken[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), kind: "plain" });
    const kind: JsonTokenKind = m[1] ? "key" : m[2] ? (m[2].startsWith('"$') ? "localized" : "string") : m[3] ? "literal" : m[4] ? "number" : "punct";
    out.push({ text: m[0], kind });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: "plain" });
  return out;
}
