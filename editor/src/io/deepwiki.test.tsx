import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "../components/Markdown";
import { askDeepWiki, parseAnswer, REPO, tidyAnswer } from "./deepwiki";

const sse = (result: object) => `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result })}\n\n`;

afterEach(() => vi.unstubAllGlobals());

describe("parseAnswer", () => {
  it("reads the text of a server-sent event and cleans citation leftovers", () => {
    expect(parseAnswer(sse({ content: [{ type: "text", text: "A base class . These  types ." }] }))).toBe("A base class. These types.");
  });
  it("leaves code blocks alone", () => {
    expect(tidyAnswer("a .\n```\nx  =  1 .\n```\nb .")).toBe("a.\n```\nx  =  1 .\n```\nb.");
  });
  it("turns an error result, an error message and junk into errors", () => {
    expect(() => parseAnswer(sse({ isError: true, content: [{ text: "Repository not found" }] }))).toThrow(/Repository not found/);
    expect(() => parseAnswer(`data: ${JSON.stringify({ error: { message: "bad" } })}`)).toThrow(/bad/);
    expect(() => parseAnswer(sse({ content: [] }))).toThrow(/no answer/);
    expect(() => parseAnswer("<html>")).toThrow(/could not read/);
  });
});

describe("askDeepWiki", () => {
  it("posts one ask_question call for this repository", async () => {
    const fetchMock = vi.fn(async () => new Response(sse({ content: [{ text: "ok" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await askDeepWiki("What is joinType?")).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://mcp.deepwiki.com/mcp");
    expect(JSON.parse(init.body as string).params).toEqual({ name: "ask_question", arguments: { repoName: REPO, question: "What is joinType?" } });
  });
  it("reports an HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(askDeepWiki("x")).rejects.toThrow(/503/);
  });
});

describe("Markdown", () => {
  const html = (t: string) => renderToStaticMarkup(<Markdown text={t} />);
  it("renders headings, bullets, code and links, with wiki links pointing at deepwiki.com", () => {
    const out = html("## Title\n* one `code`\n* **two**\n\nSee [the wiki](/wiki/x/y#3) and https://example.com/a.");
    expect(out).toContain("<h4");
    expect(out).toContain("<li>one <code");
    expect(out).toContain("<strong>two</strong>");
    expect(out).toContain('href="https://deepwiki.com/wiki/x/y#3"');
    expect(out).toContain('href="https://example.com/a."');
  });
  it("never produces HTML from the text, and drops links that are not web links", () => {
    const out = html('<img src=x onerror=alert(1)> [bad](javascript:alert(1))');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("javascript:");
  });
});
