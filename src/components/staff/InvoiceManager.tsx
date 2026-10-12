import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Eye,
  CreditCard,
  QrCode,
  Landmark,
  Banknote,
  Wallet,
  Link as LinkIcon,
  CheckCircle2,
  Truck,
  Trash2,
  Share2,
  Copy,
  Boxes,
  Edit2,
  HardDrive,
  Cloud,
  Globe,
  ExternalLink,
  Calendar,
  UserPlus,
  Printer,
  CheckSquare,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceLineItem, Quotation, TransactionRecord, PdfProviderType, Customer } from '../../types';
import { generateInvoicePdf, generateBatchInvoicesPdf } from '../../utils/pdfGenerator';
import { resolvePdfLinks } from '../../utils/cloudPdfHelper';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import { CloudPdfLinkSelector } from '../common/CloudPdfLinkSelector';
import { CustomerModal } from '../common/CustomerModal';
import { CustomerSelectBox } from '../common/CustomerSelectBox';

interface InvoiceManagerProps {
  initialQuoteToConvert?: Quotation | null;
  onClearInitialQuote?: () => void;
  initialStockItemToBill?: any | null;
  onClearInitialStock?: () => void;
  onOpenNewShipmentForInvoice?: (invoice: Invoice) => void;
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({
  initialQuoteToConvert,
  onClearInitialQuote,
  initialStockItemToBill,
  onClearInitialStock,
  onOpenNewShipmentForInvoice,
}) => {
  const {
    invoices,
    quotations,
    customers,
    inventory,
    shipments,
    gstNumber,
    updateGstNumber,
    linkInvoicesToShipment,
    addInvoice,
    updateInvoice,
    recordPaymentForInvoice,
  } = useApp();

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(!!initialQuoteToConvert);

  // PDF Preview State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [previewTitle, setPreviewTitle] = useState('Tax Invoice PDF');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Bulk Selection & Batch Export State
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // Post-Invoice Payment Modal
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<TransactionRecord['mode']>('UPI');
  const [payRefNo, setPayRefNo] = useState('');
  const [payBankDrawer, setPayBankDrawer] = useState('HDFC Bank');
  const [payTreatment, setPayTreatment] = useState<'LINKED_TO_INVOICE' | 'ADDED_TO_BALANCE'>('LINKED_TO_INVOICE');
  const [payNotes, setPayNotes] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Form State for New Invoice
  const [formInvoiceDate, setFormInvoiceDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formPaymentTransId, setFormPaymentTransId] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formBillingAddress, setFormBillingAddress] = useState('');
  const [formInstallationAddress, setFormInstallationAddress] = useState('');
  const [formLinkedQuoteId, setFormLinkedQuoteId] = useState('');
  const [formPdfLink, setFormPdfLink] = useState('');
  const [formPdfConfig, setFormPdfConfig] = useState<{
    provider: PdfProviderType;
    driveId?: string;
    viewLink: string;
    downloadLink: string;
  }>({
    provider: 'google_drive',
    viewLink: '',
    downloadLink: '',
  });
  const [formNotes, setFormNotes] = useState('');
  const [formCustomIdText, setFormCustomIdText] = useState('');
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formRoundOff, setFormRoundOff] = useState<number>(0);
  const [formGstin, setFormGstin] = useState(gstNumber || '');
  const [isStoreStockPickerOpen, setIsStoreStockPickerOpen] = useState(false);

  // Add / Edit Customer Modal State from Select Customer
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEditModal, setCustomerToEditModal] = useState<Customer | null>(null);
  const [customerModalInitialQuery, setCustomerModalInitialQuery] = useState('');

  // Edit Invoice Modal State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvoiceDate, setEditInvoiceDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [editPaymentTransId, setEditPaymentTransId] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editBillingAddress, setEditBillingAddress] = useState('');
  const [editInstallationAddress, setEditInstallationAddress] = useState('');
  const [editItems, setEditItems] = useState<InvoiceLineItem[]>([]);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editRoundOff, setEditRoundOff] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<Invoice['paymentStatus']>('UNPAID');
  const [editPdfConfig, setEditPdfConfig] = useState<{
    provider: PdfProviderType;
    driveId?: string;
    viewLink: string;
    downloadLink: string;
  }>({
    provider: 'google_drive',
    viewLink: '',
    downloadLink: '',
  });
  const [isUpdatingInvoice, setIsUpdatingInvoice] = useState(false);

  // Stock deduction selection (Optional manual selection of available in-store stock)
  const [selectedStockIdsToDeduct, setSelectedStockIdsToDeduct] = useState<string[]>([]);

  // Split payments state
  const [payFromBalance, setPayFromBalance] = useState<number>(0);
  const [payUpiAmount, setPayUpiAmount] = useState<number>(0);
  const [payUpiBank, setPayUpiBank] = useState('HDFC Bank');
  const [payUpiUtr, setPayUpiUtr] = useState('');

  const [payCardAmount, setPayCardAmount] = useState<number>(0);
  const [payCardBank, setPayCardBank] = useState('HDFC POS');
  const [payCardAuth, setPayCardAuth] = useState('');

  const [payChequeAmount, setPayChequeAmount] = useState<number>(0);
  const [payChequeBank, setPayChequeBank] = useState('ICICI Bank');
  const [payChequeRef, setPayChequeRef] = useState('');

  const [payCashAmount, setPayCashAmount] = useState<number>(0);
  const [payCashRegister, setPayCashRegister] = useState('Main Drawer 1');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Items State (multi-product, option to enter amount with tax)
  const [items, setItems] = useState<InvoiceLineItem[]>([
    {
      id: 'inv-item-1',
      name: '',
      modelNo: '',
      type: 'AC',
      brand: '',
      serialNo: '',
      indoorUnitSerial: '',
      outdoorUnitSerial: '',
      quantity: 1,
      rate: 0,
      taxPercent: 18,
      isAmountWithTax: true,
      discount: 0,
      lineTotal: 0,
    },
  ]);

  // Handle incoming converted quote
  useEffect(() => {
    if (initialQuoteToConvert) {
      setFormCustomerId(initialQuoteToConvert.customerId);
      setFormCustomerName(initialQuoteToConvert.customerExternalName);
      setFormCustomerPhone(initialQuoteToConvert.customerPhone);
      setFormBillingAddress(initialQuoteToConvert.billingAddress || '');
      setFormInstallationAddress(initialQuoteToConvert.installationAddress || '');
      setFormLinkedQuoteId(initialQuoteToConvert.id);

      if (initialQuoteToConvert.items && initialQuoteToConvert.items.length > 0) {
        setItems(
          initialQuoteToConvert.items.map((it, idx) => ({
            id: `conv-item-${idx}`,
            name: it.name,
            modelNo: it.modelNo,
            type: it.type,
            brand: it.brand || '',
            serialNo: '',
            indoorUnitSerial: '',
            outdoorUnitSerial: '',
            quantity: it.quantity,
            rate: it.rate,
            taxPercent: it.taxPercent,
            isAmountWithTax: it.isAmountWithTax,
            discount: 0,
            lineTotal: it.lineTotal,
          }))
        );
      }
      setIsCreateOpen(true);
      if (onClearInitialQuote) onClearInitialQuote();
    }
  }, [initialQuoteToConvert, onClearInitialQuote]);

  // Handle incoming stock item to bill from Store Stock
  useEffect(() => {
    if (initialStockItemToBill) {
      const stockItem: InvoiceLineItem = {
        id: `stock-${initialStockItemToBill.id}`,
        name: initialStockItemToBill.name,
        modelNo: initialStockItemToBill.modelNo,
        type: initialStockItemToBill.type || 'AC',
        brand: initialStockItemToBill.brand || '',
        serialNo: initialStockItemToBill.serialNo || '',
        indoorUnitSerial: '',
        outdoorUnitSerial: '',
        quantity: 1,
        rate: initialStockItemToBill.sellingPrice || 0,
        taxPercent: 18,
        isAmountWithTax: true,
        discount: 0,
        lineTotal: initialStockItemToBill.sellingPrice || 0,
      };
      setItems([stockItem]);
      setSelectedStockIdsToDeduct([initialStockItemToBill.id]);
      setIsCreateOpen(true);
      if (onClearInitialStock) onClearInitialStock();
    }
  }, [initialStockItemToBill, onClearInitialStock]);

  useEffect(() => {
    if (gstNumber && !formGstin) {
      setFormGstin(gstNumber);
    }
  }, [gstNumber]);

  const handleItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    const qty = Number(current.quantity) || 1;
    const rate = Number(current.rate) || 0;
    const tax = Number(current.taxPercent) || 0;

    if (current.isAmountWithTax) {
      current.lineTotal = Math.round(qty * rate);
    } else {
      current.lineTotal = Math.round(qty * rate * (1 + tax / 100));
    }

    updated[index] = current;
    setItems(updated);
  };

  const handleToggleAddStockToBill = (stk: any) => {
    const isSelected = selectedStockIdsToDeduct.includes(stk.id);
    if (isSelected) {
      setSelectedStockIdsToDeduct(selectedStockIdsToDeduct.filter((x) => x !== stk.id));
      const filtered = items.filter((it) => it.id !== `stock-${stk.id}`);
      setItems(
        filtered.length > 0
          ? filtered
          : [
              {
                id: `inv-item-${Date.now()}`,
                name: '',
                modelNo: '',
                type: 'AC',
                brand: '',
                serialNo: '',
                indoorUnitSerial: '',
                outdoorUnitSerial: '',
                quantity: 1,
                rate: 0,
                taxPercent: 18,
                isAmountWithTax: true,
                discount: 0,
                lineTotal: 0,
              },
            ]
      );
    } else {
      setSelectedStockIdsToDeduct([...selectedStockIdsToDeduct, stk.id]);
      const newStockLineItem: InvoiceLineItem = {
        id: `stock-${stk.id}`,
        name: stk.name,
        modelNo: stk.modelNo,
        type: stk.type || 'AC',
        brand: stk.brand || '',
        serialNo: stk.serialNo || '',
        indoorUnitSerial: '',
        outdoorUnitSerial: '',
        quantity: 1,
        rate: stk.sellingPrice || 0,
        taxPercent: 18,
        isAmountWithTax: true,
        discount: 0,
        lineTotal: stk.sellingPrice || 0,
      };
      if (items.length === 1 && !items[0].name && items[0].rate === 0) {
        setItems([newStockLineItem]);
      } else {
        setItems([...items, newStockLineItem]);
      }
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `inv-item-${Date.now()}`,
        name: '',
        modelNo: '',
        type: 'AC',
        brand: '',
        serialNo: '',
        indoorUnitSerial: '',
        outdoorUnitSerial: '',
        quantity: 1,
        rate: 0,
        taxPercent: 18,
        isAmountWithTax: true,
        discount: 0,
        lineTotal: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const removed = items[index];
    if (removed.id && removed.id.startsWith('stock-')) {
      const stkId = removed.id.replace('stock-', '');
      setSelectedStockIdsToDeduct(selectedStockIdsToDeduct.filter((x) => x !== stkId));
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const grossTotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const taxAmount = Math.round(
    items.reduce((sum, item) => {
      if (item.isAmountWithTax) {
        return sum + (item.lineTotal - item.lineTotal / (1 + item.taxPercent / 100));
      } else {
        return sum + (item.quantity * item.rate * item.taxPercent) / 100;
      }
    }, 0)
  );
  const rawTotalBeforeRoundOff = Math.max(0, grossTotal - (Number(formDiscount) || 0));
  const totalAmount = Math.max(0, Math.round(rawTotalBeforeRoundOff + (Number(formRoundOff) || 0)));
  const subtotal = Math.max(0, rawTotalBeforeRoundOff - taxAmount);

  const handleAutoRoundOff = () => {
    const raw = Math.max(0, grossTotal - (Number(formDiscount) || 0));
    const rounded = Math.round(raw);
    const diff = Number((rounded - raw).toFixed(2));
    setFormRoundOff(diff);
  };

  const handleEditAutoRoundOff = () => {
    const calcSubtotal = editItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
    const calcTax = editItems.reduce((acc, it) => {
      if (!it.isAmountWithTax && it.taxPercent) {
        return acc + (it.rate * it.quantity * it.taxPercent) / 100;
      }
      return acc;
    }, 0);
    const raw = Math.max(0, calcSubtotal + calcTax - (Number(editDiscount) || 0));
    const rounded = Math.round(raw);
    const diff = Number((rounded - raw).toFixed(2));
    setEditRoundOff(diff);
  };

  const totalPrepaid =
    Number(payFromBalance) +
    Number(payUpiAmount) +
    Number(payCardAmount) +
    Number(payChequeAmount) +
    Number(payCashAmount);

  const amountDue = Math.max(0, totalAmount - totalPrepaid);
  const paymentStatus: Invoice['paymentStatus'] =
    amountDue === 0 ? 'PAID' : totalPrepaid > 0 ? 'PARTIAL' : 'UNPAID';

  const handleSelectCustomer = (custId: string) => {
    setFormCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setFormCustomerName(found.externalName);
      setFormCustomerPhone(found.phone);
      setFormBillingAddress(found.billingAddress || '');
      setFormInstallationAddress(found.installationAddress || found.billingAddress || '');
      if (found.accountBalance > 0) {
        setPayFromBalance(Math.min(found.accountBalance, totalAmount));
      }
    }
  };

  const handleSelectQuoteToLink = (quoteId: string) => {
    setFormLinkedQuoteId(quoteId);
    const foundQuote = quotations.find((q) => q.id === quoteId);
    if (foundQuote) {
      if (!formCustomerName) setFormCustomerName(foundQuote.customerExternalName);
      if (!formCustomerPhone) setFormCustomerPhone(foundQuote.customerPhone);
      if (!formBillingAddress) setFormBillingAddress(foundQuote.billingAddress || '');
      if (!formInstallationAddress) setFormInstallationAddress(foundQuote.installationAddress || '');
    }
  };

  // Available stock items currently in store
  const availableStoreStock = inventory.filter((i) => i.status === 'AVAILABLE');

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addInvoice(
        {
          customerId: formCustomerId || 'WALK-IN',
          customerExternalName: formCustomerName || 'Walk-in Customer',
          customerPhone: formCustomerPhone || '',
          billingAddress: formBillingAddress,
          installationAddress: formInstallationAddress,
          linkedQuoteId: formLinkedQuoteId,
          items,
          subtotal,
          taxAmount,
          discountAmount: Number(formDiscount) || 0,
          roundOffAmount: Number(formRoundOff) || 0,
          totalAmount,
          prepaidSplits: {
            fromBalance: Number(payFromBalance) || 0,
            upi: {
              amount: Number(payUpiAmount) || 0,
              receivingBank: payUpiBank,
              utr: payUpiUtr,
            },
            card: {
              amount: Number(payCardAmount) || 0,
              receivingBank: payCardBank,
              authId: payCardAuth,
            },
            chequeOrNeft: {
              amount: Number(payChequeAmount) || 0,
              bank: payChequeBank,
              chequeOrSlipOrUtr: payChequeRef,
            },
            cash: {
              amount: Number(payCashAmount) || 0,
              drawerRegister: payCashRegister,
            },
          },
          totalPrepaid,
          amountDue,
          paymentStatus,
          pdfLink: formPdfConfig.viewLink || formPdfConfig.downloadLink || formPdfLink,
          pdfProvider: formPdfConfig.provider,
          pdfDriveId: formPdfConfig.driveId,
          pdfViewLink: formPdfConfig.viewLink,
          pdfDownloadLink: formPdfConfig.downloadLink,
          gstNumber: formGstin.trim().toUpperCase() || gstNumber || '',
          notes: formNotes,
          paymentTransId: formPaymentTransId.trim() || undefined,
          createdAt: formInvoiceDate ? new Date(formInvoiceDate).toISOString() : undefined,
          subtractStockItemIds: selectedStockIdsToDeduct,
        },
        formCustomIdText || undefined
      );

      setIsCreateOpen(false);
      // Reset form
      setFormInvoiceDate(new Date().toISOString().slice(0, 10));
      setFormPaymentTransId('');
      setFormCustomerId('');
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormBillingAddress('');
      setFormInstallationAddress('');
      setFormLinkedQuoteId('');
      setFormPdfLink('');
      setFormDiscount(0);
      setFormRoundOff(0);
      setFormGstin(gstNumber || '');
      setFormPdfConfig({
        provider: 'google_drive',
        viewLink: '',
        downloadLink: '',
      });
      setFormNotes('');
      setPayFromBalance(0);
      setPayUpiAmount(0);
      setPayCardAmount(0);
      setPayChequeAmount(0);
      setPayCashAmount(0);
      setSelectedStockIdsToDeduct([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditInvoiceDate(inv.createdAt ? inv.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditPaymentTransId(inv.paymentTransId || '');
    setEditGstin(inv.gstNumber || gstNumber || '');
    setEditCustomerName(inv.customerExternalName);
    setEditCustomerPhone(inv.customerPhone);
    setEditBillingAddress(inv.billingAddress || '');
    setEditInstallationAddress(inv.installationAddress || '');
    setEditItems([...inv.items]);
    setEditDiscount(inv.discountAmount || 0);
    setEditRoundOff(inv.roundOffAmount || 0);
    setEditNotes(inv.notes || '');
    setEditPaymentStatus(inv.paymentStatus);
    setEditPdfConfig({
      provider: inv.pdfProvider || (inv.pdfDriveId ? 'google_drive' : 'google_drive'),
      driveId: inv.pdfDriveId,
      viewLink: inv.pdfViewLink || inv.pdfLink || '',
      downloadLink: inv.pdfDownloadLink || '',
    });
  };

  const handleEditItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = [...editItems];
    const current = { ...updated[index], [field]: value };
    const qty = Number(current.quantity) || 1;
    const rate = Number(current.rate) || 0;
    const tax = Number(current.taxPercent) || 0;
    const disc = Number(current.discount) || 0;

    if (current.isAmountWithTax) {
      current.lineTotal = Math.max(0, Math.round(qty * rate - disc));
    } else {
      current.lineTotal = Math.max(0, Math.round(qty * rate * (1 + tax / 100) - disc));
    }

    updated[index] = current;
    setEditItems(updated);
  };

  const handleAddEditItem = () => {
    setEditItems([
      ...editItems,
      {
        id: `edit-item-${Date.now()}`,
        name: '',
        modelNo: '',
        type: 'AC',
        brand: '',
        serialNo: '',
        indoorUnitSerial: '',
        outdoorUnitSerial: '',
        quantity: 1,
        rate: 0,
        taxPercent: 18,
        isAmountWithTax: true,
        discount: 0,
        lineTotal: 0,
      },
    ]);
  };

  const handleRemoveEditItem = (index: number) => {
    if (editItems.length <= 1) return;
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleSaveEditedInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    setIsUpdatingInvoice(true);
    try {
      const calculatedSubtotal = editItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
      const calculatedTax = editItems.reduce((acc, it) => {
        if (!it.isAmountWithTax && it.taxPercent) {
          return acc + (it.rate * it.quantity * it.taxPercent) / 100;
        }
        return acc;
      }, 0);
      const rawTotal = Math.max(0, calculatedSubtotal + calculatedTax - (Number(editDiscount) || 0));
      const calculatedTotal = Math.max(0, Math.round(rawTotal + (Number(editRoundOff) || 0)));
      const amountDue = Math.max(0, calculatedTotal - editingInvoice.totalPrepaid);
      const finalPaymentStatus: Invoice['paymentStatus'] =
        amountDue === 0 ? 'PAID' : editingInvoice.totalPrepaid > 0 ? 'PARTIAL' : editPaymentStatus;

      await updateInvoice(editingInvoice.id, {
        customerExternalName: editCustomerName.trim(),
        customerPhone: editCustomerPhone.trim(),
        billingAddress: editBillingAddress.trim(),
        installationAddress: editInstallationAddress.trim(),
        items: editItems,
        subtotal: calculatedSubtotal,
        taxAmount: calculatedTax,
        discountAmount: Number(editDiscount) || 0,
        roundOffAmount: Number(editRoundOff) || 0,
        totalAmount: calculatedTotal,
        amountDue,
        paymentStatus: finalPaymentStatus,
        notes: editNotes.trim(),
        pdfProvider: editPdfConfig.provider,
        pdfDriveId: editPdfConfig.driveId,
        pdfViewLink: editPdfConfig.viewLink,
        pdfDownloadLink: editPdfConfig.downloadLink,
        pdfLink: editPdfConfig.viewLink || editPdfConfig.downloadLink,
        gstNumber: editGstin.trim().toUpperCase() || gstNumber || '',
        paymentTransId: editPaymentTransId.trim() || undefined,
        createdAt: editInvoiceDate ? new Date(editInvoiceDate).toISOString() : editingInvoice.createdAt,
      });

      setEditingInvoice(null);
    } finally {
      setIsUpdatingInvoice(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || payAmount <= 0) return;
    setIsRecordingPayment(true);
    try {
      await recordPaymentForInvoice(
        selectedInvoiceForPayment.id,
        Number(payAmount),
        payMode,
        payRefNo,
        payBankDrawer,
        payTreatment,
        payNotes
      );
      setSelectedInvoiceForPayment(null);
      setPayAmount(0);
      setPayRefNo('');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handlePreviewPdf = (inv: Invoice) => {
    setPreviewTitle(`Tax Invoice: ${inv.id}`);
    const resolved = resolvePdfLinks(inv);
    if (resolved.hasPdf) {
      if (resolved.embedLink) {
        setPreviewPdfUrl(resolved.embedLink);
        setPreviewFilename(`${inv.id}-TaxInvoice.pdf`);
        setIsPreviewOpen(true);
      } else {
        window.open(resolved.viewLink, '_blank', 'noopener,noreferrer');
      }
    } else {
      // Fallback: generate PDF preview using the invoice's GSTIN or store GSTIN
      const { url, filename } = generateInvoicePdf(inv, inv.gstNumber || gstNumber);
      setPreviewPdfUrl(url);
      setPreviewFilename(filename);
      setIsPreviewOpen(true);
    }
  };

  const handleDownloadPdf = (inv: Invoice) => {
    const resolved = resolvePdfLinks(inv);
    if (resolved.hasPdf && resolved.downloadLink) {
      window.open(resolved.downloadLink, '_blank', 'noopener,noreferrer');
    } else {
      const { doc, filename } = generateInvoicePdf(inv, inv.gstNumber || gstNumber);
      doc.save(filename);
    }
  };

  // Share links (Login link & Bill View link)
  const handleShareLoginLink = (inv: Invoice) => {
    const cust = customers.find((c) => c.id === inv.customerId);
    const linkText = `Lakhi Airconditioners Storefront Access:\nCustomer ID: ${inv.customerId}${cust ? `\nAccess PIN: ${cust.accessPin}` : ''}\nLogin at: ${window.location.origin}`;
    navigator.clipboard.writeText(linkText);
    setCopiedLink(`login-${inv.id}`);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleShareBillViewLink = (inv: Invoice) => {
    const link = inv.pdfLink || `${window.location.origin}/?invoice=${inv.id}`;
    const text = `Lakhi Airconditioners - Invoice ${inv.id} for ${inv.customerExternalName}\nTotal Billed: ₹${inv.totalAmount.toLocaleString('en-IN')}\nStatus: ${inv.paymentStatus}\nView Bill: ${link}`;
    navigator.clipboard.writeText(text);
    setCopiedLink(`bill-${inv.id}`);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleCopyInvoiceDirectLink = (inv: Invoice) => {
    const url = `${window.location.origin}/?invoice=${inv.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(`direct-${inv.id}`);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.id.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerExternalName.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerPhone.includes(search) ||
      inv.items.some((it) => it.name.toLowerCase().includes(search.toLowerCase()) || it.modelNo.toLowerCase().includes(search.toLowerCase()));

    const matchesPayment = paymentFilter === 'ALL' || inv.paymentStatus === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  // Selected Invoices List & Calculations
  const selectedInvoicesList = invoices.filter((i) => selectedInvoiceIds.includes(i.id));

  const handleToggleSelectAll = () => {
    if (selectedInvoiceIds.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filteredInvoices.map((i) => i.id));
    }
  };

  const handleToggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedInvoiceIds([]);
  };

  // Export / Preview Batch PDF
  const handleExportBatchPdf = () => {
    if (selectedInvoicesList.length === 0) return;
    setIsGeneratingBatch(true);
    try {
      const { url, filename } = generateBatchInvoicesPdf(selectedInvoicesList, gstNumber);
      setPreviewPdfUrl(url);
      setPreviewFilename(filename);
      setPreviewTitle(`Batch Invoices (${selectedInvoicesList.length} Documents)`);
      setIsPreviewOpen(true);
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Direct Download Batch PDF
  const handleDownloadBatchPdf = () => {
    if (selectedInvoicesList.length === 0) return;
    setIsGeneratingBatch(true);
    try {
      const { doc, filename } = generateBatchInvoicesPdf(selectedInvoicesList, gstNumber);
      doc.save(filename);
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Direct Print Batch Invoices
  const handlePrintBatchInvoices = () => {
    if (selectedInvoicesList.length === 0) return;
    setIsGeneratingBatch(true);
    try {
      const { url, filename } = generateBatchInvoicesPdf(selectedInvoicesList, gstNumber);
      setPreviewPdfUrl(url);
      setPreviewFilename(filename);
      setPreviewTitle(`Batch Invoices (${selectedInvoicesList.length} Documents)`);
      setIsPreviewOpen(true);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => {
          try {
            printWindow.print();
          } catch (e) {
            console.warn('Auto-print error', e);
          }
        }, 700);
      }
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-600 dark:text-red-400" />
            Billing & Invoices (I...)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-appliance tax bills, split payments, manual in-store stock deduction, and quote linking.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-red-600/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          + Create New Invoice
        </button>
      </div>

      {/* Bulk Selection Actions Floating/Pinned Bar */}
      {selectedInvoiceIds.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white rounded-3xl p-4 sm:p-5 shadow-xl shadow-red-600/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-red-500/40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shrink-0">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>{selectedInvoiceIds.length} Invoice{selectedInvoiceIds.length > 1 ? 's' : ''} Selected</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono font-bold">
                  Total: ₹{selectedInvoicesList.reduce((sum, inv) => sum + inv.totalAmount, 0).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-red-100">
                Print or export all {selectedInvoiceIds.length} invoices merged into a single multi-page PDF batch for easy document filing and physical dispatch.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <button
              onClick={handlePrintBatchInvoices}
              disabled={isGeneratingBatch}
              className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all hover:scale-102"
              title="Print all selected invoices as a single document"
            >
              <Printer className="w-4 h-4 text-red-600" />
              <span>{isGeneratingBatch ? 'Compiling...' : 'Print Batch'}</span>
            </button>

            <button
              onClick={handleExportBatchPdf}
              disabled={isGeneratingBatch}
              className="px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white disabled:opacity-50 text-xs font-bold rounded-xl border border-white/30 flex items-center gap-2 transition-all"
              title="Preview and export multi-page PDF batch"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Batch</span>
            </button>

            <button
              onClick={handleDownloadBatchPdf}
              disabled={isGeneratingBatch}
              className="px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white disabled:opacity-50 text-xs font-bold rounded-xl border border-white/30 flex items-center gap-2 transition-all"
              title="Download single PDF batch file"
            >
              <Download className="w-4 h-4" />
              <span>Download Batch PDF</span>
            </button>

            <button
              onClick={handleClearSelection}
              className="px-3 py-2.5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold rounded-xl transition-colors"
            >
              ✕ Deselect
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search I-ID, customer, model..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Toggle select all filtered invoices"
            >
              <CheckSquare className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>
                {selectedInvoiceIds.length === filteredInvoices.length && filteredInvoices.length > 0
                  ? 'Deselect All'
                  : `Select All (${filteredInvoices.length})`}
              </span>
            </button>
            {selectedInvoiceIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs text-slate-400 hover:text-red-600 font-medium px-1.5"
              >
                Clear ({selectedInvoiceIds.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {['ALL', 'PAID', 'PARTIAL', 'UNPAID'].map((st) => (
              <button
                key={st}
                onClick={() => setPaymentFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  paymentFilter === st
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedInvoiceIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                    onChange={handleToggleSelectAll}
                    title="Select / Deselect all invoices"
                    className="w-4 h-4 text-red-600 rounded border-slate-300 dark:border-slate-700 focus:ring-red-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Invoice ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items & Serials</th>
                <th className="px-4 py-3">Billed / Prepaid</th>
                <th className="px-4 py-3">Amount Due</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No invoices recorded. Click "+ Create New Invoice" to generate a bill.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = selectedInvoiceIds.includes(inv.id);
                  return (
                  <tr
                    key={inv.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-red-50/70 dark:bg-red-950/30'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectInvoice(inv.id)}
                        title="Select for batch actions"
                        className="w-4 h-4 text-red-600 rounded border-slate-300 dark:border-slate-700 focus:ring-red-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-red-600 dark:text-red-400">{inv.id}</div>
                      {inv.linkedQuoteId && (
                        <div className="text-[10px] text-slate-400 font-mono">Linked Q: {inv.linkedQuoteId}</div>
                      )}
                      {/* Invoice Link Container */}
                      <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1 max-w-[200px]">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <LinkIcon className="w-3 h-3 text-red-600 dark:text-red-400" />
                            Bill Link
                          </span>
                          <button
                            onClick={() => handleCopyInvoiceDirectLink(inv)}
                            className="text-red-600 dark:text-red-400 hover:underline font-bold flex items-center gap-0.5"
                            title="Copy Direct Link"
                          >
                            <Copy className="w-2.5 h-2.5" />
                            {copiedLink === `direct-${inv.id}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="font-mono text-[9px] text-slate-500 truncate" title={`${window.location.origin}/?invoice=${inv.id}`}>
                          {`${typeof window !== 'undefined' ? window.location.origin : ''}/?invoice=${inv.id}`}
                        </div>
                        {(() => {
                          const links = resolvePdfLinks(inv);
                          if (links.hasPdf) {
                            return (
                              <div className="pt-1 border-t border-slate-200 dark:border-slate-700 space-y-1 text-[10px]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                    {links.provider === 'google_drive'
                                      ? 'Google Drive'
                                      : links.provider === 'onedrive'
                                      ? 'OneDrive'
                                      : 'Cloud PDF'}
                                  </span>
                                  <span className="text-[8px] font-mono px-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded">
                                    {links.provider === 'google_drive' && links.driveId ? 'Auto ID' : 'Linked'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-1 text-[9px]">
                                  <a
                                    href={links.viewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-0.5"
                                  >
                                    <Eye className="w-2.5 h-2.5" /> View
                                  </a>
                                  {links.downloadLink && (
                                    <a
                                      href={links.downloadLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-0.5"
                                    >
                                      <Download className="w-2.5 h-2.5" /> Download
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[9px]">
                              <span className="text-slate-400">No PDF attached</span>
                              <button
                                onClick={() => handleStartEditInvoice(inv)}
                                className="text-red-600 dark:text-red-400 font-bold hover:underline"
                              >
                                + Link
                              </button>
                            </div>
                          );
                        })()}
                        {/* Linked Delivery (D...) indicator */}
                        {(() => {
                          const linkedDelivery = shipments.find(
                            (s) => s.invoiceId === inv.id || (s.invoiceIds && s.invoiceIds.includes(inv.id))
                          );
                          if (linkedDelivery) {
                            return (
                              <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[9px] text-red-600 dark:text-red-400 font-mono">
                                <span>🚚 {linkedDelivery.id}</span>
                                <span className="font-bold text-[8px] uppercase px-1 py-0.2 bg-red-100 dark:bg-red-950/60 rounded">
                                  {linkedDelivery.status.replace(/_/g, ' ').slice(0, 10)}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">{inv.customerExternalName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{inv.customerPhone}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {inv.paymentTransId && (
                        <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 truncate max-w-xs" title={`Trans ID: ${inv.paymentTransId}`}>
                          💳 Ref: {inv.paymentTransId}
                        </div>
                      )}
                      {inv.billingAddress && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">{inv.billingAddress}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 max-w-xs">
                        {inv.items.map((it, idx) => (
                          <div key={idx} className="text-slate-800 dark:text-slate-200 text-[11px]">
                            <span className="font-bold">{it.quantity}x</span> {it.name || it.type} ({it.modelNo || 'Std'})
                            {it.serialNo && <span className="text-[10px] text-slate-400 ml-1">SN: {it.serialNo}</span>}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        ₹{inv.totalAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Prepaid: ₹{inv.totalPrepaid.toLocaleString('en-IN')}
                      </div>
                      {inv.roundOffAmount !== undefined && inv.roundOffAmount !== 0 && (
                        <div className="text-[9px] text-blue-600 dark:text-blue-400 font-mono">
                          Rnd: {inv.roundOffAmount > 0 ? '+' : ''}₹{inv.roundOffAmount}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`font-black text-xs ${
                          inv.amountDue === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        ₹{inv.amountDue.toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                            : inv.paymentStatus === 'PARTIAL'
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePreviewPdf(inv)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Preview Bill PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(inv)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Download Bill PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEditInvoice(inv)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Invoice Details & PDF Link"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleShareBillViewLink(inv)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Share Bill View Link"
                        >
                          {copiedLink === `bill-${inv.id}` ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleShareLoginLink(inv)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Share Customer Login Link"
                        >
                          {copiedLink === `login-${inv.id}` ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                        </button>
                        {inv.amountDue > 0 && (
                          <button
                            onClick={() => {
                              setSelectedInvoiceForPayment(inv);
                              setPayAmount(inv.amountDue);
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] transition-colors ml-1"
                            title="Collect Post-Invoice Payment"
                          >
                            + Pay
                          </button>
                        )}
                        {onOpenNewShipmentForInvoice && (
                          <button
                            onClick={() => onOpenNewShipmentForInvoice(inv)}
                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Dispatch Shipment"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl my-4 sm:my-8 overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] sm:max-h-[92vh]">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">New Tax Bill & Split Invoice</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Deterministic I... ID collision checked</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              {/* Date, Customer Link & Trans ID */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={formInvoiceDate}
                    onChange={(e) => setFormInvoiceDate(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Trans ID / Ref:
                  </label>
                  <input
                    type="text"
                    value={formPaymentTransId}
                    onChange={(e) => setFormPaymentTransId(e.target.value)}
                    placeholder="UTR / Auth / Slip No"
                    className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <CustomerSelectBox
                  value={formCustomerId}
                  onChange={(custId) => handleSelectCustomer(custId)}
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Legal Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="Customer Name for Bill"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Phone:
                  </label>
                  <input
                    type="tel"
                    required
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                {/* Two Address Fields */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Billing Address(es):
                  </label>
                  <input
                    type="text"
                    value={formBillingAddress}
                    onChange={(e) => setFormBillingAddress(e.target.value)}
                    placeholder="Legal Customer Billing Address"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Installation Address(es):
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormInstallationAddress(formBillingAddress)}
                      className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      📋 Same as Billing Address
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formInstallationAddress}
                    onChange={(e) => setFormInstallationAddress(e.target.value)}
                    placeholder="Delivery/Installation Location"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                {/* Linked Quote ID Enter Option */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Link Quote ID (Optional):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formLinkedQuoteId}
                      onChange={(e) => setFormLinkedQuoteId(e.target.value.toUpperCase())}
                      placeholder="e.g. Q202610094182"
                      className="w-full text-xs font-mono uppercase px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    {quotations.length > 0 && (
                      <select
                        onChange={(e) => handleSelectQuoteToLink(e.target.value)}
                        className="text-xs px-2 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl"
                      >
                        <option value="">Pick Quote</option>
                        {quotations.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.id} - {q.customerExternalName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <CloudPdfLinkSelector
                    initialProvider={formPdfConfig.provider}
                    initialDriveId={formPdfConfig.driveId}
                    initialViewLink={formPdfConfig.viewLink}
                    initialDownloadLink={formPdfConfig.downloadLink}
                    onChange={(cfg) => setFormPdfConfig(cfg)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Custom ID Middle Text:
                  </label>
                  <input
                    type="text"
                    value={formCustomIdText}
                    onChange={(e) => setFormCustomIdText(e.target.value.toUpperCase())}
                    placeholder="e.g. PROJECT-A"
                    className="w-full text-xs font-mono uppercase px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store GSTIN (Tax ID for Bill):
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={formGstin}
                      onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 24AABCL9921L1Z4"
                      className="flex-1 text-xs font-mono uppercase px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    {formGstin && formGstin !== gstNumber && (
                      <button
                        type="button"
                        onClick={async () => {
                          await updateGstNumber(formGstin);
                          alert(`Store default GSTIN set to ${formGstin}`);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl whitespace-nowrap"
                        title="Save as Store Default"
                      >
                        Set Default
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Section: Multi-Product (AC, TV, Refrigerator, etc.) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Billed Equipment / Items ({items.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    {availableStoreStock.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsStoreStockPickerOpen(!isStoreStockPickerOpen)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                          isStoreStockPickerOpen
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200'
                        }`}
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        + Pick from Store Stock ({availableStoreStock.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Inline Quick Store Stock Picker Drawer if opened */}
                {isStoreStockPickerOpen && availableStoreStock.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                      <span>Select Available Store Items to Add to Bill:</span>
                      <button
                        type="button"
                        onClick={() => setIsStoreStockPickerOpen(false)}
                        className="text-[11px] text-amber-700 underline"
                      >
                        Done
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableStoreStock.map((stk) => {
                        const isAdded = selectedStockIdsToDeduct.includes(stk.id);
                        return (
                          <div
                            key={stk.id}
                            onClick={() => handleToggleAddStockToBill(stk)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                              isAdded
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-amber-200 hover:border-amber-400'
                            }`}
                          >
                            <div>
                              <div className="font-bold">{stk.name}</div>
                              <div className="text-[10px] opacity-80 font-mono">
                                {stk.modelNo} • SN: {stk.serialNo || 'None'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-black">₹{stk.sellingPrice.toLocaleString('en-IN')}</div>
                              <span className="text-[10px] font-bold underline">
                                {isAdded ? '✓ Added' : '+ Add'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Type:
                          </label>
                          <input
                            type="text"
                            required
                            value={item.type}
                            onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                            placeholder="AC, TV, Fridge..."
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Product Name:
                          </label>
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            placeholder="e.g. 55 Inch 4K Smart TV"
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Model No:
                          </label>
                          <input
                            type="text"
                            value={item.modelNo}
                            onChange={(e) => handleItemChange(index, 'modelNo', e.target.value)}
                            placeholder="Model #"
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Brand:
                          </label>
                          <input
                            type="text"
                            value={item.brand}
                            onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                            placeholder="Sony, LG, Daikin..."
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Serials Input */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Device Serial No:
                          </label>
                          <input
                            type="text"
                            value={item.serialNo}
                            onChange={(e) => handleItemChange(index, 'serialNo', e.target.value)}
                            placeholder="Barcode SN"
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Indoor Unit SN (If AC):
                          </label>
                          <input
                            type="text"
                            value={item.indoorUnitSerial}
                            onChange={(e) => handleItemChange(index, 'indoorUnitSerial', e.target.value)}
                            placeholder="Indoor SN"
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Outdoor Unit SN (If AC):
                          </label>
                          <input
                            type="text"
                            value={item.outdoorUnitSerial}
                            onChange={(e) => handleItemChange(index, 'outdoorUnitSerial', e.target.value)}
                            placeholder="Outdoor SN"
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Pricing with "Enter Amount With Tax" Option */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Quantity:
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Rate (₹):
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.rate}
                            onChange={(e) => handleItemChange(index, 'rate', Number(e.target.value))}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            Tax %:
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.taxPercent}
                            onChange={(e) => handleItemChange(index, 'taxPercent', Number(e.target.value))}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 pb-1">
                          <input
                            type="checkbox"
                            id={`tax-inv-${index}`}
                            checked={item.isAmountWithTax}
                            onChange={(e) => handleItemChange(index, 'isAmountWithTax', e.target.checked)}
                            className="accent-red-600"
                          />
                          <label htmlFor={`tax-inv-${index}`} className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            Incl. Tax
                          </label>
                        </div>

                        <div className="col-span-2 sm:col-span-1 flex items-center justify-between pb-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                          <div className="font-bold text-xs text-red-600 dark:text-red-400">
                            ₹{item.lineTotal.toLocaleString('en-IN')}
                          </div>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* In-Store Available Stock Quick-Add & Auto-Deduct */}
              {availableStoreStock.length > 0 && (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <Boxes className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      In-Store Available Stock ({availableStoreStock.length} items):
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Click any item to add directly into Bill & auto-deduct from stock
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {availableStoreStock.map((stk) => {
                      const isSelected = selectedStockIdsToDeduct.includes(stk.id);
                      return (
                        <button
                          key={stk.id}
                          type="button"
                          onClick={() => handleToggleAddStockToBill(stk)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-amber-400'
                          }`}
                        >
                          <span>{isSelected ? '✓ In Bill:' : '+ Add to Bill:'}</span>
                          <span className="font-bold">{stk.name}</span>
                          <span className="font-mono text-[11px] opacity-80">
                            (₹{stk.sellingPrice.toLocaleString('en-IN')})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discount & Round Off Adjustment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Special Discount / Trade Scheme (₹):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Round Off Amount (+/- ₹):
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoRoundOff}
                      className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline"
                    >
                      Auto Round Off
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formRoundOff}
                    onChange={(e) => setFormRoundOff(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Split Payments At Bill Creation */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Prepaid Payment Split (₹{totalPrepaid.toLocaleString('en-IN')} / ₹{totalAmount.toLocaleString('en-IN')})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Advance Account Balance */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      From Account Balance:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={payFromBalance}
                      onChange={(e) => setPayFromBalance(Number(e.target.value))}
                      className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* UPI */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      UPI Amount & UTR:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={payUpiAmount}
                      onChange={(e) => setPayUpiAmount(Number(e.target.value))}
                      placeholder="Amount"
                      className="w-full text-xs font-bold px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={payUpiUtr}
                      onChange={(e) => setPayUpiUtr(e.target.value)}
                      placeholder="UPI UTR / Trans ID"
                      className="w-full text-[11px] font-mono px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Card POS */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Card Amount & Auth Code:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={payCardAmount}
                      onChange={(e) => setPayCardAmount(Number(e.target.value))}
                      placeholder="Amount"
                      className="w-full text-xs font-bold px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={payCardAuth}
                      onChange={(e) => setPayCardAuth(e.target.value)}
                      placeholder="Card Auth ID"
                      className="w-full text-[11px] font-mono px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Cheque / NEFT */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Cheque / Bank Transfer:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={payChequeAmount}
                      onChange={(e) => setPayChequeAmount(Number(e.target.value))}
                      placeholder="Amount"
                      className="w-full text-xs font-bold px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={payChequeRef}
                      onChange={(e) => setPayChequeRef(e.target.value)}
                      placeholder="Cheque / NEFT Ref"
                      className="w-full text-[11px] font-mono px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Cash */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Cash Tendered:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={payCashAmount}
                      onChange={(e) => setPayCashAmount(Number(e.target.value))}
                      placeholder="Amount"
                      className="w-full text-xs font-bold px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={payCashRegister}
                      onChange={(e) => setPayCashRegister(e.target.value)}
                      placeholder="Register Drawer"
                      className="w-full text-[11px] px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Total Calculation Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-slate-500">Subtotal: ₹{subtotal.toLocaleString('en-IN')}</span>
                    <span className="text-slate-500">Tax: ₹{taxAmount.toLocaleString('en-IN')}</span>
                    {formDiscount > 0 && (
                      <span className="text-amber-600 font-bold">Disc: -₹{formDiscount.toLocaleString('en-IN')}</span>
                    )}
                    {formRoundOff !== 0 && (
                      <span className="text-blue-600 font-bold">Round Off: {formRoundOff > 0 ? '+' : ''}₹{formRoundOff}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-900 dark:text-white font-bold text-sm">
                      Total Bill: ₹{totalAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-emerald-600 font-bold">
                      Prepaid: ₹{totalPrepaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Amount Due / Receivable:</div>
                  <strong className="text-xl font-black text-red-600 dark:text-red-400">
                    ₹{amountDue.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-600/30"
                >
                  {isSubmitting ? 'Creating Invoice...' : 'Generate & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Post-Invoice Payment Modal */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Record Payment</h3>
                <p className="text-xs text-slate-500 font-mono">Invoice: {selectedInvoiceForPayment.id}</p>
              </div>
              <button
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount (Due: ₹{selectedInvoiceForPayment.amountDue.toLocaleString('en-IN')}):
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Mode:</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                >
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card POS</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE_NEFT">Cheque / Bank Transfer</option>
                  <option value="BALANCE_ADJUSTMENT">Balance Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reference No / UTR:</label>
                <input
                  type="text"
                  value={payRefNo}
                  onChange={(e) => setPayRefNo(e.target.value)}
                  placeholder="e.g. UPI UTR or Cheque #"
                  className="w-full font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecordingPayment}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
                >
                  {isRecordingPayment ? 'Recording...' : 'Record Payment (T...)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl my-4 sm:my-8 overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] sm:max-h-[92vh]">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Edit Tax Invoice: <span className="font-mono text-red-600">{editingInvoice.id}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Update customer billing details, appliances, payment status, and cloud PDF links.
                </p>
              </div>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedInvoice} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs">
              {/* Date, Payment Trans ID, Customer & Address Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={editInvoiceDate}
                    onChange={(e) => setEditInvoiceDate(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Trans ID / Ref:
                  </label>
                  <input
                    type="text"
                    value={editPaymentTransId}
                    onChange={(e) => setEditPaymentTransId(e.target.value)}
                    placeholder="UTR / Auth / Slip No"
                    className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Phone:
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Billing Address:
                  </label>
                  <input
                    type="text"
                    value={editBillingAddress}
                    onChange={(e) => setEditBillingAddress(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Installation / Delivery Address:
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditInstallationAddress(editBillingAddress)}
                      className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      📋 Same as Billing Address
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editInstallationAddress}
                    onChange={(e) => setEditInstallationAddress(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store GSTIN (Tax ID for Bill):
                  </label>
                  <input
                    type="text"
                    value={editGstin}
                    onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AABCL9921L1Z4"
                    className="w-full text-xs font-mono uppercase px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Cloud PDF Links Selector */}
              <CloudPdfLinkSelector
                title="Invoice Cloud PDF Document"
                description="Select Google Drive (auto ID extraction), OneDrive, or custom cloud link for viewing and downloading."
                initialProvider={editPdfConfig.provider}
                initialDriveId={editPdfConfig.driveId}
                initialViewLink={editPdfConfig.viewLink}
                initialDownloadLink={editPdfConfig.downloadLink}
                onChange={(cfg) => setEditPdfConfig(cfg)}
              />

              {/* Equipment Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Billed Equipment / Items ({editItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddEditItem}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-200"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {editItems.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Type:
                          </label>
                          <select
                            value={item.type}
                            onChange={(e) => handleEditItemChange(index, 'type', e.target.value)}
                            className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          >
                            <option value="AC">Air Conditioner (AC)</option>
                            <option value="TV">Television (TV)</option>
                            <option value="Refrigerator">Refrigerator</option>
                            <option value="Washing Machine">Washing Machine</option>
                            <option value="Appliance">Other Appliance</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Brand:
                          </label>
                          <input
                            type="text"
                            value={item.brand || ''}
                            onChange={(e) => handleEditItemChange(index, 'brand', e.target.value)}
                            placeholder="Daikin, O General, etc."
                            className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Model No:
                          </label>
                          <input
                            type="text"
                            value={item.modelNo || ''}
                            onChange={(e) => handleEditItemChange(index, 'modelNo', e.target.value)}
                            placeholder="FTKF50TV16U"
                            className="w-full text-xs font-mono px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Item Name:
                          </label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleEditItemChange(index, 'name', e.target.value)}
                            placeholder="1.5 Ton 5 Star Inverter"
                            className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Pricing row */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Quantity:
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleEditItemChange(index, 'quantity', Number(e.target.value))}
                            className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Unit Rate (₹):
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.rate}
                            onChange={(e) => handleEditItemChange(index, 'rate', Number(e.target.value))}
                            className="w-full text-xs font-bold px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            GST Tax %:
                          </label>
                          <select
                            value={item.taxPercent}
                            onChange={(e) => handleEditItemChange(index, 'taxPercent', Number(e.target.value))}
                            className="w-full text-xs px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          >
                            <option value={18}>18% GST</option>
                            <option value={28}>28% GST</option>
                            <option value={12}>12% GST</option>
                            <option value={5}>5% GST</option>
                            <option value={0}>0% None</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Tax Option:
                          </label>
                          <button
                            type="button"
                            onClick={() => handleEditItemChange(index, 'isAmountWithTax', !item.isAmountWithTax)}
                            className={`w-full py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors ${
                              item.isAmountWithTax
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300'
                            }`}
                          >
                            {item.isAmountWithTax ? 'Incl. Tax' : '+ Tax Extra'}
                          </button>
                        </div>

                        <div className="col-span-2 sm:col-span-1 flex items-center justify-between pb-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Line Total:</span>
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              ₹{item.lineTotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                          {editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEditItem(index)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Remove Line Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Serials row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Machine Serial No:
                          </label>
                          <input
                            type="text"
                            value={item.serialNo || ''}
                            onChange={(e) => handleEditItemChange(index, 'serialNo', e.target.value)}
                            placeholder="SN123456"
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Indoor Unit Serial (AC):
                          </label>
                          <input
                            type="text"
                            value={item.indoorUnitSerial || ''}
                            onChange={(e) => handleEditItemChange(index, 'indoorUnitSerial', e.target.value)}
                            placeholder="IDU-SN..."
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Outdoor Unit Serial (AC):
                            </label>
                            <input
                              type="text"
                              value={item.outdoorUnitSerial || ''}
                              onChange={(e) => handleEditItemChange(index, 'outdoorUnitSerial', e.target.value)}
                              placeholder="ODU-SN..."
                              className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </div>

                          {editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEditItem(index)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Special Bill Discount (₹):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(Number(e.target.value))}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Round Off (+/- ₹):
                    </label>
                    <button
                      type="button"
                      onClick={handleEditAutoRoundOff}
                      className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline"
                    >
                      Auto Round
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={editRoundOff}
                    onChange={(e) => setEditRoundOff(Number(e.target.value))}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Status:
                  </label>
                  <select
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="UNPAID">UNPAID</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Internal Staff Notes:
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Delivery next week"
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>
              </div>

              {/* Live Totals Bar */}
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500">
                    Prepaid: ₹{editingInvoice.totalPrepaid.toLocaleString('en-IN')}
                  </span>
                  <span className="text-slate-400 ml-2">
                    (Payments already recorded)
                  </span>
                  {editRoundOff !== 0 && (
                    <span className="text-blue-600 font-bold ml-3">
                      Round Off: {editRoundOff > 0 ? '+' : ''}₹{editRoundOff}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Updated Total Bill:</span>
                  <strong className="text-lg font-black text-slate-900 dark:text-white">
                    ₹{Math.max(
                      0,
                      Math.round(
                        editItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0) -
                        (Number(editDiscount) || 0) +
                        (Number(editRoundOff) || 0)
                      )
                    ).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingInvoice}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Edit2 className="w-4 h-4" />
                  {isUpdatingInvoice ? 'Saving Changes...' : 'Save Invoice Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewPdfUrl}
        filename={previewFilename}
        title={previewTitle || 'Tax Invoice PDF'}
      />

      {/* Customer Modal for Add/Edit Customer */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customerToEdit={customerToEditModal}
        initialQuery={customerModalInitialQuery}
        onSaved={(c) => {
          handleSelectCustomer(c.id);
          setCustomerModalInitialQuery('');
        }}
      />
    </div>
  );
};
