import type { Encoded } from './symbology';
import type { Issue } from './model';

export const MM_PER_INCH = 25.4;
export const mmToDots = (mm: number, dpi: number) => (mm * dpi) / MM_PER_INCH;
export const dotsToMm = (dots: number, dpi: number) => (dots * MM_PER_INCH) / dpi;

/** Smallest module that scans reliably (mm). Below "min" it is an error, below "good" a warning. */
const LIMITS = {
  matrix: { min: 0.3, good: 0.33 },
  linear: { min: 0.19, good: 0.25 },
};

export interface Fit {
  /** Whole printer dots per module: keeps edges sharp on thermal heads. 0 means it does not fit. */
  moduleDots: number;
  moduleMm: number;
  /** Size of the drawn symbol including quiet zone. */
  widthMm: number;
  heightMm: number;
  issues: Issue[];
}

/**
 * Sizes a symbol inside a box (mm) so every module is a whole number of printer dots, and reports
 * when the result is too small to scan. Messages are written for the person printing the label.
 */
export function fitSymbol(enc: Encoded, boxWmm: number, boxHmm: number, dpi: number, label = 'code'): Fit {
  const q = enc.quietModules * 2;
  const totalX = enc.modulesX + q;
  const availX = Math.floor(mmToDots(boxWmm, dpi));
  const availY = Math.floor(mmToDots(boxHmm, dpi));
  const totalY = enc.kind === 'matrix' ? enc.modulesY + q : 0;
  const perModule = enc.kind === 'matrix' ? Math.min(Math.floor(availX / totalX), Math.floor(availY / totalY)) : Math.floor(availX / totalX);
  const moduleDots = Math.max(perModule, 0);
  const moduleMm = dotsToMm(moduleDots, dpi);
  const limit = LIMITS[enc.kind];
  const issues: Issue[] = [];
  const needMm = (m: number) => Math.ceil(totalX * m * 10) / 10;

  if (moduleDots < 1) {
    issues.push({ level: 'error', message: `The ${label} does not fit. Make it at least ${needMm(limit.good)} mm wide, or use a shorter value.` });
  } else if (moduleMm < limit.min) {
    issues.push({ level: 'error', message: `The ${label} is too small to scan (${moduleMm.toFixed(2)} mm per square at ${dpi} dpi). Make it at least ${needMm(limit.good)} mm wide, or shorten the value.` });
  } else if (moduleMm < limit.good) {
    issues.push({ level: 'warn', message: `The ${label} may be hard to scan (${moduleMm.toFixed(2)} mm per square at ${dpi} dpi). ${needMm(limit.good)} mm wide is safer.` });
  }
  return {
    moduleDots,
    moduleMm,
    widthMm: totalX * moduleMm,
    heightMm: enc.kind === 'matrix' ? totalY * moduleMm : boxHmm,
    issues,
  };
}
