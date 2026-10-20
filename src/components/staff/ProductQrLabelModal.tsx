import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, QrCode, Copy, Check, Share2, Download, Tag } from 'lucide-react';
import { InventoryItem } from '../../types';
import { renderQrToCanvas } from '../../utils/qrHelper';

interface ProductQrLabelModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onOpenBarcode?: () => void;
}

export const ProductQrLabelModal: React.FC<ProductQrLabelModalProps> = ({ item, onClose, onOpenBarcode }) => {
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isAc = (item?.type || '').toUpperCase() === 'AC';
  const stockIdValue = item
    ? item.stockId || `${item.brand.slice(0, 3).toUpperCase()}-${item.modelNo.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${item.serialNo ? item.serialNo.slice(-4) : '01'}`
    : '';

  // Structured payload for label QR containing specific stockId
  const qrPayload = item
    ? JSON.stringify({
        stockId: stockIdValue,
        name: item.name,
        modelNo: item.modelNo,
        brand: item.brand,
        type: item.type,
        serialNo: item.serialNo || item.id,
        indoorUnitSerial: isAc ? (item.indoorUnitSerial || item.serialNo) : undefined,
        outdoorUnitSerial: isAc ? item.outdoorUnitSerial : undefined,
        price: item.sellingPrice,
        id: item.id,
      })
    : '';

  useEffect(() => {
    if (!item || !canvasRef.current) return;
    renderQrToCanvas(canvasRef.current, qrPayload, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }, [item, qrPayload]);

  if (!item) return null;

  // Generate high-resolution full tag card image as PNG Blob
  const generateTagBlob = async (): Promise<Blob> => {
    const width = 360;
    const height = 440;
    const scale = 2; // high-DPI
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas 2d context');

    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.setLineDash([]);

    // Brand header
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAKHI AIRCONDITIONERS • IN-STORE STOCK TAG', width / 2, 32);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 42);
    ctx.lineTo(width - 18, 42);
    ctx.stroke();

    // Stock ID badge
    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(20, 52, 160, 22);
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Stock ID: ${stockIdValue}`, 26, 67);

    // Price
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`₹${item.sellingPrice.toLocaleString('en-IN')}`, width - 20, 68);

    // QR Image
    if (canvasRef.current) {
      const qrSize = 160;
      const qrX = (width - qrSize) / 2;
      ctx.drawImage(canvasRef.current, qrX, 86, qrSize, qrSize);
    }

    // Product Meta
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(item.name.slice(0, 34), 20, 275);

    ctx.fillStyle = '#475569';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Model: ${item.modelNo}  •  Brand: ${item.brand}`, 20, 298);

    // AC Serials vs Standard Serial (If AC, only Indoor and Outdoor serials)
    ctx.font = 'bold 10px monospace';
    if (isAc) {
      ctx.fillStyle = '#1e293b';
      const iduInfo = `IDU: ${item.indoorModelNo ? `[${item.indoorModelNo}] ` : ''}SN:${item.indoorUnitSerial || item.serialNo || '-'}`;
      const oduInfo = `ODU: ${item.outdoorModelNo ? `[${item.outdoorModelNo}] ` : ''}SN:${item.outdoorUnitSerial || '-'}`;
      ctx.fillText(iduInfo, 20, 324);
      ctx.fillText(oduInfo, 20, 342);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillText(`Carton Serial No: ${item.serialNo || item.id}`, 20, 324);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Scan with Lakhi App or Camera for Verified Details', width / 2, height - 20);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create tag blob'));
      }, 'image/png');
    });
  };

  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '360px';
    iframe.style.height = '800px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const qrDataUrl = canvasRef.current?.toDataURL('image/png') || '';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Stock Tag - ${stockIdValue}</title>
          <style>
            @page { size: auto; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              height: auto !important;
              overflow: visible !important;
            }
            body {
              padding: 2mm;
              max-width: 72mm;
              margin: 0 auto;
            }
            .tag {
              width: 100%;
              border: 1.5px dashed #000;
              border-radius: 8px;
              padding: 8px 6px;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .brand-head {
              font-size: 9px;
              font-weight: 900;
              color: #dc2626;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 2px;
              margin-bottom: 4px;
            }
            .qr-wrap {
              display: flex;
              justify-content: center;
              margin: 4px 0;
            }
            .qr-img {
              width: 140px;
              height: 140px;
              object-fit: contain;
              display: block;
              margin: 0 auto;
            }
            .meta {
              font-size: 10px;
              text-align: left;
              margin-top: 4px;
            }
            .stock-badge {
              background: #fee2e2;
              color: #991b1b;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: monospace;
              font-weight: 900;
              font-size: 11px;
              display: inline-block;
            }
            .price {
              color: #047857;
              font-weight: 900;
              font-size: 12px;
              float: right;
            }
          </style>
        </head>
        <body>
          <div class="tag">
            <div class="brand-head">LAKHI AIRCONDITIONERS • IN-STORE STOCK TAG</div>
            <div class="meta" style="margin-bottom: 4px;">
              <span class="stock-badge">Stock ID: ${stockIdValue}</span>
              <span class="price">₹${item.sellingPrice.toLocaleString('en-IN')}</span>
            </div>
            <div class="qr-wrap">
              <img class="qr-img" src="${qrDataUrl}" alt="${stockIdValue}" />
            </div>
            <div class="meta">
              <div style="font-weight: 900; font-size: 11px; margin: 2px 0;">${item.name}</div>
              <div style="color: #475569; font-size: 9.5px;">
                <span>Model: <strong style="color: #000;">${item.modelNo}</strong></span> &bull; 
                <span>Brand: <strong style="color: #000;">${item.brand}</strong></span>
              </div>
              <div style="margin-top: 3px; font-family: monospace; font-size: 9.5px; color: #334155;">
                ${
                  isAc
                    ? `<div>Indoor: <strong>${item.indoorModelNo ? `[${item.indoorModelNo}] ` : ''}${item.indoorUnitSerial || item.serialNo || '-'}</strong></div>
                       <div>Outdoor: <strong>${item.outdoorModelNo ? `[${item.outdoorModelNo}] ` : ''}${item.outdoorUnitSerial || '-'}</strong></div>`
                    : `<div>SN: <strong>${item.serialNo || item.id}</strong></div>`
                }
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

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
        }, 3000);
      }
    };

    const img = doc.images[0];
    if (img && !img.complete) {
      img.onload = () => setTimeout(triggerPrint, 150);
      img.onerror = () => setTimeout(triggerPrint, 150);
    } else {
      setTimeout(triggerPrint, 200);
    }
  };

  // SHARE TAG (Web Share API with image file fallback)
  const handleShareTag = async () => {
    setIsSharing(true);
    setShareFeedback('Preparing tag image...');
    try {
      const blob = await generateTagBlob();
      const filename = `stock-tag-${stockIdValue}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Lakhi Store Tag: ${item.name}`,
          text: `Product Stock Tag for ${item.name} (${stockIdValue})`,
          files: [file],
        });
        setShareFeedback('✓ Shared successfully!');
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShareFeedback('✓ Downloaded tag image!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
        setShareFeedback('Failed to share: ' + (err.message || 'Unknown error'));
      } else {
        setShareFeedback(null);
      }
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  // DOWNLOAD TAG PNG
  const handleDownloadTag = async () => {
    setIsDownloading(true);
    try {
      const blob = await generateTagBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-tag-${stockIdValue}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download tag failed:', err);
      alert('Error downloading tag: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // COPY TAG IMAGE TO CLIPBOARD
  const handleCopyTagImage = async () => {
    try {
      const blob = await generateTagBlob();
      if (navigator.clipboard && window.ClipboardItem) {
        const ci = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([ci]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      } else {
        navigator.clipboard.writeText(qrPayload);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('Clipboard image copy failed, copying payload text:', err);
      navigator.clipboard.writeText(qrPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 my-4">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Product Stock Tag</h3>
              <p className="text-[10px] text-slate-500 font-mono">Showroom tag with verified Stock ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Label Card */}
        <div className="p-5 flex flex-col items-center text-center space-y-4">
          <div
            id="printable-product-label"
            className="w-full bg-white text-slate-900 p-5 rounded-2xl border-2 border-dashed border-slate-300 shadow-xs flex flex-col items-center"
          >
            {/* Store branding */}
            <div className="w-full text-center pb-2 border-b border-slate-200">
              <span className="text-[10px] tracking-widest uppercase font-extrabold text-red-600 block">
                LAKHI AIRCONDITIONERS
              </span>
              <span className="text-[9px] text-slate-500 font-medium">In-Store Stock Product Tag</span>
            </div>

            {/* Offline QR Code Graphic via Canvas */}
            <div className="my-3 p-2 bg-white rounded-xl border border-slate-100 shadow-xs flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-40 h-40 object-contain"
              />
            </div>

            {/* Product Meta */}
            <div className="w-full text-left space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-mono">
                  Stock ID: {stockIdValue}
                </span>
                <span className="text-emerald-700 font-black text-xs">
                  ₹{item.sellingPrice.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="font-black text-slate-900 leading-tight text-sm">{item.name}</div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Model: <strong className="font-mono text-slate-900">{item.modelNo}</strong></span>
                <span>Brand: <strong className="text-slate-900">{item.brand}</strong></span>
              </div>

              {/* Serials: If AC, strictly show Indoor and Outdoor SN (No generic SN) */}
              <div className="pt-1.5 border-t border-slate-100 space-y-0.5 text-[11px] text-slate-600">
                {isAc ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium">Indoor (IDU):</span>
                      <strong className="font-mono text-slate-900">
                        {item.indoorModelNo ? `[${item.indoorModelNo}] ` : ''}{item.indoorUnitSerial || item.serialNo || '-'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium">Outdoor (ODU):</span>
                      <strong className="font-mono text-slate-900">
                        {item.outdoorModelNo ? `[${item.outdoorModelNo}] ` : ''}{item.outdoorUnitSerial || '-'}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Serial No:</span>
                    <strong className="font-mono text-slate-900">{item.serialNo || item.id}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons (Share, Download, Copy, Print) */}
          <div className="space-y-2 w-full pt-1">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Product Tag</span>
            </button>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={handleShareTag}
                disabled={isSharing}
                className="py-2 px-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                title="Share product tag image via WhatsApp, AirDrop, etc."
              >
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTag}
                disabled={isDownloading}
                className="py-2 px-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                title="Download product tag as PNG image"
              >
                <Download className="w-3 h-3" />
                <span>Download</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTagImage}
                className="py-2 px-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Copy tag image to clipboard"
              >
                {copiedImage ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedImage ? 'Copied' : 'Copy Img'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const tagText = `🏷️ Lakhi Airconditioners - Stock Tag\nStock ID: ${stockIdValue}\nProduct: ${item.name}\nBrand: ${item.brand} | Model: ${item.modelNo}\nPrice: ₹${item.sellingPrice.toLocaleString('en-IN')}\n${
                    isAc
                      ? `Indoor (IDU): Model: ${item.indoorModelNo || '-'} | SN: ${item.indoorUnitSerial || item.serialNo || '-'}\nOutdoor (ODU): Model: ${item.outdoorModelNo || '-'} | SN: ${item.outdoorUnitSerial || '-'}`
                      : `Serial: ${item.serialNo || item.id}`
                  }`;
                  navigator.clipboard.writeText(tagText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="py-2 px-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Copy formatted product tag text"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>

            {shareFeedback && (
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-xl text-center">
                {shareFeedback}
              </div>
            )}

            {onOpenBarcode && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBarcode();
                }}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>Open QR Code Studio & Print Sheet</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
