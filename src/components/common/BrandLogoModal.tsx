import React from 'react';
import { X, Palette } from 'lucide-react';
import { BrandLogoManager } from '../staff/BrandLogoManager';

interface BrandLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrandLogoModal: React.FC<BrandLogoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Palette className="w-4 h-4" />
            </span>
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              Brand Logos & Visual Identity
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <BrandLogoManager />
        </div>
      </div>
    </div>
  );
};
