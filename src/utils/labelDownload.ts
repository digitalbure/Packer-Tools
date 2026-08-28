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
 * Clears printer-specific dynamic CSS stylesheets, removes lingering print iframes,
 * purges printer cache storage keys, and forces a layout reflow on print elements.
 */
export function clearPrinterCssCache(): { success: boolean; clearedCount: number } {
  let clearedCount = 0;

  try {
    // 1. Remove dynamically injected print style elements
    const dynamicStyles = document.querySelectorAll(
      'style[data-printer-cache], style[id*="print"], style[data-vite-dev-id*="print"], link[rel="stylesheet"][href*="print"]'
    );
    dynamicStyles.forEach(style => {
      style.remove();
      clearedCount++;
    });

    // 2. Remove lingering hidden print iframes or orphan print portals
    const orphanIframes = document.querySelectorAll(
      'iframe[id*="print"], iframe[name*="print"], iframe[src*="about:blank"]'
    );
    orphanIframes.forEach(iframe => {
      iframe.remove();
      clearedCount++;
    });

    // 3. Purge printer-specific CSS cache keys from localStorage / sessionStorage
    const storageKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('printer') || key.includes('print_css') || key.includes('avery_cache') || key.includes('label_studio_css'))) {
        storageKeys.push(key);
      }
    }
    storageKeys.forEach(key => {
      localStorage.removeItem(key);
      clearedCount++;
    });

    // 4. Force browser DOM layout reflow on print workspace containers
    const printNodes = document.querySelectorAll<HTMLElement>(
      '#studio-canvas-container, #label-studio-workspace-print-root, [id^="print-avery-page-"], [id^="print-roll-label-"]'
    );
    printNodes.forEach(node => {
      // Accessing offsetHeight forces synchronous DOM style & layout re-calculation
      void node.offsetHeight;
      node.style.transform = 'translateZ(0)';
      setTimeout(() => {
        node.style.transform = '';
      }, 30);
      clearedCount++;
    });

    // 5. Reset document print media override sheet if present
    const overrideSheet = document.getElementById('packer-printer-css-override-sheet');
    if (overrideSheet) {
      overrideSheet.remove();
      clearedCount++;
    }

    return { success: true, clearedCount };
  } catch (err) {
    console.warn('Printer CSS cache cleanup warning:', err);
    return { success: false, clearedCount };
  }
}

/**
 * Determines whether a given DOM node is an editor-only artifact that should be stripped
 * from label exports (PNG, JPG, PDF, SVG).
 * NOTE: Crop & trim marks are the explicit exception and MUST be preserved in the export.
 */
export function isEditorOverlayNode(node: Node): boolean {
  if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
    return false;
  }
  const el = node as HTMLElement;
  if (el.dataset?.editorOnly === 'true') {
    return true;
  }
  const classStr = typeof el.className === 'string' ? el.className : (el.getAttribute?.('class') || '');
  
  // Crop marks MUST NOT be filtered out (they are the explicit exception for cutting/trimming)
  if (classStr.includes('crop-marks') || classStr.includes('crop-mark')) {
    return false;
  }
  
  if (
    classStr.includes('editor-grid-overlay') ||
    classStr.includes('editor-guides-overlay') ||
    classStr.includes('selection-overlay') ||
    classStr.includes('selection-handle') ||
    classStr.includes('studio-editor-only') ||
    classStr.includes('editor-only') ||
    classStr.includes('cut-guide-indicator') ||
    classStr.includes('transform-handle')
  ) {
    return true;
  }
  return false;
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
    filter: (node: Node) => {
      // Exclude selection borders, resize handles, grids, guides, or editor-only elements
      return !isEditorOverlayNode(node);
    },
  };

  const captureFn = async () => {
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
  };

  try {
    await captureFn();
  } catch (err) {
    console.warn('Initial label export failed. Automatically clearing printer CSS cache and retrying layout render...', err);
    clearPrinterCssCache();
    await new Promise(res => setTimeout(res, 150));
    // Retry once after cache purge & layout reflow
    await captureFn();
  }
}

/**
 * Creates a multi-page PDF containing all label or sheet page elements
 */
export async function downloadBatchLabelsPdf(
  elements: HTMLElement[],
  filename = 'batch-labels',
  widthMm = 50,
  heightMm = 50,
  scale = 3,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (elements.length === 0) return;

  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  const sanitizeName = filename.replace(/[^a-z0-9_-]/gi, '_');
  const targetPxWidth = Math.round(widthMm * 3.78);
  const targetPxHeight = Math.round(heightMm * 3.78);

  const processPages = async () => {
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (onProgress) {
        onProgress(i + 1, elements.length);
      }

      const dataUrl = await toPng(el, {
        pixelRatio: scale,
        backgroundColor: '#ffffff',
        quality: 0.95,
        cacheBust: true,
        width: targetPxWidth,
        height: targetPxHeight,
        style: {
          width: `${targetPxWidth}px`,
          height: `${targetPxHeight}px`,
          transform: 'scale(1)',
          transformOrigin: 'top left',
          boxShadow: 'none',
          border: 'none',
        },
        filter: (node: Node) => {
          return !isEditorOverlayNode(node);
        },
      });

      if (i > 0) {
        pdf.addPage([widthMm, heightMm], orientation);
      }

      pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    }
    pdf.save(`${sanitizeName}.pdf`);
  };

  try {
    await processPages();
  } catch (err) {
    console.warn('Batch PDF capture failed. Clearing printer CSS cache and retrying layout render...', err);
    clearPrinterCssCache();
    await new Promise(res => setTimeout(res, 200));
    await processPages();
  }
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
