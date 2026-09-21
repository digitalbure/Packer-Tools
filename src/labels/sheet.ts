export interface PageSize { widthMm: number; heightMm: number }
export const PAGES: Record<'a4' | 'letter', PageSize> = { a4: { widthMm: 210, heightMm: 297 }, letter: { widthMm: 215.9, heightMm: 279.4 } };

export interface SheetOptions {
  marginMm?: number;
  gapMm?: number;
  /** Fixed grid. Omit to fit as many as the page allows. */
  cols?: number;
  rows?: number;
  /** Nudges everything to line up with a printer that prints slightly off (mm). */
  offsetXmm?: number;
  offsetYmm?: number;
  /** Cutting guides. 'box' draws a dashed outline around each label. */
  guides?: 'none' | 'box' | 'corners';
}

export interface Layout { cols: number; rows: number; perPage: number; cells: { x: number; y: number }[] }

export function layoutSheet(page: PageSize, label: { widthMm: number; heightMm: number }, o: SheetOptions = {}): Layout {
  const m = o.marginMm ?? 8;
  const g = o.gapMm ?? 0;
  const cols = o.cols ?? Math.max(1, Math.floor((page.widthMm - 2 * m + g) / (label.widthMm + g)));
  const rows = o.rows ?? Math.max(1, Math.floor((page.heightMm - 2 * m + g) / (label.heightMm + g)));
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push({ x: m + c * (label.widthMm + g) + (o.offsetXmm ?? 0), y: m + r * (label.heightMm + g) + (o.offsetYmm ?? 0) });
  }
  return { cols, rows, perPage: cols * rows, cells };
}

/**
 * Settings for people printing on an ordinary printer and taping labels on by hand: a wide gap
 * to cut in, and a dashed line to cut along.
 */
export function tapeItYourselfOptions(): SheetOptions {
  return { marginMm: 10, gapMm: 5, guides: 'box' };
}

const n = (v: number) => String(+v.toFixed(3));

/** Places rendered labels on pages. Returns one SVG document (in mm) per page. */
export function renderSheets(
  labels: { inner: string; widthMm: number; heightMm: number }[],
  page: PageSize,
  o: SheetOptions = {},
): string[] {
  if (labels.length === 0) return [];
  const layout = layoutSheet(page, labels[0], o);
  const pages: string[] = [];
  for (let start = 0; start < labels.length; start += layout.perPage) {
    const chunk = labels.slice(start, start + layout.perPage);
    const parts = chunk.map((l, i) => {
      const { x, y } = layout.cells[i];
      const guide = o.guides === 'box'
        ? `<rect x="${n(x)}" y="${n(y)}" width="${n(l.widthMm)}" height="${n(l.heightMm)}" fill="none" stroke="#8a8a8a" stroke-width="0.15" stroke-dasharray="1 1"/>`
        : o.guides === 'corners'
          ? [[x, y, -1, -1], [x + l.widthMm, y, 1, -1], [x, y + l.heightMm, -1, 1], [x + l.widthMm, y + l.heightMm, 1, 1]]
              .map(([cx, cy, dx, dy]) => `<path d="M${n(cx + dx * 0.8)} ${n(cy)}h${n(dx * 1.6)}M${n(cx)} ${n(cy + dy * 0.8)}v${n(dy * 1.6)}" stroke="#8a8a8a" stroke-width="0.15"/>`).join('')
          : '';
      return `<g transform="translate(${n(x)} ${n(y)})">${l.inner}</g>${guide}`;
    });
    pages.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${n(page.widthMm)}mm" height="${n(page.heightMm)}mm" viewBox="0 0 ${n(page.widthMm)} ${n(page.heightMm)}"><rect width="${n(page.widthMm)}" height="${n(page.heightMm)}" fill="#fff"/>${parts.join('')}</svg>`);
  }
  return pages;
}
