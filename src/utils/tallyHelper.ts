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

/**
 * Parse Tally Prime XML file containing Ledgers, Stock Items, or Vouchers
 */
export function parseTallyXmlData(xmlText: string): {
  customers: ParsedTallyCustomer[];
  stockItems: ParsedTallyStockItem[];
  invoices: ParsedTallyInvoice[];
} {
  const customers: ParsedTallyCustomer[] = [];
  const stockItems: ParsedTallyStockItem[] = [];
  const invoices: ParsedTallyInvoice[] = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parse errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      console.warn('XML Parse Warning: document may contain minor syntax anomalies, attempting element fallback.');
    }

    // 1. Parse Ledgers (Customer Masters / Sundry Debtors)
    const ledgerNodes = xmlDoc.getElementsByTagName('LEDGER');
    for (let i = 0; i < ledgerNodes.length; i++) {
      const node = ledgerNodes[i];
      const nameAttr = node.getAttribute('NAME');
      const nameEl = node.getElementsByTagName('NAME')[0]?.textContent?.trim();
      const rawName = nameAttr || nameEl;
      if (!rawName) continue;

      const parentGroup = node.getElementsByTagName('PARENT')[0]?.textContent?.trim() || 'Sundry Debtors';
      const phone =
        node.getElementsByTagName('LEDGERMOBILE')[0]?.textContent?.trim() ||
        node.getElementsByTagName('LEDGERPHONE')[0]?.textContent?.trim() ||
        node.getElementsByTagName('PHONE')[0]?.textContent?.trim() ||
        '';

      const email = node.getElementsByTagName('EMAIL')[0]?.textContent?.trim() || '';
      const gstin =
        node.getElementsByTagName('PARTYGSTIN')[0]?.textContent?.trim() ||
        node.getElementsByTagName('GSTIN')[0]?.textContent?.trim() ||
        '';

      // Address lines
      const addrList = node.getElementsByTagName('ADDRESS');
      const addrParts: string[] = [];
      for (let j = 0; j < addrList.length; j++) {
        const text = addrList[j].textContent?.trim();
        if (text) addrParts.push(text);
      }
      const address = addrParts.join(', ');

      const openingBalStr = node.getElementsByTagName('OPENINGBALANCE')[0]?.textContent?.trim() || '0';
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
    const stockNodes = xmlDoc.getElementsByTagName('STOCKITEM');
    for (let i = 0; i < stockNodes.length; i++) {
      const node = stockNodes[i];
      const name =
        node.getAttribute('NAME') ||
        node.getElementsByTagName('NAME')[0]?.textContent?.trim() ||
        '';
      if (!name) continue;

      const partNo = node.getElementsByTagName('PARTNO')[0]?.textContent?.trim() || '';
      const category = node.getElementsByTagName('CATEGORY')[0]?.textContent?.trim() || '';
      const parent = node.getElementsByTagName('PARENT')[0]?.textContent?.trim() || '';
      const baseUnits = node.getElementsByTagName('BASEUNITS')[0]?.textContent?.trim() || 'Nos';
      const hsnCode =
        node.getElementsByTagName('GSTHSNCODE')[0]?.textContent?.trim() ||
        node.getElementsByTagName('HSNCODE')[0]?.textContent?.trim() ||
        '';

      // Pricing
      const rateStr =
        node.getElementsByTagName('RATE')[0]?.textContent?.trim() ||
        node.getElementsByTagName('OPENINGRATE')[0]?.textContent?.trim() ||
        '';
      const price = parseFloat(rateStr.replace(/[^0-9.-]/g, '')) || 45000;

      // Detect type
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

      // Detect indoor/outdoor split model numbers if AC
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
    const voucherNodes = xmlDoc.getElementsByTagName('VOUCHER');
    for (let i = 0; i < voucherNodes.length; i++) {
      const node = voucherNodes[i];
      const vchType = node.getAttribute('VCHTYPE') || node.getElementsByTagName('VOUCHERTYPENAME')[0]?.textContent?.trim() || '';
      // Support Sales or all vouchers
      const vchNumber = node.getElementsByTagName('VOUCHERNUMBER')[0]?.textContent?.trim() || `VCH-${i + 1}`;
      const dateStr = node.getElementsByTagName('DATE')[0]?.textContent?.trim() || '';
      const party =
        node.getElementsByTagName('PARTYLEDGERNAME')[0]?.textContent?.trim() ||
        node.getElementsByTagName('PARTYNAME')[0]?.textContent?.trim() ||
        'Cash Customer';

      const narration = node.getElementsByTagName('NARRATION')[0]?.textContent?.trim() || '';

      // Inventory items inside voucher
      const itemNodes = node.getElementsByTagName('ALLINVENTORYENTRIES.LIST');
      const itemsList: Array<{ name: string; modelNo?: string; quantity: number; rate: number; amount: number }> = [];

      for (let k = 0; k < itemNodes.length; k++) {
        const itemNode = itemNodes[k];
        const itemName = itemNode.getElementsByTagName('STOCKITEMNAME')[0]?.textContent?.trim();
        if (!itemName) continue;

        const qtyStr = itemNode.getElementsByTagName('ACTUALQTY')[0]?.textContent?.trim() ||
          itemNode.getElementsByTagName('BILLEDQTY')[0]?.textContent?.trim() || '1';
        const qty = Math.abs(parseFloat(qtyStr.replace(/[^0-9.-]/g, '')) || 1);

        const rateStr = itemNode.getElementsByTagName('RATE')[0]?.textContent?.trim() || '0';
        const rate = Math.abs(parseFloat(rateStr.replace(/[^0-9.-]/g, '')) || 0);

        const amountStr = itemNode.getElementsByTagName('AMOUNT')[0]?.textContent?.trim() || '0';
        const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || rate * qty);

        itemsList.push({
          name: itemName,
          quantity: qty,
          rate: rate || (qty > 0 ? Math.round(amount / qty) : amount),
          amount,
        });
      }

      // Voucher total
      const totalStr = node.getElementsByTagName('AMOUNT')[0]?.textContent?.trim() || '0';
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
  } catch (err) {
    console.error('Error parsing Tally XML:', err);
  }

  return { customers, stockItems, invoices };
}

/**
 * Parse CSV format (Tally Export to Excel / CSV)
 */
export function parseTallyCsvData(csvText: string, category: 'CUSTOMERS' | 'INVENTORY' | 'INVOICES'): {
  customers: ParsedTallyCustomer[];
  stockItems: ParsedTallyStockItem[];
  invoices: ParsedTallyInvoice[];
} {
  const customers: ParsedTallyCustomer[] = [];
  const stockItems: ParsedTallyStockItem[] = [];
  const invoices: ParsedTallyInvoice[] = [];

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { customers, stockItems, invoices };
  }

  // Parse header
  const header = lines[0].split(',').map((h) => h.replace(/["']/g, '').trim().toLowerCase());

  for (let i = 1; i < lines.length; i++) {
    // Regex split respecting quotes
    const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/^"|"$/g, '').trim());
    if (row.length === 0 || !row[0]) continue;

    const rowObj: Record<string, string> = {};
    header.forEach((col, idx) => {
      rowObj[col] = row[idx] || '';
    });

    if (category === 'CUSTOMERS') {
      const name =
        rowObj['name'] ||
        rowObj['customer name'] ||
        rowObj['ledger name'] ||
        rowObj['party name'] ||
        row[0];
      if (!name) continue;

      const phone =
        rowObj['phone'] ||
        rowObj['mobile'] ||
        rowObj['contact'] ||
        rowObj['telephone'] ||
        row[1] ||
        '';

      const address =
        rowObj['address'] ||
        rowObj['billing address'] ||
        rowObj['location'] ||
        row[2] ||
        'Store Customer';

      const gstin = rowObj['gstin'] || rowObj['gst'] || rowObj['gst no'] || '';
      const balStr = rowObj['balance'] || rowObj['opening balance'] || '0';
      const bal = parseFloat(balStr.replace(/[^0-9.-]/g, '')) || 0;

      customers.push({
        externalName: name,
        phone: phone || '',
        billingAddress: address,
        gstin: gstin || undefined,
        accountBalance: bal,
        notes: 'Imported from Tally CSV / Excel export',
      });
    } else if (category === 'INVENTORY') {
      const name =
        rowObj['item name'] ||
        rowObj['stock item'] ||
        rowObj['product name'] ||
        rowObj['name'] ||
        row[0];
      if (!name) continue;

      const modelNo =
        rowObj['model'] ||
        rowObj['model no'] ||
        rowObj['part no'] ||
        row[1] ||
        'FTKF50TV';

      const brand = rowObj['brand'] || rowObj['make'] || 'Daikin';
      const type = rowObj['type'] || rowObj['category'] || 'AC';
      const priceStr = rowObj['rate'] || rowObj['price'] || rowObj['selling price'] || row[2] || '45000';
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
        hsnCode: rowObj['hsn'] || rowObj['hsn code'] || undefined,
      });
    } else if (category === 'INVOICES') {
      const invNo = rowObj['invoice no'] || rowObj['voucher no'] || rowObj['bill no'] || row[0] || `INV-${i}`;
      const customer = rowObj['customer'] || rowObj['party name'] || rowObj['buyer'] || row[1] || 'Retail Customer';
      const date = rowObj['date'] || rowObj['invoice date'] || '';
      const totalStr = rowObj['total'] || rowObj['amount'] || rowObj['net amount'] || row[2] || '0';
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

  return { customers, stockItems, invoices };
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
