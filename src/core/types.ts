/** One entry in the rewrite menu. */
export interface RewriteAction {
  /** Sent to your backend, e.g. `"shorter"`. */
  id: string;
  /** Shown in the menu. */
  label: string;
  /** What the model is asked to do with the text. */
  instruction: string;
}

/** What `complete` receives. */
export interface SmartRewriteRequest {
  /** The selected text. */
  text: string;
  /** Id of the chosen action, or `"custom"` when the user typed their own instruction. */
  action: string;
  /** The action's instruction, or what the user typed. */
  instruction: string;
  /** Text just before the selection, for context. */
  before: string;
  /** Text just after the selection, for context. */
  after: string;
  /** Aborts when the user cancels. Pass it to `fetch`. */
  signal: AbortSignal;
}

/** A `Response` (streamed or not), the model's text, or `{ text }`. */
export type SmartRewriteResult = Response | string | { text: string };

export type SmartRewriteComplete = (request: SmartRewriteRequest) => SmartRewriteResult | Promise<SmartRewriteResult>;

export type SmartRewriteErrorCode = "too-long" | "request" | "response" | "changed";

export class SmartRewriteError extends Error {
  readonly code: SmartRewriteErrorCode;

  constructor(code: SmartRewriteErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SmartRewriteError";
    this.code = code;
    if (options && "cause" in options) (this as { cause?: unknown }).cause = options.cause;
  }
}

/** Id used when the user types their own instruction. */
export const CUSTOM_ACTION = "custom";

/** Longest instruction accepted from the user, in characters. */
export const MAX_INSTRUCTION_LENGTH = 300;
