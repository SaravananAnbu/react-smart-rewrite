import type { SmartRewriteComplete } from "react-smart-rewrite";

// A stand-in for a real model so the demo runs without an API key. It is plain find-and-replace
// on the selected text, nothing more. In an app, `complete` calls your backend, which calls
// the model (see the README).
const FIXES: Array<[RegExp, string]> = [
  [/\bi\b/g, "I"],
  [/\bim\b/gi, "I'm"],
  [/\bdont\b/gi, "don't"],
  [/\bcant\b/gi, "can't"],
  [/\bwe is\b/gi, "we are"],
  [/\bthier\b/gi, "their"],
  [/\brecieve(d?)\b/gi, "receive$1"],
  [/\bdefinately\b/gi, "definitely"],
  [/\bapologise for the inconvenince\b/gi, "apologise for the inconvenience"],
  [/\binconvenince\b/gi, "inconvenience"],
  [/\bteh\b/gi, "the"],
  [/\balot\b/gi, "a lot"],
  [/\s+([,.!?])/g, "$1"],
  [/ {2,}/g, " "],
];

const FILLER = /\b(really|very|just|actually|basically|kind of|sort of|in order|at this point in time|as soon as we possibly can)\b ?/gi;

const FORMAL: Array<[RegExp, string]> = [
  [/\bhey\b/gi, "Hello"],
  [/\bhi\b/gi, "Hello"],
  [/\bsorry\b/gi, "we apologise"],
  [/\bthanks\b/gi, "thank you"],
  [/\bgonna\b/gi, "going to"],
  [/\basap\b/gi, "as soon as possible"],
  [/\bguys\b/gi, "team"],
  [/!+/g, "."],
];

const FRIENDLY: Array<[RegExp, string]> = [
  [/\bHello\b/g, "Hi there"],
  [/\bwe apologise\b/gi, "we're so sorry"],
  [/\bthank you\b/gi, "thanks so much"],
  [/\bas soon as possible\b/gi, "as quickly as we can"],
];

function apply(text: string, rules: Array<[RegExp, string]>): string {
  return rules.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
}

function capitalise(text: string): string {
  return text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

function rewrite(text: string, action: string, instruction: string): string {
  const fixed = capitalise(apply(text, FIXES));
  switch (action) {
    case "grammar":
      return fixed;
    case "improve":
      return capitalise(fixed.replace(FILLER, ""));
    case "shorter": {
      const sentences = fixed.replace(FILLER, "").match(/[^.!?]+[.!?]*/g) ?? [fixed];
      return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join("").trim();
    }
    case "longer":
      return `${fixed.trimEnd()} Please let us know if there is anything else we can help with.`;
    case "professional":
      return capitalise(apply(fixed, FORMAL));
    case "friendly":
      return `${apply(apply(fixed, FORMAL), FRIENDLY).trimEnd()} 😊`;
    default:
      if (/upper/i.test(instruction)) return fixed.toUpperCase();
      if (/lower/i.test(instruction)) return fixed.toLowerCase();
      if (/bullet|list/i.test(instruction)) {
        return (fixed.match(/[^.!?]+[.!?]*/g) ?? [fixed]).map((sentence) => `- ${sentence.trim()}`).join("\n");
      }
      return fixed;
  }
}

/** Answers in small pieces, the way a streamed model response arrives. */
export const mockModel: SmartRewriteComplete = ({ text, action, instruction, signal }) => {
  const answer = rewrite(text, action, instruction);
  const pieces = answer.match(/\S+\s*/g) ?? [answer];
  const encoder = new TextEncoder();
  let timer = 0;

  const body = new ReadableStream<Uint8Array>({
    start(stream) {
      let index = 0;
      const next = () => {
        if (signal.aborted) return stream.close();
        if (index >= pieces.length) return stream.close();
        stream.enqueue(encoder.encode(pieces[index++]));
        timer = window.setTimeout(next, 35);
      };
      timer = window.setTimeout(next, 400);
    },
    cancel() {
      window.clearTimeout(timer);
    },
  });
  return new Response(body);
};
