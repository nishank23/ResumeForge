// Reconstruct visual rows rather than PDF drawing order. Adjacent glyphs stay
// together; distant columns remain separate. Link destinations are data only.
interface Fragment {
  str: string;
  width: number;
  height: number;
  transform: number[];
}
interface Piece {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function pdfPageText(
  items: readonly Fragment[],
  annotations: readonly unknown[],
): string {
  const pieces: Piece[] = items
    .filter((i) => i.str.trim())
    .map((i) => ({
      text: i.str.trim(),
      x: i.transform[4] ?? 0,
      y: i.transform[5] ?? 0,
      width: i.width,
      height: i.height || 10,
    }));
  for (const annotation of annotations) {
    if (
      !annotation ||
      typeof annotation !== "object" ||
      !("url" in annotation) ||
      !("rect" in annotation)
    )
      continue;
    const { url, rect } = annotation;
    if (
      typeof url !== "string" ||
      url.length > 1000 ||
      !/^https?:\/\//i.test(url) ||
      !Array.isArray(rect)
    )
      continue;
    const coords: unknown[] = rect;
    const [left, bottom, right, top] = coords;
    if (
      ![left, bottom, right, top].every(
        (v) => typeof v === "number" && Number.isFinite(v),
      )
    )
      continue;
    const x = Number(right),
      y = Number(bottom) + 2;
    // Do not duplicate a destination already printed inside its annotation.
    if (
      pieces.some(
        (p) =>
          p.x >= Number(left) - 2 &&
          p.x <= x &&
          p.y >= Number(bottom) - 3 &&
          p.y <= Number(top) + 3 &&
          p.text.includes(url),
      )
    )
      continue;
    pieces.push({
      text: url,
      x: x + 2,
      y,
      width: 0,
      height: Number(top) - Number(bottom),
    });
  }
  const rows: { y: number; height: number; pieces: Piece[] }[] = [];
  for (const piece of pieces.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find(
      (r) =>
        Math.abs(r.y - piece.y) <=
        Math.max(2.5, Math.min(r.height, piece.height) * 0.24),
    );
    if (row) row.pieces.push(piece);
    else rows.push({ y: piece.y, height: piece.height, pieces: [piece] });
  }
  return rows
    .map((row) => {
      let text = "",
        previous: Piece | undefined;
      for (const piece of row.pieces.sort((a, b) => a.x - b.x)) {
        if (previous) {
          const gap = piece.x - previous.x - previous.width,
            height = Math.min(piece.height, previous.height);
          text +=
            gap > height * 1.2
              ? "\t"
              : gap > height * 0.12 || /^https?:\/\//i.test(piece.text)
                ? " "
                : "";
        }
        text += piece.text;
        previous = piece;
      }
      return text;
    })
    .join("\n");
}
