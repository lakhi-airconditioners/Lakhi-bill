import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Wallet,
  Phone,
  MapPin,
  Lock,
  Edit2,
  Key,
  Check,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, PaymentMode, PaymentTreatment } from '../../types';
import { getYYYYMMDD } from '../../utils/idGenerator';
import { CustomerSelectBox } from '../common/CustomerSelectBox';
import { CustomerModal } from '../common/CustomerModal';
import { formatCurrency } from '../../utils/currencyHelper';

export const CustomerLedger: React.FC = () => {
  const { customers, transactions, invoices, addCustomer, recordPaymentForInvoice, changeCustomerPin } =
    useApp();

  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);

  // Staff Change PIN Modal State
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  // New Customer Form State
  const [formExternalName, setFormExternalName] = useState('');
  const [formInternalName, setFormInternalName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBillingAddress, setFormBillingAddress] = useState('');
  const [formInstallationAddress, setFormInstallationAddress] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formInitialBalance, setFormInitialBalance] = useState<number>(0);
  const [formCustomIdText, setFormCustomIdText] = useState('');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // New Transaction (T...) Form State (No preset values)
  const [txCustomerId, setTxCustomerId] = useState('');
  const [txInvoiceId, setTxInvoiceId] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txMode, setTxMode] = useState<PaymentMode>('UPI');
  const [txRefNo, setTxRefNo] = useState('');
  const [txBankDrawer, setTxBankDrawer] = useState('HDFC Bank');
  const [txTreatment, setTxTreatment] = useState<PaymentTreatment>('ADDED_TO_BALANCE');
  const [txNotes, setTxNotes] = useState('');
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0] || null;

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCustomer(true);
    try {
      const newId = await addCustomer(
        {
          externalName: formExternalName,
          internalName: formInternalName || 'Standard Client Note',
          phone: formPhone,
          email: formEmail,
          billingAddress: formBillingAddress,
          installationAddress: formInstallationAddress || formBillingAddress,
          accessPin: formPin || Math.floor(1000 + Math.random() * 9000).toString(),
          accountBalance: Number(formInitialBalance) || 0,
        },
        formCustomIdText || undefined
      );
      setSelectedCustomerId(newId);
      setTxCustomerId(newId); // Ensure active for any immediate transactions
      setIsAddCustomerOpen(false);
      resetCustomerForm();
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const resetCustomerForm = () => {
    setFormExternalName('');
    setFormInternalName('');
    setFormPhone('');
    setFormEmail('');
    setFormBillingAddress('');
    setFormInstallationAddress('');
    setFormPin('');
    setFormInitialBalance(0);
    setFormCustomIdText('');
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txCustomerId) return;

    setIsSubmittingTx(true);
    try {
      await recordPaymentForInvoice(
        txInvoiceId || '',
        Number(txAmount),
        txMode,
        txRefNo,
        txBankDrawer,
        txTreatment,
        txNotes || `Ledger payment for ${txCustomerId}`,
        txCustomerId
      );
      setIsAddTxOpen(false);
      setTxAmount(0);
      setTxRefNo('');
      setTxNotes('');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const customerTransactions = transactions.filter(
    (t) => selectedCustomer && t.customerId === selectedCustomer.id
  );

  const customerInvoices = invoices.filter(
    (i) => selectedCustomer && i.customerId === selectedCustomer.id
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.externalName.toLowerCase().includes(search.toLowerCase()) ||
      c.internalName.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600 dark:text-red-400" />
            Lakhi Customer Directory & Account Balance Pool
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dual names (Private internal notes vs Legal bill name) & store inflow ledger (T... Formula)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const activeId = selectedCustomer ? selectedCustomer.id : (customers[0]?.id || '');
              setTxCustomerId(activeId);
              setTxInvoiceId('');
              setTxTreatment('ADDED_TO_BALANCE');
              setIsAddTxOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <Wallet className="w-4 h-4" />
            + Record Ledger Trans (T...)
          </button>
          <button
            onClick={() => {
              resetCustomerForm();
              setIsAddCustomerOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-red-600/30"
          >
            <Plus className="w-4 h-4" />
            + New Customer (C...)
          </button>
        </div>
      </div>

      {/* Main Grid: Customer List + Active Ledger Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Directory List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs flex flex-col h-[750px]">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search legal name, internal notes, ID..."
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
            {filteredCustomers.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">No customers found.</div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{cust.externalName}</div>
                        <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                          Note: {cust.internalName}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-md">
                        {cust.id}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100/60 dark:border-slate-800/60">
                      <span className="text-slate-400">{cust.phone}</span>
                      <span
                        className={`font-black ${
                          cust.accountBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {cust.accountBalance >= 0 ? '+' : ''}₹{cust.accountBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer Detailed Profile & Ledger Pool */}
        {selectedCustomer ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md">
                      {selectedCustomer.id}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedCustomer.externalName}
                    </h3>
                  </div>
                  {/* Private Staff Notes */}
                  <div className="mt-1.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[10px] uppercase tracking-wider block text-amber-800 dark:text-amber-300">
                        Private Staff / Dealer Reference (Never shown to customer):
                      </strong>
                      <span>{selectedCustomer.internalName}</span>
                    </div>
                  </div>
                </div>

                {/* Account Balance Pool Badge */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-right min-w-[180px]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
                    Account Balance Pool
                  </span>
                  <div
                    className={`text-2xl font-black mt-0.5 ${
                      selectedCustomer.accountBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {selectedCustomer.accountBalance >= 0 ? '+' : ''}₹{selectedCustomer.accountBalance.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {selectedCustomer.accountBalance >= 0
                      ? '● Store Advance Credit'
                      : '● Total Receivables Due'}
                  </span>
                </div>
              </div>

              {/* Contact & Access PIN Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{selectedCustomer.billingAddress || selectedCustomer.installationAddress}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-mono">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Portal PIN: <strong>{selectedCustomer.accessPin}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsEditCustomerModalOpen(true)}
                      className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                      title="Edit Customer Profile Information"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPinInput('');
                        setPinChangeError('');
                        setPinChangeSuccess('');
                        setIsChangePinOpen(true);
                      }}
                      className="px-2 py-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Key className="w-3 h-3" />
                      Change PIN
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Inflow/Outflow Ledger Transactions Table (T... formula) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Store Inflow & Ledger Transactions (T...)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Real-time payment logs, UTR numbers, and invoice allocations
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTxCustomerId(selectedCustomer.id);
                    setIsAddTxOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold transition-colors"
                >
                  + Add Payment (T...)
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                    <tr>
                      <th className="px-4 py-2.5">Trans ID (T...)</th>
                      <th className="px-4 py-2.5">Mode & Bank</th>
                      <th className="px-4 py-2.5">Reference / UTR</th>
                      <th className="px-4 py-2.5">Treatment</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customerTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                          No transactions recorded for this customer yet.
                        </td>
                      </tr>
                    ) : (
                      customerTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {tx.id}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{tx.mode}</span>
                            <div className="text-[10px] text-slate-400">{tx.bankOrDrawer}</div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                            {tx.referenceNo || 'Counter Cash'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                tx.treatment === 'LINKED_TO_INVOICE'
                                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {tx.treatment === 'LINKED_TO_INVOICE' ? 'Direct Invoice Due' : 'Rolled to Balance'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-black text-emerald-600 dark:text-emerald-400">
                            +₹{tx.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">
                            {tx.createdAt.slice(0, 10)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoices Associated with this Customer */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-900 dark:text-white text-sm">
                Invoices History ({customerInvoices.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerInvoices.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">No invoices created yet.</div>
                ) : (
                  customerInvoices.map((inv) => (
                    <div key={inv.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div>
                        <span className="font-mono font-bold text-red-600 dark:text-red-400">{inv.id}</span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.items.length} AC item(s) • Total: ₹{inv.totalAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                          Due: ₹{inv.amountDue.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-400">
            Select a customer from the left directory to view full ledger and balance pool.
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-base">New Customer Record</h3>
              </div>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="p-3 bg-slate-900 text-white rounded-xl text-xs font-mono space-y-1">
                <div className="text-slate-400">Customer ID Formula:</div>
                <div className="text-red-400 font-bold">
                  C{formCustomIdText ? formCustomIdText.toUpperCase() : getYYYYMMDD()}XXXX
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Optional Custom Middle ID:
                </label>
                <input
                  type="text"
                  value={formCustomIdText}
                  onChange={(e) => setFormCustomIdText(e.target.value)}
                  placeholder="e.g. VIP-CORP or YYYYMMDD auto"
                  className="w-full text-xs font-mono uppercase px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  External Name (Legal name displayed on bills & customer portal):
                </label>
                <input
                  type="text"
                  required
                  value={formExternalName}
                  onChange={(e) => setFormExternalName(e.target.value)}
                  placeholder="e.g. Sharma Enterprises Pvt Ltd"
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-900 dark:text-amber-300 mb-1">
                  Internal Name (Private staff notes / dealer alias - never shown to customer):
                </label>
                <input
                  type="text"
                  required
                  value={formInternalName}
                  onChange={(e) => setFormInternalName(e.target.value)}
                  placeholder="e.g. Sharma Ji Project Alpha - Wholesale Contractor"
                  className="w-full text-xs px-3 py-2 border border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number:</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Portal Access PIN (4 Digits):</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    placeholder="e.g. 4102"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email (Optional):</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Advance Balance (₹):</label>
                  <input
                    type="number"
                    value={formInitialBalance}
                    onChange={(e) => setFormInitialBalance(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Billing Address:</label>
                <textarea
                  rows={2}
                  value={formBillingAddress}
                  onChange={(e) => setFormBillingAddress(e.target.value)}
                  placeholder="Official / Tax Billing Address"
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Installation / Delivery Address:</label>
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
                  placeholder="Site / Unit Delivery & Installation Location"
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {isSubmittingCustomer ? 'Saving...' : 'Create Customer (C...)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Inflow Transaction Modal (T... Formula) */}
      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 my-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-base">Record Store Inflow</h3>
              </div>
              <button
                onClick={() => setIsAddTxOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <CustomerSelectBox
                value={txCustomerId}
                onChange={(custId) => setTxCustomerId(custId)}
                label="Select Customer:"
                allowWalkIn={false}
                placeholder="Type name, phone number, or ID (e.g. 'g', '98...', 'C001')..."
                onOpenNewCustomer={(initialQuery) => {
                  if (initialQuery) {
                    const raw = initialQuery.trim();
                    const digitsOnly = raw.replace(/\D/g, '');
                    if (/^c\d+$/i.test(raw)) {
                      setFormCustomIdText(raw.toUpperCase());
                    } else if (digitsOnly.length >= 6) {
                      setFormPhone(raw);
                    } else {
                      setFormExternalName(raw);
                    }
                  }
                  setIsAddCustomerOpen(true);
                }}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Amount Inflow (₹):</label>
                <input
                  type="number"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mode:</label>
                  <select
                    value={txMode}
                    onChange={(e) => setTxMode(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  >
                    <option value="UPI">UPI Transfer</option>
                    <option value="CARD">Card POS</option>
                    <option value="CHEQUE_NEFT">Cheque / NEFT</option>
                    <option value="CASH">Cash Register</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Bank / Drawer:</label>
                  <input
                    type="text"
                    value={txBankDrawer}
                    onChange={(e) => setTxBankDrawer(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">UTR / Ref No / Slip:</label>
                <input
                  type="text"
                  value={txRefNo}
                  onChange={(e) => setTxRefNo(e.target.value)}
                  placeholder="e.g. UPI/2839102910"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Treatment:</label>
                <select
                  value={txTreatment}
                  onChange={(e) => {
                    const val = e.target.value as PaymentTreatment;
                    setTxTreatment(val);
                    if (val === 'ADDED_TO_BALANCE') {
                      setTxInvoiceId('');
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                >
                  <option value="ADDED_TO_BALANCE">Roll into Customer General Account Balance (ADDED_TO_BALANCE)</option>
                  <option value="LINKED_TO_INVOICE">Link Directly to Invoice</option>
                </select>
              </div>

              {txTreatment === 'LINKED_TO_INVOICE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Invoice:</label>
                  <select
                    value={txInvoiceId}
                    onChange={(e) => setTxInvoiceId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  >
                    <option value="">-- Choose Invoice --</option>
                    {invoices
                      .filter((i) => i.customerId === txCustomerId)
                      .map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.id} (Due: ₹{inv.amountDue})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTx}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {isSubmittingTx ? 'Recording...' : 'Record Transaction (T...)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal: Change Customer Access PIN */}
      {isChangePinOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 dark:bg-red-950/60 rounded-xl text-red-600 dark:text-red-400">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Change Portal Access PIN</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedCustomer.externalName} ({selectedCustomer.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePinOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPinChangeError('');
                setPinChangeSuccess('');
                setIsSubmittingPin(true);
                try {
                  const res = await changeCustomerPin(selectedCustomer.id, newPinInput);
                  if (res.success) {
                    setPinChangeSuccess(res.message);
                    setTimeout(() => {
                      setIsChangePinOpen(false);
                      setNewPinInput('');
                    }, 1200);
                  } else {
                    setPinChangeError(res.message);
                  }
                } finally {
                  setIsSubmittingPin(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <span className="text-slate-500 block mb-1">Current Stored PIN:</span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                  {selectedCustomer.accessPin}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New 4-Digit Numeric PIN:
                </label>
                <input
                  type="text"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 5821"
                  className="w-full text-center tracking-widest text-lg font-mono font-bold px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Must be exactly 4 digits. The customer will use this to sign in.
                </span>
              </div>

              {pinChangeError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-600 dark:text-red-300 flex items-center gap-1.5 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinChangeError}</span>
                </div>
              )}

              {pinChangeSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5 text-xs font-bold">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinChangeSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsChangePinOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPin || newPinInput.length !== 4}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm"
                >
                  {isSubmittingPin ? 'Saving PIN...' : 'Save New PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Customer Profile Modal */}
      {isEditCustomerModalOpen && selectedCustomer && (
        <CustomerModal
          isOpen={isEditCustomerModalOpen}
          onClose={() => setIsEditCustomerModalOpen(false)}
          customerToEdit={selectedCustomer}
        />
      )}
    </div>
  );
};
