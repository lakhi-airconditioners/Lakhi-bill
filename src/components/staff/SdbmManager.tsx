import React, { useState, useRef } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  Zap,
  Database,
  Download,
  Upload,
  Copy,
  Check,
  FileCode,
  FileText,
  Layers,
  Code,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ClipboardCheck,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SdbmWebAdapter, SdbmWebPayload, SDBM_BLUEPRINT_SAMPLE } from '../../utils/sdbmWebAdapter';
import { STORE_CONSTANTS } from '../../utils/leadNormalizationService';

export const SdbmManager: React.FC = () => {
  const {
    customers,
    inventory,
    invoices,
    quotations,
    shipments,
    transactions,
    claims,
    payables,
    addCustomer,
    createAnyDocument,
    deleteAnyDocument,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'blueprint'>('export');

  // Import State
  const [importInputText, setImportInputText] = useState('');
  const [importedPayload, setImportedPayload] = useState<SdbmWebPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitMessage, setCommitMessage] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Delete All Data Modal & Progress State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Store Payload
  const livePayloadData: Partial<SdbmWebPayload> = {
    storeInfo: {
      storeName: STORE_CONSTANTS.companyName,
      gstNumber: STORE_CONSTANTS.storeGstin,
      contactPhone: STORE_CONSTANTS.storeHelpline,
      baseDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      schemaVersion: '1.0.0',
    },
    customers,
    inventory,
    invoices,
    quotations,
    shipments,
    transactions,
  };

  const formattedLiveJson = SdbmWebAdapter.exportToJson(livePayloadData);
  const formattedLiveJs = SdbmWebAdapter.exportToJs(livePayloadData);

  // Handle Text / File Import
  const handleParseText = (text: string) => {
    setImportError(null);
    setImportSuccess(null);
    if (!text.trim()) {
      setImportedPayload(null);
      return;
    }
    try {
      const payload = SdbmWebAdapter.importFromText(text);
      setImportedPayload(payload);
      setImportSuccess(
        `Parsed SDBM Web Payload (${payload.customers.length} Customers, ${payload.inventory.length} Stock, ${payload.invoices.length} Invoices, ${payload.quotations.length} Quotations)`
      );
    } catch (err: any) {
      setImportError(`Invalid SDBM JSON structure: ${err.message}`);
      setImportedPayload(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setImportInputText(content);
      handleParseText(content);
    };
    reader.onerror = () => setImportError('Failed to read file from disk.');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setImportInputText(content);
      handleParseText(content);
    };
    reader.onerror = () => setImportError('Failed to read dropped file.');
    reader.readAsText(file);
  };

  // Helper to remove undefined properties before writing to Firestore in batch
  const cleanFirestorePayload = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.filter((item) => item !== undefined).map((item) => cleanFirestorePayload(item));
    }
    const cleaned: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (val !== undefined) {
        if (val !== null && typeof val === 'object') {
          cleaned[key] = cleanFirestorePayload(val);
        } else {
          cleaned[key] = val;
        }
      }
    });
    return cleaned;
  };

  // High-Speed Batch Commit Imported SDBM Payload to Firebase Firestore
  const handleCommitImport = async () => {
    if (!importedPayload) return;
    setIsCommitting(true);
    setCommitProgress(0);
    setCommitMessage('Preparing high-speed SDBM database commit...');
    setImportError(null);

    try {
      const docsToCommit: { collection: string; id: string; data: Record<string, any> }[] = [];

      // 1. Customers
      for (const c of importedPayload.customers) {
        const custId = c.id || c.customerId || `C-${Date.now()}`;
        const custData: Record<string, any> = {
          id: custId,
          externalName: c.externalName || c.name || 'Unnamed Customer',
          internalName: c.internalName || `${c.externalName || 'Customer'} (SDBM Import)`,
          phone: String(c.phone || c.phoneNumber || ''),
          email: c.email || '',
          billingAddress: c.billingAddress || c.address || '',
          installationAddress: c.installationAddress || c.billingAddress || '',
          accessPin: String(c.accessPin || '1234'),
          accountBalance: Number(c.accountBalance ?? c.openingBalance ?? 0),
        };
        if (c.createdAt !== undefined) custData.createdAt = c.createdAt;
        docsToCommit.push({ collection: 'customers', id: custId, data: custData });
      }

      // 2. Inventory (Deterministic Stock ID Preservation)
      for (const stk of importedPayload.inventory) {
        const stkId = stk.id || stk.stockId || `STK-${Date.now()}`;
        const sellingPrice = Number(stk.sellingPrice ?? stk.rate ?? stk.price ?? 0);
        const quantity = Number(stk.quantity ?? 1);

        const sanitizedStk: Record<string, any> = {
          ...stk,
          id: stkId,
          stockId: stkId,
          sku: stk.sku || `SKU-${stkId.slice(-6)}-01`,
          name: stk.name || stk.productFullName || 'Appliance Item',
          productFullName: stk.productFullName || stk.name || 'Appliance Item',
          modelNo: stk.modelNo || stk.name || '',
          indoorModelNo: stk.indoorModelNo || stk.indoorModel || '',
          outdoorModelNo: stk.outdoorModelNo || stk.outdoorModel || '',
          type: stk.applianceType || stk.type || 'AC',
          applianceType: stk.applianceType || stk.type || 'AC',
          brand: (stk.brand || 'DAIKIN').toUpperCase(),
          serialNo: stk.serialNo || stk.indoorUnitSerial || '',
          indoorUnitSerial: stk.indoorUnitSerial || '',
          outdoorUnitSerial: stk.outdoorUnitSerial || '',
          sellingPrice,
          rate: sellingPrice,
          price: sellingPrice,
          quantity,
          status: stk.status || 'AVAILABLE',
          stockState: stk.stockState || 'ava',
        };
        if (stk.createdAt !== undefined) sanitizedStk.createdAt = stk.createdAt;
        docsToCommit.push({ collection: 'inventory', id: stkId, data: sanitizedStk });
      }

      // 3. Invoices (Explicit Numeric Coercion & Date Preservation)
      for (const inv of importedPayload.invoices) {
        const invId = inv.id || inv.invoiceId || inv.billId || `I-${Date.now()}`;
        const totalAmount = Number(inv.totalAmount ?? inv.finalAmount ?? inv.calculation?.totalBill ?? 0);
        const subtotal = Number(inv.subtotal ?? inv.calculation?.subtotal ?? Math.round((totalAmount / 1.18) * 100) / 100);
        const taxAmount = Number(inv.taxAmount ?? inv.tax ?? inv.calculation?.tax ?? Math.round((totalAmount - subtotal) * 100) / 100);
        const discountAmount = Number(inv.discountAmount ?? 0);
        const roundOffAmount = Number(inv.roundOffAmount ?? 0);
        const totalPrepaid = Number(inv.totalPrepaid ?? totalAmount);
        const amountDue = Number(inv.amountDue ?? (totalAmount - totalPrepaid > 0 ? totalAmount - totalPrepaid : 0));

        const sanitizedItems = Array.isArray(inv.items)
          ? inv.items.map((it: any) => ({
              ...it,
              quantity: Number(it.quantity ?? 1),
              rate: Number(it.rate ?? it.amount ?? 0),
              taxPercent: Number(it.taxPercent ?? 18),
              lineTotal: Number(it.lineTotal ?? it.amount ?? 0),
            }))
          : [];

        const sanitizedInvoice: Record<string, any> = {
          ...inv,
          id: invId,
          invoiceId: invId,
          billId: invId,
          customBillId: inv.customBillId || inv.billNumber || invId,
          subtotal,
          taxAmount,
          tax: taxAmount,
          discountAmount,
          roundOffAmount,
          totalAmount,
          finalAmount: totalAmount,
          totalPrepaid,
          amountDue,
          paymentStatus: inv.paymentStatus || 'PAID',
          status: inv.status || 'COMPLETED',
          items: sanitizedItems,
        };
        if (inv.createdAt !== undefined) sanitizedInvoice.createdAt = inv.createdAt;
        if (inv.invoiceDate !== undefined) sanitizedInvoice.invoiceDate = inv.invoiceDate;
        docsToCommit.push({ collection: 'invoices', id: invId, data: sanitizedInvoice });
      }

      // 4. Quotations
      for (const q of importedPayload.quotations) {
        const qId = q.id || q.quotationId || `Q-${Date.now()}`;
        const totalAmount = Number(q.totalAmount ?? q.finalAmount ?? 0);
        const subtotal = Number(q.subtotal ?? Math.round((totalAmount / 1.18) * 100) / 100);
        const taxAmount = Number(q.taxAmount ?? q.tax ?? Math.round((totalAmount - subtotal) * 100) / 100);

        const sanitizedQuote: Record<string, any> = {
          ...q,
          id: qId,
          quotationId: qId,
          subtotal,
          taxAmount,
          totalAmount,
        };
        if (q.createdAt !== undefined) sanitizedQuote.createdAt = q.createdAt;
        docsToCommit.push({ collection: 'quotations', id: qId, data: sanitizedQuote });
      }

      // 5. Shipments
      for (const s of importedPayload.shipments) {
        const sId = s.id || s.deliveryId || `D-${Date.now()}`;
        const sanitizedShipment: Record<string, any> = {
          ...s,
          id: sId,
          deliveryId: sId,
          totalAmount: Number(s.totalAmount ?? 0),
        };
        if (s.createdAt !== undefined) sanitizedShipment.createdAt = s.createdAt;
        docsToCommit.push({ collection: 'shipments', id: sId, data: sanitizedShipment });
      }

      // 6. Transactions
      for (const tx of importedPayload.transactions) {
        const txId = tx.id || tx.transId || `T-${Date.now()}`;
        const amount = Number(tx.amountInflow ?? tx.amount ?? 0);

        const sanitizedTransaction: Record<string, any> = {
          ...tx,
          id: txId,
          transId: txId,
          amountInflow: amount,
          amount: amount,
        };
        if (tx.createdAt !== undefined) sanitizedTransaction.createdAt = tx.createdAt;
        docsToCommit.push({ collection: 'transactions', id: txId, data: sanitizedTransaction });
      }

      // Firestore writeBatch supports up to 500 operations per batch
      const BATCH_SIZE = 400;
      let committedCount = 0;
      const totalItems = docsToCommit.length;

      for (let i = 0; i < totalItems; i += BATCH_SIZE) {
        const chunk = docsToCommit.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const item of chunk) {
          batch.set(doc(db, item.collection, item.id), cleanFirestorePayload(item.data));
        }

        setCommitMessage(`Writing batch ${Math.floor(i / BATCH_SIZE) + 1} (${committedCount + 1}-${Math.min(committedCount + chunk.length, totalItems)} of ${totalItems})...`);
        await batch.commit();

        committedCount += chunk.length;
        const pct = totalItems > 0 ? Math.round((committedCount / totalItems) * 100) : 100;
        setCommitProgress(pct);
      }

      setCommitProgress(100);
      setImportSuccess(`Successfully committed all ${totalItems} SDBM records to live store database!`);
    } catch (err: any) {
      setImportError(`Commit failed: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // High-Speed Batch Delete All Data Function with Live Progress Bar
  const handleDeleteAllData = async () => {
    setIsDeleting(true);
    setDeleteProgress(0);
    setDeleteMessage('Gathering store items for high-speed batch deletion...');
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      const allTasks: { collection: string; id: string; name: string }[] = [
        ...customers.map((c) => ({ collection: 'customers', id: c.id, name: c.externalName || c.id })),
        ...inventory.map((i) => ({ collection: 'inventory', id: i.id, name: i.name || i.id })),
        ...invoices.map((inv) => ({ collection: 'invoices', id: inv.id, name: inv.id })),
        ...quotations.map((q) => ({ collection: 'quotations', id: q.id, name: q.id })),
        ...shipments.map((s) => ({ collection: 'shipments', id: s.id, name: s.id })),
        ...transactions.map((t) => ({ collection: 'transactions', id: t.id, name: t.id })),
        ...claims.map((cl) => ({ collection: 'claims', id: cl.id, name: cl.id })),
        ...payables.map((p) => ({ collection: 'payables', id: p.id, name: p.vendorName || p.id })),
      ];

      const total = allTasks.length;
      if (total === 0) {
        setDeleteProgress(100);
        setDeleteSuccess('Store database is already completely empty.');
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
        return;
      }

      // Firestore writeBatch supports up to 500 operations per commit
      const BATCH_SIZE = 400;
      let deletedCount = 0;

      for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
        const chunk = allTasks.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const task of chunk) {
          batch.delete(doc(db, task.collection, task.id));
        }

        setDeleteMessage(`Deleting batch ${Math.floor(i / BATCH_SIZE) + 1} (${deletedCount + 1}-${Math.min(deletedCount + chunk.length, total)} of ${total})...`);
        await batch.commit();

        deletedCount += chunk.length;
        const pct = Math.round((deletedCount / total) * 100);
        setDeleteProgress(pct);
      }

      // Clear local storage cache
      try {
        ['customers', 'inventory', 'invoices', 'quotations', 'shipments', 'transactions', 'claims', 'payables'].forEach((key) => {
          localStorage.removeItem(`lakhi_cache_${key}`);
        });
      } catch {}

      setDeleteProgress(100);
      setDeleteSuccess(`Successfully deleted all ${total} records from store database in high-speed batch!`);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setDeleteError(`Deletion error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (content: string, type: string) => {
    navigator.clipboard.writeText(content);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const totalStoreRecords =
    customers.length +
    inventory.length +
    invoices.length +
    quotations.length +
    shipments.length +
    transactions.length +
    claims.length +
    payables.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/40 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-mono text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 fill-current" />
                SDBM_v1.0_WEB ADAPTER
              </span>
              <span className="text-xs font-mono text-amber-200 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
                Schema Version 1.0.0
              </span>
            </div>
            <h2 className="text-2xl font-black mt-2 text-white flex items-center gap-2">
              <span>⚡ SDBM Web Data Hub</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Export live store database snapshots, import web JSON payloads or AI Studio text responses, inspect the official SDBM Web schema, or reset store data.
            </p>
          </div>

          {/* Delete All Data Header Action Button */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All Data ({totalStoreRecords})</span>
            </button>

            <div className="text-[11px] font-mono text-slate-400">
              GSTIN: <span className="text-white font-bold">{STORE_CONSTANTS.storeGstin}</span>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 font-sans">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Live Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import Payload / Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('blueprint')}
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'blueprint'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Schema Blueprint</span>
          </button>
        </div>
      </div>

      {/* Global Delete Notification Banner */}
      {deleteSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccess}</span>
          </div>
          <button onClick={() => setDeleteSuccess(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {deleteError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button onClick={() => setDeleteError(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: EXPORT LIVE STORE DATA */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-amber-600" />
                  <span>Export Live Store Database Snapshot</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Download live store collections formatted as <code className="font-mono text-amber-600 dark:text-amber-400">SDBM_v1.0_WEB</code>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    SdbmWebAdapter.downloadFile(formattedLiveJson, 'SDBM_Web_Export.json', 'application/json')
                  }
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    SdbmWebAdapter.downloadFile(formattedLiveJs, 'SDBM_Web_Export.js', 'application/javascript')
                  }
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-amber-500/40 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span>Download .JS Module</span>
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(formattedLiveJson, 'json')}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  {copiedType === 'json' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedType === 'json' ? 'Copied JSON!' : 'Copy Prompt JSON'}</span>
                </button>
              </div>
            </div>

            {/* Counts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-amber-600 dark:text-amber-400 font-black text-base">{customers.length}</div>
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Customers</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-emerald-600 dark:text-emerald-400 font-black text-base">{inventory.length}</div>
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Inventory</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-blue-600 dark:text-blue-400 font-black text-base">{invoices.length}</div>
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Invoices</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-purple-600 dark:text-purple-400 font-black text-base">{quotations.length}</div>
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Quotations</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-teal-600 dark:text-teal-400 font-black text-base">{shipments.length}</div>
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Shipments</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-rose-600 dark:text-rose-400 font-black text-base">{transactions.length}</div>
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Transactions</div>
              </div>
            </div>
          </div>

          {/* JSON Preview Console */}
          <div className="bg-slate-950 text-slate-200 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-amber-400 font-bold flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Live Payload Preview (SDBM_v1.0_WEB)
              </span>
              <span className="text-[11px] text-slate-400">
                {(formattedLiveJson.length / 1024).toFixed(1)} KB
              </span>
            </div>

            <pre className="max-h-96 overflow-y-auto p-4 bg-slate-900 rounded-2xl border border-slate-800/80 text-[11px] leading-relaxed text-slate-300">
              {formattedLiveJson}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT PAYLOAD / TEXT */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-600" />
              <span>Import SDBM File or AI Studio Text Response</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload an <code className="font-mono text-amber-600 dark:text-amber-400">.json</code> file or paste raw JSON / AI Studio chat response text directly into the box below. <code className="font-mono">SdbmWebAdapter.importFromText()</code> automatically strips markdown code fences and conversational preamble.
            </p>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-800/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.js,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="w-10 h-10 text-amber-600 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drop .json / .js file here
              </div>
            </div>

            {/* Raw Text Input Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Or Paste SDBM Raw JSON / AI Studio Response Text:
              </label>
              <textarea
                value={importInputText}
                onChange={(e) => {
                  setImportInputText(e.target.value);
                  handleParseText(e.target.value);
                }}
                rows={6}
                placeholder={`Paste JSON or AI response here (e.g. {\n  "system": "SDBM_v1.0_WEB",\n  "customers": [...],\n  "inventory": [...]\n})`}
                className="w-full font-mono text-xs p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Error / Success Alerts */}
            {importError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            {/* Commit Button */}
            {importedPayload && (
              <div className="pt-2 flex items-center justify-between flex-wrap gap-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                  Ready to commit: <strong className="text-amber-600 dark:text-amber-400">{importedPayload.customers.length}</strong> customers, <strong className="text-emerald-600 dark:text-emerald-400">{importedPayload.inventory.length}</strong> stock items, <strong className="text-blue-600 dark:text-blue-400">{importedPayload.invoices.length}</strong> invoices.
                </div>

                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={isCommitting}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  <span>{isCommitting ? 'Committing to Store...' : 'Commit & Upsert SDBM Data to Firebase'}</span>
                </button>
              </div>
            )}

            {/* Commit Progress */}
            {isCommitting && (
              <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold">{commitMessage}</span>
                  <span className="text-emerald-400">{commitProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-150"
                    style={{ width: `${commitProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SCHEMA BLUEPRINT VIEWER */}
      {activeTab === 'blueprint' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-amber-600" />
                  <span>SDBM Web Schema Specification Blueprint</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard sample blueprint for <code className="font-mono text-amber-600 dark:text-amber-400">SDBM_v1.0_WEB</code> format.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(SDBM_BLUEPRINT_SAMPLE, null, 2), 'blueprint')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {copiedType === 'blueprint' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedType === 'blueprint' ? 'Copied Blueprint!' : 'Copy Sample Blueprint'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    SdbmWebAdapter.downloadFile(
                      JSON.stringify(SDBM_BLUEPRINT_SAMPLE, null, 2),
                      'SDBM_Blueprint_Sample.json',
                      'application/json'
                    )
                  }
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-amber-500/40 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Download Sample</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 text-slate-200 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-amber-400 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                SDBM_v1.0_WEB Blueprint Reference
              </span>
              <span className="text-[11px] text-slate-400">Sample Specification</span>
            </div>

            <pre className="max-h-[500px] overflow-y-auto p-4 bg-slate-900 rounded-2xl border border-slate-800/80 text-[11px] leading-relaxed text-emerald-400">
              {JSON.stringify(SDBM_BLUEPRINT_SAMPLE, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* CONFIRMATION & PROGRESS MODAL FOR DELETING ALL STORE DATA */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>Delete All Store Data?</span>
              </div>
              {!isDeleting && (
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {!isDeleting ? (
              <div className="space-y-4 text-xs leading-relaxed">
                <p className="text-slate-600 dark:text-slate-300">
                  Are you sure you want to permanently delete <strong className="text-red-600 font-bold">{totalStoreRecords} records</strong> across all 8 store collections (Customers, Stock, Invoices, Quotations, Shipments, Transactions, Claims, Payables)?
                </p>
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-2xl text-red-800 dark:text-red-300 font-medium">
                  ⚠️ This action cannot be undone. All database documents and cached store history will be erased.
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteAllData}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm &amp; Delete All</span>
                  </button>
                </div>
              </div>
            ) : (
              /* LIVE DELETION PROGRESS BAR */
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-red-600 dark:text-red-400 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 animate-bounce" />
                    {deleteMessage}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">{deleteProgress}%</span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div
                    className="bg-gradient-to-r from-red-600 via-amber-500 to-rose-500 h-full transition-all duration-150"
                    style={{ width: `${deleteProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
