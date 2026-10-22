import { Customer, InventoryItem, Invoice, InvoiceLineItem, Quotation, Shipment } from '../types';

/**
 * Tally Prime XML & CSV Parser and Generator Utility
 * Supports bidirectional integration between Lakhi Airconditioners ERP and Tally Prime / ERP 9.
 */

export interface ParsedTallyCustomer {
  externalName: string;
  phone: string;
  email?: string;
  billingAddress: string;
  installationAddress?: string;
  gstin?: string;
  accountBalance?: number;
  notes?: string;
  tallyParent?: string;
}

export interface ParsedTallyStockItem {
  name: string;
  modelNo: string;
  indoorModelNo?: string;
  outdoorModelNo?: string;
  brand: string;
  type: string;
  sellingPrice: number;
  hsnCode?: string;
  unit?: string;
  openingQty?: number;
  serialNo?: string;
}

export interface ParsedTallyInvoice {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  billingAddress?: string;
  gstin?: string;
  totalAmount: number;
  narration?: string;
  items: Array<{
    name: string;
    modelNo?: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
}

// Helper to escape XML special characters
export function escapeXml(unsafe: string | number | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format Date YYYYMMDD for Tally
export function formatTallyDate(isoDateStr?: string): string {
  if (!isoDateStr) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }
  const clean = isoDateStr.replace(/[^0-9]/g, '');
  if (clean.length >= 8) {
    return clean.slice(0, 8);
  }
  return '20260101';
}

export interface TallyParseStats {
  fileSizeBytes: number;
  fileType: 'XML_TALLY' | 'XML_EXCEL' | 'CSV' | 'TSV' | 'UNKNOWN';
  totalFound: number;
  customersFound: number;
  stockItemsFound: number;
  invoicesFound: number;
  tagsDetected: string[];
  hasXmlError: boolean;
  xmlErrorMessage?: string;
  detectedDelimiter?: string;
}

export interface TallyParseResult {
  customers: ParsedTallyCustomer[];
  stockItems: ParsedTallyStockItem[];
  invoices: ParsedTallyInvoice[];
  stats: TallyParseStats;
  rawSampleLines: string[];
  warnings: string[];
}

/**
 * Helper to get elements by tag name case-insensitively from an XML document or element
 */
function getElementsByTagNameCI(parent: Document | Element, tagName: string): Element[] {
  const target = tagName.toUpperCase();
  const results: Element[] = [];
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    // Strip namespace prefix if any (e.g. UDF:LEDGER -> LEDGER)
    const localName = (el.localName || el.tagName || '').toUpperCase();
    if (localName === target || el.tagName.toUpperCase() === target) {
      results.push(el);
    }
  }
  return results;
}

/**
 * Helper to get direct or first child element text content case-insensitively
 */
function getChildTextCI(parent: Element, tagName: string): string {
  const elements = getElementsByTagNameCI(parent, tagName);
  if (elements.length > 0 && elements[0].textContent) {
    return elements[0].textContent.trim();
  }
  return '';
}

/**
 * Parse Tally Prime XML file containing Ledgers, Stock Items, or Vouchers
 * Features:
 * - Unescaped ampersand auto-repair
 * - Case-insensitive tag matching
 * - Excel SpreadsheetML XML (<Workbook>) support
 * - Regex fallback if DOMParser fails or produces 0 results
 * - Comprehensive diagnostic statistics
 */
export function parseTallyXmlData(rawXmlText: string): TallyParseResult {
  const customers: ParsedTallyCustomer[] = [];
  const stockItems: ParsedTallyStockItem[] = [];
  const invoices: ParsedTallyInvoice[] = [];
  const warnings: string[] = [];
  const tagsDetected: string[] = [];

  const rawSampleLines = rawXmlText
    .split(/\r?\n/)
    .slice(0, 30)
    .filter((l) => l.trim().length > 0);

  const fileSizeBytes = new Blob([rawXmlText]).size;

  let fileType: 'XML_TALLY' | 'XML_EXCEL' | 'UNKNOWN' = 'XML_TALLY';
  let hasXmlError = false;
  let xmlErrorMessage: string | undefined;

  // Pre-clean: strip UTF-8 BOM and fix unescaped ampersands commonly found in Indian firm names
  let sanitizedXml = (rawXmlText || '')
    .replace(/^\uFEFF/, '')
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

  // Check if this is an Excel Spreadsheet XML export from Tally/Excel (<Workbook ...>)
  if (/<Workbook[\s>]/i.test(sanitizedXml) || /schemas-microsoft-com:office:spreadsheet/i.test(sanitizedXml)) {
    fileType = 'XML_EXCEL';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitizedXml, 'text/xml');
      const rows = doc.getElementsByTagName('Row');

      if (rows.length > 1) {
        // First row as headers
        const headerCells = rows[0].getElementsByTagName('Cell');
        const headers: string[] = [];
        for (let h = 0; h < headerCells.length; h++) {
          const dataEl = headerCells[h].getElementsByTagName('Data')[0];
          headers.push((dataEl?.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
        }

        for (let r = 1; r < rows.length; r++) {
          const cells = rows[r].getElementsByTagName('Cell');
          const rowVals: string[] = [];
          for (let c = 0; c < cells.length; c++) {
            const dataEl = cells[c].getElementsByTagName('Data')[0];
            rowVals.push((dataEl?.textContent || '').trim());
          }
          if (rowVals.length === 0 || !rowVals[0]) continue;

          const rowMap: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowMap[h] = rowVals[idx] || '';
          });

          // Check if row is Ledger, Stock, or Voucher based on headers
          const isLedger = headers.some((h) => h.includes('ledger') || h.includes('party') || h.includes('debtor') || h.includes('customer'));
          const isStock = headers.some((h) => h.includes('stock') || h.includes('item') || h.includes('model') || h.includes('rate'));
          const isVoucher = headers.some((h) => h.includes('voucher') || h.includes('invoice') || h.includes('billno'));

          if (isStock) {
            const name = rowMap['itemname'] || rowMap['stockitem'] || rowMap['name'] || rowVals[0];
            const model = rowMap['model'] || rowMap['modelno'] || rowMap['partno'] || rowVals[1] || 'FTKF50TV';
            const price = parseFloat((rowMap['rate'] || rowMap['price'] || rowVals[2] || '45000').replace(/[^0-9.-]/g, '')) || 45000;
            stockItems.push({
              name,
              modelNo: model,
              indoorModelNo: `${model}-IDU`,
              outdoorModelNo: `${model}-ODU`,
              brand: rowMap['brand'] || 'Daikin',
              type: rowMap['type'] || 'AC',
              sellingPrice: price,
            });
          } else if (isVoucher) {
            const invNo = rowMap['voucherno'] || rowMap['invoiceno'] || rowVals[0];
            const party = rowMap['partyname'] || rowMap['customer'] || rowVals[1] || 'Cash';
            const total = parseFloat((rowMap['total'] || rowMap['amount'] || rowVals[2] || '0').replace(/[^0-9.-]/g, '')) || 0;
            invoices.push({
              invoiceNumber: invNo,
              customerName: party,
              date: rowMap['date'] || '',
              totalAmount: total,
              items: [{ name: 'Equipment Sales', quantity: 1, rate: total, amount: total }],
            });
          } else {
            // Default to customer
            const name = rowMap['name'] || rowMap['customername'] || rowMap['ledgername'] || rowMap['partyname'] || rowVals[0];
            const phone = rowMap['phone'] || rowMap['mobile'] || rowMap['contact'] || rowVals[1] || '';
            const address = rowMap['address'] || rowMap['location'] || rowVals[2] || 'Store Customer';
            const gstin = rowMap['gstin'] || rowMap['gst'] || '';
            const bal = parseFloat((rowMap['balance'] || rowMap['openingbalance'] || '0').replace(/[^0-9.-]/g, '')) || 0;
            customers.push({
              externalName: name,
              phone,
              billingAddress: address,
              gstin: gstin || undefined,
              accountBalance: bal,
              notes: 'Imported from Tally Excel Spreadsheet XML',
            });
          }
        }
      }
    } catch (e: any) {
      warnings.push(`Excel XML Spreadsheet parser error: ${e.message}`);
    }
  }

  // If not Excel XML or if Excel XML yielded 0 records, run standard Tally XML parser
  if (customers.length === 0 && stockItems.length === 0 && invoices.length === 0) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(sanitizedXml, 'text/xml');

      // Check for parse errors
      const parseErrors = xmlDoc.getElementsByTagName('parsererror');
      if (parseErrors.length > 0) {
        hasXmlError = true;
        xmlErrorMessage = parseErrors[0].textContent?.slice(0, 180) || 'XML syntax warning detected.';
        warnings.push(`XML Parser Notice: ${xmlErrorMessage}`);
      }

      // Collect sample tag names to assist diagnosis
      const sampleNodes = xmlDoc.getElementsByTagName('*');
      const foundTagSet = new Set<string>();
      for (let i = 0; i < Math.min(sampleNodes.length, 60); i++) {
        const t = (sampleNodes[i].localName || sampleNodes[i].tagName).toUpperCase();
        if (t && !t.includes(':') && t.length < 25) foundTagSet.add(t);
      }
      tagsDetected.push(...Array.from(foundTagSet));

      // 1. Parse Ledgers (Customer Masters / Sundry Debtors)
      const ledgerNodes = getElementsByTagNameCI(xmlDoc, 'LEDGER');
      for (let i = 0; i < ledgerNodes.length; i++) {
        const node = ledgerNodes[i];
        const nameAttr = node.getAttribute('NAME') || node.getAttribute('name');
        const nameEl = getChildTextCI(node, 'NAME');
        const rawName = nameAttr || nameEl;
        if (!rawName) continue;

        const parentGroup = getChildTextCI(node, 'PARENT') || 'Sundry Debtors';
        const phone =
          getChildTextCI(node, 'LEDGERMOBILE') ||
          getChildTextCI(node, 'LEDGERPHONE') ||
          getChildTextCI(node, 'PHONE') ||
          getChildTextCI(node, 'MOBILE') ||
          '';

        const email = getChildTextCI(node, 'EMAIL');
        const gstin = getChildTextCI(node, 'PARTYGSTIN') || getChildTextCI(node, 'GSTIN');

        // Address lines
        const addrList = getElementsByTagNameCI(node, 'ADDRESS');
        const addrParts: string[] = [];
        for (let j = 0; j < addrList.length; j++) {
          const text = addrList[j].textContent?.trim();
          if (text) addrParts.push(text);
        }
        const address = addrParts.join(', ');

        const openingBalStr = getChildTextCI(node, 'OPENINGBALANCE') || '0';
        const parsedBal = parseFloat(openingBalStr.replace(/[^0-9.-]/g, '')) || 0;

        customers.push({
          externalName: rawName,
          phone: phone || '',
          email: email || undefined,
          billingAddress: address || 'Store Customer',
          installationAddress: address || undefined,
          gstin: gstin || undefined,
          accountBalance: parsedBal,
          tallyParent: parentGroup,
          notes: `Imported from Tally Prime Ledger (${parentGroup})`,
        });
      }

      // 2. Parse Stock Items
      const stockNodes = getElementsByTagNameCI(xmlDoc, 'STOCKITEM');
      for (let i = 0; i < stockNodes.length; i++) {
        const node = stockNodes[i];
        const name =
          node.getAttribute('NAME') ||
          node.getAttribute('name') ||
          getChildTextCI(node, 'NAME');
        if (!name) continue;

        const partNo = getChildTextCI(node, 'PARTNO');
        const category = getChildTextCI(node, 'CATEGORY');
        const parent = getChildTextCI(node, 'PARENT');
        const baseUnits = getChildTextCI(node, 'BASEUNITS') || 'Nos';
        const hsnCode = getChildTextCI(node, 'GSTHSNCODE') || getChildTextCI(node, 'HSNCODE');

        // Pricing
        const rateStr = getChildTextCI(node, 'RATE') || getChildTextCI(node, 'OPENINGRATE');
        const price = parseFloat(rateStr.replace(/[^0-9.-]/g, '')) || 45000;

        // Detect type & brand
        const lower = `${name} ${parent} ${category}`.toLowerCase();
        let type = 'AC';
        let brand = 'Daikin';
        if (lower.includes('tv') || lower.includes('television') || lower.includes('oled') || lower.includes('led')) {
          type = 'TV';
        } else if (lower.includes('fridge') || lower.includes('refrigerator')) {
          type = 'Refrigerator';
        } else if (lower.includes('washing') || lower.includes('wm')) {
          type = 'Washing Machine';
        }

        if (lower.includes('voltas')) brand = 'Voltas';
        else if (lower.includes('lg')) brand = 'LG';
        else if (lower.includes('panasonic')) brand = 'Panasonic';
        else if (lower.includes('mitsubishi')) brand = 'Mitsubishi';
        else if (lower.includes('o general') || lower.includes('general')) brand = 'O General';
        else if (lower.includes('samsung')) brand = 'Samsung';
        else if (lower.includes('hitachi')) brand = 'Hitachi';
        else if (lower.includes('lloyd')) brand = 'Lloyd';
        else if (lower.includes('carrier')) brand = 'Carrier';

        const modelNo = partNo || name.split(' ')[0] || 'FTKF50TV';
        const indoorModelNo = type === 'AC' ? `${modelNo}-IDU` : undefined;
        const outdoorModelNo = type === 'AC' ? `${modelNo}-ODU` : undefined;

        stockItems.push({
          name,
          modelNo,
          indoorModelNo,
          outdoorModelNo,
          brand,
          type,
          sellingPrice: price,
          hsnCode: hsnCode || undefined,
          unit: baseUnits,
        });
      }

      // 3. Parse Vouchers (Sales Invoices)
      const voucherNodes = getElementsByTagNameCI(xmlDoc, 'VOUCHER');
      for (let i = 0; i < voucherNodes.length; i++) {
        const node = voucherNodes[i];
        const vchNumber = getChildTextCI(node, 'VOUCHERNUMBER') || `VCH-${i + 1}`;
        const dateStr = getChildTextCI(node, 'DATE');
        const party = getChildTextCI(node, 'PARTYLEDGERNAME') || getChildTextCI(node, 'PARTYNAME') || 'Cash Customer';
        const narration = getChildTextCI(node, 'NARRATION');

        // Inventory items inside voucher
        const itemNodes = getElementsByTagNameCI(node, 'ALLINVENTORYENTRIES.LIST');
        const itemsList: Array<{ name: string; modelNo?: string; quantity: number; rate: number; amount: number }> = [];

        for (let k = 0; k < itemNodes.length; k++) {
          const itemNode = itemNodes[k];
          const itemName = getChildTextCI(itemNode, 'STOCKITEMNAME');
          if (!itemName) continue;

          const qtyStr = getChildTextCI(itemNode, 'ACTUALQTY') || getChildTextCI(itemNode, 'BILLEDQTY') || '1';
          const qty = Math.abs(parseFloat(qtyStr.replace(/[^0-9.-]/g, '')) || 1);

          const rateStr = getChildTextCI(itemNode, 'RATE') || '0';
          const rate = Math.abs(parseFloat(rateStr.replace(/[^0-9.-]/g, '')) || 0);

          const amountStr = getChildTextCI(itemNode, 'AMOUNT') || '0';
          const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || rate * qty);

          itemsList.push({
            name: itemName,
            quantity: qty,
            rate: rate || (qty > 0 ? Math.round(amount / qty) : amount),
            amount,
          });
        }

        const totalStr = getChildTextCI(node, 'AMOUNT') || '0';
        const totalAmount = Math.abs(parseFloat(totalStr.replace(/[^0-9.-]/g, '')) || 0) ||
          itemsList.reduce((sum, item) => sum + item.amount, 0);

        invoices.push({
          invoiceNumber: vchNumber,
          date: dateStr,
          customerName: party,
          totalAmount,
          narration,
          items: itemsList.length > 0 ? itemsList : [
            { name: 'Air Conditioner / Home Appliance', quantity: 1, rate: totalAmount, amount: totalAmount },
          ],
        });
      }
    } catch (err: any) {
      warnings.push(`DOMParser encountered an exception: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // REGEX FALLBACK: If DOMParser yielded 0 items, salvage records
  // via direct regex tag matching (handles broken XML or namespaces)
  // -------------------------------------------------------------
  if (customers.length === 0 && stockItems.length === 0 && invoices.length === 0) {
    warnings.push('Standard DOM extraction returned 0 items; attempting resilient regex extractor.');

    // 1. Regex Ledger Matcher
    const ledgerRegex = /<(?:[A-Z0-9]+:)?LEDGER\b([^>]*)>([\s\S]*?)<\/(?:[A-Z0-9]+:)?LEDGER>/gi;
    let match: RegExpExecArray | null;
    while ((match = ledgerRegex.exec(sanitizedXml)) !== null) {
      const attrs = match[1] || '';
      const body = match[2] || '';
      const nameAttrMatch = attrs.match(/NAME\s*=\s*["']([^"']+)["']/i);
      const nameTagMatch = body.match(/<NAME>([\s\S]*?)<\/NAME>/i);
      const rawName = (nameAttrMatch ? nameAttrMatch[1] : nameTagMatch ? nameTagMatch[1] : '').trim();
      if (!rawName) continue;

      const phoneMatch = body.match(/<(?:LEDGERMOBILE|LEDGERPHONE|PHONE|MOBILE)>([\s\S]*?)<\//i);
      const emailMatch = body.match(/<EMAIL>([\s\S]*?)<\/EMAIL>/i);
      const gstinMatch = body.match(/<(?:PARTYGSTIN|GSTIN)>([\s\S]*?)<\//i);
      const parentMatch = body.match(/<PARENT>([\s\S]*?)<\/PARENT>/i);
      const balMatch = body.match(/<OPENINGBALANCE>([\s\S]*?)<\/OPENINGBALANCE>/i);

      customers.push({
        externalName: rawName,
        phone: phoneMatch ? phoneMatch[1].trim() : '',
        email: emailMatch ? emailMatch[1].trim() : undefined,
        billingAddress: 'Store Customer',
        gstin: gstinMatch ? gstinMatch[1].trim() : undefined,
        accountBalance: balMatch ? parseFloat(balMatch[1].replace(/[^0-9.-]/g, '')) || 0 : 0,
        tallyParent: parentMatch ? parentMatch[1].trim() : 'Sundry Debtors',
        notes: 'Imported via resilient Tally XML pattern matcher',
      });
    }

    // 2. Regex Stock Item Matcher
    const stockRegex = /<(?:[A-Z0-9]+:)?STOCKITEM\b([^>]*)>([\s\S]*?)<\/(?:[A-Z0-9]+:)?STOCKITEM>/gi;
    while ((match = stockRegex.exec(sanitizedXml)) !== null) {
      const attrs = match[1] || '';
      const body = match[2] || '';
      const nameAttrMatch = attrs.match(/NAME\s*=\s*["']([^"']+)["']/i);
      const nameTagMatch = body.match(/<NAME>([\s\S]*?)<\/NAME>/i);
      const rawName = (nameAttrMatch ? nameAttrMatch[1] : nameTagMatch ? nameTagMatch[1] : '').trim();
      if (!rawName) continue;

      const partMatch = body.match(/<PARTNO>([\s\S]*?)<\/PARTNO>/i);
      const rateMatch = body.match(/<(?:RATE|OPENINGRATE)>([\s\S]*?)<\//i);
      const catMatch = body.match(/<CATEGORY>([\s\S]*?)<\/CATEGORY>/i);

      const modelNo = partMatch ? partMatch[1].trim() : rawName.split(' ')[0] || 'FTKF50TV';
      const price = rateMatch ? parseFloat(rateMatch[1].replace(/[^0-9.-]/g, '')) || 45000 : 45000;

      stockItems.push({
        name: rawName,
        modelNo,
        indoorModelNo: `${modelNo}-IDU`,
        outdoorModelNo: `${modelNo}-ODU`,
        brand: catMatch ? catMatch[1].trim() : 'Daikin',
        type: 'AC',
        sellingPrice: price,
      });
    }

    // 3. Regex Voucher Matcher
    const voucherRegex = /<(?:[A-Z0-9]+:)?VOUCHER\b([^>]*)>([\s\S]*?)<\/(?:[A-Z0-9]+:)?VOUCHER>/gi;
    let vchIndex = 1;
    while ((match = voucherRegex.exec(sanitizedXml)) !== null) {
      const body = match[2] || '';
      const vchNoMatch = body.match(/<VOUCHERNUMBER>([\s\S]*?)<\/VOUCHERNUMBER>/i);
      const partyMatch = body.match(/<(?:PARTYLEDGERNAME|PARTYNAME)>([\s\S]*?)<\//i);
      const dateMatch = body.match(/<DATE>([\s\S]*?)<\/DATE>/i);
      const amountMatch = body.match(/<AMOUNT>([\s\S]*?)<\/AMOUNT>/i);

      const total = amountMatch ? Math.abs(parseFloat(amountMatch[1].replace(/[^0-9.-]/g, '')) || 0) : 0;
      invoices.push({
        invoiceNumber: vchNoMatch ? vchNoMatch[1].trim() : `VCH-${vchIndex++}`,
        customerName: partyMatch ? partyMatch[1].trim() : 'Cash Customer',
        date: dateMatch ? dateMatch[1].trim() : '',
        totalAmount: total,
        items: [{ name: 'Equipment Sales', quantity: 1, rate: total, amount: total }],
      });
    }
  }

  const totalFound = customers.length + stockItems.length + invoices.length;

  return {
    customers,
    stockItems,
    invoices,
    stats: {
      fileSizeBytes,
      fileType,
      totalFound,
      customersFound: customers.length,
      stockItemsFound: stockItems.length,
      invoicesFound: invoices.length,
      tagsDetected,
      hasXmlError,
      xmlErrorMessage,
    },
    rawSampleLines,
    warnings,
  };
}

/**
 * Parse CSV / TSV format with delimiter auto-detection and generous header mapping
 */
export function parseTallyCsvData(
  csvText: string,
  category: 'CUSTOMERS' | 'INVENTORY' | 'INVOICES',
  forcedDelimiter?: string
): TallyParseResult {
  const customers: ParsedTallyCustomer[] = [];
  const stockItems: ParsedTallyStockItem[] = [];
  const invoices: ParsedTallyInvoice[] = [];
  const warnings: string[] = [];

  const rawSampleLines = csvText
    .split(/\r?\n/)
    .slice(0, 30)
    .filter((l) => l.trim().length > 0);

  const fileSizeBytes = new Blob([csvText]).size;

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      customers,
      stockItems,
      invoices,
      stats: {
        fileSizeBytes,
        fileType: 'CSV',
        totalFound: 0,
        customersFound: 0,
        stockItemsFound: 0,
        invoicesFound: 0,
        tagsDetected: [],
        hasXmlError: false,
      },
      rawSampleLines,
      warnings: ['File has fewer than 2 non-empty lines.'],
    };
  }

  // Auto-detect delimiter if not forced: compare counts of Tab, Semicolon, Comma, Pipe in header row
  let delimiter = forcedDelimiter;
  if (!delimiter) {
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;

    if (tabCount > commaCount && tabCount >= semicolonCount) {
      delimiter = '\t';
    } else if (semicolonCount > commaCount && semicolonCount >= tabCount) {
      delimiter = ';';
    } else if (pipeCount > commaCount) {
      delimiter = '|';
    } else {
      delimiter = ',';
    }
  }

  const isTsv = delimiter === '\t';
  const fileType = isTsv ? 'TSV' : 'CSV';

  // Parse header and normalize keys (lowercase, alphanumeric only)
  const headerRaw = lines[0].split(delimiter).map((h) => h.replace(/["']/g, '').trim());
  const headerNormalized = headerRaw.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Regex splitter respecting quotes for standard delimiters
  const splitRow = (rowLine: string): string[] => {
    if (delimiter === '\t') {
      return rowLine.split('\t').map((c) => c.replace(/^"|"$/g, '').trim());
    }
    if (delimiter === ';') {
      return rowLine.split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
    }
    if (delimiter === '|') {
      return rowLine.split('|').map((c) => c.replace(/^"|"$/g, '').trim());
    }
    return rowLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
  };

  for (let i = 1; i < lines.length; i++) {
    const row = splitRow(lines[i]);
    if (row.length === 0 || !row[0]) continue;

    const rowObj: Record<string, string> = {};
    headerNormalized.forEach((col, idx) => {
      rowObj[col] = row[idx] || '';
    });

    if (category === 'CUSTOMERS') {
      const name =
        rowObj['name'] ||
        rowObj['customername'] ||
        rowObj['ledgername'] ||
        rowObj['partyname'] ||
        rowObj['particulars'] ||
        row[0];
      if (!name) continue;

      const phone =
        rowObj['phone'] ||
        rowObj['mobile'] ||
        rowObj['contact'] ||
        rowObj['mobileno'] ||
        rowObj['telephone'] ||
        row[1] ||
        '';

      const address =
        rowObj['address'] ||
        rowObj['billingaddress'] ||
        rowObj['location'] ||
        row[2] ||
        'Store Customer';

      const gstin = rowObj['gstin'] || rowObj['gst'] || rowObj['gstno'] || '';
      const balStr = rowObj['balance'] || rowObj['openingbalance'] || rowObj['closingbalance'] || '0';
      const bal = parseFloat(balStr.replace(/[^0-9.-]/g, '')) || 0;

      customers.push({
        externalName: name,
        phone: phone || '',
        billingAddress: address,
        gstin: gstin || undefined,
        accountBalance: bal,
        notes: `Imported from Tally ${fileType} export`,
      });
    } else if (category === 'INVENTORY') {
      const name =
        rowObj['itemname'] ||
        rowObj['stockitem'] ||
        rowObj['stockitemname'] ||
        rowObj['productname'] ||
        rowObj['description'] ||
        rowObj['name'] ||
        row[0];
      if (!name) continue;

      const modelNo =
        rowObj['model'] ||
        rowObj['modelno'] ||
        rowObj['partno'] ||
        rowObj['itemcode'] ||
        row[1] ||
        'FTKF50TV';

      const brand = rowObj['brand'] || rowObj['make'] || rowObj['manufacturer'] || 'Daikin';
      const type = rowObj['type'] || rowObj['category'] || 'AC';
      const priceStr = rowObj['rate'] || rowObj['price'] || rowObj['sellingprice'] || rowObj['mrp'] || row[2] || '45000';
      const price = parseFloat(priceStr.replace(/[^0-9.-]/g, '')) || 45000;

      const indoorModelNo = type.toUpperCase() === 'AC' ? `${modelNo}-IDU` : undefined;
      const outdoorModelNo = type.toUpperCase() === 'AC' ? `${modelNo}-ODU` : undefined;

      stockItems.push({
        name,
        modelNo,
        indoorModelNo,
        outdoorModelNo,
        brand,
        type,
        sellingPrice: price,
        hsnCode: rowObj['hsn'] || rowObj['hsncode'] || rowObj['hsnsac'] || undefined,
      });
    } else if (category === 'INVOICES') {
      const invNo = rowObj['invoiceno'] || rowObj['voucherno'] || rowObj['billno'] || row[0] || `INV-${i}`;
      const customer = rowObj['customer'] || rowObj['customername'] || rowObj['partyname'] || rowObj['buyer'] || row[1] || 'Retail Customer';
      const date = rowObj['date'] || rowObj['invoicedate'] || rowObj['voucherdate'] || '';
      const totalStr = rowObj['total'] || rowObj['amount'] || rowObj['netamount'] || rowObj['grandtotal'] || row[2] || '0';
      const total = parseFloat(totalStr.replace(/[^0-9.-]/g, '')) || 0;

      invoices.push({
        invoiceNumber: invNo,
        customerName: customer,
        date,
        totalAmount: total,
        items: [{ name: 'Equipment Sales', quantity: 1, rate: total, amount: total }],
      });
    }
  }

  const totalFound = customers.length + stockItems.length + invoices.length;

  return {
    customers,
    stockItems,
    invoices,
    stats: {
      fileSizeBytes,
      fileType,
      totalFound,
      customersFound: customers.length,
      stockItemsFound: stockItems.length,
      invoicesFound: invoices.length,
      tagsDetected: headerNormalized.slice(0, 10),
      hasXmlError: false,
      detectedDelimiter: delimiter,
    },
    rawSampleLines,
    warnings,
  };
}

/**
 * GENERATORS: Export Lakhi Software Data to Tally Prime XML (Masters & Vouchers)
 */

export function generateTallyCustomersXml(customers: Customer[]): string {
  const entriesXml = customers
    .map((c) => {
      const gstinXml = c.gstin ? `<PARTYGSTIN>${escapeXml(c.gstin)}</PARTYGSTIN>` : '';
      const mobileXml = c.phone ? `<LEDGERMOBILE>${escapeXml(c.phone)}</LEDGERMOBILE>` : '';
      const emailXml = c.email ? `<EMAIL>${escapeXml(c.email)}</EMAIL>` : '';
      const addressXml = c.billingAddress
        ? `<ADDRESS.LIST><ADDRESS>${escapeXml(c.billingAddress)}</ADDRESS></ADDRESS.LIST>`
        : '';
      const bal = c.accountBalance || 0;

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${escapeXml(c.externalName)}" ACTION="Create">
          <NAME>${escapeXml(c.externalName)}</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <AFFECTSSTOCK>No</AFFECTSSTOCK>
          ${mobileXml}
          ${emailXml}
          ${addressXml}
          ${gstinXml}
          <OPENINGBALANCE>${bal !== 0 ? bal : 0}</OPENINGBALANCE>
        </LEDGER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Lakhi Airconditioners</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${entriesXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateTallyInventoryXml(inventory: InventoryItem[]): string {
  const entriesXml = inventory
    .map((item) => {
      const modelXml = item.modelNo ? `<PARTNO>${escapeXml(item.modelNo)}</PARTNO>` : '';
      const descXml = item.indoorModelNo || item.outdoorModelNo
        ? `<DESCRIPTION>${escapeXml(
            `IDU Model: ${item.indoorModelNo || '-'} | ODU Model: ${item.outdoorModelNo || '-'}`
          )}</DESCRIPTION>`
        : '';
      const price = item.sellingPrice || 0;

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="${escapeXml(item.name)}" ACTION="Create">
          <NAME>${escapeXml(item.name)}</NAME>
          <PARENT>${escapeXml(item.type || 'Air Conditioners')}</PARENT>
          <CATEGORY>${escapeXml(item.brand || 'Daikin')}</CATEGORY>
          <BASEUNITS>Nos</BASEUNITS>
          ${modelXml}
          ${descXml}
          <OPENINGBALANCE>1 Nos</OPENINGBALANCE>
          <OPENINGRATE>${price}/Nos</OPENINGRATE>
          <OPENINGVALUE>${price}</OPENINGVALUE>
        </STOCKITEM>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Lakhi Airconditioners</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${entriesXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateTallyInvoicesXml(invoices: Invoice[]): string {
  const entriesXml = invoices
    .map((inv) => {
      const dateTally = formatTallyDate(inv.createdAt);
      const party = escapeXml(inv.customerExternalName || 'Cash');
      const invoiceNo = escapeXml(inv.id);
      const narration = escapeXml(inv.notes || `Tax Invoice from Lakhi Airconditioners ERP (#${inv.id})`);

      // Inventory entries
      const invEntries = (inv.items || [])
        .map((it) => {
          const qty = it.quantity || 1;
          const rate = it.rate || 0;
          const amount = it.lineTotal || qty * rate;

          const descParts: string[] = [];
          if (it.modelNo) descParts.push(`Model: ${it.modelNo}`);
          if (it.indoorModelNo) descParts.push(`IDU Model: ${it.indoorModelNo}`);
          if (it.outdoorModelNo) descParts.push(`ODU Model: ${it.outdoorModelNo}`);
          if (it.indoorUnitSerial) descParts.push(`IDU SN: ${it.indoorUnitSerial}`);
          if (it.outdoorUnitSerial) descParts.push(`ODU SN: ${it.outdoorUnitSerial}`);
          else if (it.serialNo) descParts.push(`SN: ${it.serialNo}`);
          const descStr = descParts.join(' | ');

          return `            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(it.name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ACTUALQTY>${qty} Nos</ACTUALQTY>
              <BILLEDQTY>${qty} Nos</BILLEDQTY>
              <RATE>${rate}/Nos</RATE>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
              ${descStr ? `<DESCRIPTION.LIST><DESCRIPTION>${escapeXml(descStr)}</DESCRIPTION></DESCRIPTION.LIST>` : ''}
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Sales Account</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>`;
        })
        .join('\n');

      // Ledger entries for GST & Party
      const subtotal = inv.subtotal || inv.totalAmount / 1.18;
      const taxHalf = (inv.taxAmount || inv.totalAmount - subtotal) / 2;
      const totalAmount = inv.totalAmount || 0;

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
          <DATE>${dateTally}</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${invoiceNo}</VOUCHERNUMBER>
          <REFERENCE>${invoiceNo}</REFERENCE>
          <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
          <NARRATION>${narration}</NARRATION>
          <ISINVOICE>Yes</ISINVOICE>
          <!-- Debit Customer Account -->
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${party}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
${invEntries}
          <!-- Output CGST -->
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output CGST @ 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${taxHalf.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
          <!-- Output SGST -->
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output SGST @ 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${taxHalf.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Lakhi Airconditioners</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${entriesXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * CSV Generators for Excel reconciliation
 */
export function generateCustomersCsv(customers: Customer[]): string {
  const header = ['Customer ID', 'Customer Name', 'Phone', 'Email', 'Billing Address', 'GSTIN', 'Balance (INR)'];
  const rows = customers.map((c) => [
    `"${c.id}"`,
    `"${c.externalName.replace(/"/g, '""')}"`,
    `"${c.phone || ''}"`,
    `"${c.email || ''}"`,
    `"${(c.billingAddress || '').replace(/"/g, '""')}"`,
    `"${c.gstin || ''}"`,
    c.accountBalance || 0,
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateInventoryCsv(inventory: InventoryItem[]): string {
  const header = [
    'SKU ID',
    'Product Name',
    'Model No',
    'Indoor Model (IDU)',
    'Outdoor Model (ODU)',
    'Brand',
    'Type',
    'Serial No / IDU SN',
    'Outdoor SN',
    'Selling Price',
    'Status',
  ];
  const rows = inventory.map((i) => [
    `"${i.id}"`,
    `"${i.name.replace(/"/g, '""')}"`,
    `"${i.modelNo || ''}"`,
    `"${i.indoorModelNo || ''}"`,
    `"${i.outdoorModelNo || ''}"`,
    `"${i.brand || ''}"`,
    `"${i.type || ''}"`,
    `"${i.indoorUnitSerial || i.serialNo || ''}"`,
    `"${i.outdoorUnitSerial || ''}"`,
    i.sellingPrice || 0,
    `"${i.status || 'AVAILABLE'}"`,
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateInvoicesCsv(invoices: Invoice[]): string {
  const header = [
    'Invoice No',
    'Date',
    'Customer Name',
    'Customer Phone',
    'Items Count',
    'Subtotal',
    'Tax Amount',
    'Discount',
    'Total Amount',
    'Payment Status',
    'Amount Due',
  ];
  const rows = invoices.map((inv) => [
    `"${inv.id}"`,
    `"${inv.createdAt ? inv.createdAt.slice(0, 10) : ''}"`,
    `"${(inv.customerExternalName || '').replace(/"/g, '""')}"`,
    `"${inv.customerPhone || ''}"`,
    (inv.items || []).length,
    (inv.subtotal || 0).toFixed(2),
    (inv.taxAmount || 0).toFixed(2),
    (inv.discountAmount || 0).toFixed(2),
    (inv.totalAmount || 0).toFixed(2),
    `"${inv.paymentStatus || 'UNPAID'}"`,
    (inv.amountDue || 0).toFixed(2),
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateQuotationsCsv(quotations: Quotation[]): string {
  const header = [
    'Quotation No',
    'Date',
    'Customer Name',
    'Customer Phone',
    'Items Count',
    'Subtotal',
    'Tax Amount',
    'Total Amount',
    'Status',
    'GSTIN',
    'Notes',
  ];
  const rows = quotations.map((q) => [
    `"${q.id}"`,
    `"${q.createdAt ? q.createdAt.slice(0, 10) : ''}"`,
    `"${(q.customerExternalName || '').replace(/"/g, '""')}"`,
    `"${q.customerPhone || ''}"`,
    (q.items || []).length,
    (q.subtotal || 0).toFixed(2),
    (q.taxAmount || 0).toFixed(2),
    (q.totalAmount || 0).toFixed(2),
    `"${q.status || 'RECORDED'}"`,
    `"${q.gstNumber || ''}"`,
    `"${(q.notes || '').replace(/"/g, '""')}"`,
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateShipmentsCsv(shipments: Shipment[]): string {
  const header = [
    'Dispatch No',
    'Date',
    'Customer Name',
    'Customer Phone',
    'Delivery Address',
    'Invoice Ref',
    'Driver / Vehicle',
    'Delivery Person Phone',
    'E-Way Bill No',
    'Current Status',
    'Item Details',
  ];
  const rows = shipments.map((s) => [
    `"${s.id}"`,
    `"${s.createdAt ? s.createdAt.slice(0, 10) : ''}"`,
    `"${(s.customerExternalName || '').replace(/"/g, '""')}"`,
    `"${s.customerPhone || ''}"`,
    `"${(s.deliveryAddress || '').replace(/"/g, '""')}"`,
    `"${s.invoiceId || ''}"`,
    `"${(s.vehicleOrDriver || '').replace(/"/g, '""')}"`,
    `"${s.deliveryPersonPhone || ''}"`,
    `"${s.ewayBillNo || ''}"`,
    `"${s.status || 'ORDER_PLACED'}"`,
    `"${(s.itemsSummary || '').replace(/"/g, '""')}"`,
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateDuesKhataCsv(customers: Customer[], invoices: Invoice[]): string {
  const header = [
    'Customer ID',
    'Customer Legal Name',
    'Internal Alias / Note',
    'Phone',
    'Portal PIN',
    'Ledger Balance (INR)',
    'Total Invoiced (INR)',
    'Total Unpaid Due (INR)',
    'Khata Status',
  ];
  const rows = customers.map((c) => {
    const custInvoices = invoices.filter((i) => i.customerId === c.id);
    const totalInvoiced = custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalDue = custInvoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
    const balance = c.accountBalance || 0;
    const khataStatus = balance < 0 || totalDue > 0 ? 'DUE_OWED' : balance > 0 ? 'ADVANCE_FUNDS' : 'SETTLED_CLEAR';

    return [
      `"${c.id}"`,
      `"${c.externalName.replace(/"/g, '""')}"`,
      `"${(c.internalName || '').replace(/"/g, '""')}"`,
      `"${c.phone || ''}"`,
      `"${c.accessPin || ''}"`,
      balance,
      totalInvoiced.toFixed(2),
      totalDue.toFixed(2),
      `"${khataStatus}"`,
    ];
  });
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateFullErpBackupJson(erpData: {
  customers: Customer[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  quotations: Quotation[];
  shipments: Shipment[];
  gstNumber?: string;
}): string {
  return JSON.stringify(
    {
      app: 'Lakhi Airconditioners ERP',
      exportedAt: new Date().toISOString(),
      softwareVersion: '2.5.0-TallyPrimeReady',
      companyGstNumber: erpData.gstNumber || '24AAACH7409R1ZZ',
      summary: {
        totalCustomers: erpData.customers.length,
        totalInventoryUnits: erpData.inventory.length,
        totalInvoices: erpData.invoices.length,
        totalQuotations: erpData.quotations.length,
        totalShipments: erpData.shipments.length,
      },
      ...erpData,
    },
    null,
    2
  );
}

/**
 * Built-in Sample Tally Files for 1-Click Testing
 */
export const SAMPLE_TALLY_CUSTOMERS_XML = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Gautam Enterprise (Ahmedabad)" ACTION="Create">
            <NAME>Gautam Enterprise (Ahmedabad)</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <LEDGERMOBILE>+91 98765 43210</LEDGERMOBILE>
            <EMAIL>gautam.ent@example.com</EMAIL>
            <ADDRESS.LIST>
              <ADDRESS>Shop 14, Silicon Valley Commercial Complex, SG Highway, Ahmedabad</ADDRESS>
            </ADDRESS.LIST>
            <PARTYGSTIN>24AAACH7409R1ZZ</PARTYGSTIN>
            <OPENINGBALANCE>0</OPENINGBALANCE>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Pooja Sharma &amp; Associates" ACTION="Create">
            <NAME>Pooja Sharma &amp; Associates</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <LEDGERMOBILE>9825012345</LEDGERMOBILE>
            <ADDRESS.LIST>
              <ADDRESS>402 Palm Heights, Drive-in Road, Memnagar, Ahmedabad</ADDRESS>
            </ADDRESS.LIST>
            <PARTYGSTIN>24AABCS1429Q1Z4</PARTYGSTIN>
            <OPENINGBALANCE>-15000</OPENINGBALANCE>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

export const SAMPLE_TALLY_INVENTORY_XML = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Daikin 1.5 Ton 5-Star Inverter Split AC" ACTION="Create">
            <NAME>Daikin 1.5 Ton 5-Star Inverter Split AC</NAME>
            <PARTNO>FTKF50TV</PARTNO>
            <PARENT>Air Conditioners</PARENT>
            <CATEGORY>Daikin</CATEGORY>
            <BASEUNITS>Nos</BASEUNITS>
            <GSTHSNCODE>84151010</GSTHSNCODE>
            <OPENINGBALANCE>5 Nos</OPENINGBALANCE>
            <OPENINGRATE>46500/Nos</OPENINGRATE>
          </STOCKITEM>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Voltas 1.0 Ton 3-Star Split AC" ACTION="Create">
            <NAME>Voltas 1.0 Ton 3-Star Split AC</NAME>
            <PARTNO>123V-VET</PARTNO>
            <PARENT>Air Conditioners</PARENT>
            <CATEGORY>Voltas</CATEGORY>
            <BASEUNITS>Nos</BASEUNITS>
            <GSTHSNCODE>84151010</GSTHSNCODE>
            <OPENINGBALANCE>8 Nos</OPENINGBALANCE>
            <OPENINGRATE>32500/Nos</OPENINGRATE>
          </STOCKITEM>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="LG 65-Inch 4K OLED AI ThinQ Smart TV" ACTION="Create">
            <NAME>LG 65-Inch 4K OLED AI ThinQ Smart TV</NAME>
            <PARTNO>OLED65C3PSA</PARTNO>
            <PARENT>Televisions</PARENT>
            <CATEGORY>LG</CATEGORY>
            <BASEUNITS>Nos</BASEUNITS>
            <GSTHSNCODE>85287219</GSTHSNCODE>
            <OPENINGBALANCE>2 Nos</OPENINGBALANCE>
            <OPENINGRATE>135000/Nos</OPENINGRATE>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
