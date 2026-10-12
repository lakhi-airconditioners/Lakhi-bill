import React from 'react';
import { X, Download, FileText, Printer } from 'lucide-react';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  downloadUrl?: string;
  filename: string;
  title?: string;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  downloadUrl,
  filename,
  title = 'Document Preview',
}) => {
  if (!isOpen || !pdfUrl) return null;

  const handleDownload = () => {
    const targetUrl = downloadUrl || pdfUrl;
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = filename;
      a.click();
    }
  };

  const handlePrint = () => {
    const targetUrl = downloadUrl || pdfUrl;
    const printWindow = window.open(targetUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
      // Allow browser viewer to render before printing
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.warn('Auto-print prevented by browser policy; user can print from new tab', e);
        }
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl h-[94vh] sm:h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-base truncate">{title}</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{filename}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] sm:text-xs font-bold rounded-xl transition-colors shadow-sm"
              title="Print document"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-xs font-bold rounded-xl transition-colors shadow-sm shadow-red-600/30"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Frame */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden">
          <iframe
            src={pdfUrl}
            title={title}
            className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
