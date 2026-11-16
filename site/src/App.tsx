import { useEffect, useRef, useState, type ReactNode } from "react";
import { SmartRewrite, type SmartRewriteDetail } from "react-smart-rewrite";
import { mockModel } from "./mockModel";

const NPM_URL = "https://www.npmjs.com/package/react-smart-rewrite";
const GITHUB_URL = "https://github.com/SaravananAnbu/react-smart-rewrite";

const SUBJECT = "re: you're order is delayed";
const MESSAGE = [
  "hey Ada,",
  "",
  "im really sorry but we is not able to ship you're order this week. thier was a problem at teh warehouse and alot of parcels are just stuck at this point in time. we definately dont want to keep you waiting!!",
  "",
  "you will recieve a new tracking link asap. we apologise for the inconvenince.",
  "",
  "thanks,",
  "Grace",
].join("\n");

// The paragraph the "Select a paragraph for me" button picks.
const PICK_FROM = "im really";
const PICK_TO = "waiting!!";

const STEPS = [
  {
    title: "Select some text",
    body: "In any textarea or text input inside the wrapper. A small Rewrite button appears under the selection, or press ⌘J / Ctrl+J.",
  },
  {
    title: "Pick what to do",
    body: "Improve, fix grammar, shorten, lengthen, change the tone, or type an instruction such as “translate to Spanish”.",
  },
  {
    title: "Check, then replace",
    body: "The change is shown word by word. Nothing in the field moves until the user presses Replace, and Ctrl/Cmd+Z undoes it.",
  },
];

const FEATURES = [
  {
    title: "Your fields, unchanged",
    body: "It works on the plain textarea and input you already have. Wrap the form; there is no editor to adopt and no value to hand over.",
  },
  {
    title: "A preview before every change",
    body: "Removed words are struck through and new ones highlighted, so the user sees exactly what the model did before accepting it.",
  },
  {
    title: "Any model, your backend",
    body: "You pass one function that calls your own route. Use Claude, OpenAI, Gemini or a local model, with the key kept on your server.",
  },
  {
    title: "Streams as it writes",
    body: "When your route streams the answer, the text appears in the menu as it arrives. A plain response works too.",
  },
  {
    title: "Your own actions",
    body: "Replace or extend the menu: “Use our brand voice”, “Translate to German”, “Turn into bullet points”.",
  },
  {
    title: "No dependencies",
    body: "Positioning, the diff and the menu are all in the package. React is the only thing it needs.",
  },
];

const SNIPPETS = {
  Component: `import { SmartRewrite, type SmartRewriteComplete } from "react-smart-rewrite";
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
}`,
  "Own actions": `import { DEFAULT_ACTIONS, SmartRewrite } from "react-smart-rewrite";

const actions = [
  ...DEFAULT_ACTIONS,
  { id: "spanish", label: "Translate to Spanish", instruction: "Translate it to Spanish." },
  {
    id: "brand",
    label: "Use our brand voice",
    instruction: "Rewrite it in a calm, direct voice. No exclamation marks.",
  },
];

<SmartRewrite complete={complete} actions={actions} allowCustom={false}>
  <textarea name="message" />
</SmartRewrite>`,
  Hook: `import { useSmartRewrite } from "react-smart-rewrite";

function Bio({ value, onChange }) {
  const rewriter = useSmartRewrite({ complete });

  return (
    <>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      <button
        disabled={rewriter.status === "working"}
        onClick={async () => {
          const next = await rewriter.rewrite({
            text: value,
            action: "Make it sound confident",
          });
          if (next) onChange(next);
        }}
      >
        Polish
      </button>
    </>
  );
}`,
  "Server route": `// app/api/smart-rewrite/route.ts (Next.js)
// Set ANTHROPIC_API_KEY in .env.local
import Anthropic from "@anthropic-ai/sdk";
import { buildSmartRewritePrompt } from "react-smart-rewrite/server";

const client = new Anthropic();

export async function POST(req: Request) {
  const { text, action, instruction, before, after } = await req.json();
  if (typeof text !== "string" || text.length > 5000) {
    return new Response("Bad request", { status: 400 });
  }
  const { system, user } = buildSmartRewritePrompt({ text, action, instruction, before, after });

  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  const reply = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return new Response(reply);
}`,
} as const;

const PROPS: [string, string, string][] = [
  ["complete", "(request) => Response | string | { text }", "Sends the selection, the action and a little surrounding text to your model. Required."],
  ["actions", "RewriteAction[]", "Menu entries: id, label and instruction. Six are built in."],
  ["allowCustom", "boolean", "Show the box where the user types an instruction. On by default."],
  ["shortcut", "string | false", 'Opens the menu for the selection. "mod+j" by default: Cmd on macOS, Ctrl elsewhere.'],
  ["contextSize", "number", "Characters before and after the selection sent as context. 500 by default; 0 sends none."],
  ["maxLength", "number", "Longest selection accepted. 5,000 characters by default."],
  ["onRewrite", "(detail) => void", "Called after a replacement with the original text, the new text, the action and the field."],
  ["onError", "(error) => void", "Called when a request fails."],
  ["labels", "Partial<SmartRewriteLabels>", "Replace any built-in text, for example to translate the menu."],
  ["theme", '"light" | "dark" | "auto"', "Colours. Follows the OS setting by default."],
];

const ACTIONS: [string, string][] = [
  ["improve", "Clearer and easier to read, same meaning and length"],
  ["grammar", "Spelling, grammar and punctuation only"],
  ["shorter", "Shorter, keeping every important point"],
  ["longer", "Somewhat longer, without inventing facts"],
  ["professional", "A professional, polite tone"],
  ["friendly", "A warm, friendly tone"],
  ["custom", "Whatever the user types, up to 300 characters"],
];

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Section(props: { id: string; eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={props.id} className="section">
      <div className="wrap">
        <p className="eyebrow">{props.eyebrow}</p>
        <h2>{props.title}</h2>
        {props.lead && <p className="lead">{props.lead}</p>}
        {props.children}
      </div>
    </section>
  );
}

export function App() {
  const [dark, setDark] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [subject, setSubject] = useState(SUBJECT);
  const [message, setMessage] = useState(MESSAGE);
  const [tab, setTab] = useState<keyof typeof SNIPPETS>("Component");
  const [log, setLog] = useState<SmartRewriteDetail[]>([]);
  const messageField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const pick = () => {
    const field = messageField.current;
    if (!field) return;
    const start = field.value.indexOf(PICK_FROM);
    const end = field.value.indexOf(PICK_TO);
    field.focus();
    // Falls back to the whole message once the sample paragraph has been rewritten.
    if (start >= 0 && end > start) field.setSelectionRange(start, end + PICK_TO.length);
    else field.select();
    field.dispatchEvent(new Event("select", { bubbles: true }));
  };

  return (
    <div className="page">
      <header className="nav">
        <div className="wrap nav-inner">
          <a href="#top" className="brand">
            <span className="brand-mark" aria-hidden="true">
              Aa
            </span>
            react-smart-rewrite
          </a>
          <nav aria-label="Sections">
            <a href="#demo">Demo</a>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#usage">Usage</a>
            <a href="#safety">Privacy</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </nav>
          <button type="button" className="ghost" aria-pressed={dark} onClick={() => setDark(!dark)}>
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow">Free · MIT licensed · React 18+</p>
            <h1>
              Select text. <em>Rewrite it with AI.</em>
            </h1>
            <p className="lead">
              An AI rewrite menu for the textareas and inputs you already have. Users select text, pick “Improve” or
              “Make shorter”, check the change and replace it. No editor to adopt, no key in the browser.
            </p>
            <div className="hero-actions">
              <div className="install">
                <code>npm install react-smart-rewrite</code>
                <CopyButton text="npm install react-smart-rewrite" />
              </div>
              <a className="cta" href="#demo">
                Try the demo
              </a>
              <a className="text-link" href={NPM_URL} target="_blank" rel="noreferrer">
                View on npm ↗
              </a>
            </div>
          </div>
        </section>

        <section id="demo" className="demo">
          <div className="wrap">
            <p className="eyebrow">Live demo</p>
            <div className="demo-stack demo-rewrite">
              <div className="card">
                <div className="card-head">
                  <h3>Reply to a customer</h3>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setSubject(SUBJECT);
                      setMessage(MESSAGE);
                      setLog([]);
                    }}
                  >
                    Reset text
                  </button>
                </div>
                <SmartRewrite
                  complete={mockModel}
                  theme={dark ? "dark" : "light"}
                  className="site-rsr"
                  onRewrite={(detail) => setLog((entries) => [detail, ...entries].slice(0, 3))}
                >
                  <label>
                    Subject
                    <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} />
                  </label>
                  <label>
                    Message
                    <textarea
                      ref={messageField}
                      rows={12}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </label>
                </SmartRewrite>
                <div className="form-foot">
                  <button type="button" className="cta" onClick={pick}>
                    Select a paragraph for me
                  </button>
                </div>
              </div>

              <div className="demo-main">
                <div className="received">
                  <h3>Try it</h3>
                  <ol className="try">
                    <li>
                      Select any text in the form with your mouse or keyboard, or use <strong>Select a paragraph for me</strong>.
                    </li>
                    <li>
                      Press <strong>Rewrite</strong> under the selection, then pick <strong>Fix spelling and grammar</strong>.
                    </li>
                    <li>
                      Look at the change, press <strong>Replace</strong>, then undo it with Ctrl/Cmd+Z.
                    </li>
                    <li>Select again and type “make it a bullet list” in the box.</li>
                  </ol>
                  <p className="fine">
                    This demo uses a mock model: simple find-and-replace that only knows this sample's mistakes, so
                    nothing leaves this page. In your app, a real AI model does the rewriting.
                  </p>
                </div>
                {log.length > 0 && (
                  <div className="received">
                    <h3>What your app receives</h3>
                    <p className="fine">The detail passed to onRewrite, newest first.</p>
                    <pre tabIndex={0}>
                      {JSON.stringify(
                        log.map(({ field, ...rest }) => ({ ...rest, field: field.tagName.toLowerCase() })),
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <Section
          id="how"
          eyebrow="How it works"
          title="Three steps, and the user stays in charge."
          lead="The AI proposes new wording; the person writing reads it and decides. Nothing is replaced on its own."
        >
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="step-num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="features" eyebrow="What's inside" title="Writing help for every form, without a rich text editor.">
          <ul className="features">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="usage"
          eyebrow="Usage"
          title="One wrapper on your page, one route on your server."
          lead="Use the ready-made menu, or the hook when you want your own button and layout."
        >
          <div className="code">
            <div className="code-head">
              <div className="tabs" role="tablist" aria-label="Code example">
                {(Object.keys(SNIPPETS) as (keyof typeof SNIPPETS)[]).map((name) => (
                  <button key={name} type="button" role="tab" aria-selected={name === tab} onClick={() => setTab(name)}>
                    {name}
                  </button>
                ))}
              </div>
              <CopyButton text={SNIPPETS[tab]} />
            </div>
            <pre>{SNIPPETS[tab]}</pre>
          </div>
        </Section>

        <Section
          id="safety"
          eyebrow="Privacy and limits"
          title="Clear about what leaves the page."
          lead="The selected text is your users' data, so tell them AI is used. Everything else is designed to send as little as possible."
        >
          <div className="safety">
            <div>
              <h3>What goes to your model</h3>
              <ul>
                <li>The text the user selected</li>
                <li>Up to 500 characters before and after it, for context</li>
                <li>The action's instruction, or what the user typed</li>
                <li>Nothing else: other fields stay in the browser</li>
                <li>Password fields are never read</li>
              </ul>
            </div>
            <div>
              <h3>In this version</h3>
              <ul>
                <li>Plain textareas and text inputs; rich text editors are not supported</li>
                <li>One rewrite at a time</li>
                <li>Not yet tested on phones</li>
                <li>The answer is shown as text and never replaces anything without the user</li>
                <li>Instructions hidden in the text are not followed</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="props" eyebrow="Reference" title="Props and built-in actions.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prop</th>
                  <th>Type</th>
                  <th>What it does</th>
                </tr>
              </thead>
              <tbody>
                {PROPS.map(([name, type, text]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>
                      <code>{type}</code>
                    </td>
                    <td>{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap" style={{ marginTop: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Action id</th>
                  <th>What the model is asked for</th>
                </tr>
              </thead>
              <tbody>
                {ACTIONS.map(([name, text]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <section className="closing">
          <div className="wrap">
            <h2>Give every text box a rewrite button.</h2>
            <div className="install">
              <code>npm install react-smart-rewrite</code>
              <CopyButton text="npm install react-smart-rewrite" />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span>react-smart-rewrite · MIT licensed · free to use in any project</span>
          <span>
            <a href={NPM_URL} target="_blank" rel="noreferrer">
              npm
            </a>{" "}
            ·{" "}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
