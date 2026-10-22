import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  FlipHorizontal,
  Zap,
  ZapOff,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Barcode,
  Boxes,
  Plus,
  ShoppingBag,
  Edit2,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Truck,
  QrCode,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InventoryItem, Shipment, Invoice } from '../../types';
import { scanCanvasForCodes, scanImageForCodes } from '../../utils/scannerHelper';
import { detectAcBarcodeDetails, extractCleanValueForTarget } from '../../utils/acScannerHelper';

interface InventoryQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  shipments?: Shipment[];
  invoices?: Invoice[];
  scanTargetPrompt?: string; // Optional prompt when scanning for a specific input field
  onScannedValueExtracted?: (value: string, role?: string) => void;
  onOpenAddItemWithData: (data: {
    name?: string;
    modelNo?: string;
    indoorModelNo?: string;
    outdoorModelNo?: string;
    type?: string;
    brand?: string;
    serialNo?: string;
    indoorUnitSerial?: string;
    outdoorUnitSerial?: string;
    price?: number;
  }) => void;
  onQuickAddItemDirect?: (data: {
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
  }) => Promise<void>;
  onEditItem?: (item: InventoryItem) => void;
  onBillItem?: (item: InventoryItem) => void;
  onHighlightItemInTable?: (itemId: string) => void;
  onToggleItemSold?: (itemId: string) => void;
  onUpdateShipmentStatus?: (
    shipmentId: string,
    status: Shipment['status'],
    outForDeliveryEnabled?: boolean,
    driverName?: string,
    driverPhone?: string,
    storeContactPhone?: string,
    customMessage?: string,
    location?: string,
    customTimestamp?: string
  ) => Promise<void>;
  onAddShipmentTrackingUpdate?: (
    shipmentId: string,
    message: string,
    location?: string,
    customTimestamp?: string
  ) => Promise<void>;
}

interface ParsedQrResult {
  raw: string;
  cleanValue?: string;
  stockId?: string;
  name?: string;
  modelNo?: string;
  indoorModelNo?: string;
  outdoorModelNo?: string;
  brand?: string;
  type?: string;
  serialNo?: string;
  indoorUnitSerial?: string;
  outdoorUnitSerial?: string;
  price?: number;
  format?: string;
  detectedRole?: 'serialNo' | 'modelNo' | 'indoorModelNo' | 'outdoorModelNo' | 'indoorUnitSerial' | 'outdoorUnitSerial';
  detectedAcType?: 'IDU' | 'ODU' | 'SET' | 'COMBINED' | 'OTHER';
  detectionReason?: string;
  badgeTitle?: string;
  badgeColor?: 'blue' | 'indigo' | 'emerald' | 'purple' | 'amber' | 'slate';
}

export const InventoryQrScannerModal: React.FC<InventoryQrScannerModalProps> = ({
  isOpen,
  onClose,
  inventory,
  shipments = [],
  invoices = [],
  onOpenAddItemWithData,
  onQuickAddItemDirect,
  onEditItem,
  onBillItem,
  onHighlightItemInTable,
  onToggleItemSold,
  onUpdateShipmentStatus,
  onAddShipmentTrackingUpdate,
  scanTargetPrompt,
  onScannedValueExtracted,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Scanned status & result
  const [scannedResult, setScannedResult] = useState<ParsedQrResult | null>(null);
  const [matchMode, setMatchMode] = useState<'SPECIFIC_UNIT' | 'MODEL_GROUP' | 'DELIVERY' | 'UNREGISTERED'>('SPECIFIC_UNIT');
  const [specificUnit, setSpecificUnit] = useState<InventoryItem | null>(null);
  const [modelGroupUnits, setModelGroupUnits] = useState<InventoryItem[]>([]);
  const [archivedMatchCount, setArchivedMatchCount] = useState<number>(0);
  const [showOtherModelUnits, setShowOtherModelUnits] = useState(false);

  const [matchedOrder, setMatchedOrder] = useState<{
    shipment?: Shipment;
    invoice?: Invoice;
    matchedSerial?: string;
    matchedModel?: string;
    matchedReason?: string;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [orderUpdateFeedback, setOrderUpdateFeedback] = useState<string | null>(null);

  // Manual fallback input
  const [manualCode, setManualCode] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);

  // Editable fields for unregistered item quick-add
  const [unregisteredBrand, setUnregisteredBrand] = useState('Daikin');
  const [unregisteredModel, setUnregisteredModel] = useState('');
  const [unregisteredIndoorModel, setUnregisteredIndoorModel] = useState('');
  const [unregisteredOutdoorModel, setUnregisteredOutdoorModel] = useState('');
  const [unregisteredPrice, setUnregisteredPrice] = useState<number>(45000);
  const [unregisteredType, setUnregisteredType] = useState('AC');
  const [unregisteredRole, setUnregisteredRole] = useState<'serialNo' | 'modelNo' | 'indoorModelNo' | 'outdoorModelNo' | 'indoorUnitSerial' | 'outdoorUnitSerial'>('serialNo');
  const [unregisteredSerial, setUnregisteredSerial] = useState('');
  const [unregisteredIndoorSerial, setUnregisteredIndoorSerial] = useState('');
  const [unregisteredOutdoorSerial, setUnregisteredOutdoorSerial] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Play pleasant beep sound using Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);

      if (navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
    } catch {
      // Audio not supported or blocked
    }
  };

  // Helper to parse QR text or barcode text (supports AC IDU/ODU intelligence, JSON, Key-Value, URL or raw Serial/Model/StockId)
  const parseCodeText = (rawText: string, format?: string): ParsedQrResult => {
    const raw = rawText.trim();
    let result: ParsedQrResult = { raw, format };

    // 0. Run AC Industry Intelligence Detector (checks IDU/ODU models, serials, brands)
    const acDetails = detectAcBarcodeDetails(raw);
    if (acDetails.classification !== 'UNKNOWN') {
      result.cleanValue = acDetails.extractedValues.cleanValue;
      result.detectedRole =
        acDetails.classification === 'IDU_SERIAL'
          ? 'indoorUnitSerial'
          : acDetails.classification === 'ODU_SERIAL'
          ? 'outdoorUnitSerial'
          : acDetails.classification === 'IDU_MODEL'
          ? 'indoorModelNo'
          : acDetails.classification === 'ODU_MODEL'
          ? 'outdoorModelNo'
          : acDetails.classification === 'SET_MODEL'
          ? 'modelNo'
          : 'serialNo';
      result.detectedAcType = acDetails.acUnitType;
      result.detectionReason = acDetails.reason;
      result.badgeTitle = acDetails.badgeTitle;
      result.badgeColor = acDetails.badgeColor;

      if (acDetails.extractedValues.indoorModelNo) result.indoorModelNo = acDetails.extractedValues.indoorModelNo;
      if (acDetails.extractedValues.outdoorModelNo) result.outdoorModelNo = acDetails.extractedValues.outdoorModelNo;
      if (acDetails.extractedValues.indoorUnitSerial) result.indoorUnitSerial = acDetails.extractedValues.indoorUnitSerial;
      if (acDetails.extractedValues.outdoorUnitSerial) result.outdoorUnitSerial = acDetails.extractedValues.outdoorUnitSerial;
      if (acDetails.extractedValues.modelNo) result.modelNo = acDetails.extractedValues.modelNo;
      if (acDetails.extractedValues.serialNo) result.serialNo = acDetails.extractedValues.serialNo;
      if (acDetails.extractedValues.brand) result.brand = acDetails.extractedValues.brand;
      if (acDetails.extractedValues.type) result.type = acDetails.extractedValues.type;
      if (acDetails.extractedValues.stockId) result.stockId = acDetails.extractedValues.stockId;
    }

    // 1. Try JSON
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        const obj = JSON.parse(raw);
        if (typeof obj === 'object' && obj !== null) {
          result.stockId = obj.stockId || obj.stock_id || obj.stockID || result.stockId;
          result.name = obj.name || obj.productName || obj.title || result.name;
          result.modelNo = obj.modelNo || obj.model || obj.modelNumber || obj.itemCode || result.modelNo;
          result.indoorModelNo = obj.indoorModelNo || obj.iduModel || result.indoorModelNo;
          result.outdoorModelNo = obj.outdoorModelNo || obj.oduModel || result.outdoorModelNo;
          result.brand = obj.brand || obj.manufacturer || obj.make || result.brand;
          result.type = obj.type || obj.category || result.type || 'AC';
          result.serialNo = obj.serialNo || obj.serial || obj.sn || obj.sno || obj.id || result.serialNo;
          result.indoorUnitSerial = obj.indoorUnitSerial || obj.iduSerial || obj.iduSn || result.indoorUnitSerial;
          result.outdoorUnitSerial = obj.outdoorUnitSerial || obj.oduSerial || obj.oduSn || result.outdoorUnitSerial;
          result.price = Number(obj.price || obj.sellingPrice || obj.mrp) || result.price || undefined;
          return result;
        }
      } catch {
        // Fall through
      }
    }

    // 2. Try Key-Value lines (e.g. STOCK_ID: XYZ, MODEL: ABC, SN: 123, IDU_SN: 456, ODU_SN: 789)
    const lines = raw.split(/[\r\n;,|]+/);
    let matchedLines = false;
    lines.forEach((line) => {
      const parts = line.split(/[:=]/);
      if (parts.length >= 2) {
        const key = parts[0].trim().toUpperCase();
        const val = parts.slice(1).join(':').trim();
        if (['STOCKID', 'STOCK_ID', 'STOCK', 'SKU'].includes(key)) {
          result.stockId = val;
          matchedLines = true;
        } else if (['IDU_MODEL', 'IDUMODEL', 'INDOOR_MODEL', 'INDOORMODEL', 'IU_MODEL'].includes(key)) {
          result.indoorModelNo = val;
          result.detectedRole = 'indoorModelNo';
          result.detectedAcType = 'IDU';
          matchedLines = true;
        } else if (['ODU_MODEL', 'ODUMODEL', 'OUTDOOR_MODEL', 'OUTDOORMODEL', 'OU_MODEL'].includes(key)) {
          result.outdoorModelNo = val;
          result.detectedRole = 'outdoorModelNo';
          result.detectedAcType = 'ODU';
          matchedLines = true;
        } else if (['MODEL', 'MODELNO', 'MODEL_NO', 'MODEL NUMBER'].includes(key)) {
          result.modelNo = val;
          matchedLines = true;
        } else if (['NAME', 'PRODUCT', 'ITEM', 'DESCRIPTION'].includes(key)) {
          result.name = val;
          matchedLines = true;
        } else if (['BRAND', 'MAKE', 'MFR'].includes(key)) {
          result.brand = val;
          matchedLines = true;
        } else if (['IDU_SN', 'IDUSN', 'IDU_SERIAL', 'INDOOR_SN', 'INDOOR_SERIAL', 'IU_SN'].includes(key)) {
          result.indoorUnitSerial = val;
          result.detectedRole = 'indoorUnitSerial';
          result.detectedAcType = 'IDU';
          matchedLines = true;
        } else if (['ODU_SN', 'ODUSN', 'ODU_SERIAL', 'OUTDOOR_SN', 'OUTDOOR_SERIAL', 'OU_SN'].includes(key)) {
          result.outdoorUnitSerial = val;
          result.detectedRole = 'outdoorUnitSerial';
          result.detectedAcType = 'ODU';
          matchedLines = true;
        } else if (['SN', 'SERIAL', 'SERIALNO', 'SERIAL_NO', 'BARCODE'].includes(key)) {
          result.serialNo = val;
          matchedLines = true;
        } else if (['PRICE', 'MRP', 'RATE'].includes(key)) {
          result.price = Number(val.replace(/[^\d.]/g, '')) || undefined;
          matchedLines = true;
        } else if (['TYPE', 'CAT', 'CATEGORY'].includes(key)) {
          result.type = val;
          matchedLines = true;
        }
      }
    });

    if (matchedLines) return result;

    // 3. Try URL with query params
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const url = new URL(raw);
        const sn = url.searchParams.get('sn') || url.searchParams.get('serial') || url.searchParams.get('item');
        const iduSn = url.searchParams.get('idu_sn') || url.searchParams.get('idusn');
        const oduSn = url.searchParams.get('odu_sn') || url.searchParams.get('odusn');
        const model = url.searchParams.get('model') || url.searchParams.get('m');
        const iduModel = url.searchParams.get('idu_model') || url.searchParams.get('idumodel');
        const oduModel = url.searchParams.get('odu_model') || url.searchParams.get('odumodel');
        const stId = url.searchParams.get('stock') || url.searchParams.get('stockId');
        if (sn || model || stId || iduSn || oduSn || iduModel || oduModel) {
          result.stockId = stId || undefined;
          result.serialNo = sn || undefined;
          result.indoorUnitSerial = iduSn || undefined;
          result.outdoorUnitSerial = oduSn || undefined;
          result.modelNo = model || undefined;
          result.indoorModelNo = iduModel || undefined;
          result.outdoorModelNo = oduModel || undefined;
          return result;
        }
      } catch {
        // Fall through
      }
    }

    // 4. Raw string heuristics fallback
    if (!result.stockId && (/^LAK[-_]/i.test(raw) || /^STOCK[-_]/i.test(raw))) {
      result.stockId = raw;
    } else if (!result.serialNo && /^SN[-_:]/i.test(raw)) {
      result.serialNo = raw;
    } else {
      if (!result.serialNo) result.serialNo = raw;
      if (!result.modelNo) result.modelNo = raw;
    }

    return result;
  };

  // Check if parsed QR matches any Delivery (Shipment) or Invoice in the system
  const findMatchingDeliveryOrder = (parsed: ParsedQrResult) => {
    const rawClean = parsed.raw.toLowerCase().trim();
    const snClean = (parsed.serialNo || '').toLowerCase().trim();
    const modelClean = (parsed.modelNo || '').toLowerCase().trim();

    // 1. Search in Invoices
    let foundInvoice: Invoice | undefined;
    let foundReason = '';

    for (const inv of invoices || []) {
      if (inv.id.toLowerCase() === rawClean) {
        foundInvoice = inv;
        foundReason = `Matches Tax Invoice #${inv.id}`;
        break;
      }
      for (const it of inv.items || []) {
        const itSn = (it.serialNo || '').toLowerCase();
        const itIn = (it.indoorUnitSerial || '').toLowerCase();
        const itOut = (it.outdoorUnitSerial || '').toLowerCase();
        const itMod = (it.modelNo || '').toLowerCase();

        if (
          (snClean && (itSn.includes(snClean) || itIn.includes(snClean) || itOut.includes(snClean))) ||
          (rawClean && (itSn.includes(rawClean) || itIn.includes(rawClean) || itOut.includes(rawClean)))
        ) {
          foundInvoice = inv;
          foundReason = `Serial matched on Invoice #${inv.id} for ${inv.customerExternalName}`;
          break;
        }
        if (modelClean && itMod === modelClean) {
          foundInvoice = inv;
          foundReason = `Model #${it.modelNo} ordered on Invoice #${inv.id}`;
          break;
        }
      }
      if (foundInvoice) break;
    }

    // 2. Search in Shipments / Deliveries
    let foundShipment: Shipment | undefined;

    for (const sh of shipments || []) {
      if (sh.id.toLowerCase() === rawClean) {
        foundShipment = sh;
        foundReason = `Matches Delivery Tracking #${sh.id}`;
        break;
      }
      if (foundInvoice && (sh.invoiceId === foundInvoice.id || sh.invoiceIds?.includes(foundInvoice.id))) {
        foundShipment = sh;
        break;
      }
      const summary = (sh.itemsSummary || '').toLowerCase();
      if (
        (snClean && summary.includes(snClean)) ||
        (rawClean && summary.includes(rawClean)) ||
        (modelClean && summary.includes(modelClean))
      ) {
        foundShipment = sh;
        foundReason = `Matched in Delivery: ${sh.itemsSummary}`;
        break;
      }
    }

    if (!foundInvoice && foundShipment?.invoiceId) {
      foundInvoice = invoices?.find((i) => i.id === foundShipment.invoiceId);
    }

    if (foundShipment || foundInvoice) {
      return {
        shipment: foundShipment,
        invoice: foundInvoice,
        matchedSerial: parsed.serialNo || parsed.raw,
        matchedModel: parsed.modelNo,
        matchedReason: foundReason,
      };
    }
    return null;
  };

  // BUG 3 IMPLEMENTATION:
  // "when a value is given it checks if its a sr number which it show that specific one or model number which it shows all the stock id of that in store and that only in store stock id are showed when using a similar thing value"
  const processScannedValue = (parsed: ParsedQrResult) => {
    // 1. FILTER ACTIVE IN-STORE ITEMS ONLY (archived / installed units MUST NEVER be included in in-store stock list)
    const inStoreItems = inventory.filter((it) => !it.isArchived && it.status !== 'ARCHIVED');

    const rawClean = parsed.raw.toLowerCase().trim();
    const snClean = (parsed.serialNo || '').toLowerCase().trim();
    const stockIdClean = (parsed.stockId || '').toLowerCase().trim();
    const modelClean = (parsed.modelNo || '').toLowerCase().trim();

    // Check count of archived items matching this code for an informative footnote
    const archivedCount = inventory.filter((item) => {
      if (!item.isArchived && item.status !== 'ARCHIVED') return false;
      const sMatch = item.serialNo && (item.serialNo.toLowerCase() === rawClean || (snClean && item.serialNo.toLowerCase() === snClean));
      const mMatch = item.modelNo && (item.modelNo.toLowerCase() === rawClean || (modelClean && item.modelNo.toLowerCase() === modelClean));
      const stMatch = item.stockId && (item.stockId.toLowerCase() === rawClean || (stockIdClean && item.stockId.toLowerCase() === stockIdClean));
      return sMatch || mMatch || stMatch;
    }).length;
    setArchivedMatchCount(archivedCount);

    // STEP A: CHECK FOR EXACT SPECIFIC UNIT (by Stock ID, Serial No, Barcode, or ID)
    let exactUnitMatch: InventoryItem | undefined;

    // Check by stockId first
    if (stockIdClean) {
      exactUnitMatch = inStoreItems.find((it) => it.stockId && it.stockId.toLowerCase().trim() === stockIdClean);
    }
    if (!exactUnitMatch) {
      exactUnitMatch = inStoreItems.find((it) => it.stockId && it.stockId.toLowerCase().trim() === rawClean);
    }

    // Check by serial number
    if (!exactUnitMatch && snClean) {
      exactUnitMatch = inStoreItems.find((it) => it.serialNo && it.serialNo.toLowerCase().trim() === snClean);
    }
    if (!exactUnitMatch) {
      exactUnitMatch = inStoreItems.find((it) => it.serialNo && it.serialNo.toLowerCase().trim() === rawClean);
    }

    // Check by indoor unit serial number (AC IDU)
    if (!exactUnitMatch) {
      exactUnitMatch = inStoreItems.find(
        (it) =>
          it.indoorUnitSerial &&
          (it.indoorUnitSerial.toLowerCase().trim() === rawClean ||
            (snClean && it.indoorUnitSerial.toLowerCase().trim() === snClean))
      );
    }

    // Check by outdoor unit serial number (AC ODU)
    if (!exactUnitMatch) {
      exactUnitMatch = inStoreItems.find(
        (it) =>
          it.outdoorUnitSerial &&
          (it.outdoorUnitSerial.toLowerCase().trim() === rawClean ||
            (snClean && it.outdoorUnitSerial.toLowerCase().trim() === snClean))
      );
    }

    // Check by unique barcode or database ID
    if (!exactUnitMatch) {
      exactUnitMatch = inStoreItems.find(
        (it) => (it.barcode && it.barcode.toLowerCase().trim() === rawClean) || it.id.toLowerCase() === rawClean
      );
    }

    // IF EXACT UNIT MATCH FOUND: SHOW THAT SPECIFIC ONE
    if (exactUnitMatch) {
      setMatchMode('SPECIFIC_UNIT');
      setSpecificUnit(exactUnitMatch);

      // Find any other in-store units with same model number
      const siblings = inStoreItems.filter(
        (it) =>
          it.id !== exactUnitMatch!.id &&
          it.modelNo &&
          exactUnitMatch!.modelNo &&
          it.modelNo.toLowerCase().trim() === exactUnitMatch!.modelNo.toLowerCase().trim()
      );
      setModelGroupUnits(siblings);
      setShowOtherModelUnits(false);
      setMatchedOrder(null);
      return;
    }

    // STEP B: CHECK FOR MODEL NUMBER (INCLUDING INDOOR & OUTDOOR MODELS)
    const targetModel = modelClean || rawClean;
    const modelUnits = inStoreItems.filter((it) => {
      const m = (it.modelNo || '').toLowerCase().trim();
      const iduM = (it.indoorModelNo || '').toLowerCase().trim();
      const oduM = (it.outdoorModelNo || '').toLowerCase().trim();

      const mMatch = m && (m === targetModel || m.includes(targetModel) || targetModel.includes(m));
      const iduMatch = iduM && (iduM === targetModel || iduM.includes(targetModel) || targetModel.includes(iduM));
      const oduMatch = oduM && (oduM === targetModel || oduM.includes(targetModel) || targetModel.includes(oduM));

      return mMatch || iduMatch || oduMatch;
    });

    if (modelUnits.length > 0) {
      setMatchMode('MODEL_GROUP');
      setSpecificUnit(null);
      setModelGroupUnits(modelUnits);
      setShowOtherModelUnits(false);
      setMatchedOrder(null);
      return;
    }

    // STEP B2: CHECK FOR SIMILAR THING VALUE (e.g. Brand, Product Name, or Partial Serial/Stock ID/Models)
    // CRITICAL: Shows all the stock IDs of that in store, and ONLY in-store stock IDs are shown
    const similarUnits = inStoreItems.filter((it) => {
      const q = rawClean;
      const nameMatch = it.name && it.name.toLowerCase().includes(q);
      const brandMatch = it.brand && it.brand.toLowerCase().includes(q);
      const snPartial = it.serialNo && it.serialNo.toLowerCase().includes(q);
      const stockIdPartial = it.stockId && it.stockId.toLowerCase().includes(q);
      const iduModelPartial = it.indoorModelNo && it.indoorModelNo.toLowerCase().includes(q);
      const oduModelPartial = it.outdoorModelNo && it.outdoorModelNo.toLowerCase().includes(q);
      return nameMatch || brandMatch || snPartial || stockIdPartial || iduModelPartial || oduModelPartial;
    });

    if (similarUnits.length === 1 && (similarUnits[0].serialNo?.toLowerCase().includes(rawClean) || similarUnits[0].stockId?.toLowerCase().includes(rawClean))) {
      // If a single unit matches this serial number / stock ID value, show that specific one
      setMatchMode('SPECIFIC_UNIT');
      setSpecificUnit(similarUnits[0]);
      const siblings = inStoreItems.filter(
        (it) =>
          it.id !== similarUnits[0].id &&
          it.modelNo &&
          similarUnits[0].modelNo &&
          it.modelNo.toLowerCase().trim() === similarUnits[0].modelNo.toLowerCase().trim()
      );
      setModelGroupUnits(siblings);
      setShowOtherModelUnits(false);
      setMatchedOrder(null);
      return;
    } else if (similarUnits.length > 0) {
      // Multiple in-store units match this similar value -> Show all their in-store Stock IDs
      setMatchMode('MODEL_GROUP');
      setSpecificUnit(null);
      setModelGroupUnits(similarUnits);
      setShowOtherModelUnits(false);
      setMatchedOrder(null);
      return;
    }

    // STEP C: CHECK FOR DELIVERY / CUSTOMER ORDER MATCH
    const orderMatch = findMatchingDeliveryOrder(parsed);
    if (orderMatch) {
      setMatchMode('DELIVERY');
      setMatchedOrder(orderMatch);
      setSpecificUnit(null);
      setModelGroupUnits([]);
      return;
    }

    // STEP D: UNREGISTERED / NOT FOUND
    setMatchMode('UNREGISTERED');
    setSpecificUnit(null);
    setModelGroupUnits([]);
    setMatchedOrder(null);

    // Pre-seed quick add form with AC IDU/ODU intelligence
    if (parsed.brand) setUnregisteredBrand(parsed.brand);
    if (parsed.modelNo) setUnregisteredModel(parsed.modelNo);
    if (parsed.indoorModelNo) setUnregisteredIndoorModel(parsed.indoorModelNo);
    if (parsed.outdoorModelNo) setUnregisteredOutdoorModel(parsed.outdoorModelNo);
    if (parsed.indoorUnitSerial) setUnregisteredIndoorSerial(parsed.indoorUnitSerial);
    if (parsed.outdoorUnitSerial) setUnregisteredOutdoorSerial(parsed.outdoorUnitSerial);
    if (parsed.serialNo) setUnregisteredSerial(parsed.serialNo);
    if (parsed.detectedRole) setUnregisteredRole(parsed.detectedRole);
    if (parsed.detectedAcType === 'IDU' || parsed.detectedAcType === 'ODU' || parsed.detectedAcType === 'COMBINED') {
      setUnregisteredType('AC');
    }
    if (parsed.price) setUnregisteredPrice(parsed.price);
  };

  // Handle a successfully scanned code
  const handleDecodedCode = (decodedString: string, format?: string) => {
    if (!decodedString) return;
    playBeep();
    setIsProcessing(true);
    setCameraActive(false);
    stopCameraStream();

    // If modal was opened specifically to scan for an input field
    if (onScannedValueExtracted && scanTargetPrompt) {
      const cleanVal = extractCleanValueForTarget(decodedString, scanTargetPrompt);
      const acDetails = detectAcBarcodeDetails(decodedString);
      onScannedValueExtracted(cleanVal, acDetails.classification);
      onClose();
      setIsProcessing(false);
      return;
    }

    const parsed = parseCodeText(decodedString, format);
    setScannedResult(parsed);
    processScannedValue(parsed);
    setOrderUpdateFeedback(null);
    setIsProcessing(false);
  };

  // Mark Delivery as Arrived at Store via Scanner
  const handleMarkArrivedAtStore = async () => {
    if (!matchedOrder?.shipment) return;
    try {
      setIsUpdatingOrder(true);
      const shId = matchedOrder.shipment.id;
      const serialLabel = scannedResult?.serialNo || scannedResult?.raw || '';
      const updateMsg = `Package (Serial: ${serialLabel}) scanned - Arrived at Lakhi Store`;

      if (onUpdateShipmentStatus) {
        await onUpdateShipmentStatus(
          shId,
          'ARRIVED_AT_STORE',
          undefined,
          undefined,
          undefined,
          undefined,
          updateMsg
        );
      }
      if (onAddShipmentTrackingUpdate) {
        await onAddShipmentTrackingUpdate(
          shId,
          `Arrived at Lakhi Store verified via Scanner (SN: ${serialLabel})`
        );
      }

      setOrderUpdateFeedback('✅ Marked as ARRIVED AT STORE! In-store stock & live tracking updated.');
      setMatchedOrder((prev) =>
        prev
          ? {
              ...prev,
              shipment: {
                ...prev.shipment!,
                status: 'ARRIVED_AT_STORE',
              },
            }
          : null
      );
    } catch (err: any) {
      console.error('Error marking shipment arrived:', err);
      alert('Failed to update delivery: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  // Mark Delivery as Delivered / Done via Scanner
  const handleMarkDeliveredDone = async () => {
    if (!matchedOrder?.shipment) return;
    try {
      setIsUpdatingOrder(true);
      const shId = matchedOrder.shipment.id;
      const serialLabel = scannedResult?.serialNo || scannedResult?.raw || '';

      if (onUpdateShipmentStatus) {
        await onUpdateShipmentStatus(
          shId,
          'DELIVERED_INSTALLED',
          undefined,
          undefined,
          undefined,
          undefined,
          `Delivered & verified via barcode/QR scan (SN: ${serialLabel})`
        );
      }
      if (onAddShipmentTrackingUpdate) {
        await onAddShipmentTrackingUpdate(
          shId,
          `Delivery & installation completed (verified via QR scan)`
        );
      }

      setOrderUpdateFeedback('✅ Order marked as DELIVERED & COMPLETED!');
      setMatchedOrder((prev) =>
        prev
          ? {
              ...prev,
              shipment: {
                ...prev.shipment!,
                status: 'DELIVERED_INSTALLED',
              },
            }
          : null
      );
    } catch (err: any) {
      console.error('Error marking shipment done:', err);
      alert('Failed to update delivery: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  // Start camera stream
  const startCamera = async () => {
    setCameraError(null);
    setScannedResult(null);
    setSpecificUnit(null);
    setModelGroupUnits([]);
    setMatchedOrder(null);
    setOrderUpdateFeedback(null);
    setQuickAddSuccess(false);

    try {
      stopCameraStream();

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);

        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setTorchSupported(!!capabilities.torch);

        startScanningLoop();
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in your browser or use the file upload / manual code fallback below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can upload an image with a QR code/barcode or enter code manually.');
      } else {
        setCameraError('Unable to access device camera. Please check your browser permissions or use file upload.');
      }
    }
  };

  // Stop camera stream
  const stopCameraStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
  };

  // BUG 2 & 3 IMPLEMENTATION: Continuous scanning loop detecting BOTH 1D barcodes and 2D QR codes
  const startScanningLoop = () => {
    let lastScanTime = 0;

    const scan = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const now = performance.now();
      // Throttle scanning to every 120ms to save CPU & battery while remaining instantaneous
      if (now - lastScanTime >= 120) {
        lastScanTime = now;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const detected = await scanCanvasForCodes(canvas);
            if (detected && detected.text) {
              handleDecodedCode(detected.text, detected.format);
              return;
            }
          } catch {
            // Ignore scan attempt failure
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scan);
    };

    animationFrameRef.current = requestAnimationFrame(scan);
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && torchSupported) {
      try {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle Photo File Upload to scan QR code or 1D barcode
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const detected = await scanImageForCodes(img);
          if (detected && detected.text) {
            handleDecodedCode(detected.text, detected.format);
          } else {
            alert('No scannable QR code or barcode was detected in the uploaded image. Please try another angle or enter the serial code manually.');
          }
        } catch (err: any) {
          alert('Error scanning uploaded photo: ' + err.message);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle manual code entry
  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedCode(manualCode.trim(), 'MANUAL');
    setManualCode('');
  };

  // Quick 1-Click Save to Inventory
  const handleQuickAddDirect = async () => {
    if (!scannedResult || !onQuickAddItemDirect) return;
    setIsQuickAdding(true);
    try {
      const isAc = unregisteredType.toUpperCase() === 'AC';
      const cleanVal = scannedResult.cleanValue || scannedResult.raw;
      const effModel =
        unregisteredRole === 'modelNo'
          ? (scannedResult.modelNo || cleanVal)
          : (unregisteredModel || scannedResult.modelNo || 'FTKF50TV');
      const effIndoorModel = isAc
        ? unregisteredRole === 'indoorModelNo'
          ? (scannedResult.indoorModelNo || cleanVal)
          : (unregisteredIndoorModel || scannedResult.indoorModelNo || `${effModel}-IDU`)
        : undefined;
      const effOutdoorModel = isAc
        ? unregisteredRole === 'outdoorModelNo'
          ? (scannedResult.outdoorModelNo || cleanVal)
          : (unregisteredOutdoorModel || scannedResult.outdoorModelNo || `${effModel}-ODU`)
        : undefined;
      const effIndoor = isAc
        ? unregisteredRole === 'indoorUnitSerial'
          ? (scannedResult.indoorUnitSerial || cleanVal)
          : (unregisteredIndoorSerial || scannedResult.indoorUnitSerial || (unregisteredRole === 'serialNo' ? cleanVal : undefined))
        : undefined;
      const effOutdoor = isAc
        ? unregisteredRole === 'outdoorUnitSerial'
          ? (scannedResult.outdoorUnitSerial || cleanVal)
          : (unregisteredOutdoorSerial || scannedResult.outdoorUnitSerial || undefined)
        : undefined;
      const effSerial = isAc
        ? (effIndoor || effOutdoor || cleanVal)
        : (unregisteredRole === 'serialNo' ? cleanVal : (unregisteredSerial || cleanVal));

      const itemToSave = {
        name: `${unregisteredBrand} ${effModel} ${isAc ? 'Inverter Split AC' : 'Appliance'}`,
        modelNo: effModel,
        indoorModelNo: effIndoorModel,
        outdoorModelNo: effOutdoorModel,
        type: unregisteredType,
        brand: unregisteredBrand,
        serialNo: effSerial,
        indoorUnitSerial: effIndoor,
        outdoorUnitSerial: effOutdoor,
        sellingPrice: unregisteredPrice || 45000,
      };
      await onQuickAddItemDirect(itemToSave);
      setQuickAddSuccess(true);
      setTimeout(() => {
        processScannedValue(scannedResult);
      }, 350);
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleEnterByScanningInAdd = () => {
    if (!scannedResult) return;
    const isAc = unregisteredType.toUpperCase() === 'AC';
    const cleanVal = scannedResult.cleanValue || scannedResult.raw;
    const effModel =
      unregisteredRole === 'modelNo'
        ? (scannedResult.modelNo || cleanVal)
        : (unregisteredModel || scannedResult.modelNo);
    const effIndoorModel = isAc
      ? unregisteredRole === 'indoorModelNo'
        ? (scannedResult.indoorModelNo || cleanVal)
        : (unregisteredIndoorModel || scannedResult.indoorModelNo || undefined)
      : undefined;
    const effOutdoorModel = isAc
      ? unregisteredRole === 'outdoorModelNo'
        ? (scannedResult.outdoorModelNo || cleanVal)
        : (unregisteredOutdoorModel || scannedResult.outdoorModelNo || undefined)
      : undefined;
    const effIndoor = isAc
      ? unregisteredRole === 'indoorUnitSerial'
        ? (scannedResult.indoorUnitSerial || cleanVal)
        : (unregisteredIndoorSerial || scannedResult.indoorUnitSerial || (unregisteredRole === 'serialNo' ? cleanVal : undefined))
      : undefined;
    const effOutdoor = isAc
      ? unregisteredRole === 'outdoorUnitSerial'
        ? (scannedResult.outdoorUnitSerial || cleanVal)
        : (unregisteredOutdoorSerial || scannedResult.outdoorUnitSerial || undefined)
      : undefined;
    const effSerial = isAc
      ? (effIndoor || effOutdoor || cleanVal)
      : (unregisteredRole === 'serialNo' ? cleanVal : (unregisteredSerial || cleanVal));

    onOpenAddItemWithData({
      type: unregisteredType,
      brand: unregisteredBrand,
      modelNo: effModel,
      indoorModelNo: effIndoorModel,
      outdoorModelNo: effOutdoorModel,
      serialNo: effSerial,
      indoorUnitSerial: effIndoor,
      outdoorUnitSerial: effOutdoor,
      price: unregisteredPrice,
    });
    onClose();
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCameraStream();
      setCameraActive(false);
      setScannedResult(null);
      setSpecificUnit(null);
      setModelGroupUnits([]);
      setQuickAddSuccess(false);
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-1.5">
                <span>QR &amp; Barcode Scanner</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  2D &amp; 1D
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Point camera at carton barcode, product QR, or type serial/model to look up in-store stock
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Active Camera Viewfinder OR Result View */}
          {!scannedResult ? (
            <div className="space-y-3">
              {/* Viewfinder Video Frame */}
              <div className="relative w-full aspect-4/3 sm:aspect-16/10 bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning Target Overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative w-64 h-64 border-2 border-red-500/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                      {/* Animated Laser Scanning Line */}
                      <div className="absolute left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />

                      {/* Corner Target Markers */}
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-lg" />

                      <span className="text-[10px] font-mono font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs">
                        Scan QR Code or Barcode
                      </span>
                    </div>
                  </div>
                )}

                {/* Camera Top Controls Bar */}
                {cameraActive && (
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                    <span className="px-2 py-0.5 bg-black/60 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 backdrop-blur-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      SCANNING (1D + 2D)
                    </span>

                    <div className="flex items-center gap-1.5">
                      {torchSupported && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2 rounded-xl backdrop-blur-md text-white transition-all ${
                            torchOn ? 'bg-amber-500 text-slate-900 shadow-lg' : 'bg-black/60 hover:bg-black/80'
                          }`}
                          title="Toggle Torch / Flashlight"
                        >
                          {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                      )}
                      {hasMultipleCameras && (
                        <button
                          type="button"
                          onClick={flipCamera}
                          className="p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-all"
                          title="Switch Front / Rear Camera"
                        >
                          <FlipHorizontal className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Camera Inactive / Permission Error fallback */}
                {!cameraActive && (
                  <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-950 text-white space-y-3">
                    <div className="p-3 bg-red-600/20 text-red-400 rounded-2xl border border-red-500/30">
                      <Camera className="w-8 h-8 animate-pulse" />
                    </div>
                    {cameraError ? (
                      <div className="space-y-1.5 max-w-sm">
                        <div className="text-xs font-bold text-red-400 flex items-center justify-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Camera Not Ready
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{cameraError}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-xs font-bold">Initializing camera stream...</div>
                        <p className="text-[11px] text-slate-400">Please grant camera permissions when prompted.</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Starting Camera Again
                    </button>
                  </div>
                )}
              </div>

              {/* Photo Upload & Quick Demo Triggers */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-500" />
                  Upload Photo (QR or Barcode)
                </button>

                <div className="text-[10px] text-slate-400 font-mono">
                  Supports QR, Code 128, EAN-13, UPC
                </div>
              </div>

              {/* Manual Barcode / Serial / Model Lookup */}
              <form onSubmit={handleManualLookup} className="pt-2">
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter Serial No (sr number) or Model No..."
                    className="w-full text-xs pl-9 pr-24 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="absolute right-1.5 top-1 px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Lookup
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* SCANNED RESULT VIEW (BUG 3 IMPLEMENTATION) */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* Scan Again Bar */}
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-[11px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate max-w-[200px]">
                    {scannedResult.raw}
                  </span>
                  {scannedResult.format && (
                    <span className="text-[10px] text-slate-400 font-mono uppercase">
                      ({scannedResult.format})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Scan Next</span>
                </button>
              </div>

              {/* Intelligent AC IDU / ODU Detection Banner */}
              {scannedResult.badgeTitle && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs transition-all ${
                    scannedResult.detectedAcType === 'IDU'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100'
                      : scannedResult.detectedAcType === 'ODU'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                      : scannedResult.detectedAcType === 'COMBINED'
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-100'
                      : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{scannedResult.badgeTitle}</span>
                    {scannedResult.detectionReason && (
                      <span className="text-[11px] opacity-80 hidden sm:inline">• {scannedResult.detectionReason}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        scannedResult.detectedAcType === 'IDU'
                          ? 'bg-blue-600 text-white'
                          : scannedResult.detectedAcType === 'ODU'
                          ? 'bg-emerald-600 text-white'
                          : scannedResult.detectedAcType === 'COMBINED'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-white'
                      }`}
                    >
                      {scannedResult.detectedAcType ? `${scannedResult.detectedAcType} UNIT` : 'DETECTED'}
                    </span>

                    {/* Quick 1-Click Swap Button between IDU and ODU */}
                    {(scannedResult.detectedAcType === 'IDU' || scannedResult.detectedAcType === 'ODU') && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextType = scannedResult.detectedAcType === 'IDU' ? 'ODU' : 'IDU';
                          const isSerial =
                            unregisteredRole === 'indoorUnitSerial' ||
                            unregisteredRole === 'outdoorUnitSerial' ||
                            unregisteredRole === 'serialNo';
                          const nextRole =
                            nextType === 'IDU'
                              ? isSerial
                                ? 'indoorUnitSerial'
                                : 'indoorModelNo'
                              : isSerial
                              ? 'outdoorUnitSerial'
                              : 'outdoorModelNo';
                          setUnregisteredRole(nextRole);
                          setScannedResult({
                            ...scannedResult,
                            detectedAcType: nextType,
                            badgeTitle: nextType === 'IDU' ? '🔵 Indoor Unit (IDU)' : '🟢 Outdoor Unit (ODU)',
                            detectedRole: nextRole,
                          });
                        }}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        Swap ⇄ {scannedResult.detectedAcType === 'IDU' ? 'ODU' : 'IDU'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Order Update Feedback Toast */}
              {orderUpdateFeedback && (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{orderUpdateFeedback}</span>
                </div>
              )}

              {/* CASE 1: EXACT SPECIFIC SERIAL / STOCK ID MATCH */}
              {matchMode === 'SPECIFIC_UNIT' && specificUnit && (
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-400 dark:border-emerald-700 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-emerald-200/80 dark:border-emerald-900/40">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs mt-0.5">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <span>🎯 Exact Specific In-Store Unit Identified</span>
                        </span>
                        <h4 className="font-black text-slate-900 dark:text-white text-base sm:text-lg mt-0.5">
                          {specificUnit.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-300">
                          <span>Brand: <strong className="text-slate-900 dark:text-white">{specificUnit.brand}</strong></span>
                          <span>•</span>
                          <span>Model: <strong className="font-mono text-slate-900 dark:text-white">{specificUnit.modelNo}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Selling Price</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black text-lg">
                        ₹{specificUnit.sellingPrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Unit Specific Card */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800 font-mono text-xs font-black">
                          Stock ID: {specificUnit.stockId || `${specificUnit.serialNo || specificUnit.id}-01`}
                        </span>
                        {specificUnit.type?.toUpperCase() === 'AC' ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                              scannedResult?.raw && (
                                specificUnit.indoorUnitSerial?.toLowerCase() === scannedResult.raw.toLowerCase() ||
                                specificUnit.indoorModelNo?.toLowerCase() === scannedResult.raw.toLowerCase() ||
                                specificUnit.serialNo?.toLowerCase() === scannedResult.raw.toLowerCase()
                              )
                                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                            }`}>
                              <span>
                                Indoor (IDU): {specificUnit.indoorModelNo ? `[${specificUnit.indoorModelNo}] ` : ''}
                                {specificUnit.indoorUnitSerial || specificUnit.serialNo || 'None'}
                              </span>
                            </span>
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                              scannedResult?.raw && (
                                specificUnit.outdoorUnitSerial?.toLowerCase() === scannedResult.raw.toLowerCase() ||
                                specificUnit.outdoorModelNo?.toLowerCase() === scannedResult.raw.toLowerCase()
                              )
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900'
                            }`}>
                              <span>
                                Outdoor (ODU): {specificUnit.outdoorModelNo ? `[${specificUnit.outdoorModelNo}] ` : ''}
                                {specificUnit.outdoorUnitSerial || 'None'}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            <span>SN: {specificUnit.serialNo || 'None'}</span>
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black ${
                          specificUnit.status === 'AVAILABLE'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {specificUnit.status === 'AVAILABLE' ? '✓ AVAILABLE IN STORE' : specificUnit.status}
                      </span>
                    </div>

                    {/* Actions for this specific unit */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {specificUnit.status === 'AVAILABLE' && onBillItem && (
                        <button
                          type="button"
                          onClick={() => {
                            onBillItem(specificUnit);
                            onClose();
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>+ Bill This Specific Unit</span>
                        </button>
                      )}
                      {onToggleItemSold && (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleItemSold(specificUnit.id);
                            setSpecificUnit((prev) =>
                              prev ? { ...prev, status: prev.status === 'AVAILABLE' ? 'SOLD' : 'AVAILABLE' } : null
                            );
                          }}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          {specificUnit.status === 'AVAILABLE' ? 'Mark Sold' : 'Mark Available'}
                        </button>
                      )}
                      {onEditItem && (
                        <button
                          type="button"
                          onClick={() => {
                            onEditItem(specificUnit);
                            onClose();
                          }}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-blue-600 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      {onHighlightItemInTable && (
                        <button
                          type="button"
                          onClick={() => {
                            onHighlightItemInTable(specificUnit.id);
                            onClose();
                          }}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Locate in Godown Table
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sibling in-store units of same model */}
                  {modelGroupUnits.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowOtherModelUnits(!showOtherModelUnits)}
                        className="w-full py-2 px-3 bg-white/80 dark:bg-slate-900/80 hover:bg-white text-slate-700 dark:text-slate-300 font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Boxes className="w-4 h-4 text-emerald-600" />
                          <span>
                            View other {modelGroupUnits.length} in-store units of model "{specificUnit.modelNo}"
                          </span>
                        </span>
                        {showOtherModelUnits ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showOtherModelUnits && (
                        <div className="mt-2 space-y-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                            Other Units In-Store Stock IDs:
                          </span>
                          {modelGroupUnits.map((it, idx) => (
                            <div
                              key={it.id}
                              className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-mono font-bold text-[11px]">
                                  {it.stockId || `${it.serialNo || it.id}-${idx + 1}`}
                                </span>
                                <span className="font-mono text-slate-500 text-[11px]">
                                  SN: {it.serialNo || 'None'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-600 font-bold">
                                  ₹{it.sellingPrice.toLocaleString('en-IN')}
                                </span>
                                {onBillItem && it.status === 'AVAILABLE' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onBillItem(it);
                                      onClose();
                                    }}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[10px]"
                                  >
                                    Bill
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CASE 2: MODEL NUMBER MATCH — SHOW ALL STOCK IDs OF THAT MODEL IN STORE */}
              {matchMode === 'MODEL_GROUP' && modelGroupUnits.length > 0 && (
                <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-indigo-300 dark:border-indigo-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-indigo-200/80 dark:border-indigo-900/40">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs mt-0.5">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-700 dark:text-indigo-300 block">
                          📦 Model Matched — All In-Store Stock IDs
                        </span>
                        <h4 className="font-black text-slate-900 dark:text-white text-base sm:text-lg mt-0.5">
                          {modelGroupUnits[0].brand} {modelGroupUnits[0].modelNo}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          {modelGroupUnits[0].name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-600 text-white shadow-xs block">
                        {modelGroupUnits.length} In-Store Units
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold block mt-1">
                        ({modelGroupUnits.filter((i) => i.status === 'AVAILABLE').length} Available)
                      </span>
                    </div>
                  </div>

                  {/* Inform that ONLY in-store stock IDs are shown */}
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-800 dark:text-indigo-200 flex items-center justify-between">
                    <span>
                      Showing <strong>only in-store stock units</strong> for model <strong>{modelGroupUnits[0].modelNo}</strong>.
                    </span>
                    <span className="text-slate-400 font-mono">
                      ₹{modelGroupUnits[0].sellingPrice.toLocaleString('en-IN')} each
                    </span>
                  </div>

                  {/* LIST ALL IN-STORE STOCK IDs FOR THIS MODEL */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {modelGroupUnits.map((item, idx) => (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900/50 font-mono text-xs font-black">
                              Stock ID: {item.stockId || `${item.serialNo || item.id}-${idx + 1}`}
                            </span>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              item.status === 'AVAILABLE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          {item.type?.toUpperCase() === 'AC' ? (
                            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-blue-700 dark:text-blue-300">
                                IDU: {item.indoorModelNo ? `[${item.indoorModelNo}] ` : ''}{item.indoorUnitSerial || item.serialNo || 'None'}
                              </span>
                              <span>•</span>
                              <span className="text-indigo-700 dark:text-indigo-300">
                                ODU: {item.outdoorModelNo ? `[${item.outdoorModelNo}] ` : ''}{item.outdoorUnitSerial || 'None'}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <Barcode className="w-3.5 h-3.5 text-slate-400" />
                              <span>SN: {item.serialNo || 'None'}</span>
                            </span>
                          )}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{item.sellingPrice.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Action buttons for each unit */}
                        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                          {item.status === 'AVAILABLE' && onBillItem && (
                            <button
                              type="button"
                              onClick={() => {
                                onBillItem(item);
                                onClose();
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-colors"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>+ Bill This Unit</span>
                            </button>
                          )}
                          {onToggleItemSold && (
                            <button
                              type="button"
                              onClick={() => {
                                onToggleItemSold(item.id);
                                setModelGroupUnits((prev) =>
                                  prev.map((u) =>
                                    u.id === item.id
                                      ? { ...u, status: u.status === 'AVAILABLE' ? 'SOLD' : 'AVAILABLE' }
                                      : u
                                  )
                                );
                              }}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                            >
                              {item.status === 'AVAILABLE' ? 'Mark Sold' : 'Mark Available'}
                            </button>
                          )}
                          {onEditItem && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditItem(item);
                                onClose();
                              }}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-blue-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}
                          {onHighlightItemInTable && (
                            <button
                              type="button"
                              onClick={() => {
                                onHighlightItemInTable(item.id);
                                onClose();
                              }}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                            >
                              Locate in Table
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {archivedMatchCount > 0 && (
                    <div className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800/50">
                      ℹ️ Note: {archivedMatchCount} older unit(s) of this model were already delivered &amp; installed and are archived (not in store).
                    </div>
                  )}
                </div>
              )}

              {/* CASE 3: DELIVERY / ORDER MATCH */}
              {matchMode === 'DELIVERY' && matchedOrder && (
                <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-700 dark:text-purple-300">
                          Matched with Delivery &amp; Customer Order
                        </span>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          {matchedOrder.shipment?.customerExternalName ||
                            matchedOrder.invoice?.customerExternalName ||
                            'Customer Order'}
                        </h4>
                      </div>
                    </div>
                    {matchedOrder.shipment && (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-600 text-white shadow-xs shrink-0">
                        {matchedOrder.shipment.status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {matchedOrder.matchedReason && (
                    <div className="text-xs text-purple-900 dark:text-purple-200 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-purple-100">
                      <strong>Match Info:</strong> {matchedOrder.matchedReason}
                    </div>
                  )}

                  {matchedOrder.shipment && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-200/60">
                      {matchedOrder.shipment.status === 'OUT_FOR_DELIVERY' && (
                        <button
                          type="button"
                          onClick={handleMarkArrivedAtStore}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                        >
                          Mark Arrived at Store
                        </button>
                      )}
                      {matchedOrder.shipment.status === 'ARRIVED_AT_STORE' && (
                        <button
                          type="button"
                          onClick={handleMarkDeliveredDone}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                        >
                          Mark Delivered &amp; Installed
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CASE 4: UNREGISTERED ITEM — QUICK INWARD & MARK AS SR / MODEL OPTION */}
              {matchMode === 'UNREGISTERED' && (
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs mt-0.5">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-300 block">
                        Unregistered Barcode / QR
                      </span>
                      <h4 className="font-black text-slate-900 dark:text-white text-base">
                        Code "{scannedResult.raw}" Not Found in In-Store Stock
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        Choose whether to mark this scanned code as a Serial Number (sr number) or Model Number, and enter it directly into stock.
                      </p>
                    </div>
                  </div>

                  {/* Mark as SR Number or Model Number Selector */}
                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Mark Scanned Value "{scannedResult.raw}" as:
                        </span>
                        {scannedResult.detectedAcType && (
                          <span className="text-[10px] font-black px-2 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            Auto: {scannedResult.detectedAcType}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {unregisteredRole.replace(/([A-Z])/g, ' $1').toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUnregisteredRole('serialNo')}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center relative ${
                          unregisteredRole === 'serialNo'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>Serial No (SR)</div>
                        {scannedResult.detectedRole === 'serialNo' && (
                          <span className="text-[9px] opacity-80 block font-normal">Auto-Detected</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setUnregisteredRole('modelNo')}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center relative ${
                          unregisteredRole === 'modelNo'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>Set Model No</div>
                        {scannedResult.detectedRole === 'modelNo' && (
                          <span className="text-[9px] opacity-80 block font-normal">Auto-Detected</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUnregisteredType('AC');
                          setUnregisteredRole('indoorModelNo');
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center relative ${
                          unregisteredRole === 'indoorModelNo'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400/40'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>Indoor Model (IDU)</div>
                        {scannedResult.detectedRole === 'indoorModelNo' && (
                          <span className="text-[9px] opacity-80 block font-normal text-blue-100">Auto-Detected</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUnregisteredType('AC');
                          setUnregisteredRole('outdoorModelNo');
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center relative ${
                          unregisteredRole === 'outdoorModelNo'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400/40'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>Outdoor Model (ODU)</div>
                        {scannedResult.detectedRole === 'outdoorModelNo' && (
                          <span className="text-[9px] opacity-80 block font-normal text-indigo-100">Auto-Detected</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUnregisteredType('AC');
                          setUnregisteredRole('indoorUnitSerial');
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center relative ${
                          unregisteredRole === 'indoorUnitSerial'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400/40'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>Indoor SN (IDU)</div>
                        {scannedResult.detectedRole === 'indoorUnitSerial' && (
                          <span className="text-[9px] opacity-80 block font-normal text-blue-100">Auto-Detected</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUnregisteredType('AC');
                          setUnregisteredRole('outdoorUnitSerial');
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center relative ${
                          unregisteredRole === 'outdoorUnitSerial'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400/40'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>Outdoor SN (ODU)</div>
                        {scannedResult.detectedRole === 'outdoorUnitSerial' && (
                          <span className="text-[9px] opacity-80 block font-normal text-indigo-100">Auto-Detected</span>
                        )}
                      </button>
                    </div>

                    {/* Direct "Enter by Scanning in Adding" Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleEnterByScanningInAdd}
                        className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Open Add Stock modal with this value pre-filled into the selected field"
                      >
                        <Plus className="w-4 h-4" />
                        <span>
                          Enter by Scanning into Add Stock Form as{' '}
                          {unregisteredRole === 'modelNo'
                            ? 'Model No'
                            : unregisteredRole === 'indoorModelNo'
                            ? 'Indoor Model'
                            : unregisteredRole === 'outdoorModelNo'
                            ? 'Outdoor Model'
                            : unregisteredRole === 'indoorUnitSerial'
                            ? 'Indoor SN'
                            : unregisteredRole === 'outdoorUnitSerial'
                            ? 'Outdoor SN'
                            : 'Serial No (SR)'}
                        </span>
                      </button>

                      {onScannedValueExtracted && (
                        <button
                          type="button"
                          onClick={() => {
                            onScannedValueExtracted(scannedResult.raw);
                            onClose();
                          }}
                          className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Insert into Form Field</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Quick Inward Form with AC Indoor/Outdoor support */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-3 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      Or Quick Inward into Store Stock Right Here:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Product Type</label>
                        <select
                          value={unregisteredType}
                          onChange={(e) => setUnregisteredType(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                        >
                          <option value="AC">AC (Air Conditioner)</option>
                          <option value="Refrigerator">Refrigerator</option>
                          <option value="Washing Machine">Washing Machine</option>
                          <option value="Microwave">Microwave</option>
                          <option value="TV">TV / Television</option>
                          <option value="Other">Other Appliance</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Brand</label>
                        <select
                          value={unregisteredBrand}
                          onChange={(e) => setUnregisteredBrand(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                        >
                          <option value="Daikin">Daikin</option>
                          <option value="Voltas">Voltas</option>
                          <option value="Hitachi">Hitachi</option>
                          <option value="Mitsubishi">Mitsubishi</option>
                          <option value="O General">O General</option>
                          <option value="Carrier">Carrier</option>
                          <option value="Blue Star">Blue Star</option>
                          <option value="Panasonic">Panasonic</option>
                          <option value="LG">LG</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Model Number</label>
                        <input
                          type="text"
                          value={unregisteredRole === 'modelNo' ? scannedResult.raw : unregisteredModel}
                          onChange={(e) => setUnregisteredModel(e.target.value)}
                          placeholder="e.g. FTKM50U"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">Selling Price (₹)</label>
                        <input
                          type="number"
                          value={unregisteredPrice}
                          onChange={(e) => setUnregisteredPrice(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-emerald-600"
                        />
                      </div>
                    </div>

                    {/* AC: Replace SR number with Indoor & Outdoor Serials */}
                    {unregisteredType.toUpperCase() === 'AC' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <label className="text-[10px] text-blue-600 dark:text-blue-400 block font-bold mb-1">
                            Indoor Unit Serial (IDU):
                          </label>
                          <input
                            type="text"
                            value={
                              unregisteredRole === 'indoorUnitSerial' || unregisteredRole === 'serialNo'
                                ? scannedResult.raw
                                : unregisteredIndoorSerial
                            }
                            onChange={(e) => setUnregisteredIndoorSerial(e.target.value)}
                            placeholder="Indoor Serial (IDU)"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-800 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-bold mb-1">
                            Outdoor Unit Serial (ODU):
                          </label>
                          <input
                            type="text"
                            value={
                              unregisteredRole === 'outdoorUnitSerial'
                                ? scannedResult.raw
                                : unregisteredOutdoorSerial
                            }
                            onChange={(e) => setUnregisteredOutdoorSerial(e.target.value)}
                            placeholder="Outdoor Serial (ODU)"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800 font-mono font-bold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] text-slate-400 block font-bold mb-1">
                          Carton Serial No:
                        </label>
                        <input
                          type="text"
                          value={unregisteredRole === 'serialNo' ? scannedResult.raw : unregisteredSerial}
                          onChange={(e) => setUnregisteredSerial(e.target.value)}
                          placeholder="Serial No"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleQuickAddDirect}
                      disabled={isQuickAdding}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isQuickAdding ? 'Inwarding...' : '+ Inward this Unit into In-Store Stock'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
