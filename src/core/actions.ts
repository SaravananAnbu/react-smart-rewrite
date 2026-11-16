import type { RewriteAction } from "./types";

/** The menu shown when no `actions` are passed. */
export const DEFAULT_ACTIONS: RewriteAction[] = [
  {
    id: "improve",
    label: "Improve writing",
    instruction: "Improve the writing: make it clearer and easier to read. Keep the meaning, the tone and roughly the same length.",
  },
  {
    id: "grammar",
    label: "Fix spelling and grammar",
    instruction: "Fix spelling, grammar and punctuation mistakes. Change nothing else: keep the wording, tone and length.",
  },
  {
    id: "shorter",
    label: "Make shorter",
    instruction: "Make it shorter. Keep every important point and the tone.",
  },
  {
    id: "longer",
    label: "Make longer",
    instruction: "Make it somewhat longer by adding useful detail. Do not invent facts, names or numbers.",
  },
  {
    id: "professional",
    label: "More professional",
    instruction: "Rewrite it in a professional, polite tone. Keep the meaning.",
  },
  {
    id: "friendly",
    label: "More friendly",
    instruction: "Rewrite it in a warm, friendly tone. Keep the meaning.",
  },
];
