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
  Building2,
  Link2,
  PackageCheck,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
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
  SAMPLE_TALLY_MASTERS_AND_TRANSACTIONS_XML,
  SAMPLE_TALLY_ALL_MASTERS_XML,
  ParsedTallyCustomer,
  ParsedTallyStockItem,
  ParsedTallyInvoice,
  ParsedTallyMasterSummary,
  TallyParseStats,
} from '../../utils/tallyHelper';

export type TallyCategory =
  | 'CUSTOMERS'
  | 'DEALERS'
  | 'INVENTORY'
  | 'INVOICES'
  | 'DELIVERY_NOTES'
  | 'QUOTATIONS'
  | 'SHIPMENTS'
  | 'KHATA'
  | 'BACKUP';

export type GuideCategory =
  | 'CUSTOMERS'
  | 'DEALERS'
  | 'INVENTORY'
  | 'INVOICES'
  | 'DELIVERY_NOTES'
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
    updateCustomer,
    addInventoryItem,
    addInvoice,
    createAnyDocument,
    updateAnyDocument,
    gstNumber,
  } = useApp();

  // Active top navigation tab: 'IMPORT' | 'EXPORT' | 'GUIDE'
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'EXPORT' | 'GUIDE'>(initialTab);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<TallyCategory>(initialCategory);

  // Import Mode Strategy: 'MERGE' (Auto-Detect & Merge) vs 'REPLACE' (Overwrite Existing Data)
  const [importStrategy, setImportStrategy] = useState<'MERGE' | 'REPLACE'>('MERGE');

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

  const [parsedMasterSummary, setParsedMasterSummary] = useState<ParsedTallyMasterSummary | null>(null);
  const [parsedCustomers, setParsedCustomers] = useState<ParsedTallyCustomer[]>([]);
  const [parsedDealers, setParsedDealers] = useState<ParsedTallyCustomer[]>([]);
  const [parsedStock, setParsedStock] = useState<ParsedTallyStockItem[]>([]);
  const [parsedInvoices, setParsedInvoices] = useState<ParsedTallyInvoice[]>([]);
  const [parsedDeliveryNotes, setParsedDeliveryNotes] = useState<ParsedTallyInvoice[]>([]);

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
      const parsed = parseTallyXmlData(text, customers);
      setParsedMasterSummary(parsed.masters);
      setParsedCustomers(parsed.customers);
      setParsedDealers(parsed.dealers);
      setParsedStock(parsed.stockItems);
      setParsedInvoices(parsed.invoices);
      setParsedDeliveryNotes(parsed.deliveryNotes);
      setParseStats(parsed.stats);
      setParseWarnings(parsed.warnings);
      setRawSampleLines(parsed.rawSampleLines);

      // Auto-switch category based on which items were found
      if (parsed.customers.length > 0 && selectedCategory !== 'CUSTOMERS') {
        setSelectedCategory('CUSTOMERS');
        setSelectedItemIndices(parsed.customers.map((_, i) => i));
      } else if (parsed.dealers.length > 0 && selectedCategory !== 'DEALERS') {
        setSelectedCategory('DEALERS');
        setSelectedItemIndices(parsed.dealers.map((_, i) => i));
      } else if (parsed.stockItems.length > 0 && selectedCategory !== 'INVENTORY') {
        setSelectedCategory('INVENTORY');
        setSelectedItemIndices(parsed.stockItems.map((_, i) => i));
      } else if (parsed.invoices.length > 0 && selectedCategory !== 'INVOICES') {
        setSelectedCategory('INVOICES');
        setSelectedItemIndices(parsed.invoices.map((_, i) => i));
      } else if (parsed.deliveryNotes.length > 0 && selectedCategory !== 'DELIVERY_NOTES') {
        setSelectedCategory('DELIVERY_NOTES');
        setSelectedItemIndices(parsed.deliveryNotes.map((_, i) => i));
      } else {
        const count = getActiveCategoryCount(selectedCategory, parsed);
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
        selectedCategory === 'INVENTORY' || selectedCategory === 'INVOICES' || selectedCategory === 'DELIVERY_NOTES' || selectedCategory === 'DEALERS'
          ? selectedCategory
          : 'CUSTOMERS';
      const parsed = parseTallyCsvData(text, csvCategory, effDelim, customers);
      setParsedCustomers(parsed.customers);
      setParsedDealers(parsed.dealers);
      setParsedStock(parsed.stockItems);
      setParsedInvoices(parsed.invoices);
      setParsedDeliveryNotes(parsed.deliveryNotes);
      setParseStats(parsed.stats);
      setParseWarnings(parsed.warnings);
      setRawSampleLines(parsed.rawSampleLines);

      const count = getActiveCategoryCount(selectedCategory, parsed);
      setSelectedItemIndices(Array.from({ length: count }, (_, i) => i));

      if (parsed.stats.totalFound === 0) {
        setImportErrorMessage(
          `File loaded (${(parsed.stats.fileSizeBytes / 1024).toFixed(1)} KB), but 0 records were parsed. Try switching delimiter or category below.`
        );
      }
    }
  };

  const getActiveCategoryCount = (cat: TallyCategory, parsed?: any) => {
    const custs = parsed ? parsed.customers : parsedCustomers;
    const dlrs = parsed ? parsed.dealers : parsedDealers;
    const stck = parsed ? parsed.stockItems : parsedStock;
    const invs = parsed ? parsed.invoices : parsedInvoices;
    const deliv = parsed ? parsed.deliveryNotes : parsedDeliveryNotes;

    switch (cat) {
      case 'CUSTOMERS':
        return custs.length;
      case 'DEALERS':
        return dlrs.length;
      case 'INVENTORY':
        return stck.length;
      case 'INVOICES':
        return invs.length;
      case 'DELIVERY_NOTES':
        return deliv.length;
      default:
        return 0;
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
  const handleLoadSample = (cat: TallyCategory | 'ALL' | 'ALL_MASTERS') => {
    if (cat === 'ALL_MASTERS') {
      setSelectedCategory('CUSTOMERS');
      processRawFileText(SAMPLE_TALLY_ALL_MASTERS_XML, 'sample_tally_all_masters.xml');
    } else if (cat === 'ALL') {
      processRawFileText(SAMPLE_TALLY_MASTERS_AND_TRANSACTIONS_XML, 'sample_tally_masters_and_transactions.xml');
    } else if (cat === 'CUSTOMERS' || cat === 'DEALERS') {
      setSelectedCategory('CUSTOMERS');
      processRawFileText(SAMPLE_TALLY_CUSTOMERS_XML, 'sample_tally_customers.xml');
    } else if (cat === 'INVENTORY') {
      setSelectedCategory('INVENTORY');
      processRawFileText(SAMPLE_TALLY_INVENTORY_XML, 'sample_tally_inventory.xml');
    }
  };

  // Select / deselect all
  const activeParsedCount = getActiveCategoryCount(selectedCategory);

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

  // Execute Smart Import to Firestore Database
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
      let mergedCount = 0;
      let replacedCount = 0;

      // 1. CUSTOMERS (Sundry Debtors)
      if (selectedCategory === 'CUSTOMERS') {
        for (const idx of selectedItemIndices) {
          const item = parsedCustomers[idx];
          if (!item) continue;

          if (item.existingMatchId) {
            if (importStrategy === 'MERGE') {
              const mergePayload: Partial<Customer> = {
                notes: `Tally Merged (${new Date().toLocaleDateString()}): ${item.notes || ''}`,
              };
              if (item.phone) mergePayload.phone = item.phone;
              if (item.email) mergePayload.email = item.email;
              if (item.billingAddress) mergePayload.billingAddress = item.billingAddress;
              if (item.gstin) mergePayload.gstin = item.gstin;
              if (item.accountBalance !== undefined) mergePayload.accountBalance = item.accountBalance;

              await updateCustomer(item.existingMatchId, mergePayload);
              mergedCount++;
            } else {
              // REPLACE
              await updateCustomer(item.existingMatchId, {
                externalName: item.externalName || 'Customer',
                phone: item.phone || '',
                email: item.email || '',
                billingAddress: item.billingAddress || '',
                installationAddress: item.installationAddress || item.billingAddress || '',
                gstin: item.gstin || '',
                accountBalance: item.accountBalance || 0,
                notes: `Replaced from Tally Prime Export (${new Date().toLocaleDateString()})`,
              });
              replacedCount++;
            }
          } else {
            await addCustomer({
              externalName: item.externalName || 'Customer',
              phone: item.phone || '',
              email: item.email || '',
              billingAddress: item.billingAddress || '',
              installationAddress: item.installationAddress || item.billingAddress || '',
              gstin: item.gstin || '',
              accountBalance: item.accountBalance || 0,
              notes: item.notes || 'Imported from Tally Prime',
            });
            importedCount++;
          }
        }
      }
      // 2. DEALERS / SUPPLIERS (Sundry Creditors)
      else if (selectedCategory === 'DEALERS') {
        for (const idx of selectedItemIndices) {
          const item = parsedDealers[idx];
          if (!item) continue;

          if (item.existingMatchId) {
            if (importStrategy === 'MERGE') {
              const mergePayload: Partial<Customer> = {
                notes: `Dealer Supplier Merged (${new Date().toLocaleDateString()}): ${item.notes || ''}`,
              };
              if (item.phone) mergePayload.phone = item.phone;
              if (item.email) mergePayload.email = item.email;
              if (item.billingAddress) mergePayload.billingAddress = item.billingAddress;
              if (item.gstin) mergePayload.gstin = item.gstin;
              if (item.accountBalance !== undefined) mergePayload.accountBalance = -Math.abs(item.accountBalance);

              await updateCustomer(item.existingMatchId, mergePayload);
              mergedCount++;
            } else {
              await updateCustomer(item.existingMatchId, {
                externalName: item.externalName || 'Dealer Supplier',
                phone: item.phone || '',
                email: item.email || '',
                billingAddress: item.billingAddress || '',
                gstin: item.gstin || '',
                accountBalance: item.accountBalance ? -Math.abs(item.accountBalance) : 0,
                notes: `Dealer Supplier Replaced from Tally (${new Date().toLocaleDateString()})`,
              });
              replacedCount++;
            }
          } else {
            await addCustomer({
              externalName: item.externalName || 'Dealer Supplier',
              internalName: `Dealer / Supplier (${item.tallyParent || 'Sundry Creditors'})`,
              phone: item.phone || '',
              email: item.email || '',
              billingAddress: item.billingAddress || '',
              installationAddress: item.billingAddress || '',
              gstin: item.gstin || '',
              accountBalance: item.accountBalance ? -Math.abs(item.accountBalance) : 0,
              notes: item.notes || 'Imported from Tally Prime Sundry Creditors',
            });
            importedCount++;
          }
        }
      }
      // 3. INVENTORY & AC STOCK
      else if (selectedCategory === 'INVENTORY') {
        for (const idx of selectedItemIndices) {
          const item = parsedStock[idx];
          if (!item) continue;

          const existingMatch = inventory.find(
            (inv) =>
              (item.serialNo && inv.serialNo === item.serialNo) ||
              (item.indoorUnitSerial && inv.indoorUnitSerial === item.indoorUnitSerial) ||
              (inv.modelNo && inv.modelNo.toLowerCase() === item.modelNo.toLowerCase() && inv.status === 'AVAILABLE')
          );

          if (existingMatch) {
            if (importStrategy === 'MERGE') {
              await updateAnyDocument('inventory', existingMatch.id, {
                sellingPrice: item.sellingPrice || existingMatch.sellingPrice,
                indoorUnitSerial: item.indoorUnitSerial || existingMatch.indoorUnitSerial,
                outdoorUnitSerial: item.outdoorUnitSerial || existingMatch.outdoorUnitSerial,
                updatedAt: new Date().toISOString(),
              });
              mergedCount++;
            } else {
              await updateAnyDocument('inventory', existingMatch.id, {
                name: item.name,
                modelNo: item.modelNo,
                indoorModelNo: item.indoorModelNo,
                outdoorModelNo: item.outdoorModelNo,
                sellingPrice: item.sellingPrice,
                indoorUnitSerial: item.indoorUnitSerial,
                outdoorUnitSerial: item.outdoorUnitSerial,
                updatedAt: new Date().toISOString(),
              });
              replacedCount++;
            }
          } else {
            await addInventoryItem({
              name: item.name,
              modelNo: item.modelNo || 'FTKF50TV',
              indoorModelNo: item.indoorModelNo,
              outdoorModelNo: item.outdoorModelNo,
              type: item.type || 'AC',
              brand: item.brand || 'Daikin',
              serialNo: item.serialNo || `TALLY-${Date.now().toString().slice(-4)}${importedCount + 1}`,
              indoorUnitSerial: item.indoorUnitSerial,
              outdoorUnitSerial: item.outdoorUnitSerial,
              sellingPrice: item.sellingPrice || 45000,
            });
            importedCount++;
          }
        }
      }
      // 4. SALES INVOICES
      else if (selectedCategory === 'INVOICES') {
        for (const idx of selectedItemIndices) {
          const item = parsedInvoices[idx];
          if (!item) continue;

          // Customer Auto-Linking: resolve customer ID or create new customer
          let effectiveCustId = item.matchedCustomerId;
          if (!effectiveCustId) {
            effectiveCustId = await addCustomer({
              externalName: item.customerName,
              phone: item.customerPhone || '9800000000',
              billingAddress: item.billingAddress || 'Store Pickup',
              installationAddress: item.billingAddress || 'Store Pickup',
              gstin: item.gstin,
              accountBalance: 0,
              notes: `Auto-linked from Tally Invoice #${item.invoiceNumber}`,
            });
          }

          const existingInv = invoices.find((inv) => inv.id === item.invoiceNumber || inv.notes?.includes(item.invoiceNumber));

          const subtotal = item.taxableAmount || item.totalAmount / 1.18;
          const taxAmount = item.cgstAmount && item.sgstAmount ? item.cgstAmount + item.sgstAmount + (item.igstAmount || 0) : item.totalAmount - subtotal;

          if (existingInv && importStrategy === 'REPLACE') {
            await updateAnyDocument('invoices', existingInv.id, {
              customerId: effectiveCustId,
              customerExternalName: item.customerName,
              totalAmount: item.totalAmount,
              subtotal,
              taxAmount,
              amountDue: item.totalAmount,
              updatedAt: new Date().toISOString(),
            });
            replacedCount++;
          } else {
            await addInvoice(
              {
                customerId: effectiveCustId,
                customerExternalName: item.customerName,
                customerPhone: item.customerPhone || 'Not specified',
                billingAddress: item.billingAddress || 'Store Pickup',
                installationAddress: item.billingAddress || 'Store Pickup',
                items: item.items.map((it, itIdx) => ({
                  id: `inv-it-${Date.now()}-${itIdx}`,
                  name: it.name,
                  modelNo: it.modelNo || 'STANDARD',
                  indoorModelNo: it.indoorModelNo,
                  outdoorModelNo: it.outdoorModelNo,
                  indoorUnitSerial: it.indoorUnitSerial,
                  outdoorUnitSerial: it.outdoorUnitSerial,
                  serialNo: it.serialNo,
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
              },
              item.invoiceNumber
            );
            importedCount++;
          }
        }
      }
      // 5. DELIVERY NOTES (Pending Shipments)
      else if (selectedCategory === 'DELIVERY_NOTES') {
        for (const idx of selectedItemIndices) {
          const item = parsedDeliveryNotes[idx];
          if (!item) continue;

          let effectiveCustId = item.matchedCustomerId;
          if (!effectiveCustId) {
            effectiveCustId = await addCustomer({
              externalName: item.customerName,
              phone: item.customerPhone || '9800000000',
              billingAddress: item.billingAddress || 'Delivery Address',
              installationAddress: item.billingAddress || 'Delivery Address',
              gstin: item.gstin,
              accountBalance: 0,
              notes: `Auto-linked from Tally Delivery Note #${item.invoiceNumber}`,
            });
          }

          const itemsSummary = item.items
            .map((it) => `${it.name} (Qty: ${it.quantity}${it.indoorUnitSerial ? `, IDU: ${it.indoorUnitSerial}` : ''}${it.outdoorUnitSerial ? `, ODU: ${it.outdoorUnitSerial}` : ''})`)
            .join(' | ');

          await createAnyDocument(
            'shipments',
            {
              customerId: effectiveCustId,
              customerExternalName: item.customerName,
              customerPhone: item.customerPhone || 'Not specified',
              deliveryAddress: item.billingAddress || 'Delivery Location',
              installationAddress: item.billingAddress || 'Delivery Location',
              itemsSummary,
              status: 'ORDER_PLACED',
              outForDeliveryEnabled: false,
              trackingUpdates: [
                {
                  id: `trk-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  message: `Imported from Tally Delivery Note Challan #${item.invoiceNumber}`,
                },
              ],
              createdAt: new Date().toISOString(),
            },
            item.invoiceNumber
          );
          importedCount++;
        }
      }

      const modeMsg = importStrategy === 'MERGE' ? `Merged ${mergedCount}, Added ${importedCount}` : `Replaced ${replacedCount}, Added ${importedCount}`;
      setImportSuccessMessage(
        `Success! Processed ${selectedItemIndices.length} ${selectedCategory.toLowerCase()} record(s). (${modeMsg})`
      );
      setSelectedItemIndices([]);
    } catch (err: any) {
      console.error('Import error:', err);
      setImportErrorMessage(`Failed to import data: ${err.message || 'Unknown database error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Export helpers
  const getExportDataString = (): { content: string; filename: string; mime: string } => {
    const timestamp = new Date().toISOString().slice(0, 10);

    if (selectedCategory === 'CUSTOMERS') {
      return exportFormat === 'XML'
        ? { content: generateTallyCustomersXml(customers), filename: `Tally_Customers_Master_${timestamp}.xml`, mime: 'application/xml' }
        : { content: generateCustomersCsv(customers), filename: `Lakhi_Customers_${timestamp}.csv`, mime: 'text/csv' };
    } else if (selectedCategory === 'INVENTORY') {
      return exportFormat === 'XML'
        ? { content: generateTallyInventoryXml(inventory), filename: `Tally_StockItems_Master_${timestamp}.xml`, mime: 'application/xml' }
        : { content: generateInventoryCsv(inventory), filename: `Lakhi_Inventory_${timestamp}.csv`, mime: 'text/csv' };
    } else if (selectedCategory === 'INVOICES') {
      return exportFormat === 'XML'
        ? { content: generateTallyInvoicesXml(invoices), filename: `Tally_SalesVouchers_${timestamp}.xml`, mime: 'application/xml' }
        : { content: generateInvoicesCsv(invoices), filename: `Lakhi_Invoices_${timestamp}.csv`, mime: 'text/csv' };
    } else if (selectedCategory === 'QUOTATIONS') {
      return { content: generateQuotationsCsv(quotations), filename: `Lakhi_Quotations_${timestamp}.csv`, mime: 'text/csv' };
    } else if (selectedCategory === 'SHIPMENTS') {
      return { content: generateShipmentsCsv(shipments), filename: `Lakhi_Shipments_${timestamp}.csv`, mime: 'text/csv' };
    } else if (selectedCategory === 'KHATA') {
      return { content: generateDuesKhataCsv(customers, invoices), filename: `Lakhi_Dues_Khata_${timestamp}.csv`, mime: 'text/csv' };
    } else {
      return {
        content: generateFullErpBackupJson({ customers, inventory, invoices, quotations, shipments, gstNumber }),
        filename: `Lakhi_ERP_Backup_${timestamp}.json`,
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
      {/* Top Banner Header */}
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
                  Dual Serials &amp; Auto-Link Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Import Ledgers, Dealers, Stock, Delivery Notes &amp; Sales Vouchers from Tally Prime into Lakhi ERP with automatic Customer ID linking and Merge/Replace options.
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
            <span>📖 Documentation</span>
          </button>
        </div>
      </div>

      {/* TAB 1: IMPORT FROM TALLY PRIME */}
      {activeTab === 'IMPORT' && (
        <div className="space-y-6">
          {/* Strategy Bar: Merge vs Replace */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-black text-slate-900 dark:text-white block">
                  Import &amp; De-duplication Strategy
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Controls how matching records are handled during database sync
                </span>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setImportStrategy('MERGE')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  importStrategy === 'MERGE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Smart Merge (Auto-Detect)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportStrategy('REPLACE')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  importStrategy === 'REPLACE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replace / Overwrite Data</span>
              </button>
            </div>
          </div>

          {/* Step 1: Select Category & Upload File */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Selector Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                  1
                </span>
                Select Data Category
              </h3>

              <div className="space-y-2">
                {[
                  {
                    id: 'CUSTOMERS' as const,
                    title: 'Customer Debtors',
                    desc: 'Sundry Debtors with Phone, Address, GSTIN, Opening Balance',
                    icon: Users,
                    badge: `${customers.length} Accounts`,
                  },
                  {
                    id: 'DEALERS' as const,
                    title: 'Dealers / Suppliers',
                    desc: 'Sundry Creditors & Wholesale Distributors',
                    icon: Building2,
                    badge: 'Creditors',
                  },
                  {
                    id: 'INVENTORY' as const,
                    title: 'Stock & Dual Serials',
                    desc: 'AC Models, Godowns, IDU & ODU Warranty Serials',
                    icon: Boxes,
                    badge: `${inventory.length} Units`,
                  },
                  {
                    id: 'INVOICES' as const,
                    title: 'Sales Invoices',
                    desc: 'Vouchers with Customer ID Linking & GST Tax',
                    icon: Receipt,
                    badge: `${invoices.length} Bills`,
                  },
                  {
                    id: 'DELIVERY_NOTES' as const,
                    title: 'Delivery Notes (Challans)',
                    desc: 'Pending Warehouse Dispatches & Delivery Shipments',
                    icon: Truck,
                    badge: `${shipments.length} Dispatches`,
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
                      className={`w-full p-3 rounded-2xl border text-left transition-all flex items-start gap-3 ${
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
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Quick Testing Samples
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('ALL_MASTERS')}
                    className="py-2 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Sample All Masters Payload</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('ALL')}
                    className="py-2 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Sample Vouchers Payload</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('CUSTOMERS')}
                    className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Sample Ledgers
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('INVENTORY')}
                    className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
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
                      <span>Reading &amp; Analyzing Tally file... Checking Ledgers, Dual Serials &amp; Vouchers</span>
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
                            {parseStats.customersFound} Debtors
                          </span>
                          <span className={`px-2 py-0.5 rounded-md ${parseStats.dealersFound > 0 ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {parseStats.dealersFound} Creditors
                          </span>
                          <span className={`px-2 py-0.5 rounded-md ${parseStats.stockItemsFound > 0 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {parseStats.stockItemsFound} Stock
                          </span>
                          <span className={`px-2 py-0.5 rounded-md ${parseStats.invoicesFound > 0 ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {parseStats.invoicesFound} Invoices
                          </span>
                          <span className={`px-2 py-0.5 rounded-md ${parseStats.deliveryNotesFound > 0 ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {parseStats.deliveryNotesFound} Delivery Notes
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

              {importSuccessMessage && (
                <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-bold">{importSuccessMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Master Summary Banner (Currencies, Groups, Units, Godowns, Accounts) */}
          {parsedMasterSummary && (
            <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Tally Master Structures Detected
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {uploadedFileName || 'XML Payload'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Currencies</span>
                  <span className="font-mono font-black text-amber-300 text-xs block truncate">
                    {parsedMasterSummary.currencies.length > 0
                      ? parsedMasterSummary.currencies.map((c) => c.name || c.expandedSymbol).join(', ')
                      : 'INR (₹)'}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Units &amp; Godowns</span>
                  <span className="font-mono font-black text-blue-300 text-xs block truncate">
                    {parsedMasterSummary.units.map((u) => u.name).join(', ') || 'SET'} • {parsedMasterSummary.godowns.map((g) => g.name).join(', ') || 'Central'}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Groups</span>
                  <span className="font-mono font-black text-indigo-300 text-xs block truncate">
                    {parsedMasterSummary.groups.length} ({parsedMasterSummary.groups.map((g) => g.name).slice(0, 2).join(', ')})
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Stock Items</span>
                  <span className="font-mono font-black text-emerald-300 text-xs block truncate">
                    {parsedMasterSummary.stockItems.length} Models
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Party Ledgers</span>
                  <span className="font-mono font-black text-cyan-300 text-xs block truncate">
                    {parsedMasterSummary.ledgers.length} Debtors/Creditors
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Financial/Tax</span>
                  <span className="font-mono font-black text-purple-300 text-xs block truncate">
                    {parsedMasterSummary.otherLedgers.length} Accounts
                  </span>
                </div>
              </div>

              {parsedMasterSummary.otherLedgers.length > 0 && (
                <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-300">Revenue &amp; Tax Ledgers Parsed:</span>
                  {parsedMasterSummary.otherLedgers.map((l, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 font-mono text-[10px] border border-slate-700">
                      {l.externalName} ({l.tallyParent})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Parsed Records Inspection & Batch Execution Table */}
          {activeParsedCount > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                      3
                    </span>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Review Parsed Records ({activeParsedCount} Found)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      Strategy: {importStrategy}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Inspect auto-linked Customer IDs, dual serial numbers, and tax breakdowns before executing live import.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    {selectedItemIndices.length === activeParsedCount ? 'Deselect All' : `Select All (${activeParsedCount})`}
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting || selectedItemIndices.length === 0}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Syncing to Database...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>Execute Import ({selectedItemIndices.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Parsed Data High-Density Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItemIndices.length === activeParsedCount && activeParsedCount > 0}
                          onChange={handleToggleSelectAll}
                          className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                      </th>
                      <th className="p-3">Record Details</th>
                      <th className="p-3">Role / Parent Group</th>
                      <th className="p-3">Auto-Link / Duplication Match</th>
                      <th className="p-3 text-right">Balance / Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedCategory === 'CUSTOMERS' &&
                      parsedCustomers.map((cust, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${isChecked ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">{cust.externalName}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-1.5">
                                <span>Phone: {cust.phone || 'N/A'}</span>
                                {cust.gstin && <span>• GSTIN: <strong className="font-mono text-slate-800 dark:text-slate-200">{cust.gstin}</strong></span>}
                                {cust.panNumber && <span>• PAN: <strong className="font-mono text-slate-800 dark:text-slate-200">{cust.panNumber}</strong></span>}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">{cust.billingAddress}</div>
                              {cust.billAllocations && cust.billAllocations.length > 0 && (
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold mt-1 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 inline-block">
                                  Bill Allocations: {cust.billAllocations.map((b) => `${b.billName} (₹${b.amount.toLocaleString('en-IN')})`).join(', ')}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                                {cust.tallyParent || 'Sundry Debtors'}
                              </span>
                            </td>
                            <td className="p-3">
                              {cust.existingMatchId ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                  <Link2 className="w-3 h-3" />
                                  Matches ID: {cust.existingMatchId} ({importStrategy})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                  <Sparkles className="w-3 h-3" />
                                  New Customer Account
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums font-bold">
                              <span className={cust.balanceDirection === 'Dr' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {cust.balanceDirection === 'Dr' ? 'Dr ' : 'Cr '}
                                ₹{(cust.accountBalance || 0).toLocaleString('en-IN')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                    {selectedCategory === 'DEALERS' &&
                      parsedDealers.map((dlr, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${isChecked ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">{dlr.externalName}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Phone: {dlr.phone || 'N/A'} • GSTIN: {dlr.gstin || 'N/A'}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                                {dlr.tallyParent || 'Sundry Creditors'}
                              </span>
                            </td>
                            <td className="p-3">
                              {dlr.existingMatchId ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                  <Link2 className="w-3 h-3" />
                                  Matched ID: {dlr.existingMatchId}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                  New Supplier Account
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                              Cr ₹{(dlr.accountBalance || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}

                    {selectedCategory === 'INVENTORY' &&
                      parsedStock.map((stk, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${isChecked ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">{stk.name}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-2">
                                <span>Model: {stk.modelNo}</span>
                                {stk.indoorUnitSerial && <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">IDU SN: {stk.indoorUnitSerial}</span>}
                                {stk.outdoorUnitSerial && <span className="text-purple-600 dark:text-purple-400 font-mono font-bold">ODU SN: {stk.outdoorUnitSerial}</span>}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {stk.godownName || 'Central Godown'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                <PackageCheck className="w-3 h-3" />
                                Ready for Store Stock
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                              ₹{(stk.sellingPrice || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}

                    {selectedCategory === 'INVOICES' &&
                      parsedInvoices.map((inv, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${isChecked ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">Voucher #{inv.invoiceNumber}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Party: <strong>{inv.customerName}</strong> ({inv.items.length} Line Items)
                              </div>
                              {inv.cgstAmount || inv.sgstAmount ? (
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  CGST: ₹{inv.cgstAmount} • SGST: ₹{inv.sgstAmount} (Taxable: ₹{inv.taxableAmount})
                                </div>
                              ) : null}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                                {inv.vchType}
                              </span>
                            </td>
                            <td className="p-3">
                              {inv.matchedCustomerId ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                  <Link2 className="w-3 h-3" />
                                  Auto-Linked: {inv.matchedCustomerName || inv.matchedCustomerId}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                                  <Sparkles className="w-3 h-3" />
                                  Auto-Create New Customer Account
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                              ₹{(inv.totalAmount || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}

                    {selectedCategory === 'DELIVERY_NOTES' &&
                      parsedDeliveryNotes.map((note, idx) => {
                        const isChecked = selectedItemIndices.includes(idx);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${isChecked ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSingle(idx)}
                                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">Challan #{note.invoiceNumber}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Customer: {note.customerName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">{note.items.map((i) => i.name).join(', ')}</div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                                Delivery Challan
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                                <Truck className="w-3 h-3" />
                                Routes to Pending Shipment
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                              ₹{(note.totalAmount || 0).toLocaleString('en-IN')}
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

      {/* TAB 2: EXPORT DATA TO TALLY PRIME */}
      {activeTab === 'EXPORT' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Export Lakhi ERP Data to Tally Prime
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Generate Tally-formatted XML envelopes for instant import into Tally Prime via Gateway of Tally.
              </p>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setExportFormat('XML')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  exportFormat === 'XML'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                XML Envelope (Tally)
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('CSV')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  exportFormat === 'CSV'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                CSV / Excel Sheet
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {[
              { id: 'CUSTOMERS' as const, label: `Customers (${customers.length})` },
              { id: 'INVENTORY' as const, label: `Stock Items (${inventory.length})` },
              { id: 'INVOICES' as const, label: `Sales Invoices (${invoices.length})` },
              { id: 'QUOTATIONS' as const, label: `Quotations (${quotations.length})` },
              { id: 'SHIPMENTS' as const, label: `Shipments (${shipments.length})` },
              { id: 'KHATA' as const, label: 'Dues Khata' },
              { id: 'BACKUP' as const, label: 'Full Backup JSON' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Action Download / Copy Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadExport}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download {selectedCategory} ({exportFormat})</span>
            </button>

            <button
              type="button"
              onClick={handleCopyExport}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              {exportCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{exportCopied ? 'Copied to Clipboard!' : 'Copy Raw Export'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENTATION GUIDE */}
      {activeTab === 'GUIDE' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Tally Prime Integration &amp; XML Reference Guide
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Follow these standard procedures to import files from Tally Prime into Lakhi ERP or import Lakhi XML files into Tally Prime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700 dark:text-slate-300">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-red-600" />
                How to Export XML from Tally Prime:
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-[11px]">
                <li>Open Tally Prime and navigate to <strong>Gateway of Tally</strong>.</li>
                <li>Go to <strong>Chart of Accounts &gt; Ledgers</strong> (for Customers) or <strong>Stock Items</strong> (for Inventory).</li>
                <li>Press <strong>Alt + E (Export) &gt; Master</strong>.</li>
                <li>Set File Format to <strong>XML (Data Interchange)</strong> and select file destination.</li>
                <li>Drop the exported XML file directly into Lakhi ERP's Tally Integration Hub.</li>
              </ol>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                How to Import Lakhi XML into Tally Prime:
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-[11px]">
                <li>Download the Tally XML master or voucher file from the <strong>Export Data</strong> tab above.</li>
                <li>Open Tally Prime and go to <strong>Alt + O (Import) &gt; Masters / Vouchers</strong>.</li>
                <li>Enter the full path of the downloaded XML file.</li>
                <li>Select <strong>Modify with New Data</strong> or <strong>Combine</strong> as needed.</li>
                <li>Verify your ledgers and stock in Tally Day Book or Chart of Accounts.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
