import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { QuickMode } from './components/staff/QuickMode';
import { QuotationManager } from './components/staff/QuotationManager';
import { InvoiceManager } from './components/staff/InvoiceManager';
import { InventoryGodown } from './components/staff/InventoryGodown';
import { ShipmentTracker } from './components/staff/ShipmentTracker';
import { CustomerLedger } from './components/staff/CustomerLedger';
import { ClaimApprovals } from './components/staff/ClaimApprovals';
import { AdminUidManager } from './components/staff/AdminUidManager';
import { DuesKhataManager } from './components/staff/DuesKhataManager';
import { CustomerPortal } from './components/customer/CustomerPortal';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { Quotation, Invoice } from './types';
import { BrandLogoManager } from './components/staff/BrandLogoManager';
import { BrandLogoModal } from './components/common/BrandLogoModal';
import { TallyPrimeManager } from './components/staff/TallyPrimeManager';
import { StaffNavigation } from './components/staff/StaffNavigation';
import {
  Zap,
  FileCheck2,
  Receipt,
  Boxes,
  Truck,
  Users,
  Clock,
  ShieldCheck,
  Scale,
  Sparkles,
  Palette,
  FileSpreadsheet,
} from 'lucide-react';
import { LakhiLogo } from './components/common/LakhiLogo';
import { generateInvoicePdf, generateQuotationPdf } from './utils/pdfGenerator';
import { resolvePdfLinks } from './utils/cloudPdfHelper';
import { PdfPreviewModal } from './components/common/PdfPreviewModal';
import { AiAssistantDrawer } from './components/common/AiAssistantDrawer';
import { CommandPaletteModal } from './components/common/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal';
import { StaffDataLoaderOverlay } from './components/staff/StaffDataLoaderOverlay';

function MainApp() {
  const { viewMode, claims, theme, toggleTheme, setViewMode, isAdmin, invoices, quotations, gstNumber } = useApp();

  // Navigation tab for staff - Quick Mode is first tab as requested
  const [activeStaffTab, setActiveStaffTab] = useState<string>('quick');
  const [showStaffLoader, setShowStaffLoader] = useState<boolean>(true);
  const [navLayoutMode, setNavLayoutMode] = useState<'top' | 'sidebar'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lakhi_staff_nav_layout');
      if (saved === 'sidebar' || saved === 'top') return saved;
    }
    return 'top';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lakhi_staff_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  const handleToggleLayoutMode = (mode: 'top' | 'sidebar') => {
    setNavLayoutMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakhi_staff_nav_layout', mode);
    }
  };

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lakhi_staff_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Cross-workflow state passing
  const [quoteToConvert, setQuoteToConvert] = useState<Quotation | null>(null);
  const [invoiceToShip, setInvoiceToShip] = useState<Invoice | null>(null);
  const [stockItemToBill, setStockItemToBill] = useState<any | null>(null);

  // Direct URL View Modal (for shared invoice or quote links)
  const [directPreviewUrl, setDirectPreviewUrl] = useState<string | null>(null);
  const [directPreviewTitle, setDirectPreviewTitle] = useState('');
  const [directPreviewFilename, setDirectPreviewFilename] = useState('');
  const [isDirectPreviewOpen, setIsDirectPreviewOpen] = useState(false);

  // Global Keyboard Navigation & Hotkeys Handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Command Palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        setIsShortcutsModalOpen(false);
        return;
      }

      // 2. Escape: Dismiss open modals/drawers
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
        if (isAiDrawerOpen) {
          setIsAiDrawerOpen(false);
          return;
        }
        if (isBrandModalOpen) {
          setIsBrandModalOpen(false);
          return;
        }
        if (isDirectPreviewOpen) {
          setIsDirectPreviewOpen(false);
          return;
        }
      }

      // Check if user is typing in a form input, textarea, select, or contentEditable
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 3. Alt+ Shortcuts (Global ERP hotkeys)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === '1') {
          e.preventDefault();
          setActiveStaffTab('quick');
        } else if (key === '2') {
          e.preventDefault();
          setActiveStaffTab('quotations');
        } else if (key === '3') {
          e.preventDefault();
          setActiveStaffTab('invoices');
        } else if (key === '4') {
          e.preventDefault();
          setActiveStaffTab('inventory');
        } else if (key === '5') {
          e.preventDefault();
          setActiveStaffTab('sdbm_hub');
        } else if (key === '6') {
          e.preventDefault();
          setActiveStaffTab('shipments');
        } else if (key === '7') {
          e.preventDefault();
          setActiveStaffTab('customers');
        } else if (key === '8') {
          e.preventDefault();
          setActiveStaffTab('khata');
        } else if (key === '9') {
          e.preventDefault();
          setActiveStaffTab('claims');
        } else if (key === '0') {
          e.preventDefault();
          setIsBrandModalOpen(true);
        } else if (key === 'u') {
          e.preventDefault();
          setActiveStaffTab('admins');
        } else if (key === 'n') {
          e.preventDefault();
          setActiveStaffTab('invoices');
        } else if (key === 'q') {
          e.preventDefault();
          setActiveStaffTab('quotations');
        } else if (key === 'a') {
          e.preventDefault();
          setIsAiDrawerOpen((prev) => !prev);
        } else if (key === 't') {
          e.preventDefault();
          toggleTheme();
        } else if (key === 'p') {
          e.preventDefault();
          if (isAdmin) {
            setViewMode(viewMode === 'STAFF' ? 'CUSTOMER' : 'STAFF');
          }
        } else if (key === 'l') {
          e.preventDefault();
          handleToggleLayoutMode(navLayoutMode === 'top' ? 'sidebar' : 'top');
        }
        return;
      }

      // 4. Ctrl+J for Lakhi AI Assistant
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAiDrawerOpen((prev) => !prev);
        return;
      }

      // 5. Bare keys (only when NOT typing inside an input)
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '?') {
          e.preventDefault();
          setIsShortcutsModalOpen((prev) => !prev);
          setIsCommandPaletteOpen(false);
          return;
        }

        // Direct number keys 1-9 for instant module jump
        if (viewMode === 'STAFF' && isAdmin) {
          const numMap: Record<string, string> = {
            '1': 'quick',
            '2': 'quotations',
            '3': 'invoices',
            '4': 'inventory',
            '5': 'sdbm_hub',
            '6': 'shipments',
            '7': 'customers',
            '8': 'khata',
            '9': 'claims',
            '0': 'branding',
          };
          if (numMap[e.key]) {
            e.preventDefault();
            setActiveStaffTab(numMap[e.key]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsModalOpen,
    isAiDrawerOpen,
    isBrandModalOpen,
    isDirectPreviewOpen,
    viewMode,
    isAdmin,
    navLayoutMode,
    toggleTheme,
    setViewMode,
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const invoiceId = params.get('invoice') || params.get('inv');
      const quoteId = params.get('quote') || params.get('q');

      if (invoiceId) {
        const found = invoices.find((i) => i.id === invoiceId);
        if (found) {
          const links = resolvePdfLinks(found);
          if (links.hasPdf && links.embedLink) {
            setDirectPreviewUrl(links.embedLink);
            setDirectPreviewFilename(`${found.id}-TaxInvoice.pdf`);
            setDirectPreviewTitle(`Tax Invoice: ${found.id}`);
            setIsDirectPreviewOpen(true);
          } else {
            const { url, filename } = generateInvoicePdf(found, found.gstNumber || gstNumber);
            setDirectPreviewUrl(url);
            setDirectPreviewFilename(filename);
            setDirectPreviewTitle(`Tax Invoice: ${found.id}`);
            setIsDirectPreviewOpen(true);
          }
        }
      } else if (quoteId) {
        const found = quotations.find((q) => q.id === quoteId);
        if (found) {
          const links = resolvePdfLinks(found);
          if (links.hasPdf && links.embedLink) {
            setDirectPreviewUrl(links.embedLink);
            setDirectPreviewFilename(`${found.id}-Quotation.pdf`);
            setDirectPreviewTitle(`Quotation: ${found.id}`);
            setIsDirectPreviewOpen(true);
          } else {
            const { url, filename } = generateQuotationPdf(found, found.gstNumber || gstNumber);
            setDirectPreviewUrl(url);
            setDirectPreviewFilename(filename);
            setDirectPreviewTitle(`Quotation: ${found.id}`);
            setIsDirectPreviewOpen(true);
          }
        }
      }
    }
  }, [invoices, quotations, gstNumber]);

  const pendingClaimsCount = claims.filter((c) => c.status === 'PENDING').length;

  const handleConvertToInvoice = (quote: Quotation) => {
    setQuoteToConvert(quote);
    setActiveStaffTab('invoices');
  };

  const handleShipInvoice = (inv: Invoice) => {
    setInvoiceToShip(inv);
    setActiveStaffTab('shipments');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        onOpenClaimsModal={() => setActiveStaffTab('claims')}
        onOpenAiAssistant={() => setIsAiDrawerOpen(true)}
        onOpenBrandModal={() => setIsBrandModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
      />

      {/* Staff Operations: strictly visible only for authorized Admins */}
      {viewMode === 'STAFF' && isAdmin ? (
        <>
          {showStaffLoader && (
            <StaffDataLoaderOverlay onDismiss={() => setShowStaffLoader(false)} />
          )}
          <div
            className={`flex-1 w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6 ${
              navLayoutMode === 'sidebar'
                ? 'max-w-[1600px] flex flex-col md:flex-row gap-4 sm:gap-6 items-start'
                : 'max-w-7xl space-y-4 sm:space-y-6'
            }`}
          >
          {/* Staff Navigation Bar / Sidebar with Grouped Categories & Layout Modes */}
          <StaffNavigation
            activeTab={activeStaffTab}
            onSelectTab={(tab) => setActiveStaffTab(tab)}
            pendingClaimsCount={pendingClaimsCount}
            layoutMode={navLayoutMode}
            onToggleLayoutMode={handleToggleLayoutMode}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebarCollapse={handleToggleSidebarCollapse}
            onOpenAiAssistant={() => setIsAiDrawerOpen(true)}
          />

          {/* Active Staff Tab Component Content */}
          <main className="flex-1 w-full min-w-0">
            {activeStaffTab === 'quick' && (
              <QuickMode
                onNavigateTab={(tab) => setActiveStaffTab(tab)}
                onConvertToInvoice={handleConvertToInvoice}
                onShipInvoice={handleShipInvoice}
                onOpenAiAssistant={() => setIsAiDrawerOpen(true)}
                onOpenBarcodeScanner={() => setActiveStaffTab('inventory')}
              />
            )}

            {activeStaffTab === 'quotations' && (
              <QuotationManager onConvertToInvoice={handleConvertToInvoice} />
            )}

            {activeStaffTab === 'invoices' && (
              <InvoiceManager
                initialQuoteToConvert={quoteToConvert}
                onClearInitialQuote={() => setQuoteToConvert(null)}
                initialStockItemToBill={stockItemToBill}
                onClearInitialStock={() => setStockItemToBill(null)}
                onOpenNewShipmentForInvoice={handleShipInvoice}
              />
            )}

            {activeStaffTab === 'inventory' && (
              <InventoryGodown
                onBillItem={(item) => {
                  setStockItemToBill(item);
                  setActiveStaffTab('invoices');
                }}
              />
            )}

            {(activeStaffTab === 'sdbm_hub' || activeStaffTab === 'lead_hub') && <TallyPrimeManager />}

            {activeStaffTab === 'shipments' && (
              <ShipmentTracker
                initialInvoiceToShip={invoiceToShip}
                onClearInitialInvoice={() => setInvoiceToShip(null)}
              />
            )}

            {activeStaffTab === 'customers' && <CustomerLedger />}

            {activeStaffTab === 'khata' && <DuesKhataManager />}

            {activeStaffTab === 'claims' && <ClaimApprovals />}

            {activeStaffTab === 'branding' && <BrandLogoManager />}

            {activeStaffTab === 'admins' && <AdminUidManager />}
          </main>
        </div>
        </>
      ) : (
        <div className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6">
          <CustomerPortal />
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto py-6 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LakhiLogo size="sm" variant="icon" themeInvert={theme === 'dark'} />
            <div>
              <span className="font-bold text-slate-900 dark:text-white">Lakhi Airconditioners</span>
              <span className="text-slate-500 dark:text-slate-400 ml-2">
                • Contact: <a href="tel:+919998021446" className="font-bold text-red-600 dark:text-red-400 hover:underline">+91 99980 21446</a> • Timings: 11:00 AM – 7:00 PM (Mon – Fri, Closed Sat & Sun)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-[11px] font-mono flex-wrap">
            <span>[Type] + [YYYYMMDD] + [4-Digit]</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● Cloud Firestore Online</span>
          </div>
        </div>
      </footer>

      {/* Floating Lakhi AI Button (Quick Access from Any Screen) */}
      {viewMode === 'STAFF' && isAdmin && (
        <button
          onClick={() => setIsAiDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-linear-to-r from-red-600 via-rose-600 to-indigo-600 hover:from-red-700 hover:to-indigo-700 text-white rounded-full font-bold shadow-xl shadow-red-500/30 hover:scale-105 active:scale-95 transition-all group"
          title="Open Lakhi AI Assistant (Voice or Text)"
          aria-label="Open Lakhi AI Assistant"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-black tracking-wide pr-1">Lakhi AI</span>
        </button>
      )}

      {/* AI Assistant Drawer (Staff Access Admin Only) */}
      {viewMode === 'STAFF' && isAdmin && (
        <AiAssistantDrawer
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          onNavigateTab={(tab) => {
            setActiveStaffTab(tab);
            setIsAiDrawerOpen(false);
          }}
          onOpenBarcodeScanner={() => {
            setActiveStaffTab('inventory');
            setIsAiDrawerOpen(false);
          }}
        />
      )}

      {/* Direct Link PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={isDirectPreviewOpen}
        onClose={() => setIsDirectPreviewOpen(false)}
        pdfUrl={directPreviewUrl}
        filename={directPreviewFilename}
        title={directPreviewTitle}
      />

      {/* Global Keyboard Command Palette (Ctrl+K or Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => {
          setActiveStaffTab(tab);
          setIsCommandPaletteOpen(false);
        }}
        onOpenAiAssistant={() => {
          setIsAiDrawerOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenBrandModal={() => {
          setIsBrandModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onOpenShortcutsHelp={() => {
          setIsShortcutsModalOpen(true);
          setIsCommandPaletteOpen(false);
        }}
        onToggleLayout={() => {
          handleToggleLayoutMode(navLayoutMode === 'top' ? 'sidebar' : 'top');
        }}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
