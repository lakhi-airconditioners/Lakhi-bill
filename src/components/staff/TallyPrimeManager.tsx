import React from 'react';
import {
  Zap,
  Database,
  Sparkles,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Receipt,
  Truck,
  Users,
  Boxes,
  Building,
  ArrowUpRight,
  FileSpreadsheet,
} from 'lucide-react';
import { STORE_CONSTANTS } from '../../utils/leadNormalizationService';

export const TallyPrimeManager: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white rounded-3xl p-8 border border-amber-500/40 shadow-2xl space-y-6">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3.5 py-1 rounded-full bg-amber-500 text-slate-950 font-mono text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 fill-current" />
                SDBM v1.0
              </span>
              <span className="px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                🚀 COMING SOON
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Store Data &amp; Billing Manager (SDBM)
            </h2>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              SDBM is our upcoming multi-sheet store data and billing engine designed for Lakhi Electronics &amp; Airconditioners. It will bring unified multi-tier GST billing, automated inventory serial matching, and instant Khata ledger syncing.
            </p>
          </div>

          {/* Store Profile Badge */}
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700/80 font-mono text-xs space-y-1.5 shrink-0 shadow-inner">
            <div className="text-amber-400 font-bold flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>LAKHI STORE PROFILE</span>
            </div>
            <div className="text-slate-300">GSTIN: <span className="text-white font-bold">{STORE_CONSTANTS.storeGstin}</span></div>
            <div className="text-slate-300">Helpline: <span className="text-white font-bold">{STORE_CONSTANTS.storeHelpline}</span></div>
            <div className="pt-1.5 border-t border-slate-800 text-amber-300 text-[11px] font-bold flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-amber-400" />
              <span>{STORE_CONSTANTS.companyName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Preview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Unified Multi-Sheet Format
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Consolidates Debtors, Creditors, Invoices, Delivery Challans, Inflows, and Stock into a single structured SDBM dataset format.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Dynamic Date Keying
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Uses deterministic identifier formula <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-[11px] text-amber-600 dark:text-amber-400">[Type][YYYYMMDD][0001]</code> for instant ID generation.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Direct Cloud Synchronization
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Eliminates manual file exports. Live store operations connect directly with Google Firebase Firestore database in real-time.
          </p>
        </div>
      </div>

      {/* Information Banner */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <div className="font-bold text-sm text-white">Live Store Operations Active</div>
            <p className="text-xs text-slate-400">
              All daily store workflows (POS Quick Mode, Tax Invoices, Quotations, Stock Godown, Deliveries, and Dues Khata) are running live.
            </p>
          </div>
        </div>

        <div className="text-xs font-mono font-bold text-amber-400 bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700 whitespace-nowrap shrink-0">
          Status: SDBM Coming Soon
        </div>
      </div>
    </div>
  );
};
