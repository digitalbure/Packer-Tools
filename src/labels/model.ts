/** Label model. All geometry is in millimetres. One model drives the preview, browser print, sheets and image export. */
export type Symbology = 'qr' | 'code128' | 'code39' | 'ean13' | 'datamatrix';

interface Base {
  id: string; x: number; y: number; w: number; h: number;
  /** Turns the element inside its box. 90 and 270 swap the box's width and height. Needed for barcodes on narrow labels. */
  rotate?: 0 | 90 | 180 | 270;
}
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
  /** Printed area. */
  widthMm: number;
  heightMm: number;
  /** Blank tail after the printed area, as on wrap-around cable labels (e.g. 25 x 38 + 40). Adds to the feed length only. */
  tailMm?: number;
  /** The stock this label is designed for, see presets.ts. */
  stockId?: string;
  /** Prints a small "by Packer.Tools" line in the bottom corner. Leave about 2.5 mm free at the bottom. */
  brandFooter?: boolean;
  elements: LabelElement[];
}

export interface AssetData {
  name?: string; brand?: string; model?: string; assetTag?: string; serial?: string; url?: string; category?: string;
  /** Who owns the item. Fills {{owner.name}}, {{owner.phone}} and {{owner.email}}. */
  ownerName?: string; ownerPhone?: string; ownerEmail?: string;
}

export interface Issue { level: 'error' | 'warn'; elementId?: string; message: string }

export const PLACEHOLDER = /\{\{\s*(asset|owner)\.(name|brand|model|assetTag|serial|url|category|phone|email)\s*\}\}/g;

const OWNER_FIELD: Record<string, keyof AssetData> = { name: 'ownerName', phone: 'ownerPhone', email: 'ownerEmail' };

/** Fills {{asset.*}} and {{owner.*}} placeholders. Unknown or missing values become empty text. */
export function resolvePlaceholders(text: string, data: AssetData): string {
  return text.replace(PLACEHOLDER, (_m, scope: string, key: string) => {
    const field = scope === 'owner' ? OWNER_FIELD[key] : (key as keyof AssetData);
    return field ? String(data[field] ?? '') : '';
  });
}
