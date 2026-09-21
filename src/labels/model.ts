/** Label model. All geometry is in millimetres. One model drives the preview, browser print, sheets and image export. */
export type Symbology = 'qr' | 'code128' | 'code39' | 'ean13' | 'datamatrix';

interface Base { id: string; x: number; y: number; w: number; h: number }
export interface TextElement extends Base {
  kind: 'text';
  /** May contain {{asset.name}}, {{asset.assetTag}}, {{asset.brand}}, {{asset.model}}, {{asset.serial}}. */
  text: string;
  fontMm: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  maxLines?: number;
}
export interface CodeElement extends Base {
  kind: 'code';
  symbology: Symbology;
  /** Value to encode; placeholders allowed. */
  value: string;
  /** QR error correction. Default M. */
  ecc?: 'L' | 'M' | 'Q' | 'H';
  /** Print the value under a 1D code. */
  showText?: boolean;
}
export interface RuleElement extends Base { kind: 'rule'; thicknessMm?: number }
export type LabelElement = TextElement | CodeElement | RuleElement;

export interface LabelSpec {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  elements: LabelElement[];
}

export interface AssetData {
  name?: string; brand?: string; model?: string; assetTag?: string; serial?: string; url?: string;
}

export interface Issue { level: 'error' | 'warn'; elementId?: string; message: string }

export const PLACEHOLDER = /\{\{\s*asset\.(name|brand|model|assetTag|serial|url)\s*\}\}/g;

/** Fills {{asset.*}} placeholders. Unknown or missing values become empty text. */
export function resolvePlaceholders(text: string, data: AssetData): string {
  return text.replace(PLACEHOLDER, (_m, key: keyof AssetData) => String(data[key] ?? ''));
}
