import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-amber-600 dark:bg-amber-700 px-3.5 py-2 text-xs font-bold text-white shadow-xl shadow-amber-600/30 animate-in fade-in slide-in-from-bottom-2 border border-amber-400/40">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Cached store data &amp; invoices available</span>
    </div>
  );
};
