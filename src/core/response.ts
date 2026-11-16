import { SmartRewriteError, type SmartRewriteResult } from "./types";

const QUOTE_PAIRS: Array<[string, string]> = [
  ['"', '"'],
  ["“", "”"],
  ["'", "'"],
  ["‘", "’"],
];

/**
 * Tidies a model's reply: removes a code fence or quotation marks the model wrapped
 * around the text, and gives the result the same leading and trailing whitespace as the original.
 */
export function cleanRewriteResponse(reply: string, original = ""): string {
  let text = reply.trim();

  const fence = /^```[\w-]*\n([\s\S]*?)\n?```$/.exec(text);
  if (fence && !original.trim().startsWith("```")) text = (fence[1] ?? "").trim();

  const source = original.trim();
  for (const [open, close] of QUOTE_PAIRS) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close) && !source.startsWith(open)) {
      const inner = text.slice(open.length, text.length - close.length);
      // Only when the marks wrap the whole reply, not when it merely starts and ends with a quote.
      if (!inner.includes(open) && !inner.includes(close)) text = inner.trim();
      break;
    }
  }

  if (!text) return "";
  const lead = /^\s*/.exec(original)?.[0] ?? "";
  const tail = /\s*$/.exec(original)?.[0] ?? "";
  return original.trim() ? lead + text + tail : text;
}

function fromJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const value: unknown = JSON.parse(trimmed);
    if (value && typeof value === "object" && typeof (value as { text?: unknown }).text === "string") {
      return (value as { text: string }).text;
    }
  } catch {
    // Not JSON: the reply is the text itself.
  }
  return null;
}

/**
 * Reads whatever `complete` returned into the model's raw text.
 * A streamed `Response` is reported piece by piece through `onProgress`.
 */
export async function readRewriteResult(result: SmartRewriteResult, onProgress?: (textSoFar: string) => void): Promise<string> {
  if (typeof result === "string") return result;

  if (typeof Response !== "undefined" && result instanceof Response) {
    if (!result.ok) {
      throw new SmartRewriteError("request", `The rewrite request failed (${result.status}).`);
    }
    const json = (result.headers.get("content-type") ?? "").includes("json");
    let raw = "";
    const reader = result.body?.getReader?.();
    if (reader) {
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        if (!json) onProgress?.(raw);
      }
      raw += decoder.decode();
    } else {
      raw = await result.text();
    }
    return json ? (fromJson(raw) ?? raw) : raw;
  }

  if (result && typeof result === "object" && typeof (result as { text?: unknown }).text === "string") {
    return (result as { text: string }).text;
  }
  throw new SmartRewriteError("response", "The rewrite could not be read.");
}
