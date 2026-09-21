import { type AssetData, type CodeElement, type Issue, type LabelSpec, type TextElement, resolvePlaceholders } from './model';
import { SymbolError, encodeSymbol, symbologyName } from './symbology';
import { dotsToMm, fitSymbol, mmToDots } from './fit';

const FONT = "Barlow, 'Helvetica Neue', Arial, sans-serif";
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Every piece of user data goes through this before it reaches the SVG. */
export const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ESC[c]);
const num = (v: number) => String(+v.toFixed(3));
const snap = (mm: number, dpi: number) => dotsToMm(Math.round(mmToDots(mm, dpi)), dpi);

export type Measure = (text: string, fontMm: number, bold: boolean) => number;
/** Approximate text width. The editor passes a canvas-based measure for exact wrapping. */
export const approxMeasure: Measure = (text, fontMm, bold) => text.length * fontMm * (bold ? 0.56 : 0.5);

export interface RenderedLabel {
  /** Complete SVG document sized in millimetres. */
  svg: string;
  /** Contents only, for placing on a sheet. */
  inner: string;
  widthMm: number;
  heightMm: number;
  /** Errors must block printing. Warnings should be shown. */
  issues: Issue[];
}

function wrap(text: string, maxW: number, fontMm: number, bold: boolean, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next, fontMm, bold) > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function renderText(el: TextElement, data: AssetData, measure: Measure, issues: Issue[]): string {
  const text = resolvePlaceholders(el.text, data).trim();
  if (!text) return '';
  const lineH = el.fontMm * 1.15;
  const maxLines = Math.max(1, el.maxLines ?? Math.floor(el.h / lineH));
  let lines = wrap(text, el.w, el.fontMm, !!el.bold, measure);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && measure(`${last}…`, el.fontMm, !!el.bold) > el.w) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
    issues.push({ level: 'warn', elementId: el.id, message: 'Some text does not fit its box and is cut off. Make the box bigger or the text smaller.' });
  }
  if (el.fontMm < 1.8) issues.push({ level: 'warn', elementId: el.id, message: `The text is very small (${el.fontMm.toFixed(1)} mm tall) and may be hard to read once printed.` });
  const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
  const x = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
  const spans = lines.map((l, i) => `<text x="${num(x)}" y="${num(el.y + el.fontMm * 0.85 + i * lineH)}" text-anchor="${anchor}">${esc(l)}</text>`).join('');
  return `<g font-family="${esc(FONT)}" font-size="${num(el.fontMm)}" font-weight="${el.bold ? 700 : 400}" fill="#000">${spans}</g>`;
}

function renderCode(el: CodeElement, data: AssetData, dpi: number, issues: Issue[]): string {
  const value = resolvePlaceholders(el.value, data).trim();
  const label = symbologyName(el.symbology);
  let enc;
  try {
    enc = encodeSymbol(el.symbology, value, { ecc: el.ecc });
  } catch (e) {
    issues.push({ level: 'error', elementId: el.id, message: e instanceof SymbolError ? e.message : `The ${label} could not be created.` });
    return '';
  }
  const textH = enc.kind === 'linear' && el.showText ? 3 : 0;
  const fit = fitSymbol(enc, el.w, el.h - textH, dpi, label);
  fit.issues.forEach(i => issues.push({ ...i, elementId: el.id }));
  if (fit.moduleDots < 1) return '';

  const m = fit.moduleMm;
  const q = enc.quietModules;
  const x0 = snap(el.x + (el.w - fit.widthMm) / 2, dpi);
  const y0 = enc.kind === 'matrix' ? snap(el.y + (el.h - fit.heightMm) / 2, dpi) : snap(el.y, dpi);
  let path = '';
  if (enc.kind === 'matrix') {
    for (let r = 0; r < enc.modulesY; r++) {
      let c = 0;
      while (c < enc.modulesX) {
        if (enc.matrix![r * enc.modulesX + c] === 1) {
          let run = 1;
          while (c + run < enc.modulesX && enc.matrix![r * enc.modulesX + c + run] === 1) run++;
          path += `M${num(x0 + (c + q) * m)} ${num(y0 + (r + q) * m)}h${num(run * m)}v${num(m)}h${num(-run * m)}z`;
          c += run;
        } else c++;
      }
    }
  } else {
    const barH = el.h - textH;
    for (const b of enc.bars!) path += `M${num(x0 + (b.x + q) * m)} ${num(y0)}h${num(b.w * m)}v${num(barH)}h${num(-b.w * m)}z`;
  }
  const caption = textH
    ? `<text x="${num(el.x + el.w / 2)}" y="${num(el.y + el.h - 0.6)}" text-anchor="middle" font-family="${esc(FONT)}" font-size="2.4" fill="#000">${esc(value)}</text>`
    : '';
  return `<path d="${path}" fill="#000" shape-rendering="crispEdges"/>${caption}`;
}

/** Renders one label to vector SVG in millimetres. Same output for preview, print and sheets. */
export function renderLabel(spec: LabelSpec, data: AssetData, opts: { dpi?: number; measure?: Measure } = {}): RenderedLabel {
  const dpi = opts.dpi ?? 203;
  const measure = opts.measure ?? approxMeasure;
  const issues: Issue[] = [];
  const body: string[] = [];
  for (const el of spec.elements) {
    if (el.x < -0.01 || el.y < -0.01 || el.x + el.w > spec.widthMm + 0.01 || el.y + el.h > spec.heightMm + 0.01) {
      issues.push({ level: 'warn', elementId: el.id, message: 'This item reaches past the edge of the label and may be cut off.' });
    }
    if (el.kind === 'text') body.push(renderText(el, data, measure, issues));
    else if (el.kind === 'code') body.push(renderCode(el, data, dpi, issues));
    else body.push(`<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.thicknessMm ?? el.h)}" fill="#000"/>`);
  }
  const inner = `<rect width="${num(spec.widthMm)}" height="${num(spec.heightMm)}" fill="#fff"/>${body.join('')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(spec.widthMm)}mm" height="${num(spec.heightMm)}mm" viewBox="0 0 ${num(spec.widthMm)} ${num(spec.heightMm)}">${inner}</svg>`;
  return { svg, inner, widthMm: spec.widthMm, heightMm: spec.heightMm, issues };
}
