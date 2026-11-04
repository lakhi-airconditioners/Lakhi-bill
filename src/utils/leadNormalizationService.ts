// src/utils/leadNormalizationService.ts

import {
  Customer,
  Vendor,
  VendorCategory,
  InventoryItem,
  Shipment,
  Invoice,
  TransactionRecord,
  TallyMastersData,
  LeadCompleteSystemData,
} from '../types';

export const STORE_CONSTANTS = {
  companyName: 'LAKHI ELECTRONICS AIRCONDITIONERS',
  storeGstin: '24AAIPU5764D1ZI',
  storeHelpline: '+91 99980 21446',
};

export const ID_REGEX = /^(I|Q|STK|D|C|T|V)[0-9]{8}[0-9]{4}$/;

/**
 * Utility to round prices/amounts strictly to 2 decimal places
 */
export function round2(val: number): number {
  if (isNaN(val) || val === undefined || val === null) return 0.00;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Clean raw text / XML string from bad escape artifacts and control bytes
 */
export function cleanTallyRawText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&#[0-9]+;/g, '') // strip numeric entities like &#4; &#27;
    .replace(/&#x[0-9a-fA-F]+;/g, '') // strip hex entities
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip ASCII control bytes
}

/**
 * Dynamically resolves the 8-digit date key (YYYYMMDD)
 * 1. Primary Strategy: Scan for <BILLDATE>, <DATE>, or exportTimestamp fields in the dataset.
 *    Use the earliest/primary transaction date formatted as YYYYMMDD.
 * 2. Fallback Strategy: Current system date at runtime.
 */
export function resolveDynamicDateKey(rawText: string): { dateKey: string; formattedDate: string; source: string } {
  if (!rawText) {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10).replace(/-/g, '');
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    return { dateKey, formattedDate, source: 'System Runtime Date (Fallback)' };
  }

  // Scan all BILLDATE or DATE tags or exportTimestamp
  const dateMatches = rawText.match(/<BILLDATE>(\d{8})<\/BILLDATE>|<DATE>(\d{8})<\/DATE>|"exportTimestamp"\s*:\s*"([^"]+)"|"billDate"\s*:\s*"([^"]+)"/gi);

  if (dateMatches && dateMatches.length > 0) {
    for (const matchStr of dateMatches) {
      const digits = matchStr.match(/\d{8}/);
      if (digits && digits[0]) {
        const y = digits[0].substring(0, 4);
        const m = digits[0].substring(4, 6);
        const d = digits[0].substring(6, 8);
        return {
          dateKey: digits[0],
          formattedDate: `${d}/${m}/${y}`,
          source: `Extracted Dataset Date (${digits[0]})`,
        };
      }
      const isoMatch = matchStr.match(/\d{4}-\d{2}-\d{2}/);
      if (isoMatch && isoMatch[0]) {
        const cleanKey = isoMatch[0].replace(/-/g, '');
        const parts = isoMatch[0].split('-');
        return {
          dateKey: cleanKey,
          formattedDate: `${parts[2]}/${parts[1]}/${parts[0]}`,
          source: `Extracted Dataset ISO Date (${cleanKey})`,
        };
      }
    }
  }

  // Fallback to today's date
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, '');
  const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  return { dateKey, formattedDate, source: 'System Runtime Date (Fallback)' };
}

/**
 * Deterministic ID Generator
 * [Type] + [Resolved YYYYMMDD] + [4-Digit Identifier / Counter]
 */
export class LeadIdGenerator {
  private counters: Record<string, number> = {
    I: 1001,
    Q: 4182,
    STK: 1163,
    D: 1001,
    C: 1137,
    T: 1001,
    V: 1149,
  };

  private dateStr: string;

  constructor(dateStr: string) {
    this.dateStr = dateStr;
  }

  public generateId(type: 'I' | 'Q' | 'STK' | 'D' | 'C' | 'T' | 'V'): string {
    const counter = this.counters[type] || 1000;
    const generated = `${type}${this.dateStr}${String(counter).padStart(4, '0')}`;
    this.counters[type] = counter + 1;
    return generated;
  }

  public validateId(id: string): boolean {
    return ID_REGEX.test(id);
  }
}

/**
 * Determine Vendor Category (strictly 1 of 6 mandated categories)
 */
export function classifyVendorCategory(ledgerName: string, parentName: string = ''): VendorCategory {
  const combined = `${ledgerName} ${parentName}`.toLowerCase();

  if (combined.includes('daikin') || combined.includes('general') || combined.includes('mitsubishi') || combined.includes('voltas') || combined.includes('carrier') || combined.includes('blue star') || combined.includes('haier') || combined.includes('lloyd') || combined.includes('supplier') || combined.includes('distributor') || combined.includes('stock')) {
    return 'Supplier Stock / Consignment';
  }
  if (combined.includes('piping') || combined.includes('labor') || combined.includes('labour') || combined.includes('technician') || combined.includes('installation') || combined.includes('contractor') || combined.includes('mechanic') || combined.includes('wages')) {
    return 'Installation / Labor Wages';
  }
  if (combined.includes('freight') || combined.includes('transport') || combined.includes('tempo') || combined.includes('porter') || combined.includes('courier') || combined.includes('logistics') || combined.includes('cartage')) {
    return 'Freight / Transportation';
  }
  if (combined.includes('refund') || combined.includes('advance return') || combined.includes('deposit return')) {
    return 'Customer Advance Refund';
  }
  if (combined.includes('rent') || combined.includes('power') || combined.includes('torrent') || combined.includes('electricity') || combined.includes('lease') || combined.includes('internet') || combined.includes('utility')) {
    return 'Shop Rent / Utilities';
  }
  return 'Other Expenses';
}

/**
 * Helper to get XML tag text cleanly
 */
function getXmlTag(el: Element, tagName: string): string {
  const list = el.getElementsByTagName(tagName);
  if (list.length > 0 && list[0].textContent) {
    return list[0].textContent.trim();
  }
  return '';
}

// 1. Normalize Invoices
export function normalizeInvoice(raw: any) {
  if (!raw) raw = {};
  const total = Number(raw.totalAmount ?? raw.finalAmount ?? raw.calculation?.totalBill ?? 0);
  const subtotal = Number(raw.subtotal ?? raw.calculation?.subtotal ?? Math.round((total / 1.18) * 100) / 100);
  const tax = Number(raw.tax ?? raw.calculation?.tax ?? Math.round((total - subtotal) * 100) / 100);

  return {
    ...raw,
    id: raw.id || raw.invoiceId || `INV-${Date.now()}`,
    invoiceId: raw.invoiceId || raw.id || '',
    customBillId: raw.customBillId || raw.billNumber || '',
    customerId: raw.customerId || raw.customer?.customerId || '',
    customerName: raw.customerName || raw.customer?.customerLegalName || 'Unknown Customer',
    customerPhone: raw.customerPhone || raw.customer?.customerPhone || '',
    billingAddress: raw.billingAddress || raw.customer?.billingAddress || '',
    invoiceDate: String(raw.invoiceDate || new Date().toLocaleDateString('en-GB')),

    // Prevent .toLocaleString() crash
    totalAmount: isNaN(total) ? 0 : total,
    finalAmount: isNaN(total) ? 0 : total,
    subtotal: isNaN(subtotal) ? 0 : subtotal,
    tax: isNaN(tax) ? 0 : tax,

    // Prevent .map() crash
    items: Array.isArray(raw.items)
      ? raw.items
      : [
          {
            description: raw.itemsSummary || 'General Equipment',
            quantity: 1,
            rate: isNaN(total) ? 0 : total,
            amount: isNaN(total) ? 0 : total,
          },
        ],
    itemsSummary: raw.itemsSummary || '1x Equipment Unit',
  };
}

// 2. Normalize Deliveries (div)
export function normalizeDelivery(raw: any) {
  if (!raw) raw = {};
  const driverName = raw.driverName || raw.assignedDriver?.driverName || 'Unassigned';
  const driverPhone = String(raw.driverPhone || raw.assignedDriver?.driverPhone || '');
  const vehicleNumber = raw.vehicleNumber || raw.assignedDriver?.vehicleNumber || '';
  const totalAmount = Number(raw.totalAmount ?? raw.billAmount ?? 0);

  return {
    ...raw,
    id: raw.id || raw.deliveryId || `D-${Date.now()}`,
    deliveryId: raw.deliveryId || raw.id || '',
    customerId: raw.customerId || '',
    customerName: raw.customerName || 'Customer',
    customerPhone: String(raw.customerPhone || raw.phone || ''),
    divState: raw.divState || '1. Order Placed',
    
    // Prevent .toLocaleString() crash
    totalAmount: isNaN(totalAmount) ? 0 : totalAmount,

    // Prevent .replace() crash on driver & customer details
    driverName,
    driverPhone,
    vehicleNumber,
    assignedDriver: {
      driverName,
      driverPhone,
      vehicleNumber,
      assignedAt: raw.assignedDriver?.assignedAt || ''
    },

    // Prevent .map() crashes
    linkedInvoiceIds: Array.isArray(raw.linkedInvoiceIds)
      ? raw.linkedInvoiceIds
      : (raw.linkedInvoiceId ? [raw.linkedInvoiceId] : []),
    messageNotes: Array.isArray(raw.messageNotes) ? raw.messageNotes : []
  };
}

// 2b. Normalize Transactions (trans)
export function normalizeTransaction(raw: any) {
  if (!raw) raw = {};
  const amount = Number(raw.amountInflow ?? raw.amount ?? raw.totalAmount ?? 0);

  return {
    ...raw,
    id: raw.id || raw.transId || `T-${Date.now()}`,
    transId: raw.transId || raw.id || '',
    customerId: raw.customerId || '',
    customerName: raw.customerName || 'Customer',
    customerPhone: String(raw.customerPhone || raw.phone || ''),
    
    // Prevent .toLocaleString() crash
    amountInflow: isNaN(amount) ? 0 : amount,
    amount: isNaN(amount) ? 0 : amount,

    // Prevent .replace() crash on reference codes and timestamps
    mode: raw.mode || 'UPI Transfer',
    bankDrawer: raw.bankDrawer || 'Main Drawer 1',
    bankOrDrawer: raw.bankOrDrawer || raw.bankDrawer || 'Main Drawer 1',
    utrRefNoSlip: String(raw.utrRefNoSlip || raw.referenceNo || ''),
    referenceNo: String(raw.referenceNo || raw.utrRefNoSlip || ''),
    treatment: raw.treatment || 'LINK_DIRECTLY_TO_INVOICE',
    timestamp: String(raw.timestamp || raw.createdAt || new Date().toLocaleString())
  };
}

// 3. Normalize Customers
export function normalizeCustomer(raw: any) {
  if (!raw) raw = {};
  const balance = Number(raw.currentBalance ?? raw.openingBalance ?? 0);
  return {
    ...raw,
    id: raw.id || raw.customerId || `CUST-${Date.now()}`,
    customerId: raw.customerId || raw.id || '',
    externalName: raw.externalName || raw.name || 'Unnamed Customer',
    phone: raw.phone || raw.phoneNumber || raw.partyPhone || '',
    email: raw.email || '',
    billingAddress: raw.billingAddress || raw.address || '',
    currentBalance: isNaN(balance) ? 0 : balance,
    openingBalance: isNaN(balance) ? 0 : balance,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    gstin: raw.gstin || '',
    pan: raw.pan || '',
  };
}

// 4. Normalize Stock Items
export function normalizeStock(raw: any) {
  if (!raw) raw = {};
  const price = Number(raw.sellingPrice ?? raw.rate ?? raw.price ?? 0);
  return {
    ...raw,
    id: raw.id || raw.stockId || `STK-${Date.now()}`,
    stockId: raw.stockId || raw.id || '',
    name: raw.name || raw.productFullName || 'General Equipment',
    productFullName: raw.productFullName || raw.name || 'General Equipment',
    sellingPrice: isNaN(price) ? 0 : price,
    rate: isNaN(price) ? 0 : price,
    price: isNaN(price) ? 0 : price,
    quantity: Number(raw.quantity ?? 1),
    status: raw.status || 'AVAILABLE',
    stockState: raw.stockState || 'ava',
    brand: raw.brand || 'DAIKIN',
    applianceType: raw.applianceType || raw.type || 'AC',
  };
}

/**
 * Main Data Normalization Engine: Transform raw Tally payload (XML/CSV/JSON/TXT)
 * strictly into LEA-D 4.0 deterministic structures.
 * DYNAMIC DATE KEYING & AUTO BILL/DELIVERY/INFLOW GENERATION
 */
export function normalizeTallyToLeadData(
  rawInput: string,
  providedDateKey?: string
): LeadCompleteSystemData & { dateResolution: { dateKey: string; formattedDate: string; source: string } } {
  const cleaned = cleanTallyRawText(rawInput);
  const dateResolution = providedDateKey ? { dateKey: providedDateKey, formattedDate: '27/10/2026', source: 'Manual Override' } : resolveDynamicDateKey(cleaned);
  const idGen = new LeadIdGenerator(dateResolution.dateKey);

  const customers: Customer[] = [];
  const vendors: Vendor[] = [];
  const storeStock: InventoryItem[] = [];
  const deliveries: Shipment[] = [];
  const invoices: Invoice[] = [];
  const transactions: TransactionRecord[] = [];

  const masters: TallyMastersData = {
    godowns: ['Main Showroom Godown', 'Central Warehouse'],
    stockGroups: ['DAIKIN', 'OGENERAL', 'MITSUBISHI', 'VOLTAS', 'CARRIER', 'BLUE STAR'],
    unitsOfMeasure: ['SET', 'PCS', 'NOS', 'UNT'],
    banksAndCash: ['HDFC Bank Operating A/C', 'SBI Bank Primary A/C', 'Main Drawer 1'],
    dutiesAndTaxes: ['Output CGST 9%', 'Output SGST 9%', 'Input CGST 9%', 'Input SGST 9%', 'IGST 18%'],
    expenseLedgers: ['Showroom Lease & Rent', 'Torrent Power Utility', 'Installation Labor Charges', 'Freight & Dispatch'],
  };

  let isXmlParsed = false;

  // Try parsing as DOM XML first
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleaned, 'text/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];

    if (!parserError && xmlDoc.getElementsByTagName('ENVELOPE').length > 0) {
      isXmlParsed = true;

      // 1. Process Godowns & Stock Groups
      const godownsList = xmlDoc.getElementsByTagName('GODOWN');
      for (let i = 0; i < godownsList.length; i++) {
        const gName = godownsList[i].getAttribute('NAME') || getXmlTag(godownsList[i], 'NAME');
        if (gName && !masters.godowns.includes(gName)) masters.godowns.push(gName);
      }

      const groupList = xmlDoc.getElementsByTagName('GROUP');
      for (let i = 0; i < groupList.length; i++) {
        const grpName = groupList[i].getAttribute('NAME') || getXmlTag(groupList[i], 'NAME');
        if (grpName && !masters.stockGroups.includes(grpName)) masters.stockGroups.push(grpName);
      }

      // 2. Process Stock Items -> storeStock
      const stockList = xmlDoc.getElementsByTagName('STOCKITEM');
      for (let i = 0; i < stockList.length; i++) {
        const sEl = stockList[i];
        const pName = sEl.getAttribute('NAME') || getXmlTag(sEl, 'NAME') || '1.5T Inverter Split AC';
        const brand = getXmlTag(sEl, 'PARENT') || 'DAIKIN';
        const rate = round2(parseFloat(getXmlTag(sEl, 'RATE')) || 38500.00);
        const stockId = idGen.generateId('STK');

        storeStock.push({
          id: stockId,
          stockId,
          sku: `SKU-${stockId.slice(-6)}-01`,
          websiteStockId: `WEB-${stockId.slice(-6)}`,
          applianceType: 'AC',
          name: pName,
          productFullName: pName,
          modelNo: pName,
          setModelNumber: pName.replace(/\s+/g, '-').toUpperCase(),
          type: 'AC',
          brand: brand.toUpperCase(),
          serialNo: `IDU-DAI-${stockId.slice(-6)}`,
          indoorModel: `${pName}-IDU`,
          indoorUnitSerial: `IDU-DAI-${stockId.slice(-6)}`,
          outdoorModel: `${pName}-ODU`,
          outdoorUnitSerial: `ODU-DAI-${stockId.slice(-6)}`,
          sellingPrice: round2(rate),
          quantity: 1,
          status: 'AVAILABLE',
          stockState: 'ava',
          hasQrCode: true,
          createdAt: dateResolution.formattedDate,
        });
      }

      // 3. Process Ledgers (Sundry Debtors -> Customers, Sundry Creditors -> Vendors)
      const ledgerList = xmlDoc.getElementsByTagName('LEDGER');
      for (let i = 0; i < ledgerList.length; i++) {
        const lEl = ledgerList[i];
        const name = lEl.getAttribute('NAME') || getXmlTag(lEl, 'NAME');
        if (!name || name === '0') continue;

        const parent = getXmlTag(lEl, 'PARENT');
        const phone = getXmlTag(lEl, 'LEDGERMOBILE') || getXmlTag(lEl, 'PHONENUMBER') || '';
        const gstin = getXmlTag(lEl, 'GSTIN');
        const pan = getXmlTag(lEl, 'INCOMETAXNUMBER');
        const rawBal = parseFloat(getXmlTag(lEl, 'OPENINGBALANCE')) || 0;
        const absBal = round2(Math.abs(rawBal));
        const pLower = parent.toLowerCase();

        let address = '';
        const addrList = lEl.getElementsByTagName('ADDRESS');
        for (let j = 0; j < addrList.length; j++) {
          if (addrList[j].textContent) address += (address ? ', ' : '') + addrList[j].textContent.trim();
        }
        if (!address) address = 'Shop 12, Commercial Hub, Ahmedabad - 380015';

        if (pLower.includes('creditor') || pLower.includes('vendor') || pLower.includes('supplier')) {
          // Creditors -> Vendors
          const vendorId = idGen.generateId('V');
          const category = classifyVendorCategory(name, parent);

          vendors.push({
            id: vendorId,
            vendorId,
            vendorName: name,
            amountWeOwe: round2(absBal),
            category,
            partyPhone: phone,
            targetDueDate: '15/11/2026',
            billOrderReferenceNo: `PO-${vendorId.slice(-4)}`,
            notes: `Tally Master Import from ${parent}`,
            billingAddress: address,
            gstin: gstin || '',
            pan: pan || '',
            createdAt: dateResolution.formattedDate,
          });
        } else if (pLower.includes('debtor') || pLower.includes('customer') || pLower.includes('party')) {
          // Debtors -> Customers
          const customerId = idGen.generateId('C');
          const isCorp = /corp|ltd|pvt|llp|inc|hub|center|cooling/i.test(name);
          const customMiddleId = isCorp ? 'VIP-CORP' : dateResolution.dateKey;
          const custTransactions: TransactionRecord[] = [];

          // AUTO EXTRACT NESTED BILL ALLOCATIONS
          const billAllocList = lEl.getElementsByTagName('BILLALLOCATIONS.LIST');
          for (let b = 0; b < billAllocList.length; b++) {
            const bEl = billAllocList[b];
            const billRefName = getXmlTag(bEl, 'NAME') || `BILL-${b + 1}`;
            const billAmt = round2(Math.abs(parseFloat(getXmlTag(bEl, 'OPENINGBALANCE')) || absBal || 35000));
            if (billAmt <= 0) continue;

            // A) Auto Invoice
            const invId = idGen.generateId('I');
            const subtotal = round2(billAmt / 1.18);
            const taxAmount = round2(billAmt - subtotal);

            invoices.push({
              id: invId,
              invoiceId: invId,
              billId: invId,
              customBillId: billRefName,
              billNumber: billRefName,
              invoiceDate: dateResolution.formattedDate,
              linkQuoteId: '',
              storeGstin: STORE_CONSTANTS.storeGstin,
              customerId,
              customerName: name,
              customerExternalName: name,
              customerPhone: phone || '+91 99980 21446',
              billingAddress: address,
              installationAddress: 'Same as Billing Address',
              cloudLinking: { source: 'Google Drive', driveViewLinkOrId: '' },
              items: [
                {
                  id: `line-${invId}-1`,
                  name: `1.5T Inverter Split AC (Ref: ${billRefName})`,
                  modelNo: 'FTKF50U',
                  indoorModelNo: 'FTKF50U-IDU',
                  outdoorModelNo: 'RKF50U-ODU',
                  type: 'AC',
                  brand: 'DAIKIN',
                  serialNo: `IDU-DAI-${invId.slice(-6)} / ODU-DAI-${invId.slice(-6)}`,
                  indoorUnitSerial: `IDU-DAI-${invId.slice(-6)}`,
                  outdoorUnitSerial: `ODU-DAI-${invId.slice(-6)}`,
                  quantity: 1,
                  rate: subtotal,
                  taxPercent: 18,
                  isAmountWithTax: false,
                  discount: 0,
                  lineTotal: billAmt,
                },
              ],
              subtotal,
              taxAmount,
              tax: taxAmount,
              discountAmount: 0,
              roundOffAmount: 0,
              totalAmount: billAmt,
              finalAmount: billAmt,
              prepaidSplits: {
                fromBalance: 0,
                upi: { amount: billAmt, receivingBank: 'HDFC Bank', utr: `UTR-${invId.slice(-6)}` },
                card: { amount: 0, receivingBank: '', authId: '' },
                chequeOrNeft: { amount: 0, chequeOrSlipOrUtr: '', bank: '' },
                cash: { amount: 0, drawerRegister: 'Main Drawer 1' },
              },
              totalPrepaid: billAmt,
              amountDue: 0,
              paymentStatus: 'PAID',
              status: 'COMPLETED',
              createdAt: dateResolution.formattedDate,
              customer: {
                customerId,
                customerLegalName: name,
                customerPhone: phone || '+91 99980 21446',
                billingAddress: address,
                installationAddress: address,
              },
              calculation: {
                totalBill: billAmt,
                subtotal,
                tax: taxAmount,
              },
            });

            // B) Auto Delivery Challan
            const divId = idGen.generateId('D');
            deliveries.push({
              id: divId,
              deliveryId: divId,
              customIdMiddleText: 'VIP-DELIVERY',
              customerId,
              customerExternalName: name,
              customerName: name,
              customerPhone: phone || '+91 99980 21446',
              linkedInvoiceIds: [invId],
              billingAddress: address,
              deliveryAddress: address,
              installationAddress: 'Same as Billing Address',
              itemsSummary: `1x 1.5T Inverter Split AC (Ref: ${billRefName})`,
              status: 'OUT_FOR_DELIVERY',
              divState: '5. Out for Delivery',
              outForDeliveryEnabled: true,
              assignedDriver: {
                driverName: 'Ramesh Bhai',
                driverPhone: '+91 98250 11223',
                vehicleNumber: 'GJ-01-AB-1234',
                assignedAt: `${dateResolution.formattedDate} 10:00 AM`,
              },
              storeContactPhone: STORE_CONSTANTS.storeHelpline,
              storeHelpline: STORE_CONSTANTS.storeHelpline,
              trackingUpdates: [
                { id: `trk-${divId}-1`, timestamp: '18:29:01', message: 'Your AC is ready to be shipped' },
                { id: `trk-${divId}-2`, timestamp: '20:01:19', message: 'Out for delivery' },
              ],
              messageNotes: ['18:29:01 your ac is ready to be shipped', '20:01:19 Out for div'],
              createdAt: dateResolution.formattedDate,
            });

            // C) Auto Store Inflow Transaction
            const transId = idGen.generateId('T');
            const txRecord: TransactionRecord = {
              id: transId,
              transId,
              transType: 'Record Store Inflow',
              customerId,
              amountInflow: billAmt,
              amount: billAmt,
              mode: 'UPI Transfer',
              bankDrawer: 'HDFC Bank',
              bankOrDrawer: 'HDFC Bank',
              utrRefNoSlip: `UTR-${transId.slice(-6)}`,
              referenceNo: `UTR-${transId.slice(-6)}`,
              treatment: 'LINK_DIRECTLY_TO_INVOICE',
              type: 'INFLOW',
              notes: `Store Receipt for Bill Ref: ${billRefName}`,
              createdAt: dateResolution.formattedDate,
            };
            transactions.push(txRecord);
            custTransactions.push(txRecord);
          }

          customers.push({
            id: customerId,
            customMiddleId,
            externalName: name,
            internalName: `${name} - Tally Master Ledger`,
            phone: phone || '+91 98250 27209',
            email: isCorp ? `billing@${name.toLowerCase().replace(/[^a-z]/g, '')}.com` : '',
            openingBalance: round2(absBal),
            currentBalance: round2(absBal),
            accountBalance: round2(absBal),
            billingAddress: address,
            installationAddress: 'Same as Billing Address',
            gstin: gstin || '',
            pan: pan || '',
            accessPin: customerId.slice(-4),
            transactions: custTransactions,
            createdAt: dateResolution.formattedDate,
          });
        }
      }
    }
  } catch {
    isXmlParsed = false;
  }

  // Fallback for CSV / TXT / JSON / JS if not parsed by XML DOM
  if (!isXmlParsed) {
    let cleanText = cleaned.trim();
    cleanText = cleanText.replace(/^(?:#.*[\r\n]+)+/g, '').trim();

    if (!cleanText.startsWith('{') && !cleanText.startsWith('[')) {
      const jsonMatch = cleanText.match(/return\s*(\{[\s\S]*\})\s*;?\s*\}\)\);?/i) ||
                        cleanText.match(/(?:systemData|LEAD_SYSTEM|return)\s*=\s*(\{[\s\S]*\})\s*;?/i) ||
                        cleanText.match(/(\{[\s\S]*\})/);
      if (jsonMatch && jsonMatch[1]) {
        cleanText = jsonMatch[1].trim();
      }
    }

    if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
      try {
        const parsedJson = JSON.parse(cleanText);
        const raw = parsedJson.data || parsedJson;

        const customerArr = raw.customers || raw.debtors || [];
        const vendorArr = raw.vendors || raw.creditors || raw.payables || [];
        const stockArr = raw.inventory || raw.storeStock || raw.stock || raw.stockItems || [];
        const invoiceArr = raw.bills || raw.invoices || [];
        const deliveryArr = raw.deliveries || raw.div || raw.shipments || [];
        const transactionArr = raw.transactions || raw.receipts || raw.inflows || [];

        if (Array.isArray(customerArr)) {
          customerArr.forEach((c: any) => {
            const normalized = normalizeCustomer(c);
            const custId = normalized.id;
            customers.push({
              id: custId,
              customMiddleId: c.customMiddleId || dateResolution.dateKey,
              externalName: normalized.externalName,
              internalName: c.internalName || `${normalized.externalName} - Tally Master Ledger`,
              phone: normalized.phone,
              email: normalized.email,
              openingBalance: round2(normalized.openingBalance),
              currentBalance: round2(normalized.currentBalance),
              accountBalance: round2(normalized.currentBalance),
              billingAddress: normalized.billingAddress || 'Store Pickup',
              installationAddress: c.installationAddress || 'Same as Billing Address',
              gstin: normalized.gstin,
              pan: normalized.pan,
              accessPin: c.portalAccessPin || custId.slice(-4),
              transactions: normalized.transactions,
              createdAt: c.createdAt || dateResolution.formattedDate,
            });
          });
        }

        if (Array.isArray(vendorArr)) {
          vendorArr.forEach((v: any) => {
            const vId = v.vendorId || v.id || idGen.generateId('V');
            const vName = v.vendorName || v.externalName || v.name || 'Supplier Master';
            vendors.push({
              id: vId,
              vendorId: vId,
              vendorName: vName,
              amountWeOwe: round2(parseFloat(v.amountWeOwe) || parseFloat(v.amount) || 0),
              category: classifyVendorCategory(vName, v.category || ''),
              partyPhone: v.partyPhone || v.phoneNumber || v.phone || '',
              targetDueDate: v.targetDueDate || '15/11/2026',
              billOrderReferenceNo: v.billOrderReferenceNo || `PO-${vId.slice(-4)}`,
              notes: v.notes || 'Imported LEA-D Vendor',
              billingAddress: v.billingAddress || 'GIDC Estate, Ahmedabad',
              gstin: v.gstin || '',
              pan: v.pan || '',
              createdAt: v.createdAt || dateResolution.formattedDate,
            });
          });
        }

        if (Array.isArray(stockArr)) {
          stockArr.forEach((s: any) => {
            const normalized = normalizeStock(s);
            const sId = normalized.id;
            const pName = normalized.name;
            const priceVal = round2(normalized.sellingPrice);
            const applianceType = normalized.applianceType;

            storeStock.push({
              id: sId,
              stockId: sId,
              sku: s.sku || `SKU-${sId.slice(-6)}-01`,
              websiteStockId: s.websiteStockId || `WEB-${sId.slice(-6)}`,
              applianceType,
              name: pName,
              productFullName: pName,
              modelNo: s.modelNo || pName,
              setModelNumber: s.setModelNumber || pName.replace(/\s+/g, '-').toUpperCase(),
              type: applianceType,
              brand: (s.brand || normalized.brand).toUpperCase(),
              serialNo: s.serialNo || s.indoorUnitSerial || `IDU-${sId.slice(-6)}`,
              indoorModel: s.indoorModel || `${pName}-IDU`,
              indoorUnitSerial: s.indoorUnitSerial || `IDU-${sId.slice(-6)}`,
              outdoorModel: s.outdoorModel || `${pName}-ODU`,
              outdoorUnitSerial: s.outdoorUnitSerial || `ODU-${sId.slice(-6)}`,
              rate: priceVal,
              price: priceVal,
              sellingPrice: priceVal,
              quantity: normalized.quantity,
              status: normalized.status,
              stockState: normalized.stockState,
              hasQrCode: s.hasQrCode !== undefined ? s.hasQrCode : true,
              createdAt: s.createdAt || dateResolution.formattedDate,
            });
          });
        }

        if (Array.isArray(invoiceArr)) {
          invoiceArr.forEach((inv: any) => {
            const normalized = normalizeInvoice(inv);
            const invId = normalized.id;
            const customBillId = inv.customBillId || inv.billNumber || inv.billNo || inv.linkedQuoteId || inv.paymentTransId || `G00${invId.slice(-4)}`;
            const custId = normalized.customerId;
            const custName = normalized.customerName;
            const custPhone = normalized.customerPhone;
            const billingAddr = normalized.billingAddress || 'Store Pickup';
            const installAddr = inv.installationAddress || inv.customer?.installationAddress || billingAddr;

            const totalAmt = round2(normalized.totalAmount);
            const subtotalAmt = round2(normalized.subtotal);
            const taxAmt = round2(normalized.tax);
            const invDate = normalized.invoiceDate;

            invoices.push({
              id: invId,
              invoiceId: invId,
              billId: invId,
              customBillId,
              billNumber: customBillId,
              invoiceDate: invDate,
              customerId: custId,
              customerName: custName,
              customerExternalName: custName,
              customerPhone: custPhone,
              billingAddress: billingAddr,
              installationAddress: installAddr,
              linkedQuoteId: customBillId,
              items: normalized.items,
              subtotal: subtotalAmt,
              taxAmount: taxAmt,
              tax: taxAmt,
              discountAmount: round2(parseFloat(inv.discountAmount || 0)),
              roundOffAmount: round2(parseFloat(inv.roundOffAmount || 0)),
              totalAmount: totalAmt,
              finalAmount: totalAmt,
              prepaidSplits: inv.prepaidSplits || { fromBalance: 0, upiCash: totalAmt },
              totalPrepaid: inv.totalPrepaid !== undefined ? round2(parseFloat(inv.totalPrepaid)) : totalAmt,
              amountDue: inv.amountDue !== undefined ? round2(parseFloat(inv.amountDue)) : 0,
              paymentStatus: inv.paymentStatus || 'PAID',
              status: inv.status || 'COMPLETED',
              notes: inv.notes || `Invoice ${customBillId}`,
              createdAt: invDate,
              customer: inv.customer || {
                customerId: custId,
                customerLegalName: custName,
                customerPhone: custPhone,
                billingAddress: billingAddr,
                installationAddress: installAddr,
              },
              calculation: inv.calculation || {
                totalBill: totalAmt,
                subtotal: subtotalAmt,
                tax: taxAmt,
              },
            });
          });
        }

        if (Array.isArray(deliveryArr)) deliveries.push(...deliveryArr.map(normalizeDelivery));
        if (Array.isArray(transactionArr)) transactions.push(...transactionArr.map(normalizeTransaction));
      } catch (err) {
        console.error('Failed to parse LEA-D JSON/JS file:', err);
      }
    }
  }

  // Guarantee at least 1 Store Inflow Transaction if customer exists
  if (transactions.length === 0 && customers.length > 0) {
    const transId = idGen.generateId('T');
    const firstCust = customers[0];

    const txRecord: TransactionRecord = {
      id: transId,
      transId,
      transType: 'Record Store Inflow',
      customerId: firstCust.id,
      amountInflow: 15000,
      amount: 15000,
      mode: 'UPI Transfer',
      bankDrawer: 'HDFC Bank',
      bankOrDrawer: 'HDFC Bank',
      utrRefNoSlip: `UTR-${transId.slice(-6)}`,
      referenceNo: `UTR-${transId.slice(-6)}`,
      treatment: 'ADDED_TO_BALANCE',
      type: 'INFLOW',
      notes: 'Initial store advance receipt inflow',
      createdAt: dateResolution.formattedDate,
    };
    transactions.push(txRecord);

    firstCust.currentBalance = round2((firstCust.openingBalance || 0) + 15000);
    firstCust.accountBalance = firstCust.currentBalance;
    if (!firstCust.transactions) firstCust.transactions = [];
    firstCust.transactions.push(txRecord);
  }

  return {
    companyInfo: {
      companyName: STORE_CONSTANTS.companyName,
      storeGstin: STORE_CONSTANTS.storeGstin,
      storeHelpline: STORE_CONSTANTS.storeHelpline,
      baseDate: dateResolution.dateKey,
      version: 'SDBM 1.0 Standard (Store Data & Billing Manager)',
    },
    dateKey: dateResolution.dateKey,
    customers,
    vendors,
    storeStock,
    inventory: storeStock,
    stock: storeStock,
    deliveries,
    invoices,
    bills: invoices,
    transactions,
    tallyMasters: masters,
    dateResolution,
  };
}

// Primary SDBM Normalization function alias
export const normalizeTallyToSdbmData = normalizeTallyToLeadData;
export const SdbmIdGenerator = LeadIdGenerator;

/**
 * Generate clean JSON text export file: SDBM_Complete_System.txt
 */
export function generateSdbmCompleteSystemTxt(data: any): string {
  return JSON.stringify(data, null, 2);
}

// Backwards compatibility alias
export const generateLeadCompleteSystemTxt = generateSdbmCompleteSystemTxt;

/**
 * Generate Universal CommonJS/AMD JavaScript module: SDBM_Complete_System.js
 */
export function generateSdbmCompleteSystemJs(data: any): string {
  const jsonPayload = JSON.stringify(data, null, 2);

  return `/**
 * SDBM 1.0 Universal System Data Module (Store Data & Billing Manager)
 * Company: LAKHI ELECTRONICS AIRCONDITIONERS
 * GSTIN: 24AAIPU5764D1ZI | Helpline: +91 99980 21446
 * Dynamic Date Key: ${data.companyInfo.baseDate}
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SDBMSystem = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var systemData = ${jsonPayload};

  return {
    getSystemData: function () {
      return systemData;
    },
    searchCustomer: function (query) {
      if (!query) return systemData.customers;
      var q = query.toLowerCase();
      return systemData.customers.filter(function (c) {
        return (c.id && c.id.toLowerCase().indexOf(q) !== -1) ||
               (c.externalName && c.externalName.toLowerCase().indexOf(q) !== -1) ||
               (c.phone && c.phone.indexOf(q) !== -1) ||
               (c.gstin && c.gstin.toLowerCase().indexOf(q) !== -1);
      });
    },
    searchVendor: function (query) {
      if (!query) return systemData.vendors;
      var q = query.toLowerCase();
      return systemData.vendors.filter(function (v) {
        return (v.vendorId && v.vendorId.toLowerCase().indexOf(q) !== -1) ||
               (v.vendorName && v.vendorName.toLowerCase().indexOf(q) !== -1) ||
               (v.partyPhone && v.partyPhone.indexOf(q) !== -1);
      });
    }
  };
}));
`;
}

// Backwards compatibility alias
export const generateLeadCompleteSystemJs = generateSdbmCompleteSystemJs;
