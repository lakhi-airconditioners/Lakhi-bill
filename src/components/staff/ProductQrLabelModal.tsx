import React, { useState } from 'react';
import { X, Printer, QrCode, Copy, Check, Barcode } from 'lucide-react';
import { InventoryItem } from '../../types';

interface ProductQrLabelModalProps {
  item: InventoryItem | null;
  onClose: () => void;
}

export const ProductQrLabelModal: React.FC<ProductQrLabelModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  // Structured payload for label QR
  const qrPayload = JSON.stringify({
    name: item.name,
    modelNo: item.modelNo,
    brand: item.brand,
    type: item.type,
    serialNo: item.serialNo || item.id,
    price: item.sellingPrice,
  });

  // URL encoded QR code image generator using quick QR SVG API
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    qrPayload
  )}&margin=1`;

  const handlePrint = () => {
    window.print();
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
            <div className="p-1.5 bg-red-600 text-white rounded-lg">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Product Stock QR Label</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg"
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

            {/* QR Code Graphic */}
            <div className="my-3 p-2 bg-white rounded-xl border border-slate-100 shadow-xs">
              <img
                src={qrImageUrl}
                alt="Product QR Label"
                className="w-40 h-40 object-contain"
                crossOrigin="anonymous"
              />
            </div>

            {/* Product Meta */}
            <div className="w-full text-left space-y-1 text-xs">
              <div className="font-black text-slate-900 leading-tight text-sm">{item.name}</div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Model: <strong className="font-mono text-slate-900">{item.modelNo}</strong></span>
                <span>Brand: <strong className="text-slate-900">{item.brand}</strong></span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1 font-mono">
                  <Barcode className="w-3.5 h-3.5" />
                  {item.serialNo || item.id}
                </span>
                <span className="text-emerald-700 font-black text-xs">
                  ₹{item.sellingPrice.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2 w-full pt-1">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Label
            </button>
            <button
              type="button"
              onClick={handleCopyPayload}
              className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
              title="Copy JSON Payload"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
