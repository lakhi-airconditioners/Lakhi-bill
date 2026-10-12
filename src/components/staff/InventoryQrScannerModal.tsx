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
  ExternalLink,
  Truck,
} from 'lucide-react';
import jsQR from 'jsqr';
import { InventoryItem, Shipment, Invoice } from '../../types';

interface InventoryQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  shipments?: Shipment[];
  invoices?: Invoice[];
  onOpenAddItemWithData: (data: {
    name?: string;
    modelNo?: string;
    type?: string;
    brand?: string;
    serialNo?: string;
    price?: number;
  }) => void;
  onQuickAddItemDirect?: (data: {
    name: string;
    modelNo: string;
    type: string;
    brand: string;
    serialNo: string;
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
  name?: string;
  modelNo?: string;
  brand?: string;
  type?: string;
  serialNo?: string;
  price?: number;
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
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Scanned status
  const [scannedResult, setScannedResult] = useState<ParsedQrResult | null>(null);
  const [matchedItem, setMatchedItem] = useState<InventoryItem | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<{
    shipment?: Shipment;
    invoice?: Invoice;
    matchedSerial?: string;
    matchedModel?: string;
    matchedReason?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Order status updating
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [orderUpdateFeedback, setOrderUpdateFeedback] = useState<string | null>(null);

  // Manual fallback input
  const [manualCode, setManualCode] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);

  // Editable fields for unregistered item quick-add
  const [unregisteredBrand, setUnregisteredBrand] = useState('Daikin');
  const [unregisteredModel, setUnregisteredModel] = useState('');
  const [unregisteredPrice, setUnregisteredPrice] = useState<number>(45000);

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
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6

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

  // Helper to parse QR text (supports JSON, Key-Value, URL or raw Serial/Model)
  const parseQrText = (rawText: string): ParsedQrResult => {
    const raw = rawText.trim();
    let result: ParsedQrResult = { raw };

    // 1. Try JSON
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        const obj = JSON.parse(raw);
        if (typeof obj === 'object' && obj !== null) {
          result.name = obj.name || obj.productName || obj.title;
          result.modelNo = obj.modelNo || obj.model || obj.modelNumber || obj.itemCode;
          result.brand = obj.brand || obj.manufacturer || obj.make;
          result.type = obj.type || obj.category || 'AC';
          result.serialNo = obj.serialNo || obj.serial || obj.sn || obj.sno || obj.id;
          result.price = Number(obj.price || obj.sellingPrice || obj.mrp) || undefined;
          return result;
        }
      } catch {
        // Fall through
      }
    }

    // 2. Try Key-Value lines (e.g. MODEL: XYZ, SN: 123)
    const lines = raw.split(/[\r\n;,]+/);
    let matchedLines = false;
    lines.forEach((line) => {
      const parts = line.split(/[:=]/);
      if (parts.length >= 2) {
        const key = parts[0].trim().toUpperCase();
        const val = parts.slice(1).join(':').trim();
        if (['MODEL', 'MODELNO', 'MODEL_NO', 'MODEL NUMBER'].includes(key)) {
          result.modelNo = val;
          matchedLines = true;
        } else if (['NAME', 'PRODUCT', 'ITEM', 'DESCRIPTION'].includes(key)) {
          result.name = val;
          matchedLines = true;
        } else if (['BRAND', 'MAKE', 'MFR'].includes(key)) {
          result.brand = val;
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
        const model = url.searchParams.get('model') || url.searchParams.get('m');
        if (sn || model) {
          result.serialNo = sn || undefined;
          result.modelNo = model || undefined;
          return result;
        }
      } catch {
        // Fall through
      }
    }

    // 4. Raw string heuristics
    if (/^SN[-_:]/i.test(raw)) {
      result.serialNo = raw;
    } else if (/^[A-Z0-9]{6,16}$/i.test(raw)) {
      // Looks like a model number or serial number
      result.serialNo = raw;
      result.modelNo = raw;
    } else {
      result.name = raw;
    }

    return result;
  };

  // Check if parsed QR matches any existing item in inventory
  const findMatchingItem = (parsed: ParsedQrResult): InventoryItem | null => {
    const rawClean = parsed.raw.toLowerCase();
    const snClean = (parsed.serialNo || '').toLowerCase();
    const modelClean = (parsed.modelNo || '').toLowerCase();

    for (const item of inventory) {
      if (item.id.toLowerCase() === rawClean) return item;
      if (item.serialNo && item.serialNo.toLowerCase() === rawClean) return item;
      if (item.modelNo && item.modelNo.toLowerCase() === rawClean) return item;
      if (snClean && item.serialNo && item.serialNo.toLowerCase() === snClean) return item;
      if (modelClean && item.modelNo && item.modelNo.toLowerCase() === modelClean) return item;
    }
    return null;
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

  // Handle a successfully scanned code
  const handleDecodedCode = (decodedString: string) => {
    if (!decodedString) return;
    playBeep();
    setIsProcessing(true);
    setCameraActive(false);
    stopCameraStream();

    const parsed = parseQrText(decodedString);
    const found = findMatchingItem(parsed);
    const orderMatch = findMatchingDeliveryOrder(parsed);

    setScannedResult(parsed);
    setMatchedItem(found);
    setMatchedOrder(orderMatch);
    setOrderUpdateFeedback(null);

    // Seed unregistered quick add form
    if (parsed.brand) setUnregisteredBrand(parsed.brand);
    if (parsed.modelNo) setUnregisteredModel(parsed.modelNo);
    if (parsed.price) setUnregisteredPrice(parsed.price);

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
          `Arrived at Lakhi Store verified via Barcode/QR Scanner (SN: ${serialLabel})`
        );
      }

      // If not yet in store stock, automatically add it or make available
      if (!matchedItem && onQuickAddItemDirect && scannedResult) {
        await onQuickAddItemDirect({
          name: scannedResult.name || `${scannedResult.brand || 'Daikin'} AC (From Delivery ${shId})`,
          modelNo: scannedResult.modelNo || 'DELIVERY-UNIT',
          type: scannedResult.type || 'AC',
          brand: scannedResult.brand || 'Daikin',
          serialNo: scannedResult.serialNo || scannedResult.raw,
          sellingPrice: scannedResult.price || 45000,
        });
      }

      setOrderUpdateFeedback('✅ Marked as ARRIVED AT STORE! In-store stock & live tracking updated.');
      // Refresh local matched order status
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
          `Delivered & verified via barcode scan (SN: ${serialLabel})`
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
    setMatchedItem(null);
    setMatchedOrder(null);
    setOrderUpdateFeedback(null);
    setQuickAddSuccess(false);

    try {
      stopCameraStream();

      // Check device cameras
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

        // Check torch support
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
        setCameraError('No camera found on this device. You can upload an image with a QR code or enter code manually.');
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

  // Continuous frame scanning loop using jsQR
  const startScanningLoop = () => {
    const scan = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleDecodedCode(code.data);
          return;
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

  // Flip Camera
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle Photo File Upload to scan QR
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleDecodedCode(code.data);
          } else {
            alert('No scannable QR code was detected in the uploaded image. Please try another angle or enter the serial code manually.');
          }
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
    handleDecodedCode(manualCode.trim());
    setManualCode('');
  };

  // Test Sample QR Codes for staff / demo
  const testSample = (type: 'DAIKIN' | 'VOLTAS' | 'EXISTING' | 'DELIVERY' | 'NEW_BARCODE') => {
    if (type === 'EXISTING' && inventory.length > 0) {
      const first = inventory[0];
      handleDecodedCode(first.serialNo || first.modelNo || first.id);
    } else if (type === 'DELIVERY' && shipments && shipments.length > 0) {
      const firstShipment = shipments[0];
      handleDecodedCode(firstShipment.id);
    } else if (type === 'NEW_BARCODE') {
      const randomSn = 'UNREG-SN-' + Math.floor(100000 + Math.random() * 900000);
      handleDecodedCode(randomSn);
    } else if (type === 'DAIKIN') {
      const json = JSON.stringify({
        name: 'Daikin 1.5 Ton 5-Star Inverter Split AC',
        modelNo: 'FTKF50TV16U',
        brand: 'Daikin',
        type: 'AC',
        serialNo: 'SN-DKN-' + Math.floor(100000 + Math.random() * 900000),
        price: 45990,
      });
      handleDecodedCode(json);
    } else {
      const json = JSON.stringify({
        name: 'Voltas 1.5 Ton 3-Star Adjustable Inverter AC',
        modelNo: '183V Vectra Prism',
        brand: 'Voltas',
        type: 'AC',
        serialNo: 'SN-VLT-' + Math.floor(100000 + Math.random() * 900000),
        price: 34990,
      });
      handleDecodedCode(json);
    }
  };

  // Quick 1-Click Save to Inventory
  const handleQuickAddDirect = async () => {
    if (!scannedResult || !onQuickAddItemDirect) return;
    setIsQuickAdding(true);
    try {
      const itemToSave = {
        name: scannedResult.name || scannedResult.modelNo || 'In-Store Appliance',
        modelNo: scannedResult.modelNo || 'GENERIC-MODEL',
        type: scannedResult.type || 'AC',
        brand: scannedResult.brand || 'Lakhi Store Stock',
        serialNo: scannedResult.serialNo || scannedResult.raw,
        sellingPrice: scannedResult.price || 0,
      };
      await onQuickAddItemDirect(itemToSave);
      setQuickAddSuccess(true);
      // Re-query inventory match
      setTimeout(() => {
        const found = findMatchingItem(scannedResult);
        if (found) setMatchedItem(found);
      }, 300);
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCameraStream();
      setCameraActive(false);
      setScannedResult(null);
      setMatchedItem(null);
      setQuickAddSuccess(false);
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-1.5">
                Device Camera QR / Label Scanner
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Point camera at product label or QR code to look up or add stock
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
                    {/* Darkened vignette surround */}
                    <div className="relative w-64 h-64 border-2 border-red-500/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                      {/* Animated Laser Scanning Line */}
                      <div className="absolute left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />

                      {/* Corner Target Markers */}
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-lg" />

                      <span className="text-[10px] font-mono font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs">
                        Align Label / QR Inside
                      </span>
                    </div>
                  </div>
                )}

                {/* Camera Top Controls Bar */}
                {cameraActive && (
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                    <span className="px-2 py-0.5 bg-black/60 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 backdrop-blur-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE FEED
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

              {/* Quick Actions Bar (Photo Upload & Sample Test Labels) */}
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
                  Upload Photo with QR
                </button>

                {/* Instant Simulation Buttons for quick testing without physical AC box */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-400 text-[10px] hidden sm:inline">Demo QR:</span>
                  <button
                    type="button"
                    onClick={() => testSample('DAIKIN')}
                    className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg hover:underline font-bold"
                  >
                    + Daikin AC
                  </button>
                  <button
                    type="button"
                    onClick={() => testSample('VOLTAS')}
                    className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg hover:underline font-bold"
                  >
                    + Voltas AC
                  </button>
                  {inventory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => testSample('EXISTING')}
                      className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:underline font-bold"
                      title="Test scanning first existing in-stock item"
                    >
                      + In-Stock Item
                    </button>
                  )}
                  {shipments && shipments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => testSample('DELIVERY')}
                      className="px-2 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-lg hover:underline font-bold"
                      title="Test scanning a pending delivery order"
                    >
                      + Delivery Order
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => testSample('NEW_BARCODE')}
                    className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:underline font-bold"
                    title="Test scanning an unregistered barcode"
                  >
                    + New Barcode
                  </button>
                </div>
              </div>

              {/* Manual Barcode / Serial Lookup Fallback */}
              <form onSubmit={handleManualLookup} className="pt-2">
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Or type/paste Serial No, Model No, Delivery ID (D...), or Invoice ID (I...)..."
                    className="w-full text-xs pl-9 pr-24 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="absolute right-1.5 top-1 px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors"
                  >
                    Lookup
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Scanned Result Card: Identified In-Stock Item vs Delivery Order Match vs New Item */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* ORDER UPDATE FEEDBACK TOAST */}
              {orderUpdateFeedback && (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{orderUpdateFeedback}</span>
                </div>
              )}

              {/* 1. MATCH FOUND IN INVENTORY */}
              {matchedItem ? (
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 dark:text-emerald-300">
                          Stock Item Found in Store!
                        </span>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          {matchedItem.name}
                        </h4>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ${
                        matchedItem.status === 'AVAILABLE'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {matchedItem.status}
                    </span>
                  </div>

                  {/* Item Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Brand</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">{matchedItem.brand}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Model No</span>
                      <strong className="text-slate-900 dark:text-white font-mono">{matchedItem.modelNo}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Selling Price</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                        ₹{matchedItem.sellingPrice.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Appliance Type</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
                        {matchedItem.type}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block font-bold">Serial Number</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        {matchedItem.serialNo || 'Not specified'}
                        {matchedItem.serialNo && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(matchedItem.serialNo);
                              setCopiedText('serial');
                              setTimeout(() => setCopiedText(null), 2000);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                            title="Copy Serial Number"
                          >
                            {copiedText === 'serial' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions for this Found Item */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {matchedItem.status === 'AVAILABLE' && onBillItem && (
                      <button
                        type="button"
                        onClick={() => {
                          onBillItem(matchedItem);
                          onClose();
                        }}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        + Bill / Invoice This Item
                      </button>
                    )}

                    {onToggleItemSold && (
                      <button
                        type="button"
                        onClick={() => onToggleItemSold(matchedItem.id)}
                        className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                      >
                        {matchedItem.status === 'AVAILABLE' ? 'Mark as Sold' : 'Mark as Available'}
                      </button>
                    )}

                    {onEditItem && (
                      <button
                        type="button"
                        onClick={() => {
                          onEditItem(matchedItem);
                          onClose();
                        }}
                        className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Stock Details
                      </button>
                    )}

                    {onHighlightItemInTable && (
                      <button
                        type="button"
                        onClick={() => {
                          onHighlightItemInTable(matchedItem.id);
                          onClose();
                        }}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                      >
                        Locate in Stock Table
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              {/* 2. MATCH FOUND IN DELIVERY (SHIPMENTS) OR INVOICE */}
              {matchedOrder && (
                <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-700 dark:text-purple-300">
                          Matched with Delivery & Customer Order!
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

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {matchedOrder.matchedReason || 'This scanned appliance or tracking code corresponds to an active delivery and customer invoice.'}
                  </p>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    {matchedOrder.shipment && (
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Delivery ID</span>
                        <strong className="text-purple-700 dark:text-purple-300 font-mono font-bold">
                          {matchedOrder.shipment.id}
                        </strong>
                      </div>
                    )}
                    {matchedOrder.invoice && (
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Tax Invoice #</span>
                        <strong className="text-slate-900 dark:text-white font-mono font-bold">
                          {matchedOrder.invoice.id}
                        </strong>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Customer Phone</span>
                      <strong className="text-slate-900 dark:text-white">
                        {matchedOrder.shipment?.customerPhone || matchedOrder.invoice?.customerPhone || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Delivery Address</span>
                      <strong className="text-slate-900 dark:text-white truncate block">
                        {matchedOrder.shipment?.deliveryAddress || matchedOrder.invoice?.installationAddress || 'Store Pickup'}
                      </strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block font-bold">Order Items</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {matchedOrder.shipment?.itemsSummary ||
                          (matchedOrder.invoice?.items || []).map((it) => it.name).join(', ') ||
                          'Appliance Unit'}
                      </strong>
                    </div>
                  </div>

                  {/* Actions to Mark Arrived at Store or Mark as Done */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {matchedOrder.shipment && matchedOrder.shipment.status !== 'ARRIVED_AT_STORE' && (
                      <button
                        type="button"
                        disabled={isUpdatingOrder}
                        onClick={handleMarkArrivedAtStore}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        {isUpdatingOrder ? 'Updating...' : 'Mark Arrived at Store (In Store / Here)'}
                      </button>
                    )}

                    {matchedOrder.shipment && matchedOrder.shipment.status !== 'DELIVERED_INSTALLED' && (
                      <button
                        type="button"
                        disabled={isUpdatingOrder}
                        onClick={handleMarkDeliveredDone}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isUpdatingOrder ? 'Updating...' : 'Mark Order as Done / Delivered'}
                      </button>
                    )}

                    {!matchedItem && onQuickAddItemDirect && (
                      <button
                        type="button"
                        disabled={isQuickAdding}
                        onClick={handleQuickAddDirect}
                        className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold hover:bg-purple-50 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Register into Store Stock
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 3. NOT FOUND IN INVENTORY AND NOT FOUND IN DELIVERIES / INVOICES */}
              {!matchedItem && !matchedOrder && (
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border-2 border-dashed border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-600 text-white rounded-xl shadow-xs">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-300">
                          Product Not Found in System
                        </span>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          {scannedResult.name || scannedResult.modelNo || 'Unregistered Product Label'}
                        </h4>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 rounded-full text-[10px] font-black shrink-0">
                      NOT IN STOCK
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      This product or serial is not in your Store Stock, Deliveries, or Invoices.
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                      Would you like to register and add this item to Store Stock now?
                    </p>
                  </div>

                  {/* Scanned Label Data Extract & Quick Edit inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/40">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Brand</span>
                      <input
                        type="text"
                        value={unregisteredBrand}
                        onChange={(e) => setUnregisteredBrand(e.target.value)}
                        placeholder="Brand (Daikin/Voltas)"
                        className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800 mt-1"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Model No</span>
                      <input
                        type="text"
                        value={unregisteredModel}
                        onChange={(e) => setUnregisteredModel(e.target.value)}
                        placeholder="Model No"
                        className="w-full text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800 mt-1"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Estimated Price (₹)</span>
                      <input
                        type="number"
                        value={unregisteredPrice}
                        onChange={(e) => setUnregisteredPrice(Number(e.target.value))}
                        className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800 mt-1"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-[10px] text-slate-400 block font-bold">Scanned Serial Number</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 mt-1">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        {scannedResult.serialNo || scannedResult.raw}
                      </span>
                    </div>
                  </div>

                  {quickAddSuccess ? (
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Item has been registered and added to Store Stock successfully!</span>
                    </div>
                  ) : (
                    /* Add Stock Actions */
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {onQuickAddItemDirect && (
                        <button
                          type="button"
                          disabled={isQuickAdding}
                          onClick={() => {
                            if (onQuickAddItemDirect) {
                              setIsQuickAdding(true);
                              onQuickAddItemDirect({
                                name: `${unregisteredBrand} ${unregisteredModel || 'Air Conditioner'}`,
                                modelNo: unregisteredModel || 'MODEL-STANDARD',
                                type: 'AC',
                                brand: unregisteredBrand,
                                serialNo: scannedResult.serialNo || scannedResult.raw,
                                sellingPrice: unregisteredPrice || 45000,
                              })
                                .then(() => {
                                  setQuickAddSuccess(true);
                                  setTimeout(() => {
                                    const found = findMatchingItem(scannedResult);
                                    if (found) setMatchedItem(found);
                                  }, 400);
                                })
                                .finally(() => setIsQuickAdding(false));
                            }
                          }}
                          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          {isQuickAdding ? 'Adding to Stock...' : '✅ Yes, Add to Store Stock Now'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onOpenAddItemWithData({
                            name: `${unregisteredBrand} ${unregisteredModel || 'Air Conditioner'}`,
                            modelNo: unregisteredModel || scannedResult.modelNo || '',
                            brand: unregisteredBrand,
                            serialNo: scannedResult.serialNo || scannedResult.raw,
                            price: unregisteredPrice,
                            type: 'AC',
                          });
                          onClose();
                        }}
                        className="px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Open Full Add Form (Prefilled)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Reset to Scan Next */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Scan Another Label / QR Code
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
