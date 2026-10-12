import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, Copy, RefreshCw, Scissors } from 'lucide-react';
import { IdTypePrefix } from '../../types';
import { generateUniqueId, getYYYYMMDD, stripRandomSuffix } from '../../utils/idGenerator';

interface IdGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IdGeneratorModal: React.FC<IdGeneratorModalProps> = ({ isOpen, onClose }) => {
  const [selectedType, setSelectedType] = useState<IdTypePrefix>('I');
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState('PROJECT-A');
  const [includeRandomSuffix, setIncludeRandomSuffix] = useState(false); // Default false as requested
  const [generatedId, setGeneratedId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const typeDescriptions: Record<IdTypePrefix, { title: string; example: string }> = {
    I: { title: 'Invoice ID', example: 'I20261012 or INV-PROJECT-A' },
    Q: { title: 'Quotation ID', example: 'Q20261012 or QT-CLIENT-01' },
    T: { title: 'Transaction / Ledger Inflow-Outflow', example: 'T20261012' },
    D: { title: 'Delivery / Shipment Tracking', example: 'D20261012 or DEL-01' },
    C: { title: 'Customer ID', example: 'C20261012 or CUST-SHARMA' },
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const id = await generateUniqueId({
        type: selectedType,
        customText,
        useCustom,
        includeRandomSuffix,
      });
      setGeneratedId(id);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveRandomDigits = () => {
    if (!generatedId) return;
    setGeneratedId(stripRandomSuffix(generatedId));
  };

  const handleCopy = () => {
    if (!generatedId) return;
    navigator.clipboard.writeText(generatedId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Common ID Generator Formula</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Deterministic collision-checked formula for Lakhi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Formula Rule Explanation Banner */}
          <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/50 space-y-2">
            <div className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider">
              Formula Specification:
            </div>
            <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-center">
              [Type Letter] + [Custom Text | YYYYMMDD] + [4-Digit Random Code]
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Checks Firestore documents before committing to guarantee zero ID collisions.
            </p>
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Select Document Prefix:
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(['I', 'Q', 'T', 'D', 'C'] as IdTypePrefix[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`py-2.5 rounded-xl text-center font-bold text-xs transition-all ${
                    selectedType === t
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="text-base font-black font-mono">{t}</div>
                  <div className="text-[10px] font-normal opacity-80">
                    {t === 'I' ? 'Bill' : t === 'Q' ? 'Quote' : t === 'T' ? 'Ledger' : t === 'D' ? 'Delivery' : 'Customer'}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {typeDescriptions[selectedType].title} • Example: <span className="font-mono text-red-600 dark:text-red-400">{typeDescriptions[selectedType].example}</span>
            </p>
          </div>

          {/* Mode Switch: Auto YYYYMMDD vs Custom Text */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="idMode"
                  checked={!useCustom}
                  onChange={() => setUseCustom(false)}
                  className="accent-red-600"
                />
                Auto YYYYMMDD Date ({getYYYYMMDD()})
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="idMode"
                  checked={useCustom}
                  onChange={() => setUseCustom(true)}
                  className="accent-red-600"
                />
                Custom Text
              </label>
            </div>

            {useCustom && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Custom Middle Identifier (alphanumeric/hyphen):
                </label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value.toUpperCase())}
                  placeholder="e.g. VIP-DELIVERY-01"
                  className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            )}

            {/* Option to Include / Remove 4-Digit Random Suffix */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includeRandomSuffix}
                  onChange={(e) => setIncludeRandomSuffix(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span>Attach random 4-digit suffix at end (e.g. -4819)</span>
              </label>
              <p className="text-[11px] text-slate-400 pl-6 mt-0.5">
                Unchecked by default for clean, professional IDs (e.g. CUST-1001, INV-20261012).
              </p>
            </div>
          </div>

          {/* Generator Action Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-600/30 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Validating against Database...' : 'Generate Deterministic ID'}
          </button>

          {/* Generated Result Output */}
          {generatedId && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                    Generated & Verified Unique:
                  </span>
                  <span className="font-mono text-lg font-black text-emerald-900 dark:text-emerald-200">
                    {generatedId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/[0-9]{4}$/.test(generatedId) && (
                    <button
                      type="button"
                      onClick={handleRemoveRandomDigits}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold transition-colors"
                      title="Remove the 4-digit random number from the end"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Remove 4 Digits</span>
                    </button>
                  )}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
