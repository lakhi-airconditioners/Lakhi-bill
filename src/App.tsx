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
import { TallyPrimeManager, TallyCategory } from './components/staff/TallyPrimeManager';
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

function MainApp() {
  const { viewMode, claims, theme, isAdmin, invoices, quotations, gstNumber } = useApp();

  // Navigation tab for staff - Quick Mode is first tab as requested
  const [activeStaffTab, setActiveStaffTab] = useState<string>('quick');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  // Cross-workflow state passing
  const [quoteToConvert, setQuoteToConvert] = useState<Quotation | null>(null);
  const [invoiceToShip, setInvoiceToShip] = useState<Invoice | null>(null);
  const [stockItemToBill, setStockItemToBill] = useState<any | null>(null);

  // Direct URL View Modal (for shared invoice or quote links)
  const [directPreviewUrl, setDirectPreviewUrl] = useState<string | null>(null);
  const [directPreviewTitle, setDirectPreviewTitle] = useState('');
  const [directPreviewFilename, setDirectPreviewFilename] = useState('');
  const [isDirectPreviewOpen, setIsDirectPreviewOpen] = useState(false);

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

  // Tally Prime State
  const [tallyInitialTab, setTallyInitialTab] = useState<'IMPORT' | 'EXPORT' | 'GUIDE'>('IMPORT');
  const [tallyInitialCategory, setTallyInitialCategory] = useState<TallyCategory>('INVENTORY');

  const handleOpenTally = (
    tab: 'IMPORT' | 'EXPORT' | 'GUIDE' = 'IMPORT',
    cat: TallyCategory = 'INVENTORY'
  ) => {
    setTallyInitialTab(tab);
    setTallyInitialCategory(cat);
    setActiveStaffTab('tally');
  };

  const pendingClaimsCount = claims.filter((c) => c.status === 'PENDING').length;

  const handleConvertToInvoice = (quote: Quotation) => {
    setQuoteToConvert(quote);
    setActiveStaffTab('invoices');
  };

  const handleShipInvoice = (inv: Invoice) => {
    setInvoiceToShip(inv);
    setActiveStaffTab('shipments');
  };

  const staffNavItems = [
    { id: 'quick', label: '⚡ Quick Mode', icon: Zap },
    { id: 'quotations', label: 'Quotes (Q...)', icon: FileCheck2 },
    { id: 'invoices', label: 'Billing & Invoices (I...)', icon: Receipt },
    { id: 'inventory', label: 'Store Stock', icon: Boxes },
    { id: 'tally', label: '📊 Tally Prime (Import/Export)', icon: FileSpreadsheet },
    { id: 'shipments', label: 'Deliveries & Tracking (D...)', icon: Truck },
    { id: 'customers', label: 'Customers & Ledger (C/T...)', icon: Users },
    { id: 'khata', label: 'Who Owes Who (Dues & Khata)', icon: Scale },
    {
      id: 'claims',
      label: '72h Claims',
      icon: Clock,
      badge: pendingClaimsCount > 0 ? pendingClaimsCount : undefined,
    },
    { id: 'branding', label: '🎨 Brand & Logos', icon: Palette },
    { id: 'admins', label: 'Admin UIDs List', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        onOpenClaimsModal={() => setActiveStaffTab('claims')}
        onOpenAiAssistant={() => setIsAiDrawerOpen(true)}
        onOpenBrandModal={() => setIsBrandModalOpen(true)}
      />

      {/* Staff Operations: strictly visible only for authorized Admins */}
      {viewMode === 'STAFF' && isAdmin ? (
        <div className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {/* Sub Navigation Bar for Staff */}
          <nav className="bg-white dark:bg-slate-900 p-1 sm:p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1 overflow-x-auto scrollbar-none">
            {staffNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeStaffTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveStaffTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="bg-white text-red-700 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active Staff Tab Component */}
          {activeStaffTab === 'quick' && (
            <QuickMode
              onNavigateTab={(tab) => setActiveStaffTab(tab)}
              onConvertToInvoice={handleConvertToInvoice}
              onShipInvoice={handleShipInvoice}
              onOpenAiAssistant={() => setIsAiDrawerOpen(true)}
              onOpenBarcodeScanner={() => setActiveStaffTab('inventory')}
              onOpenTally={handleOpenTally}
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
              onOpenTally={handleOpenTally}
            />
          )}

          {activeStaffTab === 'inventory' && (
            <InventoryGodown
              onBillItem={(item) => {
                setStockItemToBill(item);
                setActiveStaffTab('invoices');
              }}
              onOpenTally={handleOpenTally}
            />
          )}

          {activeStaffTab === 'tally' && (
            <TallyPrimeManager
              initialTab={tallyInitialTab}
              initialCategory={tallyInitialCategory}
            />
          )}

          {activeStaffTab === 'shipments' && (
            <ShipmentTracker
              initialInvoiceToShip={invoiceToShip}
              onClearInitialInvoice={() => setInvoiceToShip(null)}
            />
          )}

          {activeStaffTab === 'customers' && (
            <CustomerLedger onOpenTally={handleOpenTally} />
          )}

          {activeStaffTab === 'khata' && <DuesKhataManager />}

          {activeStaffTab === 'claims' && <ClaimApprovals />}

          {activeStaffTab === 'branding' && <BrandLogoManager />}

          {activeStaffTab === 'admins' && <AdminUidManager />}
        </div>
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

      {/* Brand Logos Customizer Modal */}
      <BrandLogoModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
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
