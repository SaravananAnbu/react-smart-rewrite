import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_ACTIONS } from "./core/actions";
import { diffWords } from "./core/diff";
import { getCaretRect, getFieldSelection, isRewriteField, replaceFieldRange, type RewriteField } from "./core/field";
import { MAX_INSTRUCTION_LENGTH, SmartRewriteError, type RewriteAction } from "./core/types";
import { useSmartRewrite, type UseSmartRewriteOptions } from "./useSmartRewrite";

export interface SmartRewriteLabels {
  trigger: string;
  title: string;
  placeholder: string;
  send: string;
  working: string;
  stop: string;
  replace: string;
  retry: string;
  cancel: string;
  close: string;
  changed: string;
}

const LABELS: SmartRewriteLabels = {
  trigger: "Rewrite",
  title: "Rewrite text",
  placeholder: "Tell AI what to change…",
  send: "Rewrite",
  working: "Rewriting…",
  stop: "Stop",
  replace: "Replace",
  retry: "Try again",
  cancel: "Cancel",
  close: "Close",
  changed: "The text changed while the rewrite was running. Select it again.",
};

export interface SmartRewriteDetail {
  /** The text that was selected. */
  original: string;
  /** The text that replaced it. */
  text: string;
  /** Id of the action, or `"custom"`. */
  action: string;
  field: RewriteField;
}

export interface SmartRewriteProps extends UseSmartRewriteOptions {
  /** Your form. Every textarea and text input inside it gets the rewrite menu. */
  children: ReactNode;
  /** Menu entries. Defaults to improve, fix grammar, shorter, longer, professional and friendly. */
  actions?: RewriteAction[];
  /** Let the user type their own instruction. Default `true`. */
  allowCustom?: boolean;
  /** Opens the menu for the current selection. Default `"mod+j"` (Cmd on macOS, Ctrl elsewhere). `false` turns it off. */
  shortcut?: string | false;
  /** Turns the menu off without unmounting your fields. */
  disabled?: boolean;
  theme?: "light" | "dark" | "auto";
  /** Added to the floating menu. */
  className?: string;
  /** Replace any of the built-in texts. */
  labels?: Partial<SmartRewriteLabels>;
  /** Called after the user replaces the text. */
  onRewrite?: (detail: SmartRewriteDetail) => void;
}

interface Target {
  field: RewriteField;
  start: number;
  end: number;
  text: string;
}

interface Anchor {
  left: number;
  top: number;
  bottom: number;
}

type View = "closed" | "trigger" | "menu" | "run";

const GAP = 6;
const EDGE = 8;

function anchorFor(target: Target): Anchor {
  const start = getCaretRect(target.field, target.start);
  const end = getCaretRect(target.field, target.end);
  return { left: end.left, top: start.top, bottom: end.bottom };
}

function isMac(): boolean {
  return typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

function matchesShortcut(event: globalThis.KeyboardEvent, shortcut: string): boolean {
  const keys = shortcut.toLowerCase().split("+").map((key) => key.trim());
  const key = keys.pop();
  const mod = keys.includes("mod");
  const ctrl = keys.includes("ctrl") || (mod && !isMac());
  const meta = keys.includes("meta") || keys.includes("cmd") || (mod && isMac());
  return (
    event.key.toLowerCase() === key &&
    event.ctrlKey === ctrl &&
    event.metaKey === meta &&
    event.altKey === keys.includes("alt") &&
    event.shiftKey === keys.includes("shift")
  );
}

function shortcutText(shortcut: string): string {
  return shortcut
    .split("+")
    .map((key) => {
      const name = key.trim().toLowerCase();
      if (name === "mod") return isMac() ? "⌘" : "Ctrl";
      return name.length === 1 ? name.toUpperCase() : name.charAt(0).toUpperCase() + name.slice(1);
    })
    .join(isMac() ? "" : "+");
}

function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.6a3.5 3.5 0 0 0 2.2 2.2L21.7 12l-5.6 2.2a3.5 3.5 0 0 0-2.2 2.2L12 22l-1.9-5.6a3.5 3.5 0 0 0-2.2-2.2L2.3 12l5.6-2.2a3.5 3.5 0 0 0 2.2-2.2L12 2z" />
    </svg>
  );
}

export function SmartRewrite(props: SmartRewriteProps) {
  const {
    children,
    actions = DEFAULT_ACTIONS,
    allowCustom = true,
    shortcut = "mod+j",
    disabled = false,
    theme = "auto",
    className,
    onRewrite,
  } = props;
  const labels = useMemo(() => ({ ...LABELS, ...props.labels }), [props.labels]);

  const rewriter = useSmartRewrite(props);
  const { reset } = rewriter;
  const [view, setView] = useState<View>("closed");
  const [target, setTarget] = useState<Target | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [chosen, setChosen] = useState<{ id: string; label: string } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [changed, setChanged] = useState(false);

  const scope = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  const close = useCallback(
    (restore: boolean) => {
      reset();
      setView("closed");
      setChanged(false);
      setInstruction("");
      if (restore && target && target.field.isConnected) {
        target.field.focus();
        target.field.setSelectionRange(target.start, target.end);
      }
    },
    [reset, target],
  );

  const run = (action: RewriteAction | string) => {
    if (!target) return;
    const typed = typeof action === "string";
    if (typed && !action.trim()) return;
    setChosen(typed ? { id: "custom", label: action.trim() } : { id: action.id, label: action.label });
    setChanged(false);
    setView("run");
    void rewriter.rewrite({
      text: target.text,
      action,
      before: target.field.value.slice(0, target.start),
      after: target.field.value.slice(target.end),
    });
  };

  const apply = () => {
    if (!target || rewriter.status !== "ready") return;
    const { field, start, end, text } = target;
    if (!field.isConnected || field.value.slice(start, end) !== text) {
      setChanged(true);
      props.onError?.(new SmartRewriteError("changed", labels.changed));
      return;
    }
    const next = rewriter.result;
    replaceFieldRange(field, start, end, next);
    onRewrite?.({ original: text, text: next, action: chosen?.id ?? "custom", field });
    rewriter.reset();
    setView("closed");
    setInstruction("");
  };

  // The handlers below are attached once; this keeps them reading current state.
  const live = useRef({ view, disabled, shortcut, close });
  live.current = { view, disabled, shortcut, close };

  useEffect(() => {
    const root = scope.current;
    if (!root) return;

    const read = (node: EventTarget | null, open: boolean) => {
      const state = live.current;
      if (state.disabled || state.view === "menu" || state.view === "run") return false;
      const selection = isRewriteField(node) ? getFieldSelection(node) : null;
      if (!selection || !isRewriteField(node)) {
        if (state.view === "trigger") setView("closed");
        return false;
      }
      const next = { field: node, ...selection };
      setTarget(next);
      setAnchor(anchorFor(next));
      setView(open ? "menu" : "trigger");
      return true;
    };

    const onSelect = (event: Event) => read(event.target, false);
    // A click inside an existing selection only collapses it after mouseup.
    const onMouseUp = (event: Event) => {
      const node = event.target;
      window.setTimeout(() => read(node, false), 0);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const state = live.current;
      if (state.shortcut && matchesShortcut(event, state.shortcut)) {
        if (read(event.target, true)) event.preventDefault();
      } else if (event.key === "Escape" && state.view === "trigger") {
        setView("closed");
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (live.current.view !== "trigger") return;
      const next = event.relatedTarget;
      if (next instanceof Node && popover.current?.contains(next)) return;
      setView("closed");
    };

    root.addEventListener("select", onSelect);
    root.addEventListener("keyup", onSelect);
    root.addEventListener("mouseup", onMouseUp);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      root.removeEventListener("select", onSelect);
      root.removeEventListener("keyup", onSelect);
      root.removeEventListener("mouseup", onMouseUp);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (disabled && view !== "closed") close(false);
  }, [disabled, view, close]);

  // Close on a press outside, and follow the field when the page scrolls or resizes.
  useEffect(() => {
    if (view === "closed" || !target) return;
    const onPointerDown = (event: Event) => {
      const node = event.target;
      if (!(node instanceof Node) || popover.current?.contains(node)) return;
      if (view === "trigger" && node === target.field) return;
      close(false);
    };
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setAnchor(anchorFor(target)));
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [view, target, close]);

  // Below the selection when it fits, above it otherwise, and always inside the window.
  useLayoutEffect(() => {
    const node = popover.current;
    if (!node || !anchor) return;
    const { width, height } = node.getBoundingClientRect();
    const viewWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewHeight = window.innerHeight;
    let top = anchor.bottom + GAP;
    if (top + height > viewHeight - EDGE && anchor.top - GAP - height >= EDGE) top = anchor.top - GAP - height;
    const left = Math.max(EDGE, Math.min(anchor.left, viewWidth - width - EDGE));
    node.style.top = `${Math.max(EDGE, top)}px`;
    node.style.left = `${left}px`;
  });

  // Move keyboard focus into the menu, then to the main button of each step.
  const step = view === "run" ? (changed ? "changed" : rewriter.status) : view;
  useEffect(() => {
    if (step === "trigger" || step === "closed") return;
    popover.current?.querySelector<HTMLElement>("[data-rsr-focus]")?.focus();
  }, [step]);

  const onPopoverKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (view !== "menu" || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    const items = Array.from(popover.current?.querySelectorAll<HTMLElement>("[data-rsr-item]") ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  let content: ReactNode = null;
  if (view === "trigger") {
    content = (
      <button
        type="button"
        className="rsr-trigger"
        title={shortcut ? `${labels.title} (${shortcutText(shortcut)})` : labels.title}
        // Keeps the field focused, so its selection stays visible.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setView("menu")}
      >
        <Sparkle />
        {labels.trigger}
      </button>
    );
  } else if (view === "menu") {
    content = (
      <div className="rsr-menu">
        {actions.map((action, index) => (
          <button
            key={action.id}
            type="button"
            className="rsr-item"
            data-rsr-item=""
            data-rsr-focus={index === 0 ? "" : undefined}
            onClick={() => run(action)}
          >
            {action.label}
          </button>
        ))}
        {allowCustom && (
          <form
            className="rsr-custom"
            onSubmit={(event) => {
              event.preventDefault();
              run(instruction);
            }}
          >
            <input
              type="text"
              value={instruction}
              maxLength={MAX_INSTRUCTION_LENGTH}
              placeholder={labels.placeholder}
              aria-label={labels.placeholder}
              data-rsr-item=""
              data-rsr-focus={actions.length === 0 ? "" : undefined}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <button type="submit" className="rsr-primary" disabled={!instruction.trim()}>
              {labels.send}
            </button>
          </form>
        )}
      </div>
    );
  } else if (view === "run") {
    const failure = changed ? labels.changed : rewriter.error?.message;
    content = (
      <div className="rsr-run">
        <p className="rsr-heading">{chosen?.label}</p>
        {failure ? (
          <>
            <p className="rsr-alert" role="alert">
              {failure}
            </p>
            <div className="rsr-actions">
              <button type="button" className="rsr-ghost" onClick={() => close(true)}>
                {labels.close}
              </button>
              {!changed && rewriter.error?.code !== "too-long" && (
                <button type="button" className="rsr-primary" data-rsr-focus="" onClick={() => void rewriter.retry()}>
                  {labels.retry}
                </button>
              )}
            </div>
          </>
        ) : rewriter.status === "ready" ? (
          <>
            <div className="rsr-preview" aria-label={labels.title}>
              {diffWords(rewriter.original, rewriter.result).map((part, index) =>
                part.type === "same" ? (
                  <span key={index}>{part.text}</span>
                ) : part.type === "added" ? (
                  <ins key={index}>{part.text}</ins>
                ) : (
                  <del key={index}>{part.text}</del>
                ),
              )}
            </div>
            <div className="rsr-actions">
              <button type="button" className="rsr-ghost" onClick={() => close(true)}>
                {labels.cancel}
              </button>
              <button type="button" className="rsr-ghost" onClick={() => void rewriter.retry()}>
                {labels.retry}
              </button>
              <button type="button" className="rsr-primary" data-rsr-focus="" onClick={apply}>
                {labels.replace}
              </button>
            </div>
          </>
        ) : (
          <>
            {rewriter.result && <div className="rsr-preview rsr-partial">{rewriter.result}</div>}
            <div className="rsr-busy" role="status">
              <span className="rsr-spinner" aria-hidden="true" />
              <span>{labels.working}</span>
              <button type="button" className="rsr-ghost" data-rsr-focus="" onClick={() => close(true)}>
                {labels.stop}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div ref={scope} style={{ display: "contents" }}>
        {children}
      </div>
      {content &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popover}
            className={["rsr", className].filter(Boolean).join(" ")}
            data-theme={theme === "auto" ? undefined : theme}
            data-view={view}
            role={view === "trigger" ? undefined : "dialog"}
            aria-label={view === "trigger" ? undefined : labels.title}
            onKeyDown={onPopoverKeyDown}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
