import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Truck,
  Receipt,
  FileCheck2,
  Wallet,
  ShieldCheck,
  Search,
  KeyRound,
  Lock,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  MapPin,
  Barcode,
  Navigation,
  LogOut,
  UserPlus,
  AlertCircle,
  HelpCircle,
  Mail,
  Zap,
  Link as LinkIcon,
  Copy,
  FileText,
  Building,
  User,
  ExternalLink,
  ChevronRight,
  Check,
  MessageCircle,
  Key,
  Trash2,
  ShieldAlert,
  X,
  Bell,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateInvoicePdf, generateQuotationPdf } from '../../utils/pdfGenerator';
import { resolvePdfLinks } from '../../utils/cloudPdfHelper';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import { Invoice, Quotation, Customer, Shipment, ShipmentStatus } from '../../types';
import { LakhiLogo } from '../common/LakhiLogo';
import {
  getActiveClaim,
  saveActiveClaim,
  clearActiveClaim,
  PersistentClaimData,
} from '../../utils/pwaSessionHelper';
import {
  generateCustomerNotifications,
  sendBrowserPushNotification,
  requestBrowserNotificationPermission,
  AppNotification,
} from '../../utils/notificationService';
import { CustomerNotificationsModal } from './CustomerNotificationsModal';
import { CustomerAiAssistantModal } from './CustomerAiAssistantModal';

const STAGES: { status: ShipmentStatus; stepNumber: number; title: string; subtitle: string }[] = [
  { status: 'ORDER_PLACED', stepNumber: 1, title: 'Order Placed', subtitle: 'Sourcing registered in Lakhi system' },
  { status: 'ORDER_CONFIRMED', stepNumber: 2, title: 'Order Confirmed', subtitle: 'Model & stock reservation verified' },
  { status: 'IN_TRANSIT', stepNumber: 3, title: 'In Transit', subtitle: 'Equipment dispatched to store' },
  { status: 'ARRIVED_AT_STORE', stepNumber: 4, title: 'Arrived at Store', subtitle: 'Received & inspected on premises' },
  { status: 'OUT_FOR_DELIVERY', stepNumber: 5, title: 'Out for Delivery', subtitle: 'Driver dispatched with units' },
  { status: 'DELIVERED_INSTALLED', stepNumber: 6, title: 'Delivered & Installed', subtitle: 'Delivery and installation complete' },
];

export const CustomerPortal: React.FC = () => {
  const {
    activeCustomer,
    loginCustomerById,
    loginCustomerByPhone,
    loginCustomerByCodeOrPhone,
    findCustomerByPhone,
    logoutCustomer,
    linkCustomerAccount,
    changeCustomerPin,
    userLinkedCustomerIds,
    linkCustomerToUserAccount,
    unlinkCustomerFromUserAccount,
    currentUser,
    signInWithGoogle,
    invoices,
    shipments,
    quotations,
    transactions,
    customers,
    claims,
    submitVerificationClaim,
    theme,
    gstNumber,
  } = useApp();

  // Authentication State - SMART login is default
  const [loginMethod, setLoginMethod] = useState<'SMART' | 'ID' | 'PHONE' | 'CLAIM'>('SMART');
  const [smartInput, setSmartInput] = useState('');
  const [smartPin, setSmartPin] = useState('');
  const [inputId, setInputId] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [phoneLoginPin, setPhoneLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [foundCustomerResult, setFoundCustomerResult] = useState<Customer | null>(null);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [copiedCustId, setCopiedCustId] = useState(false);

  // Persistent 72-Hour Claim State (Stored in localStorage so refresh preserves active code & timer)
  const [savedClaim, setSavedClaim] = useState<PersistentClaimData | null>(() => getActiveClaim());
  const [claimName, setClaimName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [generatedClaimCode, setGeneratedClaimCode] = useState<string | null>(() => getActiveClaim()?.code || null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // Sync claim from localStorage on mount
  useEffect(() => {
    const currentClaim = getActiveClaim();
    if (currentClaim) {
      setSavedClaim(currentClaim);
      setGeneratedClaimCode(currentClaim.code);
    }
  }, []);

  // Notifications State & Center Modal
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('lakhi_read_notifications');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Calculate notifications for active customer
  const customerNotifications = React.useMemo(() => {
    if (!activeCustomer) return [];
    return generateCustomerNotifications(
      activeCustomer,
      invoices,
      shipments,
      quotations,
      readNotifIds
    );
  }, [activeCustomer, invoices, shipments, quotations, readNotifIds]);

  const unreadNotifCount = customerNotifications.filter((n) => !n.isRead).length;

  const handleMarkNotifAsRead = (id: string) => {
    setReadNotifIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('lakhi_read_notifications', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleMarkAllNotifsAsRead = () => {
    const allIds = customerNotifications.map((n) => n.id);
    const next = new Set([...readNotifIds, ...allIds]);
    setReadNotifIds(next);
    try {
      localStorage.setItem('lakhi_read_notifications', JSON.stringify(Array.from(next)));
    } catch {}
  };

  // Quick Account Link Confirmation Prompt Modal (Asking if they want to add/link account to Firebase for quick sign in)
  const [pendingAccountToLink, setPendingAccountToLink] = useState<Customer | null>(null);
  const [isLinkingToUserLoading, setIsLinkingToUserLoading] = useState(false);

  // Quick Sign In PIN Prompt Modal (for 1-click accounts linked to Firebase)
  const [quickSignCustomer, setQuickSignCustomer] = useState<Customer | null>(null);
  const [quickSignPin, setQuickSignPin] = useState('');
  const [quickSignError, setQuickSignError] = useState('');
  const [isQuickSigningIn, setIsQuickSigningIn] = useState(false);

  // Customer Portal Change PIN State
  const [isCustomerChangePinOpen, setIsCustomerChangePinOpen] = useState(false);
  const [customerCurrentPin, setCustomerCurrentPin] = useState('');
  const [customerNewPin, setCustomerNewPin] = useState('');
  const [customerConfirmPin, setCustomerConfirmPin] = useState('');
  const [customerPinError, setCustomerPinError] = useState('');
  const [customerPinSuccess, setCustomerPinSuccess] = useState('');
  const [isSubmittingCustomerPin, setIsSubmittingCustomerPin] = useState(false);

  // Check URL query parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cid = params.get('cid');
      if (cid) {
        setSmartInput(cid);
        setInputId(cid);
        setLoginMethod('SMART');
      }
    }
  }, []);

  // Active Tab within Customer Portal
  const [activeTab, setActiveTab] = useState<'TRACKING' | 'INVOICES' | 'WARRANTY' | 'LEDGER' | 'QUOTES'>('TRACKING');

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Permanent Email Link State
  const [isLinkingAccount, setIsLinkingAccount] = useState(false);
  const [linkEmailInput, setLinkEmailInput] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(false);

  // Handler for Smart Universal Login (Customer ID or Phone Number + PIN)
  const handleSmartLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await loginCustomerByCodeOrPhone(smartInput, smartPin);
      if (!res.success) {
        setLoginError(res.message);
      } else if (res.customer) {
        if (currentUser && !userLinkedCustomerIds.includes(res.customer.id)) {
          setPendingAccountToLink(res.customer);
        }
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Handler for Direct Login by ID + PIN
  const handleLoginById = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await loginCustomerById(inputId, inputPin);
      if (!res.success) {
        setLoginError(res.message);
      } else {
        const matched = customers.find((c) => c.id === inputId.trim().toUpperCase());
        if (matched && currentUser && !userLinkedCustomerIds.includes(matched.id)) {
          setPendingAccountToLink(matched);
        }
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Handler for Phone Login with PIN
  const handleLoginByPhoneAndPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await loginCustomerByPhone(inputPhone, phoneLoginPin);
      if (!res.success) {
        setLoginError(res.message);
      } else if (res.customer) {
        // Check if user is signed in to Firebase and account is not yet linked
        if (currentUser && !userLinkedCustomerIds.includes(res.customer.id)) {
          setPendingAccountToLink(res.customer);
        }
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Handler for Finding ID by Phone
  const handleFindIdByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSearchingPhone(true);
    try {
      const found = await findCustomerByPhone(inputPhone);
      if (found) {
        setFoundCustomerResult(found);
      } else {
        setFoundCustomerResult(null);
        setLoginError('No registered customer profile found with this phone number. Try generating a 72-Hour verification claim.');
      }
    } finally {
      setIsSearchingPhone(false);
    }
  };

  // Handler for 72-Hour Claim Generation
  const handleGenerateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingClaim(true);
    try {
      const code = await submitVerificationClaim(claimName, claimPhone, claimNotes);
      const claimData: PersistentClaimData = {
        code,
        name: claimName.trim(),
        phone: claimPhone.trim(),
        notes: claimNotes.trim(),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      };
      saveActiveClaim(claimData);
      setSavedClaim(claimData);
      setGeneratedClaimCode(code);
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  // Link email or Google account to customer session
  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    try {
      const emailToLink = currentUser?.email || linkEmailInput;
      await linkCustomerAccount(activeCustomer.id, emailToLink);
      setLinkSuccess(true);
      setTimeout(() => setLinkSuccess(false), 3000);
      setIsLinkingAccount(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewInvoicePdf = (inv: Invoice) => {
    const resolved = resolvePdfLinks(inv);
    if (resolved.hasPdf) {
      if (resolved.embedLink) {
        setPreviewPdfUrl(resolved.embedLink);
        setPreviewFilename(`${inv.id}-TaxInvoice.pdf`);
        setPreviewTitle(`Tax Invoice: ${inv.id}`);
        setIsPreviewOpen(true);
        return;
      } else if (resolved.viewLink) {
        window.open(resolved.viewLink, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    const { url, filename } = generateInvoicePdf(inv, inv.gstNumber || gstNumber);
    setPreviewPdfUrl(url);
    setPreviewFilename(filename);
    setPreviewTitle(`Tax Invoice: ${inv.id}`);
    setIsPreviewOpen(true);
  };

  const handleDownloadInvoicePdf = (inv: Invoice) => {
    const resolved = resolvePdfLinks(inv);
    if (resolved.hasPdf && resolved.downloadLink) {
      window.open(resolved.downloadLink, '_blank', 'noopener,noreferrer');
      return;
    }
    const { doc, filename } = generateInvoicePdf(inv, inv.gstNumber || gstNumber);
    doc.save(filename);
  };

  const handlePreviewQuotePdf = (quote: Quotation) => {
    const resolved = resolvePdfLinks(quote);
    if (resolved.hasPdf) {
      if (resolved.embedLink) {
        setPreviewPdfUrl(resolved.embedLink);
        setPreviewFilename(`${quote.id}-Quotation.pdf`);
        setPreviewTitle(`Quotation: ${quote.id}`);
        setIsPreviewOpen(true);
        return;
      } else if (resolved.viewLink) {
        window.open(resolved.viewLink, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    const { url, filename } = generateQuotationPdf(quote, quote.gstNumber || gstNumber);
    setPreviewPdfUrl(url);
    setPreviewFilename(filename);
    setPreviewTitle(`Quotation: ${quote.id}`);
    setIsPreviewOpen(true);
  };

  const handleDownloadQuotePdf = (quote: Quotation) => {
    const resolved = resolvePdfLinks(quote);
    if (resolved.hasPdf && resolved.downloadLink) {
      window.open(resolved.downloadLink, '_blank', 'noopener,noreferrer');
      return;
    }
    const { doc, filename } = generateQuotationPdf(quote, quote.gstNumber || gstNumber);
    doc.save(filename);
  };

  // Filter items for active customer (by Customer ID or phone number matching)
  const customerInvoices = invoices.filter(
    (i) =>
      activeCustomer &&
      (i.customerId === activeCustomer.id ||
        (activeCustomer.phone &&
          i.customerPhone &&
          i.customerPhone.replace(/\D/g, '') === activeCustomer.phone.replace(/\D/g, '')))
  );
  const customerShipments = shipments.filter(
    (s) =>
      activeCustomer &&
      (s.customerId === activeCustomer.id ||
        (activeCustomer.phone &&
          s.customerPhone &&
          s.customerPhone.replace(/\D/g, '') === activeCustomer.phone.replace(/\D/g, '')))
  );
  const customerQuotes = quotations.filter(
    (q) =>
      activeCustomer &&
      (q.customerId === activeCustomer.id ||
        (activeCustomer.phone &&
          q.customerPhone &&
          q.customerPhone.replace(/\D/g, '') === activeCustomer.phone.replace(/\D/g, '')))
  );
  const customerTransactions = transactions.filter(
    (t) => activeCustomer && t.customerId === activeCustomer.id
  );

  // Warranty items extracted from all customer invoices
  const warrantyUnits = customerInvoices.flatMap((inv) =>
    inv.items.map((it) => ({
      ...it,
      invoiceId: inv.id,
      purchaseDate: inv.createdAt.slice(0, 10),
    }))
  );

  const getStageIndex = (status: ShipmentStatus) => {
    return STAGES.findIndex((s) => s.status === status);
  };

  // ==========================================
  // UN-AUTHENTICATED: FRONT PAGE
  // Direct Customer Account Access (Nothing above!)
  // ==========================================
  if (!activeCustomer) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
        {/* Customer Account Access Top Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-center shadow-xs">
              <LakhiLogo size="sm" variant="icon" themeInvert={theme === 'dark'} />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Customer Account Access
          </h1>

          {/* Tagline & Contact Info */}
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Lakhi Airconditioners • Contact:{' '}
            <a
              href="tel:+919998021446"
              className="font-bold text-red-600 dark:text-red-400 hover:underline"
            >
              +91 99980 21446
            </a>
          </div>

          {/* Timings & Holidays Schedule Notice (Mon - Fri Only) */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl text-xs font-medium text-red-900 dark:text-red-200 shadow-xs">
            <Clock className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-bold">Mon – Fri: 11:00 AM – 7:00 PM</span>
            <span className="text-red-300 dark:text-red-700">•</span>
            <span>Closed on Saturdays & Sundays</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto pt-1">
            Access your verified tax invoices, live appliance delivery tracking, machine compressor serials, and balance ledger.
          </p>
        </div>

        {/* Quick Account Select - ONLY displays accounts that this Firebase account has explicitly linked / added */}
        {currentUser && userLinkedCustomerIds.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Quick 1-Click Access for Your Linked Firebase Accounts:
              </span>
              <span className="text-[10px] text-slate-400">
                Saved in Firebase: {currentUser.email}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {customers
                .filter((c) => userLinkedCustomerIds.includes(c.id))
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSignCustomer(c);
                        setQuickSignPin('');
                        setQuickSignError('');
                      }}
                      className="px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 text-left transition-colors"
                    >
                      <div className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                        <span>{c.externalName}</span>
                        <span className="text-[10px] text-red-600 dark:text-red-400 font-mono">→ Enter PIN</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {c.id}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => unlinkCustomerFromUserAccount(c.id)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors border-l border-slate-100 dark:border-slate-700"
                      title="Remove from quick sign-in list"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Customer Account Access Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
            <button
              onClick={() => { setLoginMethod('SMART'); setLoginError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                loginMethod === 'SMART'
                  ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Sign In (ID or Phone + PIN)
            </button>
            <button
              onClick={() => { setLoginMethod('CLAIM'); setLoginError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                loginMethod === 'CLAIM'
                  ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <span>72h Claim Code</span>
              {(savedClaim || generatedClaimCode) && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-2 right-2" />
              )}
            </button>
          </div>

          {loginError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Form 1: SMART Universal Login (ID or Phone + PIN with bidirectional +91 matcher) */}
          {loginMethod === 'SMART' && (
            <form onSubmit={handleSmartLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Customer ID or Registered Mobile:</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold lowercase">
                    auto-detects +91, 0, or raw
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={smartInput}
                  onChange={(e) => setSmartInput(e.target.value)}
                  placeholder="e.g. C202610094102 or +91 98765 43210 or 9876543210"
                  className="w-full text-xs font-mono uppercase px-3.5 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                  <span>Supports any format (+91..., 0..., 91..., or raw digits)</span>
                  <button
                    type="button"
                    onClick={() => { setLoginMethod('CLAIM'); setLoginError(''); }}
                    className="text-red-600 dark:text-red-400 font-bold hover:underline"
                  >
                    Don't have PIN? Use 72h Claim
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  4-Digit Access PIN:
                </label>
                <input
                  type="password"
                  required
                  maxLength={4}
                  value={smartPin}
                  onChange={(e) => setSmartPin(e.target.value)}
                  placeholder="••••"
                  className="w-full text-xs font-mono px-3.5 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Printed on your Lakhi bill receipt or provided by store staff.
                </span>
              </div>

              <button
                type="submit"
                disabled={loginLoading || !smartInput.trim() || smartPin.length !== 4}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-600/30 flex items-center justify-center gap-2"
              >
                {loginLoading ? 'Verifying Credentials...' : 'Access My Dashboard →'}
              </button>
            </form>
          )}

          {/* Form 2: 72h Claim Code (with live persistence across page refreshes!) */}
          {loginMethod === 'CLAIM' && (() => {
            const activeCode = savedClaim?.code || generatedClaimCode;
            const liveClaimDoc = claims.find((c) => c.id === activeCode);
            const isApproved = liveClaimDoc?.status === 'APPROVED';
            const isRejected = liveClaimDoc?.status === 'REJECTED';

            const calculateCountdown = () => {
              if (!savedClaim?.expiresAt) return 'Active';
              const diff = new Date(savedClaim.expiresAt).getTime() - Date.now();
              if (diff <= 0) return 'Expired';
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
              return `${hours}h ${minutes}m remaining`;
            };

            if (activeCode) {
              return (
                <div className="space-y-4">
                  <div
                    className={`p-5 rounded-2xl border text-center space-y-3 ${
                      isApproved
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                        : isRejected
                        ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900'
                        : 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                        72-Hour Verification Claim (Preserved on Refresh)
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isApproved
                            ? 'bg-emerald-600 text-white'
                            : isRejected
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-500 text-white animate-pulse'
                        }`}
                      >
                        {liveClaimDoc?.status || 'PENDING STORE VERIFICATION'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block">Your 6-Digit Claim Code:</span>
                      <div className="text-3xl font-black font-mono tracking-widest text-red-600 dark:text-red-400 mt-1">
                        {activeCode}
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div>Name: <strong>{savedClaim?.name || claimName || 'Customer'}</strong></div>
                      <div>Phone: <strong>{savedClaim?.phone || claimPhone}</strong></div>
                      {!isApproved && !isRejected && (
                        <div className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 pt-1 flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Lifetime: {calculateCountdown()}</span>
                        </div>
                      )}
                    </div>

                    {isApproved && liveClaimDoc?.matchedCustomerId && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSmartInput(liveClaimDoc.matchedCustomerId || '');
                            setLoginMethod('SMART');
                          }}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                          🎉 Claim Approved! Click to Enter PIN & Sign In →
                        </button>
                      </div>
                    )}

                    {!isApproved && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Share this code with Lakhi store staff in person or WhatsApp to{' '}
                        <a href="https://wa.me/919998021446" className="text-red-600 dark:text-red-400 font-bold hover:underline">
                          +91 99980 21446
                        </a>{' '}
                        for immediate account verification.
                      </p>
                    )}

                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          clearActiveClaim();
                          setSavedClaim(null);
                          setGeneratedClaimCode(null);
                        }}
                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-colors"
                      >
                        Clear & Generate New Claim
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <form onSubmit={handleGenerateClaim} className="space-y-3 text-xs">
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Lost your Customer ID or PIN? Generate a temporary 72-hour verification claim. The claim persists across page refreshes and can be verified by store staff.
                </p>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Your Full Name:</label>
                  <input
                    type="text"
                    required
                    value={claimName}
                    onChange={(e) => setClaimName(e.target.value)}
                    placeholder="Legal Customer Name"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mobile Phone:</label>
                  <input
                    type="tel"
                    required
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bill Reference (Optional):</label>
                  <input
                    type="text"
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    placeholder="e.g. Bought 2x Daikin AC in May"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm"
                >
                  {isSubmittingClaim ? 'Generating Code...' : 'Generate 72-Hour Claim Code'}
                </button>
              </form>
            );
          })()}
        </div>

        {/* STORE CONTACT, TIMINGS & SCHEDULE INFO CARD */}
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 tracking-wider">
                Store Helpline & Schedule
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Lakhi Airconditioners</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Contact: <a href="tel:+919998021446" className="text-red-600 dark:text-red-400 font-bold hover:underline">+91 99980 21446</a>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="tel:+919998021446"
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                Call +91 99980 21446
              </a>
              <a
                href="https://wa.me/919998021446?text=Hello%20Lakhi%20Airconditioners,%20I%20would%20like%20to%20inquire%20about%20my%20order."
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase block font-bold">Store Hours:</span>
                <span className="font-bold text-slate-900 dark:text-white">Mon – Fri: 11:00 AM – 7:00 PM</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase block font-bold">Store Schedule:</span>
                <span className="font-bold text-slate-900 dark:text-white">Closed on Weekends (Saturday & Sunday)</span>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Preview Modal */}
        <PdfPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          pdfUrl={previewPdfUrl}
          filename={previewFilename}
          title={previewTitle}
        />
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED: CUSTOMER DASHBOARD
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Customer Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-red-600/30">
            {activeCustomer.externalName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {activeCustomer.externalName}
              </h2>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                {activeCustomer.id}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
              <span>📞 {activeCustomer.phone}</span>
              {activeCustomer.installationAddress && (
                <span>📍 {activeCustomer.installationAddress.slice(0, 30)}...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Ledger Balance</span>
            <span
              className={`font-black text-sm ${
                activeCustomer.accountBalance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {activeCustomer.accountBalance >= 0
                ? `+₹${activeCustomer.accountBalance.toLocaleString('en-IN')} (Advance)`
                : `-₹${Math.abs(activeCustomer.accountBalance).toLocaleString('en-IN')} (Credit)`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCustomerCurrentPin('');
                setCustomerNewPin('');
                setCustomerConfirmPin('');
                setCustomerPinError('');
                setCustomerPinSuccess('');
                setIsCustomerChangePinOpen(true);
              }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              title="Change your 4-digit access PIN"
            >
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Change PIN</span>
            </button>

            {currentUser && !userLinkedCustomerIds.includes(activeCustomer.id) && (
              <button
                onClick={() => setPendingAccountToLink(activeCustomer)}
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                title="Save this account to your Google / Firebase login for 1-click access"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Link for Quick Sign In</span>
              </button>
            )}

            {/* In-App Notifications Center Button */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              title="View all notifications and live order updates"
            >
              <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">Updates</span>
              {unreadNotifCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Customer Copilot AI Button */}
            <button
              onClick={() => setIsAiAssistantOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-red-600/30 flex items-center gap-1.5"
              title="Ask Lakhi AI about your orders, invoices, or balance"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Ask Lakhi AI</span>
            </button>

            <button
              onClick={logoutCustomer}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Browser Notification Suggestion Banner */}
      {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
        <div className="bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 dark:from-red-950/40 dark:via-amber-950/40 dark:to-orange-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-red-600/30">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Turn on Notifications for Live Updates</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300">
                  Recommended
                </span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Receive instant browser alerts when an invoice is added, your AC order is dispatched or out for delivery, and quotes are prepared.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={async () => {
                const res = await requestBrowserNotificationPermission();
                if (res) {
                  sendBrowserPushNotification('🔔 Notifications Enabled', {
                    body: 'You will now receive live alerts for your orders, shipments, and invoices from Lakhi Electronics.',
                  });
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Allow Notifications</span>
            </button>
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              View Update Log
            </button>
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('TRACKING')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'TRACKING'
              ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          Live Deliveries ({customerShipments.length})
        </button>

        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'INVOICES'
              ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Tax Invoices ({customerInvoices.length})
        </button>

        <button
          onClick={() => setActiveTab('WARRANTY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'WARRANTY'
              ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Barcode className="w-4 h-4" />
          Warranty & Unit Serials ({warrantyUnits.length})
        </button>

        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'LEDGER'
              ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Balance & Ledger ({customerTransactions.length})
        </button>

        <button
          onClick={() => setActiveTab('QUOTES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'QUOTES'
              ? 'bg-red-600 text-white shadow-xs shadow-red-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Quotations ({customerQuotes.length})
        </button>
      </div>

      {/* TAB 1: LIVE DELIVERIES WITH 5-STAGE TRACKER */}
      {activeTab === 'TRACKING' && (
        <div className="space-y-4">
          {customerShipments.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Truck className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Dispatched Deliveries</div>
              <p className="text-xs text-slate-400">
                When an order or appliance is dispatched for your site, live milestone updates and driver contact details will appear here.
              </p>
            </div>
          ) : (
            customerShipments.map((ship) => {
              const currentStageIndex = getStageIndex(ship.status);
              const allLinkedInvoices = Array.from(
                new Set([
                  ...(ship.invoiceIds || []),
                  ship.invoiceId ? ship.invoiceId : '',
                ].filter(Boolean))
              );

              return (
                <div
                  key={ship.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <span className="font-mono text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-1 rounded-xl border border-red-200 dark:border-red-900">
                        Delivery Tracking ID: {ship.id}
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mt-2.5">
                        Site: {ship.installationAddress || ship.deliveryAddress}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Units: {ship.itemsSummary}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-center ${
                        ship.status === 'DELIVERED_INSTALLED'
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          : ship.status === 'OUT_FOR_DELIVERY'
                          ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {STAGES.find((st) => st.status === ship.status)?.stepNumber || ''}. {ship.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* 5-STAGE VISUAL PROGRESS TIMELINE */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <span>Delivery Milestones</span>
                      <span className="text-red-600 dark:text-red-400 font-mono">
                        Step {currentStageIndex + 1} of {STAGES.length}: {STAGES[currentStageIndex]?.title}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-red-600 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(16, ((currentStageIndex + 1) / STAGES.length) * 100)}%`,
                        }}
                      />
                    </div>

                    {/* 5-6 Milestone Stage Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 pt-1 text-center">
                      {STAGES.map((stg, idx) => {
                        const isDone = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;
                        return (
                          <div
                            key={stg.status}
                            className={`p-2 rounded-xl text-[11px] font-bold ${
                              isCurrent
                                ? 'bg-red-600 text-white shadow-xs'
                                : isDone
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            <div>{stg.stepNumber}. {stg.title.split(' ')[0]}</div>
                            <div className="text-[9px] opacity-80">{stg.subtitle.slice(0, 15)}...</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* DRIVER CONTACT & STORE HELPLINE */}
                  <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-red-900 dark:text-red-300 uppercase tracking-wider block">
                        Assigned Delivery Driver & Store Helpline
                      </span>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {ship.driverName || 'Driver Assignment in Progress'}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs mt-1">
                        {ship.driverPhone ? (
                          <a
                            href={`tel:${ship.driverPhone}`}
                            className="text-red-600 dark:text-red-400 font-mono font-bold hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Call Driver: {ship.driverPhone}
                          </a>
                        ) : (
                          <span className="text-slate-400">Driver phone will appear upon dispatch</span>
                        )}

                        <a
                          href="tel:+919998021446"
                          className="text-slate-600 dark:text-slate-400 hover:underline flex items-center gap-1 font-bold"
                        >
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          Store Helpline: +91 99980 21446
                        </a>
                      </div>
                    </div>

                    {ship.liveRouteLink && (
                      <a
                        href={ship.liveRouteLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Navigation className="w-4 h-4" />
                        Live Route on Maps
                      </a>
                    )}
                  </div>

                  {/* LINKED INVOICES WITH 1-CLICK BILL PDF VIEW */}
                  {allLinkedInvoices.length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <FileText className="w-4 h-4 text-red-600" />
                        <span>Official Invoices Linked to this Delivery:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allLinkedInvoices.map((invId) => {
                          const inv = invoices.find((i) => i.id === invId);
                          return (
                            <div
                              key={invId}
                              className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs flex items-center gap-3 shadow-xs"
                            >
                              <span className="font-mono font-bold text-red-600">{invId}</span>
                              {inv && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ₹{inv.totalAmount.toLocaleString('en-IN')}
                                </span>
                              )}
                              {inv && (
                                <button
                                  onClick={() => handlePreviewInvoicePdf(inv)}
                                  className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-red-600 flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View Bill
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tracking Updates History */}
                  {ship.trackingUpdates && ship.trackingUpdates.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Milestones Log ({ship.trackingUpdates.length}):
                      </span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {ship.trackingUpdates.map((u, i) => (
                          <div
                            key={u.id || i}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs flex items-center justify-between border border-slate-100 dark:border-slate-800"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-200">{u.message}</span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                              {u.timestamp.slice(0, 16).replace('T', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: INVOICES & TAX BILLS */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-4">
          {customerInvoices.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              No invoices generated for your account yet.
            </div>
          ) : (
            customerInvoices.map((inv) => {
              const matchedShipment = shipments.find(
                (s) => s.invoiceId === inv.id || (s.invoiceIds && s.invoiceIds.includes(inv.id))
              );

              return (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-red-600 dark:text-red-400">{inv.id}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                              : 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                        {matchedShipment && (
                          <button
                            onClick={() => setActiveTab('TRACKING')}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" />
                            <span>{matchedShipment.id} ({matchedShipment.status.replace(/_/g, ' ')})</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">Issued: {inv.createdAt.slice(0, 10)}</span>
                        {(inv.gstNumber || gstNumber) && (
                          <span className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            GSTIN: <strong className="text-slate-800 dark:text-slate-200">{inv.gstNumber || gstNumber}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreviewInvoicePdf(inv)}
                        className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                      >
                        <Eye className="w-4 h-4" />
                        Preview Bill
                      </button>
                      <button
                        onClick={() => handleDownloadInvoicePdf(inv)}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {inv.items.map((it, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {it.quantity}x {it.name || it.type} ({it.modelNo || 'Standard'})
                          </div>
                          {(it.serialNo || it.indoorUnitSerial || it.outdoorUnitSerial) && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {it.serialNo && <span>SN: {it.serialNo} </span>}
                              {it.indoorUnitSerial && <span>Indoor: {it.indoorUnitSerial} </span>}
                              {it.outdoorUnitSerial && <span>Outdoor: {it.outdoorUnitSerial}</span>}
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          ₹{it.lineTotal.toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs font-bold gap-2">
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Subtotal: ₹{inv.subtotal.toLocaleString('en-IN')}</span>
                      <span>GST: ₹{inv.taxAmount.toLocaleString('en-IN')}</span>
                      {inv.roundOffAmount !== undefined && inv.roundOffAmount !== 0 && (
                        <span className="text-blue-600 dark:text-blue-400 font-mono">
                          Round Off: {inv.roundOffAmount > 0 ? '+' : ''}₹{inv.roundOffAmount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Total Bill:</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        ₹{inv.totalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: WARRANTY & UNIT SERIALS */}
      {activeTab === 'WARRANTY' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-300">
            <strong>Official Warranty Serials Registry:</strong> Keep these indoor and outdoor unit serials handy when calling Daikin, O General, Mitsubishi, or LG customer service.
          </div>

          {warrantyUnits.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              No warranty machine records found for your account.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warrantyUnits.map((u, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {u.name || u.type}
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">Model: {u.modelNo || 'Standard'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      Verified
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 font-mono">
                    {u.indoorUnitSerial && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Indoor Unit SN:</span>
                        <strong className="text-slate-900 dark:text-white">{u.indoorUnitSerial}</strong>
                      </div>
                    )}
                    {u.outdoorUnitSerial && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Outdoor Unit SN:</span>
                        <strong className="text-slate-900 dark:text-white">{u.outdoorUnitSerial}</strong>
                      </div>
                    )}
                    {u.serialNo && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Serial No:</span>
                        <strong className="text-slate-900 dark:text-white">{u.serialNo}</strong>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Invoice: {u.invoiceId}</span>
                    <span>Purchased: {u.purchaseDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACCOUNT LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase">Current Account Standing</span>
              <div
                className={`text-2xl font-black ${
                  activeCustomer.accountBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {activeCustomer.accountBalance >= 0
                  ? `+₹${activeCustomer.accountBalance.toLocaleString('en-IN')} (Advance Deposit)`
                  : `-₹${Math.abs(activeCustomer.accountBalance).toLocaleString('en-IN')} (Outstanding Due)`}
              </div>
            </div>
          </div>

          {customerTransactions.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              No payment ledger entries recorded yet.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Tx ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customerTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{tx.id}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.createdAt.slice(0, 10)}</td>
                      <td className="px-4 py-3 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            tx.type === 'INFLOW'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{tx.mode}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">
                        ₹{tx.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: QUOTATIONS */}
      {activeTab === 'QUOTES' && (
        <div className="space-y-4">
          {customerQuotes.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              No quotations issued for your account.
            </div>
          ) : (
            customerQuotes.map((q) => (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="font-mono text-base font-bold text-red-600 dark:text-red-400">{q.id}</span>
                    <span className="text-xs text-slate-400 ml-2">Issued: {q.createdAt.slice(0, 10)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreviewQuotePdf(q)}
                      className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Preview PDF
                    </button>
                    <button
                      onClick={() => handleDownloadQuotePdf(q)}
                      className="px-3.5 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold"
                    >
                      Download
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {q.items.map((it, idx) => (
                    <div key={idx} className="py-2 flex justify-between">
                      <span>{it.quantity}x {it.name || it.type} ({it.modelNo || 'Std'})</span>
                      <strong className="text-slate-900 dark:text-white">₹{it.lineTotal.toLocaleString('en-IN')}</strong>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Quoted Total:</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    ₹{q.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewPdfUrl}
        filename={previewFilename}
        title={previewTitle}
      />

      {/* POPUP MODAL 1: Add/Link Account to Firebase Account for Quick Sign-In Confirmation */}
      {pendingAccountToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Link Account for Quick Sign-In?
                </h3>
                <p className="text-xs text-slate-500">
                  Save to your signed-in Firebase account
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Name:</span>
                <strong className="text-slate-900 dark:text-white">{pendingAccountToLink.externalName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer ID:</span>
                <span className="font-mono font-bold text-red-600 dark:text-red-400">{pendingAccountToLink.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Firebase Account:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{currentUser?.email}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Would you like to link and store this customer profile in your Firebase account (<span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{currentUser?.email}</span>) so it appears in your <strong>Quick Sign-In</strong> list next time? No sensitive credentials are stored locally in the browser.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPendingAccountToLink(null)}
                className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Skip / Not Now
              </button>
              <button
                type="button"
                disabled={isLinkingToUserLoading}
                onClick={async () => {
                  setIsLinkingToUserLoading(true);
                  try {
                    await linkCustomerToUserAccount(pendingAccountToLink.id);
                    setPendingAccountToLink(null);
                  } finally {
                    setIsLinkingToUserLoading(false);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                {isLinkingToUserLoading ? 'Linking...' : 'Yes, Link to Firebase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL 2: Enter PIN for Quick Sign-In Account */}
      {quickSignCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 dark:bg-red-950/60 rounded-xl text-red-600 dark:text-red-400">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Verify 4-Digit PIN</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {quickSignCustomer.externalName} ({quickSignCustomer.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickSignCustomer(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              For security, enter your 4-digit PIN to access this linked customer account.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setQuickSignError('');
                setIsQuickSigningIn(true);
                try {
                  const res = await loginCustomerById(quickSignCustomer.id, quickSignPin);
                  if (res.success) {
                    setQuickSignCustomer(null);
                    setQuickSignPin('');
                  } else {
                    setQuickSignError(res.message);
                  }
                } finally {
                  setIsQuickSigningIn(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  required
                  value={quickSignPin}
                  onChange={(e) => setQuickSignPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-widest text-2xl font-mono font-bold px-3 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              {quickSignError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-600 dark:text-red-300 flex items-center gap-1.5 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{quickSignError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickSignCustomer(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isQuickSigningIn || quickSignPin.length !== 4}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {isQuickSigningIn ? 'Verifying...' : 'Sign In →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL 3: Customer Portal Self Change PIN */}
      {isCustomerChangePinOpen && activeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 dark:bg-red-950/60 rounded-xl text-red-600 dark:text-red-400">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Change Your Access PIN</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Account: {activeCustomer.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerChangePinOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Administrative Notice:
                </strong>
                <span>
                  Please note: This 4-digit PIN can be viewed and verified by authorized store admins and billing staff to assist you with telephone queries and receipt verification.
                </span>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCustomerPinError('');
                setCustomerPinSuccess('');

                if (customerNewPin !== customerConfirmPin) {
                  setCustomerPinError('New PIN and confirmation PIN do not match.');
                  return;
                }
                if (!/^\d{4}$/.test(customerNewPin)) {
                  setCustomerPinError('New PIN must be exactly 4 digits.');
                  return;
                }

                setIsSubmittingCustomerPin(true);
                try {
                  const res = await changeCustomerPin(activeCustomer.id, customerNewPin, customerCurrentPin);
                  if (res.success) {
                    setCustomerPinSuccess('Your access PIN has been updated successfully!');
                    setTimeout(() => {
                      setIsCustomerChangePinOpen(false);
                      setCustomerCurrentPin('');
                      setCustomerNewPin('');
                      setCustomerConfirmPin('');
                    }, 1400);
                  } else {
                    setCustomerPinError(res.message);
                  }
                } finally {
                  setIsSubmittingCustomerPin(false);
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current 4-Digit PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={customerCurrentPin}
                  onChange={(e) => setCustomerCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-widest text-base font-mono font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New 4-Digit PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={customerNewPin}
                  onChange={(e) => setCustomerNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-widest text-base font-mono font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New PIN:
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={customerConfirmPin}
                  onChange={(e) => setCustomerConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-widest text-base font-mono font-bold px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              {customerPinError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-600 dark:text-red-300 flex items-center gap-1.5 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{customerPinError}</span>
                </div>
              )}

              {customerPinSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5 text-xs font-bold">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{customerPinSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomerChangePinOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomerPin || customerNewPin.length !== 4 || customerConfirmPin.length !== 4}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm"
                >
                  {isSubmittingCustomerPin ? 'Updating...' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Ask AI Button for Quick Access */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsAiAssistantOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-full shadow-lg shadow-red-600/40 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 font-bold text-xs"
          title="Ask Lakhi AI about your orders, invoices, or balance"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <span>Ask Lakhi AI</span>
          <span className="hidden sm:inline-block text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
            Copilot
          </span>
        </button>
      </div>

      {/* In-App Notifications Center Modal */}
      <CustomerNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={customerNotifications}
        onMarkAsRead={handleMarkNotifAsRead}
        onMarkAllAsRead={handleMarkAllNotifsAsRead}
        onNavigateToTab={(tab) => {
          setActiveTab(tab);
          setIsNotificationsOpen(false);
        }}
      />

      {/* Customer AI Assistant Modal */}
      <CustomerAiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        customer={activeCustomer}
        invoices={customerInvoices}
        shipments={customerShipments}
        quotations={customerQuotes}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsAiAssistantOpen(false);
        }}
      />
    </div>
  );
};
