import type { CodeElement, LabelElement, LabelSpec, RuleElement, Symbology, TextElement } from './model';

const SYMBOLOGIES: Symbology[] = ['qr', 'code128', 'code39', 'ean13', 'datamatrix'];
const num = (v: unknown, min: number, max: number, fb: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
};
const str = (v: unknown, max: number, fb = '') => (typeof v === 'string' ? v.slice(0, max) : fb);
const ROT = [0, 90, 180, 270] as const;

/**
 * Templates are stored as user-editable data, so anything read back is untrusted. This returns a clean LabelSpec
 * (numbers clamped, unknown kinds dropped, sizes capped) or null when there is nothing usable.
 */
export function sanitizeSpec(input: unknown): LabelSpec | null {
  let raw: any = input;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } }
  if (!raw || typeof raw !== 'object') return null;
  const widthMm = num(raw.widthMm, 5, 300, NaN);
  const heightMm = num(raw.heightMm, 5, 500, NaN);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null;
  const elements: LabelElement[] = [];
  for (const e of Array.isArray(raw.elements) ? raw.elements.slice(0, 40) : []) {
    if (!e || typeof e !== 'object') continue;
    const base = {
      id: str(e.id, 40, `e${elements.length + 1}`) || `e${elements.length + 1}`,
      x: num(e.x, -50, 500, 0), y: num(e.y, -50, 700, 0), w: num(e.w, 0.5, 500, 10), h: num(e.h, 0.5, 700, 5),
      rotate: (ROT as readonly number[]).includes(e.rotate) ? (e.rotate as 0 | 90 | 180 | 270) : 0,
    };
    if (e.kind === 'text') {
      const t: TextElement = { ...base, kind: 'text', text: str(e.text, 300), fontMm: num(e.fontMm, 1, 60, 3), bold: !!e.bold, align: e.align === 'center' || e.align === 'right' ? e.align : 'left', maxLines: e.maxLines ? Math.floor(num(e.maxLines, 1, 20, 1)) : undefined };
      elements.push(t);
    } else if (e.kind === 'code' && SYMBOLOGIES.includes(e.symbology)) {
      const c: CodeElement = { ...base, kind: 'code', symbology: e.symbology, value: str(e.value, 300), ecc: ['L', 'M', 'Q', 'H'].includes(e.ecc) ? e.ecc : undefined, showText: !!e.showText };
      elements.push(c);
    } else if (e.kind === 'rule') {
      const r: RuleElement = { ...base, kind: 'rule', thicknessMm: e.thicknessMm ? num(e.thicknessMm, 0.1, 20, 0.3) : undefined };
      elements.push(r);
    }
  }
  return {
    id: str(raw.id, 60, 'template') || 'template',
    name: str(raw.name, 80, 'Untitled template') || 'Untitled template',
    widthMm, heightMm,
    tailMm: raw.tailMm ? num(raw.tailMm, 0, 300, 0) : undefined,
    stockId: raw.stockId ? str(raw.stockId, 60) : undefined,
    brandFooter: raw.brandFooter === true ? true : undefined,
    elements,
  };
}
