// Server-safe entry: no React and no "use client" marker, so it can be imported from
// a Next.js route handler, a server action or any Node backend.
export { SMART_REWRITE_SYSTEM_PROMPT, buildSmartRewritePrompt, type SmartRewritePromptInput } from "./core/prompt";
export { cleanRewriteResponse } from "./core/response";
export { DEFAULT_ACTIONS } from "./core/actions";
export { CUSTOM_ACTION, MAX_INSTRUCTION_LENGTH } from "./core/types";
export type { RewriteAction } from "./core/types";
