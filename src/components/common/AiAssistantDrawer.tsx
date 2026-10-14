import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Receipt,
  Boxes,
  Truck,
  ArrowRight,
  ExternalLink,
  Barcode,
  Loader2,
  Check,
  RefreshCw,
  HelpCircle,
  Maximize2,
  Minimize2,
  Copy,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Quotation, Invoice, InventoryItem, Shipment } from '../../types';
import { generateQuotationPdf, generateInvoicePdf } from '../../utils/pdfGenerator';
import { resolvePdfLinks } from '../../utils/cloudPdfHelper';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  onOpenBarcodeScanner?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  action?: {
    type: 'CREATE_QUOTATION' | 'CREATE_INVOICE' | 'ADD_STOCK' | 'MARK_DELIVERY_ARRIVED' | 'NAVIGATE_TAB' | 'NONE';
    payload?: any;
    status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'DONE';
    resultId?: string;
    resultPdfUrl?: string;
  };
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenBarcodeScanner,
}) => {
  const {
    isAdmin,
    viewMode,
    customers,
    inventory,
    quotations,
    invoices,
    shipments,
    addQuotation,
    addInvoice,
    addInventoryItem,
    updateShipmentStatus,
    addShipmentTrackingUpdate,
    gstNumber,
  } = useApp();

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Namaste! I am Lakhi AI, your official Store & ERP Copilot for Lakhi Electronics & Airconditioners. You can type or speak to me to create quotations with serial numbers, generate invoices, check stock counts, track deliveries, or query customer dues. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Supports Indian English & common Hindi/Hinglish terms

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInputMessage(transcript);
        };

        recognition.onerror = (err: any) => {
          console.warn('Speech recognition error:', err);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start recognition:', err);
        setIsListening(false);
      }
    }
  };

  const quickChips = [
    {
      label: '⚡ Make Quotation (with serials)',
      prompt:
        'Create quotation for Gautam Sharma (phone 9876543210): 2 units Daikin 1.5 Ton 5-Star Split AC with serial numbers DKN-101 and DKN-102 at rate 46500 each, and 1 Voltas 1 Ton AC at 32000. 18% GST included.',
    },
    {
      label: '📦 Check Available Inverter ACs',
      prompt: 'Check our store stock: how many Daikin and Voltas ACs do we have available right now, and list their model and serial numbers.',
    },
    {
      label: '🚚 What Deliveries are In Transit?',
      prompt: 'Show all customer deliveries that are currently pending, in transit or scheduled.',
    },
    {
      label: '🧾 Check Customer Dues & Invoices',
      prompt: 'Which customers currently have pending dues or unpaid invoices?',
    },
    {
      label: '➕ Inward 3 Units of Same Product',
      prompt: 'Add 3 units of Daikin 1.5 Ton 5-Star Split AC model FTKF50TV to store stock at ₹46,500 each with serials DKN-FTKF-101, DKN-FTKF-102, DKN-FTKF-103.',
    },
  ];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build database snapshot context to feed the AI model
      const dbContext = {
        customers: customers.map((c) => ({
          id: c.id,
          name: c.externalName,
          phone: c.phone,
          balance: c.accountBalance,
        })),
        inventory: inventory.map((i) => ({
          id: i.id,
          name: i.name,
          brand: i.brand,
          model: i.modelNo,
          serial: i.serialNo,
          price: i.sellingPrice,
          status: i.status,
        })),
        quotations: quotations.slice(0, 15).map((q) => ({
          id: q.id,
          customer: q.customerExternalName,
          total: q.totalAmount,
          date: q.createdAt,
          itemsCount: q.items.length,
        })),
        invoices: invoices.slice(0, 15).map((inv) => ({
          id: inv.id,
          customer: inv.customerExternalName,
          total: inv.totalAmount,
          due: inv.amountDue,
          status: inv.paymentStatus,
          items: inv.items.map((it) => ({ name: it.name, serial: it.serialNo })),
        })),
        shipments: shipments.slice(0, 15).map((s) => ({
          id: s.id,
          customer: s.customerExternalName,
          status: s.status,
          items: s.itemsSummary,
          driver: s.driverName,
        })),
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          context: dbContext,
          isAdmin: Boolean(isAdmin),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const actionData = data.action && data.action.type !== 'NONE' ? { ...data.action, status: 'PENDING' } : undefined;

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.reply || 'Request processed.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: actionData,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        // Fallback local smart response if endpoint errored
        handleLocalFallback(textToSend);
      }
    } catch (err) {
      console.warn('AI chat error, using local fallback:', err);
      handleLocalFallback(textToSend);
    } finally {
      setIsLoading(false);
    }
  };

  // Local fallback parser in case backend AI route is unreachable
  const handleLocalFallback = (text: string) => {
    const lower = text.toLowerCase();
    let reply = '';
    let action: ChatMessage['action'] | undefined = undefined;

    if (lower.includes('quote') || lower.includes('quotation')) {
      reply = `I have drafted a quotation based on your request. Please review the details below before saving:`;
      // Extract rough fields
      const custMatch = text.match(/(?:for|to|customer|client)[:\s]+([A-Za-z\s]+?)(?:,|\.|\n|phone|\d)/i);
      const name = custMatch ? custMatch[1].trim() : 'Valued Customer';
      const snMatch = text.match(/(?:serial|sn|sno)[:\s]*([A-Z0-9-, ]+)/i);
      const serials = snMatch ? snMatch[1].trim() : 'DKN-77821';

      action = {
        type: 'CREATE_QUOTATION',
        status: 'PENDING',
        payload: {
          customerName: name,
          customerPhone: '9876543210',
          billingAddress: 'Main Store Delivery Area',
          installationAddress: 'Main Store Delivery Area',
          notes: 'Standard 1-Year Machine Warranty • 5-Year Compressor Warranty',
          items: [
            {
              name: 'Daikin 1.5 Ton 5-Star Inverter Split AC',
              modelNo: 'FTKF50TV16U',
              brand: 'Daikin',
              type: 'AC',
              serialNo: serials,
              quantity: 1,
              rate: 46500,
              taxPercent: 18,
              isAmountWithTax: true,
            },
          ],
        },
      };
    } else if (lower.includes('stock') || lower.includes('inventory')) {
      const avail = inventory.filter((i) => !i.isArchived && i.status !== 'ARCHIVED' && i.status === 'AVAILABLE');
      reply = `We currently have ${avail.length} items in available store stock across Daikin, Voltas, and other brands.`;
    } else if (lower.includes('shipment') || lower.includes('delivery')) {
      const pending = shipments.filter((s) => s.status !== 'DELIVERED_INSTALLED');
      reply = `There are ${pending.length} active shipments / deliveries in the system.`;
    } else {
      reply = `I have received your note. I can query our store stock, calculate quotations, check invoices, or look up customer records for you.`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action,
      },
    ]);
  };

  /* =========================================================================
     ACTION EXECUTION & CONFIRMATION
     ========================================================================= */

  const handleConfirmQuotation = async (msgId: string, payload: any) => {
    try {
      // Find or create customer
      let custId = '';
      const existing = customers.find(
        (c) =>
          c.externalName.toLowerCase().trim() === payload.customerName.toLowerCase().trim() ||
          (payload.customerPhone && c.phone.includes(payload.customerPhone.slice(-6)))
      );
      if (existing) {
        custId = existing.id;
      }

      // Prepare items
      const items = (payload.items || []).map((it: any, idx: number) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || 45000;
        const tax = Number(it.taxPercent) || 18;
        const isTax = it.isAmountWithTax !== false;
        const lineTotal = isTax ? qty * rate : qty * rate * (1 + tax / 100);

        return {
          id: `item-${Date.now()}-${idx}`,
          name: it.name || 'Split Air Conditioner',
          modelNo: it.modelNo || 'STANDARD-MODEL',
          type: it.type || 'AC',
          brand: it.brand || 'Daikin',
          serialNo: it.serialNo || '',
          quantity: qty,
          rate,
          taxPercent: tax,
          isAmountWithTax: isTax,
          lineTotal,
        };
      });

      const totalAmount = items.reduce((sum: number, it: any) => sum + it.lineTotal, 0);
      const subtotal = totalAmount / 1.18;
      const taxAmount = totalAmount - subtotal;

      const newQuoteId = await addQuotation({
        customerId: custId,
        customerExternalName: payload.customerName,
        customerPhone: payload.customerPhone || 'Not specified',
        billingAddress: payload.billingAddress || 'Store Pickup / Standard Delivery',
        installationAddress: payload.installationAddress || payload.billingAddress || 'Store Pickup',
        items,
        subtotal,
        taxAmount,
        totalAmount,
        status: 'RECORDED',
        gstNumber,
        notes: payload.notes || '1-Year Product Warranty • 5-Year Compressor Warranty',
      });

      // Update message status
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: newQuoteId,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error confirming quotation:', err);
      alert('Failed to save quotation: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmInvoice = async (msgId: string, payload: any) => {
    try {
      const items = (payload.items || []).map((it: any, idx: number) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || 45000;
        const tax = Number(it.taxPercent) || 18;
        const isTax = it.isAmountWithTax !== false;
        const lineTotal = isTax ? qty * rate : qty * rate * (1 + tax / 100);

        return {
          id: `inv-item-${Date.now()}-${idx}`,
          name: it.name || 'Split Air Conditioner',
          modelNo: it.modelNo || 'STANDARD-MODEL',
          type: it.type || 'AC',
          brand: it.brand || 'Daikin',
          serialNo: it.serialNo || '',
          quantity: qty,
          rate,
          taxPercent: tax,
          isAmountWithTax: isTax,
          discount: 0,
          lineTotal,
        };
      });

      const totalAmount = items.reduce((sum: number, it: any) => sum + it.lineTotal, 0);
      const subtotal = totalAmount / 1.18;
      const taxAmount = totalAmount - subtotal;

      const newInvId = await addInvoice({
        customerId: '',
        customerExternalName: payload.customerName,
        customerPhone: payload.customerPhone || 'Not specified',
        billingAddress: payload.billingAddress || 'Store Pickup',
        installationAddress: payload.installationAddress || payload.billingAddress || 'Store Pickup',
        items,
        subtotal,
        taxAmount,
        discountAmount: 0,
        totalAmount,
        prepaidSplits: {
          fromBalance: 0,
          upi: { amount: 0, receivingBank: '', utr: '' },
          card: { amount: 0, receivingBank: '', authId: '' },
          chequeOrNeft: { amount: 0, chequeOrSlipOrUtr: '', bank: '' },
          cash: { amount: 0, drawerRegister: '' },
        },
        totalPrepaid: 0,
        amountDue: totalAmount,
        paymentStatus: 'UNPAID',
        gstNumber,
        notes: payload.notes || 'Tax Invoice generated via AI Copilot',
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: newInvId,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error confirming invoice:', err);
      alert('Failed to save invoice: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmStockAdd = async (msgId: string, payload: any) => {
    try {
      const qty = Math.max(
        1,
        Number(payload.quantity) ||
          (Array.isArray(payload.serialNumbers) && payload.serialNumbers.length > 0
            ? payload.serialNumbers.length
            : 1)
      );

      const brandPrefix = (payload.brand || 'LAK').slice(0, 3).toUpperCase();
      const modelClean = (payload.modelNo || 'AC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();

      const createdIds: string[] = [];
      for (let i = 0; i < qty; i++) {
        let serial =
          Array.isArray(payload.serialNumbers) && payload.serialNumbers[i]
            ? payload.serialNumbers[i].trim()
            : qty === 1 && payload.serialNo
            ? payload.serialNo.trim()
            : `${brandPrefix}-${modelClean}-${Date.now().toString().slice(-4)}${(i + 1).toString().padStart(2, '0')}`;

        const newStockId = await addInventoryItem({
          name: payload.name || `${payload.brand || 'Daikin'} AC`,
          modelNo: payload.modelNo || 'FTKF50TV',
          type: payload.type || 'AC',
          brand: payload.brand || 'Daikin',
          serialNo: serial,
          sellingPrice: Number(payload.sellingPrice) || 45000,
        });
        createdIds.push(newStockId);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: qty > 1 ? `${qty} Units Added` : createdIds[0],
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error adding stock item:', err);
      alert('Failed to add stock: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmDeliveryArrived = async (msgId: string, payload: any) => {
    try {
      const shipment = shipments.find(
        (s) =>
          s.id.toLowerCase() === (payload.shipmentId || '').toLowerCase() ||
          s.itemsSummary.toLowerCase().includes((payload.shipmentId || '').toLowerCase())
      );

      if (shipment) {
        await updateShipmentStatus(
          shipment.id,
          'ARRIVED_AT_STORE',
          undefined,
          undefined,
          undefined,
          undefined,
          'Marked arrived at Lakhi store via AI Assistant'
        );
        await addShipmentTrackingUpdate(
          shipment.id,
          'Appliance / Package verified arrived at Lakhi store'
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  action: {
                    ...m.action!,
                    status: 'DONE',
                    resultId: shipment.id,
                  },
                }
              : m
          )
        );
      } else {
        alert('Could not find matching shipment in database.');
      }
    } catch (err: any) {
      console.error('Error updating shipment:', err);
      alert('Failed to update delivery: ' + (err.message || 'Unknown error'));
    }
  };

  if (!isOpen) return null;

  if (!isAdmin || viewMode !== 'STAFF') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Staff Admin Access Required</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The Lakhi AI Assistant and intelligent ERP automation features are strictly restricted to authenticated staff administrators.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-all duration-300">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-linear-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base tracking-tight leading-tight">Lakhi AI Assistant</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                  Voice & Database Connected
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                Type or speak to create quotes, invoices, query stock, and track orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenBarcodeScanner && (
              <button
                type="button"
                onClick={() => {
                  onOpenBarcodeScanner();
                }}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
                title="Open Barcode / QR Scanner"
              >
                <Barcode className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Close Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none flex gap-2">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip.prompt)}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 hover:border-red-300 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap transition-colors shadow-2xs flex items-center gap-1.5"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chat History Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-red-600 text-white rounded-tr-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-xs border border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div
                      className={`text-[10px] mt-1.5 text-right font-medium ${
                        isUser ? 'text-white/70' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* ACTION CONFIRMATION CARD (when AI drafts a Quotation, Invoice, Stock or Delivery Update) */}
                  {msg.action && (
                    <div className="bg-white dark:bg-slate-950 rounded-2xl border-2 border-red-500/40 p-4 shadow-md space-y-3">
                      {/* QUOTATION CONFIRMATION */}
                      {msg.action.type === 'CREATE_QUOTATION' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400">
                              <FileCheck2 className="w-4 h-4" />
                              <span>CONFIRM QUOTATION DETAILS</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                msg.action.status === 'DONE'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : msg.action.status === 'CANCELLED'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}
                            >
                              {msg.action.status === 'DONE' ? 'Saved to Database' : msg.action.status}
                            </span>
                          </div>

                          {/* Customer Details */}
                          <div className="mt-2.5 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                              <span>Customer: {msg.action.payload?.customerName || 'Walk-in Customer'}</span>
                              <span className="text-slate-500 font-mono text-[11px]">
                                {msg.action.payload?.customerPhone || ''}
                              </span>
                            </div>
                            {msg.action.payload?.billingAddress && (
                              <p className="text-[11px] text-slate-500 truncate">
                                Address: {msg.action.payload.billingAddress}
                              </p>
                            )}
                          </div>

                          {/* Items & Serial Numbers List */}
                          <div className="mt-2 space-y-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                              Products & Serials to be Included:
                            </span>
                            {(msg.action.payload?.items || []).map((it: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex justify-between items-start gap-2"
                              >
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{it.name}</div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>Model: {it.modelNo || 'N/A'}</span>
                                    {it.serialNo && (
                                      <span className="font-mono text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                                        <Barcode className="w-3 h-3" />
                                        SN: {it.serialNo}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    Qty: {it.quantity || 1}
                                  </div>
                                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    ₹{Number(it.rate || 0).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => handleConfirmQuotation(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Save to Database
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id
                                        ? { ...m, action: { ...m.action!, status: 'CANCELLED' } }
                                        : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' && msg.action.resultId ? (
                            <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold">
                              <span>✅ Quotation Saved: {msg.action.resultId}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateTab('quotations');
                                  onClose();
                                }}
                                className="underline hover:text-emerald-600"
                              >
                                View in Quotes List →
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* INVOICE CONFIRMATION */}
                      {msg.action.type === 'CREATE_INVOICE' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400">
                              <Receipt className="w-4 h-4" />
                              <span>CONFIRM TAX INVOICE DETAILS</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                              {msg.action.status}
                            </span>
                          </div>

                          <div className="mt-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl text-xs">
                            <div className="font-bold text-slate-900 dark:text-white">
                              Customer: {msg.action.payload?.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              Products:{' '}
                              {(msg.action.payload?.items || []).map((it: any) => it.name).join(', ')}
                            </div>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => handleConfirmInvoice(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Generate Tax Invoice
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' && msg.action.resultId ? (
                            <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold">
                              <span>✅ Invoice Generated: {msg.action.resultId}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateTab('invoices');
                                  onClose();
                                }}
                                className="underline"
                              >
                                Open Invoices →
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* ADD STOCK CONFIRMATION */}
                      {/* ADD STOCK CONFIRMATION */}
                      {msg.action.type === 'ADD_STOCK' && (() => {
                        const qty = Math.max(
                          1,
                          Number(msg.action.payload?.quantity) ||
                            (Array.isArray(msg.action.payload?.serialNumbers) && msg.action.payload.serialNumbers.length > 0
                              ? msg.action.payload.serialNumbers.length
                              : 1)
                        );
                        const serials: string[] = Array.isArray(msg.action.payload?.serialNumbers)
                          ? msg.action.payload.serialNumbers
                          : msg.action.payload?.serialNo
                          ? [msg.action.payload.serialNo]
                          : [];

                        return (
                          <div>
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
                                <Boxes className="w-4 h-4" />
                                <span>{qty > 1 ? `ADD ${qty} UNITS TO STORE STOCK` : 'ADD ITEM TO STORE STOCK'}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                {qty} {qty === 1 ? 'Unit' : 'Units'}
                              </span>
                            </div>

                            <div className="mt-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl text-xs space-y-1.5">
                              <div className="font-bold text-slate-900 dark:text-white">{msg.action.payload?.name}</div>
                              <div className="flex flex-wrap items-center gap-2 text-slate-500 font-mono text-[11px]">
                                <span>Model: {msg.action.payload?.modelNo || 'Standard'}</span>
                                <span>•</span>
                                <span>Brand: {msg.action.payload?.brand || 'Daikin'}</span>
                              </div>

                              {serials.length > 0 ? (
                                <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                                  <span className="text-[10px] text-slate-400 block mb-1">
                                    Specified Serial Numbers ({serials.length}):
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {serials.map((sn, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold"
                                      >
                                        #{sIdx + 1}: {sn}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : qty > 1 ? (
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                                  ⚡ Sequential serial numbers will be auto-generated for each unit.
                                </div>
                              ) : null}

                              <div className="font-bold text-emerald-600 text-xs">
                                Unit Price: ₹{Number(msg.action.payload?.sellingPrice || 0).toLocaleString('en-IN')}
                                {qty > 1 && (
                                  <span className="text-slate-500 font-normal ml-1">
                                    (Total: ₹{(Number(msg.action.payload?.sellingPrice || 0) * qty).toLocaleString('en-IN')})
                                  </span>
                                )}
                              </div>
                            </div>

                            {msg.action.status === 'PENDING' ? (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmStockAdd(msg.id, msg.action?.payload)}
                                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Confirm & Add {qty} Unit{qty > 1 ? 's' : ''} to Stock</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMessages((prev) =>
                                      prev.map((m) =>
                                        m.id === msg.id
                                          ? { ...m, action: { ...m.action!, status: 'CANCELLED' } }
                                          : m
                                      )
                                    )
                                  }
                                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : msg.action.status === 'DONE' ? (
                              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between">
                                <span>✅ {msg.action.resultId || 'Stock'} registered in store inventory!</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onNavigateTab('inventory');
                                    onClose();
                                  }}
                                  className="underline hover:text-emerald-600 text-[11px]"
                                >
                                  View Stock Table →
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}

                      {/* MARK DELIVERY ARRIVED */}
                      {msg.action.type === 'MARK_DELIVERY_ARRIVED' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-purple-600 dark:text-purple-400">
                              <Truck className="w-4 h-4" />
                              <span>DELIVERY STATUS UPDATE</span>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            Target Shipment ID: <strong>{msg.action.payload?.shipmentId}</strong>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeliveryArrived(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                              >
                                ✅ Mark as Arrived at Store Now
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ Delivery status updated to ARRIVED_AT_STORE!
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 justify-start animate-pulse">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl rounded-tl-xs px-4 py-3 text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                <span>Lakhi AI is querying database & thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Voice Recording / Listening Banner */}
        {isListening && (
          <div className="px-4 py-2.5 bg-red-500 text-white text-xs font-bold flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>Listening to your voice... Speak clearly in English or Hindi</span>
            </div>
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className="text-[11px] underline font-bold"
            >
              Stop
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {speechSupported && (
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2.5 rounded-xl transition-all shadow-xs shrink-0 ${
                  isListening
                    ? 'bg-red-600 text-white ring-4 ring-red-400/40 animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={isListening ? 'Stop Listening' : 'Click to Speak (Voice Input)'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-red-600" />}
              </button>
            )}

            <div className="relative flex-1">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={isListening ? 'Listening...' : 'Type or speak: e.g. "Create quote for Gaurav, 2 Daikin ACs with serials..."'}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="p-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition-colors shrink-0"
              title="Send Request"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5 flex items-center justify-center gap-2">
            <span>Powered by Gemini AI</span>
            <span>•</span>
            <span>Live Firestore Database Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
