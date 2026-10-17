import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Receipt,
  Truck,
  FileCheck2,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { AppNotification, getBrowserNotificationPermission, requestBrowserNotificationPermission } from '../../utils/notificationService';

interface CustomerNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToTab: (tab: 'TRACKING' | 'INVOICES' | 'WARRANTY' | 'LEDGER' | 'QUOTES', refId?: string) => void;
}

export const CustomerNotificationsModal: React.FC<CustomerNotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTab,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'SHIPMENT' | 'INVOICE' | 'QUOTATION'>('ALL');
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() =>
    getBrowserNotificationPermission()
  );
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  if (!isOpen) return null;

  const handleEnablePush = async () => {
    setIsRequestingPermission(true);
    try {
      const granted = await requestBrowserNotificationPermission();
      setPushPermission(granted ? 'granted' : 'denied');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    return n.type === filter;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'INVOICE':
        return <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'SHIPMENT':
        return <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'QUOTATION':
        return <FileCheck2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="relative p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                Updates & Notifications Log
                {unreadCount > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live delivery progress, invoice alerts, and quotation updates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Push Permission Banner */}
        {pushPermission !== 'granted' && (
          <div className="px-5 py-3 bg-linear-to-r from-red-50 via-rose-50 to-amber-50 dark:from-red-950/30 dark:via-rose-950/20 dark:to-amber-950/30 border-b border-red-200/60 dark:border-red-900/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Bell className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Turn on browser push notifications to receive instant updates when your order is out for delivery or invoice is created.
              </span>
            </div>
            <button
              onClick={handleEnablePush}
              disabled={isRequestingPermission}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] shrink-0 transition-all shadow-xs"
            >
              {isRequestingPermission ? 'Asking...' : 'Enable in App'}
            </button>
          </div>
        )}

        {/* Filter Pills and Action Bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                filter === 'ALL'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('SHIPMENT')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                filter === 'SHIPMENT'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Deliveries
            </button>
            <button
              onClick={() => setFilter('INVOICE')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                filter === 'INVOICE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setFilter('QUOTATION')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                filter === 'QUOTATION'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Quotations
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 shrink-0"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No notifications to display</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Your invoices, quotes, and delivery updates will appear here automatically.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onMarkAsRead(item.id);
                  if (item.linkTab) {
                    onNavigateToTab(item.linkTab, item.referenceId);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative group ${
                  !item.isRead
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 shadow-xs ring-1 ring-red-400/30'
                    : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {/* Icon Badge */}
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {item.title}
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shrink-0" />
                      )}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.message}
                  </p>
                  {item.linkTab && (
                    <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 group-hover:underline">
                      <span>View details in {item.linkTab.toLowerCase()}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
