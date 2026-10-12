import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Check,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  FileCheck2,
  User,
  Phone,
  MapPin,
  Barcode,
  Receipt,
  AlertCircle,
  HelpCircle,
  Eye,
  Send,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Quotation, QuotationItem } from '../../types';
import { parseQuotationWithAi, AiParsedQuotationDraft } from '../../utils/aiQuotationService';

interface AiQuotationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuotationCreated?: (quote: Quotation) => void;
}

export const AiQuotationBuilderModal: React.FC<AiQuotationBuilderModalProps> = ({
  isOpen,
  onClose,
  onQuotationCreated,
}) => {
  const { customers, addQuotation, gstNumber } = useApp();

  // Prompt state
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Draft review & confirmation state
  const [draft, setDraft] = useState<AiParsedQuotationDraft | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);

  // Reset when closing
  const handleClose = () => {
    setPromptInput('');
    setDraft(null);
    setIsGenerating(false);
    setGenerationError(null);
    setIsConfirming(false);
    setIsEditingDraft(false);
    onClose();
  };

  const samplePrompts = [
    {
      title: 'Daikin Dual AC with Serials',
      prompt:
        'Create quotation for Mr. Gautam Sharma, phone 9876543210, address Flat 402 Lake View Apartments. Items: 2 units of Daikin 1.5 Ton 5-Star Inverter Split AC (Model: FTKF50TV16U) with serial numbers DKN-88219 and DKN-88220 at rate Rs 46,500 each, plus 1 unit of Voltas 1 Ton Split AC at Rs 32,000. 18% GST included. Note: Includes 5 years compressor warranty and standard copper kit.',
    },
    {
      title: 'Voltas Multi-Split Package',
      prompt:
        'Quotation to Rahul Verma, mobile 9811223344, location Sector 15 Noida. 3x Voltas 1.5 Ton 3-Star Inverter Split AC (Model 183V Vectra, Serial: VOLT-771, VOLT-772, VOLT-773) at rate 34,900 each, and 1x outdoor heavy-duty mounting bracket set at 1,500 each. Total with 18% GST.',
    },
    {
      title: 'Quick WhatsApp Text Snippet',
      prompt:
        'Quote for client Priya Patel 9922001188: 1 AC Daikin 2 Ton 3 Star Model FTKM60 at 58000, serial SN-99881. Delivery within 2 days.',
    },
  ];

  const handleGenerate = async (textToUse?: string) => {
    const text = (textToUse || promptInput).trim();
    if (!text) {
      setGenerationError('Please enter quotation details or select a sample prompt.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const parsed = await parseQuotationWithAi(text);
      setDraft(parsed);

      // Auto-match existing customer by name or phone if present
      const matchedCust = customers.find(
        (c) =>
          c.externalName.toLowerCase().includes(parsed.customerName.toLowerCase()) ||
          (parsed.customerPhone && c.phone && c.phone.includes(parsed.customerPhone.slice(-6)))
      );
      if (matchedCust) {
        setSelectedCustomerId(matchedCust.id);
      } else {
        setSelectedCustomerId('');
      }
    } catch (err: any) {
      setGenerationError(err.message || 'Failed to parse quotation with AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate totals
  const calculateTotals = (items: AiParsedQuotationDraft['items']) => {
    let subtotal = 0;
    let taxTotal = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.rate) || 0;
      const taxPct = Number(item.taxPercent) || 18;

      if (item.isAmountWithTax) {
        const lineTotal = qty * rate;
        const taxable = lineTotal / (1 + taxPct / 100);
        const tax = lineTotal - taxable;
        subtotal += taxable;
        taxTotal += tax;
      } else {
        const taxable = qty * rate;
        const tax = taxable * (taxPct / 100);
        subtotal += taxable;
        taxTotal += tax;
      }
    });

    const grandTotal = Math.round(subtotal + taxTotal);
    return { subtotal, taxTotal, grandTotal };
  };

  // Final Confirmation & Creation
  const handleConfirmAndSave = async () => {
    if (!draft) return;
    setIsConfirming(true);

    try {
      const quoteItems: QuotationItem[] = draft.items.map((item, idx) => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.rate) || 0;
        const lineTotal = qty * rate;
        return {
          id: `item-${Date.now()}-${idx}`,
          name: item.name,
          modelNo: item.modelNo || 'INVERTER',
          type: item.type || 'AC',
          brand: item.brand || 'Daikin',
          quantity: qty,
          rate,
          taxPercent: item.taxPercent || 18,
          isAmountWithTax: item.isAmountWithTax ?? true,
          lineTotal,
        };
      });

      // Append serial numbers to notes if present
      const serialNotes = draft.items
        .filter((i) => i.serialNo)
        .map((i) => `${i.name} (SN: ${i.serialNo})`)
        .join(', ');

      const combinedNotes = [
        draft.notes || '',
        serialNotes ? `Equipment Serials: ${serialNotes}` : '',
        'Generated via Lakhi AI Smart Assistant',
      ]
        .filter(Boolean)
        .join(' | ');

      const { subtotal, taxTotal, grandTotal } = calculateTotals(draft.items);

      const quoteId = await addQuotation({
        customerId: selectedCustomerId || 'WALK-IN',
        customerExternalName: draft.customerName,
        customerPhone: draft.customerPhone || 'Not Provided',
        billingAddress: draft.billingAddress || '',
        installationAddress: draft.installationAddress || draft.billingAddress || '',
        gstNumber: gstNumber || '',
        items: quoteItems,
        subtotal: Math.round(subtotal),
        taxAmount: Math.round(taxTotal),
        totalAmount: grandTotal,
        status: 'RECORDED',
        notes: combinedNotes,
        pdfProvider: 'google_drive',
        pdfViewLink: '',
        pdfDownloadLink: '',
      });

      // Construct quote object for callback
      const newQuote: Quotation = {
        id: quoteId,
        customerId: selectedCustomerId || 'WALK-IN',
        customerExternalName: draft.customerName,
        customerPhone: draft.customerPhone || '',
        billingAddress: draft.billingAddress || '',
        installationAddress: draft.installationAddress || '',
        gstNumber: gstNumber || '',
        items: quoteItems,
        subtotal: Math.round(subtotal),
        taxAmount: Math.round(taxTotal),
        status: 'RECORDED',
        totalAmount: grandTotal,
        notes: combinedNotes,
        pdfProvider: 'google_drive',
        pdfViewLink: '',
        pdfDownloadLink: '',
        createdAt: new Date().toISOString(),
      };

      if (onQuotationCreated) {
        onQuotationCreated(newQuote);
      }

      handleClose();
    } catch (err: any) {
      alert('Error creating quotation: ' + (err.message || 'Unknown error'));
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-red-600 to-amber-500 text-white rounded-xl shadow-xs">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                <span>AI Fast Quotation Generator</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                  Gemini 3.8
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paste natural speech, customer notes, or WhatsApp text to automatically build and confirm a quote
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {!draft ? (
            /* STEP 1: PROMPT INPUT VIEW */
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Describe Quotation Details (Customer Name, Equipment, Serials, Rates):
                </label>
                <textarea
                  rows={5}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="e.g. Quotation for Gautam Sharma, phone 9876543210, address Flat 402 Lake View Apartments: 2 Daikin 1.5 Ton 5 Star Split ACs model FTKF50 (serials DKN881 and DKN882) at 46500 each, plus 1 Voltas 1 Ton at 32000. 18% GST included, 5 years compressor warranty..."
                  className="w-full text-xs p-3.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl focus:ring-2 focus:ring-red-500 outline-none leading-relaxed"
                />
              </div>

              {/* Sample Prompts Pills */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  Try a quick sample:
                </span>
                <div className="flex flex-wrap gap-2">
                  {samplePrompts.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPromptInput(s.prompt);
                        handleGenerate(s.prompt);
                      }}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-all border border-slate-200/80 dark:border-slate-700/80"
                    >
                      + {s.title}
                    </button>
                  ))}
                </div>
              </div>

              {generationError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{generationError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isGenerating || !promptInput.trim()}
                  onClick={() => handleGenerate()}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-red-600/20 flex items-center gap-2 transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Parsing with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate & Review Quote</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: PREVIEW & CONFIRMATION VIEW (REQUIRED BY USER: "show me before and ask for my confirmation") */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* Notice Banner */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-center justify-between text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="font-bold">
                    Quotation draft generated by AI. Please review and confirm before saving.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingDraft(!isEditingDraft)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-bold border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  {isEditingDraft ? 'Done Editing' : 'Edit Details'}
                </button>
              </div>

              {/* Customer Information Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-red-600" />
                    Customer Details
                  </span>
                  {selectedCustomerId && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Linked: {selectedCustomerId}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Customer Name:
                    </label>
                    {isEditingDraft ? (
                      <input
                        type="text"
                        value={draft.customerName}
                        onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg font-bold"
                      />
                    ) : (
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {draft.customerName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Phone Number:
                    </label>
                    {isEditingDraft ? (
                      <input
                        type="text"
                        value={draft.customerPhone || ''}
                        onChange={(e) => setDraft({ ...draft, customerPhone: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg font-bold"
                      />
                    ) : (
                      <div className="font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {draft.customerPhone || 'Not Provided'}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Address:
                    </label>
                    {isEditingDraft ? (
                      <input
                        type="text"
                        value={draft.billingAddress || ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            billingAddress: e.target.value,
                            installationAddress: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg"
                      />
                    ) : (
                      <div className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{draft.billingAddress || 'Shop Counter / Walk-in'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Products & Serial Numbers Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Receipt className="w-3 h-3 text-red-600" />
                    Quotation Line Items & Serial Numbers ({draft.items.length})
                  </span>
                  {isEditingDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          ...draft,
                          items: [
                            ...draft.items,
                            {
                              name: 'Daikin 1.5 Ton Split AC',
                              modelNo: 'FTKF50',
                              brand: 'Daikin',
                              type: 'AC',
                              serialNo: '',
                              quantity: 1,
                              rate: 45000,
                              taxPercent: 18,
                              isAmountWithTax: true,
                            },
                          ],
                        });
                      }}
                      className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      + Add Item
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {draft.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.rate;
                    return (
                      <div key={idx} className="p-3.5 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300">
                                #{idx + 1}
                              </span>
                              {isEditingDraft ? (
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => {
                                    const next = [...draft.items];
                                    next[idx].name = e.target.value;
                                    setDraft({ ...draft, items: next });
                                  }}
                                  className="font-bold border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 flex-1"
                                />
                              ) : (
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {item.name}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>
                                Brand: <strong>{item.brand || 'Daikin'}</strong>
                              </span>
                              <span>
                                Model:{' '}
                                <strong className="font-mono">{item.modelNo || 'INVERTER'}</strong>
                              </span>
                              {item.serialNo && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-bold flex items-center gap-1">
                                  <Barcode className="w-3 h-3" />
                                  SN: {item.serialNo}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-black text-slate-900 dark:text-white text-sm">
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {item.quantity} × ₹{item.rate.toLocaleString('en-IN')} (incl. {item.taxPercent}%)
                            </span>
                          </div>
                        </div>

                        {/* Inline Edit Inputs if in editing mode */}
                        {isEditingDraft && (
                          <div className="grid grid-cols-4 gap-2 pt-1 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                            <div>
                              <label className="block text-[10px] text-slate-400">Qty</label>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const next = [...draft.items];
                                  next[idx].quantity = Number(e.target.value);
                                  setDraft({ ...draft, items: next });
                                }}
                                className="w-full px-2 py-1 border rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">Rate (₹)</label>
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(e) => {
                                  const next = [...draft.items];
                                  next[idx].rate = Number(e.target.value);
                                  setDraft({ ...draft, items: next });
                                }}
                                className="w-full px-2 py-1 border rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">Serial No</label>
                              <input
                                type="text"
                                value={item.serialNo || ''}
                                onChange={(e) => {
                                  const next = [...draft.items];
                                  next[idx].serialNo = e.target.value;
                                  setDraft({ ...draft, items: next });
                                }}
                                placeholder="SN..."
                                className="w-full px-2 py-1 border rounded font-mono"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = draft.items.filter((_, i) => i !== idx);
                                  setDraft({ ...draft, items: next });
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grand Total Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Estimated Grand Total
                    </span>
                    <span className="text-xl font-black text-red-600 dark:text-red-400">
                      ₹{calculateTotals(draft.items).grandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <span>Tax: ₹{Math.round(calculateTotals(draft.items).taxTotal).toLocaleString('en-IN')} (18% GST)</span>
                  </div>
                </div>
              </div>

              {/* Notes Card */}
              {draft.notes && (
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200">
                  <strong>Notes & Terms:</strong> {draft.notes}
                </div>
              )}

              {/* CONFIRMATION BUTTONS */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  ← Modify Prompt
                </button>

                <div className="w-full sm:w-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 sm:flex-none px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    disabled={isConfirming || draft.items.length === 0}
                    onClick={handleConfirmAndSave}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Quotation...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Create Quotation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
