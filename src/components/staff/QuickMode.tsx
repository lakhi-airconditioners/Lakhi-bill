import React, { useState, useMemo } from 'react';
import {
  Zap,
  FileCheck2,
  Receipt,
  UserPlus,
  Truck,
  Plus,
  Search,
  Check,
  Copy,
  ExternalLink,
  Eye,
  AlertCircle,
  Phone,
  User,
  MapPin,
  Clock,
  Sparkles,
  CreditCard,
  QrCode,
  Banknote,
  Boxes,
  KeyRound,
  ShieldCheck,
  Edit2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Send,
  Barcode,
  Trash2,
  Mic,
  Camera,
  CheckCircle2,
  Bot,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, QuotationItem, InvoiceLineItem, Quotation, Invoice, Shipment, ShipmentStatus } from '../../types';
import { generateInvoicePdf, generateQuotationPdf } from '../../utils/pdfGenerator';
import { resolvePdfLinks } from '../../utils/cloudPdfHelper';
import { parseQuotationWithAi } from '../../utils/aiQuotationService';
import { AiQuotationBuilderModal } from './AiQuotationBuilderModal';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import { CustomerModal } from '../common/CustomerModal';
import { CustomerSelectBox } from '../common/CustomerSelectBox';

interface QuickModeProps {
  onNavigateTab: (tabId: string) => void;
  onConvertToInvoice?: (quote: Quotation) => void;
  onShipInvoice?: (inv: Invoice) => void;
  onOpenAiAssistant?: () => void;
  onOpenBarcodeScanner?: () => void;
}

export const QuickMode: React.FC<QuickModeProps> = ({
  onNavigateTab,
  onConvertToInvoice,
  onShipInvoice,
  onOpenAiAssistant,
  onOpenBarcodeScanner,
}) => {
  const {
    customers,
    quotations,
    invoices,
    shipments,
    addQuotation,
    addInvoice,
    addShipmentTrackingUpdate,
    updateShipmentStatus,
    changeCustomerPin,
    gstNumber,
    inventory,
  } = useApp();

  // Active quick action tool
  const [activeTool, setActiveTool] = useState<'QUOTE' | 'INVOICE' | 'DELIVERY' | 'CUSTOMER' | 'SEARCH'>('QUOTE');

  // Customer Modal for Add/Edit Customer
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEditModal, setCustomerToEditModal] = useState<Customer | null>(null);
  const [customerModalInitialQuery, setCustomerModalInitialQuery] = useState('');

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Copied feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2500);
  };

  /* =========================================================================
     1. QUICK ENTRY QUOTE STATE & LOGIC (MULTI-PRODUCT + SERIAL NUMBERS + CONFIRMATION)
     ========================================================================= */
  const [qCustomerId, setQCustomerId] = useState('');
  const [qCustomerName, setQCustomerName] = useState('');
  const [qCustomerPhone, setQCustomerPhone] = useState('');
  const [qBillingAddress, setQBillingAddress] = useState('');
  const [qInstallationAddress, setQInstallationAddress] = useState('');
  const [qNotes, setQNotes] = useState('Standard 1-Year Machine Warranty • GST 18% included');

  // Multi-item Quotation State with Serial Numbers
  interface QuickQuoteItemRow {
    id: string;
    name: string;
    modelNo: string;
    brand: string;
    type: string;
    serialNo: string;
    quantity: number;
    rate: number;
    taxPercent: number;
    isAmountWithTax: boolean;
  }

  const [qItems, setQItems] = useState<QuickQuoteItemRow[]>([
    {
      id: 'item-1',
      name: '',
      modelNo: '',
      brand: 'Daikin',
      type: 'AC',
      serialNo: '',
      quantity: 1,
      rate: 0,
      taxPercent: 18,
      isAmountWithTax: true,
    },
  ]);

  // Review & Confirmation State
  const [isReviewConfirmingQuote, setIsReviewConfirmingQuote] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [createdQuoteResult, setCreatedQuoteResult] = useState<Quotation | null>(null);
  const [quoteError, setQuoteError] = useState('');

  // AI Voice & Fast Autofill state
  const [isAiWizardModalOpen, setIsAiWizardModalOpen] = useState(false);
  const [isAiFastPromptOpen, setIsAiFastPromptOpen] = useState(false);
  const [fastPromptText, setFastPromptText] = useState('');
  const [isParsingAiPrompt, setIsParsingAiPrompt] = useState(false);

  // Computations
  const qItemsWithTotals = useMemo(() => {
    return qItems.map((item) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.rate) || 0;
      const tax = Number(item.taxPercent) || 18;
      const lineTotal = item.isAmountWithTax
        ? qty * rate
        : qty * rate * (1 + tax / 100);
      return {
        ...item,
        lineTotal: Number(lineTotal.toFixed(2)),
      };
    });
  }, [qItems]);

  const qGrandTotal = useMemo(() => {
    return qItemsWithTotals.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [qItemsWithTotals]);

  const qSubtotal = useMemo(() => {
    return qItemsWithTotals.reduce((sum, item) => {
      const lineSub = item.isAmountWithTax
        ? item.lineTotal / (1 + (Number(item.taxPercent) || 18) / 100)
        : Number(item.rate) * Number(item.quantity);
      return sum + lineSub;
    }, 0);
  }, [qItemsWithTotals]);

  const qTaxAmount = useMemo(() => {
    return Math.max(0, qGrandTotal - qSubtotal);
  }, [qGrandTotal, qSubtotal]);

  const handleSelectCustomerForQuote = (custId: string) => {
    setQCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setQCustomerName(found.externalName);
      setQCustomerPhone(found.phone);
      setQBillingAddress(found.billingAddress || '');
      setQInstallationAddress(found.installationAddress || found.billingAddress || '');
    }
  };

  const handleAddQuoteItem = () => {
    setQItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        name: '',
        modelNo: '',
        brand: 'Daikin',
        type: 'AC',
        serialNo: '',
        quantity: 1,
        rate: 0,
        taxPercent: 18,
        isAmountWithTax: true,
      },
    ]);
  };

  const handleUpdateQuoteItem = (index: number, field: keyof QuickQuoteItemRow, value: any) => {
    setQItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveQuoteItem = (index: number) => {
    setQItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  // AI Fast Prompt Fill
  const handleRunAiFastFill = async () => {
    if (!fastPromptText.trim()) return;
    setIsParsingAiPrompt(true);
    setQuoteError('');
    try {
      const parsed = await parseQuotationWithAi(fastPromptText);
      if (parsed.customerName) setQCustomerName(parsed.customerName);
      if (parsed.customerPhone) setQCustomerPhone(parsed.customerPhone);
      if (parsed.billingAddress) setQBillingAddress(parsed.billingAddress);
      if (parsed.installationAddress) setQInstallationAddress(parsed.installationAddress);
      if (parsed.notes) setQNotes(parsed.notes);

      if (parsed.items && parsed.items.length > 0) {
        setQItems(
          parsed.items.map((it, idx) => ({
            id: `ai-item-${Date.now()}-${idx}`,
            name: it.name || 'Air Conditioner',
            modelNo: it.modelNo || '',
            brand: it.brand || 'Daikin',
            type: it.type || 'AC',
            serialNo: it.serialNo || '',
            quantity: it.quantity || 1,
            rate: it.rate || 45000,
            taxPercent: it.taxPercent || 18,
            isAmountWithTax: it.isAmountWithTax !== false,
          }))
        );
      }
      setIsAiFastPromptOpen(false);
      setFastPromptText('');
      // Immediately open confirmation review card so staff sees it before saving!
      setIsReviewConfirmingQuote(true);
    } catch (err: any) {
      console.error('AI fast fill error:', err);
      setQuoteError('Could not parse text with AI. Please check details.');
    } finally {
      setIsParsingAiPrompt(false);
    }
  };

  // Trigger Review Confirmation Modal/Card
  const handleInitiateReviewQuote = (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteError('');
    if (!qCustomerName.trim()) {
      setQuoteError('Please enter or select a customer name.');
      return;
    }
    const hasValidItem = qItems.some((it) => it.name.trim() && Number(it.rate) > 0);
    if (!hasValidItem) {
      setQuoteError('Please enter at least one product with name and price rate.');
      return;
    }
    setIsReviewConfirmingQuote(true);
  };

  // Finalize and Save to Database after Confirmation
  const handleFinalizeSaveQuote = async () => {
    setIsSubmittingQuote(true);
    setQuoteError('');
    try {
      const formattedItems: QuotationItem[] = qItemsWithTotals.map((it, idx) => ({
        id: `q-item-${Date.now()}-${idx}`,
        name: it.name.trim(),
        modelNo: it.modelNo.trim() || 'STANDARD-MODEL',
        type: it.type,
        brand: it.brand,
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate),
        taxPercent: Number(it.taxPercent) || 18,
        isAmountWithTax: it.isAmountWithTax,
        lineTotal: it.lineTotal,
      }));

      // In notes, append unit serial numbers clearly
      const serialsParts = qItems
        .filter((it) => it.serialNo && it.serialNo.trim())
        .map((it) => `${it.name}: (SN: ${it.serialNo.trim()})`);

      const finalNotes = serialsParts.length > 0
        ? `${qNotes.trim() ? qNotes.trim() + ' | ' : ''}Serials: ${serialsParts.join(', ')}`
        : qNotes.trim();

      const newId = await addQuotation({
        customerId: qCustomerId || 'WALK-IN',
        customerExternalName: qCustomerName.trim(),
        customerPhone: qCustomerPhone.trim() || '+91 99980 21446',
        billingAddress: qBillingAddress.trim() || 'Vadodara, Gujarat',
        installationAddress: qInstallationAddress.trim() || qBillingAddress.trim() || 'Vadodara, Gujarat',
        items: formattedItems,
        subtotal: Number(qSubtotal.toFixed(2)),
        taxAmount: Number(qTaxAmount.toFixed(2)),
        totalAmount: Number(qGrandTotal.toFixed(2)),
        status: 'RECORDED',
        notes: finalNotes,
        gstNumber: gstNumber || '',
      });

      const created: Quotation = {
        id: newId,
        customerId: qCustomerId || 'WALK-IN',
        customerExternalName: qCustomerName.trim(),
        customerPhone: qCustomerPhone.trim() || '+91 99980 21446',
        billingAddress: qBillingAddress.trim() || 'Vadodara, Gujarat',
        installationAddress: qInstallationAddress.trim() || 'Vadodara, Gujarat',
        items: formattedItems,
        subtotal: Number(qSubtotal.toFixed(2)),
        taxAmount: Number(qTaxAmount.toFixed(2)),
        totalAmount: Number(qGrandTotal.toFixed(2)),
        status: 'RECORDED',
        notes: finalNotes,
        gstNumber: gstNumber || '',
        createdAt: new Date().toISOString(),
      };

      setCreatedQuoteResult(created);
      setIsReviewConfirmingQuote(false);

      // Reset items for next entry
      setQItems([
        {
          id: `item-${Date.now()}`,
          name: '',
          modelNo: '',
          brand: 'Daikin',
          type: 'AC',
          serialNo: '',
          quantity: 1,
          rate: 0,
          taxPercent: 18,
          isAmountWithTax: true,
        },
      ]);
      setQCustomerName('');
      setQCustomerId('');
      setQCustomerPhone('');
      setQBillingAddress('');
      setQInstallationAddress('');
    } catch (err: any) {
      console.error(err);
      setQuoteError(err?.message || 'Failed to save quotation.');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  /* =========================================================================
     2. QUICK ENTRY INVOICE STATE & LOGIC
     ========================================================================= */
  const [invCustomerId, setInvCustomerId] = useState('');
  const [invCustomerName, setInvCustomerName] = useState('');
  const [invCustomerPhone, setInvCustomerPhone] = useState('');
  const [invBillingAddress, setInvBillingAddress] = useState('');
  const [invItemName, setInvItemName] = useState('');
  const [invItemModel, setInvItemModel] = useState('');
  const [invItemType, setInvItemType] = useState('AC');
  const [invSerialNo, setInvSerialNo] = useState('');
  const [invQty, setInvQty] = useState<number>(1);
  const [invRate, setInvRate] = useState<number>(0);
  const [invTax, setInvTax] = useState<number>(18);
  const [invPaymentMode, setInvPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'UNPAID'>('UPI');
  const [invPaymentUtr, setInvPaymentUtr] = useState('');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [createdInvoiceResult, setCreatedInvoiceResult] = useState<Invoice | null>(null);
  const [invError, setInvError] = useState('');

  const invLineTotal = Number(invQty) * Number(invRate);

  const handleSelectCustomerForInvoice = (custId: string) => {
    setInvCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setInvCustomerName(found.externalName);
      setInvCustomerPhone(found.phone);
      setInvBillingAddress(found.billingAddress || '');
    }
  };

  const handleCreateQuickInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvError('');
    if (!invCustomerName.trim()) {
      setInvError('Customer name is required.');
      return;
    }
    if (!invItemName.trim()) {
      setInvError('Item name is required.');
      return;
    }
    if (invRate <= 0) {
      setInvError('Enter a valid amount / selling rate.');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const lineItem: InvoiceLineItem = {
        id: 'line-quick-1',
        name: invItemName.trim(),
        modelNo: invItemModel.trim() || 'Standard Model',
        type: invItemType,
        serialNo: invSerialNo.trim() || 'SN-LAKHI-' + Math.floor(100000 + Math.random() * 900000),
        quantity: Number(invQty) || 1,
        rate: Number(invRate),
        taxPercent: Number(invTax) || 18,
        isAmountWithTax: true,
        discount: 0,
        lineTotal: Number(invLineTotal.toFixed(2)),
      };

      const subtotal = lineItem.lineTotal / (1 + lineItem.taxPercent / 100);
      const taxAmount = lineItem.lineTotal - subtotal;
      const isPaid = invPaymentMode !== 'UNPAID';
      const prepaidAmount = isPaid ? invLineTotal : 0;

      const splits = {
        fromBalance: 0,
        upi: {
          amount: invPaymentMode === 'UPI' ? invLineTotal : 0,
          receivingBank: 'HDFC Bank',
          utr: invPaymentUtr.trim() || 'UPI-REF-' + Date.now().toString().slice(-6),
        },
        card: {
          amount: invPaymentMode === 'CARD' ? invLineTotal : 0,
          receivingBank: 'POS Terminal',
          authId: 'CARD-AUTH-' + Date.now().toString().slice(-6),
        },
        chequeOrNeft: { amount: 0, chequeOrSlipOrUtr: '', bank: '' },
        cash: {
          amount: invPaymentMode === 'CASH' ? invLineTotal : 0,
          drawerRegister: 'Main Store Register',
        },
      };

      const newId = await addInvoice({
        customerId: invCustomerId || 'WALK-IN',
        customerExternalName: invCustomerName.trim(),
        customerPhone: invCustomerPhone.trim() || '+91 99980 21446',
        billingAddress: invBillingAddress.trim() || 'Vadodara, Gujarat',
        installationAddress: invBillingAddress.trim() || 'Vadodara, Gujarat',
        items: [lineItem],
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        discountAmount: 0,
        roundOffAmount: 0,
        totalAmount: Number(invLineTotal.toFixed(2)),
        prepaidSplits: splits,
        totalPrepaid: Number(prepaidAmount.toFixed(2)),
        amountDue: Number((invLineTotal - prepaidAmount).toFixed(2)),
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paymentTransId: invPaymentUtr.trim() || undefined,
        notes: `Quick Invoice • ${invPaymentMode} Payment`,
        gstNumber: gstNumber || '',
      });

      const createdInv: Invoice = {
        id: newId,
        customerId: invCustomerId || 'WALK-IN',
        customerExternalName: invCustomerName.trim(),
        customerPhone: invCustomerPhone.trim() || '+91 99980 21446',
        billingAddress: invBillingAddress.trim() || 'Vadodara, Gujarat',
        installationAddress: invBillingAddress.trim() || 'Vadodara, Gujarat',
        items: [lineItem],
        subtotal: Number(subtotal.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        discountAmount: 0,
        roundOffAmount: 0,
        totalAmount: Number(invLineTotal.toFixed(2)),
        prepaidSplits: splits,
        totalPrepaid: Number(prepaidAmount.toFixed(2)),
        amountDue: Number((invLineTotal - prepaidAmount).toFixed(2)),
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paymentTransId: invPaymentUtr.trim() || undefined,
        notes: `Quick Invoice • ${invPaymentMode} Payment`,
        gstNumber: gstNumber || '',
        createdAt: new Date().toISOString(),
      };

      setCreatedInvoiceResult(createdInv);
    } catch (err: any) {
      console.error(err);
      setInvError(err?.message || 'Failed to create invoice.');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  /* =========================================================================
     3. QUICK DELIVERY STATUS UPDATE LOGIC
     ========================================================================= */
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [quickMilestoneNote, setQuickMilestoneNote] = useState('');
  const [quickMilestoneLocation, setQuickMilestoneLocation] = useState('Vadodara Hub');
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
  const [deliveryFeedback, setDeliveryFeedback] = useState('');

  const handleQuickStatusUpdate = async (status: ShipmentStatus) => {
    if (!selectedShipmentId) return;
    setIsUpdatingDelivery(true);
    setDeliveryFeedback('');
    try {
      await updateShipmentStatus(
        selectedShipmentId,
        status,
        status === 'OUT_FOR_DELIVERY',
        undefined,
        undefined,
        undefined,
        quickMilestoneNote || undefined,
        quickMilestoneLocation || undefined
      );
      setDeliveryFeedback(`Status updated to ${status.replace(/_/g, ' ')}!`);
      setTimeout(() => setDeliveryFeedback(''), 3000);
      setQuickMilestoneNote('');
    } finally {
      setIsUpdatingDelivery(false);
    }
  };

  /* =========================================================================
     4. QUICK CUSTOMER PIN MANAGEMENT STATE & LOGIC
     ========================================================================= */
  const [pinCustId, setPinCustId] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);

  const handleQuickChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCustId) {
      setPinChangeMsg({ type: 'error', text: 'Select a customer first.' });
      return;
    }
    if (!/^\d{4}$/.test(newPinValue.trim())) {
      setPinChangeMsg({ type: 'error', text: 'PIN must be 4 digits.' });
      return;
    }
    setIsChangingPin(true);
    try {
      const res = await changeCustomerPin(pinCustId, newPinValue.trim());
      if (res.success) {
        setPinChangeMsg({ type: 'success', text: `PIN updated to ${newPinValue.trim()} for ${pinCustId}!` });
        setNewPinValue('');
      } else {
        setPinChangeMsg({ type: 'error', text: res.message });
      }
    } finally {
      setIsChangingPin(false);
    }
  };

  /* =========================================================================
     5. UNIVERSAL SEARCH STATE & LOGIC
     ========================================================================= */
  const [universalQuery, setUniversalQuery] = useState('');

  const filteredQuotes = quotations.filter(
    (q) =>
      q.id.toLowerCase().includes(universalQuery.toLowerCase()) ||
      q.customerExternalName.toLowerCase().includes(universalQuery.toLowerCase()) ||
      q.customerPhone.includes(universalQuery)
  );

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.id.toLowerCase().includes(universalQuery.toLowerCase()) ||
      inv.customerExternalName.toLowerCase().includes(universalQuery.toLowerCase()) ||
      inv.customerPhone.includes(universalQuery) ||
      inv.items.some((it) => it.serialNo?.toLowerCase().includes(universalQuery.toLowerCase()))
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.id.toLowerCase().includes(universalQuery.toLowerCase()) ||
      c.externalName.toLowerCase().includes(universalQuery.toLowerCase()) ||
      c.phone.includes(universalQuery)
  );

  const filteredShipments = shipments.filter(
    (s) =>
      s.id.toLowerCase().includes(universalQuery.toLowerCase()) ||
      s.customerExternalName.toLowerCase().includes(universalQuery.toLowerCase()) ||
      s.customerPhone.includes(universalQuery)
  );

  return (
    <div className="space-y-6">
      {/* Quick Mode Top Banner & Tool Tabs */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-red-600/15 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>STORE DESK EXPRESS MODE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              ⚡ Quick Operations Mode
            </h2>
            <p className="text-xs sm:text-sm text-red-100 max-w-xl mt-1">
              Complete high-frequency tasks in seconds: Make quick estimates, issue fast invoices, track deliveries, register customers, and manage access PINs.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-center min-w-[75px]">
              <div className="text-base sm:text-lg font-black">{quotations.length}</div>
              <div className="text-[10px] text-red-100 uppercase font-semibold">Quotes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-center min-w-[75px]">
              <div className="text-base sm:text-lg font-black">{invoices.length}</div>
              <div className="text-[10px] text-red-100 uppercase font-semibold">Invoices</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-center min-w-[75px]">
              <div className="text-base sm:text-lg font-black">{customers.length}</div>
              <div className="text-[10px] text-red-100 uppercase font-semibold">Customers</div>
            </div>
          </div>
        </div>

        {/* Entry Type Selection Drop Box */}
        <div className="mt-6 pt-4 border-t border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
            <label htmlFor="quick-entry-type-select" className="text-xs sm:text-sm font-black text-white flex items-center gap-2 whitespace-nowrap uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
              <span>Select Entry Type:</span>
            </label>
            <div className="relative w-full sm:w-80">
              <select
                id="quick-entry-type-select"
                value={activeTool}
                onChange={(e) => setActiveTool(e.target.value as any)}
                className="w-full text-xs sm:text-sm font-bold bg-white text-slate-900 dark:bg-slate-900 dark:text-white px-4 py-2.5 rounded-2xl shadow-xl border-2 border-white/40 focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer appearance-none pr-10 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <option value="QUOTE">⚡ Quick Quote (Estimate Entry)</option>
                <option value="INVOICE">⚡ Quick Bill / Tax Invoice Entry</option>
                <option value="DELIVERY">⚡ Quick Delivery / Tracking Entry</option>
                <option value="CUSTOMER">⚡ Quick Customer & PIN Entry</option>
                <option value="SEARCH">⚡ Universal Lookup / Search Entry</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-600 dark:text-slate-300">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Quick Clickable Shortcuts */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            <span className="text-[11px] font-semibold text-white/70 mr-1 hidden lg:inline">Quick Jump:</span>
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                className="px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap bg-amber-300 hover:bg-amber-200 text-slate-950 shadow-md flex items-center gap-1.5 transition-all hover:scale-102"
                title="Open Lakhi AI Voice & Database Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-red-600 fill-current animate-pulse" />
                <span>🎙️ Lakhi AI Assistant</span>
              </button>
            )}
            {onOpenBarcodeScanner && (
              <button
                type="button"
                onClick={onOpenBarcodeScanner}
                className="px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap bg-white/20 hover:bg-white/30 text-white shadow-md flex items-center gap-1.5 transition-all hover:scale-102"
                title="Open Device Camera QR / Barcode Scanner"
              >
                <Camera className="w-3.5 h-3.5 text-amber-300" />
                <span>📸 Scan Barcode</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTool('QUOTE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTool === 'QUOTE'
                  ? 'bg-white text-red-700 shadow-md'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              Quote
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('INVOICE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTool === 'INVOICE'
                  ? 'bg-white text-red-700 shadow-md'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              Invoice
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('DELIVERY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTool === 'DELIVERY'
                  ? 'bg-white text-red-700 shadow-md'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              Delivery
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('CUSTOMER')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTool === 'CUSTOMER'
                  ? 'bg-white text-red-700 shadow-md'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              Customer & PIN
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('SEARCH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTool === 'SEARCH'
                  ? 'bg-white text-red-700 shadow-md'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              Lookup
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TOOL 1: QUICK ENTRY QUOTE (WITH SERIAL NUMBERS & PRE-CONFIRMATION)
          ===================================================================== */}
      {activeTool === 'QUOTE' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-red-600" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Fast Quotation Desk (with Serials & Review)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  Quick Menu
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Add products, serial numbers & terms. System validates, asks for your confirmation, and adds to Quick Menu.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAiFastPromptOpen(!isAiFastPromptOpen)}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900/60 flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Quick Lakhi AI Voice or Text Parser"
              >
                <Sparkles className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                <span>Lakhi AI Fast Fill</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAiWizardModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Open Complete Lakhi AI Quote Generator Modal"
              >
                <Bot className="w-3.5 h-3.5 text-blue-500" />
                <span>Lakhi AI Wizard</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('quotations')}
                className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 ml-1"
              >
                <span>Full Quotes</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* AI Fast Fill Prompt Drawer */}
          {isAiFastPromptOpen && (
            <div className="bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Type or Paste Quotation Notes / Voice Transcription:
                </span>
                <button
                  type="button"
                  onClick={() => setIsAiFastPromptOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <textarea
                rows={2}
                value={fastPromptText}
                onChange={(e) => setFastPromptText(e.target.value)}
                placeholder="e.g. Quotation for Gautam Sharma, phone 9876543210: 2 units Daikin 1.5T 5-star AC with serials DKN-881 and DKN-882 at 46,500 each and 1 Voltas 1T at 32,000..."
                className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-red-500 outline-none"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold">Quick Sample:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFastPromptText(
                        'Quote for Mr. Rahul Verma 9811223344 Sector 15 Noida: 2x Daikin 1.5 Ton Inverter AC with serials DKN-9901 and DKN-9902 at 45500 each, and 1x Voltas 1 Ton Split AC at 32500.'
                      )
                    }
                    className="underline text-red-600 font-medium"
                  >
                    Daikin Dual + Serials
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!fastPromptText.trim() || isParsingAiPrompt}
                  onClick={handleRunAiFastFill}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  {isParsingAiPrompt ? 'Analyzing with AI...' : '⚡ Auto-populate & Review'}
                </button>
              </div>
            </div>
          )}

          {/* Success Banner if quote just created */}
          {createdQuoteResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 text-emerald-950 dark:text-emerald-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    Quotation Confirmed & Added to Quick Menu! ID:{' '}
                    <span className="font-mono text-base font-black">{createdQuoteResult.id}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedQuoteResult(null)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
                >
                  ✕ Dismiss
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/60">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {createdQuoteResult.customerExternalName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount</span>
                  <span className="font-black text-red-600 dark:text-red-400 text-sm">
                    ₹{createdQuoteResult.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Products Count</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {createdQuoteResult.items.length} item(s) recorded
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const { url, filename } = generateQuotationPdf(createdQuoteResult, gstNumber);
                    setPreviewPdfUrl(url);
                    setPreviewFilename(filename);
                    setPreviewTitle(`Quotation: ${createdQuoteResult.id}`);
                    setIsPreviewOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(`${window.location.origin}?quote=${createdQuoteResult.id}`)}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedText ? 'Link Copied!' : 'Copy Share Link'}</span>
                </button>

                {onConvertToInvoice && (
                  <button
                    type="button"
                    onClick={() => onConvertToInvoice(createdQuoteResult)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto shadow-xs"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Convert to Invoice →</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PRE-CONFIRMATION PREVIEW CARD (WHEN USER CLICKS REVIEW OR AFTER AI PARSE) */}
          {isReviewConfirmingQuote ? (
            <div className="bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-700 rounded-3xl p-5 sm:p-6 space-y-4 shadow-md animate-in fade-in">
              <div className="flex items-start justify-between gap-3 border-b border-amber-200 dark:border-amber-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-amber-800 dark:text-amber-300">
                      Step 2: Pre-Confirmation Review
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      Please Confirm Quotation Before Saving to Database
                    </h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReviewConfirmingQuote(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                >
                  Edit Information
                </button>
              </div>

              {/* Customer Review Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Customer Name</span>
                  <strong className="text-slate-900 dark:text-white font-black">{qCustomerName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Contact Phone</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{qCustomerPhone || 'Not specified'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Delivery / Installation Address</span>
                  <strong className="text-slate-900 dark:text-white truncate block">
                    {qInstallationAddress || qBillingAddress || 'Vadodara, Gujarat'}
                  </strong>
                </div>
              </div>

              {/* Products Table with Serial Numbers */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider grid grid-cols-12 gap-2">
                  <span className="col-span-5 sm:col-span-4">Product Description & Brand</span>
                  <span className="col-span-3 sm:col-span-3">Model / Serial Number</span>
                  <span className="col-span-1 text-center">Qty</span>
                  <span className="col-span-2 text-right">Unit Rate</span>
                  <span className="col-span-1 sm:col-span-2 text-right">Line Total</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {qItemsWithTotals.map((it, idx) => (
                    <div key={it.id || idx} className="px-4 py-3 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 sm:col-span-4">
                        <strong className="text-slate-900 dark:text-white block font-bold">{it.name || 'Appliance'}</strong>
                        <span className="text-[10px] text-slate-400">{it.brand} • {it.type}</span>
                      </div>
                      <div className="col-span-3 sm:col-span-3">
                        <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300">
                          {it.modelNo || 'Standard Model'}
                        </div>
                        {it.serialNo && (
                          <div className="font-mono text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1 mt-0.5">
                            <Barcode className="w-3 h-3" />
                            SN: {it.serialNo}
                          </div>
                        )}
                      </div>
                      <div className="col-span-1 text-center font-bold text-slate-900 dark:text-white">
                        {it.quantity}
                      </div>
                      <div className="col-span-2 text-right font-medium text-slate-600 dark:text-slate-300">
                        ₹{Number(it.rate).toLocaleString('en-IN')}
                      </div>
                      <div className="col-span-1 sm:col-span-2 text-right font-black text-slate-900 dark:text-white">
                        ₹{it.lineTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500 text-[11px]">
                    <span>Subtotal: ₹{qSubtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    <span className="mx-2">•</span>
                    <span>GST (18%): ₹{qTaxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Grand Total Amount:</span>
                    <span className="text-lg font-black text-red-600 dark:text-red-400">
                      ₹{qGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirmation Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Click <strong>Confirm & Save</strong> to officially record this quotation and generate sharable PDF.
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsReviewConfirmingQuote(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors"
                  >
                    ✏️ Go Back & Edit
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingQuote}
                    onClick={handleFinalizeSaveQuote}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-102"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>{isSubmittingQuote ? 'Saving...' : '✅ Confirm & Save Quotation Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STANDARD QUOTATION ENTRY FORM WITH MULTIPLE PRODUCTS & SERIAL NUMBERS */
            <form onSubmit={handleInitiateReviewQuote} className="space-y-5 text-xs">
              {/* Customer Picker with + New Customer & Edit */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <CustomerSelectBox
                  value={qCustomerId}
                  onChange={(custId) => handleSelectCustomerForQuote(custId)}
                  label="Select Customer:"
                  allowWalkIn={true}
                  walkInLabel="-- Manual / Walk-in Customer --"
                  onOpenNewCustomer={(initialQuery) => {
                    setCustomerToEditModal(null);
                    setCustomerModalInitialQuery(initialQuery || '');
                    setIsCustomerModalOpen(true);
                  }}
                  onOpenEditCustomer={(cust) => {
                    setCustomerToEditModal(cust);
                    setCustomerModalInitialQuery('');
                    setIsCustomerModalOpen(true);
                  }}
                />

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Legal Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={qCustomerName}
                    onChange={(e) => setQCustomerName(e.target.value)}
                    placeholder="Legal Name for Quote"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Phone:
                  </label>
                  <input
                    type="tel"
                    value={qCustomerPhone}
                    onChange={(e) => setQCustomerPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Products & Serial Numbers Section Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-red-600" />
                    <span>Quotation Products & Serial Tracking ({qItems.length} item(s)):</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleAddQuoteItem}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors border border-red-200 dark:border-red-900/60"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Product</span>
                  </button>
                </div>

                {/* List of Product Rows */}
                <div className="space-y-3">
                  {qItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                          Item #{index + 1}
                        </span>

                        {qItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuoteItem(index)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove this product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Product Description:
                          </label>
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) => handleUpdateQuoteItem(index, 'name', e.target.value)}
                            placeholder="e.g. 1.5 Ton 5-Star Inverter Split AC"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Brand:
                          </label>
                          <select
                            value={item.brand}
                            onChange={(e) => handleUpdateQuoteItem(index, 'brand', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold"
                          >
                            <option value="Daikin">Daikin</option>
                            <option value="Voltas">Voltas</option>
                            <option value="Mitsubishi">Mitsubishi</option>
                            <option value="Panasonic">Panasonic</option>
                            <option value="Hitachi">Hitachi</option>
                            <option value="LG">LG</option>
                            <option value="Carrier">Carrier</option>
                            <option value="Samsung">Samsung</option>
                            <option value="O General">O General</option>
                            <option value="Other">Other Brand</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Model Number:
                          </label>
                          <input
                            type="text"
                            value={item.modelNo}
                            onChange={(e) => handleUpdateQuoteItem(index, 'modelNo', e.target.value)}
                            placeholder="e.g. FTKF50TV16U"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                          />
                        </div>

                        {/* Serial Number input with barcode icon */}
                        <div className="md:col-span-2">
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-red-600" />
                            <span>Serial Number(s):</span>
                            <span className="text-[10px] text-slate-400 font-normal">(Optional or comma-separated)</span>
                          </label>
                          <input
                            type="text"
                            value={item.serialNo}
                            onChange={(e) => handleUpdateQuoteItem(index, 'serialNo', e.target.value)}
                            placeholder="e.g. DKN-88219 (or SN-01, SN-02)"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Quantity:
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateQuoteItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-center font-bold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Rate (₹):
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            required
                            value={item.rate || ''}
                            onChange={(e) =>
                              handleUpdateQuoteItem(index, 'rate', parseFloat(e.target.value) || 0)
                            }
                            placeholder="Rate per unit"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            GST Rate:
                          </label>
                          <select
                            value={item.taxPercent}
                            onChange={(e) =>
                              handleUpdateQuoteItem(index, 'taxPercent', parseInt(e.target.value) || 18)
                            }
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                          >
                            <option value={18}>18% (Standard GST)</option>
                            <option value={28}>28% (Commercial GST)</option>
                            <option value={12}>12% (Equipment GST)</option>
                            <option value={0}>0% (Tax Exempt)</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-3 md:col-span-2 pt-2">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
                            <input
                              type="checkbox"
                              checked={item.isAmountWithTax}
                              onChange={(e) =>
                                handleUpdateQuoteItem(index, 'isAmountWithTax', e.target.checked)
                              }
                              className="w-4 h-4 text-red-600 rounded"
                            />
                            <span>Rate includes GST</span>
                          </label>

                          <div className="ml-auto text-right text-xs">
                            <span className="text-slate-400 font-medium">Row Total: </span>
                            <span className="font-black text-slate-900 dark:text-white">
                              ₹
                              {(item.isAmountWithTax
                                ? (item.quantity || 1) * (item.rate || 0)
                                : (item.quantity || 1) *
                                  (item.rate || 0) *
                                  (1 + (item.taxPercent || 18) / 100)
                              ).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warranty & Terms Notes */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Warranty & Terms Notes:
                </label>
                <input
                  type="text"
                  value={qNotes}
                  onChange={(e) => setQNotes(e.target.value)}
                  placeholder="e.g. Standard 1-Year Machine Warranty • 5-Year Compressor Warranty • Installation included"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              {/* Total Summary & Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Estimated Quote Total:</span>
                  <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">
                    ₹{qGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({qItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0)} unit(s))
                  </span>
                </div>

                {quoteError && (
                  <div className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{quoteError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all hover:scale-102"
                >
                  <FileCheck2 className="w-4 h-4 text-white" />
                  <span>📋 Review Quotation & Ask Confirmation</span>
                </button>
              </div>
            </form>
          )}

          {/* AI Quotation Builder Modal */}
          <AiQuotationBuilderModal
            isOpen={isAiWizardModalOpen}
            onClose={() => setIsAiWizardModalOpen(false)}
            onQuotationCreated={(newQuote) => {
              setCreatedQuoteResult(newQuote);
              setIsAiWizardModalOpen(false);
            }}
          />
        </div>
      )}

      {/* =====================================================================
          TOOL 2: QUICK ENTRY INVOICE / BILLING
          ===================================================================== */}
      {activeTool === 'INVOICE' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-600" />
                <span>Fast Billing & Tax Invoice</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate a tax invoice in seconds with payment mode and unit serial tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('invoices')}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <span>Full Invoices Tab</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {createdInvoiceResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 text-emerald-950 dark:text-emerald-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Tax Invoice Issued! ID: <span className="font-mono text-base">{createdInvoiceResult.id}</span></span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedInvoiceResult(null)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
                >
                  ✕ Dismiss
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const { url, filename } = generateInvoicePdf(createdInvoiceResult, gstNumber);
                    setPreviewPdfUrl(url);
                    setPreviewFilename(filename);
                    setPreviewTitle(`Tax Invoice: ${createdInvoiceResult.id}`);
                    setIsPreviewOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(`${window.location.origin}?invoice=${createdInvoiceResult.id}`)}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedText ? 'Link Copied!' : 'Copy Share Link'}</span>
                </button>

                {onShipInvoice && (
                  <button
                    type="button"
                    onClick={() => onShipInvoice(createdInvoiceResult)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto shadow-sm"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Dispatch / Track Delivery →</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleCreateQuickInvoice} className="space-y-4 text-xs">
            {/* Customer Picker with + New Customer & Edit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CustomerSelectBox
                value={invCustomerId}
                onChange={(custId) => handleSelectCustomerForInvoice(custId)}
                label="Select Customer:"
                allowWalkIn={true}
                walkInLabel="-- Manual / Walk-in Customer --"
                onOpenNewCustomer={(initialQuery) => {
                  setCustomerToEditModal(null);
                  setCustomerModalInitialQuery(initialQuery || '');
                  setIsCustomerModalOpen(true);
                }}
                onOpenEditCustomer={(cust) => {
                  setCustomerToEditModal(cust);
                  setCustomerModalInitialQuery('');
                  setIsCustomerModalOpen(true);
                }}
              />

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Legal Name:
                </label>
                <input
                  type="text"
                  required
                  value={invCustomerName}
                  onChange={(e) => setInvCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Phone:
                </label>
                <input
                  type="tel"
                  value={invCustomerPhone}
                  onChange={(e) => setInvCustomerPhone(e.target.value)}
                  placeholder="+91..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* Item & Serial Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Product / Appliance Name:
                </label>
                <input
                  type="text"
                  required
                  value={invItemName}
                  onChange={(e) => setInvItemName(e.target.value)}
                  placeholder="e.g. 2.0T Cassette Inverter AC"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Appliance Type:
                </label>
                <select
                  value={invItemType}
                  onChange={(e) => setInvItemType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                >
                  <option value="AC">Air Conditioner (AC)</option>
                  <option value="TV">Television (TV)</option>
                  <option value="Refrigerator">Refrigerator</option>
                  <option value="Washing Machine">Washing Machine</option>
                  <option value="Microwave">Microwave</option>
                  <option value="Other">Other Equipment</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Model No:
                </label>
                <input
                  type="text"
                  value={invItemModel}
                  onChange={(e) => setInvItemModel(e.target.value)}
                  placeholder="Model / SKU"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Serial Number:
                </label>
                <input
                  type="text"
                  value={invSerialNo}
                  onChange={(e) => setInvSerialNo(e.target.value)}
                  placeholder="Appliance / Compressor SN"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Selling Price (₹ Incl. Tax):
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={invRate || ''}
                  onChange={(e) => setInvRate(parseFloat(e.target.value) || 0)}
                  placeholder="Final Amount"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode:
                </label>
                <select
                  value={invPaymentMode}
                  onChange={(e) => setInvPaymentMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-emerald-600 dark:text-emerald-400"
                >
                  <option value="UPI">UPI / QR Payment</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="UNPAID">Khata / Pay Later (Credit)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Reference / UTR / Note:
                </label>
                <input
                  type="text"
                  value={invPaymentUtr}
                  onChange={(e) => setInvPaymentUtr(e.target.value)}
                  placeholder="UTR No / Auth ID / Cheque No"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* Total and Submit */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Total Invoice Amount:</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  ₹{invLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  invPaymentMode === 'UNPAID' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {invPaymentMode === 'UNPAID' ? 'UNPAID (KHATA)' : `PAID (${invPaymentMode})`}
                </span>
              </div>

              {invError && (
                <div className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{invError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingInvoice}
                className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all hover:scale-102"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{isSubmittingInvoice ? 'Generating Bill...' : '⚡ Issue Invoice Now'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          TOOL 3: QUICK DELIVERY UPDATE
          ===================================================================== */}
      {activeTool === 'DELIVERY' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-red-600" />
                <span>Fast Delivery & Tracking Updates</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1-click milestone updates for dispatches, store arrivals, and customer installations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('shipments')}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <span>Full Deliveries Tab</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {deliveryFeedback && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deliveryFeedback}</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Active Shipment / Delivery:
              </label>
              <select
                value={selectedShipmentId}
                onChange={(e) => setSelectedShipmentId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-xs"
              >
                <option value="">-- Choose Shipment to Update --</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} • {s.customerExternalName} • {s.itemsSummary} [{s.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Hub / Location:
                </label>
                <input
                  type="text"
                  value={quickMilestoneLocation}
                  onChange={(e) => setQuickMilestoneLocation(e.target.value)}
                  placeholder="Location or Hub"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Status Message / Note:
                </label>
                <input
                  type="text"
                  value={quickMilestoneNote}
                  onChange={(e) => setQuickMilestoneNote(e.target.value)}
                  placeholder="e.g. Dispatched with Technician Ramesh"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>

            {/* 1-Click Milestone Action Buttons */}
            <div className="pt-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
                1-Click Status Milestone:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <button
                  type="button"
                  disabled={!selectedShipmentId || isUpdatingDelivery}
                  onClick={() => handleQuickStatusUpdate('ORDER_CONFIRMED')}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold text-center disabled:opacity-40 transition-all"
                >
                  Confirmed
                </button>

                <button
                  type="button"
                  disabled={!selectedShipmentId || isUpdatingDelivery}
                  onClick={() => handleQuickStatusUpdate('IN_TRANSIT')}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl font-bold text-center disabled:opacity-40 transition-all"
                >
                  In Transit
                </button>

                <button
                  type="button"
                  disabled={!selectedShipmentId || isUpdatingDelivery}
                  onClick={() => handleQuickStatusUpdate('ARRIVED_AT_STORE')}
                  className="px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl font-bold text-center disabled:opacity-40 transition-all"
                >
                  At Store
                </button>

                <button
                  type="button"
                  disabled={!selectedShipmentId || isUpdatingDelivery}
                  onClick={() => handleQuickStatusUpdate('OUT_FOR_DELIVERY')}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl font-bold text-center disabled:opacity-40 transition-all"
                >
                  Out For Delivery
                </button>

                <button
                  type="button"
                  disabled={!selectedShipmentId || isUpdatingDelivery}
                  onClick={() => handleQuickStatusUpdate('DELIVERED_INSTALLED')}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-center disabled:opacity-40 transition-all"
                >
                  Delivered & Installed
                </button>

                <button
                  type="button"
                  disabled={!selectedShipmentId || isUpdatingDelivery || !quickMilestoneNote.trim()}
                  onClick={async () => {
                    if (!selectedShipmentId) return;
                    setIsUpdatingDelivery(true);
                    try {
                      await addShipmentTrackingUpdate(
                        selectedShipmentId,
                        quickMilestoneNote.trim(),
                        quickMilestoneLocation.trim() || undefined
                      );
                      setDeliveryFeedback('Milestone note posted!');
                      setQuickMilestoneNote('');
                      setTimeout(() => setDeliveryFeedback(''), 3000);
                    } finally {
                      setIsUpdatingDelivery(false);
                    }
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-center disabled:opacity-40 transition-all"
                >
                  + Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 4: CUSTOMER REGISTER & PIN MANAGEMENT
          ===================================================================== */}
      {activeTool === 'CUSTOMER' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Register / Open Customer Modal */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-600" />
                <span>Register New Customer</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create a verified customer profile with telephone lookup, installation address, and 4-digit portal access PIN.
            </p>
            <button
              type="button"
              onClick={() => {
                setCustomerToEditModal(null);
                setIsCustomerModalOpen(true);
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-md shadow-red-600/30 flex items-center justify-center gap-2 text-xs transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Register New Customer Profile</span>
            </button>
          </div>

          {/* Quick Change PIN & Staff Warning Notice */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <span>Quick Customer PIN Change</span>
              </h3>
            </div>

            {/* Administrative Warning Banner */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs">
              <strong className="block text-[11px] uppercase font-bold text-amber-800 dark:text-amber-300">
                Staff & Admin Note:
              </strong>
              <span>
                Customer access PINs can be viewed and updated by authorized store admins to assist customers with portal sign-in and telephone queries.
              </span>
            </div>

            <form onSubmit={handleQuickChangePin} className="space-y-3 text-xs">
              <CustomerSelectBox
                value={pinCustId}
                onChange={(custId) => setPinCustId(custId)}
                label="Select Customer:"
                allowWalkIn={false}
                placeholder="Search customer to change PIN (e.g. name, phone, or 'g')..."
                onOpenNewCustomer={(initialQuery) => {
                  setCustomerToEditModal(null);
                  setCustomerModalInitialQuery(initialQuery || '');
                  setIsCustomerModalOpen(true);
                }}
                onOpenEditCustomer={(cust) => {
                  setCustomerToEditModal(cust);
                  setCustomerModalInitialQuery('');
                  setIsCustomerModalOpen(true);
                }}
              />

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New 4-Digit PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center font-mono font-bold tracking-widest text-base"
                />
              </div>

              {pinChangeMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    pinChangeMsg.type === 'error'
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}
                >
                  {pinChangeMsg.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{pinChangeMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isChangingPin || !pinCustId || newPinValue.length !== 4}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm transition-all"
              >
                {isChangingPin ? 'Updating PIN...' : 'Save New Customer PIN'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 5: UNIVERSAL LOOKUP
          ===================================================================== */}
      {activeTool === 'SEARCH' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-red-600" />
                <span>Instant Universal Lookup</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search any customer name, phone number, invoice ID, quotation ID, or serial number.
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              autoFocus
              value={universalQuery}
              onChange={(e) => setUniversalQuery(e.target.value)}
              placeholder="Search by customer name, phone, serial number, Q... or I... ID..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl focus:ring-2 focus:ring-red-500 outline-none text-xs"
            />
          </div>

          {universalQuery.trim() ? (
            <div className="space-y-4 text-xs">
              {/* Customers found */}
              {filteredCustomers.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider text-[10px]">
                    Customers ({filteredCustomers.length}):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{c.externalName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {c.phone} • ID: {c.id} • PIN: <span className="font-bold text-red-600 dark:text-red-400">{c.accessPin}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerToEditModal(c);
                            setIsCustomerModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-100"
                        >
                          Edit Profile
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices found */}
              {filteredInvoices.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider text-[10px]">
                    Invoices ({filteredInvoices.length}):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="font-mono text-red-600 dark:text-red-400">{inv.id}</span>
                            <span>• ₹{inv.totalAmount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {inv.customerExternalName} • {inv.paymentStatus}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const { url, filename } = generateInvoicePdf(inv, gstNumber);
                            setPreviewPdfUrl(url);
                            setPreviewFilename(filename);
                            setPreviewTitle(`Tax Invoice: ${inv.id}`);
                            setIsPreviewOpen(true);
                          }}
                          className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100"
                        >
                          PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quotations found */}
              {filteredQuotes.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider text-[10px]">
                    Quotations ({filteredQuotes.length}):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredQuotes.map((q) => (
                      <div
                        key={q.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="font-mono text-blue-600 dark:text-blue-400">{q.id}</span>
                            <span>• ₹{q.totalAmount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {q.customerExternalName} • {q.status}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const { url, filename } = generateQuotationPdf(q, gstNumber);
                            setPreviewPdfUrl(url);
                            setPreviewFilename(filename);
                            setPreviewTitle(`Quotation: ${q.id}`);
                            setIsPreviewOpen(true);
                          }}
                          className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100"
                        >
                          PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredCustomers.length === 0 && filteredInvoices.length === 0 && filteredQuotes.length === 0 && (
                <div className="text-center py-6 text-slate-400">
                  No records match "{universalQuery}".
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs">
              Type in the box above to look up customers, phones, serial numbers, invoices, or quotes instantly.
            </div>
          )}
        </div>
      )}

      {/* PDF Modal */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewPdfUrl}
        filename={previewFilename}
        title={previewTitle}
      />

      {/* Customer Modal for Add/Edit Customer */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customerToEdit={customerToEditModal}
        initialQuery={customerModalInitialQuery}
        onSaved={(c) => {
          if (activeTool === 'QUOTE') {
            handleSelectCustomerForQuote(c.id);
          } else if (activeTool === 'INVOICE') {
            handleSelectCustomerForInvoice(c.id);
          } else if (activeTool === 'CUSTOMER') {
            setPinCustId(c.id);
          }
          setCustomerModalInitialQuery('');
        }}
      />
    </div>
  );
};
