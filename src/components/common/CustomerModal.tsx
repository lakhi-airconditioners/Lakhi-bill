import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, X, Check, Phone, MapPin, Lock, User, Scissors, Tag, Hash } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { stripRandomSuffix, buildCustomIdPreview, formatCustomIdValue } from '../../utils/idGenerator';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If customerToEdit is provided, it acts in Edit mode; otherwise in Add mode
  customerToEdit?: Customer | null;
  // Search query from customer selector to prefill (name, phone, or custom ID)
  initialQuery?: string;
  // Called with the newly added or updated Customer
  onSaved?: (customer: Customer) => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customerToEdit,
  initialQuery,
  onSaved,
}) => {
  const { addCustomer, updateCustomer, customers } = useApp();

  const isEdit = !!customerToEdit;

  const [externalName, setExternalName] = useState('');
  const [internalName, setInternalName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [accessPin, setAccessPin] = useState('');
  const [customIdText, setCustomIdText] = useState('');
  const [includePrefixLetter, setIncludePrefixLetter] = useState(true);
  const [includeRandomDigits, setIncludeRandomDigits] = useState(false);
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customerToEdit) {
      setExternalName(customerToEdit.externalName || '');
      setInternalName(customerToEdit.internalName || '');
      setPhone(customerToEdit.phone || '');
      setEmail(customerToEdit.email || '');
      setBillingAddress(customerToEdit.billingAddress || '');
      setInstallationAddress(customerToEdit.installationAddress || customerToEdit.billingAddress || '');
      setAccessPin(customerToEdit.accessPin || '');
      setInitialBalance(customerToEdit.accountBalance || 0);
      setCustomIdText('');
      setIncludePrefixLetter(true);
      setIncludeRandomDigits(false);
    } else {
      let initName = '';
      let initPhone = '';
      let initId = '';

      if (initialQuery && initialQuery.trim()) {
        const raw = initialQuery.trim();
        const digitsOnly = raw.replace(/\D/g, '');
        if (/^c\d+$/i.test(raw)) {
          initId = raw.toUpperCase();
        } else if (digitsOnly.length >= 6 && /^[0-9+\s\-()]+$/.test(raw)) {
          initPhone = raw;
        } else {
          initName = raw;
        }
      }

      setExternalName(initName);
      setInternalName('');
      setPhone(initPhone);
      setEmail('');
      setBillingAddress('');
      setInstallationAddress('');
      setAccessPin(Math.floor(1000 + Math.random() * 9000).toString());
      setInitialBalance(0);
      setCustomIdText(initId);
      setIncludePrefixLetter(true);
      setIncludeRandomDigits(false);
    }
    setError('');
  }, [customerToEdit, isOpen, initialQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!externalName.trim()) {
      setError('Customer Legal Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Contact Phone is required.');
      return;
    }
    if (accessPin && !/^\d{4}$/.test(accessPin.trim())) {
      setError('PIN must be 4 digits numeric.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && customerToEdit) {
        const updatedFields: Partial<Customer> = {
          externalName: externalName.trim(),
          internalName: internalName.trim() || 'Client',
          phone: phone.trim(),
          email: email.trim(),
          billingAddress: billingAddress.trim(),
          installationAddress: (installationAddress.trim() || billingAddress.trim()),
          accessPin: accessPin.trim() || customerToEdit.accessPin,
        };
        await updateCustomer(customerToEdit.id, updatedFields);
        const updatedCustomer: Customer = {
          ...customerToEdit,
          ...updatedFields,
        };
        if (onSaved) onSaved(updatedCustomer);
        onClose();
      } else {
        const pinToUse = accessPin.trim() || Math.floor(1000 + Math.random() * 9000).toString();
        const customCodeToUse = customIdText.trim()
          ? formatCustomIdValue({
              type: 'C',
              customText: customIdText,
              includePrefixLetter,
              includeRandomDigits,
            })
          : undefined;

        const newId = await addCustomer(
          {
            externalName: externalName.trim(),
            internalName: internalName.trim() || 'Client',
            phone: phone.trim(),
            email: email.trim(),
            billingAddress: billingAddress.trim(),
            installationAddress: (installationAddress.trim() || billingAddress.trim()),
            accessPin: pinToUse,
            accountBalance: Number(initialBalance) || 0,
          },
          customCodeToUse
        );

        // Find or synthesize customer object to pass back to caller
        const newCustomer: Customer = {
          id: newId,
          externalName: externalName.trim(),
          internalName: internalName.trim() || 'Client',
          phone: phone.trim(),
          email: email.trim(),
          billingAddress: billingAddress.trim(),
          installationAddress: (installationAddress.trim() || billingAddress.trim()),
          accessPin: pinToUse,
          accountBalance: Number(initialBalance) || 0,
          createdAt: new Date().toISOString(),
        };

        if (onSaved) onSaved(newCustomer);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save customer record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg my-4 overflow-hidden border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl">
              {isEdit ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                {isEdit ? 'Edit Customer Details' : 'Add New Customer Profile'}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {isEdit && customerToEdit ? `ID: ${customerToEdit.id}` : 'Deterministic C... ID assigned'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-600 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Legal Customer Name: *
              </label>
              <input
                type="text"
                required
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                placeholder="e.g. Ramesh Kumar Patel"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mobile Phone: *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91..."
                className="w-full font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Internal Staff Notes / Alias:
              </label>
              <input
                type="text"
                value={internalName}
                onChange={(e) => setInternalName(e.target.value)}
                placeholder="e.g. Patel Brothers Construction"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Billing Address:
            </label>
            <input
              type="text"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder="Full billing address"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Installation / Site Address:
              </label>
              <button
                type="button"
                onClick={() => setInstallationAddress(billingAddress)}
                className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline"
              >
                📋 Same as billing
              </button>
            </div>
            <input
              type="text"
              value={installationAddress}
              onChange={(e) => setInstallationAddress(e.target.value)}
              placeholder="Delivery / AC installation site"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                4-Digit Portal Access PIN:
              </label>
              <input
                type="text"
                maxLength={4}
                required
                value={accessPin}
                onChange={(e) => setAccessPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4 digits"
                className="w-full font-mono font-bold tracking-wider px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            {!isEdit ? (
              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Custom Customer ID:
                  </label>
                  {customIdText && (
                    <button
                      type="button"
                      onClick={() => setCustomIdText(stripRandomSuffix(customIdText))}
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
                  value={customIdText}
                  onChange={(e) => setCustomIdText(e.target.value.toUpperCase())}
                  placeholder="e.g. SHARMA or CUST-101 (Leave blank for pre-made ID)"
                  className="w-full text-xs font-mono uppercase px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />

                {customIdText.trim() ? (
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                    {/* Toggles for ID letter and digits */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIncludePrefixLetter(!includePrefixLetter)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          includePrefixLetter
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                        title="Turn ID Letter prefix (C-) On or Off"
                      >
                        <Tag className="w-3 h-3" />
                        <span>ID Letter Prefix (C-)</span>
                        <span className="text-[10px] font-black uppercase ml-0.5">
                          {includePrefixLetter ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeRandomDigits(!includeRandomDigits)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          includeRandomDigits
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                        title="Turn 4-digit code On or Off"
                      >
                        <Hash className="w-3 h-3" />
                        <span>Add 4 Digits</span>
                        <span className="text-[10px] font-black uppercase ml-0.5">
                          {includeRandomDigits ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>

                    {/* Preview of resulting ID */}
                    <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Resulting Custom ID:</span>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400 text-xs">
                        {buildCustomIdPreview({
                          type: 'C',
                          customText: customIdText,
                          includePrefixLetter,
                          includeRandomDigits,
                        })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pre-made ID has ID letter &amp; digits ON. To customize, enter custom text above.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Balance Pool:
                </label>
                <div className="font-bold text-sm text-slate-900 dark:text-white pt-2">
                  ₹{customerToEdit?.accountBalance?.toLocaleString('en-IN') || 0}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm shadow-red-600/30 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Customer' : 'Save & Select Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
