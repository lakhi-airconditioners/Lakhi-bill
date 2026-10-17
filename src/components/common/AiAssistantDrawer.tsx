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
  Lock,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, Quotation, Invoice, InventoryItem, Shipment } from '../../types';
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
    type:
      | 'CREATE_CUSTOMER'
      | 'EDIT_CUSTOMER'
      | 'DELETE_CUSTOMER'
      | 'CREATE_QUOTATION'
      | 'EDIT_QUOTATION'
      | 'DELETE_QUOTATION'
      | 'CREATE_INVOICE'
      | 'EDIT_INVOICE'
      | 'DELETE_INVOICE'
      | 'ADD_STOCK'
      | 'EDIT_STOCK'
      | 'DELETE_STOCK'
      | 'CREATE_SHIPMENT'
      | 'EDIT_SHIPMENT'
      | 'DELETE_SHIPMENT'
      | 'MARK_DELIVERY_ARRIVED'
      | 'RECORD_PAYMENT'
      | 'DELETE_TRANSACTION'
      | 'UNIVERSAL_FIRESTORE_MUTATION'
      | 'LOGIN_CUSTOMER'
      | 'NAVIGATE_TAB'
      | 'NONE';
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
    setViewMode,
    customers,
    inventory,
    quotations,
    invoices,
    shipments,
    transactions,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addShipment,
    updateShipment,
    deleteShipment,
    deleteTransaction,
    recordPaymentForInvoice,
    updateAnyDocument,
    deleteAnyDocument,
    createAnyDocument,
    loginCustomerByCodeOrPhone,
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
      label: '👤 Make Customer',
      prompt: 'Create a new customer named Rajesh Patel with phone number +91 98250 12345, address "12 Sunrise Park, Drive-in Road, Ahmedabad", and PIN 2026.',
    },
    {
      label: '✏️ Change Customer Details',
      prompt: 'Update customer details: change phone number to +91 99980 21446 and address to "Shop 4, Ground Floor, Central Mall".',
    },
    {
      label: '💰 Change Invoice Discount',
      prompt: 'Change discount on invoice to ₹1,000 and update payment status to PAID.',
    },
    {
      label: '⚡ Make Quotation (with serials)',
      prompt:
        'Create quotation for Gautam Sharma (phone 9876543210): 2 units Daikin 1.5 Ton 5-Star Split AC with serial numbers DKN-101 and DKN-102 at rate 46500 each, and 1 Voltas 1 Ton AC at 32000. 18% GST included.',
    },
    {
      label: '📦 Inward 3 AC Units to Stock',
      prompt: 'Add 3 units of Daikin 1.5 Ton 5-Star Split AC model FTKF50TV to store stock at ₹46,500 each with serials DKN-FTKF-101, DKN-FTKF-102, DKN-FTKF-103.',
    },
    {
      label: '🚚 Mark Delivery in Store',
      prompt: 'Mark the customer delivery shipment as Arrived at Store.',
    },
    {
      label: '🧾 Check Customer Dues',
      prompt: 'Which customers currently have pending dues or unpaid invoices?',
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

        if (data.action && data.action.type === 'NAVIGATE_TAB' && data.action.payload?.tabId) {
          onNavigateTab(data.action.payload.tabId);
        }
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

    if (lower.includes('make customer') || lower.includes('create customer') || lower.includes('new customer') || lower.includes('add customer')) {
      const nameMatch = text.match(/(?:customer|client|named)[:\s]+([A-Za-z\s]+?)(?:,|\.|\n|phone|\d|$)/i);
      const phoneMatch = text.match(/(?:phone|mobile|call|number)[:\s]*([+0-9\s-]{10,14})/i);
      const name = nameMatch ? nameMatch[1].trim() : 'New Customer';
      const phone = phoneMatch ? phoneMatch[1].replace(/[^\d+]/g, '') : '9876543210';
      reply = `I have drafted a new customer profile for ${name}. Review the details below and confirm to register in Firebase:`;
      action = {
        type: 'CREATE_CUSTOMER',
        status: 'PENDING',
        payload: {
          externalName: name,
          phone,
          billingAddress: 'Main Store Delivery Area',
          installationAddress: 'Main Store Delivery Area',
          accessPin: Math.floor(1000 + Math.random() * 9000).toString(),
          accountBalance: 0,
        },
      };
    } else if (lower.includes('change customer') || lower.includes('edit customer') || lower.includes('update customer') || lower.includes('change phone')) {
      const phoneMatch = text.match(/(?:to|phone|mobile)[:\s]*([+0-9\s-]{10,14})/i);
      const phone = phoneMatch ? phoneMatch[1].replace(/[^\d+]/g, '') : '';
      const target = customers[0];
      reply = `I have prepared the customer update. Please confirm to apply these changes to Firebase:`;
      action = {
        type: 'EDIT_CUSTOMER',
        status: 'PENDING',
        payload: {
          customerId: target?.id || '',
          customerName: target?.externalName || 'Customer',
          ...(phone ? { phone } : {}),
          summary: phone ? `Update phone number to ${phone}` : 'Update customer information',
        },
      };
    } else if (lower.includes('delete customer') || lower.includes('remove customer')) {
      const target = customers[0];
      reply = `Are you sure you want to delete this customer record? This action is permanent:`;
      action = {
        type: 'DELETE_CUSTOMER',
        status: 'PENDING',
        payload: {
          customerId: target?.id || '',
          customerName: target?.externalName || 'Customer',
        },
      };
    } else if (lower.includes('discount') || (lower.includes('change') && lower.includes('invoice'))) {
      const discMatch = text.match(/(?:discount\s*(?:to|of|is)?\s*|₹\s*)([0-9,]+)/i);
      const newDiscount = discMatch ? Number(discMatch[1].replace(/,/g, '')) : 1000;
      const target = invoices[0];
      reply = `I have prepared the invoice modification to set discount to ₹${newDiscount.toLocaleString('en-IN')}:`;
      action = {
        type: 'EDIT_INVOICE',
        status: 'PENDING',
        payload: {
          invoiceId: target?.id || 'I-SAMPLE',
          discountAmount: newDiscount,
          notes: `Discount set to ₹${newDiscount} via Lakhi AI`,
        },
      };
    } else if (lower.includes('delete invoice') || lower.includes('remove invoice')) {
      const target = invoices[0];
      reply = `Please confirm permanent deletion of the tax invoice:`;
      action = {
        type: 'DELETE_INVOICE',
        status: 'PENDING',
        payload: {
          invoiceId: target?.id || '',
          customerName: target?.customerExternalName || 'Customer',
        },
      };
    } else if (lower.includes('quote') || lower.includes('quotation')) {
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
      reply = `I have received your request. I can register/update/delete customers, change invoice values and discounts, make quotations, manage stock, and execute any task in the store ERP.`;
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

  const handleConfirmEditInvoice = async (msgId: string, payload: any) => {
    try {
      const targetInv = invoices.find(
        (i) =>
          i.id.toUpperCase() === (payload.invoiceId || '').toUpperCase() ||
          i.customerExternalName.toLowerCase().includes((payload.customerName || '').toLowerCase())
      );
      if (!targetInv) {
        alert('Could not find the requested invoice in the database.');
        return;
      }

      const newDiscount =
        payload.discountAmount !== undefined ? Number(payload.discountAmount) : targetInv.discountAmount;

      const subtotal = payload.subtotal !== undefined ? Number(payload.subtotal) : targetInv.subtotal;
      const taxAmount = payload.taxAmount !== undefined ? Number(payload.taxAmount) : targetInv.taxAmount;
      const roundOff = payload.roundOffAmount !== undefined ? Number(payload.roundOffAmount) : (targetInv.roundOffAmount || 0);
      const totalAmount =
        payload.totalAmount !== undefined
          ? Number(payload.totalAmount)
          : Math.max(0, subtotal + taxAmount - newDiscount + roundOff);
      const amountDue =
        payload.amountDue !== undefined
          ? Number(payload.amountDue)
          : Math.max(0, totalAmount - targetInv.totalPrepaid);
      const paymentStatus =
        payload.paymentStatus || (amountDue === 0 ? 'PAID' : targetInv.totalPrepaid > 0 ? 'PARTIAL' : targetInv.paymentStatus || 'UNPAID');

      const updates: Partial<Invoice> = {
        discountAmount: newDiscount,
        roundOffAmount: roundOff,
        subtotal,
        taxAmount,
        totalAmount,
        amountDue,
        paymentStatus,
        ...(payload.customerExternalName ? { customerExternalName: payload.customerExternalName } : {}),
        ...(payload.customerName ? { customerExternalName: payload.customerName } : {}),
        ...(payload.customerPhone ? { customerPhone: payload.customerPhone } : {}),
        ...(payload.billingAddress ? { billingAddress: payload.billingAddress } : {}),
        ...(payload.installationAddress ? { installationAddress: payload.installationAddress } : {}),
        ...(payload.items ? { items: payload.items } : {}),
        ...(payload.gstNumber ? { gstNumber: payload.gstNumber } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.updates || {}),
      };

      await updateInvoice(targetInv.id, updates);

      const changeSummary = payload.summary || `Updated Invoice #${targetInv.id}`;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: changeSummary,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error modifying invoice:', err);
      alert('Failed to edit invoice: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmDeleteInvoice = async (msgId: string, payload: any) => {
    try {
      const targetInv = invoices.find(
        (i) =>
          i.id.toUpperCase() === (payload.invoiceId || '').toUpperCase() ||
          i.customerExternalName.toLowerCase().includes((payload.customerName || '').toLowerCase())
      );
      if (!targetInv) {
        alert('Invoice not found.');
        return;
      }

      await deleteInvoice(targetInv.id);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Deleted Invoice #${targetInv.id}`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      alert('Failed to delete invoice: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmDeleteQuotation = async (msgId: string, payload: any) => {
    try {
      const targetQuote = quotations.find(
        (q) =>
          q.id.toUpperCase() === (payload.quotationId || '').toUpperCase() ||
          q.customerExternalName.toLowerCase().includes((payload.customerName || '').toLowerCase())
      );
      if (!targetQuote) {
        alert('Quotation not found.');
        return;
      }

      await deleteQuotation(targetQuote.id);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Deleted Quotation #${targetQuote.id}`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error deleting quotation:', err);
      alert('Failed to delete quotation: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmDeleteStock = async (msgId: string, payload: any) => {
    try {
      const targetStock = inventory.find(
        (st) =>
          st.id === payload.inventoryId ||
          (payload.serialNo && st.serialNo.toLowerCase() === payload.serialNo.toLowerCase()) ||
          (payload.modelNo && st.modelNo.toLowerCase() === payload.modelNo.toLowerCase())
      );
      if (!targetStock) {
        alert('Stock item not found.');
        return;
      }

      await deleteInventoryItem(targetStock.id);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Deleted Item: ${targetStock.modelNo} (${targetStock.serialNo})`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error deleting stock item:', err);
      alert('Failed to delete stock item: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmRecordPayment = async (msgId: string, payload: any) => {
    try {
      const txId = await recordPaymentForInvoice(
        payload.invoiceId || '',
        Number(payload.amount),
        payload.mode || 'UPI',
        payload.referenceNo || '',
        payload.mode === 'CASH' ? 'Cash Drawer' : 'Store Bank Account',
        payload.treatment || 'LINKED_TO_INVOICE',
        payload.notes,
        payload.customerId
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Recorded Payment: #${txId} (₹${Number(payload.amount).toLocaleString('en-IN')})`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error recording payment:', err);
      alert('Failed to record payment: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmLoginCustomer = async (msgId: string, payload: any) => {
    try {
      const res = await loginCustomerByCodeOrPhone(
        payload.customerId || payload.phone || '',
        payload.pin || ''
      );

      if (res.success && res.customer) {
        setViewMode('CUSTOMER');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  action: {
                    ...m.action!,
                    status: 'DONE',
                    resultId: `Switched to Customer View: ${res.customer?.externalName} (${res.customer?.id})`,
                  },
                }
              : m
          )
        );
      } else {
        alert(res.message || 'Customer login failed');
      }
    } catch (err: any) {
      console.error('Error logging into customer account:', err);
      alert('Login failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmCreateCustomer = async (msgId: string, payload: any) => {
    try {
      const newCustId = await addCustomer({
        externalName: payload.externalName || payload.name || 'New Customer',
        internalName: payload.internalName || payload.externalName || 'Customer',
        phone: payload.phone || '',
        email: payload.email || '',
        billingAddress: payload.billingAddress || '',
        installationAddress: payload.installationAddress || payload.billingAddress || '',
        accessPin: payload.accessPin || Math.floor(1000 + Math.random() * 9000).toString(),
        accountBalance: Number(payload.accountBalance || 0),
        ...(payload.notes ? { notes: payload.notes } : {}),
        ...(payload.updates || {}),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Customer Created: ${payload.externalName || payload.name} (${newCustId})`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error creating customer:', err);
      alert('Failed to create customer: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmEditCustomer = async (msgId: string, payload: any) => {
    try {
      const target = customers.find(
        (c) =>
          c.id.toUpperCase() === (payload.customerId || '').toUpperCase() ||
          c.externalName.toLowerCase().includes((payload.customerName || payload.name || '').toLowerCase()) ||
          (payload.phone && c.phone.replace(/\D/g, '') === payload.phone.replace(/\D/g, ''))
      );
      if (!target) {
        alert('Could not find matching customer in database.');
        return;
      }

      const updates: Partial<Customer> = {
        ...(payload.externalName ? { externalName: payload.externalName } : {}),
        ...(payload.name ? { externalName: payload.name } : {}),
        ...(payload.internalName ? { internalName: payload.internalName } : {}),
        ...(payload.phone ? { phone: payload.phone } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.billingAddress ? { billingAddress: payload.billingAddress } : {}),
        ...(payload.installationAddress ? { installationAddress: payload.installationAddress } : {}),
        ...(payload.accessPin ? { accessPin: payload.accessPin } : {}),
        ...(payload.accountBalance !== undefined ? { accountBalance: Number(payload.accountBalance) } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.updates || {}),
      };

      await updateCustomer(target.id, updates);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Updated Customer: ${target.externalName} (${target.id})`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error editing customer:', err);
      alert('Failed to edit customer: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmDeleteCustomer = async (msgId: string, payload: any) => {
    try {
      const target = customers.find(
        (c) =>
          c.id.toUpperCase() === (payload.customerId || '').toUpperCase() ||
          c.externalName.toLowerCase().includes((payload.customerName || '').toLowerCase())
      );
      if (!target) {
        alert('Customer not found in database.');
        return;
      }

      await deleteCustomer(target.id);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Deleted Customer: ${target.externalName} (${target.id})`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      alert('Failed to delete customer: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmEditQuotation = async (msgId: string, payload: any) => {
    try {
      const target = quotations.find(
        (q) =>
          q.id.toUpperCase() === (payload.quotationId || '').toUpperCase() ||
          q.customerExternalName.toLowerCase().includes((payload.customerName || '').toLowerCase())
      );
      if (!target) {
        alert('Quotation not found in database.');
        return;
      }

      const updates: Partial<Quotation> = {
        ...(payload.customerExternalName ? { customerExternalName: payload.customerExternalName } : {}),
        ...(payload.customerPhone ? { customerPhone: payload.customerPhone } : {}),
        ...(payload.billingAddress ? { billingAddress: payload.billingAddress } : {}),
        ...(payload.installationAddress ? { installationAddress: payload.installationAddress } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.items ? { items: payload.items } : {}),
        ...(payload.totalAmount !== undefined ? { totalAmount: Number(payload.totalAmount) } : {}),
        ...(payload.taxAmount !== undefined ? { taxAmount: Number(payload.taxAmount) } : {}),
        ...(payload.subtotal !== undefined ? { subtotal: Number(payload.subtotal) } : {}),
        ...(payload.updates || {}),
      };

      await updateQuotation(target.id, updates);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Updated Quotation: #${target.id}`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error updating quotation:', err);
      alert('Failed to edit quotation: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmEditStock = async (msgId: string, payload: any) => {
    try {
      const target = inventory.find(
        (st) =>
          st.id === payload.inventoryId ||
          (payload.serialNo && st.serialNo.toLowerCase() === payload.serialNo.toLowerCase()) ||
          (payload.modelNo && st.modelNo.toLowerCase() === payload.modelNo.toLowerCase())
      );
      if (!target) {
        alert('Stock item not found in database.');
        return;
      }

      const updates: Partial<InventoryItem> = {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.brand ? { brand: payload.brand } : {}),
        ...(payload.modelNo ? { modelNo: payload.modelNo } : {}),
        ...(payload.type ? { type: payload.type } : {}),
        ...(payload.serialNo ? { serialNo: payload.serialNo } : {}),
        ...(payload.sellingPrice !== undefined ? { sellingPrice: Number(payload.sellingPrice) } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.updates || {}),
      };

      await updateInventoryItem(target.id, updates);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Updated Stock: ${target.name} (${target.serialNo || target.id})`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error editing stock item:', err);
      alert('Failed to edit stock item: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmCreateShipment = async (msgId: string, payload: any) => {
    try {
      const newShipmentId = await addShipment({
        customerId: payload.customerId || '',
        customerExternalName: payload.customerName || payload.customerExternalName || 'Customer',
        customerPhone: payload.customerPhone || '',
        deliveryAddress: payload.deliveryAddress || payload.installationAddress || 'Customer Address',
        installationAddress: payload.installationAddress || payload.deliveryAddress || 'Customer Address',
        itemsSummary: payload.itemsSummary || 'Air Conditioner Delivery',
        driverName: payload.driverName,
        driverPhone: payload.driverPhone,
        outForDeliveryEnabled: payload.outForDeliveryEnabled,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Shipment Created: #${newShipmentId}`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error creating shipment:', err);
      alert('Failed to create shipment: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmEditShipment = async (msgId: string, payload: any) => {
    try {
      const target = shipments.find(
        (s) =>
          s.id.toLowerCase() === (payload.shipmentId || '').toLowerCase() ||
          s.customerExternalName.toLowerCase().includes((payload.customerName || '').toLowerCase())
      );
      if (!target) {
        alert('Shipment not found in database.');
        return;
      }

      const updates: Partial<Shipment> = {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.driverName !== undefined ? { driverName: payload.driverName } : {}),
        ...(payload.driverPhone !== undefined ? { driverPhone: payload.driverPhone } : {}),
        ...(payload.deliveryAddress ? { deliveryAddress: payload.deliveryAddress } : {}),
        ...(payload.storeContactPhone ? { storeContactPhone: payload.storeContactPhone } : {}),
        ...(payload.itemsSummary ? { itemsSummary: payload.itemsSummary } : {}),
        ...(payload.updates || {}),
      };

      await updateShipment(target.id, updates);
      if (payload.customMessage) {
        await addShipmentTrackingUpdate(target.id, payload.customMessage);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Updated Shipment: #${target.id} (${payload.status || 'Updated'})`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error editing shipment:', err);
      alert('Failed to edit shipment: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmDeleteShipment = async (msgId: string, payload: any) => {
    try {
      const target = shipments.find(
        (s) =>
          s.id.toLowerCase() === (payload.shipmentId || '').toLowerCase() ||
          s.customerExternalName.toLowerCase().includes((payload.customerName || '').toLowerCase())
      );
      if (!target) {
        alert('Shipment not found in database.');
        return;
      }

      await deleteShipment(target.id);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Deleted Shipment #${target.id}`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error deleting shipment:', err);
      alert('Failed to delete shipment: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmDeleteTransaction = async (msgId: string, payload: any) => {
    try {
      const target = transactions.find(
        (t) =>
          t.id.toLowerCase() === (payload.transactionId || '').toLowerCase() ||
          (t.referenceNo && t.referenceNo.toLowerCase() === (payload.referenceNo || '').toLowerCase())
      );
      const txId = target?.id || payload.transactionId;
      if (!txId) {
        alert('Transaction record not found.');
        return;
      }

      await deleteTransaction(txId);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: `Deleted Payment Transaction #${txId}`,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      alert('Failed to delete transaction: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmUniversalMutation = async (msgId: string, payload: any) => {
    try {
      const { operation, collection: coll, docId, data } = payload;
      if (!coll) {
        alert('Collection name not specified.');
        return;
      }

      let resText = '';
      if (operation === 'DELETE') {
        await deleteAnyDocument(coll, docId);
        resText = `Deleted ${coll}/${docId} from Firebase`;
      } else if (operation === 'CREATE') {
        const id = await createAnyDocument(coll, data || {}, docId);
        resText = `Created ${coll}/${id} in Firebase`;
      } else {
        // UPDATE
        await updateAnyDocument(coll, docId, data || {});
        resText = `Updated ${coll}/${docId} in Firebase`;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action: {
                  ...m.action!,
                  status: 'DONE',
                  resultId: resText,
                },
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Universal Firestore mutation error:', err);
      alert('Failed to apply mutation: ' + (err.message || 'Unknown error'));
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
                            {msg.action.payload?.status && (
                              <div className="mt-1">
                                New Status: <span className="font-bold text-purple-600 dark:text-purple-400">{msg.action.payload.status}</span>
                              </div>
                            )}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeliveryArrived(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                              >
                                ✅ Confirm & Update Delivery Status
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ Delivery status updated!
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* EDIT INVOICE (e.g. Change discount, notes, or payment) */}
                      {msg.action.type === 'EDIT_INVOICE' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
                              <Receipt className="w-4 h-4" />
                              <span>CONFIRM INVOICE MODIFICATION</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {msg.action.status === 'DONE' ? 'Applied' : 'Requires Confirmation'}
                            </span>
                          </div>

                          <div className="mt-2.5 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white">
                              Invoice #{msg.action.payload?.invoiceId}
                            </div>
                            {(msg.action.payload?.customerExternalName || msg.action.payload?.customerName) && (
                              <div className="text-slate-700 dark:text-slate-300">
                                Customer: <strong>{msg.action.payload.customerExternalName || msg.action.payload.customerName}</strong>
                              </div>
                            )}
                            {msg.action.payload?.customerPhone && (
                              <div className="text-slate-700 dark:text-slate-300">
                                Phone: <strong>{msg.action.payload.customerPhone}</strong>
                              </div>
                            )}
                            {msg.action.payload?.discountAmount !== undefined && (
                              <div className="text-slate-700 dark:text-slate-300">
                                Set Discount: <strong className="text-emerald-600 font-mono">₹{Number(msg.action.payload.discountAmount).toLocaleString('en-IN')}</strong>
                              </div>
                            )}
                            {msg.action.payload?.totalAmount !== undefined && (
                              <div className="text-slate-700 dark:text-slate-300">
                                Total Amount: <strong className="font-mono">₹{Number(msg.action.payload.totalAmount).toLocaleString('en-IN')}</strong>
                              </div>
                            )}
                            {msg.action.payload?.paymentStatus && (
                              <div className="text-slate-700 dark:text-slate-300">
                                Set Payment Status: <strong>{msg.action.payload.paymentStatus}</strong>
                              </div>
                            )}
                            {msg.action.payload?.billingAddress && (
                              <div className="text-slate-700 dark:text-slate-300">
                                Billing Address: <span>{msg.action.payload.billingAddress}</span>
                              </div>
                            )}
                            {msg.action.payload?.installationAddress && (
                              <div className="text-slate-700 dark:text-slate-300">
                                Installation Address: <span>{msg.action.payload.installationAddress}</span>
                              </div>
                            )}
                            {msg.action.payload?.notes && (
                              <div className="text-slate-500 text-[11px]">
                                Notes: {msg.action.payload.notes}
                              </div>
                            )}
                            {msg.action.payload?.summary && (
                              <div className="text-slate-500 text-[11px] pt-0.5 italic">
                                {msg.action.payload.summary}
                              </div>
                            )}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmEditInvoice(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Update Invoice
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* DELETE INVOICE */}
                      {msg.action.type === 'DELETE_INVOICE' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-red-100 dark:border-red-900/60">
                            <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>CONFIRM INVOICE DELETION</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                              Destructive
                            </span>
                          </div>

                          <div className="mt-2.5 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50 text-xs space-y-1">
                            <p className="font-bold text-red-900 dark:text-red-200">
                              Permanently delete Invoice #{msg.action.payload?.invoiceId}?
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              This action is irreversible and will remove the tax invoice document from Firestore.
                            </p>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteInvoice(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Yes, Permanently Delete Invoice
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* DELETE QUOTATION */}
                      {msg.action.type === 'DELETE_QUOTATION' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-red-100 dark:border-red-900/60">
                            <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>CONFIRM QUOTATION DELETION</span>
                            </div>
                          </div>

                          <div className="mt-2 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-xs">
                            <p className="font-bold text-red-900 dark:text-red-200">
                              Delete Quotation #{msg.action.payload?.quotationId}?
                            </p>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteQuotation(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* DELETE STOCK ITEM */}
                      {msg.action.type === 'DELETE_STOCK' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-red-100 dark:border-red-900/60">
                            <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400">
                              <Boxes className="w-4 h-4" />
                              <span>CONFIRM STOCK REMOVAL</span>
                            </div>
                          </div>

                          <div className="mt-2 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-xs">
                            <p className="font-bold text-red-900 dark:text-red-200">
                              Remove stock item {msg.action.payload?.modelNo || msg.action.payload?.serialNo || msg.action.payload?.inventoryId}?
                            </p>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteStock(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs"
                              >
                                Confirm Delete from Stock
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* RECORD PAYMENT */}
                      {msg.action.type === 'RECORD_PAYMENT' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
                              <span>RECORD PAYMENT RECEIPT</span>
                            </div>
                          </div>

                          <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                            <div>Amount: <strong className="font-mono text-emerald-700 dark:text-emerald-300">₹{Number(msg.action.payload?.amount || 0).toLocaleString('en-IN')}</strong></div>
                            <div>Mode: <strong>{msg.action.payload?.mode || 'UPI'}</strong> {msg.action.payload?.referenceNo ? `(${msg.action.payload.referenceNo})` : ''}</div>
                            {msg.action.payload?.invoiceId && <div>Invoice: #{msg.action.payload.invoiceId}</div>}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmRecordPayment(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                              >
                                Confirm Payment
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* LOGIN CUSTOMER */}
                      {msg.action.type === 'LOGIN_CUSTOMER' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400">
                              <span>SWITCH TO CUSTOMER ACCOUNT</span>
                            </div>
                          </div>

                          <div className="mt-2 bg-blue-50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                            <div>Target: <strong>{msg.action.payload?.customerId || msg.action.payload?.phone}</strong></div>
                            <div>PIN: <strong>••••</strong></div>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmLoginCustomer(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                              >
                                Log into Customer Account Now
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* CREATE CUSTOMER */}
                      {msg.action.type === 'CREATE_CUSTOMER' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400">
                              <User className="w-4 h-4" />
                              <span>REGISTER NEW CUSTOMER</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {msg.action.status}
                            </span>
                          </div>

                          <div className="mt-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 text-xs space-y-1">
                            <div>Name: <strong className="text-slate-900 dark:text-white">{msg.action.payload?.externalName || msg.action.payload?.name}</strong></div>
                            <div>Phone: <strong>{msg.action.payload?.phone || 'Not specified'}</strong></div>
                            {msg.action.payload?.billingAddress && <div>Address: <span>{msg.action.payload.billingAddress}</span></div>}
                            {msg.action.payload?.accessPin && <div>Initial PIN: <span className="font-mono">{msg.action.payload.accessPin}</span></div>}
                            {msg.action.payload?.accountBalance !== undefined && (
                              <div>Opening Balance: <span className="font-mono font-bold">₹{Number(msg.action.payload.accountBalance).toLocaleString('en-IN')}</span></div>
                            )}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmCreateCustomer(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Register Customer
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between">
                              <span>✅ {msg.action.resultId}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateTab('customers');
                                  onClose();
                                }}
                                className="underline hover:text-emerald-600 text-[11px]"
                              >
                                View in Customers →
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* EDIT CUSTOMER */}
                      {msg.action.type === 'EDIT_CUSTOMER' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
                              <User className="w-4 h-4" />
                              <span>UPDATE CUSTOMER DETAILS</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {msg.action.status}
                            </span>
                          </div>

                          <div className="mt-2.5 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
                            <div>Target Customer: <strong>{msg.action.payload?.customerName || msg.action.payload?.externalName || msg.action.payload?.customerId}</strong></div>
                            {msg.action.payload?.phone && <div>New Phone: <strong className="text-emerald-600">{msg.action.payload.phone}</strong></div>}
                            {msg.action.payload?.externalName && <div>New Name: <strong className="text-emerald-600">{msg.action.payload.externalName}</strong></div>}
                            {msg.action.payload?.billingAddress && <div>New Address: <span>{msg.action.payload.billingAddress}</span></div>}
                            {msg.action.payload?.accessPin && <div>New PIN: <span className="font-mono font-bold">{msg.action.payload.accessPin}</span></div>}
                            {msg.action.payload?.accountBalance !== undefined && (
                              <div>New Ledger Balance: <strong className="font-mono">₹{Number(msg.action.payload.accountBalance).toLocaleString('en-IN')}</strong></div>
                            )}
                            {msg.action.payload?.summary && <div className="text-slate-500 text-[11px] pt-1">{msg.action.payload.summary}</div>}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmEditCustomer(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Update in Firebase
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* DELETE CUSTOMER */}
                      {msg.action.type === 'DELETE_CUSTOMER' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-red-100 dark:border-red-900/60">
                            <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>CONFIRM CUSTOMER DELETION</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                              Destructive
                            </span>
                          </div>

                          <div className="mt-2.5 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50 text-xs space-y-1">
                            <p className="font-bold text-red-900 dark:text-red-200">
                              Permanently delete customer {msg.action.payload?.customerName || msg.action.payload?.customerId}?
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              This will remove their profile and access credentials from Firestore.
                            </p>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteCustomer(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Yes, Permanently Delete Customer
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* EDIT QUOTATION */}
                      {msg.action.type === 'EDIT_QUOTATION' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
                              <FileCheck2 className="w-4 h-4" />
                              <span>UPDATE QUOTATION</span>
                            </div>
                          </div>

                          <div className="mt-2.5 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
                            <div>Target Quotation: <strong>#{msg.action.payload?.quotationId}</strong></div>
                            {msg.action.payload?.customerExternalName && <div>Customer: <strong>{msg.action.payload.customerExternalName}</strong></div>}
                            {msg.action.payload?.status && <div>New Status: <strong>{msg.action.payload.status}</strong></div>}
                            {msg.action.payload?.notes && <div>Notes: <span>{msg.action.payload.notes}</span></div>}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmEditQuotation(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Update Quotation
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* EDIT STOCK */}
                      {msg.action.type === 'EDIT_STOCK' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
                              <Boxes className="w-4 h-4" />
                              <span>UPDATE STOCK ITEM</span>
                            </div>
                          </div>

                          <div className="mt-2.5 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1">
                            <div>Target: <strong>{msg.action.payload?.modelNo || msg.action.payload?.serialNo || msg.action.payload?.inventoryId}</strong></div>
                            {msg.action.payload?.sellingPrice !== undefined && (
                              <div>New Price: <strong className="font-mono text-emerald-600">₹{Number(msg.action.payload.sellingPrice).toLocaleString('en-IN')}</strong></div>
                            )}
                            {msg.action.payload?.status && <div>New Status: <strong>{msg.action.payload.status}</strong></div>}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmEditStock(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Confirm Stock Update
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* CREATE SHIPMENT */}
                      {msg.action.type === 'CREATE_SHIPMENT' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-purple-600 dark:text-purple-400">
                              <Truck className="w-4 h-4" />
                              <span>CREATE DELIVERY SHIPMENT</span>
                            </div>
                          </div>

                          <div className="mt-2.5 bg-purple-50/50 dark:bg-purple-950/30 p-2.5 rounded-xl border border-purple-200/60 dark:border-purple-900/40 text-xs space-y-1">
                            <div>Customer: <strong>{msg.action.payload?.customerName}</strong></div>
                            <div>Address: <span>{msg.action.payload?.deliveryAddress}</span></div>
                            <div>Items: <span>{msg.action.payload?.itemsSummary}</span></div>
                            {msg.action.payload?.driverName && <div>Driver: <span>{msg.action.payload.driverName}</span></div>}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmCreateShipment(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Create Delivery Shipment
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* EDIT SHIPMENT */}
                      {msg.action.type === 'EDIT_SHIPMENT' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-purple-600 dark:text-purple-400">
                              <Truck className="w-4 h-4" />
                              <span>UPDATE SHIPMENT / DELIVERY</span>
                            </div>
                          </div>

                          <div className="mt-2.5 bg-purple-50/50 dark:bg-purple-950/30 p-2.5 rounded-xl border border-purple-200/60 dark:border-purple-900/40 text-xs space-y-1">
                            <div>Target Shipment: <strong>#{msg.action.payload?.shipmentId}</strong></div>
                            {msg.action.payload?.status && <div>New Stage: <strong>{msg.action.payload.status}</strong></div>}
                            {msg.action.payload?.driverName && <div>Driver: <span>{msg.action.payload.driverName}</span></div>}
                            {msg.action.payload?.driverPhone && <div>Driver Phone: <span>{msg.action.payload.driverPhone}</span></div>}
                            {msg.action.payload?.customMessage && <div>Note: <span>{msg.action.payload.customMessage}</span></div>}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmEditShipment(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Confirm Delivery Update
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* DELETE SHIPMENT */}
                      {msg.action.type === 'DELETE_SHIPMENT' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-red-100 dark:border-red-900/60">
                            <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>CONFIRM SHIPMENT DELETION</span>
                            </div>
                          </div>

                          <div className="mt-2 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-xs">
                            <p className="font-bold text-red-900 dark:text-red-200">
                              Delete shipment #{msg.action.payload?.shipmentId}?
                            </p>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteShipment(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs"
                              >
                                Confirm Delete Shipment
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* DELETE TRANSACTION */}
                      {msg.action.type === 'DELETE_TRANSACTION' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-red-100 dark:border-red-900/60">
                            <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>DELETE PAYMENT TRANSACTION</span>
                            </div>
                          </div>

                          <div className="mt-2 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-xs">
                            <p className="font-bold text-red-900 dark:text-red-200">
                              Delete transaction record #{msg.action.payload?.transactionId}?
                            </p>
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteTransaction(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* UNIVERSAL FIRESTORE MUTATION */}
                      {msg.action.type === 'UNIVERSAL_FIRESTORE_MUTATION' && (
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400">
                              <Layers className="w-4 h-4" />
                              <span>FIREBASE DATABASE {msg.action.payload?.operation || 'UPDATE'}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {msg.action.payload?.collection}
                            </span>
                          </div>

                          <div className="mt-2.5 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                            <div>Target: <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{msg.action.payload?.collection}/{msg.action.payload?.docId}</code></div>
                            {msg.action.payload?.summary && <div>Action: <span>{msg.action.payload.summary}</span></div>}
                            {msg.action.payload?.data && (
                              <div className="mt-1 p-2 bg-black/5 dark:bg-white/5 rounded-lg font-mono text-[11px] overflow-x-auto max-h-32">
                                <pre>{JSON.stringify(msg.action.payload.data, null, 2)}</pre>
                              </div>
                            )}
                          </div>

                          {msg.action.status === 'PENDING' ? (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmUniversalMutation(msg.id, msg.action?.payload)}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                Confirm & Apply to Firebase
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === msg.id ? { ...m, action: { ...m.action!, status: 'CANCELLED' } } : m
                                    )
                                  )
                                }
                                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : msg.action.status === 'DONE' ? (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                              ✅ {msg.action.resultId}
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
