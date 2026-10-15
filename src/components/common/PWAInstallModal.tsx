import React from 'react';
import {
  Download,
  X,
  CheckCircle2,
  Share2,
  PlusSquare,
  Monitor,
  Smartphone,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { LakhiLogo } from './LakhiLogo';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, browserType, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-600 via-rose-600 to-indigo-600 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
              <LakhiLogo size="sm" variant="icon" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  PWA Web App
                </span>
                <span className="text-[10px] text-amber-200 font-bold flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3" /> Offline Ready
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight mt-1">
                Install Lakhi Airconditioners
              </h3>
              <p className="text-[11px] text-red-100">
                Works like a native desktop &amp; mobile app on Chrome, Edge &amp; Safari
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300">
          {/* If already running as an installed PWA */}
          {isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-sm">App Already Installed!</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  You are currently using Lakhi Airconditioners in standalone desktop / mobile app mode.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Direct Install Button if browser provides prompt */}
              {isInstallable && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-center space-y-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    One-Click App Download Available
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Installs instantly onto your device without needing app store downloads.
                  </p>
                  <button
                    onClick={handleTriggerInstall}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-600/30 flex items-center justify-center gap-2 transition-transform active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download / Install Now</span>
                  </button>
                </div>
              )}

              {/* Browser-specific step-by-step guidance */}
              <div className="space-y-3">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {isIOS ? <Smartphone className="w-4 h-4 text-indigo-500" /> : <Monitor className="w-4 h-4 text-red-500" />}
                  <span>How to Install on Your Device:</span>
                </div>

                {/* Google Chrome & Microsoft Edge Desktop */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Google Chrome &amp; Microsoft Edge:
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Desktop / Android</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <li>
                      Look at the right side of the browser URL address bar for the{' '}
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">
                        [Install] (⊕)
                      </strong>{' '}
                      icon.
                    </li>
                    <li>
                      Alternatively, click the top-right menu{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        (⋮ or ⋯) &gt; "Install Lakhi Airconditioners"
                      </strong>
                      .
                    </li>
                    <li>Confirm installation to create desktop/app launcher shortcuts!</li>
                  </ol>
                </div>

                {/* iOS Safari (iPhone / iPad) */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      iPhone &amp; iPad (Apple Safari):
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">iOS</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-1 flex-wrap">
                      <span>1. Tap the</span>
                      <strong className="inline-flex items-center gap-0.5 text-slate-800 dark:text-slate-200">
                        <Share2 className="w-3 h-3 text-blue-500" /> Share
                      </strong>
                      <span>button at the bottom of Safari.</span>
                    </li>
                    <li className="flex items-center gap-1 flex-wrap">
                      <span>2. Scroll down and tap</span>
                      <strong className="inline-flex items-center gap-0.5 text-slate-800 dark:text-slate-200">
                        <PlusSquare className="w-3 h-3 text-indigo-500" /> "Add to Home Screen"
                      </strong>
                      .
                    </li>
                    <li>3. Tap <strong>Add</strong> in the top right. Enjoy full-screen app mode!</li>
                  </ol>
                </div>
              </div>

              {/* Benefits of App */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Works completely offline</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Fast desktop launcher icon</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Full-screen view (No browser bar)</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Instant barcode/camera access</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono">
            PWA Version • Chrome / Edge / Safari / Android
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
