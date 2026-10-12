import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon,
  HardDrive,
  Cloud,
  Globe,
  ExternalLink,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PdfProviderType } from '../../types';
import {
  extractGoogleDriveId,
  buildGoogleDriveLinks,
  buildOneDriveLinks,
  detectProviderFromUrl,
} from '../../utils/cloudPdfHelper';

interface CloudPdfLinkSelectorProps {
  initialProvider?: PdfProviderType;
  initialDriveId?: string;
  initialViewLink?: string;
  initialDownloadLink?: string;
  onChange: (data: {
    provider: PdfProviderType;
    driveId?: string;
    viewLink: string;
    downloadLink: string;
  }) => void;
  title?: string;
  description?: string;
}

export const CloudPdfLinkSelector: React.FC<CloudPdfLinkSelectorProps> = ({
  initialProvider,
  initialDriveId,
  initialViewLink,
  initialDownloadLink,
  onChange,
  title = 'Invoice PDF Document Linking',
  description = 'Link your tax invoice PDF from Google Drive, OneDrive, or any cloud storage.',
}) => {
  // Determine starting provider
  const initialResolvedProvider =
    initialProvider && initialProvider !== 'none'
      ? initialProvider
      : initialViewLink
      ? detectProviderFromUrl(initialViewLink)
      : 'google_drive';

  const [provider, setProvider] = useState<PdfProviderType>(initialResolvedProvider);

  // Raw inputs
  const [googleInput, setGoogleInput] = useState(
    initialDriveId || initialViewLink || ''
  );
  const [oneDriveInput, setOneDriveInput] = useState(
    initialProvider === 'onedrive' ? initialViewLink || '' : ''
  );
  const [otherViewInput, setOtherViewInput] = useState(
    initialProvider === 'other' ? initialViewLink || '' : ''
  );
  const [otherDownloadInput, setOtherDownloadInput] = useState(
    initialProvider === 'other' ? initialDownloadLink || '' : ''
  );

  // Sync state upward whenever provider or inputs change
  useEffect(() => {
    if (provider === 'google_drive') {
      const driveId = extractGoogleDriveId(googleInput);
      if (driveId) {
        const links = buildGoogleDriveLinks(driveId);
        onChange({
          provider: 'google_drive',
          driveId,
          viewLink: links.viewLink,
          downloadLink: links.downloadLink,
        });
      } else {
        onChange({
          provider: 'google_drive',
          driveId: '',
          viewLink: googleInput.trim(),
          downloadLink: googleInput.trim(),
        });
      }
    } else if (provider === 'onedrive') {
      const links = buildOneDriveLinks(oneDriveInput);
      onChange({
        provider: 'onedrive',
        driveId: undefined,
        viewLink: links.viewLink,
        downloadLink: links.downloadLink,
      });
    } else if (provider === 'other') {
      onChange({
        provider: 'other',
        driveId: undefined,
        viewLink: otherViewInput.trim(),
        downloadLink: (otherDownloadInput || otherViewInput).trim(),
      });
    } else {
      onChange({
        provider: 'none',
        driveId: undefined,
        viewLink: '',
        downloadLink: '',
      });
    }
  }, [provider, googleInput, oneDriveInput, otherViewInput, otherDownloadInput]);

  const detectedGoogleId = extractGoogleDriveId(googleInput);
  const googleLinks = detectedGoogleId ? buildGoogleDriveLinks(detectedGoogleId) : null;
  const oneDriveLinks = oneDriveInput ? buildOneDriveLinks(oneDriveInput) : null;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {title}
          </h4>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      </div>

      {/* Provider Selector Tabs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setProvider('google_drive')}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
            provider === 'google_drive'
              ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Google Drive</span>
          <span className="text-[9px] px-1 py-0.2 bg-white/20 dark:bg-slate-700/60 rounded uppercase tracking-wider font-mono">
            Auto
          </span>
        </button>

        <button
          type="button"
          onClick={() => setProvider('onedrive')}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
            provider === 'onedrive'
              ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>OneDrive</span>
          <span className="text-[9px] px-1 py-0.2 bg-white/20 dark:bg-slate-700/60 rounded uppercase tracking-wider font-mono">
            Auto
          </span>
        </button>

        <button
          type="button"
          onClick={() => setProvider('other')}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
            provider === 'other'
              ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Other Link</span>
        </button>
      </div>

      {/* Google Drive Option */}
      {provider === 'google_drive' && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Google Drive View Link or File ID:
            </label>
            <div className="relative">
              <input
                type="text"
                value={googleInput}
                onChange={(e) => setGoogleInput(e.target.value)}
                placeholder="Paste link: https://drive.google.com/file/d/1BxiMVs.../view or file ID"
                className="w-full pl-3 pr-20 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              />
              {googleInput && (
                <button
                  type="button"
                  onClick={() => setGoogleInput('')}
                  className="absolute right-2 top-2 text-[10px] text-slate-400 hover:text-red-500 px-1.5 py-0.5 rounded"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Tip: Paste the Google Drive "Anyone with the link can view" link or raw ID. The system automatically extracts the ID and generates both View & Direct Download links!
            </p>
          </div>

          {detectedGoogleId ? (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Auto-detected Google Drive File ID:
                </span>
                <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 text-[11px]">
                  {detectedGoogleId}
                </span>
              </div>

              {googleLinks && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <a
                    href={googleLinks.viewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between hover:bg-emerald-50/50 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-1 font-semibold truncate">
                      <Eye className="w-3 h-3 text-red-500 shrink-0" />
                      View PDF Link
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                  </a>

                  <a
                    href={googleLinks.downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between hover:bg-emerald-50/50 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-1 font-semibold truncate">
                      <Download className="w-3 h-3 text-emerald-600 shrink-0" />
                      Direct Download Link
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          ) : googleInput.trim() ? (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Using raw URL as link.</span>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                  Make sure it starts with https://drive.google.com/file/d/ or provides an open id.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* OneDrive Option */}
      {provider === 'onedrive' && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              OneDrive View / Share Link:
            </label>
            <input
              type="text"
              value={oneDriveInput}
              onChange={(e) => setOneDriveInput(e.target.value)}
              placeholder="e.g., https://1drv.ms/b/s!Amx... or https://onedrive.live.com/..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Tip: Paste the OneDrive or SharePoint share link. The system will automatically derive a direct download link using ?download=1.
            </p>
          </div>

          {oneDriveLinks && oneDriveLinks.viewLink && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2">
              <span className="flex items-center gap-1.5 text-xs text-blue-800 dark:text-blue-300 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                OneDrive Auto-Configured:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <a
                  href={oneDriveLinks.viewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-1 font-semibold truncate">
                    <Eye className="w-3 h-3 text-blue-600 shrink-0" />
                    View Link
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                </a>

                <a
                  href={oneDriveLinks.downloadLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-1 font-semibold truncate">
                    <Download className="w-3 h-3 text-blue-600 shrink-0" />
                    Auto Download Link
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other Option */}
      {provider === 'other' && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              View Link (PDF Viewer / Cloud URL):
            </label>
            <input
              type="text"
              value={otherViewInput}
              onChange={(e) => setOtherViewInput(e.target.value)}
              placeholder="e.g., https://my-cloud.com/invoices/inv-001.pdf"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Download Link (Direct File Download URL):
            </label>
            <input
              type="text"
              value={otherDownloadInput}
              onChange={(e) => setOtherDownloadInput(e.target.value)}
              placeholder="e.g., https://my-cloud.com/invoices/inv-001.pdf?dl=1"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Leave download link empty to use the View Link for both viewing and downloading.
            </p>
          </div>

          {otherViewInput.trim() && (
            <div className="flex gap-2 pt-1 text-[11px]">
              <a
                href={otherViewInput}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-red-600"
              >
                <Eye className="w-3 h-3" />
                Test View Link
              </a>
              {otherDownloadInput.trim() && (
                <a
                  href={otherDownloadInput}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-emerald-600"
                >
                  <Download className="w-3 h-3" />
                  Test Download Link
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
