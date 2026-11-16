export { SmartRewrite, type SmartRewriteDetail, type SmartRewriteLabels, type SmartRewriteProps } from "./SmartRewrite";
export {
  useSmartRewrite,
  type RewriteInput,
  type SmartRewriteStatus,
  type UseSmartRewriteOptions,
  type UseSmartRewriteResult,
} from "./useSmartRewrite";
export { DEFAULT_ACTIONS } from "./core/actions";
export { diffWords, type DiffPart } from "./core/diff";
export {
  getCaretRect,
  getFieldSelection,
  isRewriteField,
  replaceFieldRange,
  type CaretRect,
  type FieldSelection,
  type RewriteField,
} from "./core/field";
export { SMART_REWRITE_SYSTEM_PROMPT, buildSmartRewritePrompt, type SmartRewritePromptInput } from "./core/prompt";
export { cleanRewriteResponse, readRewriteResult } from "./core/response";
export { CUSTOM_ACTION, MAX_INSTRUCTION_LENGTH, SmartRewriteError } from "./core/types";
export type {
  RewriteAction,
  SmartRewriteComplete,
  SmartRewriteErrorCode,
  SmartRewriteRequest,
  SmartRewriteResult,
} from "./core/types";
