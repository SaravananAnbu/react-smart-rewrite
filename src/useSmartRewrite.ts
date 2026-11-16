import { useCallback, useEffect, useRef, useState } from "react";
import { cleanRewriteResponse, readRewriteResult } from "./core/response";
import {
  CUSTOM_ACTION,
  MAX_INSTRUCTION_LENGTH,
  SmartRewriteError,
  type RewriteAction,
  type SmartRewriteComplete,
} from "./core/types";

export type SmartRewriteStatus = "idle" | "working" | "ready" | "error";

export interface RewriteInput {
  /** The text to rewrite. */
  text: string;
  /** An action, or an instruction typed by the user. */
  action: RewriteAction | string;
  /** Text before and after, for context. Trimmed to `contextSize`. */
  before?: string;
  after?: string;
}

export interface UseSmartRewriteOptions {
  /** Sends the request to your model. */
  complete: SmartRewriteComplete;
  /** Characters of surrounding text sent as context on each side. Default 500. */
  contextSize?: number;
  /** Longest selection accepted, in characters. Default 5000. */
  maxLength?: number;
  onError?: (error: SmartRewriteError) => void;
}

export interface UseSmartRewriteResult {
  status: SmartRewriteStatus;
  /** The text being rewritten. */
  original: string;
  /** The rewrite. While `working` with a streamed response, the text received so far. */
  result: string;
  error: SmartRewriteError | null;
  /** Starts a rewrite. Resolves with the new text, or `null` when it failed or was cancelled. */
  rewrite: (input: RewriteInput) => Promise<string | null>;
  /** Runs the last request again. */
  retry: () => Promise<string | null>;
  /** Stops a request in progress and clears the result. */
  reset: () => void;
}

const DEFAULT_CONTEXT = 500;
const DEFAULT_MAX_LENGTH = 5000;

function toError(cause: unknown): SmartRewriteError {
  if (cause instanceof SmartRewriteError) return cause;
  return new SmartRewriteError("request", "The rewrite request failed.", { cause });
}

export function useSmartRewrite(options: UseSmartRewriteOptions): UseSmartRewriteResult {
  const [status, setStatus] = useState<SmartRewriteStatus>("idle");
  const [original, setOriginal] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<SmartRewriteError | null>(null);

  // Always call the latest callbacks without restarting anything.
  const latest = useRef(options);
  latest.current = options;

  const controller = useRef<AbortController | null>(null);
  const lastInput = useRef<RewriteInput | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const rewrite = useCallback(async (input: RewriteInput): Promise<string | null> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    lastInput.current = input;
    const { complete, contextSize = DEFAULT_CONTEXT, maxLength = DEFAULT_MAX_LENGTH, onError } = latest.current;

    const fail = (failure: SmartRewriteError) => {
      setError(failure);
      setStatus("error");
      onError?.(failure);
      return null;
    };

    setOriginal(input.text);
    setResult("");
    setError(null);

    if (input.text.length > maxLength) {
      return fail(new SmartRewriteError("too-long", `Select less text: the limit is ${maxLength.toLocaleString("en-US")} characters.`));
    }

    const typed = typeof input.action === "string";
    const instruction = (typed ? (input.action as string) : (input.action as RewriteAction).instruction).trim().slice(0, MAX_INSTRUCTION_LENGTH);
    setStatus("working");

    try {
      const answer = await complete({
        text: input.text,
        action: typed ? CUSTOM_ACTION : (input.action as RewriteAction).id,
        instruction,
        before: contextSize > 0 ? (input.before ?? "").slice(-contextSize) : "",
        after: contextSize > 0 ? (input.after ?? "").slice(0, contextSize) : "",
        signal: current.signal,
      });
      const raw = await readRewriteResult(answer, (soFar) => {
        if (!current.signal.aborted) setResult(soFar);
      });
      if (current.signal.aborted) return null;

      const text = cleanRewriteResponse(raw, input.text);
      if (!text.trim()) return fail(new SmartRewriteError("response", "The model returned no text."));
      setResult(text);
      setStatus("ready");
      return text;
    } catch (cause) {
      if (current.signal.aborted) return null;
      return fail(toError(cause));
    }
  }, []);

  const retry = useCallback(async () => (lastInput.current ? rewrite(lastInput.current) : null), [rewrite]);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setStatus("idle");
    setOriginal("");
    setResult("");
    setError(null);
  }, []);

  return { status, original, result, error, rewrite, retry, reset };
}
