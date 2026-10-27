import React, { useState } from 'react';
import {
  FileCheck2,
  Plus,
  Search,
  Download,
  Eye,
  ArrowRight,
  Trash2,
  Share2,
  CheckCircle2,
  Link as LinkIcon,
  Copy,
  Edit2,
  ExternalLink,
  Calendar,
  UserPlus,
  Sparkles,
  Scissors,
  Tag,
  Hash,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Quotation, QuotationItem, Invoice, PdfProviderType, Customer } from '../../types';
import { generateQuotationPdf } from '../../utils/pdfGenerator';
import { resolvePdfLinks } from '../../utils/cloudPdfHelper';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import { CloudPdfLinkSelector } from '../common/CloudPdfLinkSelector';
import { stripRandomSuffix, buildCustomIdPreview, formatCustomIdValue } from '../../utils/idGenerator';
import { CustomerModal } from '../common/CustomerModal';
import { CustomerSelectBox } from '../common/CustomerSelectBox';
import { AiQuotationBuilderModal } from './AiQuotationBuilderModal';
import { formatCurrency } from '../../utils/currencyHelper';

interface QuotationManagerProps {
  onConvertToInvoice?: (quote: Quotation) => void;
}

export const QuotationManager: React.FC<QuotationManagerProps> = ({ onConvertToInvoice }) => {
  const { quotations, customers, addQuotation, updateQuotationStatus, updateQuotation, gstNumber } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECORDED' | 'SENT'>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // PDF Preview State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // New Quote Form State
  const [formQuoteDate, setFormQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formBillingAddress, setFormBillingAddress] = useState('');
  const [formInstallationAddress, setFormInstallationAddress] = useState('');
  const [formGstin, setFormGstin] = useState(gstNumber || '');
  const [formStatus, setFormStatus] = useState<'RECORDED' | 'SENT'>('RECORDED');
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
  const [formIncludePrefixLetter, setFormIncludePrefixLetter] = useState(true);
  const [formIncludeRandomDigits, setFormIncludeRandomDigits] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add / Edit Customer Modal State from Select Customer
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEditModal, setCustomerToEditModal] = useState<Customer | null>(null);
  const [customerModalInitialQuery, setCustomerModalInitialQuery] = useState('');

  // Edit Quote State
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [editQuoteDate, setEditQuoteDate] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editBillingAddress, setEditBillingAddress] = useState('');
  const [editInstallationAddress, setEditInstallationAddress] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editItems, setEditItems] = useState<QuotationItem[]>([]);
  const [editStatus, setEditStatus] = useState<'RECORDED' | 'SENT'>('RECORDED');
  const [editNotes, setEditNotes] = useState('');
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
  const [isUpdatingQuote, setIsUpdatingQuote] = useState(false);

  // Multiple items list (supports everything: AC, TV, Refrigerator, etc.)
  const [items, setItems] = useState<QuotationItem[]>([
    {
      id: 'item-1',
      name: '',
      modelNo: '',
      type: 'AC',
      brand: '',
      quantity: 1,
      rate: 0,
      taxPercent: 18,
      isAmountWithTax: true,
      lineTotal: 0,
    },
  ]);

  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    // Calculate line total based on whether rate is entered with tax or without
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

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        name: '',
        modelNo: '',
        type: 'AC',
        brand: '',
        quantity: 1,
        rate: 0,
        taxPercent: 18,
        isAmountWithTax: true,
        lineTotal: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = Math.round(
    items.reduce((sum, item) => {
      if (item.isAmountWithTax) {
        // Tax included: total - (total / (1 + tax/100))
        return sum + (item.lineTotal - item.lineTotal / (1 + item.taxPercent / 100));
      } else {
        return sum + (item.quantity * item.rate * item.taxPercent) / 100;
      }
    }, 0)
  );
  const subtotal = totalAmount - taxAmount;

  const handleSelectCustomer = (custId: string) => {
    setFormCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setFormCustomerName(found.externalName);
      setFormCustomerPhone(found.phone);
      setFormBillingAddress(found.billingAddress || '');
      setFormInstallationAddress(found.installationAddress || found.billingAddress || '');
    }
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addQuotation(
        {
          customerId: formCustomerId || 'WALK-IN',
          customerExternalName: formCustomerName || 'Walk-in Customer',
          customerPhone: formCustomerPhone || '',
          billingAddress: formBillingAddress,
          installationAddress: formInstallationAddress,
          items,
          subtotal,
          taxAmount,
          totalAmount,
          status: formStatus,
          pdfLink: formPdfConfig.viewLink || formPdfConfig.downloadLink || formPdfLink,
          pdfProvider: formPdfConfig.provider,
          pdfDriveId: formPdfConfig.driveId,
          pdfViewLink: formPdfConfig.viewLink,
          pdfDownloadLink: formPdfConfig.downloadLink,
          gstNumber: formGstin.trim() || undefined,
          notes: formNotes,
          createdAt: formQuoteDate ? new Date(formQuoteDate).toISOString() : undefined,
        },
        formCustomIdText.trim()
          ? formatCustomIdValue({
              type: 'Q',
              customText: formCustomIdText,
              includePrefixLetter: formIncludePrefixLetter,
              includeRandomDigits: formIncludeRandomDigits,
            })
          : undefined
      );

      setIsCreateOpen(false);
      // Reset form
      setFormQuoteDate(new Date().toISOString().slice(0, 10));
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormBillingAddress('');
      setFormInstallationAddress('');
      setFormGstin(gstNumber || '');
      setFormPdfLink('');
      setFormCustomIdText('');
      setFormIncludePrefixLetter(true);
      setFormIncludeRandomDigits(false);
      setFormPdfConfig({
        provider: 'google_drive',
        viewLink: '',
        downloadLink: '',
      });
      setFormNotes('');
      setItems([
        {
          id: 'item-1',
          name: '',
          modelNo: '',
          type: 'AC',
          brand: '',
          quantity: 1,
          rate: 0,
          taxPercent: 18,
          isAmountWithTax: true,
          lineTotal: 0,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditQuote = (q: Quotation) => {
    setEditingQuotation(q);
    setEditQuoteDate(q.createdAt ? q.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditCustomerName(q.customerExternalName);
    setEditCustomerPhone(q.customerPhone);
    setEditBillingAddress(q.billingAddress || '');
    setEditInstallationAddress(q.installationAddress || '');
    setEditGstin(q.gstNumber || gstNumber || '');
    setEditItems([...q.items]);
    setEditStatus(q.status);
    setEditNotes(q.notes || '');
    setEditPdfConfig({
      provider: q.pdfProvider || (q.pdfDriveId ? 'google_drive' : 'google_drive'),
      driveId: q.pdfDriveId,
      viewLink: q.pdfViewLink || q.pdfLink || '',
      downloadLink: q.pdfDownloadLink || '',
    });
  };

  const handleEditQuoteItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    const updated = [...editItems];
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
    setEditItems(updated);
  };

  const handleAddEditQuoteItem = () => {
    setEditItems([
      ...editItems,
      {
        id: `edit-quote-item-${Date.now()}`,
        name: '',
        modelNo: '',
        type: 'AC',
        brand: '',
        quantity: 1,
        rate: 0,
        taxPercent: 18,
        isAmountWithTax: true,
        lineTotal: 0,
      },
    ]);
  };

  const handleRemoveEditQuoteItem = (index: number) => {
    if (editItems.length <= 1) return;
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleSaveEditedQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuotation) return;
    setIsUpdatingQuote(true);
    try {
      const calculatedTotal = editItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
      const calculatedTax = Math.round(
        editItems.reduce((acc, it) => {
          if (it.isAmountWithTax) {
            return acc + (it.lineTotal - it.lineTotal / (1 + it.taxPercent / 100));
          } else {
            return acc + (it.quantity * it.rate * it.taxPercent) / 100;
          }
        }, 0)
      );
      const calculatedSubtotal = calculatedTotal - calculatedTax;

      await updateQuotation(editingQuotation.id, {
        customerExternalName: editCustomerName.trim(),
        customerPhone: editCustomerPhone.trim(),
        billingAddress: editBillingAddress.trim(),
        installationAddress: editInstallationAddress.trim(),
        gstNumber: editGstin.trim() || undefined,
        items: editItems,
        subtotal: calculatedSubtotal,
        taxAmount: calculatedTax,
        totalAmount: calculatedTotal,
        status: editStatus,
        notes: editNotes.trim(),
        pdfProvider: editPdfConfig.provider,
        pdfDriveId: editPdfConfig.driveId,
        pdfViewLink: editPdfConfig.viewLink,
        pdfDownloadLink: editPdfConfig.downloadLink,
        pdfLink: editPdfConfig.viewLink || editPdfConfig.downloadLink,
        createdAt: editQuoteDate ? new Date(editQuoteDate).toISOString() : editingQuotation.createdAt,
      });

      setEditingQuotation(null);
    } finally {
      setIsUpdatingQuote(false);
    }
  };

  const handlePreviewPdf = (q: Quotation) => {
    const resolved = resolvePdfLinks(q);
    if (resolved.hasPdf) {
      if (resolved.embedLink) {
        setPreviewPdfUrl(resolved.embedLink);
        setPreviewFilename(`${q.id}-Quotation.pdf`);
        setIsPreviewOpen(true);
      } else {
        window.open(resolved.viewLink, '_blank', 'noopener,noreferrer');
      }
    } else {
      if (window.confirm(`No PDF link attached to quotation ${q.id}.\n\nWould you like to edit this quotation now to attach a Google Drive, OneDrive, or Cloud PDF link?`)) {
        handleStartEditQuote(q);
      }
    }
  };

  const handleDownloadPdf = (q: Quotation) => {
    const resolved = resolvePdfLinks(q);
    if (resolved.hasPdf && resolved.downloadLink) {
      window.open(resolved.downloadLink, '_blank', 'noopener,noreferrer');
    } else {
      if (window.confirm(`No direct PDF download link attached to quotation ${q.id}.\n\nWould you like to edit this quotation now to attach a Google Drive, OneDrive, or Cloud PDF link?`)) {
        handleStartEditQuote(q);
      }
    }
  };

  const handleShareQuote = (q: Quotation) => {
    const text = `Lakhi Airconditioners - Quotation ${q.id} for ${q.customerExternalName}\nTotal: ₹${q.totalAmount.toLocaleString('en-IN')}\nStatus: ${q.status}${q.pdfLink ? `\nView PDF: ${q.pdfLink}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedLink(q.id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const filteredQuotes = quotations.filter((q) => {
    const matchesSearch =
      q.id.toLowerCase().includes(search.toLowerCase()) ||
      q.customerExternalName.toLowerCase().includes(search.toLowerCase()) ||
      q.customerPhone.includes(search) ||
      q.items.some((it) => it.name.toLowerCase().includes(search.toLowerCase()) || it.modelNo.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            Quotations & Estimates (Q...)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-appliance quotes (AC, TV, Refrigerator, etc.). Status recorded as RECORDED or SENT.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-red-600/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          + Create New Quote
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Q-ID, customer, model..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {(['ALL', 'RECORDED', 'SENT'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3">Quote ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items & Models</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">PDF Link</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No quotations found. Click "+ Create New Quote" to create an estimate.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-red-600 dark:text-red-400">
                      {q.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">{q.customerExternalName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{q.customerPhone}</div>
                      {q.billingAddress && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{q.billingAddress}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {q.items.map((it, idx) => (
                          <div key={idx} className="text-slate-800 dark:text-slate-200">
                            <span className="font-bold">{it.quantity}x</span> {it.name || it.type} ({it.modelNo || 'Std'})
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      ₹{q.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={q.status}
                        onChange={(e) => updateQuotationStatus(q.id, e.target.value as 'RECORDED' | 'SENT')}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
                          q.status === 'SENT'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <option value="RECORDED">RECORDED</option>
                        <option value="SENT">SENT</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const links = resolvePdfLinks(q);
                        if (links.hasPdf) {
                          return (
                            <div className="space-y-1 text-[10px]">
                              <span className="font-bold uppercase tracking-wider text-slate-500 block text-[9px]">
                                {links.provider === 'google_drive'
                                  ? 'Google Drive'
                                  : links.provider === 'onedrive'
                                  ? 'OneDrive'
                                  : 'Cloud PDF'}
                              </span>
                              <div className="flex items-center gap-2">
                                <a
                                  href={links.viewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5 font-bold"
                                >
                                  <Eye className="w-2.5 h-2.5" /> View
                                </a>
                                {links.downloadLink && (
                                  <a
                                    href={links.downloadLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-bold"
                                  >
                                    <Download className="w-2.5 h-2.5" /> DL
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <button
                            onClick={() => handleStartEditQuote(q)}
                            className="text-slate-400 hover:text-red-600 text-[10px] underline"
                          >
                            + Link PDF
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handlePreviewPdf(q)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Preview PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(q)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEditQuote(q)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Quotation"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleShareQuote(q)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Share / Copy Details"
                        >
                          {copiedLink === q.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                        </button>
                        {onConvertToInvoice && (
                          <button
                            onClick={() => onConvertToInvoice(q)}
                            className="px-2.5 py-1 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 hover:text-white text-red-700 dark:text-red-400 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 ml-1"
                            title="Convert into Bill"
                          >
                            <span>Bill</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Quote Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl my-4 sm:my-8 overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">New Quotation / Estimate</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Deterministic Q... ID collision checked</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              {/* Customer Link & Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
                    Quotation Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={formQuoteDate}
                    onChange={(e) => setFormQuoteDate(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="Legal Customer Name"
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quote Status:
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'RECORDED' | 'SENT')}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="RECORDED">RECORDED</option>
                    <option value="SENT">SENT</option>
                  </select>
                </div>

                {/* Two Address Fields */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Billing Address(es):
                  </label>
                  <textarea
                    rows={2}
                    value={formBillingAddress}
                    onChange={(e) => setFormBillingAddress(e.target.value)}
                    placeholder="Customer Billing Address"
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
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
                  <textarea
                    rows={2}
                    value={formInstallationAddress}
                    onChange={(e) => setFormInstallationAddress(e.target.value)}
                    placeholder="Site / Delivery Installation Address"
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                {/* GSTIN Field */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store / Company GST Number:
                  </label>
                  <input
                    type="text"
                    value={formGstin}
                    onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AABCL9921L1Z4"
                    className="w-full text-xs font-mono uppercase px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Items Section: Multi-Product (AC, TV, Refrigerator, etc.) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Appliances / Line Items ({items.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200"
                  >
                    + Add Item
                  </button>
                </div>

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
                            placeholder="Sony, Daikin..."
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
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
                            id={`tax-inc-${index}`}
                            checked={item.isAmountWithTax}
                            onChange={(e) => handleItemChange(index, 'isAmountWithTax', e.target.checked)}
                            className="accent-red-600"
                          />
                          <label htmlFor={`tax-inc-${index}`} className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
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
                              title="Remove Line Item"
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

              {/* Cloud PDF Linking Selector */}
              <CloudPdfLinkSelector
                title="Quotation Cloud PDF Document"
                description="Link estimate PDF via Google Drive (auto ID), OneDrive, or direct cloud link."
                initialProvider={formPdfConfig.provider}
                initialDriveId={formPdfConfig.driveId}
                initialViewLink={formPdfConfig.viewLink}
                initialDownloadLink={formPdfConfig.downloadLink}
                onChange={(cfg) => setFormPdfConfig(cfg)}
              />

              {/* ID & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Optional Custom Quote ID:
                    </label>
                    {formCustomIdText && (
                      <button
                        type="button"
                        onClick={() => setFormCustomIdText(stripRandomSuffix(formCustomIdText))}
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
                    value={formCustomIdText}
                    onChange={(e) => setFormCustomIdText(e.target.value.toUpperCase())}
                    placeholder="e.g. PROJECT-A or QT-01 (Leave blank for pre-made ID)"
                    className="w-full text-xs font-mono uppercase px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />

                  {formCustomIdText.trim() ? (
                    <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                      {/* Toggles for ID letter and digits */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormIncludePrefixLetter(!formIncludePrefixLetter)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            formIncludePrefixLetter
                              ? 'bg-red-600 text-white border-red-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                          title="Turn ID Letter prefix (Q-) On or Off"
                        >
                          <Tag className="w-3 h-3" />
                          <span>ID Letter Prefix (Q-)</span>
                          <span className="text-[10px] font-black uppercase ml-0.5">
                            {formIncludePrefixLetter ? 'ON' : 'OFF'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormIncludeRandomDigits(!formIncludeRandomDigits)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            formIncludeRandomDigits
                              ? 'bg-red-600 text-white border-red-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                          title="Turn 4-digit code On or Off"
                        >
                          <Hash className="w-3 h-3" />
                          <span>Add 4 Digits</span>
                          <span className="text-[10px] font-black uppercase ml-0.5">
                            {formIncludeRandomDigits ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      </div>

                      {/* Preview of resulting ID */}
                      <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Resulting Quote ID:</span>
                        <span className="font-mono font-bold text-red-600 dark:text-red-400 text-xs">
                          {buildCustomIdPreview({
                            type: 'Q',
                            customText: formCustomIdText,
                            includePrefixLetter: formIncludePrefixLetter,
                            includeRandomDigits: formIncludeRandomDigits,
                          })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Pre-made Quote ID has ID letter &amp; digits ON. To customize, enter custom text above.
                    </p>
                  )}
                </div>

                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Terms:
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Delivery within 3 working days, standard warranty applies..."
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Total Summary Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Subtotal: ₹{subtotal.toLocaleString('en-IN')}</span>
                  <span className="text-slate-500 dark:text-slate-400 ml-3">Tax: ₹{taxAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 dark:text-slate-400">Total Estimate:</span>
                  <strong className="text-lg font-black text-red-600 dark:text-red-400 ml-2">
                    ₹{totalAmount.toLocaleString('en-IN')}
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
                  {isSubmitting ? 'Recording Quote...' : 'Record Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Quotation Modal */}
      {editingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl my-4 sm:my-8 overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] sm:max-h-[92vh]">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Edit Quotation: <span className="font-mono text-red-600">{editingQuotation.id}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Update customer details, quote line items, status, and cloud PDF link.
                </p>
              </div>
              <button
                onClick={() => setEditingQuotation(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedQuote} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs">
              {/* Customer Details & Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quotation Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={editQuoteDate}
                    onChange={(e) => setEditQuoteDate(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium"
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
                    type="tel"
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
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Installation Address:
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
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store / Company GST Number:
                  </label>
                  <input
                    type="text"
                    value={editGstin}
                    onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AABCL9921L1Z4"
                    className="w-full text-xs font-mono uppercase px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Cloud PDF Linking Selector */}
              <CloudPdfLinkSelector
                title="Quotation Cloud PDF Document"
                description="Link estimate PDF via Google Drive (auto ID), OneDrive, or direct cloud link."
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
                    Appliances / Line Items ({editItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddEditQuoteItem}
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
                            onChange={(e) => handleEditQuoteItemChange(index, 'type', e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
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
                            onChange={(e) => handleEditQuoteItemChange(index, 'brand', e.target.value)}
                            placeholder="Daikin..."
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Model No:
                          </label>
                          <input
                            type="text"
                            value={item.modelNo || ''}
                            onChange={(e) => handleEditQuoteItemChange(index, 'modelNo', e.target.value)}
                            placeholder="FTKF50..."
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Item Name:
                          </label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleEditQuoteItemChange(index, 'name', e.target.value)}
                            placeholder="Description..."
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Pricing row */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Qty:
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleEditQuoteItemChange(index, 'quantity', Number(e.target.value))}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Rate (₹):
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.rate}
                            onChange={(e) => handleEditQuoteItemChange(index, 'rate', Number(e.target.value))}
                            className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Tax %:
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.taxPercent}
                            onChange={(e) => handleEditQuoteItemChange(index, 'taxPercent', Number(e.target.value))}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 pb-1">
                          <input
                            type="checkbox"
                            id={`edit-tax-inc-${index}`}
                            checked={item.isAmountWithTax}
                            onChange={(e) => handleEditQuoteItemChange(index, 'isAmountWithTax', e.target.checked)}
                            className="accent-blue-600"
                          />
                          <label htmlFor={`edit-tax-inc-${index}`} className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            Incl. Tax
                          </label>
                        </div>

                        <div className="col-span-2 sm:col-span-1 flex items-center justify-between pb-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                          <div className="font-bold text-xs text-blue-600 dark:text-blue-400">
                            ₹{item.lineTotal.toLocaleString('en-IN')}
                          </div>
                          {editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEditQuoteItem(index)}
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

              {/* Status & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quote Status:
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'RECORDED' | 'SENT')}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="RECORDED">RECORDED (Draft in store)</option>
                    <option value="SENT">SENT (Provided to customer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Terms:
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Delivery terms, warranty notes..."
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingQuotation(null)}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingQuote}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Edit2 className="w-4 h-4" />
                  {isUpdatingQuote ? 'Saving Changes...' : 'Save Quotation Updates'}
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
        title="Quotation Estimate PDF"
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
