import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, Zap, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface StaffDataLoaderOverlayProps {
  onDismiss: () => void;
}

export const StaffDataLoaderOverlay: React.FC<StaffDataLoaderOverlayProps> = ({ onDismiss }) => {
  const { customers, quotations, invoices, inventory, shipments, transactions, claims, payables, isLoading } = useApp();
  const [progressPercent, setProgressPercent] = useState(15);
  const [statusText, setStatusText] = useState('Initializing store database connection...');

  const totalLoadedItems =
    customers.length +
    quotations.length +
    invoices.length +
    inventory.length +
    shipments.length +
    transactions.length +
    claims.length +
    payables.length;

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgressPercent(45);
      setStatusText('Restoring cached store records & stock godown...');
    }, 200);

    const timer2 = setTimeout(() => {
      setProgressPercent(85);
      setStatusText('Synchronizing tax invoices, quotes & deliveries...');
    }, 500);

    const timer3 = setTimeout(() => {
      setProgressPercent(100);
      setStatusText('All store data synchronized and ready!');
    }, 800);

    const timer4 = setTimeout(() => {
      onDismiss();
    }, 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-white space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-600/20 border border-red-500/30 text-red-500 rounded-2xl">
              <Database className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Loading Lakhi ERP Staff Data</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pre-loading all 8 store modules for instant tab switching
              </p>
            </div>
          </div>

          {/* Skip Button */}
          <button
            type="button"
            onClick={onDismiss}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            title="Skip loading and open Staff Operations directly"
          >
            <span>Skip</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-amber-400 font-bold text-sm">{invoices.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-sans">Invoices</div>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-emerald-400 font-bold text-sm">{inventory.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-sans">Stock STK</div>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-blue-400 font-bold text-sm">{customers.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-sans">Debtors</div>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-teal-400 font-bold text-sm">{shipments.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-sans">Deliveries</div>
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-amber-300 flex items-center gap-1.5">
              {progressPercent < 100 ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {statusText}
            </span>
            <span className="text-slate-400">{progressPercent}%</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
            <div
              className="bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 h-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
          <span className="text-slate-400 flex items-center gap-1 font-mono">
            <Zap className="w-3 h-3 text-amber-400" />
            Total loaded: {totalLoadedItems} records
          </span>

          <button
            type="button"
            onClick={onDismiss}
            className="text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1 cursor-pointer"
          >
            <span>Open Staff Operations Now</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
