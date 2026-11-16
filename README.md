# react-smart-rewrite

An AI rewrite menu for any textarea or input in React. Your user selects text, picks "Improve writing", "Make shorter" or "Fix spelling and grammar", checks the change, and replaces it. MIT licensed, no dependencies.

**[Live demo](https://saravanananbu.github.io/react-smart-rewrite/)** · [npm](https://www.npmjs.com/package/react-smart-rewrite)

- Works on the plain `<textarea>` and `<input>` you already have: wrap your form, change nothing else
- Six built-in actions, your own actions, and a box for the user to type an instruction
- The change is shown word by word before anything is replaced, and the replacement can be undone with Ctrl/Cmd+Z
- Any model: you pass one function that calls your backend, so no API key reaches the browser
- Streams: when your route streams the answer, the text appears as it arrives
- Only the selection and a little surrounding text go to the model, never the whole form
- Works with controlled and uncontrolled fields: the replacement arrives as a normal `input` event
- Ships with `"use client"`, ESM and CommonJS builds, and TypeScript types

## Install

```bash
npm install react-smart-rewrite
```

`react` and `react-dom` (18 or newer) are peer dependencies.

## Usage

Wrap the part of your page that holds the fields:

```tsx
import { SmartRewrite, type SmartRewriteComplete } from "react-smart-rewrite";
import "react-smart-rewrite/styles.css";

const complete: SmartRewriteComplete = ({ text, action, instruction, before, after, signal }) =>
  fetch("/api/smart-rewrite", {
    method: "POST",
    body: JSON.stringify({ text, action, instruction, before, after }),
    signal,
  });

export function ReplyForm() {
  return (
    <SmartRewrite complete={complete}>
      <input name="subject" />
      <textarea name="message" rows={8} />
    </SmartRewrite>
  );
}
```

When the user selects text in a field, a small **Rewrite** button appears under the selection. It opens the menu; `Cmd+J` (macOS) or `Ctrl+J` opens it from the keyboard. After the model answers, the user sees what changed and chooses **Replace**, **Try again** or **Cancel**.

`SmartRewrite` adds no element that affects your layout, and it does not touch your fields' values until the user presses Replace. The replacement fires a normal `input` event, so your `onChange` handlers and form libraries see it as typing.

It covers `<textarea>` and `<input>` of type `text`, `search`, `url` and `tel`. Password, read-only and disabled fields are ignored.

## The backend route

`react-smart-rewrite/server` exports the prompt builder with no React code, so it is safe to import on a server. Send its `system` and `user` messages to any model and return the model's text.

```ts
// app/api/smart-rewrite/route.ts (Next.js). Set ANTHROPIC_API_KEY in .env.local
import Anthropic from "@anthropic-ai/sdk";
import { buildSmartRewritePrompt } from "react-smart-rewrite/server";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY on the server

export async function POST(req: Request) {
  const { text, action, instruction, before, after } = await req.json();
  if (typeof text !== "string" || text.length > 5000) {
    return new Response("Bad request", { status: 400 });
  }

  let prompt;
  try {
    prompt = buildSmartRewritePrompt({ text, action, instruction, before, after });
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const stream = client.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });

  // Send the text on as it arrives.
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
```

The same shape works with OpenAI, Gemini or a local model: pass `system` and `user`, return the text. Streaming is optional; a route that returns the whole text at once works too.

- Keep the API key in a server-only env variable. Variables named `VITE_*` or `NEXT_PUBLIC_*` are copied into the browser bundle and are not secret.
- A route like this lets anyone who can reach it spend your AI budget. Put it behind your app's sign-in and add a rate limit.
- For a known action id, `buildSmartRewritePrompt` uses its own instruction and ignores the one in the request, so a caller cannot swap it. Pass `strict: true` to also refuse typed instructions, and set `allowCustom={false}` on the component to hide the box.

`complete` may return a `Response`, the model's text as a string, or `{ text }`.

## Your own actions

```tsx
import { DEFAULT_ACTIONS, SmartRewrite } from "react-smart-rewrite";

const actions = [
  ...DEFAULT_ACTIONS,
  { id: "spanish", label: "Translate to Spanish", instruction: "Translate it to Spanish." },
  { id: "brand", label: "Use our brand voice", instruction: "Rewrite it in a calm, direct voice. No exclamation marks." },
];

<SmartRewrite complete={complete} actions={actions}>…</SmartRewrite>;
```

Pass the same list to the server so it resolves the ids itself: `buildSmartRewritePrompt({ …, actions })`.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `complete` | `(request) => Response \| string \| { text }` | required | Sends `{ text, action, instruction, before, after, signal }` to your model. |
| `actions` | `RewriteAction[]` | six built-in | Menu entries: `{ id, label, instruction }`. |
| `allowCustom` | `boolean` | `true` | Show the box where the user types an instruction. Sent with `action: "custom"`. |
| `shortcut` | `string \| false` | `"mod+j"` | Opens the menu for the selection. `mod` is Cmd on macOS and Ctrl elsewhere. |
| `contextSize` | `number` | `500` | Characters of text before and after the selection sent as context. `0` sends none. |
| `maxLength` | `number` | `5000` | Longest selection accepted, in characters. |
| `onRewrite` | `(detail) => void` | – | Called after a replacement with `original`, `text`, `action` and `field`. |
| `onError` | `(error) => void` | – | Called when a request fails. |
| `disabled` | `boolean` | `false` | Turns the menu off. |
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` | `"auto"` follows the OS setting. |
| `labels` | `Partial<SmartRewriteLabels>` | English | Replace any built-in text, e.g. `{ trigger: "Umschreiben" }`. |
| `className` | `string` | – | Added to the floating menu. |

Errors are `SmartRewriteError` with a `code`: `too-long`, `request`, `response` or `changed` (the field was edited while the rewrite ran, so nothing was replaced).

## The hook

For your own UI, `useSmartRewrite` runs the request and holds the result. It works on plain strings, so it fits any editor.

```tsx
import { useSmartRewrite } from "react-smart-rewrite";

function Bio({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const rewriter = useSmartRewrite({ complete });

  return (
    <>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      <button
        disabled={rewriter.status === "working"}
        onClick={async () => {
          const next = await rewriter.rewrite({ text: value, action: "Make it sound confident" });
          if (next) onChange(next);
        }}
      >
        Polish
      </button>
      {rewriter.error && <p>{rewriter.error.message}</p>}
    </>
  );
}
```

`action` is a `RewriteAction` or an instruction typed as a string.

| Returned | Description |
| --- | --- |
| `status` | `"idle"`, `"working"`, `"ready"` or `"error"`. |
| `rewrite({ text, action, before?, after? })` | Starts a request. Resolves with the new text, or `null` when it failed or was cancelled. |
| `result` | The rewrite. While `working` with a streamed answer, the text so far. |
| `original` | The text being rewritten. |
| `error` | A `SmartRewriteError`, or `null`. |
| `retry()` | Runs the last request again. |
| `reset()` | Stops a request in progress and clears the result. |

## Safety and privacy

- **What goes to your model:** the selected text, up to `contextSize` characters on each side of it, and the instruction. The rest of the form stays in the browser. The selection is user data, so tell your users, as you would for any AI feature.
- **Nothing is replaced without the user.** The rewrite is shown first, and it only replaces the text that was selected. If that text changed in the meantime, the replacement is refused.
- **Field contents are treated as data.** The prompt tells the model not to follow instructions found in the text, and the most a manipulated answer can do is suggest different words, which the user reads before accepting.
- **The answer is rendered as text**, never as HTML.
- **Password fields are never read.**

## Limits in this version

- Plain `<textarea>` and `<input>` only. `contenteditable` and rich text editors (Tiptap, Lexical, Slate) are not supported; use the hook with your editor's own selection API.
- One rewrite at a time.
- On touch devices the button appears next to the system's own selection menu. This has not been tested on phones.
- Undo relies on the browser's `insertText` editing command. Where it is unavailable the text is still replaced, but that step cannot be undone with Ctrl/Cmd+Z.

## Theming

The menu is rendered at the end of `<body>`. Override any `--rsr-*` variable on `.rsr`:

```css
.rsr {
  --rsr-accent: #0f766e;
  --rsr-radius: 10px;
  --rsr-z: 2000; /* above your dialogs */
}
```

Available variables: `bg`, `fg`, `muted`, `border`, `hover`, `accent`, `on-accent`, `danger`, `danger-bg`, `added`, `added-bg`, `radius`, `shadow`, `font`, `z`.

## Lower-level helpers

`buildSmartRewritePrompt(input)`, `cleanRewriteResponse(reply, original)`, `readRewriteResult(result, onProgress)`, `diffWords(before, after)`, `getFieldSelection(field)`, `replaceFieldRange(field, start, end, text)` and `getCaretRect(field, position)` are exported for building your own flow.

## Contributing

Setup, build and test instructions are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
