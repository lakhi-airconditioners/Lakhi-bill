import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Copy,
  Check,
  QrCode as QrIcon,
  Download,
  Scissors,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  Tag,
  Plus,
  Minus,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { InventoryItem } from '../../types';
import {
  renderQrToCanvas,
  downloadQrPng,
  sanitizeQrText,
  generateCombinedStickerSheetBlob,
  printStickersDirectly,
  StickerSheetItem,
} from '../../utils/qrHelper';

interface ProductBarcodeModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  allItems?: InventoryItem[];
  initialSelectedIds?: string[];
  onClose: () => void;
}

export const ProductBarcodeModal: React.FC<ProductBarcodeModalProps> = ({
  isOpen,
  item,
  allItems = [],
  initialSelectedIds,
  onClose,
}) => {
  const { updateInventoryItem } = useApp();

  // Mode: Single product vs Multiple different products
  const [printMode, setPrintMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');

  // Single Item Active State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(item);
  const [barcodeText, setBarcodeText] = useState<string>('');
  const [sourceField, setSourceField] = useState<'stockId' | 'serialNo' | 'sku' | 'custom'>('stockId');
  const [singleQuantity, setSingleQuantity] = useState<number>(3);
  const [isSavingBarcode, setIsSavingBarcode] = useState<boolean>(false);

  // Multi-Item Batch Selection State
  const [selectedBatchItemIds, setSelectedBatchItemIds] = useState<string[]>([]);
  const [copiesPerProduct, setCopiesPerProduct] = useState<number>(1);
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'UNPRINTED' | 'ALL' | 'ADDED'>('UNPRINTED');

  // CRITICAL REQUIREMENT BUG 1: Auto-mark tick box MUST BE OFF (false) BY DEFAULT!
  const [autoMarkPrinted, setAutoMarkPrinted] = useState<boolean>(false);
  const [isMarking, setIsMarking] = useState<boolean>(false);

  // CRITICAL REQUIREMENT BUG 1: DEFAULT SETTINGS FOR MINI THERMAL PRINTER
  // 1 Column (58mm/80mm continuous roll / tape), 115px QR, tight gap, dashed cut lines
  const [columns, setColumns] = useState<number>(1);
  const [qrSize, setQrSize] = useState<number>(115);
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<'M' | 'Q'>('M');
  const [gapSize, setGapSize] = useState<'sm' | 'md' | 'lg'>('sm');
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [showCodeText, setShowCodeText] = useState<boolean>(true);
  const [showProductMetaSubtext, setShowProductMetaSubtext] = useState<boolean>(false);

  // Feedback states
  const [copied, setCopied] = useState<boolean>(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active store items (exclude customer-site/archived items)
  const activeItems = allItems.filter((i) => !i.isArchived);
  const unprintedCount = activeItems.filter((i) => !i.barcodeAdded).length;
  const addedCount = activeItems.filter((i) => !!i.barcodeAdded).length;

  // Sync state whenever modal opens or active item changes
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      setSelectedItem(item);
      setPrintMode('SINGLE');
      const initialCode = item.stockId || item.barcode || item.serialNo || item.id;
      setBarcodeText(initialCode);
      setSourceField(item.stockId ? 'stockId' : item.barcode ? 'custom' : item.serialNo ? 'serialNo' : 'sku');
    } else {
      // Opened from header or group button -> Default to MULTI mode with unprinted items pre-selected
      setPrintMode('MULTI');
      if (initialSelectedIds && initialSelectedIds.length > 0) {
        setSelectedBatchItemIds(initialSelectedIds);
      } else {
        const unprinted = activeItems.filter((i) => !i.barcodeAdded).map((i) => i.id);
        setSelectedBatchItemIds(unprinted);
      }

      if (allItems.length > 0) {
        setSelectedItem(allItems[0]);
        setBarcodeText(allItems[0].stockId || allItems[0].barcode || allItems[0].serialNo || allItems[0].id);
      } else {
        setBarcodeText('LAKHI-INV-001');
      }
    }
  }, [item, allItems, isOpen, initialSelectedIds]);

  // Preset switchers
  const applyPreset = (preset: 'THERMAL' | 'A4_SHEET') => {
    if (preset === 'THERMAL') {
      setColumns(1);
      setQrSize(115);
      setGapSize('sm');
      setShowCutLines(true);
      setShowCodeText(true);
      setToastMessage('🖨️ Configured default for Mini Thermal Roll Printer (58mm/80mm 1-Col)');
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setColumns(3);
      setQrSize(120);
      setGapSize('md');
      setShowCutLines(true);
      setShowCodeText(true);
      setToastMessage('📄 Configured layout for Standard A4 Sticker Sheet (3 Columns)');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Handle switching source field on single selected item
  const handleSelectSource = (field: 'stockId' | 'serialNo' | 'sku' | 'custom') => {
    setSourceField(field);
    if (!selectedItem) return;
    if (field === 'stockId') {
      setBarcodeText(selectedItem.stockId || `${selectedItem.serialNo || selectedItem.id}-01`);
    } else if (field === 'serialNo') {
      setBarcodeText(selectedItem.serialNo || selectedItem.id);
    } else if (field === 'sku') {
      setBarcodeText(selectedItem.id);
    }
  };

  // Generate a random internal code
  const handleGenerateRandomCode = () => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const prefix = selectedItem?.brand ? selectedItem.brand.slice(0, 3).toUpperCase() : 'LAK';
    const newCode = `${prefix}-${randomDigits}`;
    setBarcodeText(newCode);
    setSourceField('custom');
  };

  // Save customized internal QR code to Firebase for single product
  const handleSaveBarcodeToFirebase = async () => {
    if (!selectedItem) return;
    setIsSavingBarcode(true);
    try {
      await updateInventoryItem(selectedItem.id, {
        barcode: barcodeText,
        barcodeAdded: true,
        barcodePrintedAt: new Date().toISOString(),
      });
      setSelectedItem((prev) => (prev ? { ...prev, barcode: barcodeText, barcodeAdded: true } : null));
      setToastMessage(`✓ Saved internal QR Code "${barcodeText}" to product in Firebase!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Error saving QR code to Firebase:', err);
      alert('Failed to save code: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingBarcode(false);
    }
  };

  if (!isOpen) return null;

  // Filtered list of items in multi-selection panel
  const filteredAllItems = activeItems.filter((i) => {
    if (filterTab === 'UNPRINTED' && i.barcodeAdded) return false;
    if (filterTab === 'ADDED' && !i.barcodeAdded) return false;

    if (!batchSearch.trim()) return true;
    const q = batchSearch.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      i.brand.toLowerCase().includes(q) ||
      i.modelNo.toLowerCase().includes(q) ||
      (i.serialNo && i.serialNo.toLowerCase().includes(q)) ||
      (i.stockId && i.stockId.toLowerCase().includes(q))
    );
  });

  const handleSelectAllUnprinted = () => {
    const unprintedIds = activeItems.filter((i) => !i.barcodeAdded).map((i) => i.id);
    setSelectedBatchItemIds(unprintedIds);
    setToastMessage(`✓ Selected ${unprintedIds.length} products needing QR codes (Items with QR Code Added were excluded).`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeselectAll = () => {
    setSelectedBatchItemIds([]);
  };

  const handleToggleSingleItemBarcode = async (targetItem: InventoryItem) => {
    const nextVal = !targetItem.barcodeAdded;
    try {
      await updateInventoryItem(targetItem.id, {
        barcodeAdded: nextVal,
        barcodePrintedAt: nextVal ? new Date().toISOString() : undefined,
      });
      setToastMessage(
        nextVal
          ? `Marked "${targetItem.name}" as QR Code Added.`
          : `Marked "${targetItem.name}" as Needs QR Code.`
      );
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      alert('Error updating status: ' + (err.message || 'Unknown error'));
    }
  };

  const handleMarkSelectedAsBarcodeAdded = async () => {
    if (selectedBatchItemIds.length === 0) return;
    setIsMarking(true);
    try {
      for (const id of selectedBatchItemIds) {
        await updateInventoryItem(id, {
          barcodeAdded: true,
          barcodePrintedAt: new Date().toISOString(),
        });
      }
      setToastMessage(`✓ Successfully marked ${selectedBatchItemIds.length} products as "QR Code Added" in Firebase!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Error batch updating:', err);
      alert('Failed to mark items: ' + (err.message || 'Unknown error'));
    } finally {
      setIsMarking(false);
    }
  };

  // Build the complete list of stickers to print:
  const itemsToPrint: StickerSheetItem[] =
    printMode === 'MULTI' && selectedBatchItemIds.length > 0
      ? selectedBatchItemIds
          .map((id) => allItems.find((i) => i.id === id))
          .filter((it): it is InventoryItem => Boolean(it))
          .flatMap((it) => {
            const code = it.stockId || it.barcode || it.serialNo || it.id;
            return Array.from({ length: copiesPerProduct }).map(() => ({
              id: it.id,
              code,
              label: it.name,
              sublabel: `${it.brand} • ${it.modelNo}`,
            }));
          })
      : Array.from({ length: singleQuantity }).map(() => ({
          id: selectedItem?.id,
          code: barcodeText,
          label: selectedItem?.name,
          sublabel: selectedItem ? `${selectedItem.brand} • ${selectedItem.modelNo}` : undefined,
        }));

  // BUG 1 FIX: PRINT USING DEDICATED ISOLATED PRINT IFRAME (ZERO BLANK PAGES, THERMAL PERFECT!)
  const handlePrint = async () => {
    if (itemsToPrint.length === 0) return;
    setIsPrinting(true);

    try {
      // Auto-mark if explicitly ticked by user
      if (printMode === 'MULTI' && autoMarkPrinted && selectedBatchItemIds.length > 0) {
        handleMarkSelectedAsBarcodeAdded();
      } else if (printMode === 'SINGLE' && autoMarkPrinted && selectedItem) {
        updateInventoryItem(selectedItem.id, {
          barcodeAdded: true,
          barcodePrintedAt: new Date().toISOString(),
        }).catch((e) => console.warn('Could not auto-mark', e));
      }

      await printStickersDirectly(itemsToPrint, {
        columns,
        qrSize,
        gapSize,
        showCutLines,
        showCodeText,
        showProductMetaSubtext,
        errorCorrectionLevel,
      });
    } catch (err) {
      console.warn('Direct print error, falling back to window.print():', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  // 1-click Print All Unprinted QR Codes
  const handlePrintAllUnprinted = () => {
    const unprintedIds = activeItems.filter((i) => !i.barcodeAdded).map((i) => i.id);
    if (unprintedIds.length === 0) {
      alert('All products already have their QR codes added! None are unprinted.');
      return;
    }
    setSelectedBatchItemIds(unprintedIds);
    setPrintMode('MULTI');
    setTimeout(() => {
      handlePrint();
    }, 200);
  };

  // BUG 1 FIX: SHARE ALL STICKERS (COMBINED SHEET IMAGE OR FILES), NOT JUST ONE!
  const handleShare = async () => {
    if (itemsToPrint.length === 0) return;
    setIsSharing(true);
    setShareStatus('Preparing all stickers...');

    try {
      const sheetBlob = await generateCombinedStickerSheetBlob(itemsToPrint, {
        columns,
        qrSize,
        gapSize,
        showCutLines,
        showCodeText,
        showProductMetaSubtext,
        errorCorrectionLevel,
      });

      const fileName = `lakhi-qr-stickers-${itemsToPrint.length}-units.png`;
      const file = new File([sheetBlob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Lakhi Store: ${itemsToPrint.length} QR Stickers`,
          text: `Product QR Code Stickers for ${itemsToPrint.length} units`,
          files: [file],
        });
        setShareStatus('✓ Shared all stickers!');
      } else {
        // Fallback: download combined sheet
        const url = URL.createObjectURL(sheetBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShareStatus('✓ Downloaded all stickers image!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
        setShareStatus('Failed to share: ' + (err.message || 'Unknown error'));
      } else {
        setShareStatus(null);
      }
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareStatus(null), 3000);
    }
  };

  // BUG 1 FIX: COPY ALL STICKERS (COMBINED SHEET IMAGE TO CLIPBOARD), NOT JUST ONE!
  const handleCopy = async () => {
    if (itemsToPrint.length === 0) return;

    try {
      const sheetBlob = await generateCombinedStickerSheetBlob(itemsToPrint, {
        columns,
        qrSize,
        gapSize,
        showCutLines,
        showCodeText,
        showProductMetaSubtext,
        errorCorrectionLevel,
      });

      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 'image/png': sheetBlob });
        await navigator.clipboard.write([item]);
        setCopied(true);
        setToastMessage(`✓ Copied complete sheet image of all ${itemsToPrint.length} stickers to clipboard!`);
        setTimeout(() => setCopied(false), 2500);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        // Fallback: Copy all code texts
        const allCodes = itemsToPrint.map((it) => it.code).join('\n');
        await navigator.clipboard.writeText(allCodes);
        setCopied(true);
        setToastMessage(`✓ Copied all ${itemsToPrint.length} code strings to clipboard!`);
        setTimeout(() => setCopied(false), 2500);
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (err) {
      console.warn('Clipboard image copy failed, copying text fallback:', err);
      const allCodes = itemsToPrint.map((it) => it.code).join('\n');
      navigator.clipboard.writeText(allCodes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // BUG 1 FIX: DOWNLOAD ALL STICKERS (COMBINED SHEET IMAGE), NOT JUST ONE!
  const handleDownload = async () => {
    if (itemsToPrint.length === 0) return;
    setIsDownloading(true);

    try {
      const sheetBlob = await generateCombinedStickerSheetBlob(itemsToPrint, {
        columns,
        qrSize,
        gapSize,
        showCutLines,
        showCodeText,
        showProductMetaSubtext,
        errorCorrectionLevel,
      });

      const url = URL.createObjectURL(sheetBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lakhi-qr-stickers-${itemsToPrint.length}-units.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToastMessage(`✓ Saved complete image containing all ${itemsToPrint.length} QR stickers!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to download sheet:', err);
      alert('Error creating sheet image: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // Download all selected stickers as individual QR PNG files (1 per product)
  const handleDownloadIndividualImages = async () => {
    if (itemsToPrint.length === 0) return;
    setIsDownloading(true);
    setToastMessage(`Downloading ${itemsToPrint.length} individual QR image files...`);

    try {
      for (let i = 0; i < itemsToPrint.length; i++) {
        const it = itemsToPrint[i];
        const safeName = (it.code || `sticker-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        await downloadQrPng(it.code, `qr-${safeName}.png`, {
          width: qrSize * 2,
          errorCorrectionLevel,
        });
        if (itemsToPrint.length > 1) {
          await new Promise((r) => setTimeout(r, 220));
        }
      }
      setToastMessage(`✓ Downloaded all ${itemsToPrint.length} individual QR images!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to download individual images:', err);
      alert('Error downloading images: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // Copy all QR code strings as newline-separated text
  const handleCopyAllCodesText = async () => {
    if (itemsToPrint.length === 0) return;
    const allCodes = itemsToPrint.map((it) => it.code).join('\n');
    await navigator.clipboard.writeText(allCodes);
    setCopied(true);
    setToastMessage(`✓ Copied all ${itemsToPrint.length} code strings to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[96vh] flex flex-col">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-red-600 via-rose-600 to-indigo-600 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md text-white shadow-inner">
                <QrIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm sm:text-base tracking-wide">
                    Product Internal QR Code Studio
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 uppercase tracking-wider flex items-center gap-1">
                    <span>🖨️ Thermal Ready</span>
                  </span>
                </div>
                <p className="text-[11px] text-white/80">
                  Generate, preview & print 2D QR codes tailored for Mini Thermal Roll Printers (58mm/80mm) or A4 sheets
                </p>
              </div>
            </div>

            {/* Mode Switcher: Multi-Product vs Single */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-black/25 p-1 rounded-xl flex items-center gap-1 border border-white/20 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPrintMode('MULTI')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    printMode === 'MULTI'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Multiple Products (Different QR Codes)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('SINGLE')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    printMode === 'SINGLE'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <QrIcon className="w-3.5 h-3.5" />
                  <span>Single Product</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{toastMessage}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
            {/* Left Column: Product Selection & Controls */}
            <div className="w-full lg:w-[420px] p-4 sm:p-5 space-y-4 bg-slate-50/60 dark:bg-slate-950/40 overflow-y-auto shrink-0 text-xs">
              {/* Quick Thermal vs A4 Printer Preset Toggle */}
              <div className="bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-300/60 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => applyPreset('THERMAL')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-center font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    columns === 1
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/50'
                  }`}
                  title="Default format: 1 column continuous roll for 58mm / 80mm Bluetooth & USB Mini Thermal Printers"
                >
                  <span>🖨️ Mini Thermal (1-Col Roll)</span>
                  {columns === 1 && <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">Default</span>}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('A4_SHEET')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-center font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    columns > 1
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/50'
                  }`}
                  title="Multi-column sheet layout for standard A4 paper or sticker paper sheets"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>A4 Sheet (3-Col)</span>
                </button>
              </div>

              {/* MULTI-PRODUCT SELECTION PANEL */}
              {printMode === 'MULTI' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Select Products for QR Printing</span>
                    </span>
                    <span className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-full border border-indigo-200 dark:border-indigo-900/50">
                      {selectedBatchItemIds.length} Selected
                    </span>
                  </div>

                  {/* Filter Tabs */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFilterTab('UNPRINTED')}
                      className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all flex flex-col items-center ${
                        filterTab === 'UNPRINTED'
                          ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span>Needs QR</span>
                      <span className="text-[10px] font-mono font-extrabold text-amber-600">({unprintedCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('ADDED')}
                      className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all flex flex-col items-center ${
                        filterTab === 'ADDED'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span>QR Added</span>
                      <span className="text-[10px] font-mono font-extrabold text-emerald-600">({addedCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab('ALL')}
                      className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all flex flex-col items-center ${
                        filterTab === 'ALL'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span>All Products</span>
                      <span className="text-[10px] font-mono font-extrabold text-slate-500">({activeItems.length})</span>
                    </button>
                  </div>

                  {/* Quick Bulk Selection Buttons & Print All Action */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllUnprinted}
                        className="flex-1 py-2 px-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-[11px] shadow-xs flex items-center justify-center gap-1 transition-colors"
                        title="Select only products needing QR codes (Items with QR Code Added are excluded)"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Select All Needing QR ({unprintedCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-[11px] transition-colors"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Instant 1-Click Print All Unprinted QR Codes */}
                    {unprintedCount > 0 && (
                      <button
                        type="button"
                        onClick={handlePrintAllUnprinted}
                        className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                        title="Print all different product QR codes at once"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print All QR Codes ({unprintedCount} Different Products)</span>
                      </button>
                    )}

                    <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-amber-50/70 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-1.5 leading-snug">
                      <span className="shrink-0 text-amber-600 font-bold">ℹ️</span>
                      <span>
                        <strong>Note:</strong> Selecting all or printing all automatically excludes products marked as <strong>"QR Code Added"</strong>. Each selected product prints its own unique QR code sticker.
                      </span>
                    </div>
                  </div>

                  {/* Search Filter Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter by product name, model, serial..."
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Scrollable Product List with Checkboxes */}
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredAllItems.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        No products match this filter.
                      </div>
                    ) : (
                      filteredAllItems.map((it) => {
                        const isChecked = selectedBatchItemIds.includes(it.id);
                        const code = it.stockId || it.barcode || it.serialNo || it.id;
                        return (
                          <div
                            key={it.id}
                            className={`flex items-center justify-between gap-2 p-1.5 rounded-xl transition-colors ${
                              isChecked
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <label className="flex items-center gap-2 flex-1 cursor-pointer truncate">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBatchItemIds((prev) => [...prev, it.id]);
                                  } else {
                                    setSelectedBatchItemIds((prev) => prev.filter((id) => id !== it.id));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                              <div className="truncate flex-1">
                                <div className="font-bold text-slate-900 dark:text-white truncate">
                                  {it.name}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                                  <span>{it.brand} {it.modelNo}</span>
                                  <span>•</span>
                                  <span className="font-black text-indigo-600 dark:text-indigo-400">{code}</span>
                                </div>
                              </div>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleToggleSingleItemBarcode(it)}
                              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                                it.barcodeAdded
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                              }`}
                            >
                              {it.barcodeAdded ? (
                                <>
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Added</span>
                                </>
                              ) : (
                                <span>Needs QR</span>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Multi-print options */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                        Sticker Copies Per Product:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3].map((cp) => (
                          <button
                            key={cp}
                            type="button"
                            onClick={() => setCopiesPerProduct(cp)}
                            className={`px-2.5 py-0.5 rounded-lg font-bold text-xs border ${
                              copiesPerProduct === cp
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {cp}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* BUG 1: Auto-mark checkbox is OFF BY DEFAULT */}
                    <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer p-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={autoMarkPrinted}
                        onChange={(e) => setAutoMarkPrinted(e.target.checked)}
                        className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                      />
                      <span>
                        Auto-mark selected products as <strong>"QR Code Added"</strong> after printing
                      </span>
                    </label>

                    {selectedBatchItemIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkSelectedAsBarcodeAdded}
                        disabled={isMarking}
                        className="w-full py-1.5 px-3 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mark {selectedBatchItemIds.length} Selected as "QR Code Added" in Firebase</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* SINGLE PRODUCT CONFIG PANEL */
                <div className="space-y-3">
                  <div>
                    <label className="font-black text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block mb-1">
                      Target Product
                    </label>
                    {allItems.length > 0 && (
                      <select
                        value={selectedItem?.id || ''}
                        onChange={(e) => {
                          const found = allItems.find((it) => it.id === e.target.value);
                          if (found) {
                            setSelectedItem(found);
                            setBarcodeText(found.stockId || found.barcode || found.serialNo || found.id);
                            setSourceField(found.stockId ? 'stockId' : found.barcode ? 'custom' : found.serialNo ? 'serialNo' : 'sku');
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 mb-2"
                      >
                        {allItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.brand} - {it.modelNo})
                          </option>
                        ))}
                      </select>
                    )}

                    {selectedItem && (
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 mb-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {selectedItem.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleSingleItemBarcode(selectedItem)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              selectedItem.barcodeAdded
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {selectedItem.barcodeAdded ? '✓ QR Added' : 'Needs QR'}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
                          <span>Brand: <strong>{selectedItem.brand}</strong></span>
                          <span>•</span>
                          <span>Model: <strong className="font-mono">{selectedItem.modelNo}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Code String Config & Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-black text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                        Internal QR Code Payload
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomCode}
                        className="text-[10px] text-red-600 dark:text-red-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Auto-Generate
                      </button>
                    </div>

                    {selectedItem && (
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        <button
                          type="button"
                          onClick={() => handleSelectSource('stockId')}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition-colors ${
                            sourceField === 'stockId'
                              ? 'bg-red-50 border-red-400 text-red-700 dark:bg-red-950/50 dark:border-red-600 dark:text-red-300'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Stock ID
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectSource('serialNo')}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition-colors ${
                            sourceField === 'serialNo'
                              ? 'bg-red-50 border-red-400 text-red-700 dark:bg-red-950/50 dark:border-red-600 dark:text-red-300'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Carton Serial
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectSource('sku')}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition-colors ${
                            sourceField === 'sku'
                              ? 'bg-red-50 border-red-400 text-red-700 dark:bg-red-950/50 dark:border-red-600 dark:text-red-300'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          SKU ID
                        </button>
                      </div>
                    )}

                    <input
                      type="text"
                      value={barcodeText}
                      onChange={(e) => {
                        setBarcodeText(e.target.value);
                        setSourceField('custom');
                      }}
                      placeholder="Enter QR payload or internal code"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                    />

                    {selectedItem && (
                      <button
                        type="button"
                        onClick={handleSaveBarcodeToFirebase}
                        disabled={isSavingBarcode}
                        className="mt-2 w-full py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-xl font-bold border border-red-200 dark:border-red-900/50 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>{isSavingBarcode ? 'Saving to Firebase...' : 'Save QR Code to this Product in Firebase'}</span>
                      </button>
                    )}
                  </div>

                  {/* Quantity to Print for single item */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-black text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                        Quantity to Print
                      </label>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">
                        {singleQuantity} stickers
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1 mb-2">
                      {[1, 2, 3, 5, 10].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setSingleQuantity(q)}
                          className={`py-1 rounded-lg font-bold text-[11px] border transition-colors ${
                            singleQuantity === q
                              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {q}x
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSingleQuantity((q) => Math.max(1, q - 1))}
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <Minus className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={singleQuantity}
                        onChange={(e) => setSingleQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 text-center font-black font-mono px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setSingleQuantity((q) => q + 1)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SHEET LAYOUT & CUTTING LINES CONFIGURATION */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-black text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Printer & Sheet Layout</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {columns === 1 ? '1-Col Mini Thermal' : `${columns} Columns`}
                  </span>
                </div>

                {/* Columns per sheet */}
                <div>
                  <span className="text-[10px] text-slate-500 block mb-1">Columns / Format:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { cols: 1, label: '1 (Thermal Roll)' },
                      { cols: 2, label: '2 (Half)' },
                      { cols: 3, label: '3 (A4 Sheet)' },
                      { cols: 4, label: '4 (Mini)' },
                    ].map((col) => (
                      <button
                        key={col.cols}
                        type="button"
                        onClick={() => setColumns(col.cols)}
                        className={`py-1.5 px-1 text-center rounded-xl font-bold text-[10px] border transition-colors ${
                          columns === col.cols
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* QR Code Size Options */}
                <div>
                  <span className="text-[10px] text-slate-500 block mb-1">QR Code Size:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { size: 95, label: 'Small (95px)' },
                      { size: 115, label: 'Thermal (115px)' },
                      { size: 140, label: 'Large (140px)' },
                      { size: 170, label: 'XL (170px)' },
                    ].map((s) => (
                      <button
                        key={s.size}
                        type="button"
                        onClick={() => setQrSize(s.size)}
                        className={`py-1.5 px-1 text-center rounded-xl font-bold text-[10px] border transition-colors ${
                          qrSize === s.size
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      Dashed Cut Lines & Scissor Guides
                    </span>
                    <input
                      type="checkbox"
                      checked={showCutLines}
                      onChange={(e) => setShowCutLines(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      Show Code Text Below QR
                    </span>
                    <input
                      type="checkbox"
                      checked={showCodeText}
                      onChange={(e) => setShowCodeText(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      Show Tiny Model/Brand Subtext
                    </span>
                    <input
                      type="checkbox"
                      checked={showProductMetaSubtext}
                      onChange={(e) => setShowProductMetaSubtext(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              {/* ACTION BUTTONS: Print, Share, Copy, Save PNG (WORKS FOR ALL SELECTED STICKERS!) */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                {/* BUG 1: Prominent Auto-Mark Tick Box (OFF by default) */}
                <label className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 font-semibold select-none transition-colors">
                  <input
                    type="checkbox"
                    checked={autoMarkPrinted}
                    onChange={(e) => setAutoMarkPrinted(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                  />
                  <span>
                    Auto mark selected products as <strong>"QR Code Added"</strong> on print (Default: Off)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting || itemsToPrint.length === 0}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {isPrinting
                      ? 'Sending to Printer...'
                      : `Print ${itemsToPrint.length} QR Sticker${itemsToPrint.length === 1 ? '' : 's'} (${columns === 1 ? 'Thermal Roll' : `${columns}-Col Sheet`})`}
                  </span>
                </button>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={isSharing || itemsToPrint.length === 0}
                    className="py-2 px-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title={`Share all ${itemsToPrint.length} QR stickers image via WhatsApp, Email, AirDrop, etc.`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share All ({itemsToPrint.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={itemsToPrint.length === 0}
                    className="py-2 px-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title={`Copy complete image containing all ${itemsToPrint.length} stickers to clipboard`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Sheet!' : `Copy (${itemsToPrint.length})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading || itemsToPrint.length === 0}
                    className="py-2 px-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title={`Download consolidated PNG image containing all ${itemsToPrint.length} stickers`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isDownloading ? 'Saving...' : `Save Sheet PNG`}</span>
                  </button>
                </div>

                {/* Additional Batch Actions for All Selected Items */}
                {itemsToPrint.length > 0 && (
                  <div className="flex items-center justify-between gap-1 pt-1 text-[10px]">
                    <button
                      type="button"
                      onClick={handleDownloadIndividualImages}
                      disabled={isDownloading}
                      className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold underline flex items-center gap-1 cursor-pointer"
                      title="Download separate PNG files for each of the selected products"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download All Individual PNGs ({itemsToPrint.length} files)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAllCodesText}
                      className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold underline flex items-center gap-1 cursor-pointer"
                      title="Copy list of all QR codes / Stock IDs as text"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy All Codes (Text)</span>
                    </button>
                  </div>
                )}

                {shareStatus && (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-[11px] font-bold text-emerald-700 dark:text-emerald-300 text-center animate-in fade-in">
                    {shareStatus}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Preview of the Sheet / Thermal Roll */}
            <div className="flex-1 p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/70 overflow-y-auto flex flex-col items-center">
              {/* Preview Meta Bar */}
              <div className="w-full flex flex-wrap items-center justify-between mb-3 text-xs text-slate-500 gap-2">
                <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <QrIcon className="w-4 h-4 text-red-500" />
                  <span>
                    {columns === 1 ? 'Mini Thermal Roll Preview' : 'Sticker Sheet Preview'} ({itemsToPrint.length} QR Stickers)
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {columns === 1 ? '1-Col Thermal Roll (58mm/80mm)' : `${columns} Col Sheet`} • Dashed Cut Lines
                </span>
              </div>

              {/* Printable Zone */}
              <div
                id="barcode-print-zone"
                className={`w-full bg-white text-slate-900 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 ${
                  columns === 1 ? 'max-w-xs' : 'max-w-2xl'
                }`}
              >
                {itemsToPrint.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <QrIcon className="w-10 h-10 mx-auto text-slate-300 animate-pulse" />
                    <p className="font-bold">No products selected for QR code printing.</p>
                    <p className="text-xs">
                      Check items from the list on the left or click <strong>"Select All Needing QR"</strong> to print.
                    </p>
                  </div>
                ) : (
                  <div
                    className={`grid ${
                      columns === 1
                        ? 'grid-cols-1'
                        : columns === 2
                        ? 'grid-cols-2'
                        : columns === 3
                        ? 'grid-cols-3'
                        : 'grid-cols-4'
                    } ${
                      gapSize === 'sm'
                        ? 'gap-2.5'
                        : gapSize === 'md'
                        ? 'gap-4'
                        : 'gap-6'
                    }`}
                  >
                    {itemsToPrint.map((itemPrint, index) => (
                      <QrStickerItem
                        key={`${itemPrint.id || ''}-${itemPrint.code}-${index}`}
                        code={itemPrint.code}
                        index={index}
                        label={showProductMetaSubtext ? itemPrint.label : undefined}
                        sublabel={showProductMetaSubtext ? itemPrint.sublabel : undefined}
                        showCutLines={showCutLines}
                        showCodeText={showCodeText}
                        qrSize={qrSize}
                        errorCorrectionLevel={errorCorrectionLevel}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Print Hint */}
              <div className="mt-4 text-center text-xs text-slate-400 max-w-md leading-relaxed">
                ✂️ <strong>Thermal Cutting Guide:</strong> Each sticker is bordered with dashed lines and scissor indicators. Perfect for 58mm/80mm mini thermal label printers or scissors trimming.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

interface QrStickerItemProps {
  code: string;
  index: number;
  label?: string;
  sublabel?: string;
  showCutLines: boolean;
  showCodeText: boolean;
  qrSize: number;
  errorCorrectionLevel: 'M' | 'Q';
}

const QrStickerItem: React.FC<QrStickerItemProps> = ({
  code,
  index,
  label,
  sublabel,
  showCutLines,
  showCodeText,
  qrSize,
  errorCorrectionLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!code || !canvasRef.current) return;
    renderQrToCanvas(canvasRef.current, code, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel,
    });
  }, [code, qrSize, errorCorrectionLevel]);

  return (
    <div
      className={`barcode-sticker-card relative bg-white p-2.5 flex flex-col items-center justify-center transition-all ${
        showCutLines
          ? 'barcode-cut-dashed border-2 border-dashed border-slate-400 dark:border-slate-500 rounded-xl shadow-xs'
          : 'border border-slate-100 rounded-lg'
      }`}
      style={{
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {/* Cut Indicator Guide Marks with Scissors */}
      {showCutLines && (
        <div className="barcode-scissor-badge absolute -top-2 left-3 px-1.5 bg-white text-[9px] text-slate-500 font-mono flex items-center gap-0.5 select-none font-bold border border-slate-200 rounded-md shadow-xs">
          <Scissors className="w-2.5 h-2.5 text-slate-600" />
          <span>cut #{index + 1}</span>
        </div>
      )}

      {/* Optional product title */}
      {label && (
        <div className="w-full text-center pb-1 mb-1 border-b border-slate-100 text-[10px] font-bold text-slate-800 truncate">
          {label}
        </div>
      )}

      {/* Strictly clean 2D QR Code Graphic */}
      <div className="w-full flex flex-col items-center justify-center py-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="object-contain max-w-full"
          style={{ width: `${qrSize}px`, height: `${qrSize}px` }}
        />
        {showCodeText && (
          <span className="font-mono font-black text-[11px] text-slate-900 text-center tracking-wider mt-1 select-all truncate max-w-full">
            {code}
          </span>
        )}
      </div>

      {sublabel && (
        <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate max-w-full">
          {sublabel}
        </div>
      )}
    </div>
  );
};
