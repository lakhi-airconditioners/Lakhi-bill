import React, { useEffect } from 'react';
import {
  Keyboard,
  X,
  Zap,
  Receipt,
  FileCheck2,
  Boxes,
  Truck,
  Users,
  Scale,
  Clock,
  Sparkles,
  Sun,
  Columns,
  Search,
  CornerDownLeft,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutSections = [
    {
      title: '🚀 Direct Module Jump (Press Alt + Number or Number)',
      description: 'Quickly switch between ERP operational screens with zero mouse clicks',
      shortcuts: [
        { keys: ['Alt', '1'], singleKey: '1', label: '⚡ Quick Mode (POS Counter)', icon: Zap },
        { keys: ['Alt', '2'], singleKey: '2', label: 'Quotations & Estimates (Q...)', icon: FileCheck2 },
        { keys: ['Alt', '3'], singleKey: '3', label: 'Tax Invoices & Billing (I...)', icon: Receipt },
        { keys: ['Alt', '4'], singleKey: '4', label: 'Store Stock & Godown (STK)', icon: Boxes },
        { keys: ['Alt', '5'], singleKey: '5', label: '⚡ LA-D Data Hub', icon: Zap },
        { keys: ['Alt', '6'], singleKey: '6', label: 'Deliveries & Tracking (D...)', icon: Truck },
        { keys: ['Alt', '7'], singleKey: '7', label: 'Customers & Ledger (C / T...)', icon: Users },
        { keys: ['Alt', '8'], singleKey: '8', label: 'Who Owes Who (Dues & Khata)', icon: Scale },
        { keys: ['Alt', '9'], singleKey: '9', label: '72h Claims & Returns', icon: Clock },
        { keys: ['Alt', '0'], singleKey: '0', label: 'Brand Logos & Artwork', icon: Boxes },
        { keys: ['Alt', 'U'], label: 'Admin Access UIDs', icon: Users },
      ],
    },
    {
      title: '⚡ Fast Actions & Workflows',
      description: 'Trigger primary business tasks from anywhere in the app',
      shortcuts: [
        { keys: ['Ctrl', 'K'], altKeys: ['⌘', 'K'], label: 'Open Command Palette & Global Search' },
        { keys: ['/'], label: 'Focus Module Search Filter in Navigation' },
        { keys: ['Alt', 'N'], label: 'Jump to Invoices to create new bill' },
        { keys: ['Alt', 'Q'], label: 'Jump to Quotations to calculate estimate' },
        { keys: ['Alt', 'A'], altKeys: ['Ctrl', 'J'], label: 'Open Lakhi AI ERP Assistant' },
      ],
    },
    {
      title: '🖥️ System Controls & Navigation Layout',
      description: 'Customize your workspace layout and interface',
      shortcuts: [
        { keys: ['Alt', 'L'], label: 'Toggle Navigation Layout (Top Bar ↔ Left Sidebar)' },
        { keys: ['Alt', 'T'], label: 'Toggle Theme (Light Mode ↔ Dark Mode)' },
        { keys: ['Alt', 'P'], label: 'Switch Portal (Staff Operations ↔ Customer Storefront)' },
        { keys: ['?'], label: 'Toggle This Keyboard Shortcuts Cheatsheet' },
        { keys: ['Esc'], label: 'Close Active Modal, Drawer, or Cancel Search' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Keyboard-Only Controls & Shortcuts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Operate the entire Lakhi Airconditioners ERP with your keyboard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 scrollbar-none">
          {shortcutSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {section.title}
                </h3>
                <p className="text-[11px] text-slate-400">{section.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {section.shortcuts.map((sc, scIdx) => (
                  <div
                    key={scIdx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs gap-2"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {sc.label}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-[10px] shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}

                      {sc.altKeys && (
                        <>
                          <span className="text-slate-400 text-[10px]">or</span>
                          {sc.altKeys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-2 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-[10px] shadow-2xs"
                            >
                              {k}
                            </kbd>
                          ))}
                        </>
                      )}

                      {sc.singleKey && (
                        <span className="hidden lg:inline text-[10px] text-slate-400 font-mono ml-1">
                          (or {sc.singleKey})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Pro-Tip Banner */}
          <div className="p-3.5 bg-linear-to-r from-red-50 to-indigo-50 dark:from-red-950/30 dark:to-indigo-950/30 rounded-2xl border border-red-200/60 dark:border-red-900/40 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-bold text-red-600 dark:text-red-400">💡 Pro-Tip:</span> While not typing inside text inputs, simply pressing numbers <span className="font-mono font-bold">1</span> through <span className="font-mono font-bold">9</span> will instantly jump between modules! Press <span className="font-mono font-bold">Ctrl+K</span> to bring up the full command bar at any moment.
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border font-mono">ESC</kbd> to return</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
