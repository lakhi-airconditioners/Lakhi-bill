// src/utils/tallyHelper.ts

export interface ParsedTallyCustomer {
  externalName: string;
  phone?: string;
  email?: string;
  billingAddress?: string;
  installationAddress?: string;
  gstin?: string;
  panNumber?: string;
  accountBalance?: number;
  balanceDirection?: 'Dr' | 'Cr';
  notes?: string;
  tallyParent?: string;
  existingMatchId?: string;
  billAllocations?: Array<{
    billName: string;
    billDate?: string;
    amount: number;
  }>;
}

export interface ParsedTallyStockItem {
  name: string;
  modelNo: string;
  indoorModelNo?: string;
  outdoorModelNo?: string;
  indoorUnitSerial?: string;
  outdoorUnitSerial?: string;
  serialNo?: string;
  type?: string;
  brand?: string;
  sellingPrice?: number;
  godownName?: string;
  hsnCode?: string;
  baseUnit?: string;
}

export interface ParsedTallyInvoiceItem {
  id: string;
  name: string;
  modelNo: string;
  indoorModelNo?: string;
  outdoorModelNo?: string;
  indoorUnitSerial?: string;
  outdoorUnitSerial?: string;
  serialNo?: string;
  quantity: number;
  rate: number;
  amount: number;
  godownName?: string;
  hsnCode?: string;
}

export interface ParsedTallyInvoice {
  invoiceNumber: string;
  date: string;
  dateObj: Date;
  vchType: string;
  customerName: string;
  customerPhone?: string;
  billingAddress?: string;
  gstin?: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  narration?: string;
  items: ParsedTallyInvoiceItem[];
  matchedCustomerId?: string;
  matchedCustomerName?: string;
  isZeroSumBalanced: boolean;
  ledgers: Array<{
    name: string;
    rawAmount: number;
    displayAmount: number;
    type: 'Debit' | 'Credit';
  }>;
}

export interface ParsedTallyMasterSummary {
  currencies: Array<{ name: string; expandedSymbol: string }>;
  units: Array<{ name: string }>;
  groups: Array<{ name: string; parent?: string }>;
  godowns: Array<{ name: string }>;
  stockItems: ParsedTallyStockItem[];
  ledgers: ParsedTallyCustomer[];
  otherLedgers: Array<{ externalName: string; tallyParent: string }>;
}

export interface TallyParseStats {
  fileSizeBytes: number;
  fileType: string;
  totalFound: number;
  customersFound: number;
  dealersFound: number;
  stockItemsFound: number;
  invoicesFound: number;
  deliveryNotesFound: number;
}

// ---------------------------------------------------------------------------
// XML Sanitizers & Extraction Helpers
// ---------------------------------------------------------------------------

// Sanitizes illegal Tally control characters (&#4;, &#1;, null bytes, etc.) that crash DOMParser
function sanitizeTallyXml(raw: string): string {
  return raw
    .replace(/&#[0-9]+;/g, '') // remove numeric character references like &#4;
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip ASCII control characters
}

function findElements(parent: Document | Element, tagName: string): Element[] {
  let list = Array.from(parent.getElementsByTagName(tagName));
  if (list.length === 0 && 'getElementsByTagNameNS' in parent) {
    list = Array.from(parent.getElementsByTagNameNS('*', tagName));
  }
  return list;
}

function getTagText(parent: Element, tagName: string): string {
  const elements = findElements(parent, tagName);
  return elements.length > 0 && elements[0].textContent ? elements[0].textContent.trim() : '';
}

function parseTallyDate(dateStr: string): { formatted: string; dateObj: Date } {
  const clean = dateStr.trim();
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.substring(0, 4), 10);
    const m = parseInt(clean.substring(4, 6), 10) - 1;
    const d = parseInt(clean.substring(6, 8), 10);
    const dt = new Date(y, m, d);
    return {
      formatted: `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`,
      dateObj: dt,
    };
  }
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) {
    return {
      formatted: fallback.toISOString().slice(0, 10),
      dateObj: fallback,
    };
  }
  return { formatted: clean || new Date().toISOString().slice(0, 10), dateObj: new Date(0) };
}

// ---------------------------------------------------------------------------
// Main XML Parser
// ---------------------------------------------------------------------------
export function parseTallyXmlData(
  xmlText: string,
  existingCustomers: any[] = []
): {
  masters: ParsedTallyMasterSummary;
  customers: ParsedTallyCustomer[];
  dealers: ParsedTallyCustomer[];
  stockItems: ParsedTallyStockItem[];
  invoices: ParsedTallyInvoice[];
  deliveryNotes: ParsedTallyInvoice[];
  stats: TallyParseStats;
  warnings: string[];
  rawSampleLines: string[];
} {
  const warnings: string[] = [];
  const rawSampleLines = xmlText.slice(0, 2000).split('\n').slice(0, 25);

  let doc: Document;
  try {
    const sanitized = sanitizeTallyXml(xmlText);
    const parser = new DOMParser();
    doc = parser.parseFromString(sanitized, 'text/xml');
    const parserError = doc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      warnings.push(`XML Parsing Notice: ${parserError.textContent?.slice(0, 150)}`);
    }
  } catch (err: any) {
    warnings.push(`DOMParser execution error: ${err.message}`);
    return {
      masters: { currencies: [], units: [], groups: [], godowns: [], stockItems: [], ledgers: [], otherLedgers: [] },
      customers: [],
      dealers: [],
      stockItems: [],
      invoices: [],
      deliveryNotes: [],
      stats: { fileSizeBytes: xmlText.length, fileType: 'XML', totalFound: 0, customersFound: 0, dealersFound: 0, stockItemsFound: 0, invoicesFound: 0, deliveryNotesFound: 0 },
      warnings,
      rawSampleLines,
    };
  }

  // 1. Currencies, Units, Godowns, Groups
  const currencies: Array<{ name: string; expandedSymbol: string }> = [];
  findElements(doc, 'CURRENCY').forEach((cur) => {
    currencies.push({
      name: cur.getAttribute('NAME') || getTagText(cur, 'ORIGINALNAME') || '₹',
      expandedSymbol: getTagText(cur, 'EXPANDEDSYMBOL') || 'INR',
    });
  });

  const units: Array<{ name: string }> = [];
  findElements(doc, 'UNIT').forEach((u) => {
    const name = u.getAttribute('NAME') || getTagText(u, 'NAME');
    if (name) units.push({ name });
  });

  const godowns: Array<{ name: string }> = [];
  findElements(doc, 'GODOWN').forEach((g) => {
    const name = g.getAttribute('NAME') || getTagText(g, 'NAME');
    if (name) godowns.push({ name });
  });

  const groups: Array<{ name: string; parent?: string }> = [];
  findElements(doc, 'GROUP').forEach((g) => {
    const name = g.getAttribute('NAME');
    if (name) groups.push({ name, parent: getTagText(g, 'PARENT') });
  });

  // 2. Stock Items
  const stockItemsMap = new Map<string, ParsedTallyStockItem>();
  const parsedStockMasterList: ParsedTallyStockItem[] = [];

  findElements(doc, 'STOCKITEM').forEach((stk) => {
    const name = stk.getAttribute('NAME') || getTagText(stk, 'NAME');
    if (!name) return;
    const item: ParsedTallyStockItem = {
      name,
      modelNo: name,
      baseUnit: getTagText(stk, 'BASEUNITS') || 'SET',
      hsnCode: getTagText(stk, 'HSNCODE') || '',
      type: 'AC',
      brand: 'Daikin',
    };
    stockItemsMap.set(name.toLowerCase(), item);
    parsedStockMasterList.push(item);
  });

  // 3. Ledgers (Parties & Accounts)
  const customers: ParsedTallyCustomer[] = [];
  const dealers: ParsedTallyCustomer[] = [];
  const otherLedgers: Array<{ externalName: string; tallyParent: string }> = [];
  const ledgerMasterMap = new Map<string, ParsedTallyCustomer>();

  findElements(doc, 'LEDGER').forEach((led) => {
    const name = led.getAttribute('NAME') || getTagText(led, 'NAME');
    if (!name || name === '0') return; // ignore placeholder ledger names

    const parent = getTagText(led, 'PARENT');
    const gstin = getTagText(led, 'GSTIN');
    const panNumber = getTagText(led, 'INCOMETAXNUMBER');
    const phone = getTagText(led, 'LEDGERMOBILE') || getTagText(led, 'PHONENUMBER');

    // Addresses
    let address = '';
    const addressListTag = findElements(led, 'ADDRESS.LIST')[0];
    if (addressListTag) {
      const parts = findElements(addressListTag, 'ADDRESS')
        .map((a) => a.textContent?.trim())
        .filter(Boolean);
      address = parts.join(', ');
    }
    const state = getTagText(led, 'PRIORSTATENAME') || getTagText(led, 'STATE');
    const pincode = getTagText(led, 'PINCODE');
    if (state && !address.includes(state)) address += (address ? ', ' : '') + state;
    if (pincode && !address.includes(pincode)) address += (address ? ' - ' : '') + pincode;

    // Opening Balance
    const rawBalStr = getTagText(led, 'OPENINGBALANCE');
    const rawBal = parseFloat(rawBalStr) || 0;
    const absBal = Math.abs(rawBal);
    const direction: 'Dr' | 'Cr' = rawBal >= 0 ? 'Dr' : 'Cr';

    // Bill Allocations
    const billAllocations: Array<{ billName: string; billDate?: string; amount: number }> = [];
    findElements(led, 'BILLALLOCATIONS.LIST').forEach((b) => {
      const billName = getTagText(b, 'NAME');
      const billAmt = Math.abs(parseFloat(getTagText(b, 'OPENINGBALANCE')) || 0);
      const billDate = getTagText(b, 'BILLDATE');
      if (billName) billAllocations.push({ billName, billDate, amount: billAmt });
    });

    const matched = existingCustomers.find(
      (c) =>
        (gstin && c.gstin && c.gstin.trim().toLowerCase() === gstin.trim().toLowerCase()) ||
        (c.externalName && c.externalName.trim().toLowerCase() === name.trim().toLowerCase())
    );

    const record: ParsedTallyCustomer = {
      externalName: name,
      phone,
      billingAddress: address || 'Store Pickup',
      installationAddress: address || 'Store Pickup',
      gstin,
      panNumber,
      accountBalance: absBal,
      balanceDirection: direction,
      tallyParent: parent,
      existingMatchId: matched?.id,
      billAllocations,
    };

    ledgerMasterMap.set(name.toLowerCase(), record);

    const pLower = parent.toLowerCase();
    if (pLower.includes('debtor') || pLower.includes('customer')) {
      customers.push(record);
    } else if (pLower.includes('creditor') || pLower.includes('dealer') || pLower.includes('supplier')) {
      dealers.push(record);
    } else {
      otherLedgers.push({ externalName: name, tallyParent: parent });
    }
  });

  // 4. Vouchers (Invoices & Delivery Notes)
  const invoices: ParsedTallyInvoice[] = [];
  const deliveryNotes: ParsedTallyInvoice[] = [];

  findElements(doc, 'VOUCHER').forEach((vch) => {
    const vchType = vch.getAttribute('VCHTYPE') || getTagText(vch, 'VCHTYPE') || 'Sales';
    const vchNum = getTagText(vch, 'VOUCHERNUMBER') || `VCH-${Date.now().toString().slice(-4)}`;
    const partyName = getTagText(vch, 'PARTYLEDGERNAME');
    const { formatted: dateStr, dateObj } = parseTallyDate(getTagText(vch, 'DATE'));
    const narration = getTagText(vch, 'NARRATION');

    // Auto-enrich party details
    const partyMaster = ledgerMasterMap.get(partyName.toLowerCase());
    const gstin = partyMaster?.gstin || '';
    const billingAddress = partyMaster?.billingAddress || 'Store Pickup';
    const customerPhone = partyMaster?.phone || '';

    const matchedCust = existingCustomers.find(
      (c) =>
        (gstin && c.gstin && c.gstin.trim().toLowerCase() === gstin.trim().toLowerCase()) ||
        (partyName && c.externalName && c.externalName.trim().toLowerCase() === partyName.trim().toLowerCase())
    );

    // Inventory & Dual Serials
    const items: ParsedTallyInvoiceItem[] = [];
    let taxableTotal = 0;

    findElements(vch, 'ALLINVENTORYENTRIES.LIST').forEach((inv, iIdx) => {
      const itemName = getTagText(inv, 'STOCKITEMNAME') || 'Split AC';
      const actualQty = parseFloat(getTagText(inv, 'ACTUALQTY').replace(/[^\d.]/g, '')) || 1;
      const rate = parseFloat(getTagText(inv, 'RATE').replace(/[^\d.]/g, '')) || 0;
      const amount = Math.abs(parseFloat(getTagText(inv, 'AMOUNT')) || rate * actualQty);

      const itemMaster = stockItemsMap.get(itemName.toLowerCase());
      const hsnCode = itemMaster?.hsnCode || '';

      let iduSerial = '';
      let oduSerial = '';
      let godownName = '';

      const batchList = findElements(inv, 'BATCHALLOCATIONS.LIST');
      if (batchList.length > 0) {
        godownName = getTagText(batchList[0], 'GODOWNNAME');
        const batchName = getTagText(batchList[0], 'BATCHNAME');
        if (batchName.includes('/') || batchName.includes('IDU') || batchName.includes('ODU')) {
          const parts = batchName.split('/').map((s) => s.trim());
          parts.forEach((p) => {
            if (/idu:/i.test(p)) iduSerial = p.replace(/idu:/i, '').trim();
            else if (/odu:/i.test(p)) oduSerial = p.replace(/odu:/i, '').trim();
          });
        }
        if (!iduSerial && !oduSerial && batchName) {
          iduSerial = batchName;
        }
      }

      taxableTotal += amount;
      items.push({
        id: `it-${vchNum}-${iIdx}`,
        name: itemName,
        modelNo: itemName,
        indoorUnitSerial: iduSerial,
        outdoorUnitSerial: oduSerial,
        serialNo: iduSerial || oduSerial || '',
        quantity: actualQty,
        rate,
        amount,
        godownName,
        hsnCode,
      });
    });

    // Ledger balancing
    const ledgers: Array<{ name: string; rawAmount: number; displayAmount: number; type: 'Debit' | 'Credit' }> = [];
    let sumRaw = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let customerTotal = 0;

    findElements(vch, 'ALLLEDGERENTRIES.LIST').forEach((led) => {
      const lName = getTagText(led, 'LEDGERNAME');
      const rawAmt = parseFloat(getTagText(led, 'AMOUNT')) || 0;
      sumRaw += rawAmt;

      const normType: 'Debit' | 'Credit' = rawAmt > 0 ? 'Debit' : 'Credit';
      const absAmt = Math.abs(rawAmt);

      ledgers.push({
        name: lName,
        rawAmount: rawAmt,
        displayAmount: absAmt,
        type: normType,
      });

      const lLower = lName.toLowerCase();
      if (lLower.includes('cgst')) cgst += absAmt;
      else if (lLower.includes('sgst')) sgst += absAmt;
      else if (lLower.includes('igst')) igst += absAmt;
      else if (lLower === partyName.toLowerCase() || rawAmt < 0) {
        if (absAmt > customerTotal) customerTotal = absAmt;
      }
    });

    const isDelivery = vchType.toLowerCase().includes('delivery') || vchType.toLowerCase().includes('challan');
    const effectiveTotal = customerTotal > 0 ? customerTotal : taxableTotal + cgst + sgst + igst;

    const invoiceRecord: ParsedTallyInvoice = {
      invoiceNumber: vchNum,
      date: dateStr,
      dateObj,
      vchType,
      customerName: partyName,
      customerPhone,
      billingAddress,
      gstin,
      taxableAmount: taxableTotal || effectiveTotal / 1.18,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalAmount: effectiveTotal,
      narration,
      items,
      matchedCustomerId: matchedCust?.id,
      matchedCustomerName: matchedCust?.externalName,
      isZeroSumBalanced: ledgers.length > 0 ? Math.abs(sumRaw) < 0.01 : true,
      ledgers,
    };

    if (isDelivery) {
      deliveryNotes.push(invoiceRecord);
    } else {
      invoices.push(invoiceRecord);
    }
  });

  // Sort Chronologically Ascending
  invoices.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime() || a.invoiceNumber.localeCompare(b.invoiceNumber));
  deliveryNotes.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime() || a.invoiceNumber.localeCompare(b.invoiceNumber));

  const totalFound = customers.length + dealers.length + parsedStockMasterList.length + invoices.length + deliveryNotes.length;

  return {
    masters: {
      currencies,
      units,
      groups,
      godowns,
      stockItems: parsedStockMasterList,
      ledgers: [...customers, ...dealers],
      otherLedgers,
    },
    customers,
    dealers,
    stockItems: parsedStockMasterList,
    invoices,
    deliveryNotes,
    stats: {
      fileSizeBytes: xmlText.length,
      fileType: 'XML',
      totalFound,
      customersFound: customers.length,
      dealersFound: dealers.length,
      stockItemsFound: parsedStockMasterList.length,
      invoicesFound: invoices.length,
      deliveryNotesFound: deliveryNotes.length,
    },
    warnings,
    rawSampleLines,
  };
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------
export function parseTallyCsvData(
  csvText: string,
  category: string,
  delimiter = ',',
  existingCustomers: any[] = []
): {
  customers: ParsedTallyCustomer[];
  dealers: ParsedTallyCustomer[];
  stockItems: ParsedTallyStockItem[];
  invoices: ParsedTallyInvoice[];
  deliveryNotes: ParsedTallyInvoice[];
  stats: TallyParseStats;
  warnings: string[];
  rawSampleLines: string[];
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rawSampleLines = lines.slice(0, 15);
  const customers: ParsedTallyCustomer[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim());
    if (cols[0]) {
      const matched = existingCustomers.find((c) => c.externalName?.toLowerCase() === cols[0].toLowerCase());
      customers.push({
        externalName: cols[0],
        phone: cols[1] || '',
        billingAddress: cols[2] || 'Store Pickup',
        gstin: cols[3] || '',
        accountBalance: parseFloat(cols[4]) || 0,
        existingMatchId: matched?.id,
      });
    }
  }

  return {
    customers,
    dealers: [],
    stockItems: [],
    invoices: [],
    deliveryNotes: [],
    stats: {
      fileSizeBytes: csvText.length,
      fileType: 'CSV',
      totalFound: customers.length,
      customersFound: customers.length,
      dealersFound: 0,
      stockItemsFound: 0,
      invoicesFound: 0,
      deliveryNotesFound: 0,
    },
    warnings: [],
    rawSampleLines,
  };
}

// ---------------------------------------------------------------------------
// XML Exporters
// ---------------------------------------------------------------------------
function escapeXml(str: string): string {
  return (str || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function wrapEnvelope(reportName: string, bodyContent: string): string {
  return `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>${reportName}</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>LAKHI ELECTRONICS AIRCONDITIONERS</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>${bodyContent}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}

export function generateTallyCustomersXml(customers: any[]): string {
  const itemsXml = customers
    .map(
      (c) => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <LEDGER NAME="${escapeXml(c.externalName)}" Action="Create">
      <NAME>${escapeXml(c.externalName)}</NAME>
      <PARENT>Sundry Debtors</PARENT>
      <OPENINGBALANCE>${(c.accountBalance || 0).toFixed(2)}</OPENINGBALANCE>
      <ISBILLWISEON>Yes</ISBILLWISEON>
      <LEDGSTREGDETAILS.LIST>
       <GSTREGISTRATIONTYPE>${c.gstin ? 'Regular' : 'Unregistered/Consumer'}</GSTREGISTRATIONTYPE>
       <GSTIN>${escapeXml(c.gstin || '')}</GSTIN>
      </LEDGSTREGDETAILS.LIST>
      <LEDMAILINGDETAILS.LIST>
       <MAILINGNAME>${escapeXml(c.externalName)}</MAILINGNAME>
       <ADDRESS.LIST TYPE="String">
        <ADDRESS>${escapeXml(c.billingAddress || '')}</ADDRESS>
       </ADDRESS.LIST>
      </LEDMAILINGDETAILS.LIST>
     </LEDGER>
    </TALLYMESSAGE>`
    )
    .join('');

  return wrapEnvelope('All Masters', itemsXml);
}

export function generateTallyInventoryXml(inventory: any[]): string {
  const itemsXml = inventory
    .map(
      (i) => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <STOCKITEM NAME="${escapeXml(i.name)}" Action="Create">
      <NAME>${escapeXml(i.name)}</NAME>
      <PARENT>Air Conditioners</PARENT>
      <BASEUNITS>SET</BASEUNITS>
      <ISBATCHWISEON>Yes</ISBATCHWISEON>
      <BATCHALLOCATIONS.LIST>
       <GODOWNNAME>Central Warehouse</GODOWNNAME>
       <BATCHNAME>IDU:${escapeXml(i.indoorUnitSerial || 'N/A')} / ODU:${escapeXml(i.outdoorUnitSerial || 'N/A')}</BATCHNAME>
       <ACTUALQTY> 1 SET</ACTUALQTY>
       <BILLEDQTY> 1 SET</BILLEDQTY>
      </BATCHALLOCATIONS.LIST>
     </STOCKITEM>
    </TALLYMESSAGE>`
    )
    .join('');

  return wrapEnvelope('All Masters', itemsXml);
}

export function generateTallyInvoicesXml(invoices: any[]): string {
  const itemsXml = invoices
    .map((inv) => {
      const dateFormatted = (inv.createdAt || new Date().toISOString()).slice(0, 10).replace(/-/g, '');
      const total = inv.totalAmount || 0;
      const subtotal = inv.subtotal || total / 1.18;
      const cgst = (total - subtotal) / 2;
      const sgst = cgst;

      return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="Sales" Action="Create">
      <DATE>${dateFormatted}</DATE>
      <VOUCHERNUMBER>${escapeXml(inv.id || 'INV-001')}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${escapeXml(inv.customerExternalName || 'Cash')}</PARTYLEDGERNAME>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${escapeXml(inv.customerExternalName || 'Cash')}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <AMOUNT>-${total.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Sales Account</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${subtotal.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Output CGST</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Output SGST</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
     </VOUCHER>
    </TALLYMESSAGE>`;
    })
    .join('');

  return wrapEnvelope('Vouchers', itemsXml);
}

// ---------------------------------------------------------------------------
// CSV Exporters
// ---------------------------------------------------------------------------
export function generateCustomersCsv(customers: any[]): string {
  const header = 'Name,Phone,Address,GSTIN,Balance\n';
  const rows = customers
    .map((c) => `"${c.externalName}","${c.phone || ''}","${c.billingAddress || ''}","${c.gstin || ''}",${c.accountBalance || 0}`)
    .join('\n');
  return header + rows;
}

export function generateInventoryCsv(inventory: any[]): string {
  const header = 'Name,Model,IDU_Serial,ODU_Serial,SellingPrice\n';
  const rows = inventory
    .map((i) => `"${i.name}","${i.modelNo || ''}","${i.indoorUnitSerial || ''}","${i.outdoorUnitSerial || ''}",${i.sellingPrice || 0}`)
    .join('\n');
  return header + rows;
}

export function generateInvoicesCsv(invoices: any[]): string {
  const header = 'InvoiceNo,Date,Customer,Subtotal,Tax,Total\n';
  const rows = invoices
    .map((i) => `"${i.id}","${(i.createdAt || '').slice(0, 10)}","${i.customerExternalName}",${i.subtotal || 0},${i.taxAmount || 0},${i.totalAmount || 0}`)
    .join('\n');
  return header + rows;
}

export function generateQuotationsCsv(quotations: any[]): string {
  const header = 'QuotationNo,Customer,Total\n';
  return header + quotations.map((q) => `"${q.id}","${q.customerExternalName}",${q.totalAmount || 0}`).join('\n');
}

export function generateShipmentsCsv(shipments: any[]): string {
  const header = 'ShipmentNo,Customer,Status,Address\n';
  return header + shipments.map((s) => `"${s.id}","${s.customerExternalName}","${s.status}","${s.deliveryAddress || ''}"`).join('\n');
}

export function generateDuesKhataCsv(customers: any[], invoices: any[]): string {
  const header = 'Customer,Phone,GSTIN,CurrentBalance\n';
  return header + customers.map((c) => `"${c.externalName}","${c.phone || ''}","${c.gstin || ''}",${c.accountBalance || 0}`).join('\n');
}

export function generateFullErpBackupJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Sample Test XML Payloads
// ---------------------------------------------------------------------------
export const SAMPLE_TALLY_CUSTOMERS_XML = wrapEnvelope(
  'All Masters',
  `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <LEDGER NAME="Metro Cooling Center">
      <PARENT>Sundry Debtors</PARENT>
      <OPENINGBALANCE>41300.00</OPENINGBALANCE>
      <LEDGERMOBILE>9876543210</LEDGERMOBILE>
      <LEDGSTREGDETAILS.LIST>
       <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
       <GSTIN>24AJUPS3679Q1ZW</GSTIN>
      </LEDGSTREGDETAILS.LIST>
      <LEDMAILINGDETAILS.LIST>
       <STATE>Gujarat</STATE>
       <ADDRESS.LIST TYPE="String">
        <ADDRESS>Shop 12, Commercial Hub, Ahmedabad</ADDRESS>
       </ADDRESS.LIST>
      </LEDMAILINGDETAILS.LIST>
     </LEDGER>
    </TALLYMESSAGE>`
);

export const SAMPLE_TALLY_INVENTORY_XML = wrapEnvelope(
  'All Masters',
  `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <STOCKITEM NAME="1.5 Ton Split AC 5 Star">
      <NAME>1.5 Ton Split AC 5 Star</NAME>
      <BASEUNITS>SET</BASEUNITS>
      <HSNCODE>84151010</HSNCODE>
     </STOCKITEM>
    </TALLYMESSAGE>`
);

export const SAMPLE_TALLY_ALL_MASTERS_XML = SAMPLE_TALLY_CUSTOMERS_XML;

export const SAMPLE_TALLY_MASTERS_AND_TRANSACTIONS_XML = wrapEnvelope(
  'Masters & Transactions',
  `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <LEDGER NAME="Metro Cooling Center">
      <PARENT>Sundry Debtors</PARENT>
      <GSTIN>24AJUPS3679Q1ZW</GSTIN>
     </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <STOCKITEM NAME="1.5 Ton Split AC 5 Star">
      <HSNCODE>84151010</HSNCODE>
     </STOCKITEM>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="Delivery Note" Action="Create">
      <DATE>20261014</DATE>
      <VOUCHERNUMBER>DC/001/26-27</VOUCHERNUMBER>
      <PARTYLEDGERNAME>Metro Cooling Center</PARTYLEDGERNAME>
      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>1.5 Ton Split AC 5 Star</STOCKITEMNAME>
       <ACTUALQTY> 1 SET</ACTUALQTY>
       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>Central Warehouse</GODOWNNAME>
        <BATCHNAME>IDU:VOLT-882190 / ODU:VOLT-993412</BATCHNAME>
        <ACTUALQTY> 1 SET</ACTUALQTY>
       </BATCHALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>
     </VOUCHER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="Sales" Action="Create">
      <DATE>20261015</DATE>
      <VOUCHERNUMBER>INV/001/26-27</VOUCHERNUMBER>
      <PARTYLEDGERNAME>Metro Cooling Center</PARTYLEDGERNAME>
      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>1.5 Ton Split AC 5 Star</STOCKITEMNAME>
       <ACTUALQTY> 1 SET</ACTUALQTY>
       <RATE>35000.00/SET</RATE>
       <AMOUNT>35000.00</AMOUNT>
       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>Central Warehouse</GODOWNNAME>
        <BATCHNAME>IDU:VOLT-882190 / ODU:VOLT-993412</BATCHNAME>
        <ACTUALQTY> 1 SET</ACTUALQTY>
       </BATCHALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Metro Cooling Center</LEDGERNAME>
       <AMOUNT>-41300.00</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Sales Account</LEDGERNAME>
       <AMOUNT>35000.00</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Output CGST</LEDGERNAME>
       <AMOUNT>3150.00</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Output SGST</LEDGERNAME>
       <AMOUNT>3150.00</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
     </VOUCHER>
    </TALLYMESSAGE>`
);