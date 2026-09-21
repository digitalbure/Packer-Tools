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
  { id: 'tag-50x20', name: 'Ownership tag 50 x 20 mm', group: 'tag', material: 'Any', colour: 'White', widthMm: 50, heightMm: 20 },
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
    id: 'starter-asset-50x30', name: 'Asset tag with QR, 50 x 30', widthMm: 50, heightMm: 30, stockId: 'pp-50x30', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 2, y: 4, w: 22, h: 22 },
      T('name', 26, 3, 22, 12, '{{asset.name}}', 3.2, { bold: true, maxLines: 3 }),
      T('tag', 26, 20, 22, 4, '{{asset.assetTag}}', 3),
    ],
  },
  {
    id: 'starter-asset-40x30', name: 'Asset tag with QR, 40 x 30', widthMm: 40, heightMm: 30, stockId: 'pp-40x30', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 1.5, y: 4, w: 22, h: 22 },
      T('tag', 25, 3, 14, 24, '{{asset.assetTag}}', 2.8, { rotate: 90, bold: true }),
    ],
  },
  {
    id: 'starter-small-30x22', name: 'Small tag with QR, 30 x 22', widthMm: 30, heightMm: 22, stockId: 'pet-30x22', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 1.5, y: 1.5, w: 16, h: 16, ecc: 'L' },
      T('tag', 21, 1.5, 8, 16, '{{asset.assetTag}}', 2.6, { rotate: 90, bold: true }),
    ],
  },
  {
    id: 'starter-barcode-50x30', name: 'Barcode with name, 50 x 30', widthMm: 50, heightMm: 30, stockId: 'pet-50x30', brandFooter: true,
    elements: [
      T('name', 3, 2, 44, 8, '{{asset.name}}', 3.2, { bold: true, maxLines: 2 }),
      { id: 'bc', kind: 'code', symbology: 'code128', value: '{{asset.assetTag}}', x: 3, y: 11, w: 44, h: 14, showText: true },
    ],
  },
  {
    id: 'starter-cable-25x38', name: 'Cable wrap, 25 x 38 + 40', widthMm: 25, heightMm: 38, tailMm: 40, stockId: 'pcable-25x38-40-white', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 2.5, y: 2, w: 20, h: 20 },
      T('tag', 1.5, 24, 22, 4.5, '{{asset.assetTag}}', 3, { bold: true, align: 'center' }),
      T('name', 1.5, 29.5, 22, 6, '{{asset.name}}', 2.2, { align: 'center', maxLines: 2 }),
    ],
  },
  {
    id: 'starter-cable-30x45', name: 'Cable wrap, 30 x 45 + 50', widthMm: 30, heightMm: 45, tailMm: 50, stockId: 'pcable-30x45-50-white', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 3, y: 2, w: 24, h: 24 },
      T('tag', 2, 28, 26, 5, '{{asset.assetTag}}', 3.4, { bold: true, align: 'center' }),
      T('name', 2, 34, 26, 7.5, '{{asset.name}}', 2.6, { align: 'center', maxLines: 2 }),
    ],
  },
  {
    // Based on the owner's photographed asset tag: QR and large ID on the left, PROPERTY OF and the owner on the right.
    id: 'starter-property-50x20', name: 'Property of, 50 x 20', widthMm: 50, heightMm: 20, stockId: 'tag-50x20', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 1.5, y: 1.2, w: 14, h: 14, ecc: 'L' },
      T('id', 1.5, 15.4, 24, 4, '{{asset.assetTag}}', 3.2, { bold: true }),
      T('lead', 24, 2, 24.5, 3.5, 'PROPERTY OF', 2.6, { bold: true, align: 'right' }),
      T('owner', 24, 6, 24.5, 9.5, '{{owner.name}}', 2.6, { align: 'right', maxLines: 3 }),
    ],
  },
  {
    id: 'starter-property-50x30', name: 'Property of, 50 x 30', widthMm: 50, heightMm: 30, stockId: 'pp-50x30', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 2, y: 2.5, w: 18, h: 18 },
      T('id', 2, 21, 22, 4.5, '{{asset.assetTag}}', 3.6, { bold: true }),
      T('lead', 22, 3, 26, 4, 'PROPERTY OF', 3, { bold: true, align: 'right' }),
      T('owner', 22, 8, 26, 14, '{{owner.name}}', 3, { align: 'right', maxLines: 4 }),
    ],
  },
  {
    id: 'starter-property-40x30', name: 'Property of, 40 x 30', widthMm: 40, heightMm: 30, stockId: 'pp-40x30', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 2, y: 2, w: 16, h: 16, ecc: 'L' },
      T('id', 2, 19.5, 20, 4, '{{asset.assetTag}}', 3, { bold: true }),
      T('lead', 19, 2.5, 19.5, 3.5, 'PROPERTY OF', 2.4, { bold: true, align: 'right' }),
      T('owner', 19, 6.5, 19.5, 12, '{{owner.name}}', 2.4, { align: 'right', maxLines: 4 }),
    ],
  },
  {
    id: 'starter-return-50x30', name: 'If found, return to, 50 x 30', widthMm: 50, heightMm: 30, stockId: 'pp-50x30', brandFooter: true,
    elements: [
      T('lead', 2, 2, 29, 4, 'IF FOUND, RETURN TO', 2.6, { bold: true }),
      T('owner', 2, 6.5, 29, 10, '{{owner.name}}', 3, { bold: true, maxLines: 3 }),
      T('phone', 2, 17, 29, 4, '{{owner.phone}}', 2.8),
      T('email', 2, 21, 29, 3.5, '{{owner.email}}', 2.4),
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 32, y: 3, w: 16, h: 16, ecc: 'L' },
      T('id', 32, 20, 16, 4, '{{asset.assetTag}}', 2.6, { bold: true, align: 'center' }),
    ],
  },
  {
    id: 'starter-case-76x51', name: 'Case label, 76 x 51', widthMm: 76.2, heightMm: 50.8, stockId: 'case-76x51', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 3, y: 3, w: 30, h: 30 },
      T('name', 36, 3, 37, 16, '{{asset.name}}', 5, { bold: true, maxLines: 3 }),
      T('id', 36, 21, 37, 8, '{{asset.assetTag}}', 5.5, { bold: true }),
      T('lead', 3, 36, 30, 4, 'PROPERTY OF', 3, { bold: true }),
      T('owner', 3, 40, 70, 5, '{{owner.name}}', 3.6),
      T('phone', 3, 44.5, 50, 4, '{{owner.phone}}', 3),
    ],
  },
  {
    id: 'starter-flight-100x150', name: 'Flight case label, 100 x 150', widthMm: 101.6, heightMm: 152.4, stockId: 'flight-100x150', brandFooter: true,
    elements: [
      { id: 'qr', kind: 'code', symbology: 'qr', value: '{{asset.url}}', x: 10, y: 8, w: 60, h: 60 },
      T('id', 10, 72, 82, 20, '{{asset.assetTag}}', 16, { bold: true }),
      T('name', 10, 96, 82, 18, '{{asset.name}}', 7, { bold: true, maxLines: 2 }),
      T('lead', 10, 120, 82, 6, 'PROPERTY OF', 4, { bold: true }),
      T('owner', 10, 127, 82, 10, '{{owner.name}}', 5.5),
      T('phone', 10, 138, 82, 8, '{{owner.phone}}', 4.5),
    ],
  },
];
