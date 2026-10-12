import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Copy, CheckCircle2, UserCheck, Key } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminUidManager: React.FC = () => {
  const { adminUids, addAdminUid, removeAdminUid, currentUser } = useApp();
  const [newUidInput, setNewUidInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUidInput.trim()) return;
    setIsSubmitting(true);
    try {
      await addAdminUid(newUidInput.trim());
      setNewUidInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-red-600 dark:text-red-400" />
            Firebase Admin Access & UID List
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Stored in Firebase (`system/admins`). Only verified Google Auth users with matching UID or Super Admin email can access staff operations.
          </p>
        </div>

        {currentUser && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs">
            <Key className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-red-800 dark:text-red-300 block">Your Current UID:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{currentUser.uid}</span>
            </div>
            <button
              onClick={() => handleCopy(currentUser.uid)}
              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg"
              title="Copy your UID"
            >
              {copiedUid === currentUser.uid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Add New Admin UID Form */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <Plus className="w-4 h-4 text-red-600 dark:text-red-400" />
          Add Authorized Admin UID to Firebase
        </h3>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={newUidInput}
            onChange={(e) => setNewUidInput(e.target.value)}
            placeholder="Paste Firebase Auth UID (e.g. 29kdf92jf092jd...)"
            className="flex-1 text-xs font-mono px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm shadow-red-600/30 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Authorize UID'}
          </button>
        </form>
      </div>

      {/* List of Admin UIDs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Active Authorized Admin UIDs ({adminUids.length})
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Super Admin: mitanshrs@gmail.com
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {adminUids.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No custom admin UIDs registered yet. The bootstrap email (`mitanshrs@gmail.com`) retains full super admin privileges.
            </div>
          ) : (
            adminUids.map((uid, index) => (
              <div
                key={uid}
                className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-mono text-[10px] font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-xs break-all">
                      {uid}
                    </div>
                    {currentUser?.uid === uid && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                        (Your Current Logged-in Session)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(uid)}
                    className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Copy UID"
                  >
                    {copiedUid === uid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove admin UID: ${uid}?`)) {
                        removeAdminUid(uid);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title="Revoke Admin Access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Store GSTIN & Business Info Configuration */}
      <StoreGstConfigCard />

      {/* Google Cloud Console (cloud.google.com) & Firebase Direct Access Guide */}
      <GoogleCloudConsoleGuide />
    </div>
  );
};

const StoreGstConfigCard: React.FC = () => {
  const { gstNumber, updateGstNumber } = useApp();
  const [inputGstin, setInputGstin] = useState(gstNumber || '');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setInputGstin(gstNumber || '');
  }, [gstNumber]);

  const handleSaveGst = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateGstNumber(inputGstin.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            Lakhi Store Legal GSTIN (Tax Identification)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This GST number will automatically be printed on all official Tax Invoices, Quotations, and Storefront PDF downloads.
          </p>
        </div>
        {gstNumber && (
          <span className="font-mono text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 rounded-xl">
            Active: {gstNumber}
          </span>
        )}
      </div>

      <form onSubmit={handleSaveGst} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          required
          value={inputGstin}
          onChange={(e) => setInputGstin(e.target.value.toUpperCase())}
          placeholder="Enter 15-character GSTIN (e.g. 24AABCL9921L1Z4)"
          className="flex-1 text-xs font-mono uppercase px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm shadow-red-600/30 flex items-center justify-center gap-2"
        >
          {isSaving ? 'Saving...' : isSaved ? '✓ GSTIN Saved!' : 'Save Store GSTIN'}
        </button>
      </form>
    </div>
  );
};

const GoogleCloudConsoleGuide: React.FC = () => {
  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
        <Key className="w-5 h-5 text-amber-400" />
        How to Use cloud.google.com to View & Edit Database Records Directly
      </div>

      <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
        <p>
          You can use Google Cloud Console (<span className="text-white font-mono font-bold">cloud.google.com</span>) to view, edit, or modify any database record directly in Firestore:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1.5">
            <span className="font-bold text-white text-[11px] block">Step 1: Open Cloud Console</span>
            <p className="text-[11px] text-slate-400">
              Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">console.cloud.google.com</a> and sign in with your email (<span className="font-mono text-slate-300">mitanshrs@gmail.com</span>).
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1.5">
            <span className="font-bold text-white text-[11px] block">Step 2: Select Project</span>
            <p className="text-[11px] text-slate-400">
              In the top project dropdown, select project: <span className="font-mono text-amber-400 font-bold block">ai-studio-04b16a1c-f296-45cf-a36b-2ae75b83337a</span> or <span className="font-mono text-slate-300">high-dub-n14dk</span>.
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1.5">
            <span className="font-bold text-white text-[11px] block">Step 3: Edit in Firestore</span>
            <p className="text-[11px] text-slate-400">
              Type <strong className="text-white">Firestore</strong> in the top search bar. You can view, add, edit, or delete documents in <span className="font-mono text-slate-300">invoices</span>, <span className="font-mono text-slate-300">quotations</span>, <span className="font-mono text-slate-300">customers</span>, <span className="font-mono text-slate-300">inventory</span>, <span className="font-mono text-slate-300">payables</span>.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-2.5">
          <a
            href="https://console.cloud.google.com/firestore/databases/-default-/data/panel?project=ai-studio-04b16a1c-f296-45cf-a36b-2ae75b83337a"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
          >
            <span>Open Google Cloud Firestore Console</span>
            <span>↗</span>
          </a>
          <a
            href="https://console.firebase.google.com/project/high-dub-n14dk/firestore"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors border border-slate-700 flex items-center gap-1.5"
          >
            <span>Open Firebase Console (Visual Spreadsheet View)</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};
