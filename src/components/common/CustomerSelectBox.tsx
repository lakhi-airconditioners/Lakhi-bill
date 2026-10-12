import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  User,
  Phone,
  Plus,
  Edit2,
  X,
  Check,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';

export interface CustomerSelectBoxProps {
  value: string; // Customer ID or ''
  onChange: (customerId: string, customer?: Customer | null) => void;
  label?: string;
  allowWalkIn?: boolean;
  walkInLabel?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  onOpenNewCustomer?: (initialQuery?: string) => void;
  onOpenEditCustomer?: (customer: Customer) => void;
  showBalances?: boolean;
  compact?: boolean;
}

export const CustomerSelectBox: React.FC<CustomerSelectBoxProps> = ({
  value,
  onChange,
  label = 'Select Customer:',
  allowWalkIn = true,
  walkInLabel = '-- Manual / Walk-in Customer --',
  placeholder = 'Type name, phone number, or ID (e.g. "g", "98...", "C001")...',
  className = '',
  required = false,
  onOpenNewCustomer,
  onOpenEditCustomer,
  showBalances = true,
  compact = false,
}) => {
  const { customers } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [autoOpenCountdown, setAutoOpenCountdown] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const countdownTimerRef = useRef<any>(null);

  // Find currently selected customer
  const selectedCustomer = customers.find((c) => c.id === value) || null;

  // Filter customers by name, phone, or id (case-insensitive substring)
  const query = searchQuery.trim().toLowerCase();
  const filteredCustomers = customers.filter((c) => {
    if (!query) return true;
    const nameMatch = (c.externalName || '').toLowerCase().includes(query);
    const internalNameMatch = (c.internalName || '').toLowerCase().includes(query);
    const idMatch = (c.id || '').toLowerCase().includes(query);
    const phoneRaw = (c.phone || '').toLowerCase();
    const phoneDigits = phoneRaw.replace(/\D/g, '');
    const queryDigits = query.replace(/\D/g, '');
    const phoneMatch = phoneRaw.includes(query) || (queryDigits.length > 0 && phoneDigits.includes(queryDigits));
    return nameMatch || internalNameMatch || idMatch || phoneMatch;
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTypingMode(false);
        cancelCountdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      cancelCountdown();
    };
  }, []);

  const cancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setAutoOpenCountdown(null);
  };

  // Auto-trigger countdown when a search query is entered that matches 0 customers
  useEffect(() => {
    if (!isOpen || !onOpenNewCustomer) {
      cancelCountdown();
      return;
    }

    if (query.length > 0 && filteredCustomers.length === 0) {
      // Start 2-second countdown to automatically open new customer entry
      setAutoOpenCountdown(2);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      let timeLeft = 2;
      countdownTimerRef.current = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          cancelCountdown();
          setIsOpen(false);
          setIsTypingMode(false);
          onOpenNewCustomer(searchQuery.trim());
        } else {
          setAutoOpenCountdown(timeLeft);
        }
      }, 1000);
    } else {
      cancelCountdown();
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [query, filteredCustomers.length, isOpen]);

  const handleSelect = (c: Customer) => {
    cancelCountdown();
    onChange(c.id, c);
    setSearchQuery('');
    setIsOpen(false);
    setIsTypingMode(false);
  };

  const handleSelectWalkIn = () => {
    cancelCountdown();
    onChange('', null);
    setSearchQuery('');
    setIsOpen(false);
    setIsTypingMode(false);
  };

  const triggerOpenNewCustomer = () => {
    cancelCountdown();
    setIsOpen(false);
    setIsTypingMode(false);
    if (onOpenNewCustomer) {
      onOpenNewCustomer(searchQuery.trim() || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      cancelCountdown();
      setIsOpen(false);
      setIsTypingMode(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCustomers.length === 1) {
        handleSelect(filteredCustomers[0]);
      } else if (filteredCustomers.length === 0 && onOpenNewCustomer) {
        triggerOpenNewCustomer();
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label & Header Actions */}
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
          <div className="flex items-center gap-1.5">
            {selectedCustomer && onOpenEditCustomer && (
              <button
                type="button"
                onClick={() => onOpenEditCustomer(selectedCustomer)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                title="Edit customer profile details"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            )}
            {onOpenNewCustomer && (
              <button
                type="button"
                onClick={() => {
                  cancelCountdown();
                  onOpenNewCustomer(searchQuery.trim() || undefined);
                }}
                className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
                title="Register a new customer profile"
              >
                <Plus className="w-3 h-3" />
                + New Customer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Box: Selected Customer Display OR Search Input */}
      {selectedCustomer && !isTypingMode ? (
        <div
          onClick={() => {
            setIsTypingMode(true);
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="group cursor-pointer w-full text-xs px-3 py-2 border border-blue-300 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 text-slate-900 dark:text-white rounded-xl flex items-center justify-between hover:border-blue-400 transition-all shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 px-1.5 py-0.5 bg-blue-600 text-white font-mono font-bold text-[10px] rounded-md tracking-wider">
              {selectedCustomer.id}
            </span>
            <div className="truncate">
              <span className="font-bold text-slate-900 dark:text-white">
                {selectedCustomer.externalName}
              </span>
              {selectedCustomer.phone && (
                <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-1.5">
                  ({selectedCustomer.phone})
                </span>
              )}
              {showBalances && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Bal: ₹{selectedCustomer.accountBalance ?? 0}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsTypingMode(true);
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100"
            >
              Change
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('', null);
                setSearchQuery('');
              }}
              className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40"
              title="Clear customer selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => {
                setIsOpen(true);
                setIsTypingMode(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              required={required && !value}
              className={`w-full text-xs pl-9 pr-8 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all ${
                isOpen ? 'ring-2 ring-red-500/30 border-red-500' : ''
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  cancelCountdown();
                }}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dropdown Suggestions List */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
          {/* Quick Header Hint */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>
              {query ? `Results matching "${searchQuery}"` : 'Quick Customer Selection'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Type Name, Phone or ID (e.g. &apos;g&apos;)
            </span>
          </div>

          {/* Walk-in Customer Option */}
          {allowWalkIn && (!query || 'manual walk-in walk in'.includes(query)) && (
            <button
              type="button"
              onClick={handleSelectWalkIn}
              className={`w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center justify-between text-xs transition-colors ${
                !value ? 'bg-amber-50/60 dark:bg-amber-950/20 font-bold text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{walkInLabel}</span>
              </div>
              {!value && <Check className="w-3.5 h-3.5 text-amber-600" />}
            </button>
          )}

          {/* Filtered Customer Matches */}
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((c) => {
              const isSelected = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px]">
                        {c.id}
                      </span>
                      <span className="font-bold truncate text-slate-900 dark:text-white">
                        {c.externalName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" />
                          {c.phone}
                        </span>
                      )}
                      {showBalances && (
                        <span>Bal: ₹{c.accountBalance ?? 0}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    {isSelected ? (
                      <Check className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            /* No matching customers found -> Auto-open Alert & Trigger */
            <div className="p-4 text-center space-y-3 bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>No customer found matching &quot;{searchQuery}&quot;</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
                No existing records match this name, phone, or ID.
              </p>

              {onOpenNewCustomer && (
                <div className="pt-1 space-y-2">
                  {autoOpenCountdown !== null && (
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 py-1 px-2.5 rounded-lg border border-amber-200 dark:border-amber-900">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Auto-opening New Customer form in {autoOpenCountdown}s...</span>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={triggerOpenNewCustomer}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add &quot;{searchQuery}&quot; as New Customer
                    </button>
                    {autoOpenCountdown !== null && (
                      <button
                        type="button"
                        onClick={cancelCountdown}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom quick action bar */}
          {onOpenNewCustomer && filteredCustomers.length > 0 && query && (
            <div className="p-2 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Not the one you are looking for?</span>
              <button
                type="button"
                onClick={triggerOpenNewCustomer}
                className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add &quot;{searchQuery}&quot; as New Customer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
