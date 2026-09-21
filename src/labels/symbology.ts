import bwipjs from 'bwip-js';
import type { Symbology } from './model';

/** A symbol reduced to whole modules, so it can be drawn on an exact dot grid. */
export interface Encoded {
  kind: 'matrix' | 'linear';
  modulesX: number;
  modulesY: number;
  /** matrix: row-major 0/1 grid of modulesX * modulesY. */
  matrix?: Uint8Array;
  /** linear: bars in module units from the left edge. */
  bars?: { x: number; w: number }[];
  /** Quiet zone required on every side, in modules. */
  quietModules: number;
}

export class SymbolError extends Error {}

const BCID: Record<Symbology, string> = { qr: 'qrcode', code128: 'code128', code39: 'code39', ean13: 'ean13', datamatrix: 'datamatrix' };
const NAME: Record<Symbology, string> = { qr: 'QR code', code128: 'Code 128 barcode', code39: 'Code 39 barcode', ean13: 'EAN-13 barcode', datamatrix: 'Data Matrix code' };
const QUIET: Record<Symbology, number> = { qr: 4, datamatrix: 2, code128: 10, code39: 10, ean13: 10 };

export function symbologyName(s: Symbology) { return NAME[s]; }

function friendly(sym: Symbology, value: string, raw: string): string {
  if (sym === 'ean13') return 'An EAN-13 barcode needs exactly 12 or 13 digits.';
  if (sym === 'code39') return 'Code 39 accepts capital letters, digits, and the characters - . $ / + % and space.';
  if (/too long|exceeds|capacity/i.test(raw)) return `That text is too long for a ${NAME[sym]}. Shorten it or use a QR code.`;
  return `"${value}" cannot be encoded as a ${NAME[sym]}.`;
}

export function encodeSymbol(sym: Symbology, value: string, opts: { ecc?: 'L' | 'M' | 'Q' | 'H' } = {}): Encoded {
  if (!value) throw new SymbolError(`The ${NAME[sym]} has nothing to encode.`);
  let raw: any;
  try {
    raw = bwipjs.raw({ bcid: BCID[sym], text: value, includetext: false, ...(sym === 'qr' ? { eclevel: opts.ecc || 'M' } : {}) } as any);
  } catch (e: any) {
    throw new SymbolError(friendly(sym, value, String(e?.message || e)));
  }
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (r.pixs) {
    return { kind: 'matrix', modulesX: r.pixx, modulesY: r.pixy, matrix: Uint8Array.from(r.pixs), quietModules: QUIET[sym] };
  }
  const bars: { x: number; w: number }[] = [];
  let pos = 0;
  (r.sbs as number[]).forEach((w, i) => { if (i % 2 === 0) bars.push({ x: pos, w }); pos += w; });
  return { kind: 'linear', modulesX: pos, modulesY: 1, bars, quietModules: QUIET[sym] };
}
