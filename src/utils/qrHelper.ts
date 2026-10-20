import QRCode from 'qrcode';

export interface QrRenderOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Clean & validate text/code for QR generation
 */
export function sanitizeQrText(input: string): string {
  if (!input) return 'LAKHI-0001';
  return input.trim() || 'LAKHI-0001';
}

/**
 * Render QR code directly to an HTMLCanvasElement
 */
export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options: QrRenderOptions = {}
): Promise<boolean> {
  try {
    const cleanText = sanitizeQrText(text);
    await QRCode.toCanvas(canvas, cleanText, {
      width: options.width || 180,
      margin: options.margin !== undefined ? options.margin : 1,
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#ffffff',
      },
    });
    return true;
  } catch (err) {
    console.warn('QR code rendering to canvas failed:', err);
    return false;
  }
}

/**
 * Generate QR code as high-resolution PNG Blob for printing / downloading / sharing
 */
export async function generateQrBlob(
  text: string,
  options: QrRenderOptions = {}
): Promise<Blob> {
  const cleanText = sanitizeQrText(text);
  const dataUrl = await QRCode.toDataURL(cleanText, {
    width: (options.width || 240) * 2, // 2x high-DPI for print clarity
    margin: options.margin !== undefined ? options.margin : 1,
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    color: {
      dark: options.color?.dark || '#000000',
      light: options.color?.light || '#ffffff',
    },
  });

  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Download the QR code directly as a PNG image file
 */
export async function downloadQrPng(
  text: string,
  filename?: string,
  options: QrRenderOptions = {}
): Promise<void> {
  const blob = await generateQrBlob(text, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `qrcode-${sanitizeQrText(text).replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy QR code PNG image to user's clipboard
 */
export async function copyQrImageToClipboard(
  text: string,
  options: QrRenderOptions = {}
): Promise<boolean> {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error('ClipboardItem API not supported');
    }
    const blob = await generateQrBlob(text, options);
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Failed to copy QR image to clipboard:', err);
    try {
      await navigator.clipboard.writeText(sanitizeQrText(text));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Share the QR code using Web Share API (or fallback to download/copy)
 */
export async function shareQrCode(
  text: string,
  title?: string,
  options: QrRenderOptions = {}
): Promise<{ success: boolean; method: 'native-share' | 'clipboard' | 'download' }> {
  const clean = sanitizeQrText(text);
  const shareTitle = title || `Product QR Code: ${clean}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const blob = await generateQrBlob(clean, options);
      const safeFilename = `qr-${clean.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      const file = new File([blob], safeFilename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: `Product Internal QR: ${clean}`,
          files: [file],
        });
        return { success: true, method: 'native-share' };
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { success: false, method: 'native-share' };
      }
      console.warn('Native share failed, falling back:', e);
    }
  }

  // Fallback: Copy to clipboard or download
  const copied = await copyQrImageToClipboard(clean, options);
  if (copied) {
    return { success: true, method: 'clipboard' };
  }

  await downloadQrPng(clean, undefined, options);
  return { success: true, method: 'download' };
}

export interface StickerSheetItem {
  id?: string;
  code: string;
  label?: string;
  sublabel?: string;
}

export interface StickerSheetOptions {
  columns: number;
  qrSize: number;
  gapSize: 'sm' | 'md' | 'lg';
  showCutLines: boolean;
  showCodeText: boolean;
  showProductMetaSubtext: boolean;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generate a combined high-resolution image of ALL stickers in the sheet layout
 * This ensures that Copy, Share, and Download save ALL stickers, not just one.
 */
export async function generateCombinedStickerSheetBlob(
  items: StickerSheetItem[],
  options: StickerSheetOptions
): Promise<Blob> {
  if (items.length === 0) {
    return generateQrBlob('EMPTY', { width: options.qrSize });
  }

  const cols = Math.max(1, Math.min(options.columns, items.length));
  const rows = Math.ceil(items.length / cols);

  const gap = options.gapSize === 'sm' ? 12 : options.gapSize === 'md' ? 20 : 28;
  const padding = 16;

  // Single sticker dimensions
  const stickerW = options.qrSize + 40;
  let stickerH = options.qrSize + 30;
  if (options.showProductMetaSubtext) stickerH += 30;
  if (options.showCodeText) stickerH += 22;

  const totalWidth = padding * 2 + cols * stickerW + (cols - 1) * gap;
  const totalHeight = padding * 2 + rows * stickerH + (rows - 1) * gap;

  const scale = 2; // 2x high DPI
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create 2D canvas context');

  ctx.scale(scale, scale);

  // Background pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Render each sticker
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const c = idx % cols;
    const r = Math.floor(idx / cols);

    const x = padding + c * (stickerW + gap);
    const y = padding + r * (stickerH + gap);

    // Sticker card container border / cut lines
    if (options.showCutLines) {
      ctx.save();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, stickerW, stickerH);

      // Scissor badge
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, y - 6, 52, 12);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 8, y - 6, 52, 12);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`✂ cut #${idx + 1}`, x + 12, y + 3);
      ctx.restore();
    } else {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, stickerW, stickerH);
    }

    let curY = y + 10;

    // Optional top product label
    if (options.showProductMetaSubtext && item.label) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const truncatedLabel = item.label.length > 22 ? item.label.slice(0, 20) + '...' : item.label;
      ctx.fillText(truncatedLabel, x + stickerW / 2, curY + 4);
      curY += 16;
    }

    // QR Code Graphic
    const qrCanvas = document.createElement('canvas');
    await renderQrToCanvas(qrCanvas, item.code, {
      width: options.qrSize,
      margin: 1,
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    });

    const qrX = x + (stickerW - options.qrSize) / 2;
    ctx.drawImage(qrCanvas, qrX, curY, options.qrSize, options.qrSize);
    curY += options.qrSize + 4;

    // Code text below QR
    if (options.showCodeText) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(item.code, x + stickerW / 2, curY + 8);
      curY += 14;
    }

    // Sublabel (brand / model)
    if (options.showProductMetaSubtext && item.sublabel) {
      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      const truncatedSub = item.sublabel.length > 24 ? item.sublabel.slice(0, 22) + '...' : item.sublabel;
      ctx.fillText(truncatedSub, x + stickerW / 2, curY + 6);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate sheet image blob'));
    }, 'image/png');
  });
}

/**
 * Print stickers directly using an isolated, clean print iframe
 * This guarantees:
 * 1. Zero blank pages (iframe has positive dimensions, images are confirmed loaded before print)
 * 2. Works seamlessly with Mini Thermal Roll Printers (58mm / 80mm) and standard A4
 * 3. Never leaks modal background or UI elements
 */
export async function printStickersDirectly(
  items: StickerSheetItem[],
  options: StickerSheetOptions
): Promise<void> {
  if (items.length === 0) return;

  // Generate high-resolution data URLs for all QR codes
  const qrDataUrls: string[] = [];
  for (const it of items) {
    const url = await QRCode.toDataURL(sanitizeQrText(it.code), {
      width: Math.max(160, options.qrSize * 2),
      margin: 1,
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    qrDataUrls.push(url);
  }

  // Create isolated offscreen iframe with POSITIVE dimensions
  // NOTE: Zero width/height causes Chromium print engine to render blank pages!
  const isThermal = options.columns === 1;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = isThermal ? '320px' : '820px';
  iframe.style.height = '1000px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print QR Stickers - Lakhi Store</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          body {
            width: ${isThermal ? '58mm' : '100%'};
            max-width: ${isThermal ? '58mm' : '100%'};
            margin: 0 auto;
            padding: ${isThermal ? '1.5mm 1mm' : '4mm'};
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(${options.columns}, minmax(0, 1fr));
            gap: ${options.gapSize === 'sm' ? '6px' : options.gapSize === 'md' ? '12px' : '18px'};
            width: 100%;
          }
          .sticker-card {
            border: ${options.showCutLines ? '1.5px dashed #000000' : '1px solid #d1d5db'};
            border-radius: 6px;
            padding: 6px 4px;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            page-break-inside: avoid;
            break-inside: avoid;
            position: relative;
            margin-bottom: ${isThermal ? '4px' : '0'};
          }
          .cut-badge {
            position: absolute;
            top: -6px;
            left: 6px;
            background: #ffffff;
            border: 1px solid #000000;
            border-radius: 3px;
            padding: 0 3px;
            font-size: 7.5px;
            font-weight: 800;
            font-family: monospace;
            line-height: 1.2;
          }
          .meta-title {
            font-size: 9.5px;
            font-weight: 800;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-bottom: 3px;
            line-height: 1.2;
          }
          .qr-img {
            width: ${Math.min(options.qrSize, isThermal ? 130 : 160)}px;
            height: ${Math.min(options.qrSize, isThermal ? 130 : 160)}px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
          }
          .code-label {
            font-family: monospace;
            font-size: 10.5px;
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-top: 3px;
            word-break: break-all;
            line-height: 1.2;
          }
          .meta-sub {
            font-size: 8.5px;
            color: #334155;
            margin-top: 1.5px;
            line-height: 1.2;
          }
        </style>
      </head>
      <body>
        <div class="grid">
          ${items
            .map(
              (it, i) => `
            <div class="sticker-card">
              ${options.showCutLines ? `<div class="cut-badge">✂ #${i + 1}</div>` : ''}
              ${options.showProductMetaSubtext && it.label ? `<div class="meta-title">${it.label}</div>` : ''}
              <img class="qr-img" src="${qrDataUrls[i]}" alt="${it.code}" />
              ${options.showCodeText ? `<div class="code-label">${it.code}</div>` : ''}
              ${options.showProductMetaSubtext && it.sublabel ? `<div class="meta-sub">${it.sublabel}</div>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Wait for all QR images to be fully loaded and rendered before opening print dialog
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3500);
    }
  };

  const images = Array.from(doc.images);
  if (images.length === 0) {
    setTimeout(triggerPrint, 250);
  } else {
    let loaded = 0;
    const onImgDone = () => {
      loaded++;
      if (loaded >= images.length) {
        setTimeout(triggerPrint, 200);
      }
    };
    images.forEach((img) => {
      if (img.complete) {
        onImgDone();
      } else {
        img.onload = onImgDone;
        img.onerror = onImgDone;
      }
    });
  }
}

