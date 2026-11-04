import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Zap,
  FileCheck2,
  Receipt,
  Boxes,
  Truck,
  Users,
  Scale,
  Clock,
  Palette,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Columns,
  HelpCircle,
  ShoppingBag,
  ArrowRight,
  CornerDownLeft,
  X,
  Keyboard,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'System';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  onOpenAiAssistant?: () => void;
  onOpenBrandModal?: () => void;
  onOpenShortcutsHelp?: () => void;
  onToggleLayout?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenAiAssistant,
  onOpenBrandModal,
  onOpenShortcutsHelp,
  onToggleLayout,
}) => {
  const { theme, toggleTheme, viewMode, setViewMode, isAdmin } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Define all searchable commands
  const allCommands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: 'nav-quick',
        category: 'Navigation',
        label: 'Quick Mode (POS Counter)',
        description: 'Fast-counter billing, quick quotes, stock & scanner',
        icon: Zap,
        shortcut: 'Alt+1',
        action: () => {
          onNavigateTab('quick');
          onClose();
        },
      },
      {
        id: 'nav-quotes',
        category: 'Navigation',
        label: 'Quotations & Estimates (Q...)',
        description: 'Create & send price quotations, convert to invoices',
        icon: FileCheck2,
        shortcut: 'Alt+2',
        action: () => {
          onNavigateTab('quotations');
          onClose();
        },
      },
      {
        id: 'nav-invoices',
        category: 'Navigation',
        label: 'Tax Invoices & Billing (I...)',
        description: 'GST tax bills, instant PDF download & print',
        icon: Receipt,
        shortcut: 'Alt+3',
        action: () => {
          onNavigateTab('invoices');
          onClose();
        },
      },
      {
        id: 'nav-inventory',
        category: 'Navigation',
        label: 'Store Stock & Godown (STK)',
        description: 'AC inventory, indoor/outdoor serials, barcode scans',
        icon: Boxes,
        shortcut: 'Alt+4',
        action: () => {
          onNavigateTab('inventory');
          onClose();
        },
      },
      {
        id: 'nav-sdbm-hub',
        category: 'Navigation',
        label: '⚡ SDBM Data Hub',
        description: 'Import/Export SDBM files, automatic bill & DIV sync (New format coming soon)',
        icon: Zap,
        shortcut: 'Alt+5',
        action: () => {
          onNavigateTab('sdbm_hub');
          onClose();
        },
      },
      {
        id: 'nav-shipments',
        category: 'Navigation',
        label: 'Deliveries & Tracking (D...)',
        description: 'Delivery challans, vehicles, driver assignments',
        icon: Truck,
        shortcut: 'Alt+6',
        action: () => {
          onNavigateTab('shipments');
          onClose();
        },
      },
      {
        id: 'nav-customers',
        category: 'Navigation',
        label: 'Customers & Ledger (C / T...)',
        description: 'Customer directory, ledger history & inflows',
        icon: Users,
        shortcut: 'Alt+7',
        action: () => {
          onNavigateTab('customers');
          onClose();
        },
      },
      {
        id: 'nav-khata',
        category: 'Navigation',
        label: 'Who Owes Who (Dues & Khata)',
        description: 'Customer balances, overdue payments & reminders',
        icon: Scale,
        shortcut: 'Alt+8',
        action: () => {
          onNavigateTab('khata');
          onClose();
        },
      },
      {
        id: 'nav-claims',
        category: 'Navigation',
        label: '72h Claims & Returns',
        description: 'Customer claims, replacements & approvals',
        icon: Clock,
        shortcut: 'Alt+9',
        action: () => {
          onNavigateTab('claims');
          onClose();
        },
      },
      {
        id: 'nav-brand',
        category: 'Navigation',
        label: 'Brand Logos & Artwork',
        description: 'Store logos, wordmark branding & invoice watermarks',
        icon: Palette,
        shortcut: 'Alt+0',
        action: () => {
          if (onOpenBrandModal) onOpenBrandModal();
          else onNavigateTab('branding');
          onClose();
        },
      },
      {
        id: 'nav-admins',
        category: 'Navigation',
        label: 'Admin Access UIDs',
        description: 'Manage authorized Google Firebase admin credentials',
        icon: ShieldCheck,
        shortcut: 'Alt+U',
        action: () => {
          onNavigateTab('admins');
          onClose();
        },
      },

      // Quick Actions
      {
        id: 'act-new-invoice',
        category: 'Actions',
        label: 'Create New Tax Invoice',
        description: 'Jump to Invoice Manager and prepare bill',
        icon: Receipt,
        shortcut: 'Alt+N',
        action: () => {
          onNavigateTab('invoices');
          onClose();
        },
      },
      {
        id: 'act-new-quote',
        category: 'Actions',
        label: 'Create New Quotation',
        description: 'Jump to Quote Builder and calculate AC estimate',
        icon: FileCheck2,
        shortcut: 'Alt+Q',
        action: () => {
          onNavigateTab('quotations');
          onClose();
        },
      },
      {
        id: 'act-ai-assistant',
        category: 'Actions',
        label: 'Open Lakhi AI Assistant',
        description: 'Voice or text AI prompt for stock, billing, quotes',
        icon: Sparkles,
        shortcut: 'Alt+A',
        action: () => {
          if (onOpenAiAssistant) onOpenAiAssistant();
          onClose();
        },
      },

      // System Toggles
      {
        id: 'sys-theme',
        category: 'System',
        label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        description: 'Toggle ERP interface between dark and light themes',
        icon: theme === 'dark' ? Sun : Moon,
        shortcut: 'Alt+T',
        action: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'sys-portal',
        category: 'System',
        label: viewMode === 'STAFF' ? 'Switch to Customer Storefront' : 'Switch to Staff Operations',
        description: 'Toggle between staff administrative view and storefront',
        icon: ShoppingBag,
        shortcut: 'Alt+P',
        action: () => {
          if (isAdmin) {
            setViewMode(viewMode === 'STAFF' ? 'CUSTOMER' : 'STAFF');
          }
          onClose();
        },
      },
      {
        id: 'sys-layout',
        category: 'System',
        label: 'Toggle Navigation Layout (Top Bar / Left Sidebar)',
        description: 'Switch between horizontal top navigation and vertical sidebar',
        icon: Columns,
        shortcut: 'Alt+L',
        action: () => {
          if (onToggleLayout) onToggleLayout();
          onClose();
        },
      },
      {
        id: 'sys-shortcuts',
        category: 'System',
        label: 'Keyboard Shortcuts Cheatsheet',
        description: 'View complete list of hotkeys, navigation and workflow keys',
        icon: Keyboard,
        shortcut: '?',
        action: () => {
          onClose();
          if (onOpenShortcutsHelp) onOpenShortcutsHelp();
        },
      },
    ];

    return list;
  }, [theme, toggleTheme, viewMode, setViewMode, isAdmin, onNavigateTab, onClose, onOpenAiAssistant, onOpenBrandModal, onOpenShortcutsHelp, onToggleLayout]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.shortcut?.toLowerCase().includes(q)
    );
  }, [query, allCommands]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Keyboard navigation within command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredCommands[selectedIndex];
      if (current) {
        current.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to module... (or press Esc to exit)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              ESC
            </kbd>
          )}
        </div>

        {/* Command Items List */}
        <div
          ref={listRef}
          className="p-2 overflow-y-auto space-y-1 flex-1 scrollbar-none divide-y divide-slate-100 dark:divide-slate-800/40"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
              No matching command found for "<span className="text-slate-600 dark:text-slate-200">{query}</span>"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-900/60'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm truncate">{cmd.label}</span>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800">
                        {cmd.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{cmd.description}</p>
                  </div>

                  {cmd.shortcut && (
                    <kbd
                      className={`text-[10px] font-mono font-bold px-2 py-1 rounded border shadow-2xs whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-white dark:bg-slate-900 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}

                  {isSelected && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0 ml-1" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] shadow-2xs">
                ↓
              </kbd>
              <span className="ml-0.5">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] shadow-2xs">
                ↵
              </kbd>
              <span className="ml-0.5">Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] shadow-2xs">
                ESC
              </kbd>
              <span className="ml-0.5">Close</span>
            </span>
          </div>

          <button
            onClick={() => {
              onClose();
              if (onOpenShortcutsHelp) onOpenShortcutsHelp();
            }}
            className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold hover:underline"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Shortcuts Cheatsheet (?)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
