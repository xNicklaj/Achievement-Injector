/** The repository the questions are about; DeepWiki indexes it from the code and the wiki. */
export const REPO = "xNicklaj/Achievement-Injector";
const ENDPOINT = "https://mcp.deepwiki.com/mcp";

/**
 * DeepWiki's citation markers come through as stray spaces and dots ("class . These"). Fix that outside code blocks,
 * where spacing may matter.
 */
export const tidyAnswer = (text: string) =>
  text
    .split("```")
    .map((part, i) => (i % 2 ? part : part.replace(/ +\./g, ".").replace(/(\S) {2,}/g, "$1 ")))
    .join("```");

/** The MCP server answers with a server-sent event: `event: message` then `data: {json-rpc}`. */
export function parseAnswer(body: string): string {
  const data = body.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
  let msg: { result?: { isError?: boolean; content?: { text?: string }[] }; error?: { message?: string } };
  try {
    msg = JSON.parse(data || body);
  } catch {
    throw new Error("DeepWiki sent a reply this editor could not read.");
  }
  if (msg.error) throw new Error(msg.error.message ?? "DeepWiki returned an error.");
  const text = msg.result?.content?.map((c) => c.text ?? "").join("\n").trim();
  if (!text) throw new Error("DeepWiki returned no answer.");
  if (msg.result?.isError) throw new Error(text);
  return tidyAnswer(text);
}

/** Ask one question. Each call stands alone: the tool has no conversation memory. */
export async function askDeepWiki(question: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ask_question", arguments: { repoName: REPO, question } } }),
  });
  if (!res.ok) throw new Error(`DeepWiki answered ${res.status}.`);
  return parseAnswer(await res.text());
}
