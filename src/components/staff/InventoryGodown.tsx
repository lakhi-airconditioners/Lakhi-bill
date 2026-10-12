import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Tag,
  Barcode,
  ShoppingBag,
  Edit2,
  Camera,
  QrCode,
  Printer,
  Copy,
  Sparkles,
  Layers,
  Zap,
  Scissors,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { InventoryItem, StockStatus } from '../../types';
import { InventoryQrScannerModal } from './InventoryQrScannerModal';
import { ProductQrLabelModal } from './ProductQrLabelModal';
import { stripRandomSuffix } from '../../utils/idGenerator';

interface InventoryGodownProps {
  onBillItem?: (item: InventoryItem) => void;
}

export const InventoryGodown: React.FC<InventoryGodownProps> = ({ onBillItem }) => {
  const {
    inventory,
    shipments,
    invoices,
    addInventoryItem,
    updateInventoryItem,
    markInventorySold,
    deleteInventoryItem,
    archiveInventoryItem,
    unarchiveInventoryItem,
    updateShipmentStatus,
    addShipmentTrackingUpdate,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'SOLD' | 'ARCHIVED'>('AVAILABLE');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State for Adding In-Store Stock (with multi-unit & batch support)
  const [formName, setFormName] = useState('');
  const [formModelNo, setFormModelNo] = useState('');
  const [formType, setFormType] = useState('AC');
  const [formBrand, setFormBrand] = useState('');
  const [formSerialNo, setFormSerialNo] = useState('');
  const [formStockId, setFormStockId] = useState('');
  const [formPrice, setFormPrice] = useState<number | ''>('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formSerialNumbers, setFormSerialNumbers] = useState<string[]>(['']);
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplicate / Clone Stock Item State
  const [duplicateTargetItem, setDuplicateTargetItem] = useState<InventoryItem | null>(null);
  const [duplicateQuantity, setDuplicateQuantity] = useState<number>(1);
  const [duplicateSerials, setDuplicateSerials] = useState<string[]>(['']);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Notification Toast Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Stock State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editModelNo, setEditModelNo] = useState('');
  const [editType, setEditType] = useState('AC');
  const [editBrand, setEditBrand] = useState('');
  const [editSerialNo, setEditSerialNo] = useState('');
  const [editStockId, setEditStockId] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editStatus, setEditStatus] = useState<StockStatus>('AVAILABLE');
  const [isUpdating, setIsUpdating] = useState(false);

  // QR Scanner Modal State & Product Label Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<InventoryItem | null>(null);

  /**
   * Helper: Generate clean sequential serial numbers based on Brand, Model, and base serial
   */
  const generateSequentialSerials = (
    brand: string,
    model: string,
    count: number,
    baseSerial?: string
  ): string[] => {
    const brandPrefix = (brand.trim() || 'LAK').slice(0, 3).toUpperCase();
    const modelClean = (model.trim() || 'PROD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();

    // If a baseSerial exists and ends with numeric digits, increment from that
    if (baseSerial && /\d+$/.test(baseSerial.trim())) {
      const match = baseSerial.trim().match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const numStr = match[2];
        const startNum = parseInt(numStr, 10);
        return Array.from({ length: count }, (_, i) => {
          const nextNum = (startNum + i + 1).toString().padStart(numStr.length, '0');
          return `${prefix}${nextNum}`;
        });
      }
    }

    // Default sequential format: BRAND-MODEL-RANDOMSEQ-01..N
    const baseSeq = Math.floor(1000 + Math.random() * 9000);
    return Array.from({ length: count }, (_, i) => {
      const padIndex = (i + 1).toString().padStart(2, '0');
      return `${brandPrefix}-${modelClean ? modelClean + '-' : ''}${baseSeq}-${padIndex}`;
    });
  };

  const handleQuantityChange = (newQty: number) => {
    const qty = Math.max(1, Math.min(50, newQty));
    setFormQuantity(qty);
    setFormSerialNumbers((prev) => {
      const next = [...prev];
      while (next.length < qty) {
        next.push('');
      }
      return next.slice(0, qty);
    });
  };

  const handleAutoGenerateFormSerials = () => {
    const serials = generateSequentialSerials(formBrand, formModelNo, formQuantity, formSerialNumbers[0] || formSerialNo);
    setFormSerialNumbers(serials);
    if (formQuantity === 1) {
      setFormSerialNo(serials[0]);
    }
  };

  const handleApplyBulkPaste = () => {
    const parsed = bulkPasteText
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;

    const newQty = Math.max(parsed.length, formQuantity);
    setFormQuantity(newQty);
    const updated = Array.from({ length: newQty }, (_, i) => parsed[i] || formSerialNumbers[i] || '');
    setFormSerialNumbers(updated);
    setIsBulkPasteOpen(false);
    setBulkPasteText('');
  };

  const handleOpenAddWithScannedData = (data: {
    name?: string;
    modelNo?: string;
    brand?: string;
    serialNo?: string;
    price?: number;
    type?: string;
  }) => {
    setFormName(data.name || '');
    setFormModelNo(data.modelNo || '');
    setFormBrand(data.brand || '');
    setFormSerialNo(data.serialNo || '');
    setFormPrice(data.price ?? '');
    setFormType(data.type || 'AC');
    setFormQuantity(1);
    setFormSerialNumbers([data.serialNo || '']);
    setIsAddOpen(true);
  };

  const handleQuickAddDirect = async (item: {
    name: string;
    modelNo: string;
    type: string;
    brand: string;
    serialNo: string;
    sellingPrice: number;
  }) => {
    await addInventoryItem({
      name: item.name,
      modelNo: item.modelNo,
      type: item.type,
      brand: item.brand,
      serialNo: item.serialNo,
      sellingPrice: item.sellingPrice,
    });
  };

  const handleStartEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditModelNo(item.modelNo);
    setEditType(item.type);
    setEditBrand(item.brand);
    setEditSerialNo(item.serialNo);
    setEditStockId(item.stockId || '');
    setEditPrice(item.sellingPrice);
    setEditStatus(item.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsUpdating(true);
    try {
      await updateInventoryItem(editingItem.id, {
        name: editName.trim(),
        modelNo: editModelNo.trim(),
        type: editType.trim(),
        brand: editBrand.trim(),
        serialNo: editSerialNo.trim(),
        stockId: editStockId.trim() || undefined,
        sellingPrice: Number(editPrice) || 0,
        status: editStatus,
      });
      setEditingItem(null);
    } finally {
      setIsUpdating(false);
    }
  };

  // Start One-Click Duplicate Flow
  const handleStartDuplicate = (item: InventoryItem) => {
    setDuplicateTargetItem(item);
    setDuplicateQuantity(1);
    const initialSerials = generateSequentialSerials(item.brand, item.modelNo, 1, item.serialNo);
    setDuplicateSerials(initialSerials);
  };

  const handleDuplicateQtyChange = (newQty: number) => {
    const qty = Math.max(1, Math.min(20, newQty));
    setDuplicateQuantity(qty);
    if (duplicateTargetItem) {
      const generated = generateSequentialSerials(
        duplicateTargetItem.brand,
        duplicateTargetItem.modelNo,
        qty,
        duplicateTargetItem.serialNo
      );
      setDuplicateSerials(generated);
    }
  };

  const handleConfirmDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateTargetItem) return;
    setIsDuplicating(true);
    try {
      const qty = Math.max(1, duplicateQuantity);
      for (let i = 0; i < qty; i++) {
        const serial =
          duplicateSerials[i]?.trim() ||
          `${(duplicateTargetItem.brand || 'LAK').slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}-${(i + 1).toString().padStart(2, '0')}`;

        await addInventoryItem({
          name: duplicateTargetItem.name,
          modelNo: duplicateTargetItem.modelNo,
          type: duplicateTargetItem.type,
          brand: duplicateTargetItem.brand,
          serialNo: serial,
          sellingPrice: duplicateTargetItem.sellingPrice,
        });
      }

      const itemName = duplicateTargetItem.name;
      setDuplicateTargetItem(null);
      setToastMessage(`✅ Successfully added ${qty} unit${qty > 1 ? 's' : ''} of "${itemName}" to Store Stock!`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsDuplicating(false);
    }
  };

  // Batch Add In-Store Stock (1 or many units)
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const qty = Math.max(1, formQuantity);
      for (let i = 0; i < qty; i++) {
        let serial =
          qty === 1
            ? (formSerialNo.trim() || formSerialNumbers[0]?.trim() || '')
            : (formSerialNumbers[i]?.trim() || '');

        if (!serial) {
          serial = `${(formBrand || 'LAK').slice(0, 3).toUpperCase()}-${(formModelNo || 'AC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}-${Date.now().toString().slice(-4)}${(i + 1).toString().padStart(2, '0')}`;
        }

        const unitStockId =
          qty === 1 && formStockId.trim()
            ? formStockId.trim()
            : formStockId.trim()
            ? `${formStockId.trim()}-${(i + 1).toString().padStart(2, '0')}`
            : undefined;

        await addInventoryItem({
          name: formName.trim(),
          modelNo: formModelNo.trim(),
          type: formType.trim(),
          brand: formBrand.trim(),
          serialNo: serial,
          sellingPrice: Number(formPrice) || 0,
          stockId: unitStockId,
        });
      }

      setIsAddOpen(false);
      const addedName = formName.trim();
      setFormName('');
      setFormModelNo('');
      setFormSerialNo('');
      setFormStockId('');
      setFormQuantity(1);
      setFormSerialNumbers(['']);

      setToastMessage(`✅ Successfully added ${qty} unit${qty > 1 ? 's' : ''} of "${addedName}" into Store Stock!`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCount = inventory.filter((i) => !i.isArchived && i.status === 'AVAILABLE').length;
  const soldCount = inventory.filter((i) => !i.isArchived && i.status === 'SOLD').length;
  const archivedCount = inventory.filter((i) => i.isArchived || i.status === 'ARCHIVED').length;

  const filteredItems = inventory.filter((item) => {
    const isItemArchived = !!item.isArchived || item.status === 'ARCHIVED';

    // If filtering specifically for ARCHIVED
    if (filterStatus === 'ARCHIVED') {
      if (!isItemArchived) return false;
    } else if (filterStatus === 'ALL') {
      // "ALL Active": items currently in store or logged (excluding archived items that left store)
      if (isItemArchived) return false;
    } else {
      // AVAILABLE or SOLD active items only
      if (isItemArchived) return false;
      if (item.status !== filterStatus) return false;
    }

    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.modelNo.toLowerCase().includes(search.toLowerCase()) ||
      item.brand.toLowerCase().includes(search.toLowerCase()) ||
      item.serialNo.toLowerCase().includes(search.toLowerCase()) ||
      (item.stockId && item.stockId.toLowerCase().includes(search.toLowerCase()));

    const matchesType = filterType === 'ALL' || item.type.toUpperCase() === filterType.toUpperCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-bold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-1.5 py-0.5 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-red-600 dark:text-red-400" />
            In-Store Stock Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real physical inventory available on-site at Lakhi Airconditioners store. (No brand warehouse or shipping stock).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all border border-slate-700/60 active:scale-98"
            title="Open camera to scan QR or carton barcode"
          >
            <Camera className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Scan QR / Label</span>
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-red-600/30 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add In-Store Stock</span>
          </button>
        </div>
      </div>

      {/* Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Available In Store
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {availableCount}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Sold / Invoiced
          </span>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
            {soldCount}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Archived (Left Store)
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {archivedCount}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Logged
          </span>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {inventory.length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, model, serial, stock ID..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status filter */}
          {(['ALL', 'AVAILABLE', 'SOLD', 'ARCHIVED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === st
                  ? st === 'ARCHIVED'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'ARCHIVED' ? '📦 Archived (Left Store)' : st === 'ALL' ? 'All Active' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Items Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3">Stock ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Product Name & Model</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Carton Barcode / Serial</th>
                <th className="px-4 py-3">Selling Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No matching stock items in store. Click "+ Add In-Store Stock" to log inventory.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 text-[11px] font-black">
                          {item.stockId || `${item.serialNo || item.id}-${idx + 1}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">SKU: {item.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.modelNo}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {item.brand}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {item.serialNo ? (
                        <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                          <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.serialNo}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      ₹{item.sellingPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.isArchived || item.status === 'ARCHIVED'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                            : item.status === 'AVAILABLE'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {item.isArchived || item.status === 'ARCHIVED' ? 'ARCHIVED' : item.status}
                      </span>
                      {item.assignedInvoiceId && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Inv: {item.assignedInvoiceId}
                        </div>
                      )}
                      {(item.isArchived || item.status === 'ARCHIVED') && item.archivedReason && (
                        <div className="text-[9px] text-amber-600 dark:text-amber-400 italic mt-0.5 max-w-[120px] truncate" title={item.archivedReason}>
                          {item.archivedReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === 'AVAILABLE' && !item.isArchived && (
                          <>
                            {onBillItem && (
                              <button
                                onClick={() => onBillItem(item)}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs flex items-center gap-1"
                                title="Create Bill with this Item"
                              >
                                <ShoppingBag className="w-3 h-3" />
                                + Bill Item
                              </button>
                            )}
                            <button
                              onClick={() => markInventorySold(item.id)}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg text-[11px] font-semibold transition-colors"
                              title="Mark as Sold"
                            >
                              Mark Sold
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedItemForLabel(item)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="View / Print Product QR Code Label"
                        >
                          <QrCode className="w-3.5 h-3.5 text-red-500" />
                        </button>
                        <button
                          onClick={() => handleStartDuplicate(item)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Duplicate / Add More Units of this Product"
                        >
                          <Copy className="w-3.5 h-3.5 text-indigo-500" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Item Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {item.isArchived || item.status === 'ARCHIVED' ? (
                          <button
                            onClick={() => unarchiveInventoryItem(item.id)}
                            className="p-1.5 text-amber-600 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Restore unit back to In-Store Available Stock"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Archive stock item ${item.name} (${item.serialNo})? It has left the store.`)) {
                                archiveInventoryItem(item.id, 'Manually marked as left the store / installed');
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Archive Item (Left Store & Installed)"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Delete stock item ${item.name}?`)) {
                              deleteInventoryItem(item.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Stock Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Inward In-Store Stock</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Record equipment available on premises</p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStock} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Scan with Camera Shortcut Banner */}
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-red-600 text-white rounded-lg shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="block font-bold text-slate-900 dark:text-white text-xs">
                      Scan Carton Label or QR Code?
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Point camera to auto-fill Model, Serial & Brand
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setIsScannerOpen(true);
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Scan Now
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Appliance Type:
                  </label>
                  <input
                    type="text"
                    required
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    placeholder="AC, TV, Refrigerator, Washer..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand:
                  </label>
                  <input
                    type="text"
                    required
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Daikin, Sony, LG..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Product Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. 1.5 Ton 5-Star Inverter Split AC"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Model Number / Series:
                </label>
                <input
                  type="text"
                  required
                  value={formModelNo}
                  onChange={(e) => setFormModelNo(e.target.value)}
                  placeholder="e.g. FTKF50TV16U"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              {/* Price and Quantity Inward Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Selling Price (₹ per Unit):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    placeholder="e.g. 45000"
                    className="w-full font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Quantity (Units to Add):
                    </label>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                      {formQuantity} {formQuantity === 1 ? 'Unit' : 'Units'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(formQuantity - 1)}
                      disabled={formQuantity <= 1}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-40 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={formQuantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      className="flex-1 text-center font-bold px-2 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(formQuantity + 1)}
                      disabled={formQuantity >= 50}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-40 transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Quantity Buttons */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {[1, 2, 3, 5, 10].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => handleQuantityChange(qty)}
                        className={`flex-1 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          formQuantity === qty
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stock ID Configuration for Website (e.g. {sr no}-{id}) */}
              <div className="p-3 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Website Stock ID:
                    </label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Unique identifier for store stock (e.g. &#123;sr no&#125;-&#123;id&#125; or STK-01)
                    </span>
                  </div>
                  {formStockId && (
                    <button
                      type="button"
                      onClick={() => setFormStockId(stripRandomSuffix(formStockId))}
                      className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
                      title="Remove trailing random 4-digit codes from Stock ID"
                    >
                      <Scissors className="w-3 h-3" />
                      Remove 4 Digits
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={formStockId}
                  onChange={(e) => setFormStockId(e.target.value.toUpperCase())}
                  placeholder={
                    formSerialNo
                      ? `Auto: ${formSerialNo}-01 (or type custom stock ID)`
                      : 'Auto: {sr no}-{id} or custom stock ID'
                  }
                  className="w-full font-mono text-xs uppercase px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Preserves carton barcode unchanged while identifying each unit in stock.
                </p>
              </div>

              {/* Serial Number Handling Section */}
              {formQuantity === 1 ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Device Barcode / Serial No:
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateFormSerials}
                      className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formSerialNo}
                    onChange={(e) => {
                      setFormSerialNo(e.target.value);
                      setFormSerialNumbers([e.target.value]);
                    }}
                    placeholder="e.g. DKN-FTKF50-98124"
                    className="w-full font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              ) : (
                /* Multi-Unit Serial Number Batch Box */
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                        Serial Numbers for {formQuantity} Units
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAutoGenerateFormSerials}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                        title="Auto-fill clean sequential serial numbers for all units"
                      >
                        <Zap className="w-3 h-3" />
                        ⚡ Auto-Generate All Serials
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBulkPasteOpen(!isBulkPasteOpen)}
                        className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-lg text-[10px] font-bold transition-colors"
                      >
                        📋 {isBulkPasteOpen ? 'Close Paste' : 'Batch Paste'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Paste Area */}
                  {isBulkPasteOpen && (
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Paste Serials (separated by new line, commas, or spaces from scanner/sheet):
                      </label>
                      <textarea
                        rows={3}
                        value={bulkPasteText}
                        onChange={(e) => setBulkPasteText(e.target.value)}
                        placeholder="SN-1001&#10;SN-1002&#10;SN-1003"
                        className="w-full font-mono text-[11px] p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleApplyBulkPaste}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                        >
                          Apply Pasted Serials
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Individual Serial Input Rows */}
                  <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                    {Array.from({ length: formQuantity }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                          Unit #{idx + 1}:
                        </span>
                        <input
                          type="text"
                          value={formSerialNumbers[idx] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormSerialNumbers((prev) => {
                              const updated = [...prev];
                              updated[idx] = val;
                              return updated;
                            });
                          }}
                          placeholder={`Serial No for Unit #${idx + 1}`}
                          className="flex-1 font-mono text-[11px] px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm shadow-red-600/30 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    'Saving...'
                  ) : formQuantity > 1 ? (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      <span>Inward {formQuantity} Units into Stock</span>
                    </>
                  ) : (
                    'Add to Store Stock'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate / Clone Stock Units Modal */}
      {duplicateTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-xl">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    Duplicate / Add More Units
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Add identical units of this existing product to Store Stock
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDuplicateTargetItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDuplicate} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Product Summary Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="font-black text-slate-900 dark:text-white text-sm">
                  {duplicateTargetItem.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Brand: <strong>{duplicateTargetItem.brand}</strong></span>
                  <span>•</span>
                  <span>Model: <strong className="font-mono">{duplicateTargetItem.modelNo}</strong></span>
                  <span>•</span>
                  <span>Price: <strong className="text-emerald-600">₹{duplicateTargetItem.sellingPrice.toLocaleString('en-IN')}</strong></span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  Original Item Serial: {duplicateTargetItem.serialNo || 'None'}
                </div>
              </div>

              {/* Quantity Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    How many additional units to add?
                  </label>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    +{duplicateQuantity} New {duplicateQuantity === 1 ? 'Unit' : 'Units'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDuplicateQtyChange(duplicateQuantity - 1)}
                    disabled={duplicateQuantity <= 1}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-40 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={duplicateQuantity}
                    onChange={(e) => handleDuplicateQtyChange(parseInt(e.target.value) || 1)}
                    className="flex-1 text-center font-bold px-2 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleDuplicateQtyChange(duplicateQuantity + 1)}
                    disabled={duplicateQuantity >= 20}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex items-center gap-1 mt-1.5">
                  {[1, 2, 3, 5].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => handleDuplicateQtyChange(qty)}
                      className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                        duplicateQuantity === qty
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      +{qty} Unit{qty > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Serial Numbers for Cloned Units */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                    New Serial Numbers ({duplicateQuantity}):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (duplicateTargetItem) {
                        const serials = generateSequentialSerials(
                          duplicateTargetItem.brand,
                          duplicateTargetItem.modelNo,
                          duplicateQuantity,
                          duplicateTargetItem.serialNo
                        );
                        setDuplicateSerials(serials);
                      }
                    }}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    Auto-Generate
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {Array.from({ length: duplicateQuantity }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[10px] font-bold text-slate-500">
                        Unit #{idx + 1}:
                      </span>
                      <input
                        type="text"
                        value={duplicateSerials[idx] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDuplicateSerials((prev) => {
                            const updated = [...prev];
                            updated[idx] = val;
                            return updated;
                          });
                        }}
                        placeholder={`Serial No for Unit #${idx + 1}`}
                        className="flex-1 font-mono text-[11px] px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDuplicateTargetItem(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDuplicating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  {isDuplicating ? (
                    'Duplicating...'
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Confirm & Inward {duplicateQuantity} Unit{duplicateQuantity > 1 ? 's' : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Edit In-Store Stock</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Update appliance specs or stock status</p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Appliance Type:
                  </label>
                  <input
                    type="text"
                    required
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand:
                  </label>
                  <input
                    type="text"
                    required
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Product Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Model Number / Series:
                </label>
                <input
                  type="text"
                  required
                  value={editModelNo}
                  onChange={(e) => setEditModelNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Device Barcode / Serial No:
                  </label>
                  <input
                    type="text"
                    value={editSerialNo}
                    onChange={(e) => setEditSerialNo(e.target.value)}
                    className="w-full font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Selling Price (₹):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Website Stock ID */}
              <div className="p-3 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Website Stock ID:
                  </label>
                  {editStockId && (
                    <button
                      type="button"
                      onClick={() => setEditStockId(stripRandomSuffix(editStockId))}
                      className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
                      title="Remove 4-digit random number from Stock ID"
                    >
                      <Scissors className="w-3 h-3" />
                      Remove 4 Digits
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={editStockId}
                  onChange={(e) => setEditStockId(e.target.value.toUpperCase())}
                  placeholder="e.g. DKN-FTKF50-01"
                  className="w-full font-mono text-xs uppercase px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
                <p className="text-[10px] text-slate-500">
                  Differentiates this unit in store while carton barcode stays intact.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Inventory Status:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold"
                >
                  <option value="AVAILABLE">AVAILABLE (In Store Godown)</option>
                  <option value="SOLD">SOLD / INVOICED</option>
                  <option value="ARCHIVED">ARCHIVED (Product Left Store & Installed)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm shadow-red-600/30"
                >
                  {isUpdating ? 'Saving...' : 'Update Stock Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <InventoryQrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        inventory={inventory}
        shipments={shipments}
        invoices={invoices}
        onUpdateShipmentStatus={updateShipmentStatus}
        onAddShipmentTrackingUpdate={addShipmentTrackingUpdate}
        onOpenAddItemWithData={handleOpenAddWithScannedData}
        onQuickAddItemDirect={handleQuickAddDirect}
        onEditItem={handleStartEdit}
        onBillItem={onBillItem}
        onHighlightItemInTable={(itemId) => {
          const found = inventory.find((i) => i.id === itemId);
          if (found) {
            setSearch(found.serialNo || found.modelNo || found.name);
          }
        }}
        onToggleItemSold={(itemId) => {
          const found = inventory.find((i) => i.id === itemId);
          if (found) {
            updateInventoryItem(itemId, {
              status: found.status === 'AVAILABLE' ? 'SOLD' : 'AVAILABLE',
            });
          }
        }}
      />

      {/* Product QR Label Sticker Modal */}
      <ProductQrLabelModal
        item={selectedItemForLabel}
        onClose={() => setSelectedItemForLabel(null)}
      />
    </div>
  );
};
