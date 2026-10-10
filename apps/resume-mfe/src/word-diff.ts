export interface TextDiffPart {
  type: "same" | "removed" | "added";
  text: string;
}
const tokens = (text: string) => text.match(/\s+|[\p{L}\p{N}_]+|[^\s]/gu) ?? [];

// Bounded LCS keeps separate edits visible and preserves every source character.
export function wordDiff(original: string, proposed: string): TextDiffPart[] {
  const before = tokens(original),
    after = tokens(proposed);
  let start = 0,
    end = 0;
  while (start < before.length && before[start] === after[start]) start++;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - end - 1] === after[after.length - end - 1]
  )
    end++;
  const a = before.slice(start, before.length - end),
    b = after.slice(start, after.length - end),
    parts: TextDiffPart[] = [];
  const add = (type: TextDiffPart["type"], text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last?.type === type) last.text += text;
    else parts.push({ type, text });
  };
  add("same", before.slice(0, start).join(""));
  if ((a.length + 1) * (b.length + 1) > 1_000_000) {
    // Very large replacements avoid blocking the editor; full texts remain readable.
    add("removed", a.join(""));
    add("added", b.join(""));
  } else {
    const width = b.length + 1,
      lengths = new Uint16Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        lengths[i * width + j] =
          a[i] === b[j]
            ? 1 + (lengths[(i + 1) * width + j + 1] ?? 0)
            : Math.max(
                lengths[(i + 1) * width + j] ?? 0,
                lengths[i * width + j + 1] ?? 0,
              );
    let i = 0,
      j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && a[i] === b[j]) {
        add("same", a[i++] ?? "");
        j++;
      } else if (
        i < a.length &&
        (j === b.length ||
          (lengths[(i + 1) * width + j] ?? 0) >=
            (lengths[i * width + j + 1] ?? 0))
      )
        add("removed", a[i++] ?? "");
      else add("added", b[j++] ?? "");
    }
  }
  add("same", end ? before.slice(before.length - end).join("") : "");
  return parts;
}
