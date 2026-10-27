import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Database,
  Users,
  FileCode,
  FileText,
  Zap,
  CheckCircle2,
  AlertCircle,
  Truck,
  Receipt,
  Package,
  Layers,
  Calendar,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  normalizeTallyToLeadData,
  generateLeadCompleteSystemTxt,
  generateLeadCompleteSystemJs,
  STORE_CONSTANTS,
} from '../../utils/leadNormalizationService';
import { formatCurrency } from '../../utils/currencyHelper';
import { LeadCompleteSystemData } from '../../types';

export const TallyPrimeManager: React.FC = () => {
  const { addCustomer, addInventoryItem, addPayable, createAnyDocument } = useApp();

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  const [dragOver, setDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileContentRaw, setFileContentRaw] = useState<string>('');
  const [leadNormalizedData, setLeadNormalizedData] = useState<LeadCompleteSystemData | null>(null);

  // Active sub-tab in Step 2 Review Data
  const [reviewTab, setReviewTab] = useState<
    'invoices' | 'deliveries' | 'inflows' | 'customers' | 'vendors' | 'stock'
  >('invoices');

  // Sync / Ingestion state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressText, setSyncProgressText] = useState<string>('');
  const [syncProgressPercent, setSyncProgressPercent] = useState<number>(0);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing incoming file
  const processLeadFileText = (text: string, filename: string) => {
    setUploadedFileName(filename);
    setFileContentRaw(text);
    setSyncErrorMessage(null);
    setSyncSuccessMessage(null);

    const leadNormalized = normalizeTallyToLeadData(text);
    setLeadNormalizedData(leadNormalized);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncErrorMessage(null);
    setSyncSuccessMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processLeadFileText(text, file.name);
    };
    reader.onerror = () => {
      setSyncErrorMessage('Could not read LA-D file from system.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setSyncErrorMessage(null);
    setSyncSuccessMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processLeadFileText(text, file.name);
    };
    reader.onerror = () => {
      setSyncErrorMessage('Could not read dropped file.');
    };
    reader.readAsText(file);
  };

  const currentData: LeadCompleteSystemData =
    leadNormalizedData || normalizeTallyToLeadData(fileContentRaw || '');

  // Commit and Upsert Data to Store with Live Progress Bar
  const handleCommitToStore = async () => {
    setIsSyncing(true);
    setSyncErrorMessage(null);
    setSyncSuccessMessage(null);
    setSyncProgressPercent(0);

    const totalItems =
      currentData.customers.length +
      currentData.vendors.length +
      currentData.storeStock.length +
      currentData.invoices.length +
      currentData.deliveries.length +
      currentData.transactions.length;

    if (totalItems === 0) {
      setSyncErrorMessage('No items to sync in the ingested dataset.');
      setIsSyncing(false);
      return;
    }

    let processedCount = 0;

    const updateProgress = (message: string) => {
      processedCount++;
      const pct = Math.min(100, Math.round((processedCount / totalItems) * 100));
      setSyncProgressPercent(pct);
      setSyncProgressText(message);
    };

    try {
      // 1. Sync Customers
      let custIdx = 0;
      for (const c of currentData.customers) {
        custIdx++;
        updateProgress(`Syncing Customer (${custIdx}/${currentData.customers.length}): ${c.externalName}`);
        await addCustomer({
          externalName: c.externalName,
          internalName: c.internalName,
          phone: c.phone,
          email: c.email || '',
          billingAddress: c.billingAddress,
          installationAddress: c.installationAddress,
          gstin: c.gstin || '',
          accessPin: c.accessPin,
          accountBalance: c.currentBalance || c.openingBalance || 0,
          notes: `LA-D System File Sync (ID: ${c.id})`,
        }, c.id);
        await new Promise((r) => setTimeout(r, 15));
      }

      // 2. Sync Vendors (Payables)
      let vIdx = 0;
      for (const v of currentData.vendors) {
        vIdx++;
        updateProgress(`Syncing Payable Vendor (${vIdx}/${currentData.vendors.length}): ${v.vendorName}`);
        await addPayable({
          vendorName: v.vendorName,
          vendorPhone: v.partyPhone,
          billOrderReferenceNo: v.billOrderReferenceNo,
          amount: v.amountWeOwe,
          amountWeOwe: v.amountWeOwe,
          category: v.category as any,
          targetDueDate: v.targetDueDate,
          status: 'PENDING',
          notes: `LA-D Vendor Category [${v.category}] (ID: ${v.id})`,
        });
        await new Promise((r) => setTimeout(r, 15));
      }

      // 3. Sync Store Stock
      let stkIdx = 0;
      for (const stk of currentData.storeStock) {
        stkIdx++;
        updateProgress(`Syncing Stock Item (${stkIdx}/${currentData.storeStock.length}): ${stk.name}`);
        await addInventoryItem({
          name: stk.name,
          modelNo: stk.modelNo,
          indoorModelNo: stk.indoorModel,
          outdoorModelNo: stk.outdoorModel,
          type: stk.type,
          brand: stk.brand,
          serialNo: stk.serialNo,
          indoorUnitSerial: stk.indoorUnitSerial,
          outdoorUnitSerial: stk.outdoorUnitSerial,
          sellingPrice: stk.sellingPrice,
          stockId: stk.id,
        });
        await new Promise((r) => setTimeout(r, 15));
      }

      // 4. Sync Invoices
      let invIdx = 0;
      for (const inv of currentData.invoices) {
        invIdx++;
        updateProgress(`Syncing Invoice (${invIdx}/${currentData.invoices.length}): ${inv.id}`);
        await createAnyDocument('invoices', inv, inv.id);
        await new Promise((r) => setTimeout(r, 15));
      }

      // 5. Sync Delivery Challans
      let delIdx = 0;
      for (const del of currentData.deliveries) {
        delIdx++;
        updateProgress(`Syncing Delivery (${delIdx}/${currentData.deliveries.length}): ${del.id}`);
        await createAnyDocument('shipments', del, del.id);
        await new Promise((r) => setTimeout(r, 15));
      }

      // 6. Sync Receipts / Transactions
      let txIdx = 0;
      for (const tx of currentData.transactions) {
        txIdx++;
        updateProgress(`Syncing Receipt (${txIdx}/${currentData.transactions.length}): ${tx.id}`);
        await createAnyDocument('transactions', tx, tx.id);
        await new Promise((r) => setTimeout(r, 15));
      }

      setSyncProgressPercent(100);
      setSyncSuccessMessage(
        `Successfully upserted ${totalItems} LA-D records (${currentData.customers.length} Debtors, ${currentData.vendors.length} Creditors, ${currentData.invoices.length} Invoices, ${currentData.deliveries.length} Deliveries, ${currentData.transactions.length} Receipts, ${currentData.storeStock.length} Stock items) into store system!`
      );
    } catch (err: any) {
      setSyncErrorMessage(`Error during store sync: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Profile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-3xl p-6 border border-amber-500/30 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 font-mono text-xs font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                LA-D 4.0 FILE CONVERTER
              </span>
              <span className="text-xs font-mono text-amber-200/90 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
                Format Regex: ^(I|Q|STK|D|C|T|V)[0-9]{8}[0-9]{4}$
              </span>
            </div>
            <h3 className="text-xl font-black mt-2 text-white flex items-center gap-2">
              <span>⚡ LA-D System Data Hub &amp; Ingestion Wizard</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Ingest, normalize, and inspect Lakhi Electronics store datasets (`.lad`, `.json`, `.txt`, `.js`, `.xml`, `.csv`).
              Auto-generates linked Invoices (`I`), Delivery Challans (`D`), and Receipts (`T`) from nested bill allocations.
            </p>
          </div>

          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-700/80 text-[11px] font-mono space-y-1 shrink-0">
            <div className="text-amber-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              STORE PROFILE
            </div>
            <div>GSTIN: <span className="text-white font-bold">{STORE_CONSTANTS.storeGstin}</span></div>
            <div>Helpline: <span className="text-white font-bold">{STORE_CONSTANTS.storeHelpline}</span></div>
            <div className="pt-1 border-t border-slate-800 text-amber-300 font-bold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-400" />
              Date Key: <span className="text-white underline">{currentData.dateKey}</span>
            </div>
          </div>
        </div>

        {/* 3-Step Wizard Control Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 font-sans">
          <button
            type="button"
            onClick={() => setWizardStep(1)}
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              wizardStep === 1
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Step 1: Ingest File</span>
          </button>

          <button
            type="button"
            onClick={() => setWizardStep(2)}
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              wizardStep === 2
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Step 2: Review 6 Modules</span>
          </button>

          <button
            type="button"
            onClick={() => setWizardStep(3)}
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              wizardStep === 3
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Step 3: Export &amp; Sync</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {syncSuccessMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncSuccessMessage}</span>
        </div>
      )}

      {syncErrorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-2xl text-xs font-bold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{syncErrorMessage}</span>
        </div>
      )}

      {/* STEP 1: INGEST FILE */}
      {wizardStep === 1 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>Ingest Tally / LA-D Dataset File (.xml, .csv, .json, .txt, .lad, .js)</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select or drop your legacy Tally XML or standardized LA-D system file. Dynamic date key detection automatically resolves keying parameters.
                </p>
              </div>

              {uploadedFileName && (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {uploadedFileName}
                </span>
              )}
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-800/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.csv,.json,.txt,.lad,.js"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="w-12 h-12 text-amber-600 mx-auto mb-3" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drop Master.xml / Tally XML or LA-D file here
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Auto-resolves Date Key (YYYYMMDD) and generates Invoices (I), Deliveries (D), Receipts (T), Debtors (C), Creditors (V), and Stock (STK).
              </div>
            </div>
          </div>

          {/* Ingestion & Normalization Log Console */}
          <div className="bg-slate-950 text-slate-200 rounded-3xl p-6 border border-slate-800 shadow-lg font-mono text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-amber-400 font-bold flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                LA-D Dynamic Date Key &amp; Extraction Log
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                Date Key: {currentData.dateKey}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-300 max-h-48 overflow-y-auto leading-relaxed">
              <div className="text-emerald-400">✓ Ingestion Engine Initialized. Base Date Key resolved dynamically: {currentData.dateKey}</div>
              <div className="text-slate-400">→ Debtors Parsed (Sundry Debtors): <span className="text-amber-300 font-bold">{currentData.customers.length} records</span></div>
              <div className="text-slate-400">→ Creditors Parsed (Sundry Creditors): <span className="text-blue-300 font-bold">{currentData.vendors.length} records</span></div>
              <div className="text-slate-400">→ Store Stock Parsed: <span className="text-emerald-300 font-bold">{currentData.storeStock.length} items</span></div>
              <div className="text-emerald-400">✓ Auto-generated Linked Invoices (I{currentData.dateKey}XXXX): <span className="text-purple-300 font-bold">{currentData.invoices.length} invoices</span></div>
              <div className="text-emerald-400">✓ Auto-generated Linked Delivery Challans (D{currentData.dateKey}XXXX): <span className="text-teal-300 font-bold">{currentData.deliveries.length} challans</span></div>
              <div className="text-emerald-400">✓ Auto-generated Linked Inflow Receipts (T{currentData.dateKey}XXXX): <span className="text-indigo-300 font-bold">{currentData.transactions.length} receipts</span></div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Proceed to Review 6 Store Modules</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW 6 STORE MODULES */}
      {wizardStep === 2 && (
        <div className="space-y-6">
          {/* Module Selector Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setReviewTab('invoices')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                reviewTab === 'invoices'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Invoices ({currentData.invoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewTab('deliveries')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                reviewTab === 'deliveries'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Deliveries ({currentData.deliveries.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewTab('inflows')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                reviewTab === 'inflows'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Inflow Receipts ({currentData.transactions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewTab('customers')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                reviewTab === 'customers'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Debtors ({currentData.customers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewTab('vendors')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                reviewTab === 'vendors'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Creditors ({currentData.vendors.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewTab('stock')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                reviewTab === 'stock'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Store Stock ({currentData.storeStock.length})</span>
            </button>
          </div>

          {/* Module Data Table View */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
            {/* 1. INVOICES */}
            {reviewTab === 'invoices' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Auto-Generated Invoices (`I{currentData.dateKey}XXXX`)</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">Total: {currentData.invoices.length} Bills</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Invoice ID</th>
                        <th className="p-3">Custom Bill Ref</th>
                        <th className="p-3 font-sans">Customer</th>
                        <th className="p-3 text-right">Subtotal</th>
                        <th className="p-3 text-right">GST Tax</th>
                        <th className="p-3 text-right">Total Bill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentData.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-purple-600 dark:text-purple-400">{inv.id}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{inv.linkedQuoteId || inv.paymentTransId || '-'}</td>
                          <td className="p-3 font-sans">
                            <div className="font-bold text-slate-900 dark:text-white">{inv.customerExternalName}</div>
                            <div className="text-[10px] text-slate-400">{inv.customerPhone}</div>
                          </td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(inv.subtotal)}</td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(inv.taxAmount)}</td>
                          <td className="p-3 text-right font-black text-slate-900 dark:text-white">{formatCurrency(inv.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. DELIVERIES */}
            {reviewTab === 'deliveries' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Auto-Generated Delivery Challans (`D{currentData.dateKey}XXXX`)</span>
                  <span className="font-mono text-teal-600 dark:text-teal-400">Total: {currentData.deliveries.length} Challans</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Delivery ID</th>
                        <th className="p-3">Linked Invoice(s)</th>
                        <th className="p-3 font-sans">Driver &amp; Vehicle</th>
                        <th className="p-3">State</th>
                        <th className="p-3 font-sans">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentData.deliveries.map((del) => (
                        <tr key={del.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-teal-600 dark:text-teal-400">{del.id}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{del.invoiceIds?.join(', ') || '-'}</td>
                          <td className="p-3 font-sans">
                            <div className="font-bold text-slate-900 dark:text-white">{del.driverName}</div>
                            <div className="text-[10px] text-slate-400">{del.driverPhone}</div>
                          </td>
                          <td className="p-3 font-sans">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                              {del.status}
                            </span>
                          </td>
                          <td className="p-3 font-sans text-slate-600 dark:text-slate-400">{del.itemsSummary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. INFLOWS */}
            {reviewTab === 'inflows' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Auto-Generated Inflow Receipts (`T{currentData.dateKey}XXXX`)</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">Total: {currentData.transactions.length} Receipts</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Receipt ID</th>
                        <th className="p-3">Customer ID</th>
                        <th className="p-3 font-sans">Payment Treatment</th>
                        <th className="p-3 font-sans">Bank / Drawer</th>
                        <th className="p-3 text-right">Amount Inflow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentData.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{tx.id}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{tx.customerId}</td>
                          <td className="p-3 font-sans">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                              {tx.treatment}
                            </span>
                          </td>
                          <td className="p-3 font-sans text-slate-600 dark:text-slate-400">{tx.bankOrDrawer || tx.mode}</td>
                          <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(tx.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. CUSTOMERS */}
            {reviewTab === 'customers' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Sundry Debtors (`C{currentData.dateKey}XXXX`)</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">Total: {currentData.customers.length} Debtors</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Customer ID</th>
                        <th className="p-3 font-sans">Legal &amp; Internal Alias</th>
                        <th className="p-3 font-sans">Phone &amp; PIN</th>
                        <th className="p-3 font-sans">Addresses</th>
                        <th className="p-3 text-right">Account Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentData.customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-amber-600 dark:text-amber-400">{c.id}</td>
                          <td className="p-3 font-sans">
                            <div className="font-bold text-slate-900 dark:text-white">{c.externalName}</div>
                            <div className="text-[10px] text-slate-400">{c.internalName}</div>
                          </td>
                          <td className="p-3 font-sans">
                            <div>{c.phone}</div>
                            <div className="text-[10px] text-slate-400 font-mono">PIN: {c.accessPin}</div>
                          </td>
                          <td className="p-3 font-sans text-slate-600 dark:text-slate-400 text-[11px]">{c.billingAddress}</td>
                          <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                            {formatCurrency(c.currentBalance || c.openingBalance || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. VENDORS */}
            {reviewTab === 'vendors' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Sundry Creditors (`V{currentData.dateKey}XXXX`)</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">Total: {currentData.vendors.length} Creditors</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Vendor ID</th>
                        <th className="p-3 font-sans">Supplier Name</th>
                        <th className="p-3 font-sans">Category</th>
                        <th className="p-3 font-sans">Due Date &amp; PO Ref</th>
                        <th className="p-3 text-right">Amount Owed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentData.vendors.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{v.id}</td>
                          <td className="p-3 font-sans font-bold text-slate-900 dark:text-white">{v.vendorName}</td>
                          <td className="p-3 font-sans">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                              {v.category}
                            </span>
                          </td>
                          <td className="p-3 font-sans text-slate-600 dark:text-slate-400 text-[11px]">
                            <div>Due: {v.targetDueDate}</div>
                            <div className="text-[10px] font-mono text-slate-400">{v.billOrderReferenceNo}</div>
                          </td>
                          <td className="p-3 text-right font-black text-red-600 dark:text-red-400">{formatCurrency(v.amountWeOwe)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. STORE STOCK */}
            {reviewTab === 'stock' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Store Stock (`STK{currentData.dateKey}XXXX`)</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Total: {currentData.storeStock.length} Stock Units</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Stock ID</th>
                        <th className="p-3 font-sans">Item Name &amp; Brand</th>
                        <th className="p-3 font-sans">Model(s)</th>
                        <th className="p-3">Serial Nos</th>
                        <th className="p-3 text-right">Selling Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentData.storeStock.map((stk) => (
                        <tr key={stk.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">{stk.id}</td>
                          <td className="p-3 font-sans">
                            <div className="font-bold text-slate-900 dark:text-white">{stk.name}</div>
                            <div className="text-[10px] text-slate-400">{stk.brand} - {stk.type}</div>
                          </td>
                          <td className="p-3 font-sans text-[11px]">
                            <div>Main: {stk.modelNo}</div>
                            {stk.indoorModel && <div className="text-[10px] text-slate-400">ID: {stk.indoorModel}</div>}
                          </td>
                          <td className="p-3 text-[11px]">
                            <div>{stk.serialNo}</div>
                          </td>
                          <td className="p-3 text-right font-black text-slate-900 dark:text-white">{formatCurrency(stk.sellingPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Proceed to Step 3: Export &amp; Sync</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: EXPORT & SYNC */}
      {wizardStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>LA-D System Data Sync &amp; File Export Panel</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Download standardized LA-D payload files or commit all records directly into the live store database.
                </p>
              </div>

              {/* Read-only Dynamic Date Key Tag */}
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 rounded-2xl text-amber-900 dark:text-amber-200 text-xs font-mono font-bold flex items-center gap-2 shrink-0">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Auto-Detected Date Key: {currentData.dateKey}</span>
              </div>
            </div>

            {/* Live Progress Bar when Syncing */}
            {isSyncing && (
              <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-bold font-mono">
                  <span className="text-amber-400 flex items-center gap-2">
                    <Zap className="w-4 h-4 animate-bounce" />
                    {syncProgressText || 'Syncing LA-D records to store...'}
                  </span>
                  <span className="text-emerald-400">{syncProgressPercent}% Complete</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-400 h-full transition-all duration-150"
                    style={{ width: `${syncProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  const txtContent = generateLeadCompleteSystemTxt(currentData);
                  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'LA_D_Complete_System.txt';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download LA_D_Complete_System.txt</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const jsContent = generateLeadCompleteSystemJs(currentData);
                  const blob = new Blob([jsContent], { type: 'text/javascript;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'LA_D_Complete_System.js';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-amber-500/40 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>Download LA_D_Complete_System.js (UMD Module)</span>
              </button>

              <button
                type="button"
                onClick={handleCommitToStore}
                disabled={isSyncing}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Database className="w-4 h-4" />
                <span>{isSyncing ? 'Syncing Records to Store...' : 'Commit & Upsert LA-D Data to Store'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
