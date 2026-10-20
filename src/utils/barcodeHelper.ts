import JsBarcode from 'jsbarcode';

export interface BarcodeRenderOptions {
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  font?: string;
  margin?: number;
  background?: string;
  lineColor?: string;
}

/**
 * Clean & validate barcode text for Code 128
 */
export function sanitizeBarcodeText(input: string): string {
  if (!input) return 'LAKHI-0001';
  // Strip control chars, keep printable ASCII
  const cleaned = input.trim().replace(/[^\x20-\x7E]/g, '');
  return cleaned || 'LAKHI-0001';
}

/**
 * Render barcode to an existing SVG element using JsBarcode
 */
export function renderBarcodeToSvg(
  svgElement: SVGSVGElement,
  text: string,
  options: BarcodeRenderOptions = {}
): boolean {
  try {
    const cleanText = sanitizeBarcodeText(text);
    JsBarcode(svgElement, cleanText, {
      format: options.format || 'CODE128',
      lineColor: options.lineColor || '#000000',
      width: options.width || 2,
      height: options.height || 60,
      displayValue: options.displayValue !== undefined ? options.displayValue : true,
      fontSize: options.fontSize || 14,
      font: options.font || 'monospace',
      margin: options.margin !== undefined ? options.margin : 8,
      background: options.background || '#ffffff',
    });
    return true;
  } catch (err) {
    console.warn('JsBarcode rendering error:', err);
    return false;
  }
}

/**
 * Render barcode to a high-DPI HTMLCanvasElement and return as PNG Blob
 */
export async function generateBarcodeBlob(
  text: string,
  options: BarcodeRenderOptions = {}
): Promise<Blob> {
  const cleanText = sanitizeBarcodeText(text);
  const canvas = document.createElement('canvas');

  JsBarcode(canvas, cleanText, {
    format: options.format || 'CODE128',
    lineColor: options.lineColor || '#000000',
    width: (options.width || 2) * 2, // 2x for sharp printing
    height: (options.height || 60) * 2,
    displayValue: options.displayValue !== undefined ? options.displayValue : true,
    fontSize: (options.fontSize || 14) * 2,
    font: options.font || 'monospace',
    margin: (options.margin !== undefined ? options.margin : 10) * 2,
    background: options.background || '#ffffff',
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create barcode blob'));
      }
    }, 'image/png');
  });
}

/**
 * Download the barcode directly as a PNG image file
 */
export async function downloadBarcodePng(
  text: string,
  filename?: string,
  options: BarcodeRenderOptions = {}
): Promise<void> {
  const blob = await generateBarcodeBlob(text, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `barcode-${sanitizeBarcodeText(text)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy barcode PNG image to the user's system clipboard
 */
export async function copyBarcodeImageToClipboard(
  text: string,
  options: BarcodeRenderOptions = {}
): Promise<boolean> {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error('ClipboardItem API not supported');
    }
    const blob = await generateBarcodeBlob(text, options);
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Failed to copy image to clipboard:', err);
    // Fallback: copy raw text
    try {
      await navigator.clipboard.writeText(sanitizeBarcodeText(text));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Share the barcode using the Web Share API (or fallback to download/copy)
 */
export async function shareBarcode(
  text: string,
  title?: string,
  options: BarcodeRenderOptions = {}
): Promise<{ success: boolean; method: 'native-share' | 'clipboard' | 'download' }> {
  const clean = sanitizeBarcodeText(text);
  const shareTitle = title || `Barcode: ${clean}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const blob = await generateBarcodeBlob(clean, options);
      const file = new File([blob], `barcode-${clean}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: `Product Internal Barcode: ${clean}`,
          files: [file],
        });
        return { success: true, method: 'native-share' };
      }

      await navigator.share({
        title: shareTitle,
        text: `Product Internal Barcode: ${clean}`,
      });
      return { success: true, method: 'native-share' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'native-share' };
      }
      console.warn('Web Share API error, falling back:', err);
    }
  }

  // Fallback to clipboard
  const copied = await copyBarcodeImageToClipboard(clean, options);
  if (copied) {
    return { success: true, method: 'clipboard' };
  }

  // Fallback to download
  await downloadBarcodePng(clean, undefined, options);
  return { success: true, method: 'download' };
}
