/**
 * Printer profiles. Status is only "recommended" after a printer has passed hands-on testing here.
 * Transport status is "works" only when it was tested end to end; "untested" and "planned" say what is not proven.
 */
export type Transport = 'browser-print' | 'image-export' | 'web-bluetooth' | 'web-usb' | 'network-raw' | 'vendor-app';
export type TransportStatus = 'works' | 'untested' | 'planned';
export type PrinterStatus = 'recommended' | 'in-testing' | 'planned' | 'generic';

export interface PrinterProfile {
  id: string;
  name: string;
  kind: 'sheet' | 'roll' | 'handheld';
  dpiOptions: number[];
  maxWidthMm?: number;
  languages: string[];
  transports: { type: Transport; status: TransportStatus }[];
  status: PrinterStatus;
  notes: string;
}

export const PRINTERS: PrinterProfile[] = [
  {
    id: 'sheet-any', name: 'Any printer: label sheets or plain paper', kind: 'sheet', dpiOptions: [300, 600], languages: [],
    transports: [{ type: 'browser-print', status: 'untested' }],
    status: 'generic',
    notes: 'Prints A4 or Letter pages through the browser. Includes a cut-and-tape layout for plain paper.',
  },
  {
    id: 'roll-any', name: 'Any roll printer with a system driver', kind: 'roll', dpiOptions: [203, 300], languages: [],
    transports: [{ type: 'browser-print', status: 'untested' }, { type: 'image-export', status: 'untested' }],
    status: 'generic',
    notes: 'Prints one label per page at the exact label size through the printer driver.',
  },
  {
    id: 'detonger-dt60plus', name: 'DETONGER DT60PLUS (2 inch, 300 dpi)', kind: 'handheld', dpiOptions: [300], maxWidthMm: 50.8, languages: [],
    transports: [
      { type: 'browser-print', status: 'untested' },
      { type: 'image-export', status: 'untested' },
      { type: 'vendor-app', status: 'untested' },
      { type: 'web-bluetooth', status: 'planned' },
    ],
    status: 'in-testing',
    notes: 'Thermal transfer, 2 inch, 300 dpi. In testing: printing through the printer driver and saving images should work. Direct Bluetooth printing is planned.',
  },
  { id: 'zebra-zd', name: 'Zebra ZD series', kind: 'roll', dpiOptions: [203, 300], languages: ['ZPL'], transports: [{ type: 'browser-print', status: 'untested' }, { type: 'network-raw', status: 'planned' }], status: 'planned', notes: 'Direct ZPL printing is planned.' },
  { id: 'brother-ql', name: 'Brother QL series', kind: 'roll', dpiOptions: [300], languages: ['Brother raster'], transports: [{ type: 'browser-print', status: 'untested' }], status: 'planned', notes: 'Direct printing is planned.' },
  { id: 'dymo-lw', name: 'DYMO LabelWriter', kind: 'roll', dpiOptions: [300], languages: [], transports: [{ type: 'browser-print', status: 'untested' }], status: 'planned', notes: 'Direct printing is planned.' },
];

export const recommendedPrinters = () => PRINTERS.filter(p => p.status === 'recommended');
export const getPrinter = (id: string) => PRINTERS.find(p => p.id === id);
