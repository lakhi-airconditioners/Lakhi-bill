import React, { useState } from 'react';
import {
  Scale,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Plus,
  CheckCircle2,
  Phone,
  MessageSquare,
  Wallet,
  Clock,
  Trash2,
  Edit2,
  FileText,
  Building,
  User,
  AlertTriangle,
  X,
  CreditCard,
  IndianRupee,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PayableRecord, PaymentMode, Invoice } from '../../types';

export const DuesKhataManager: React.FC = () => {
  const {
    customers,
    invoices,
    payables,
    addPayable,
    updatePayable,
    deletePayable,
    settlePayable,
    recordPaymentForInvoice,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'ALL' | 'THEY_OWE_US' | 'WE_OWE_THEM'>('ALL');
  const [search, setSearch] = useState('');

  // Add / Edit Payable Modal State
  const [isAddPayableOpen, setIsAddPayableOpen] = useState(false);
  const [editingPayable, setEditingPayable] = useState<PayableRecord | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [category, setCategory] = useState<PayableRecord['category']>('SUPPLIER_STOCK');
  const [amount, setAmount] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [billReference, setBillReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settle Payable Modal State
  const [settlingPayable, setSettlingPayable] = useState<PayableRecord | null>(null);
  const [settleMode, setSettleMode] = useState<PaymentMode>('UPI');
  const [settleRef, setSettleRef] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  // Quick Inflow Payment Modal (when customer pays)
  const [collectingCustomer, setCollectingCustomer] = useState<{
    customerId: string;
    customerName: string;
    customerPhone: string;
    invoiceId?: string;
    dueAmount: number;
  } | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMode, setCollectMode] = useState<PaymentMode>('UPI');
  const [collectRef, setCollectRef] = useState('');
  const [collectBank, setCollectBank] = useState('HDFC Bank');
  const [collectNotes, setCollectNotes] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  // 1. CALCULATE RECEIVABLES (THEY HAVE TO PAY US)
  // Group unpaid invoices by customer
  const unpaidInvoices = invoices.filter(
    (inv) => (inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIAL') && (inv.amountDue || 0) > 0
  );

  // Build customer receivables map
  interface CustomerReceivableSummary {
    customerId: string;
    customerName: string;
    customerInternalName?: string;
    customerPhone: string;
    totalInvoiced: number;
    totalPrepaid: number;
    totalAmountDue: number;
    pendingInvoices: Invoice[];
  }

  const customerReceivablesMap = new Map<string, CustomerReceivableSummary>();

  // Include customers with unpaid invoices
  unpaidInvoices.forEach((inv) => {
    const custId = inv.customerId;
    const existing = customerReceivablesMap.get(custId);
    const custObj = customers.find((c) => c.id === custId);
    if (!existing) {
      customerReceivablesMap.set(custId, {
        customerId: custId,
        customerName: inv.customerExternalName || custObj?.externalName || 'Walk-in Customer',
        customerInternalName: custObj?.internalName,
        customerPhone: inv.customerPhone || custObj?.phone || '',
        totalInvoiced: inv.totalAmount,
        totalPrepaid: inv.totalPrepaid,
        totalAmountDue: inv.amountDue,
        pendingInvoices: [inv],
      });
    } else {
      existing.totalInvoiced += inv.totalAmount;
      existing.totalPrepaid += inv.totalPrepaid;
      existing.totalAmountDue += inv.amountDue;
      existing.pendingInvoices.push(inv);
    }
  });

  // Also include customers who have a negative balance in their account
  customers.forEach((c) => {
    if (c.accountBalance < 0 && !customerReceivablesMap.has(c.id)) {
      const debtAmount = Math.abs(c.accountBalance);
      customerReceivablesMap.set(c.id, {
        customerId: c.id,
        customerName: c.externalName,
        customerInternalName: c.internalName,
        customerPhone: c.phone,
        totalInvoiced: debtAmount,
        totalPrepaid: 0,
        totalAmountDue: debtAmount,
        pendingInvoices: [],
      });
    }
  });

  const customerReceivablesList = Array.from(customerReceivablesMap.values());
  const totalReceivables = customerReceivablesList.reduce((sum, item) => sum + item.totalAmountDue, 0);

  // 2. CALCULATE PAYABLES (WE HAVE TO PAY THEM)
  // A) Vendor / Supplier payables from payables collection (status PENDING)
  const pendingVendorPayables = payables.filter((p) => p.status === 'PENDING');
  const totalVendorPayables = pendingVendorPayables.reduce((sum, p) => sum + (p.amount || 0), 0);

  // B) Customer credit balances (customers who paid excess advance or have positive account balance)
  const customerCreditBalances = customers.filter((c) => c.accountBalance > 0);
  const totalCustomerCredits = customerCreditBalances.reduce((sum, c) => sum + c.accountBalance, 0);

  const totalPayables = totalVendorPayables + totalCustomerCredits;
  const netPosition = totalReceivables - totalPayables;

  // Filtered lists based on search
  const filteredReceivables = customerReceivablesList.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(q) ||
      (item.customerInternalName && item.customerInternalName.toLowerCase().includes(q)) ||
      item.customerId.toLowerCase().includes(q) ||
      item.customerPhone.includes(q) ||
      item.pendingInvoices.some((i) => i.id.toLowerCase().includes(q))
    );
  });

  const filteredVendorPayables = payables.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.vendorName.toLowerCase().includes(q) ||
      (p.vendorPhone && p.vendorPhone.includes(q)) ||
      (p.billReference && p.billReference.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    );
  });

  const filteredCustomerCredits = customerCreditBalances.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.externalName.toLowerCase().includes(q) ||
      c.internalName.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  // Handlers for Add/Edit Payable
  const handleOpenAddPayable = () => {
    setEditingPayable(null);
    setVendorName('');
    setVendorPhone('');
    setCategory('SUPPLIER_STOCK');
    setAmount('');
    setDueDate('');
    setBillReference('');
    setNotes('');
    setIsAddPayableOpen(true);
  };

  const handleOpenEditPayable = (p: PayableRecord) => {
    setEditingPayable(p);
    setVendorName(p.vendorName);
    setVendorPhone(p.vendorPhone || '');
    setCategory(p.category);
    setAmount(p.amount);
    setDueDate(p.dueDate || '');
    setBillReference(p.billReference || '');
    setNotes(p.notes || '');
    setIsAddPayableOpen(true);
  };

  const handleSavePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !amount || Number(amount) <= 0) return;
    setIsSubmitting(true);
    try {
      if (editingPayable) {
        await updatePayable(editingPayable.id, {
          vendorName: vendorName.trim(),
          vendorPhone: vendorPhone.trim(),
          category,
          amount: Number(amount),
          dueDate: dueDate || undefined,
          billReference: billReference.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await addPayable({
          vendorName: vendorName.trim(),
          vendorPhone: vendorPhone.trim() || undefined,
          category,
          amount: Number(amount),
          dueDate: dueDate || undefined,
          billReference: billReference.trim() || undefined,
          notes: notes.trim() || undefined,
          status: 'PENDING',
        });
      }
      setIsAddPayableOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettlePayableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingPayable) return;
    setIsSettling(true);
    try {
      await settlePayable(settlingPayable.id, settleMode, settleRef.trim());
      setSettlingPayable(null);
      setSettleRef('');
    } finally {
      setIsSettling(false);
    }
  };

  const handleCollectInflowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingCustomer || collectAmount <= 0) return;
    setIsCollecting(true);
    try {
      const invId = collectingCustomer.invoiceId || '';
      await recordPaymentForInvoice(
        invId,
        collectAmount,
        collectMode,
        collectRef.trim(),
        collectBank,
        invId ? 'LINKED_TO_INVOICE' : 'ADDED_TO_BALANCE',
        collectNotes.trim() || `Payment collection for ${collectingCustomer.customerName}`
      );
      setCollectingCustomer(null);
      setCollectAmount(0);
      setCollectRef('');
      setCollectNotes('');
    } finally {
      setIsCollecting(false);
    }
  };

  const generateWhatsAppReminder = (summary: CustomerReceivableSummary) => {
    const cleanPhone = summary.customerPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const invList = summary.pendingInvoices.map((i) => `${i.id} (₹${i.amountDue.toLocaleString('en-IN')})`).join(', ');
    const text = encodeURIComponent(
      `Namaste ${summary.customerName},\n\nThis is a gentle payment reminder from Lakhi Airconditioners & Electronics.\n\n` +
      `Your pending balance is: ₹${summary.totalAmountDue.toLocaleString('en-IN')}\n` +
      (invList ? `Pending Invoices: ${invList}\n\n` : '\n') +
      `Kindly arrange the payment at your earliest convenience or contact us at +91 99980 21446 if you have any questions.\n\nThank you!`
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-red-600 dark:text-red-400" />
            Khata & Outstanding Records (Who We Have To Pay vs Who Owes Us)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time dual balance ledger: Unpaid customer bills (Receivables) and vendor/creditor payables.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAddPayable}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            + Record Party We Owe (Payable)
          </button>
        </div>
      </div>

      {/* KPI Cards: Net Position, Receivables, Payables */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: They Have To Pay Us */}
        <div
          onClick={() => setActiveTab('THEY_OWE_US')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'THEY_OWE_US'
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft className="w-4 h-4" />
              They Have To Pay Us (Receivables)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
              {customerReceivablesList.length} Parties
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-2">
            ₹{totalReceivables.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across {unpaidInvoices.length} unpaid / partial invoices
          </div>
        </div>

        {/* Card 2: We Have To Pay Them */}
        <div
          onClick={() => setActiveTab('WE_OWE_THEM')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'WE_OWE_THEM'
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" />
              We Have To Pay (Payables & Dues)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
              {pendingVendorPayables.length + customerCreditBalances.length} Records
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            ₹{totalPayables.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            ₹{totalVendorPayables.toLocaleString('en-IN')} vendors • ₹{totalCustomerCredits.toLocaleString('en-IN')} customer advances
          </div>
        </div>

        {/* Card 3: Net Balance Position */}
        <div
          onClick={() => setActiveTab('ALL')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'ALL'
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-4 h-4" />
              Net Outstanding Position
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              Khata Net
            </span>
          </div>
          <div
            className={`text-2xl font-black mt-2 ${
              netPosition >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {netPosition >= 0 ? '+' : ''}₹{netPosition.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {netPosition >= 0 ? 'Net Inflow receivable to store' : 'Net Outflow payable to parties'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Khata
          </button>
          <button
            onClick={() => setActiveTab('THEY_OWE_US')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              activeTab === 'THEY_OWE_US'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            They Have To Pay Us ({customerReceivablesList.length})
          </button>
          <button
            onClick={() => setActiveTab('WE_OWE_THEM')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              activeTab === 'WE_OWE_THEM'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            We Have To Pay ({pendingVendorPayables.length + customerCreditBalances.length})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party name, phone, invoice..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
      </div>

      {/* SECTION 1: THEY HAVE TO PAY US (CUSTOMER RECEIVABLES) */}
      {(activeTab === 'ALL' || activeTab === 'THEY_OWE_US') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  They Have To Pay Us (Customer Dues & Pending Invoices)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Customers with unpaid invoice balances or debit accounts
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-medium">Subtotal Due</span>
              <span className="text-base font-black text-rose-600 dark:text-rose-400">
                ₹{totalReceivables.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredReceivables.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No outstanding customer dues found. All bills are settled!
              </div>
            ) : (
              filteredReceivables.map((summary) => (
                <div key={summary.customerId} className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Customer Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {summary.customerName}
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-bold">
                          {summary.customerId}
                        </span>
                      </div>
                      {summary.customerInternalName && (
                        <div className="text-xs text-red-600 dark:text-red-400 font-semibold">
                          Internal Note: {summary.customerInternalName}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 font-mono">
                        Phone: {summary.customerPhone || 'Not recorded'}
                      </div>
                    </div>

                    {/* Pending Invoices List */}
                    <div className="space-y-1 flex-1 lg:max-w-md">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Pending Invoices ({summary.pendingInvoices.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.pendingInvoices.map((inv) => (
                          <span
                            key={inv.id}
                            className="font-mono text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900 px-2 py-0.5 rounded-lg flex items-center gap-1"
                          >
                            <span>{inv.id}:</span>
                            <span className="font-bold">₹{inv.amountDue.toLocaleString('en-IN')} due</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center justify-between lg:justify-end gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-left lg:text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Total Due To Collect
                        </span>
                        <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                          ₹{summary.totalAmountDue.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* WhatsApp Due Reminder */}
                        {summary.customerPhone && (
                          <a
                            href={generateWhatsAppReminder(summary)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                            title="Send WhatsApp Payment Reminder"
                          >
                            <MessageSquare className="w-4 h-4 text-emerald-600" />
                            <span className="hidden sm:inline">Remind</span>
                          </a>
                        )}

                        {/* Call Customer */}
                        {summary.customerPhone && (
                          <a
                            href={`tel:${summary.customerPhone}`}
                            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                            title="Call Customer"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}

                        {/* Collect Payment Button */}
                        <button
                          onClick={() => {
                            setCollectingCustomer({
                              customerId: summary.customerId,
                              customerName: summary.customerName,
                              customerPhone: summary.customerPhone,
                              invoiceId: summary.pendingInvoices[0]?.id,
                              dueAmount: summary.totalAmountDue,
                            });
                            setCollectAmount(summary.totalAmountDue);
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                        >
                          <Wallet className="w-4 h-4" />
                          Collect ₹
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: WE HAVE TO PAY THEM (VENDOR PAYABLES & CUSTOMER ADVANCES) */}
      {(activeTab === 'ALL' || activeTab === 'WE_OWE_THEM') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-0">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  We Have To Pay (Vendors, Suppliers, Contractors & Customer Credits)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Parties Lakhi Airconditioners owes money or advance credits to
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-medium">Subtotal Payable</span>
              <span className="text-base font-black text-amber-600 dark:text-amber-400">
                ₹{totalPayables.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Subpart A: Customer Credit Advances */}
          {filteredCustomerCredits.length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Customer Advances & Credit Balances (We owe goods or refund) ({filteredCustomerCredits.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {filteredCustomerCredits.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{c.externalName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{c.id} • {c.phone}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Credit Bal</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        ₹{c.accountBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subpart B: Vendor / Supplier Payables Table */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredVendorPayables.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No recorded vendor payables. Click "+ Record Party We Owe" to log supplier dues, transport freight, or contractor dues.
              </div>
            ) : (
              filteredVendorPayables.map((p) => {
                const isPaid = p.status === 'PAID';
                return (
                  <div
                    key={p.id}
                    className={`p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                      isPaid ? 'opacity-60 bg-slate-50/30' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Vendor Details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white text-sm">
                            {p.vendorName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {p.status}
                          </span>
                          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                            {p.category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {p.billReference && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                            Ref: {p.billReference}
                          </div>
                        )}
                        {p.notes && (
                          <div className="text-xs text-slate-500 italic">
                            {p.notes}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.vendorPhone && <span>Phone: {p.vendorPhone} • </span>}
                          {p.dueDate && <span>Target Due: {p.dueDate} • </span>}
                          <span>Created: {p.createdAt.slice(0, 10)}</span>
                        </div>
                      </div>

                      {/* Amount & Settle Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Amount We Owe
                          </span>
                          <span
                            className={`text-lg font-black ${
                              isPaid ? 'text-slate-500 line-through' : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            ₹{p.amount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => {
                                setSettlingPayable(p);
                                setSettleRef('');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Settle (Paid)
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditPayable(p)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Payable"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete payable record for ${p.vendorName}?`)) {
                                deletePayable(p.id);
                              }
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT PAYABLE RECORD (PARTY WE OWE) */}
      {isAddPayableOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-amber-600" />
                {editingPayable ? 'Edit Party Payable Record' : 'Record Party We Have To Pay'}
              </h3>
              <button
                onClick={() => setIsAddPayableOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayable} className="space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor / Party Name (Who We Have To Pay): *
                </label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Daikin India / Ramesh Technician / Delivery Logistics"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount We Owe (₹): *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="Amount in Rupees"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="SUPPLIER_STOCK">Supplier Stock / Consignment</option>
                    <option value="LABOR_INSTALLATION">Installation / Labor Wages</option>
                    <option value="FREIGHT_DELIVERY">Freight / Transportation</option>
                    <option value="CUSTOMER_REFUND">Customer Advance Refund</option>
                    <option value="UTILITY_RENT">Shop Rent / Utilities</option>
                    <option value="OTHER">Other Expenses</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Party Phone (Optional):
                  </label>
                  <input
                    type="text"
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Due Date:
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bill / Order Reference No (Optional):
                </label>
                <input
                  type="text"
                  value={billReference}
                  onChange={(e) => setBillReference(e.target.value)}
                  placeholder="e.g. PO-8492 / Invoice #9283"
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Particulars:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details of the consignment or work done..."
                  className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPayableOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : editingPayable ? 'Update Payable' : 'Record Payable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SETTLE PAYABLE (WE PAID THE VENDOR) */}
      {settlingPayable && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Settle / Mark Payable as Paid
              </h3>
              <button
                onClick={() => setSettlingPayable(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">{settlingPayable.vendorName}</div>
              <div className="text-amber-800 dark:text-amber-300 font-black text-sm mt-0.5">
                Paying: ₹{settlingPayable.amount.toLocaleString('en-IN')}
              </div>
            </div>

            <form onSubmit={handleSettlePayableSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode:
                </label>
                <select
                  value={settleMode}
                  onChange={(e) => setSettleMode(e.target.value as any)}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none"
                >
                  <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                  <option value="CHEQUE_NEFT">Bank NEFT / RTGS / Cheque</option>
                  <option value="CASH">Cash Drawer Outflow</option>
                  <option value="CARD">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reference No / UTR / Cheque No:
                </label>
                <input
                  type="text"
                  value={settleRef}
                  onChange={(e) => setSettleRef(e.target.value)}
                  placeholder="e.g. UTR #109284729103"
                  className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSettlingPayable(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettling}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  {isSettling ? 'Recording...' : 'Confirm Settle (Mark Paid)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COLLECT CUSTOMER PAYMENT (THEY PAID US) */}
      {collectingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                Collect Customer Due Payment
              </h3>
              <button
                onClick={() => setCollectingCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {collectingCustomer.customerName} ({collectingCustomer.customerId})
              </div>
              <div className="text-rose-700 dark:text-rose-300 font-bold mt-0.5">
                Pending Balance: ₹{collectingCustomer.dueAmount.toLocaleString('en-IN')}
                {collectingCustomer.invoiceId && ` • Invoice: ${collectingCustomer.invoiceId}`}
              </div>
            </div>

            <form onSubmit={handleCollectInflowSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Received (₹): *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  className="w-full text-xs font-bold px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Mode:
                  </label>
                  <select
                    value={collectMode}
                    onChange={(e) => setCollectMode(e.target.value as any)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card POS</option>
                    <option value="CHEQUE_NEFT">Bank NEFT/Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Receiving Bank / Drawer:
                  </label>
                  <input
                    type="text"
                    value={collectBank}
                    onChange={(e) => setCollectBank(e.target.value)}
                    placeholder="HDFC / Cash Drawer"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reference No / UTR:
                </label>
                <input
                  type="text"
                  value={collectRef}
                  onChange={(e) => setCollectRef(e.target.value)}
                  placeholder="e.g. UPI Ref / Cheque #"
                  className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCollectingCustomer(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCollecting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  {isCollecting ? 'Recording...' : 'Record Payment Inflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
