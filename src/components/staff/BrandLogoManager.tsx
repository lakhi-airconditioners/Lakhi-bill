import React, { useState, useRef } from 'react';
import {
  Palette,
  Upload,
  Link as LinkIcon,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Smartphone,
  Globe,
  FileText,
  Sparkles,
  Layers,
  Save,
  Trash2,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LakhiLogo } from '../common/LakhiLogo';

// Helper to optimize and convert uploaded image files to high-quality compressed Base64 Data URL
const processUploadedImage = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  isSquare: boolean = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let targetWidth = img.naturalWidth;
        let targetHeight = img.naturalHeight;

        if (isSquare) {
          // Fit into square keeping aspect ratio
          const maxDim = Math.min(maxWidth, Math.max(targetWidth, targetHeight));
          const canvas = document.createElement('canvas');
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(readerEvent.target?.result as string);
            return;
          }

          // Center image with transparent background
          ctx.clearRect(0, 0, maxDim, maxDim);
          const scale = Math.min(maxDim / targetWidth, maxDim / targetHeight);
          const x = (maxDim - targetWidth * scale) / 2;
          const y = (maxDim - targetHeight * scale) / 2;
          ctx.drawImage(img, x, y, targetWidth * scale, targetHeight * scale);

          const dataUrl = canvas.toDataURL('image/png', 0.92);
          resolve(dataUrl);
        } else {
          // Standard proportional scale
          if (targetWidth > maxWidth) {
            targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
            targetWidth = maxWidth;
          }
          if (targetHeight > maxHeight) {
            targetWidth = Math.round((targetWidth * maxHeight) / targetHeight);
            targetHeight = maxHeight;
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(readerEvent.target?.result as string);
            return;
          }
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL('image/png', 0.92);
          resolve(dataUrl);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

// Built-in presets for quick preview or testing
const PRESET_ICONS = [
  {
    name: 'Lakhi Scarlet & Black',
    color: '#E01E26',
    dataUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="74" fill="%23111827"/><path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill="%23E01E26"/><circle cx="50" cy="80" r="27" stroke="%23FFFFFF" stroke-width="5.5" fill="none"/><path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="%23FFFFFF"/><path d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z" fill="%23FFFFFF"/></svg>',
  },
  {
    name: 'Arctic Cool Cyan',
    color: '#0284c7',
    dataUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="74" fill="%230f172a"/><path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill="%230ea5e9"/><circle cx="50" cy="80" r="27" stroke="%2338bdf8" stroke-width="5.5" fill="none"/><path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="%23e0f2fe"/><path d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z" fill="%23FFFFFF"/></svg>',
  },
  {
    name: 'Titanium Emerald',
    color: '#059669',
    dataUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="74" fill="%23064e3b"/><path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill="%2310b981"/><circle cx="50" cy="80" r="27" stroke="%236ee7b7" stroke-width="5.5" fill="none"/><path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="%23ecfdf5"/><path d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z" fill="%23FFFFFF"/></svg>',
  },
];

export const BrandLogoManager: React.FC = () => {
  const { brandLogos, updateBrandLogos, resetBrandLogo, theme } = useApp();

  // Local draft state for editing before saving, initialized with current logos
  const [logo1x1, setLogo1x1] = useState<string>(brandLogos.logo1x1 || '');
  const [logoMain, setLogoMain] = useState<string>(brandLogos.logoMain || '');
  const [logoWithWordmark, setLogoWithWordmark] = useState<string>(brandLogos.logoWithWordmark || '');

  // URL input states
  const [url1x1Input, setUrl1x1Input] = useState('');
  const [urlMainInput, setUrlMainInput] = useState('');
  const [urlWordmarkInput, setUrlWordmarkInput] = useState('');

  // Status & feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File input refs
  const file1x1Ref = useRef<HTMLInputElement>(null);
  const fileMainRef = useRef<HTMLInputElement>(null);
  const fileWordmarkRef = useRef<HTMLInputElement>(null);

  // Active preview tab: 'all' | 'header' | 'app' | 'invoice'
  const [previewContext, setPreviewContext] = useState<'all' | 'header' | 'app' | 'invoice'>('all');

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: '1x1' | 'main' | 'wordmark'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    try {
      if (type === '1x1') {
        const dataUrl = await processUploadedImage(file, 512, 512, true);
        setLogo1x1(dataUrl);
      } else if (type === 'main') {
        const dataUrl = await processUploadedImage(file, 600, 600, false);
        setLogoMain(dataUrl);
      } else {
        const dataUrl = await processUploadedImage(file, 1200, 360, false);
        setLogoWithWordmark(dataUrl);
      }
    } catch (err) {
      setErrorMessage(`Failed to process uploaded image: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await updateBrandLogos({
        logo1x1: logo1x1.trim(),
        logoMain: logoMain.trim(),
        logoWithWordmark: logoWithWordmark.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(`Failed to save to Firebase: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSingle = async (type: 'logo1x1' | 'logoMain' | 'logoWithWordmark') => {
    if (type === 'logo1x1') setLogo1x1('');
    if (type === 'logoMain') setLogoMain('');
    if (type === 'logoWithWordmark') setLogoWithWordmark('');
    await resetBrandLogo(type);
  };

  const handleResetAll = async () => {
    if (window.confirm('Reset all brand logos to the default Lakhi Airconditioners vectors?')) {
      setLogo1x1('');
      setLogoMain('');
      setLogoWithWordmark('');
      await resetBrandLogo('all');
    }
  };

  const hasUnsavedChanges =
    logo1x1 !== (brandLogos.logo1x1 || '') ||
    logoMain !== (brandLogos.logoMain || '') ||
    logoWithWordmark !== (brandLogos.logoWithWordmark || '');

  return (
    <div className="space-y-6">
      {/* Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Palette className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Brand & Logo Customizer
            </h2>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Cloud Synced
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
            Customize and update the 3 brand logos across the app: the <strong>App 1x1 Logo</strong> (app icon, favicon & PWA), the <strong>Main Logo</strong> (graphic mark/emblem), and the <strong>Main Logo with Word Lakhi</strong> (full horizontal banner wordmark).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleResetAll}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors flex items-center gap-1.5"
            title="Reset all logos to built-in vectors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || !hasUnsavedChanges}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 ${
              hasUnsavedChanges
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 animate-pulse'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Saving to Firebase...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Saved & Synced!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-600 shrink-0" />
            <span>You have unsaved logo changes. Click <strong>"Save Changes"</strong> to sync them to Firebase for all users.</span>
          </div>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shrink-0"
          >
            Save Now
          </button>
        </div>
      )}

      {/* Three Main Logo Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ======================================================== */}
        {/* CARD 1: App 1x1 Logo */}
        {/* ======================================================== */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                1:1 Square Ratio
              </span>
              {logo1x1 && (
                <button
                  onClick={() => handleResetSingle('logo1x1')}
                  className="text-[11px] text-red-600 hover:underline flex items-center gap-1 font-semibold"
                  title="Remove custom 1x1 logo"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              1. App 1x1 Logo
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Square app icon for mobile home screen, browser tab favicon, and square avatar tiles.
            </p>

            {/* Live Card Preview */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center space-y-3">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                  {logo1x1 ? (
                    <img src={logo1x1} alt="1x1 Logo Preview" className="w-full h-full object-contain" />
                  ) : (
                    <LakhiLogo size="lg" variant="icon" themeInvert={theme === 'dark'} />
                  )}
                </div>
                <span className="absolute -bottom-2 -right-2 px-1.5 py-0.5 rounded-md bg-slate-900 text-[9px] font-mono font-bold text-white shadow-xs">
                  1x1
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {logo1x1 ? 'Custom 1x1 Active' : 'Default SVG Icon'}
              </span>
            </div>
          </div>

          {/* Upload & Input Controls */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="file"
              ref={file1x1Ref}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => handleFileUpload(e, '1x1')}
              className="hidden"
            />
            <button
              onClick={() => file1x1Ref.current?.click()}
              className="w-full py-2.5 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl border border-blue-200 dark:border-blue-900/50 flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload 1x1 Image (PNG, JPG, SVG)
            </button>

            {/* Direct URL Input */}
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                value={url1x1Input}
                onChange={(e) => setUrl1x1Input(e.target.value)}
                placeholder="Or paste image URL..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={() => {
                  if (url1x1Input.trim()) {
                    setLogo1x1(url1x1Input.trim());
                    setUrl1x1Input('');
                  }
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-800 dark:text-slate-200"
              >
                Set
              </button>
            </div>

            {/* Quick Presets */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Presets:
              </span>
              <div className="flex items-center gap-2">
                {PRESET_ICONS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLogo1x1(preset.dataUrl)}
                    className="flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate"
                    title={preset.name}
                  >
                    {preset.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 2: Main Logo (Graphic Mark / Emblem) */}
        {/* ======================================================== */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                Graphic Mark / Emblem
              </span>
              {logoMain && (
                <button
                  onClick={() => handleResetSingle('logoMain')}
                  className="text-[11px] text-red-600 hover:underline flex items-center gap-1 font-semibold"
                  title="Remove custom main logo"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              2. Main Logo (Emblem)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Standalone graphic emblem or brand crest used across compact badges, stamp marks, and responsive layouts.
            </p>

            {/* Live Card Preview */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center space-y-3">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                  {logoMain ? (
                    <img src={logoMain} alt="Main Logo Preview" className="w-full h-full object-contain" />
                  ) : (
                    <LakhiLogo size="lg" variant="main" themeInvert={theme === 'dark'} />
                  )}
                </div>
                <span className="absolute -bottom-2 -right-2 px-1.5 py-0.5 rounded-md bg-emerald-700 text-[9px] font-mono font-bold text-white shadow-xs">
                  Emblem
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {logoMain ? 'Custom Emblem Active' : 'Default Emblem SVG'}
              </span>
            </div>
          </div>

          {/* Upload & Input Controls */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="file"
              ref={fileMainRef}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => handleFileUpload(e, 'main')}
              className="hidden"
            />
            <button
              onClick={() => fileMainRef.current?.click()}
              className="w-full py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Emblem (PNG, SVG, WebP)
            </button>

            {/* Direct URL Input */}
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                value={urlMainInput}
                onChange={(e) => setUrlMainInput(e.target.value)}
                placeholder="Or paste image URL..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={() => {
                  if (urlMainInput.trim()) {
                    setLogoMain(urlMainInput.trim());
                    setUrlMainInput('');
                  }
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-800 dark:text-slate-200"
              >
                Set
              </button>
            </div>

            {/* Quick Presets */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Presets:
              </span>
              <div className="flex items-center gap-2">
                {PRESET_ICONS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLogoMain(preset.dataUrl)}
                    className="flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate"
                    title={preset.name}
                  >
                    {preset.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 3: Main Logo with Word "Lakhi" (Horizontal Banner) */}
        {/* ======================================================== */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                Banner Wordmark (~3:1)
              </span>
              {logoWithWordmark && (
                <button
                  onClick={() => handleResetSingle('logoWithWordmark')}
                  className="text-[11px] text-red-600 hover:underline flex items-center gap-1 font-semibold"
                  title="Remove custom wordmark banner"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-600 dark:text-red-400" />
              3. Logo with Word "Lakhi"
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Full horizontal banner with emblem + "LAKHI AIRCONDITIONERS" wordmark. Used in header & invoices.
            </p>

            {/* Live Card Preview */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center space-y-3 min-h-[96px]">
              <div className="relative group w-full flex items-center justify-center">
                <div className="w-full max-w-[240px] h-16 rounded-2xl bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-102">
                  {logoWithWordmark ? (
                    <img
                      src={logoWithWordmark}
                      alt="Banner Logo Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : logoMain ? (
                    <div className="flex items-center gap-2">
                      <img src={logoMain} alt="Main" className="h-9 w-9 object-contain" />
                      <div className="flex flex-col leading-none">
                        <span className="font-black text-sm text-slate-900 dark:text-white">LAKHI</span>
                        <span className="font-extrabold text-[9px] text-red-600 italic">AIRCONDITIONERS</span>
                      </div>
                    </div>
                  ) : (
                    <LakhiLogo size="sm" variant="full" themeInvert={theme === 'dark'} />
                  )}
                </div>
                <span className="absolute -bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-red-700 text-[9px] font-mono font-bold text-white shadow-xs">
                  Full
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {logoWithWordmark ? 'Custom Banner Active' : 'Default Full Wordmark'}
              </span>
            </div>
          </div>

          {/* Upload & Input Controls */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="file"
              ref={fileWordmarkRef}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => handleFileUpload(e, 'wordmark')}
              className="hidden"
            />
            <button
              onClick={() => fileWordmarkRef.current?.click()}
              className="w-full py-2.5 px-3 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 font-bold text-xs rounded-xl border border-red-200 dark:border-red-900/50 flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Banner (PNG, SVG, WebP)
            </button>

            {/* Direct URL Input */}
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                value={urlWordmarkInput}
                onChange={(e) => setUrlWordmarkInput(e.target.value)}
                placeholder="Or paste banner URL..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={() => {
                  if (urlWordmarkInput.trim()) {
                    setLogoWithWordmark(urlWordmarkInput.trim());
                    setUrlWordmarkInput('');
                  }
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-800 dark:text-slate-200"
              >
                Set
              </button>
            </div>

            <p className="text-[10px] text-slate-400">
              💡 Tip: If left unset, the system combines your Main Logo with crisp vector typography automatically.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Real-World Live Interactive Preview Sandbox */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-red-600 dark:text-red-400" />
              Real-World Preview Sandbox
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preview how your brand logos look across real interface environments.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setPreviewContext('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                previewContext === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All Previews
            </button>
            <button
              onClick={() => setPreviewContext('header')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                previewContext === 'header'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Header
            </button>
            <button
              onClick={() => setPreviewContext('app')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                previewContext === 'app'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Mobile Icon & Favicon
            </button>
            <button
              onClick={() => setPreviewContext('invoice')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                previewContext === 'invoice'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Invoice Billhead
            </button>
          </div>
        </div>

        {/* Sandbox Previews */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          {/* Header Simulation */}
          {(previewContext === 'all' || previewContext === 'header') && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-500" /> Top Navigation Bar
                </span>
                <span className="text-[10px] text-slate-400">Desktop View</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                <div className="h-8 flex items-center">
                  {logoWithWordmark ? (
                    <img src={logoWithWordmark} alt="Preview" className="h-8 w-auto object-contain" />
                  ) : logoMain ? (
                    <div className="flex items-center gap-2">
                      <img src={logoMain} alt="Preview" className="h-8 w-8 object-contain rounded-lg" />
                      <div className="flex flex-col leading-none">
                        <span className="font-black text-sm text-slate-900 dark:text-white">LAKHI</span>
                        <span className="font-extrabold text-[8px] text-red-600 italic">AIRCONDITIONERS</span>
                      </div>
                    </div>
                  ) : (
                    <LakhiLogo size="sm" variant="full" themeInvert={theme === 'dark'} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 h-6 rounded-lg bg-slate-100 dark:bg-slate-800" />
                  <span className="w-6 h-6 rounded-lg bg-red-600" />
                </div>
              </div>
            </div>
          )}

          {/* Mobile Home Screen / Favicon Simulation */}
          {(previewContext === 'all' || previewContext === 'app') && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-500" /> Mobile App & Favicon
                </span>
                <span className="text-[10px] text-slate-400">Browser & PWA</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                {/* Simulated Phone Icon */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-md border border-slate-200 p-1 flex items-center justify-center overflow-hidden">
                    {logo1x1 ? (
                      <img src={logo1x1} alt="Icon" className="w-full h-full object-contain" />
                    ) : logoMain ? (
                      <img src={logoMain} alt="Icon" className="w-full h-full object-contain" />
                    ) : (
                      <LakhiLogo size="xs" variant="icon" />
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">Lakhi AC</span>
                </div>
                {/* Simulated Browser Tab */}
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <div className="w-4 h-4 shrink-0 rounded-xs overflow-hidden flex items-center justify-center">
                    {logo1x1 ? (
                      <img src={logo1x1} alt="Favicon" className="w-full h-full object-contain" />
                    ) : (
                      <LakhiLogo size="xs" variant="icon" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                    Lakhi Airconditioners...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Billhead Simulation */}
          {(previewContext === 'all' || previewContext === 'invoice') && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-red-500" /> Invoice Header
                </span>
                <span className="text-[10px] text-slate-400">PDF / Print</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {logoWithWordmark ? (
                    <img src={logoWithWordmark} alt="Billhead" className="h-7 w-auto object-contain" />
                  ) : logoMain ? (
                    <img src={logoMain} alt="Billhead" className="h-7 w-7 object-contain" />
                  ) : (
                    <LakhiLogo size="xs" variant="icon" />
                  )}
                  <div className="leading-tight">
                    <span className="text-[11px] font-black text-slate-900 dark:text-white block">
                      TAX INVOICE
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      INV-20261015-001
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                  PAID
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
