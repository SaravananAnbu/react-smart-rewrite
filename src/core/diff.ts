export interface DiffPart {
  type: "same" | "added" | "removed";
  text: string;
}

// Above this many word pairs the comparison table gets too large to be worth building.
const MAX_CELLS = 400_000;

function words(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part !== "");
}

function push(parts: DiffPart[], type: DiffPart["type"], text: string) {
  const last = parts[parts.length - 1];
  if (last && last.type === type) last.text += text;
  else parts.push({ type, text });
}

/** Word-by-word difference between two texts, for showing what a rewrite changed. */
export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ type: "same", text: before }] : [];
  const a = words(before);
  const b = words(after);

  if (a.length * b.length > MAX_CELLS) {
    const whole: DiffPart[] = [];
    if (before) whole.push({ type: "removed", text: before });
    if (after) whole.push({ type: "added", text: after });
    return whole;
  }

  // Longest common subsequence, filled from the end so the walk below runs forwards.
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(parts, "same", a[i]!);
      i++;
      j++;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      push(parts, "removed", a[i++]!);
    } else {
      push(parts, "added", b[j++]!);
    }
  }
  while (i < a.length) push(parts, "removed", a[i++]!);
  while (j < b.length) push(parts, "added", b[j++]!);
  return parts;
}
