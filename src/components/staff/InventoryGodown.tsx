import React, { useState, useMemo } from 'react';
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
  Hash,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { InventoryItem, StockStatus } from '../../types';
import { InventoryQrScannerModal } from './InventoryQrScannerModal';
import { ProductQrLabelModal } from './ProductQrLabelModal';
import { ProductBarcodeModal } from './ProductBarcodeModal';
import { stripRandomSuffix, generateRandomCode } from '../../utils/idGenerator';

interface InventoryGodownProps {
  onBillItem?: (item: InventoryItem) => void;
  onOpenTally?: (tab?: 'IMPORT' | 'EXPORT' | 'GUIDE', category?: any) => void;
}

export const InventoryGodown: React.FC<InventoryGodownProps> = ({ onBillItem, onOpenTally }) => {
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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'SOLD' | 'ARCHIVED' | 'NEEDS_BARCODE'>('ALL');
  const [stockViewLayout, setStockViewLayout] = useState<'GROUPED' | 'LIST'>('GROUPED');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State for Adding In-Store Stock (with multi-unit & batch support)
  const [formName, setFormName] = useState('');
  const [formModelNo, setFormModelNo] = useState('');
  const [formIndoorModelNo, setFormIndoorModelNo] = useState('');
  const [formOutdoorModelNo, setFormOutdoorModelNo] = useState('');
  const [formType, setFormType] = useState('AC');
  const [formBrand, setFormBrand] = useState('');
  const [formSerialNo, setFormSerialNo] = useState('');
  const [formStockId, setFormStockId] = useState('');
  const [formStockIncludePrefix, setFormStockIncludePrefix] = useState(true);
  const [formStockIncludeDigits, setFormStockIncludeDigits] = useState(false);
  const [formPrice, setFormPrice] = useState<number | ''>('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formSerialNumbers, setFormSerialNumbers] = useState<string[]>(['']);
  const [formIndoorSerial, setFormIndoorSerial] = useState('');
  const [formOutdoorSerial, setFormOutdoorSerial] = useState('');
  const [formIndoorSerials, setFormIndoorSerials] = useState<string[]>(['']);
  const [formOutdoorSerials, setFormOutdoorSerials] = useState<string[]>(['']);
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
  const [editIndoorModelNo, setEditIndoorModelNo] = useState('');
  const [editOutdoorModelNo, setEditOutdoorModelNo] = useState('');
  const [editType, setEditType] = useState('AC');
  const [editBrand, setEditBrand] = useState('');
  const [editSerialNo, setEditSerialNo] = useState('');
  const [editIndoorSerial, setEditIndoorSerial] = useState('');
  const [editOutdoorSerial, setEditOutdoorSerial] = useState('');
  const [editStockId, setEditStockId] = useState('');
  const [editStockIncludePrefix, setEditStockIncludePrefix] = useState(true);
  const [editStockIncludeDigits, setEditStockIncludeDigits] = useState(false);
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editStatus, setEditStatus] = useState<StockStatus>('AVAILABLE');
  const [isUpdating, setIsUpdating] = useState(false);

  // QR Scanner Modal State & Product Label Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTargetField, setScannerTargetField] = useState<{
    target:
      | 'formModelNo'
      | 'formIndoorModelNo'
      | 'formOutdoorModelNo'
      | 'formSerialNo'
      | 'formIndoorSerial'
      | 'formOutdoorSerial'
      | 'formMultiSerial'
      | 'formMultiIndoor'
      | 'formMultiOutdoor'
      | 'editModelNo'
      | 'editIndoorModelNo'
      | 'editOutdoorModelNo'
      | 'editSerialNo'
      | 'editIndoorSerial'
      | 'editOutdoorSerial';
    index?: number;
    label: string;
  } | null>(null);
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<InventoryItem | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedItemForBarcode, setSelectedItemForBarcode] = useState<InventoryItem | null>(null);
  const [selectedBarcodeBatchIds, setSelectedBarcodeBatchIds] = useState<string[] | undefined>(undefined);

  // Quick toggle QR Code Added status for an inventory unit
  const handleToggleItemBarcode = async (item: InventoryItem) => {
    const nextVal = !item.barcodeAdded;
    try {
      await updateInventoryItem(item.id, {
        barcodeAdded: nextVal,
        barcodePrintedAt: nextVal ? new Date().toISOString() : undefined,
      });
      setToastMessage(
        nextVal
          ? `Marked "${item.name}" (${item.serialNo || item.id}) as QR Code Added (excluded from Print All).`
          : `Marked "${item.name}" as Needs QR Code.`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to update status in Firebase:', err);
      alert('Error updating QR status: ' + (err.message || 'Unknown error'));
    }
  };

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
      while (next.length < qty) next.push('');
      return next.slice(0, qty);
    });
    setFormIndoorSerials((prev) => {
      const next = [...prev];
      while (next.length < qty) next.push('');
      return next.slice(0, qty);
    });
    setFormOutdoorSerials((prev) => {
      const next = [...prev];
      while (next.length < qty) next.push('');
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

  const handleScannedFieldExtracted = (val: string) => {
    if (!scannerTargetField) return;
    const clean = val.trim();
    switch (scannerTargetField.target) {
      case 'formModelNo':
        setFormModelNo(clean);
        break;
      case 'formIndoorModelNo':
        setFormIndoorModelNo(clean);
        break;
      case 'formOutdoorModelNo':
        setFormOutdoorModelNo(clean);
        break;
      case 'formSerialNo':
        setFormSerialNo(clean);
        setFormSerialNumbers((prev) => {
          const n = [...prev];
          n[0] = clean;
          return n;
        });
        break;
      case 'formIndoorSerial':
        setFormIndoorSerial(clean);
        setFormIndoorSerials((prev) => {
          const n = [...prev];
          n[0] = clean;
          return n;
        });
        break;
      case 'formOutdoorSerial':
        setFormOutdoorSerial(clean);
        setFormOutdoorSerials((prev) => {
          const n = [...prev];
          n[0] = clean;
          return n;
        });
        break;
      case 'formMultiSerial':
        if (scannerTargetField.index !== undefined) {
          setFormSerialNumbers((prev) => {
            const next = [...prev];
            next[scannerTargetField.index!] = clean;
            return next;
          });
        }
        break;
      case 'formMultiIndoor':
        if (scannerTargetField.index !== undefined) {
          setFormIndoorSerials((prev) => {
            const next = [...prev];
            next[scannerTargetField.index!] = clean;
            return next;
          });
        }
        break;
      case 'formMultiOutdoor':
        if (scannerTargetField.index !== undefined) {
          setFormOutdoorSerials((prev) => {
            const next = [...prev];
            next[scannerTargetField.index!] = clean;
            return next;
          });
        }
        break;
      case 'editModelNo':
        setEditModelNo(clean);
        break;
      case 'editIndoorModelNo':
        setEditIndoorModelNo(clean);
        break;
      case 'editOutdoorModelNo':
        setEditOutdoorModelNo(clean);
        break;
      case 'editSerialNo':
        setEditSerialNo(clean);
        break;
      case 'editIndoorSerial':
        setEditIndoorSerial(clean);
        break;
      case 'editOutdoorSerial':
        setEditOutdoorSerial(clean);
        break;
    }
    setScannerTargetField(null);
    setIsScannerOpen(false);
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
    indoorModelNo?: string;
    outdoorModelNo?: string;
    brand?: string;
    serialNo?: string;
    indoorUnitSerial?: string;
    outdoorUnitSerial?: string;
    price?: number;
    type?: string;
  }) => {
    setFormName(data.name || '');
    setFormModelNo(data.modelNo || '');
    setFormIndoorModelNo(data.indoorModelNo || '');
    setFormOutdoorModelNo(data.outdoorModelNo || '');
    setFormBrand(data.brand || '');
    setFormSerialNo(data.serialNo || data.indoorUnitSerial || '');
    setFormIndoorSerial(data.indoorUnitSerial || (data.type === 'AC' ? data.serialNo : '') || '');
    setFormOutdoorSerial(data.outdoorUnitSerial || '');
    setFormPrice(data.price ?? '');
    setFormType(data.type || 'AC');
    setFormQuantity(1);
    setFormSerialNumbers([data.serialNo || data.indoorUnitSerial || '']);
    setFormIndoorSerials([data.indoorUnitSerial || (data.type === 'AC' ? data.serialNo : '') || '']);
    setFormOutdoorSerials([data.outdoorUnitSerial || '']);
    setIsAddOpen(true);
  };

  const handleQuickAddDirect = async (item: {
    name: string;
    modelNo: string;
    indoorModelNo?: string;
    outdoorModelNo?: string;
    type: string;
    brand: string;
    serialNo: string;
    indoorUnitSerial?: string;
    outdoorUnitSerial?: string;
    sellingPrice: number;
  }) => {
    await addInventoryItem({
      name: item.name,
      modelNo: item.modelNo,
      indoorModelNo: item.indoorModelNo,
      outdoorModelNo: item.outdoorModelNo,
      type: item.type,
      brand: item.brand,
      serialNo: item.serialNo,
      indoorUnitSerial: item.indoorUnitSerial,
      outdoorUnitSerial: item.outdoorUnitSerial,
      sellingPrice: item.sellingPrice,
    });
  };

  const handleStartEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditModelNo(item.modelNo);
    setEditIndoorModelNo(item.indoorModelNo || '');
    setEditOutdoorModelNo(item.outdoorModelNo || '');
    setEditType(item.type);
    setEditBrand(item.brand);
    setEditSerialNo(item.serialNo);
    setEditIndoorSerial(item.indoorUnitSerial || (item.type === 'AC' ? item.serialNo : ''));
    setEditOutdoorSerial(item.outdoorUnitSerial || '');
    setEditStockId(item.stockId || '');
    setEditStockIncludePrefix(true);
    setEditStockIncludeDigits(false);
    setEditPrice(item.sellingPrice);
    setEditStatus(item.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsUpdating(true);
    try {
      let finalEditStockId = editStockId.trim();
      if (finalEditStockId) {
        let clean = finalEditStockId.toUpperCase();
        if (!editStockIncludePrefix && clean.startsWith('STK-')) {
          clean = clean.slice(4);
        } else if (editStockIncludePrefix && !clean.startsWith('STK-')) {
          clean = `STK-${clean}`;
        }
        if (editStockIncludeDigits && !/[0-9]{4}$/.test(clean)) {
          clean = `${clean}-${generateRandomCode()}`;
        }
        finalEditStockId = clean;
      }

      const isAc = editType.trim().toUpperCase() === 'AC';
      const finalSerial = isAc
        ? (editIndoorSerial.trim() || editOutdoorSerial.trim() || editSerialNo.trim())
        : editSerialNo.trim();

      await updateInventoryItem(editingItem.id, {
        name: editName.trim(),
        modelNo: editModelNo.trim(),
        indoorModelNo: isAc ? (editIndoorModelNo.trim() || undefined) : undefined,
        outdoorModelNo: isAc ? (editOutdoorModelNo.trim() || undefined) : undefined,
        type: editType.trim(),
        brand: editBrand.trim(),
        serialNo: finalSerial,
        indoorUnitSerial: isAc ? (editIndoorSerial.trim() || undefined) : undefined,
        outdoorUnitSerial: isAc ? (editOutdoorSerial.trim() || undefined) : undefined,
        stockId: finalEditStockId || undefined,
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
        const isAc = formType.trim().toUpperCase() === 'AC';
        let indoorSN = isAc
          ? (qty === 1 ? (formIndoorSerial.trim() || formIndoorSerials[0]?.trim()) : formIndoorSerials[i]?.trim())
          : undefined;
        let outdoorSN = isAc
          ? (qty === 1 ? (formOutdoorSerial.trim() || formOutdoorSerials[0]?.trim()) : formOutdoorSerials[i]?.trim())
          : undefined;

        let serial =
          qty === 1
            ? (formSerialNo.trim() || formSerialNumbers[0]?.trim() || '')
            : (formSerialNumbers[i]?.trim() || '');

        if (isAc) {
          if (!serial) {
            serial = indoorSN || outdoorSN || `${(formBrand || 'LAK').slice(0, 3).toUpperCase()}-${(formModelNo || 'AC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}-${Date.now().toString().slice(-4)}${(i + 1).toString().padStart(2, '0')}`;
          }
          if (!indoorSN) indoorSN = serial;
        } else {
          if (!serial) {
            serial = `${(formBrand || 'LAK').slice(0, 3).toUpperCase()}-${(formModelNo || 'AC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}-${Date.now().toString().slice(-4)}${(i + 1).toString().padStart(2, '0')}`;
          }
        }

        let unitStockId: string | undefined = undefined;
        if (formStockId.trim()) {
          let clean = formStockId.trim().toUpperCase();
          if (!formStockIncludePrefix && clean.startsWith('STK-')) {
            clean = clean.slice(4);
          } else if (formStockIncludePrefix && !clean.startsWith('STK-')) {
            clean = `STK-${clean}`;
          }
          if (formStockIncludeDigits) {
            clean = `${clean}-${generateRandomCode()}`;
          }
          unitStockId = qty === 1
            ? clean
            : `${clean}-${(i + 1).toString().padStart(2, '0')}`;
        }

        await addInventoryItem({
          name: formName.trim(),
          modelNo: formModelNo.trim(),
          indoorModelNo: isAc ? (formIndoorModelNo.trim() || undefined) : undefined,
          outdoorModelNo: isAc ? (formOutdoorModelNo.trim() || undefined) : undefined,
          type: formType.trim(),
          brand: formBrand.trim(),
          serialNo: serial,
          indoorUnitSerial: isAc ? (indoorSN || undefined) : undefined,
          outdoorUnitSerial: isAc ? (outdoorSN || undefined) : undefined,
          sellingPrice: Number(formPrice) || 0,
          stockId: unitStockId,
        });
      }

      setIsAddOpen(false);
      const addedName = formName.trim();
      setFormName('');
      setFormModelNo('');
      setFormIndoorModelNo('');
      setFormOutdoorModelNo('');
      setFormSerialNo('');
      setFormIndoorSerial('');
      setFormOutdoorSerial('');
      setFormIndoorSerials(['']);
      setFormOutdoorSerials(['']);
      setFormStockId('');
      setFormStockIncludePrefix(true);
      setFormStockIncludeDigits(false);
      setFormQuantity(1);
      setFormSerialNumbers(['']);

      setToastMessage(`✅ Successfully added ${qty} unit${qty > 1 ? 's' : ''} of "${addedName}" into Store Stock!`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Strict archive helper: an item is archived if isArchived is true or status is ARCHIVED
  const isItemArchived = (item: InventoryItem) => Boolean(item.isArchived || item.status === 'ARCHIVED');

  const availableCount = inventory.filter((i) => !isItemArchived(i) && i.status === 'AVAILABLE').length;
  const soldCount = inventory.filter((i) => !isItemArchived(i) && i.status === 'SOLD').length;
  const activeInStoreCount = inventory.filter((i) => !isItemArchived(i)).length;
  const archivedCount = inventory.filter((i) => isItemArchived(i)).length;
  const needsBarcodeCount = inventory.filter((i) => !isItemArchived(i) && !i.barcodeAdded).length;

  // Strict filtering: Archived products ONLY show in the 'ARCHIVED' list, never in 'ALL' or other active lists
  const filteredItems = inventory.filter((item) => {
    const archived = isItemArchived(item);

    // If filtering specifically for ARCHIVED
    if (filterStatus === 'ARCHIVED') {
      if (!archived) return false;
    } else if (filterStatus === 'NEEDS_BARCODE') {
      if (archived || item.barcodeAdded) return false;
    } else {
      // In ALL, AVAILABLE, and SOLD: ARCHIVED PRODUCTS NEVER APPEAR
      if (archived) return false;
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    }

    const matchesSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.modelNo.toLowerCase().includes(search.toLowerCase()) ||
      item.brand.toLowerCase().includes(search.toLowerCase()) ||
      item.serialNo.toLowerCase().includes(search.toLowerCase()) ||
      (item.stockId && item.stockId.toLowerCase().includes(search.toLowerCase()));

    const matchesType = filterType === 'ALL' || item.type.toUpperCase() === filterType.toUpperCase();
    return matchesSearch && matchesType;
  });

  // Group products by Brand & Model Number
  interface ProductGroup {
    key: string;
    brand: string;
    modelNo: string;
    name: string;
    type: string;
    sellingPrice: number;
    items: InventoryItem[];
    availableCount: number;
    soldCount: number;
    archivedCount: number;
  }

  const groupedProducts: ProductGroup[] = useMemo(() => {
    const map = new Map<string, ProductGroup>();

    for (const item of filteredItems) {
      const brand = (item.brand || 'Other').trim();
      const model = (item.modelNo || 'Standard').trim();
      const key = `${brand.toUpperCase()}____${model.toUpperCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          brand,
          modelNo: model,
          name: item.name,
          type: item.type || 'AC',
          sellingPrice: item.sellingPrice,
          items: [],
          availableCount: 0,
          soldCount: 0,
          archivedCount: 0,
        });
      }

      const group = map.get(key)!;
      group.items.push(item);
      if (isItemArchived(item)) {
        group.archivedCount++;
      } else if (item.status === 'AVAILABLE') {
        group.availableCount++;
      } else if (item.status === 'SOLD') {
        group.soldCount++;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const bComp = a.brand.localeCompare(b.brand);
      if (bComp !== 0) return bComp;
      return a.modelNo.localeCompare(b.modelNo);
    });
  }, [filteredItems]);

  // Unique product types present in inventory
  const availableProductTypes = useMemo(() => {
    const types = new Set<string>();
    inventory.forEach((i) => {
      if (i.type && i.type.trim()) types.add(i.type.trim().toUpperCase());
    });
    return Array.from(types).sort();
  }, [inventory]);

  // Collapse / Expand handlers for product groups
  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAllGroups = () => setCollapsedGroups({});
  const collapseAllGroups = () => {
    const all: Record<string, boolean> = {};
    groupedProducts.forEach((g) => {
      all[g.key] = true;
    });
    setCollapsedGroups(all);
  };

  // Quick Inward another unit for a specific product group
  const handleQuickAddUnitForGroup = (group: ProductGroup) => {
    setFormName(group.name);
    setFormBrand(group.brand);
    setFormModelNo(group.modelNo);
    setFormType(group.type);
    setFormPrice(group.sellingPrice);
    setFormSerialNo('');
    const cleanModel = group.modelNo.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    setFormStockId(`STK-${cleanModel || 'UNIT'}`);
    setFormStockIncludePrefix(true);
    setFormStockIncludeDigits(false);
    setFormQuantity(1);
    setFormSerialNumbers(['']);
    setIsAddOpen(true);
  };

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
            onClick={() => {
              const active = filteredItems.find((it) => it.status === 'AVAILABLE') || filteredItems[0];
              if (active) setSelectedItemForLabel(active);
            }}
            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors border border-amber-300 dark:border-amber-800 active:scale-98"
            title="Make, share or print showroom product tag with Stock ID & price"
          >
            <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Product Tag</span>
          </button>
          <button
            onClick={() => {
              setSelectedItemForBarcode(null);
              setSelectedBarcodeBatchIds(undefined);
              setIsBarcodeModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 active:scale-98"
            title="Make & print multiple product internal QR codes with cutting lines"
          >
            <QrCode className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>Print QR Codes</span>
            {needsBarcodeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {needsBarcodeCount} New
              </span>
            )}
          </button>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all border border-slate-700/60 active:scale-98"
            title="Open camera to scan QR or carton barcode"
          >
            <Camera className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Scan QR / Label</span>
          </button>
          {onOpenTally && (
            <button
              onClick={() => onOpenTally('IMPORT', 'INVENTORY')}
              className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-98"
              title="Import Stock Items & AC Models directly from Tally Prime XML or Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Import Tally Stock</span>
            </button>
          )}
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-red-600/30 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add In-Store Stock</span>
          </button>
        </div>
      </div>

      {/* Metric Badges (Clickable to switch filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus('AVAILABLE')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterStatus === 'AVAILABLE'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
          } shadow-xs cursor-pointer`}
        >
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Available In Store
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {availableCount}
          </div>
          <span className="text-[10px] text-slate-400">Ready to bill / install</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('SOLD')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterStatus === 'SOLD'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 ring-2 ring-slate-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          } shadow-xs cursor-pointer`}
        >
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Sold / Invoiced
          </span>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
            {soldCount}
          </div>
          <span className="text-[10px] text-slate-400">Assigned to bill</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('NEEDS_BARCODE')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterStatus === 'NEEDS_BARCODE'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-2 ring-amber-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
          } shadow-xs cursor-pointer`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              🏷️ Needs QR Code
            </span>
            {needsBarcodeCount > 0 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItemForBarcode(null);
                  setSelectedBarcodeBatchIds(undefined);
                  setIsBarcodeModalOpen(true);
                }}
                className="text-[10px] font-bold text-amber-700 dark:text-amber-300 underline hover:text-amber-900"
              >
                Print
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {needsBarcodeCount}
          </div>
          <span className="text-[10px] text-slate-400">
            {needsBarcodeCount === 0 ? 'All stock QR codes printed' : 'Unprinted physical units'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterStatus === 'ALL'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-400 dark:border-red-700 ring-2 ring-red-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-red-300'
          } shadow-xs cursor-pointer`}
        >
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            All Active Store Stock
          </span>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {activeInStoreCount}
          </div>
          <span className="text-[10px] text-slate-400">In-store active stock • Zero archived</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('ARCHIVED')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterStatus === 'ARCHIVED'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-2 ring-amber-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
          } shadow-xs cursor-pointer`}
        >
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            📦 Archived Products
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {archivedCount}
          </div>
          <span className="text-[10px] text-slate-400">Customer site / left store</span>
        </button>
      </div>

      {/* Filter, Search and View Layout Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search input & Type filter */}
        <div className="flex items-center gap-2 w-full lg:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brand, model, serial, stock ID, name..."
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          {availableProductTypes.length > 1 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none cursor-pointer"
            >
              <option value="ALL">All Types</option>
              {availableProductTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Status filter buttons & View Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 w-full lg:w-auto">
          {/* Status filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Active ({activeInStoreCount})
            </button>
            <button
              onClick={() => setFilterStatus('AVAILABLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === 'AVAILABLE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Available ({availableCount})
            </button>
            <button
              onClick={() => setFilterStatus('SOLD')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === 'SOLD'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Sold ({soldCount})
            </button>
            <button
              onClick={() => setFilterStatus('NEEDS_BARCODE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterStatus === 'NEEDS_BARCODE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>⚠️ Needs QR Code</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filterStatus === 'NEEDS_BARCODE'
                  ? 'bg-black/20 text-white'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                {needsBarcodeCount}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('ARCHIVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === 'ARCHIVED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              📦 Archived ({archivedCount})
            </button>
          </div>

          {/* View Mode: Grouped by Model & Brand vs Flat List */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setStockViewLayout('GROUPED')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                stockViewLayout === 'GROUPED'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Group products by Model and Brand"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-red-500" />
              <span>Grouped</span>
            </button>
            <button
              type="button"
              onClick={() => setStockViewLayout('LIST')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                stockViewLayout === 'LIST'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Show flat table of all physical stock units"
            >
              <List className="w-3.5 h-3.5 text-slate-500" />
              <span>Flat List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Archived Products Notice Banner */}
      {filterStatus === 'ARCHIVED' && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200 font-medium">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>📦 Archived Products View:</strong> Showing {filteredItems.length} unit(s) that have left the store and are installed at customer sites. These items are strictly kept in this list and do NOT appear in All Active stock or sales billing pickers.
            </span>
          </div>
        </div>
      )}

      {/* Stock Items View: Grouped vs Flat List */}
      {stockViewLayout === 'GROUPED' ? (
        <div className="space-y-4">
          {/* Grouped Header Summary & Expand/Collapse All */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-2">
            <span>
              Showing {groupedProducts.length} Product Model{groupedProducts.length === 1 ? '' : 's'} • {filteredItems.length} Total Physical Unit{filteredItems.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandAllGroups}
                className="hover:text-slate-900 dark:hover:text-white hover:underline text-[11px]"
              >
                Expand All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={collapseAllGroups}
                className="hover:text-slate-900 dark:hover:text-white hover:underline text-[11px]"
              >
                Collapse All
              </button>
            </div>
          </div>

          {groupedProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              No matching equipment found in store. Click "+ Add In-Store Stock" to log inventory.
            </div>
          ) : (
            groupedProducts.map((group) => {
              const isCollapsed = collapsedGroups[group.key] ?? false;
              return (
                <div
                  key={group.key}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all"
                >
                  {/* Group Header Card */}
                  <div
                    onClick={() => toggleGroupCollapse(group.key)}
                    className="p-4 bg-slate-50/80 hover:bg-slate-100/80 dark:bg-slate-950/50 dark:hover:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                  >
                    {/* Brand Badge, Model Number & Name */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-transform"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-red-600" />
                        )}
                      </button>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-black uppercase tracking-wider shadow-xs">
                          {group.brand}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              {group.modelNo}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {group.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {group.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Unit Counts, Price & Quick Action */}
                    <div
                      className="flex items-center gap-3 flex-wrap self-end md:self-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Selling Price */}
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Unit Price</div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white font-mono">
                          ₹{group.sellingPrice.toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Status counts badges */}
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs font-bold">
                        <span className="text-slate-900 dark:text-white font-black text-sm font-mono mr-1">
                          {group.items.length} {group.items.length === 1 ? 'Unit' : 'Units'}
                        </span>
                        {group.availableCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
                            {group.availableCount} Available
                          </span>
                        )}
                        {group.soldCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                            {group.soldCount} Sold
                          </span>
                        )}
                        {group.archivedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                            {group.archivedCount} Archived
                          </span>
                        )}
                      </div>

                      {/* Product Tag for Showroom (Tag Icon) */}
                      {group.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const availableOrFirst = group.items.find((it) => it.status === 'AVAILABLE') || group.items[0];
                            setSelectedItemForLabel(availableOrFirst);
                          }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-800 flex items-center gap-1.5 transition-colors"
                          title={`View, Share & Print Showroom Product Tag for ${group.modelNo}`}
                        >
                          <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Product Tag</span>
                        </button>
                      )}

                      {/* Print QR Stickers for this Model (QR Code Icon) */}
                      {group.items.some((it) => !isItemArchived(it) && !it.barcodeAdded) && (
                        <button
                          type="button"
                          onClick={() => {
                            const unprinted = group.items
                              .filter((it) => !isItemArchived(it) && !it.barcodeAdded)
                              .map((it) => it.id);
                            setSelectedBarcodeBatchIds(unprinted);
                            setSelectedItemForBarcode(null);
                            setIsBarcodeModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 rounded-xl text-xs font-bold border border-red-300 dark:border-red-800 flex items-center gap-1.5 transition-colors"
                          title={`Print QR code stickers for unprinted units of ${group.modelNo}`}
                        >
                          <QrCode className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          <span>
                            Print QR ({group.items.filter((it) => !isItemArchived(it) && !it.barcodeAdded).length})
                          </span>
                        </button>
                      )}

                      {/* Quick Add Inward Unit of this Model */}
                      <button
                        type="button"
                        onClick={() => handleQuickAddUnitForGroup(group)}
                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-colors"
                        title="Inward Another Unit of this Model"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Inward Unit</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Units Table for this Product Group */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-white dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                            <th className="px-4 py-2 w-12 text-center">Unit</th>
                            <th className="px-4 py-2">Stock ID</th>
                            <th className="px-4 py-2">Carton Serial &amp; QR Status</th>
                            <th className="px-4 py-2">Unit Price</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {group.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-2.5 text-center font-bold font-mono text-slate-400 text-[11px]">
                                #{idx + 1}
                              </td>
                              <td className="px-4 py-2.5 font-mono">
                                <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 text-[11px] font-black">
                                  {item.stockId || `${item.serialNo || item.id}-${idx + 1}`}
                                </span>
                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">SKU: {item.id}</div>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                {item.type?.toUpperCase() === 'AC' ? (
                                  <div className="space-y-0.5 text-[10px]">
                                    <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                                      <span className="text-[8px] uppercase px-1 py-0.2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded font-black">IDU</span>
                                      {item.indoorModelNo && (
                                        <span className="text-[9px] text-blue-700 dark:text-blue-300 font-mono">[{item.indoorModelNo}]</span>
                                      )}
                                      <span>{item.indoorUnitSerial || item.serialNo || 'None'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                                      <span className="text-[8px] uppercase px-1 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-black">ODU</span>
                                      {item.outdoorModelNo && (
                                        <span className="text-[9px] text-indigo-700 dark:text-indigo-300 font-mono">[{item.outdoorModelNo}]</span>
                                      )}
                                      <span>{item.outdoorUnitSerial || 'None'}</span>
                                    </div>
                                  </div>
                                ) : item.serialNo ? (
                                  <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                                    <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{item.serialNo}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">None</span>
                                )}
                                {/* QR Code Added status toggle pill */}
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleItemBarcode(item)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                                      item.barcodeAdded
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                                    }`}
                                    title={
                                      item.barcodeAdded
                                        ? 'QR code marked as Added. Click to change to Needs QR.'
                                        : 'Needs QR Code. Click to mark as QR Code Added (excluded when selecting Print All).'
                                    }
                                  >
                                    {item.barcodeAdded ? (
                                      <>
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>QR Added</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        <span>Needs QR</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-bold font-mono text-slate-900 dark:text-white">
                                ₹{item.sellingPrice.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isItemArchived(item)
                                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                                      : item.status === 'AVAILABLE'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                  }`}
                                >
                                  {isItemArchived(item) ? 'ARCHIVED' : item.status}
                                </span>
                                {item.assignedInvoiceId && (
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    Inv: {item.assignedInvoiceId}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {item.status === 'AVAILABLE' && !isItemArchived(item) && (
                                    <>
                                      {onBillItem && (
                                        <button
                                          onClick={() => onBillItem(item)}
                                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs flex items-center gap-1"
                                          title="Create Bill with this Item"
                                        >
                                          <ShoppingBag className="w-3 h-3" />
                                          + Bill
                                        </button>
                                      )}
                                      <button
                                        onClick={() => markInventorySold(item.id)}
                                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg text-[11px] font-semibold transition-colors"
                                        title="Mark as Sold"
                                      >
                                        Mark Sold
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => setSelectedItemForLabel(item)}
                                    className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                    title="View / Print / Share Product Stock Tag (Showroom tag with Stock ID & Price)"
                                  >
                                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedItemForBarcode(item);
                                      setIsBarcodeModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Make & Print Product QR Code Sheet (Clean QR with Cut Lines)"
                                  >
                                    <QrCode className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
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
                                  {isItemArchived(item) ? (
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Flat List View (All Units in flat table) */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3">Stock ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Product Name &amp; Model</th>
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
                        {item.type?.toUpperCase() === 'AC' ? (
                          <div className="space-y-0.5 text-[10px]">
                            <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                              <span className="text-[8px] uppercase px-1 py-0.2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded font-black">IDU</span>
                              {item.indoorModelNo && (
                                <span className="text-[9px] text-blue-700 dark:text-blue-300 font-mono">[{item.indoorModelNo}]</span>
                              )}
                              <span>{item.indoorUnitSerial || item.serialNo || 'None'}</span>
                            </div>
                            <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                              <span className="text-[8px] uppercase px-1 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-black">ODU</span>
                              {item.outdoorModelNo && (
                                <span className="text-[9px] text-indigo-700 dark:text-indigo-300 font-mono">[{item.outdoorModelNo}]</span>
                              )}
                              <span>{item.outdoorUnitSerial || 'None'}</span>
                            </div>
                          </div>
                        ) : item.serialNo ? (
                          <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.serialNo}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                        {/* Barcode Added status toggle pill */}
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => handleToggleItemBarcode(item)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                              item.barcodeAdded
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                            }`}
                            title={
                              item.barcodeAdded
                                ? 'Barcode is marked as Added. Click to change to Needs Barcode.'
                                : 'Needs Barcode. Click to mark as Barcode Added (excluded when selecting Print All).'
                            }
                          >
                            {item.barcodeAdded ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Barcode Added</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                <span>Needs Barcode</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        ₹{item.sellingPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isItemArchived(item)
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                              : item.status === 'AVAILABLE'
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isItemArchived(item) ? 'ARCHIVED' : item.status}
                        </span>
                        {item.assignedInvoiceId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Inv: {item.assignedInvoiceId}
                          </div>
                        )}
                        {isItemArchived(item) && item.archivedReason && (
                          <div className="text-[9px] text-amber-600 dark:text-amber-400 italic mt-0.5 max-w-[120px] truncate" title={item.archivedReason}>
                            {item.archivedReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {item.status === 'AVAILABLE' && !isItemArchived(item) && (
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
                            className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            title="View / Print / Share Product Stock Tag (Showroom tag with Stock ID & Price)"
                          >
                            <Tag className="w-3.5 h-3.5 text-amber-500" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItemForBarcode(item);
                              setIsBarcodeModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Make & Print Product QR Code Sheet (Clean QR with Cut Lines)"
                          >
                            <QrCode className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
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
                          {isItemArchived(item) ? (
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
      )}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    {formType.trim().toUpperCase() === 'AC' ? 'Set Model Number / Series:' : 'Model Number / Series:'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTargetField({ target: 'formModelNo', label: 'Model Number' });
                      setIsScannerOpen(true);
                    }}
                    className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    title="Scan model barcode or QR"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Scan Model</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formModelNo}
                  onChange={(e) => setFormModelNo(e.target.value)}
                  placeholder="e.g. FTKF50TV16U"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                />
              </div>

              {/* If AC: Dedicated Indoor & Outdoor Model Numbers */}
              {formType.trim().toUpperCase() === 'AC' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-900/40">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-blue-700 dark:text-blue-300 text-xs">
                        Indoor Model (IDU):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetField({ target: 'formIndoorModelNo', label: 'Indoor Model (IDU)' });
                          setIsScannerOpen(true);
                        }}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Scan IDU Model"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Scan IDU Model</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formIndoorModelNo}
                      onChange={(e) => setFormIndoorModelNo(e.target.value)}
                      placeholder="e.g. FTKF50TV16U-IDU"
                      className="w-full font-mono text-xs px-3 py-2 border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                        Outdoor Model (ODU):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetField({ target: 'formOutdoorModelNo', label: 'Outdoor Model (ODU)' });
                          setIsScannerOpen(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Scan ODU Model"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Scan ODU Model</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formOutdoorModelNo}
                      onChange={(e) => setFormOutdoorModelNo(e.target.value)}
                      placeholder="e.g. RKF50TV16U-ODU"
                      className="w-full font-mono text-xs px-3 py-2 border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

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
                      title="Remove trailing random 4 digits"
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

                {formStockId.trim() ? (
                  <div className="space-y-2 pt-1 border-t border-red-200 dark:border-red-900/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormStockIncludePrefix(!formStockIncludePrefix)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          formStockIncludePrefix
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                        title="Turn Stock ID prefix (STK-) On or Off"
                      >
                        <Tag className="w-3 h-3" />
                        <span>Prefix (STK-)</span>
                        <span className="text-[10px] font-black uppercase ml-0.5">
                          {formStockIncludePrefix ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormStockIncludeDigits(!formStockIncludeDigits)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          formStockIncludeDigits
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                        title="Turn 4-digit code On or Off"
                      >
                        <Hash className="w-3 h-3" />
                        <span>Add 4 Digits</span>
                        <span className="text-[10px] font-black uppercase ml-0.5">
                          {formStockIncludeDigits ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Resulting Stock ID:</span>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400 text-xs">
                        {(() => {
                          let clean = formStockId.trim().toUpperCase();
                          if (!formStockIncludePrefix && clean.startsWith('STK-')) {
                            clean = clean.slice(4);
                          } else if (formStockIncludePrefix && !clean.startsWith('STK-')) {
                            clean = `STK-${clean}`;
                          }
                          if (formStockIncludeDigits) {
                            clean = `${clean}-XXXX`;
                          }
                          return clean;
                        })()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pre-made Stock ID has prefix &amp; digits ON. To customize, enter custom ID above.
                  </p>
                )}
              </div>

              {/* Serial Number Handling Section: If AC, strictly replace SR number with Indoor and Outdoor Serials */}
              {formType.trim().toUpperCase() === 'AC' ? (
                formQuantity === 1 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-900/40">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-blue-700 dark:text-blue-300 text-xs">
                          Indoor Unit Serial (IDU):
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetField({ target: 'formIndoorSerial', label: 'Indoor Serial (IDU)' });
                            setIsScannerOpen(true);
                          }}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Scan IDU</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={formIndoorSerial}
                        onChange={(e) => {
                          setFormIndoorSerial(e.target.value);
                          setFormSerialNo(e.target.value);
                        }}
                        placeholder="e.g. IDU-DKN-98124"
                        className="w-full font-mono text-xs px-3 py-2 border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                          Outdoor Unit Serial (ODU):
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetField({ target: 'formOutdoorSerial', label: 'Outdoor Serial (ODU)' });
                            setIsScannerOpen(true);
                          }}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Scan ODU</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={formOutdoorSerial}
                        onChange={(e) => setFormOutdoorSerial(e.target.value)}
                        placeholder="e.g. ODU-DKN-98125"
                        className="w-full font-mono text-xs px-3 py-2 border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  /* Multi-Unit AC Serial Batch Box (IDU & ODU per unit) */
                  <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/40 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-blue-200 dark:border-blue-900/40">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                          AC Serials for {formQuantity} Units (Indoor IDU &amp; Outdoor ODU)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const idus = generateSequentialSerials(formBrand, `${formModelNo}-IDU`, formQuantity);
                          const odus = generateSequentialSerials(formBrand, `${formModelNo}-ODU`, formQuantity);
                          setFormIndoorSerials(idus);
                          setFormOutdoorSerials(odus);
                          setFormSerialNumbers(idus);
                        }}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Zap className="w-3 h-3" />
                        ⚡ Auto-Generate All IDU/ODU
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                      {Array.from({ length: formQuantity }).map((_, idx) => (
                        <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1.5">
                          <span className="text-[10px] font-black text-blue-700 dark:text-blue-300">
                            Unit #{idx + 1}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={formIndoorSerials[idx] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormIndoorSerials((prev) => {
                                    const next = [...prev];
                                    next[idx] = val;
                                    return next;
                                  });
                                }}
                                placeholder={`Indoor SN (IDU) #${idx + 1}`}
                                className="flex-1 font-mono text-[11px] px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setScannerTargetField({ target: 'formMultiIndoor', index: idx, label: `Unit #${idx + 1} Indoor SN` });
                                  setIsScannerOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg"
                                title="Scan IDU Barcode"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={formOutdoorSerials[idx] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormOutdoorSerials((prev) => {
                                    const next = [...prev];
                                    next[idx] = val;
                                    return next;
                                  });
                                }}
                                placeholder={`Outdoor SN (ODU) #${idx + 1}`}
                                className="flex-1 font-mono text-[11px] px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setScannerTargetField({ target: 'formMultiOutdoor', index: idx, label: `Unit #${idx + 1} Outdoor SN` });
                                  setIsScannerOpen(true);
                                }}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg"
                                title="Scan ODU Barcode"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : formQuantity === 1 ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      Device Barcode / Serial No:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetField({ target: 'formSerialNo', label: 'Device Serial No' });
                          setIsScannerOpen(true);
                        }}
                        className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Scan Barcode</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoGenerateFormSerials}
                        className="text-[11px] font-bold text-slate-500 hover:underline flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                        Auto-generate
                      </button>
                    </div>
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
                /* Multi-Unit Serial Number Batch Box (Non-AC) */
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
                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetField({ target: 'formMultiSerial', index: idx, label: `Unit #${idx + 1} Serial` });
                            setIsScannerOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                          title="Scan Serial Barcode"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    {editType.trim().toUpperCase() === 'AC' ? 'Set Model Number / Series:' : 'Model Number / Series:'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTargetField({ target: 'editModelNo', label: 'Model Number' });
                      setIsScannerOpen(true);
                    }}
                    className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Scan Model</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editModelNo}
                  onChange={(e) => setEditModelNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                />
              </div>

              {/* If AC, show dedicated Indoor & Outdoor Model Numbers */}
              {editType.trim().toUpperCase() === 'AC' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-900/40">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-blue-700 dark:text-blue-300 text-xs">
                        Indoor Model (IDU):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetField({ target: 'editIndoorModelNo', label: 'Indoor Model (IDU)' });
                          setIsScannerOpen(true);
                        }}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Scan IDU Model"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Scan IDU Model</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editIndoorModelNo}
                      onChange={(e) => setEditIndoorModelNo(e.target.value)}
                      placeholder="e.g. FTKF50TV16U-IDU"
                      className="w-full font-mono text-xs px-3 py-2 border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                        Outdoor Model (ODU):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetField({ target: 'editOutdoorModelNo', label: 'Outdoor Model (ODU)' });
                          setIsScannerOpen(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Scan ODU Model"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Scan ODU Model</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editOutdoorModelNo}
                      onChange={(e) => setEditOutdoorModelNo(e.target.value)}
                      placeholder="e.g. RKF50TV16U-ODU"
                      className="w-full font-mono text-xs px-3 py-2 border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Serials & Pricing: If AC, strictly show Indoor and Outdoor Serial only */}
              {editType.trim().toUpperCase() === 'AC' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/40">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-blue-700 dark:text-blue-300 text-xs">
                          Indoor Unit Serial (IDU):
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetField({ target: 'editIndoorSerial', label: 'Indoor Serial (IDU)' });
                            setIsScannerOpen(true);
                          }}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Scan IDU</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editIndoorSerial}
                        onChange={(e) => {
                          setEditIndoorSerial(e.target.value);
                          setEditSerialNo(e.target.value);
                        }}
                        placeholder="e.g. IDU-DKN-98124"
                        className="w-full font-mono text-xs px-3 py-2 border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                          Outdoor Unit Serial (ODU):
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetField({ target: 'editOutdoorSerial', label: 'Outdoor Serial (ODU)' });
                            setIsScannerOpen(true);
                          }}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Scan ODU</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editOutdoorSerial}
                        onChange={(e) => setEditOutdoorSerial(e.target.value)}
                        placeholder="e.g. ODU-DKN-98125"
                        className="w-full font-mono text-xs px-3 py-2 border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
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
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        Device Barcode / Serial No:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTargetField({ target: 'editSerialNo', label: 'Device Serial No' });
                          setIsScannerOpen(true);
                        }}
                        className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Scan</span>
                      </button>
                    </div>
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
              )}

              {/* Website Stock ID */}
              <div className="p-3 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Website Stock ID:
                  </label>
                  {editStockId && (
                    <button
                      type="button"
                      onClick={() => setEditStockId(stripRandomSuffix(editStockId))}
                      className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
                      title="Remove trailing random 4 digits"
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
                  placeholder="e.g. DKN-FTKF50-01 (or custom Stock ID)"
                  className="w-full font-mono text-xs uppercase px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />

                {editStockId.trim() ? (
                  <div className="space-y-2 pt-1 border-t border-red-200 dark:border-red-900/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditStockIncludePrefix(!editStockIncludePrefix)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          editStockIncludePrefix
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                        title="Turn Stock ID prefix (STK-) On or Off"
                      >
                        <Tag className="w-3 h-3" />
                        <span>Prefix (STK-)</span>
                        <span className="text-[10px] font-black uppercase ml-0.5">
                          {editStockIncludePrefix ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditStockIncludeDigits(!editStockIncludeDigits)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          editStockIncludeDigits
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                        title="Turn 4-digit code On or Off"
                      >
                        <Hash className="w-3 h-3" />
                        <span>Add 4 Digits</span>
                        <span className="text-[10px] font-black uppercase ml-0.5">
                          {editStockIncludeDigits ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Resulting Stock ID:</span>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400 text-xs">
                        {(() => {
                          let clean = editStockId.trim().toUpperCase();
                          if (!editStockIncludePrefix && clean.startsWith('STK-')) {
                            clean = clean.slice(4);
                          } else if (editStockIncludePrefix && !clean.startsWith('STK-')) {
                            clean = `STK-${clean}`;
                          }
                          if (editStockIncludeDigits && !/[0-9]{4}$/.test(clean)) {
                            clean = `${clean}-XXXX`;
                          }
                          return clean;
                        })()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pre-made Stock ID has prefix &amp; digits ON.
                  </p>
                )}
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
        onOpenBarcode={() => {
          setSelectedItemForBarcode(selectedItemForLabel);
          setIsBarcodeModalOpen(true);
        }}
      />

      {/* Product Internal QR Code Studio & Multi-Print Modal */}
      <ProductBarcodeModal
        isOpen={isBarcodeModalOpen}
        item={selectedItemForBarcode}
        allItems={inventory}
        initialSelectedIds={selectedBarcodeBatchIds}
        onClose={() => {
          setIsBarcodeModalOpen(false);
          setSelectedItemForBarcode(null);
          setSelectedBarcodeBatchIds(undefined);
        }}
      />
    </div>
  );
};
