import type { LabelSpec } from './model';

/** A physical roll or sheet a label is printed on. Size is fixed by the stock, not by the printer. */
export interface LabelStock {
  id: string;
  name: string;
  group: 'cable' | 'tag' | 'roll' | 'sheet';
  material: string;
  colour: string;
  widthMm: number;
  /** Printed area. */
  heightMm: number;
  /** Blank tail that wraps around a cable. Adds to the feed length only. */
  tailMm?: number;
  note?: string;
}

export const LABEL_STOCKS: LabelStock[] = [
  // Cable wrap labels: printed panel + tail (width x length + tail)
  { id: 'pcable-25x38-40-white', name: 'Cable wrap 25 x 38 + 40 mm, white', group: 'cable', material: 'Synthetic', colour: 'White', widthMm: 25, heightMm: 38, tailMm: 40 },
  { id: 'pcable-25x38-40-yellow', name: 'Cable wrap 25 x 38 + 40 mm, yellow', group: 'cable', material: 'Synthetic', colour: 'Yellow', widthMm: 25, heightMm: 38, tailMm: 40 },
  { id: 'pcable-25x38-40-red', name: 'Cable wrap 25 x 38 + 40 mm, red', group: 'cable', material: 'Synthetic', colour: 'Red', widthMm: 25, heightMm: 38, tailMm: 40, note: 'Black on red has lower contrast. Test that codes scan.' },
  { id: 'pcable-30x45-50-white', name: 'Cable wrap 30 x 45 + 50 mm, white', group: 'cable', material: 'Synthetic', colour: 'White', widthMm: 30, heightMm: 45, tailMm: 50 },
  // Asset tags
  { id: 'pet-30x22', name: 'Silver matte PET 30 x 22 mm', group: 'tag', material: 'PET', colour: 'Silver matte', widthMm: 30, heightMm: 22, note: 'Silver is darker than white. Test that codes scan.' },
  { id: 'pet-40x30', name: 'Silver matte PET 40 x 30 mm', group: 'tag', material: 'PET', colour: 'Silver matte', widthMm: 40, heightMm: 30, note: 'Silver is darker than white. Test that codes scan.' },
  { id: 'pet-50x30', name: 'Silver matte PET 50 x 30 mm', group: 'tag', material: 'PET', colour: 'Silver matte', widthMm: 50, heightMm: 30, note: 'Silver is darker than white. Test that codes scan.' },
  { id: 'pp-40x30', name: 'White synthetic PP 40 x 30 mm', group: 'tag', material: 'Polypropylene', colour: 'White', widthMm: 40, heightMm: 30 },
  { id: 'pp-50x30', name: 'White synthetic PP 50 x 30 mm', group: 'tag', material: 'Polypropylene', colour: 'White', widthMm: 50, heightMm: 30 },
  // Other common sizes
  { id: 'tag-50x25', name: 'Small item tag 50 x 25 mm', group: 'tag', material: 'Any', colour: 'White', widthMm: 50, heightMm: 25 },
  { id: 'case-76x51', name: 'Case or bin label 76 x 51 mm (3 x 2 in)', group: 'tag', material: 'Any', colour: 'White', widthMm: 76.2, heightMm: 50.8 },
  { id: 'flight-100x150', name: 'Flight case label 100 x 150 mm (4 x 6 in)', group: 'tag', material: 'Any', colour: 'White', widthMm: 101.6, heightMm: 152.4 },
  { id: 'brother-62-roll', name: 'Brother roll, 62 mm wide', group: 'roll', material: 'Any', colour: 'White', widthMm: 62, heightMm: 40, note: 'Continuous roll. Length is set per label.' },
  { id: 'sheet-a4-3x7', name: 'A4 sheet 63.5 x 38.1 mm (3 x 7)', group: 'sheet', material: 'Paper', colour: 'White', widthMm: 63.5, heightMm: 38.1 },
  { id: 'sheet-a4-2x7', name: 'A4 sheet 99.1 x 38.1 mm (2 x 7)', group: 'sheet', material: 'Paper', colour: 'White', widthMm: 99.1, heightMm: 38.1 },
];

export const getStock = (id: string) => LABEL_STOCKS.find(s => s.id === id);

const asset = { kind: 'text' as const };
const T = (id: string, x: number, y: number, w: number, h: number, text: string, fontMm: number, extra: object = {}) =>
  ({ ...asset, id, x, y, w, h, text, fontMm, ...extra });

/**
 * Starter templates for the stock above. These are the global templates an admin can publish.
 * Each is checked in tests: it must render without errors at 300 dpi with realistic data.
 */
export const STARTER_TEMPLATES: LabelSpec[] = [
  {
    id: 'starter-asset-50x30', name: 'Asset tag with QR, 50 x 30', widthMm: 50, heightMm: 30, stockId: 'pp-50x30',
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 2, y: 4, w: 22, h: 22 },
      T('name', 26, 3, 22, 12, '{{asset.name}}', 3.2, { bold: true, maxLines: 3 }),
      T('tag', 26, 20, 22, 4, '{{asset.assetTag}}', 3),
    ],
  },
  {
    id: 'starter-asset-40x30', name: 'Asset tag with QR, 40 x 30', widthMm: 40, heightMm: 30, stockId: 'pp-40x30',
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 1.5, y: 4, w: 22, h: 22 },
      T('tag', 25, 3, 14, 24, '{{asset.assetTag}}', 2.8, { rotate: 90, bold: true }),
    ],
  },
  {
    id: 'starter-small-30x22', name: 'Small tag with QR, 30 x 22', widthMm: 30, heightMm: 22, stockId: 'pet-30x22',
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 1.5, y: 2, w: 18, h: 18 },
      T('tag', 21, 2, 8, 18, '{{asset.assetTag}}', 2.6, { rotate: 90, bold: true }),
    ],
  },
  {
    id: 'starter-barcode-50x30', name: 'Barcode with name, 50 x 30', widthMm: 50, heightMm: 30, stockId: 'pet-50x30',
    elements: [
      T('name', 3, 2, 44, 8, '{{asset.name}}', 3.2, { bold: true, maxLines: 2 }),
      { id: 'bc', kind: 'code', symbology: 'code128', value: '{{asset.assetTag}}', x: 3, y: 11, w: 44, h: 17, showText: true },
    ],
  },
  {
    id: 'starter-cable-25x38', name: 'Cable wrap, 25 x 38 + 40', widthMm: 25, heightMm: 38, tailMm: 40, stockId: 'pcable-25x38-40-white',
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 2.5, y: 2, w: 20, h: 20 },
      T('tag', 1.5, 24, 22, 4.5, '{{asset.assetTag}}', 3, { bold: true, align: 'center' }),
      T('name', 1.5, 29.5, 22, 7, '{{asset.name}}', 2.2, { align: 'center', maxLines: 2 }),
    ],
  },
  {
    id: 'starter-cable-30x45', name: 'Cable wrap, 30 x 45 + 50', widthMm: 30, heightMm: 45, tailMm: 50, stockId: 'pcable-30x45-50-white',
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 3, y: 2, w: 24, h: 24 },
      T('tag', 2, 28, 26, 5, '{{asset.assetTag}}', 3.4, { bold: true, align: 'center' }),
      T('name', 2, 34, 26, 9, '{{asset.name}}', 2.6, { align: 'center', maxLines: 3 }),
    ],
  },
];
