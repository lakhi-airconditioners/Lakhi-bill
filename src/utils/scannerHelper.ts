import jsQR from 'jsqr';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from '@zxing/library';

// Setup ZXing hints for all common 1D barcodes and 2D QR codes
const hints = new Map<DecodeHintType, any>();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.DATA_MATRIX,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

let multiFormatReader: MultiFormatReader | null = null;

function getReader(): MultiFormatReader {
  if (!multiFormatReader) {
    multiFormatReader = new MultiFormatReader();
    multiFormatReader.setHints(hints);
  }
  return multiFormatReader;
}

/**
 * Scan an HTMLCanvasElement for any 1D barcode or 2D QR code
 */
export async function scanCanvasForCodes(
  canvas: HTMLCanvasElement
): Promise<{ text: string; format: string } | null> {
  // 1. Try Native BarcodeDetector if supported by the browser (fast hardware decode)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const detector = new BarcodeDetectorClass({
        formats: [
          'qr_code',
          'code_128',
          'code_39',
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'data_matrix',
        ],
      });
      const barcodes = await detector.detect(canvas);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return {
          text: barcodes[0].rawValue,
          format: barcodes[0].format || 'BARCODE/QR',
        };
      }
    } catch {
      // Fall through to ZXing
    }
  }

  // 2. Try ZXing MultiFormat Reader on Canvas Pixel Data (handles 1D barcodes and 2D QR codes)
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const luminanceSource = new RGBLuminanceSource(
        imgData.data,
        imgData.width,
        imgData.height
      );
      const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
      const reader = getReader();
      const result = reader.decode(binaryBitmap);
      if (result && result.getText()) {
        return {
          text: result.getText(),
          format: result.getBarcodeFormat() ? String(result.getBarcodeFormat()) : 'BARCODE',
        };
      }
    } catch {
      // ZXing throws NotFoundException when frame has no code, which is normal
    }

    // 3. Try jsQR for 2D QR codes (fast and robust for mobile QR codes)
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (qr && qr.data) {
        return {
          text: qr.data,
          format: 'QR_CODE',
        };
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Scan an HTMLImageElement (e.g. from file upload)
 */
export async function scanImageForCodes(
  img: HTMLImageElement
): Promise<{ text: string; format: string } | null> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  return scanCanvasForCodes(canvas);
}
