export type RewriteField = HTMLTextAreaElement | HTMLInputElement;

export interface FieldSelection {
  start: number;
  end: number;
  text: string;
}

// Input types whose selection can be read. Passwords are left out on purpose.
const INPUT_TYPES = new Set(["text", "search", "url", "tel"]);

/** A textarea or text-like input that is editable. */
export function isRewriteField(node: unknown): node is RewriteField {
  if (typeof HTMLElement === "undefined" || !(node instanceof HTMLElement)) return false;
  const editable = (field: RewriteField) => !field.disabled && !field.readOnly;
  if (node instanceof HTMLTextAreaElement) return editable(node);
  if (node instanceof HTMLInputElement) return INPUT_TYPES.has(node.type) && editable(node);
  return false;
}

/** The field's selection, or `null` when nothing (or only whitespace) is selected. */
export function getFieldSelection(field: RewriteField): FieldSelection | null {
  let start: number | null;
  let end: number | null;
  try {
    start = field.selectionStart;
    end = field.selectionEnd;
  } catch {
    return null;
  }
  if (start == null || end == null || end <= start) return null;
  const text = field.value.slice(start, end);
  return text.trim() ? { start, end, text } : null;
}

function setNativeValue(field: RewriteField, value: string) {
  // React tracks the value through the element's own setter; calling the
  // prototype's setter makes the following input event look like real typing.
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
}

/**
 * Replaces `start…end` in the field with `text` and selects the new text.
 * Goes through the browser's own editing command where possible, so the user can undo it;
 * either way an `input` event fires, so controlled React fields update.
 */
export function replaceFieldRange(field: RewriteField, start: number, end: number, text: string): void {
  field.focus();
  field.setSelectionRange(start, end);

  let done = false;
  try {
    done = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
  } catch {
    done = false;
  }
  // Some browsers report success without changing a field.
  if (done && field.value.slice(start, start + text.length) !== text) done = false;

  if (!done) {
    setNativeValue(field, field.value.slice(0, start) + text + field.value.slice(end));
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  field.setSelectionRange(start, start + text.length);
}

export interface CaretRect {
  /** Viewport coordinates of the character position. */
  left: number;
  top: number;
  bottom: number;
}

const MIRRORED = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textAlign",
  "textTransform",
  "textIndent",
  "tabSize",
  "direction",
] as const;

/**
 * Where a character position sits on screen. Browsers do not report this for form fields,
 * so the text is laid out again in a hidden copy of the field and measured there.
 */
export function getCaretRect(field: RewriteField, position: number): CaretRect {
  const box = field.getBoundingClientRect();
  const fallback = { left: box.left, top: box.top, bottom: box.bottom };
  if (typeof window === "undefined" || !document.body) return fallback;

  const style = window.getComputedStyle(field);
  const mirror = document.createElement("div");
  const target = mirror.style as unknown as Record<string, string>;
  const source = style as unknown as Record<string, string>;
  for (const name of MIRRORED) target[name] = source[name] ?? "";
  const single = field instanceof HTMLInputElement;
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  mirror.style.overflow = "hidden";
  mirror.style.whiteSpace = single ? "pre" : "pre-wrap";
  mirror.style.overflowWrap = single ? "normal" : "break-word";
  mirror.style.borderStyle = "solid";
  if (single) mirror.style.width = "auto";

  mirror.textContent = field.value.slice(0, position);
  const marker = document.createElement("span");
  // A zero-width space gives the marker a line box even at the end of the text.
  marker.textContent = field.value.slice(position, position + 1) === "\n" || position >= field.value.length ? "​" : field.value.slice(position, position + 1);
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;
  // offsetTop/Left start at the padding edge, so the border is added back.
  const markerTop = marker.offsetTop + mirror.clientTop;
  const markerLeft = marker.offsetLeft + mirror.clientLeft;
  const measured = mirror.offsetHeight > 0;
  document.body.removeChild(mirror);
  if (!measured) return fallback;

  const top = box.top + markerTop - field.scrollTop;
  const left = box.left + markerLeft - field.scrollLeft;
  return {
    // Keep the point inside the field when the selection is scrolled out of view.
    left: Math.min(Math.max(left, box.left), box.right),
    top: Math.min(Math.max(top, box.top), box.bottom),
    bottom: Math.min(Math.max(top + lineHeight, box.top), box.bottom),
  };
}
