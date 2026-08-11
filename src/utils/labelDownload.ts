import { toPng, toJpeg, toSvg } from 'html-to-image';
import jsPDF from 'jspdf';

export type LabelExportFormat = 'png' | 'jpg' | 'pdf' | 'svg';

export interface LabelExportOptions {
  filename?: string;
  format: LabelExportFormat;
  scale?: number; // 1x, 2x (150 DPI), 3x (300 DPI), 4x (600 DPI)
  backgroundColor?: string;
  widthMm?: number;
  heightMm?: number;
  quality?: number;
}

/**
 * Downloads a DOM element (label container) in PNG, JPG, PDF, or SVG format.
 */
export async function downloadLabelFromElement(
  element: HTMLElement,
  options: LabelExportOptions
): Promise<void> {
  const {
    filename = 'label-design',
    format = 'png',
    scale = 3,
    backgroundColor = '#ffffff',
    widthMm = 50,
    heightMm = 50,
    quality = 0.95,
  } = options;

  const sanitizeName = filename.replace(/[^a-z0-9_-]/gi, '_');

  // Calculate exact target px dimensions based on physical mm (3.78px per mm)
  const pxWidth = widthMm ? Math.round(widthMm * 3.78) : element.clientWidth;
  const pxHeight = heightMm ? Math.round(heightMm * 3.78) : element.clientHeight;

  // html-to-image capture options
  const captureOptions = {
    width: pxWidth,
    height: pxHeight,
    pixelRatio: scale,
    style: {
      width: `${pxWidth}px`,
      height: `${pxHeight}px`,
      transform: 'scale(1)',
      transformOrigin: 'top left',
      boxShadow: 'none',
      border: 'none',
    },
    backgroundColor: format === 'png' ? (backgroundColor === 'transparent' ? undefined : backgroundColor) : '#ffffff',
    quality,
    cacheBust: true,
    filter: (node: HTMLElement) => {
      // Exclude selection borders, resize handles, or editor-only elements
      if (node.classList) {
        if (
          node.classList.contains('editor-grid-overlay') ||
          node.classList.contains('selection-handle') ||
          node.classList.contains('cut-guide-indicator')
        ) {
          return false;
        }
      }
      return true;
    },
  };

  if (format === 'svg') {
    const dataUrl = await toSvg(element, captureOptions);
    triggerDownload(dataUrl, `${sanitizeName}.svg`);
    return;
  }

  if (format === 'png') {
    const dataUrl = await toPng(element, captureOptions);
    triggerDownload(dataUrl, `${sanitizeName}.png`);
    return;
  }

  if (format === 'jpg') {
    const dataUrl = await toJpeg(element, captureOptions);
    triggerDownload(dataUrl, `${sanitizeName}.jpg`);
    return;
  }

  if (format === 'pdf') {
    // Generate high resolution PNG data URL for embedding into PDF
    const dataUrl = await toPng(element, captureOptions);

    const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [widthMm, heightMm],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    pdf.save(`${sanitizeName}.pdf`);
    return;
  }
}

/**
 * Creates a multi-page PDF containing all label elements
 */
export async function downloadBatchLabelsPdf(
  elements: HTMLElement[],
  filename = 'batch-labels',
  widthMm = 50,
  heightMm = 50,
  scale = 3
): Promise<void> {
  if (elements.length === 0) return;

  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  const sanitizeName = filename.replace(/[^a-z0-9_-]/gi, '_');

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const dataUrl = await toPng(el, {
      pixelRatio: scale,
      backgroundColor: '#ffffff',
      quality: 0.95,
      cacheBust: true,
    });

    if (i > 0) {
      pdf.addPage([widthMm, heightMm], orientation);
    }

    pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
  }

  pdf.save(`${sanitizeName}.pdf`);
}

/**
 * Trigger browser file download via link element
 */
function triggerDownload(dataUrl: string, fullFilename: string) {
  const link = document.createElement('a');
  link.download = fullFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
