import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check,
  Copy,
  ExternalLink,
  Database,
  BookOpen,
  Layers,
  RefreshCw,
  FileCode,
  Table,
  Filter,
  Search,
  Users,
  Boxes,
  Receipt,
  FileText,
  ChevronRight,
  ArrowRight,
  Info,
  Calendar,
  Sparkles,
  Truck,
  Scale,
  ShieldCheck,
  HardDrive,
  Share2,
  Eye,
  EyeOff,
  Terminal,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  parseTallyXmlData,
  parseTallyCsvData,
  generateTallyCustomersXml,
  generateTallyInventoryXml,
  generateTallyInvoicesXml,
  generateCustomersCsv,
  generateInventoryCsv,
  generateInvoicesCsv,
  generateQuotationsCsv,
  generateShipmentsCsv,
  generateDuesKhataCsv,
  generateFullErpBackupJson,
  SAMPLE_TALLY_CUSTOMERS_XML,
  SAMPLE_TALLY_INVENTORY_XML,
  ParsedTallyCustomer,
  ParsedTallyStockItem,
  ParsedTallyInvoice,
  TallyParseStats,
} from '../../utils/tallyHelper';

export type TallyCategory =
  | 'CUSTOMERS'
  | 'INVENTORY'
  | 'INVOICES'
  | 'QUOTATIONS'
  | 'SHIPMENTS'
  | 'KHATA'
  | 'BACKUP';

export type GuideCategory =
  | 'CUSTOMERS'
  | 'INVENTORY'
  | 'INVOICES'
  | 'QUOTATIONS'
  | 'SHIPMENTS'
  | 'KHATA'
  | 'BACKUP'
  | 'IMPORT_TO_TALLY';

export interface TallyPrimeManagerProps {
  initialTab?: 'IMPORT' | 'EXPORT' | 'GUIDE';
  initialCategory?: TallyCategory;
}

export const TallyPrimeManager: React.FC<TallyPrimeManagerProps> = ({
  initialTab = 'IMPORT',
  initialCategory = 'CUSTOMERS',
}) => {
  const {
    customers,
    inventory,
    invoices,
    quotations,
    shipments,
    addCustomer,
    addInventoryItem,
    addInvoice,
    gstNumber,
  } = useApp();

  // Active top navigation tab: 'IMPORT' | 'EXPORT' | 'GUIDE'
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'EXPORT' | 'GUIDE'>(initialTab);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<TallyCategory>(initialCategory);

  // Sync when initialTab or initialCategory change
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
      setActiveGuideCategory(initialCategory as GuideCategory);
    }
  }, [initialCategory]);

  // ==========================================
  // IMPORT STATE
  // ==========================================
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileContentRaw, setFileContentRaw] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [parseStats, setParseStats] = useState<TallyParseStats | null>(null);
  const [showRawInspector, setShowRawInspector] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [rawSampleLines, setRawSampleLines] = useState<string[]>([]);
  const [forcedDelimiter, setForcedDelimiter] = useState<string>('auto');
  const [parsedCustomers, setParsedCustomers] = useState<ParsedTallyCustomer[]>([]);
  const [parsedStock, setParsedStock] = useState<ParsedTallyStockItem[]>([]);
  const [parsedInvoices, setParsedInvoices] = useState<ParsedTallyInvoice[]>([]);
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // EXPORT STATE
  // ==========================================
  const [exportFormat, setExportFormat] = useState<'XML' | 'CSV'>('XML');
  const [exportCopied, setExportCopied] = useState(false);
  const [exportSearch, setExportSearch] = useState('');

  // ==========================================
  // GUIDE STATE
  // ==========================================
  const [activeGuideCategory, setActiveGuideCategory] = useState<GuideCategory>('CUSTOMERS');

  // Process uploaded file (XML or CSV/TSV)
  const processRawFileText = (text: string, filename: string, delimiterOverride?: string) => {
    setUploadedFileName(filename);
    setFileContentRaw(text);
    setImportErrorMessage(null);
    setImportSuccessMessage(null);

    const isXml = filename.toLowerCase().endsWith('.xml') || text.trim().startsWith('<');

    if (isXml) {
      const parsed = parseTallyXmlData(text);
      setParsedCustomers(parsed.customers);
      setParsedStock(parsed.stockItems);
      setParsedInvoices(parsed.invoices);
      setParseStats(parsed.stats);
      setParseWarnings(parsed.warnings);
      setRawSampleLines(parsed.rawSampleLines);

      // Auto-switch category based on which items were found
      if (parsed.customers.length > 0 && selectedCategory !== 'CUSTOMERS') {
        setSelectedCategory('CUSTOMERS');
        setSelectedItemIndices(parsed.customers.map((_, i) => i));
      } else if (parsed.stockItems.length > 0 && selectedCategory !== 'INVENTORY') {
        setSelectedCategory('INVENTORY');
        setSelectedItemIndices(parsed.stockItems.map((_, i) => i));
      } else if (parsed.invoices.length > 0 && selectedCategory !== 'INVOICES') {
        setSelectedCategory('INVOICES');
        setSelectedItemIndices(parsed.invoices.map((_, i) => i));
      } else {
        const count =
          selectedCategory === 'CUSTOMERS'
            ? parsed.customers.length
            : selectedCategory === 'INVENTORY'
            ? parsed.stockItems.length
            : parsed.invoices.length;
        setSelectedItemIndices(Array.from({ length: count }, (_, i) => i));
      }

      if (parsed.stats.totalFound === 0) {
        setImportErrorMessage(
          `File loaded (${(parsed.stats.fileSizeBytes / 1024).toFixed(1)} KB), but 0 Tally records were detected. See diagnostic details below.`
        );
      }
    } else {
      // CSV / TSV format
      const effDelim = delimiterOverride && delimiterOverride !== 'auto' ? delimiterOverride : undefined;
      const csvCategory =
        selectedCategory === 'INVENTORY' || selectedCategory === 'INVOICES'
          ? selectedCategory
          : 'CUSTOMERS';
      const parsed = parseTallyCsvData(text, csvCategory, effDelim);
      setParsedCustomers(parsed.customers);
      setParsedStock(parsed.stockItems);
      setParsedInvoices(parsed.invoices);
      setParseStats(parsed.stats);
      setParseWarnings(parsed.warnings);
      setRawSampleLines(parsed.rawSampleLines);

      const count =
        selectedCategory === 'CUSTOMERS'
          ? parsed.customers.length
          : selectedCategory === 'INVENTORY'
          ? parsed.stockItems.length
          : parsed.invoices.length;
      setSelectedItemIndices(Array.from({ length: count }, (_, i) => i));

      if (parsed.stats.totalFound === 0) {
        setImportErrorMessage(
          `File loaded (${(parsed.stats.fileSizeBytes / 1024).toFixed(1)} KB), but 0 records were parsed. Try switching delimiter or category below.`
        );
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    setImportErrorMessage(null);
    setImportSuccessMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setTimeout(() => {
        processRawFileText(text, file.name);
        setIsReadingFile(false);
      }, 50);
    };
    reader.onerror = () => {
      setImportErrorMessage('Could not read file from system.');
      setIsReadingFile(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    setImportErrorMessage(null);
    setImportSuccessMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setTimeout(() => {
        processRawFileText(text, file.name);
        setIsReadingFile(false);
      }, 50);
    };
    reader.onerror = () => {
      setImportErrorMessage('Could not read dropped file.');
      setIsReadingFile(false);
    };
    reader.readAsText(file);
  };

  // Load sample data for immediate test drive
  const handleLoadSample = (cat: TallyCategory) => {
    setSelectedCategory(cat);
    if (cat === 'CUSTOMERS') {
      processRawFileText(SAMPLE_TALLY_CUSTOMERS_XML, 'sample_tally_customers.xml');
    } else if (cat === 'INVENTORY') {
      processRawFileText(SAMPLE_TALLY_INVENTORY_XML, 'sample_tally_inventory.xml');
    }
  };

  // Select / deselect all
  const activeParsedCount =
    selectedCategory === 'CUSTOMERS'
      ? parsedCustomers.length
      : selectedCategory === 'INVENTORY'
      ? parsedStock.length
      : parsedInvoices.length;

  const handleToggleSelectAll = () => {
    if (selectedItemIndices.length === activeParsedCount) {
      setSelectedItemIndices([]);
    } else {
      setSelectedItemIndices(Array.from({ length: activeParsedCount }, (_, i) => i));
    }
  };

  const handleToggleSingle = (idx: number) => {
    if (selectedItemIndices.includes(idx)) {
      setSelectedItemIndices(selectedItemIndices.filter((i) => i !== idx));
    } else {
      setSelectedItemIndices([...selectedItemIndices, idx]);
    }
  };

  // Execute Import to Firestore Database
  const handleExecuteImport = async () => {
    if (selectedItemIndices.length === 0) {
      setImportErrorMessage('Please select at least one record to import.');
      return;
    }

    setIsImporting(true);
    setImportErrorMessage(null);
    setImportSuccessMessage(null);

    try {
      let importedCount = 0;

      if (selectedCategory === 'CUSTOMERS') {
        for (const idx of selectedItemIndices) {
          const item = parsedCustomers[idx];
          if (!item) continue;
          await addCustomer({
            externalName: item.externalName,
            phone: item.phone,
            email: item.email,
            billingAddress: item.billingAddress,
            installationAddress: item.installationAddress || item.billingAddress,
            gstin: item.gstin,
            accountBalance: item.accountBalance || 0,
            notes: item.notes || 'Imported from Tally Prime',
          });
          importedCount++;
        }
      } else if (selectedCategory === 'INVENTORY') {
        for (const idx of selectedItemIndices) {
          const item = parsedStock[idx];
          if (!item) continue;
          await addInventoryItem({
            name: item.name,
            modelNo: item.modelNo || 'FTKF50TV',
            indoorModelNo: item.indoorModelNo,
            outdoorModelNo: item.outdoorModelNo,
            type: item.type || 'AC',
            brand: item.brand || 'Daikin',
            serialNo: item.serialNo || `TALLY-${Date.now().toString().slice(-4)}${importedCount + 1}`,
            sellingPrice: item.sellingPrice || 45000,
          });
          importedCount++;
        }
      } else if (selectedCategory === 'INVOICES') {
        for (const idx of selectedItemIndices) {
          const item = parsedInvoices[idx];
          if (!item) continue;
          const subtotal = item.totalAmount / 1.18;
          const taxAmount = item.totalAmount - subtotal;

          await addInvoice({
            customerId: '',
            customerExternalName: item.customerName,
            customerPhone: item.customerPhone || 'Not specified',
            billingAddress: item.billingAddress || 'Store Pickup',
            installationAddress: item.billingAddress || 'Store Pickup',
            items: item.items.map((it, itIdx) => ({
              id: `inv-it-${Date.now()}-${itIdx}`,
              name: it.name,
              modelNo: it.modelNo || 'STANDARD',
              type: 'AC',
              brand: 'Daikin',
              quantity: it.quantity,
              rate: it.rate,
              taxPercent: 18,
              isAmountWithTax: true,
              discount: 0,
              lineTotal: it.amount,
            })),
            subtotal,
            taxAmount,
            discountAmount: 0,
            totalAmount: item.totalAmount,
            prepaidSplits: {
              fromBalance: 0,
              upi: { amount: 0, receivingBank: '', utr: '' },
              card: { amount: 0, receivingBank: '', authId: '' },
              chequeOrNeft: { amount: 0, chequeOrSlipOrUtr: '', bank: '' },
              cash: { amount: 0, drawerRegister: '' },
            },
            totalPrepaid: 0,
            amountDue: item.totalAmount,
            paymentStatus: 'UNPAID',
            gstNumber,
            notes: item.narration || `Imported from Tally Prime Voucher #${item.invoiceNumber}`,
          });
          importedCount++;
        }
      }

      setImportSuccessMessage(
        `Successfully imported ${importedCount} ${selectedCategory.toLowerCase()} record(s) into the live database!`
      );
      // Clear selection after import
      setSelectedItemIndices([]);
    } catch (err: any) {
      console.error('Import error:', err);
      setImportErrorMessage(`Failed to import data: ${err.message || 'Unknown database error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // ==========================================
  // EXPORT GENERATION HELPERS
  // ==========================================
  const getExportDataString = (): { content: string; filename: string; mime: string } => {
    const timestamp = new Date().toISOString().slice(0, 10);

    if (selectedCategory === 'CUSTOMERS') {
      if (exportFormat === 'XML') {
        return {
          content: generateTallyCustomersXml(customers),
          filename: `Tally_Customers_Master_${timestamp}.xml`,
          mime: 'application/xml',
        };
      } else {
        return {
          content: generateCustomersCsv(customers),
          filename: `Lakhi_Customers_${timestamp}.csv`,
          mime: 'text/csv',
        };
      }
    } else if (selectedCategory === 'INVENTORY') {
      if (exportFormat === 'XML') {
        return {
          content: generateTallyInventoryXml(inventory),
          filename: `Tally_StockItems_Master_${timestamp}.xml`,
          mime: 'application/xml',
        };
      } else {
        return {
          content: generateInventoryCsv(inventory),
          filename: `Lakhi_Inventory_${timestamp}.csv`,
          mime: 'text/csv',
        };
      }
    } else if (selectedCategory === 'INVOICES') {
      if (exportFormat === 'XML') {
        return {
          content: generateTallyInvoicesXml(invoices),
          filename: `Tally_SalesVouchers_${timestamp}.xml`,
          mime: 'application/xml',
        };
      } else {
        return {
          content: generateInvoicesCsv(invoices),
          filename: `Lakhi_Invoices_${timestamp}.csv`,
          mime: 'text/csv',
        };
      }
    } else if (selectedCategory === 'QUOTATIONS') {
      return {
        content: generateQuotationsCsv(quotations),
        filename: `Lakhi_Quotations_Register_${timestamp}.csv`,
        mime: 'text/csv',
      };
    } else if (selectedCategory === 'SHIPMENTS') {
      return {
        content: generateShipmentsCsv(shipments),
        filename: `Lakhi_Shipments_Log_${timestamp}.csv`,
        mime: 'text/csv',
      };
    } else if (selectedCategory === 'KHATA') {
      return {
        content: generateDuesKhataCsv(customers, invoices),
        filename: `Lakhi_Dues_Khata_Report_${timestamp}.csv`,
        mime: 'text/csv',
      };
    } else {
      // BACKUP
      return {
        content: generateFullErpBackupJson({
          customers,
          inventory,
          invoices,
          quotations,
          shipments,
          gstNumber,
        }),
        filename: `Lakhi_ERP_Full_Backup_${timestamp}.json`,
        mime: 'application/json',
      };
    }
  };

  const handleDownloadExport = () => {
    const { content, filename, mime } = getExportDataString();
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyExport = () => {
    const { content } = getExportDataString();
    navigator.clipboard.writeText(content);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Tally Prime Integration Hub
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  XML &amp; Excel Compatible
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Seamlessly import customer ledgers, AC inventory stock, and sales vouchers from Tally Prime into Lakhi ERP, or export Tally-ready XML files.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'IMPORT'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>📥 Import Data</span>
          </button>
          <button
            onClick={() => setActiveTab('EXPORT')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'EXPORT'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>📤 Export Data</span>
          </button>
          <button
            onClick={() => setActiveTab('GUIDE')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'GUIDE'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>📖 How to Export/Import</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: IMPORT FROM TALLY PRIME
          ========================================================================= */}
      {activeTab === 'IMPORT' && (
        <div className="space-y-6">
          {/* Step 1: Select Category & Upload File */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Selector Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                  1
                </span>
                Select Data to Import
              </h3>

              <div className="space-y-2">
                {[
                  {
                    id: 'CUSTOMERS' as const,
                    title: 'Customer Ledgers',
                    desc: 'Sundry Debtors with Phone, Address, GSTIN, Opening Balance',
                    icon: Users,
                    badge: `${customers.length} In System`,
                  },
                  {
                    id: 'INVENTORY' as const,
                    title: 'Stock Items & Appliances',
                    desc: 'AC Models, Rates, IDU/ODU Model Numbers, Units',
                    icon: Boxes,
                    badge: `${inventory.length} In Stock`,
                  },
                  {
                    id: 'INVOICES' as const,
                    title: 'Sales Invoices / Vouchers',
                    desc: 'Vouchers with Bill No, Party Name, Total, Items, Dates',
                    icon: Receipt,
                    badge: `${invoices.length} Invoices`,
                  },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedItemIndices([]);
                        setImportErrorMessage(null);
                        setImportSuccessMessage(null);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'bg-red-50/60 dark:bg-red-950/40 border-red-500/80 ring-2 ring-red-500/20'
                          : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          isSelected
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {cat.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {cat.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {cat.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sample Test Data Quick Loader */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                  Quick Testing / Samples
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoadSample('CUSTOMERS')}
                    className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Sample Ledgers
                  </button>
                  <button
                    onClick={() => handleLoadSample('INVENTORY')}
                    className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Sample Stock
                  </button>
                </div>
              </div>
            </div>

            {/* Drag & Drop File Upload Zone */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                      2
                    </span>
                    Upload Tally XML or CSV / Excel File
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Supports .xml, .csv, .txt
                  </span>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 scale-[0.99]'
                      : 'border-slate-300 dark:border-slate-700 hover:border-red-400 bg-slate-50/50 dark:bg-slate-800/20'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xml,.csv,.txt"
                    className="hidden"
                  />
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <Upload className="w-6 h-6 animate-bounce" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Click to browse or drag &amp; drop Tally export file
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    Export from Tally Prime via <strong>Alt+E &gt; XML (Data Interchange)</strong> or <strong>Excel Spreadsheet</strong> and drop it here.
                  </p>

                  {isReadingFile && (
                    <div className="mt-4 inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-blue-100 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs font-bold animate-pulse shadow-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Reading &amp; Analyzing Tally file... Checking XML schema, ledgers &amp; vouchers</span>
                    </div>
                  )}

                  {!isReadingFile && uploadedFileName && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-mono font-bold border border-emerald-300/60 dark:border-emerald-800/60">
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Loaded: {uploadedFileName}</span>
                        {parseStats && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                            ({(parseStats.fileSizeBytes / 1024).toFixed(1)} KB • {parseStats.fileType})
                          </span>
                        )}
                      </div>

                      {parseStats && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <span className={`px-2 py-0.5 rounded-md ${parseStats.customersFound > 0 ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {parseStats.customersFound} Ledgers
                          </span>
                          <span className={`px-2 py-0.5 rounded-md ${parseStats.stockItemsFound > 0 ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {parseStats.stockItemsFound} Stock Items
                          </span>
                          <span className={`px-2 py-0.5 rounded-md ${parseStats.invoicesFound > 0 ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {parseStats.invoicesFound} Invoices
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Feedback */}
              {importErrorMessage && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block mb-0.5">Parse Notice:</span>
                    <span>{importErrorMessage}</span>
                  </div>
                </div>
              )}

              {/* Cross-Category Detected Prompt (e.g. User selected CUSTOMERS but uploaded Stock Items) */}
              {!isReadingFile && parseStats && parseStats.totalFound > 0 && activeParsedCount === 0 && (
                <div className="mt-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
                    <Info className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      0 records match "{selectedCategory}", but records were found in other sections!
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {parseStats.stockItemsFound > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('INVENTORY');
                          setSelectedItemIndices(parsedStock.map((_, i) => i));
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        <span>Switch to Stock Items ({parseStats.stockItemsFound} found)</span>
                      </button>
                    )}
                    {parseStats.customersFound > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('CUSTOMERS');
                          setSelectedItemIndices(parsedCustomers.map((_, i) => i));
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Switch to Customer Ledgers ({parseStats.customersFound} found)</span>
                      </button>
                    )}
                    {parseStats.invoicesFound > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('INVOICES');
                          setSelectedItemIndices(parsedInvoices.map((_, i) => i));
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Switch to Sales Invoices ({parseStats.invoicesFound} found)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnostic & Troubleshooting Card when 0 items detected in all categories */}
              {!isReadingFile && parseStats && parseStats.totalFound === 0 && uploadedFileName && (
                <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        Diagnostic Details &amp; File Structure Inspector
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRawInspector(!showRawInspector)}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showRawInspector ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showRawInspector ? 'Hide Inspector' : 'Inspect Raw File'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Format</span>
                      <strong className="text-slate-800 dark:text-slate-200">{parseStats.fileType}</strong>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Size</span>
                      <strong className="text-slate-800 dark:text-slate-200">{(parseStats.fileSizeBytes / 1024).toFixed(1)} KB</strong>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Records Matched</span>
                      <strong className="text-amber-600 font-black">0 Items</strong>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">XML Parser</span>
                      <strong className={parseStats.hasXmlError ? 'text-red-500' : 'text-emerald-500'}>
                        {parseStats.hasXmlError ? 'Syntax Warning' : 'OK / Valid'}
                      </strong>
                    </div>
                  </div>

                  {parseStats.tagsDetected.length > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      <strong>Tags/Columns Detected:</strong>{' '}
                      <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {parseStats.tagsDetected.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Troubleshooting Advice */}
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                    <span className="font-bold text-amber-800 dark:text-amber-300 block mb-1">
                      💡 How to Export from Tally Prime so it imports instantly:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>For Customers: <strong>Gateway of Tally &gt; Chart of Accounts &gt; Ledgers &gt; Alt+E &gt; XML</strong></li>
                      <li>For Stock Items: <strong>Gateway of Tally &gt; Chart of Accounts &gt; Stock Items &gt; Alt+E &gt; XML</strong></li>
                      <li>For Invoices: <strong>Gateway of Tally &gt; Day Book &gt; Alt+E &gt; XML</strong></li>
                    </ul>
                  </div>

                  {/* Collapsible Raw Inspector & Manual Re-parser */}
                  {showRawInspector && (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Terminal className="w-3.5 h-3.5 text-blue-500" />
                          <span>Raw File Preview (First 30 Lines):</span>
                        </span>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[10px] text-slate-400">Force Delimiter:</span>
                          {[
                            { id: 'auto', label: 'Auto' },
                            { id: ',', label: 'Comma (,)' },
                            { id: '\t', label: 'Tab (TSV)' },
                            { id: ';', label: 'Semicolon (;)' },
                            { id: '|', label: 'Pipe (|)' },
                          ].map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setForcedDelimiter(d.id);
                                processRawFileText(fileContentRaw, uploadedFileName, d.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                                forcedDelimiter === d.id
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[10px] max-h-48 overflow-y-auto leading-relaxed border border-slate-800">
                        {rawSampleLines.map((line, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-slate-600 select-none w-6 text-right shrink-0">{idx + 1}</span>
                            <span className="break-all whitespace-pre-wrap">{line}</span>
                          </div>
                        ))}
                      </div>

                      {/* Manual Force Parse Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-400">Force Re-parse As:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('CUSTOMERS');
                            processRawFileText(fileContentRaw, uploadedFileName);
                          }}
                          className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-lg text-xs font-bold transition-colors"
                        >
                          Customer Ledgers
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('INVENTORY');
                            processRawFileText(fileContentRaw, uploadedFileName);
                          }}
                          className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-800 dark:text-indigo-300 rounded-lg text-xs font-bold transition-colors"
                        >
                          Stock Items
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('INVOICES');
                            processRawFileText(fileContentRaw, uploadedFileName);
                          }}
                          className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 text-purple-800 dark:text-purple-300 rounded-lg text-xs font-bold transition-colors"
                        >
                          Sales Invoices
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {importSuccessMessage && (
                <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Parsed Records Preview Table */}
          {activeParsedCount > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Table className="w-4 h-4 text-red-600" />
                    <span>Parsed {selectedCategory} Preview ({activeParsedCount} Detected)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Review and select the items you wish to save into the live database.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {selectedItemIndices.length === activeParsedCount
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || selectedItemIndices.length === 0}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs ${
                      selectedItemIndices.length > 0 && !isImporting
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving to Firebase...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Import {selectedItemIndices.length} Selected Record(s)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Table Render based on Category */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase font-mono">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItemIndices.length === activeParsedCount && activeParsedCount > 0}
                          onChange={handleToggleSelectAll}
                          className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                      </th>
                      {selectedCategory === 'CUSTOMERS' && (
                        <>
                          <th className="p-3">Customer / Ledger Name</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Address</th>
                          <th className="p-3">GSTIN</th>
                          <th className="p-3 text-right">Opening Balance</th>
                        </>
                      )}
                      {selectedCategory === 'INVENTORY' && (
                        <>
                          <th className="p-3">Appliance Name</th>
                          <th className="p-3">Model No</th>
                          <th className="p-3">IDU / ODU Models</th>
                          <th className="p-3">Brand &amp; Type</th>
                          <th className="p-3 text-right">Selling Price</th>
                        </>
                      )}
                      {selectedCategory === 'INVOICES' && (
                        <>
                          <th className="p-3">Voucher / Bill No</th>
                          <th className="p-3">Customer Party</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Items Summary</th>
                          <th className="p-3 text-right">Total Amount</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedCategory === 'CUSTOMERS' &&
                      parsedCustomers.map((c, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleToggleSingle(idx)}
                            className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isChecked ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              {c.externalName}
                              {c.tallyParent && (
                                <span className="ml-2 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-mono text-slate-500">
                                  {c.tallyParent}
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono">{c.phone || '-'}</td>
                            <td className="p-3 text-slate-500 truncate max-w-xs">{c.billingAddress}</td>
                            <td className="p-3 font-mono text-[11px]">{c.gstin || '-'}</td>
                            <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                              ₹{(c.accountBalance || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}

                    {selectedCategory === 'INVENTORY' &&
                      parsedStock.map((it, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleToggleSingle(idx)}
                            className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isChecked ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              {it.name}
                            </td>
                            <td className="p-3 font-mono">{it.modelNo}</td>
                            <td className="p-3 text-[11px] font-mono text-blue-600 dark:text-blue-400">
                              {it.indoorModelNo ? `IDU: ${it.indoorModelNo}` : '-'}
                              {it.outdoorModelNo && ` | ODU: ${it.outdoorModelNo}`}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {it.brand}
                              </span>{' '}
                              <span className="text-slate-400">({it.type})</span>
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-600">
                              ₹{it.sellingPrice.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}

                    {selectedCategory === 'INVOICES' &&
                      parsedInvoices.map((inv, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleToggleSingle(idx)}
                            className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isChecked ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                              {inv.invoiceNumber}
                            </td>
                            <td className="p-3 font-bold">{inv.customerName}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-500">
                              {inv.date || '-'}
                            </td>
                            <td className="p-3 text-slate-500 truncate max-w-xs">
                              {inv.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                            </td>
                            <td className="p-3 text-right font-bold text-blue-600">
                              ₹{inv.totalAmount.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: EXPORT LAKHI DATA TO TALLY PRIME
      {/* =========================================================================
          TAB 2: EXPORT LAKHI DATA TO TALLY PRIME & EXCEL
          ========================================================================= */}
      {activeTab === 'EXPORT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Category selection for export */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Select Data Type to Export
              </h3>

              <div className="space-y-2">
                {[
                  {
                    id: 'INVENTORY' as const,
                    title: '1. Store Stock & AC Items',
                    desc: 'AC Models, IDU/ODU details, carton serials, rates, HSN',
                    icon: Boxes,
                    count: inventory.length,
                    tag: 'Tally XML / Excel',
                  },
                  {
                    id: 'CUSTOMERS' as const,
                    title: '2. Customer Ledgers (Debtors)',
                    desc: 'Sundry Debtors with GSTIN, phone, address, credit balance',
                    icon: Users,
                    count: customers.length,
                    tag: 'Tally XML / Excel',
                  },
                  {
                    id: 'INVOICES' as const,
                    title: '3. Sales Invoices (Vouchers)',
                    desc: 'Sales vouchers with split taxes (CGST/SGST 9%), items & party',
                    icon: Receipt,
                    count: invoices.length,
                    tag: 'Tally XML / Excel',
                  },
                  {
                    id: 'QUOTATIONS' as const,
                    title: '4. Quotations & Estimates (Q...)',
                    desc: 'Pending & sent quotations register with line items & pricing',
                    icon: FileText,
                    count: quotations.length,
                    tag: 'Excel / CSV',
                  },
                  {
                    id: 'SHIPMENTS' as const,
                    title: '5. Deliveries & Shipments (D...)',
                    desc: 'Dispatch log, drivers, E-way bill numbers & statuses',
                    icon: Truck,
                    count: shipments.length,
                    tag: 'Excel / CSV',
                  },
                  {
                    id: 'KHATA' as const,
                    title: '6. Who Owes Who (Dues & Khata)',
                    desc: 'Customer credit aging, outstanding dues & khata balances',
                    icon: Scale,
                    count: customers.length,
                    tag: 'Excel / CSV',
                  },
                  {
                    id: 'BACKUP' as const,
                    title: '7. Full ERP Database Backup',
                    desc: 'Complete company backup JSON (all masters & records)',
                    icon: HardDrive,
                    count: customers.length + inventory.length + invoices.length + quotations.length,
                    tag: 'Consolidated JSON',
                  },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'bg-red-50/60 dark:bg-red-950/40 border-red-500/80 ring-2 ring-red-500/20'
                          : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          isSelected
                            ? 'bg-red-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {cat.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-1">
                            {cat.count}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-1">
                          {cat.desc}
                        </p>
                        <span className="inline-block mt-1 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                          {cat.tag}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Export Configuration & Actions */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-red-600" />
                      <span>
                        Configure {selectedCategory === 'BACKUP' ? 'Full System Backup' : 'Data Export'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Generate files ready for Tally Prime 1.0–4.1, Excel reconciliation, or external backups.
                    </p>
                  </div>

                  {/* Format Toggle for categories that support XML vs CSV */}
                  {(selectedCategory === 'CUSTOMERS' ||
                    selectedCategory === 'INVENTORY' ||
                    selectedCategory === 'INVOICES') ? (
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setExportFormat('XML')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          exportFormat === 'XML'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Tally XML (Native)
                      </button>
                      <button
                        onClick={() => setExportFormat('CSV')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          exportFormat === 'CSV'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Excel / CSV
                      </button>
                    </div>
                  ) : selectedCategory === 'BACKUP' ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono">
                      JSON Enterprise Archive
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                      Excel / CSV Spreadsheet
                    </span>
                  )}
                </div>

                {/* Summary Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">
                      Selected Dataset:
                    </span>
                    <span className="font-mono text-red-600 dark:text-red-400">
                      {selectedCategory === 'INVOICES'
                        ? `${invoices.length} Sales Tax Invoices`
                        : selectedCategory === 'CUSTOMERS'
                        ? `${customers.length} Customer Ledgers`
                        : selectedCategory === 'INVENTORY'
                        ? `${inventory.length} Stock Units`
                        : selectedCategory === 'QUOTATIONS'
                        ? `${quotations.length} Quotations & Estimates`
                        : selectedCategory === 'SHIPMENTS'
                        ? `${shipments.length} Deliveries & Shipments`
                        : selectedCategory === 'KHATA'
                        ? `${customers.length} Khata Ledger Balances`
                        : `Complete Company Data (${customers.length} Customers, ${inventory.length} Stock, ${invoices.length} Bills)`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Target Compatibility:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedCategory === 'CUSTOMERS' || selectedCategory === 'INVENTORY' || selectedCategory === 'INVOICES'
                        ? exportFormat === 'XML'
                          ? 'Tally Prime (Import Menu: Alt+O > Masters/Transactions)'
                          : 'Microsoft Excel, Google Sheets, Tally Excel Import'
                        : selectedCategory === 'BACKUP'
                        ? 'Full ERP JSON Archive & Disaster Recovery'
                        : 'Excel, Sheets, ERP Reporting & CSV Importers'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">File Structure:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedCategory === 'BACKUP'
                        ? 'UTF-8 JSON Schema with Company Metadata'
                        : exportFormat === 'XML' &&
                          (selectedCategory === 'CUSTOMERS' || selectedCategory === 'INVENTORY' || selectedCategory === 'INVOICES')
                        ? '<ENVELOPE> with <REQUESTDATA> & Tally Messages'
                        : 'RFC-4180 Comma Separated Values (Excel ready)'}
                    </span>
                  </div>
                </div>

                {/* Quick Hint */}
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    {selectedCategory === 'INVOICES' || selectedCategory === 'CUSTOMERS' || selectedCategory === 'INVENTORY' ? (
                      <span>
                        <strong>Tally Import Shortcut:</strong> In Tally Prime, press <strong>Alt+O (Import)</strong> on the top menu bar &gt; choose <strong>{selectedCategory === 'INVOICES' ? 'Transactions' : 'Masters'}</strong> &gt; select the downloaded XML file.
                      </span>
                    ) : selectedCategory === 'BACKUP' ? (
                      <span>
                        <strong>Disaster Recovery Guarantee:</strong> This file contains 100% of your company's data. Store this JSON backup in Google Drive, OneDrive, or an offline secure vault.
                      </span>
                    ) : (
                      <span>
                        <strong>Spreadsheet Reconciliation:</strong> Open the downloaded CSV in Microsoft Excel or Google Sheets for monthly audits, CA tax filings, or dispatch reviews.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleDownloadExport}
                  className="w-full sm:flex-1 py-3 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/30 flex items-center justify-center gap-2 transition-all hover:scale-102 active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Download{' '}
                    {selectedCategory === 'BACKUP'
                      ? 'Full System JSON Backup'
                      : exportFormat === 'XML' &&
                        (selectedCategory === 'CUSTOMERS' || selectedCategory === 'INVENTORY' || selectedCategory === 'INVOICES')
                      ? 'Tally Prime XML'
                      : 'Excel / CSV Spreadsheet'}
                  </span>
                </button>

                <button
                  onClick={handleCopyExport}
                  className="w-full sm:w-auto py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {exportCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveGuideCategory(selectedCategory as GuideCategory);
                    setActiveTab('GUIDE');
                  }}
                  className="w-full sm:w-auto py-3 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-red-600" />
                  <span>View How to Export Guide</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HOW TO EXPORT EACH TYPE OF DATA IN THE SOFTWARE (COMPREHENSIVE GUIDE)
          ========================================================================= */}
      {activeTab === 'GUIDE' && (
        <div className="space-y-6">
          {/* Guide Sub-Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: 'CUSTOMERS' as const, label: '1. Customer Ledgers & Debtors', icon: Users },
              { id: 'INVENTORY' as const, label: '2. Stock Items & AC Units', icon: Boxes },
              { id: 'INVOICES' as const, label: '3. Sales Invoices / Day Book', icon: Receipt },
              { id: 'QUOTATIONS' as const, label: '4. Quotations & Estimates', icon: FileText },
              { id: 'SHIPMENTS' as const, label: '5. Deliveries & Dispatch (D...)', icon: Truck },
              { id: 'KHATA' as const, label: '6. Dues & Khata Ledger', icon: Scale },
              { id: 'BACKUP' as const, label: '7. Full ERP Database Backup', icon: HardDrive },
              { id: 'IMPORT_TO_TALLY' as const, label: '8. How to Import Lakhi XML into Tally (Alt+O)', icon: Database },
            ].map((g) => {
              const Icon = g.icon;
              const isActive = activeGuideCategory === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGuideCategory(g.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>

          {/* Guide 1: Customer Ledgers */}
          {activeGuideCategory === 'CUSTOMERS' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                    <Users className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Customer Ledgers (Sundry Debtors) Data Export Guide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export party legal names, phone numbers, billing addresses, GSTIN numbers, and opening balances.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {customers.length} Customer Masters Recorded
                  </span>
                  <button
                    onClick={() => {
                      setSelectedCategory('CUSTOMERS');
                      setActiveTab('EXPORT');
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Customers Now</span>
                  </button>
                </div>
              </div>

              {/* SECTION A: How to Export in Lakhi Software */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-md">
                    🅰️ How to Export from Lakhi Airconditioners ERP
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 1</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Open Tally Prime &gt; Export Tab</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Click the <strong>Tally Prime (Import/Export)</strong> tab on the staff navigation bar, or click <strong>Tally Prime Sync</strong> from the header.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 2</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Select "Customer Ledgers (Masters)"</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Choose <strong>Tally XML (Native)</strong> for automated ledger posting into Tally Prime, or <strong>Excel / CSV</strong> for spreadsheet contact lists.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 3</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Click "Download Tally Prime XML"</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      A file named <code>Tally_Customers_Master_[date].xml</code> will download instantly to your device, formatted with <code>&lt;TALLYMESSAGE&gt;</code> envelope.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION B: How to Export from Tally Prime */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
                    🅱️ How to Export from Tally Prime (To Import into Lakhi)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    {
                      step: 'Step 1',
                      title: 'Open Chart of Accounts',
                      desc: 'From Gateway of Tally, select Chart of Accounts > Ledgers (or press Alt+G and search "Ledgers").',
                      keys: 'Gateway > Chart of Accounts > Ledgers',
                    },
                    {
                      step: 'Step 2',
                      title: 'Press Export Shortcut',
                      desc: 'Click Export on the top bar or press Alt + E, then press M for Masters.',
                      keys: 'Alt + E > Masters',
                    },
                    {
                      step: 'Step 3',
                      title: 'Configure XML / Excel Format',
                      desc: 'Press C (Configure). Set File Format to "XML (Data Interchange)". Set Include Dependent Info to "Yes".',
                      keys: 'C (Configure) > XML',
                    },
                    {
                      step: 'Step 4',
                      title: 'Send & Upload into Lakhi',
                      desc: 'Press Send (Ctrl+A). Switch to Lakhi Software > Tally Prime > Import tab and drop the file!',
                      keys: 'Ctrl + A / Send',
                    },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                          {s.step}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                          {s.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                        ⌨️ {s.keys}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION C: Field Mapping Matrix */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Field Mapping Matrix: Customer Ledgers</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                        <th className="pb-2 font-bold">Lakhi ERP Field</th>
                        <th className="pb-2 font-bold">Tally XML Tag</th>
                        <th className="pb-2 font-bold">Tally Parent Group</th>
                        <th className="pb-2 font-bold">Sample Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      <tr>
                        <td className="py-1.5 font-bold text-slate-900 dark:text-white">Legal Bill Name</td>
                        <td className="py-1.5 text-blue-600">&lt;NAME&gt;</td>
                        <td className="py-1.5">&lt;PARENT&gt;Sundry Debtors&lt;/PARENT&gt;</td>
                        <td className="py-1.5 text-slate-500">Gautam Enterprise (Ahmedabad)</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-bold text-slate-900 dark:text-white">Phone / Mobile</td>
                        <td className="py-1.5 text-blue-600">&lt;LEDGERMOBILE&gt;</td>
                        <td className="py-1.5">Party Contact Details</td>
                        <td className="py-1.5 text-slate-500">+91 99980 21446</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-bold text-slate-900 dark:text-white">GSTIN Number</td>
                        <td className="py-1.5 text-blue-600">&lt;PARTYGSTIN&gt;</td>
                        <td className="py-1.5">Statutory / GST Registration</td>
                        <td className="py-1.5 text-slate-500">24AAACH7409R1ZZ</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-bold text-slate-900 dark:text-white">Billing Address</td>
                        <td className="py-1.5 text-blue-600">&lt;ADDRESS.LIST&gt;&lt;ADDRESS&gt;</td>
                        <td className="py-1.5">Mailing Details</td>
                        <td className="py-1.5 text-slate-500">Shop 14, SG Highway, Ahmedabad</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Guide 2: Store Stock Items */}
          {activeGuideCategory === 'INVENTORY' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                    <Boxes className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Store Stock Items &amp; AC Appliances Data Export Guide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export AC models, indoor/outdoor model numbers, physical carton serial numbers, selling rates, and HSN codes.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {inventory.length} Physical Stock Units
                  </span>
                  <button
                    onClick={() => {
                      setSelectedCategory('INVENTORY');
                      setActiveTab('EXPORT');
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Stock Now</span>
                  </button>
                </div>
              </div>

              {/* SECTION A: How to Export in Lakhi Software */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-md">
                    🅰️ How to Export from Lakhi Airconditioners ERP
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 1</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Go to Store Stock or Tally Tab</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Navigate to <strong>Store Stock</strong> on the top menu, or open <strong>Tally Prime (Import/Export) &gt; Export Data</strong>.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 2</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Select "Store Stock Items"</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Choose <strong>Tally XML</strong> to export Stock Item masters with <code>&lt;STOCKITEM&gt;</code>, base units (Nos), and pricing, or <strong>Excel / CSV</strong>.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 3</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Save &amp; Open in Tally / Excel</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Download <code>Tally_StockItems_Master_[date].xml</code>. In Tally Prime, import via <strong>Alt+O &gt; Masters</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION B: How to Export from Tally Prime */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
                    🅱️ How to Export from Tally Prime (To Import into Lakhi)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    {
                      step: 'Step 1',
                      title: 'Open Stock Summary / Masters',
                      desc: 'From Gateway of Tally, go to Chart of Accounts > Stock Items (or press Alt+G and type "Stock Items").',
                      keys: 'Gateway > Stock Items',
                    },
                    {
                      step: 'Step 2',
                      title: 'Press Export Shortcut',
                      desc: 'Press Alt+E on your keyboard or click the Export button on the top navigation bar.',
                      keys: 'Alt + E > Masters',
                    },
                    {
                      step: 'Step 3',
                      title: 'Set Format to XML or Excel',
                      desc: 'Under Configuration (C), set Format to XML (Data Interchange). Set "Show Closing Balances" to Yes.',
                      keys: 'C > XML (Data Interchange)',
                    },
                    {
                      step: 'Step 4',
                      title: 'Send & Drop into Lakhi ERP',
                      desc: 'Press Send. In Lakhi Software, select "Stock Items" on the Import tab and drag-and-drop the file!',
                      keys: 'Press Enter or Send',
                    },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                          {s.step}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                          {s.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                        ⌨️ {s.keys}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro-Tip Box */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>💡 AC Multi-Unit Splitting:</strong> In Lakhi ERP, Split Air Conditioners track both Indoor (IDU) and Outdoor (ODU) model and serial numbers. During Tally XML export, these are neatly embedded into the <code>&lt;DESCRIPTION&gt;</code> and <code>&lt;PARTNO&gt;</code> tags so your Tally technician can verify carton barcodes on delivery!
              </div>
            </div>
          )}

          {/* Guide 3: Sales Tax Invoices */}
          {activeGuideCategory === 'INVOICES' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Receipt className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Sales Tax Invoices &amp; Vouchers Data Export Guide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export sales registers with line items, tax components (Output CGST @ 9%, Output SGST @ 9%), customer debits, and payments.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {invoices.length} Tax Invoices Recorded
                  </span>
                  <button
                    onClick={() => {
                      setSelectedCategory('INVOICES');
                      setActiveTab('EXPORT');
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Invoices Now</span>
                  </button>
                </div>
              </div>

              {/* SECTION A: How to Export in Lakhi Software */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-md">
                    🅰️ How to Export from Lakhi Airconditioners ERP
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 1</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Open Tally Prime Export Tab</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Go to <strong>Tally Prime &gt; Export Data</strong>, or click <strong>Tally Prime Sync</strong> from the <strong>Billing &amp; Invoices</strong> screen.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 2</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Select "Sales Invoices (Vouchers)"</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Choose <strong>Tally XML</strong> for automatic journal vouchers in Tally Day Book, or <strong>Excel / CSV</strong> for monthly CA sales registers.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-black text-red-600 font-mono">Step 3</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Click "Download Tally Prime XML"</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Downloads <code>Tally_SalesVouchers_[date].xml</code>. Contains party debits, sales credits, and separate CGST &amp; SGST ledger entries.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION B: How to Export from Tally Prime */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
                    🅱️ How to Export from Tally Prime (To Import into Lakhi)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    {
                      step: 'Step 1',
                      title: 'Open Day Book or Sales Register',
                      desc: 'From Gateway of Tally, go to Display More Reports (D) > Day Book (D) or Account Books > Sales Register.',
                      keys: 'D > D (Day Book)',
                    },
                    {
                      step: 'Step 2',
                      title: 'Select Date Range',
                      desc: 'Press F2 (Period) and select the starting and ending date for the invoices to export.',
                      keys: 'F2 (Select Period)',
                    },
                    {
                      step: 'Step 3',
                      title: 'Export Transactions',
                      desc: 'Press Alt+E > Transactions > Configure format to XML (Data Interchange) or Excel.',
                      keys: 'Alt + E > Transactions',
                    },
                    {
                      step: 'Step 4',
                      title: 'Upload to Lakhi Software',
                      desc: 'Save the exported file and upload it into the Import tab under "Sales Invoices" to sync books.',
                      keys: 'Ctrl + A / Send',
                    },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                          {s.step}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                          {s.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                        ⌨️ {s.keys}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Guide 4: Quotations & Estimates */}
          {activeGuideCategory === 'QUOTATIONS' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                    <FileText className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Quotations &amp; Estimates (Q...) Data Export Guide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export active client estimates, proposals, itemized appliance breakdowns, and tax estimations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {quotations.length} Quotations Recorded
                  </span>
                  <button
                    onClick={() => {
                      setSelectedCategory('QUOTATIONS');
                      setActiveTab('EXPORT');
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Quotations CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black text-purple-600 font-mono">Format 1 • Excel / CSV</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Quotations Register Spreadsheet</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Under the <strong>Export Data</strong> tab, select <strong>Quotations &amp; Estimates</strong> to download an RFC-4180 CSV containing Quote IDs, Customer Legal Names, Phone Numbers, Item Counts, Subtotals, and Statuses.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black text-purple-600 font-mono">Format 2 • PDF Documents</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Official Branded Quotation PDFs</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    In the <strong>Quotes (Q...)</strong> tab, click the <strong>Download PDF</strong> or <strong>Share Link</strong> icon on any quote to generate client-ready estimates with your official brand logo, GSTIN, and QR payment codes.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black text-purple-600 font-mono">Format 3 • WhatsApp Direct</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Instant WhatsApp Estimates</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Click the <strong>WhatsApp</strong> icon next to any quotation to immediately send a pre-formatted itemized quote breakdown with total pricing directly to the customer's phone number.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Guide 5: Shipments & Deliveries */}
          {activeGuideCategory === 'SHIPMENTS' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Truck className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Deliveries &amp; Dispatch (D...) Data Export Guide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export delivery challans, vehicle dispatch manifests, driver contact numbers, and delivery confirmation logs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {shipments.length} Dispatches Tracked
                  </span>
                  <button
                    onClick={() => {
                      setSelectedCategory('SHIPMENTS');
                      setActiveTab('EXPORT');
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Shipments CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black text-indigo-600 font-mono">Export Method 1</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">CSV Dispatch Manifest</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Under <strong>Export Data &gt; Deliveries &amp; Shipments</strong>, download a consolidated spreadsheet including Dispatch IDs (D...), Linked Tax Invoice references, Customer Destination Addresses, and Current Delivery Statuses.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black text-indigo-600 font-mono">Export Method 2</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Delivery Challan PDF &amp; Driver Copy</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    In the <strong>Deliveries &amp; Tracking (D...)</strong> tab, click <strong>Print Delivery Challan</strong> to generate the physical gate-pass copy for your transport vehicle and customer signature.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Guide 6: Dues & Khata */}
          {activeGuideCategory === 'KHATA' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                    <Scale className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Who Owes Who (Dues &amp; Khata) Data Export Guide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export outstanding customer aging schedules, unpaid balance rosters, and credit/advance fund positions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedCategory('KHATA');
                      setActiveTab('EXPORT');
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Khata CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black text-rose-600 font-mono">1. Outstanding Balance Spreadsheet</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Export Dues Aging Report (CSV)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Under <strong>Export Data</strong>, choose <strong>Who Owes Who (Dues &amp; Khata)</strong> to generate an instant CSV report containing every debtor's legal name, total invoiced volume, and net outstanding balance.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black text-rose-600 font-mono">2. Individual Customer Ledger Statement</span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Print Customer Statement (PDF)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    In the <strong>Customers &amp; Ledger</strong> tab, select any customer and click <strong>Print Statement</strong> to generate a full chronological ledger of bills and payment receipts (T... formula).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Guide 7: Full ERP Database Backup */}
          {activeGuideCategory === 'BACKUP' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="p-3 rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 shrink-0">
                    <HardDrive className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Full ERP Database Backup (Disaster Recovery) Guide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Export 100% of your company's records in one consolidated, encrypted-ready JSON database archive.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedCategory('BACKUP');
                      setActiveTab('EXPORT');
                    }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Full Backup JSON</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-black text-teal-600 font-mono">1. Complete Portability</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Includes All Masters &amp; Vouchers</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      The backup JSON contains your complete Customer Directory, Store Stock, Sales Invoices, Estimates, Delivery Trackers, and Business GST Settings.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-black text-teal-600 font-mono">2. Zero Vendor Lock-In</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Standard Open JSON Format</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      All records are structured with ISO timestamps, standard currency fields, and relational IDs that can be migrated to PostgreSQL, MySQL, or SAP.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-black text-teal-600 font-mono">3. Recommended Frequency</span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Weekly Enterprise Backup</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      We recommend downloading a full backup every Friday evening and archiving it on an external hard drive or secure company cloud vault.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guide 8: How to Import into Tally Prime */}
          {activeGuideCategory === 'IMPORT_TO_TALLY' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Database className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    How to Import Lakhi Software XML into Tally Prime (Alt + O)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Step-by-step instructions to post exported sales vouchers and customer masters directly into your Tally Prime company.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black font-mono">
                      Step 1 • Export from Lakhi
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                      Download XML from Lakhi ERP
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Go to the <strong>Export Data</strong> tab above. Choose <strong>Sales Invoices (Vouchers)</strong> or <strong>Customer Ledgers</strong>, and click <strong>Download Tally Prime XML</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black font-mono">
                      Step 2 • Press Alt + O in Tally
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                      Open Tally Import Menu
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      In Tally Prime, press <strong>Alt + O (Import)</strong> on the top menu bar. Select <strong>Transactions</strong> (for Invoices) or <strong>Masters</strong> (for Customers / Items).
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black font-mono">
                      Step 3 • Confirm Import
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                      Select XML File &amp; Post
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Browse to your Downloads folder or paste the XML file path. Press <strong>Enter</strong>. Tally Prime immediately posts all vouchers into your books with CGST, SGST, and party ledger!
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  <strong>💡 Pro-Tip for Tally Prime Error Log:</strong> If Tally reports any missing ledger (e.g., "Output CGST @ 9%"), ensure your company chart of accounts has standard ledgers named <em>Output CGST @ 9%</em>, <em>Output SGST @ 9%</em>, and <em>Sales Account</em>.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
