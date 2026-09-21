import type { Measure } from './render';

/** Browser-only helpers: text measuring, exact-size printing, and 1-bit PNG export. Not used on the server. */

/** Measures text with the real font so wrapping on the label matches what prints. Sizes are millimetres. */
export function canvasMeasure(fontFamily = 'Barlow, Arial, sans-serif'): Measure {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return (t, f, b) => t.length * f * (b ? 0.56 : 0.5);
  return (text, fontMm, bold) => {
    ctx.font = `${bold ? 700 : 400} 100px ${fontFamily}`;
    return (ctx.measureText(text).width / 100) * fontMm;
  };
}

export interface PrintPage { svg: string; widthMm: number; heightMm: number }

/**
 * Prints pages at their exact size through the browser's print dialog. Each SVG is vector, so the printer
 * driver rasterises at its own resolution. Set scale to 100% and margins to none in the dialog.
 */
export function printPages(pages: PrintPage[], title = 'Labels'): void {
  if (pages.length === 0) return;
  const { widthMm, heightMm } = pages[0];
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, '')}</title><style>
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0 }
    html, body { margin: 0; padding: 0; background: #fff }
    .p { width: ${widthMm}mm; height: ${heightMm}mm; overflow: hidden; break-after: page; page-break-after: always }
    .p:last-child { break-after: auto; page-break-after: auto }
    svg { display: block }
  </style></head><body>${pages.map(p => `<div class="p">${p.svg}</div>`).join('')}</body></html>`);
  doc.close();
  const win = frame.contentWindow!;
  const done = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', done);
  setTimeout(() => { win.focus(); win.print(); }, 250);
}

/** Renders one label to a black-and-white PNG at the printer's resolution, for use in a vendor app. */
export async function svgToMonoPng(svg: string, widthMm: number, heightMm: number, dpi: number): Promise<Blob> {
  const w = Math.round((widthMm * dpi) / 25.4);
  const h = Math.round((heightMm * dpi) / 25.4);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('The label could not be drawn.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2] < 140 ? 0 : 255;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v; data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    return await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('The image could not be saved.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
