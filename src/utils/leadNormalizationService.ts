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
              customBillId: billRefName,
              invoiceDate: dateResolution.formattedDate,
              linkQuoteId: '',
              storeGstin: STORE_CONSTANTS.storeGstin,
              customerId,
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
              discountAmount: 0,
              roundOffAmount: 0,
              totalAmount: billAmt,
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
              createdAt: dateResolution.formattedDate,
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

        if (parsedJson.customers || parsedJson.vendors || parsedJson.storeStock || parsedJson.inventory || parsedJson.invoices) {
          if (Array.isArray(parsedJson.customers)) {
            parsedJson.customers.forEach((c: any) => {
              const custId = c.customerId || c.id || idGen.generateId('C');
              customers.push({
                id: custId,
                customMiddleId: c.customMiddleId || dateResolution.dateKey,
                externalName: c.externalName || c.name || 'Customer Master',
                internalName: c.internalName || `${c.externalName || c.name || 'Customer'} - Tally Master Ledger`,
                phone: c.phoneNumber || c.phone || '',
                email: c.email || '',
                openingBalance: round2(parseFloat(c.openingBalance) || 0),
                currentBalance: round2(parseFloat(c.currentBalance) || parseFloat(c.openingBalance) || 0),
                accountBalance: round2(parseFloat(c.currentBalance) || parseFloat(c.openingBalance) || 0),
                billingAddress: c.billingAddress || 'Store Pickup',
                installationAddress: c.installationAddress || 'Same as Billing Address',
                gstin: c.gstin || '',
                pan: c.pan || '',
                accessPin: c.portalAccessPin || custId.slice(-4),
                transactions: Array.isArray(c.transactions) ? c.transactions : [],
                createdAt: c.createdAt || dateResolution.formattedDate,
              });
            });
          }

          if (Array.isArray(parsedJson.vendors)) {
            parsedJson.vendors.forEach((v: any) => {
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

          const stockArr = parsedJson.storeStock || parsedJson.inventory;
          if (Array.isArray(stockArr)) {
            stockArr.forEach((s: any) => {
              const sId = s.stockId || s.id || idGen.generateId('STK');
              const pName = s.productFullName || s.name || '1.5T Inverter Split AC';
              storeStock.push({
                id: sId,
                stockId: sId,
                sku: s.sku || `SKU-${sId.slice(-6)}-01`,
                websiteStockId: s.websiteStockId || `WEB-${sId.slice(-6)}`,
                applianceType: s.applianceType || 'AC',
                name: pName,
                productFullName: pName,
                modelNo: s.modelNo || pName,
                setModelNumber: s.setModelNumber || pName.replace(/\s+/g, '-').toUpperCase(),
                type: s.type || s.applianceType || 'AC',
                brand: (s.brand || 'DAIKIN').toUpperCase(),
                serialNo: s.serialNo || s.indoorUnitSerial || `IDU-${sId.slice(-6)}`,
                indoorModel: s.indoorModel || `${pName}-IDU`,
                indoorUnitSerial: s.indoorUnitSerial || `IDU-${sId.slice(-6)}`,
                outdoorModel: s.outdoorModel || `${pName}-ODU`,
                outdoorUnitSerial: s.outdoorUnitSerial || `ODU-${sId.slice(-6)}`,
                sellingPrice: round2(parseFloat(s.sellingPrice) || 38500),
                quantity: s.quantity || 1,
                status: s.status || 'AVAILABLE',
                stockState: s.stockState || 'ava',
                hasQrCode: s.hasQrCode !== undefined ? s.hasQrCode : true,
                createdAt: s.createdAt || dateResolution.formattedDate,
              });
            });
          }

          if (Array.isArray(parsedJson.deliveries)) deliveries.push(...parsedJson.deliveries);
          if (Array.isArray(parsedJson.invoices)) invoices.push(...parsedJson.invoices);
          if (Array.isArray(parsedJson.transactions)) transactions.push(...parsedJson.transactions);
        }
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
      version: 'LEA-D 4.0 Standard',
    },
    dateKey: dateResolution.dateKey,
    customers,
    vendors,
    storeStock,
    deliveries,
    invoices,
    transactions,
    tallyMasters: masters,
    dateResolution,
  };
}

/**
 * Generate clean JSON text export file: LA_D_Complete_System.txt
 */
export function generateLeadCompleteSystemTxt(data: LeadCompleteSystemData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Generate Universal CommonJS/AMD JavaScript module: LA_D_Complete_System.js
 */
export function generateLeadCompleteSystemJs(data: LeadCompleteSystemData): string {
  const jsonPayload = JSON.stringify(data, null, 2);

  return `/**
 * LEA-D 4.0 Universal System Data Module
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
    root.LEADSystem = factory();
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
               (v.category && v.category.toLowerCase().indexOf(q) !== -1) ||
               (v.gstin && v.gstin.toLowerCase().indexOf(q) !== -1);
      });
    },
    searchStock: function (query) {
      if (!query) return systemData.storeStock;
      var q = query.toLowerCase();
      return systemData.storeStock.filter(function (s) {
        return (s.id && s.id.toLowerCase().indexOf(q) !== -1) ||
               (s.name && s.name.toLowerCase().indexOf(q) !== -1) ||
               (s.brand && s.brand.toLowerCase().indexOf(q) !== -1) ||
               (s.serialNo && s.serialNo.toLowerCase().indexOf(q) !== -1);
      });
    },
    recordStoreInflow: function (customerId, amount, mode, utr) {
      var transId = 'T' + systemData.companyInfo.baseDate + Math.floor(1000 + Math.random() * 9000);
      var record = {
        id: transId,
        transId: transId,
        transType: 'Record Store Inflow',
        customerId: customerId,
        amountInflow: amount,
        amount: amount,
        mode: mode || 'UPI Transfer',
        bankDrawer: 'HDFC Bank',
        bankOrDrawer: 'HDFC Bank',
        utrRefNoSlip: utr || 'UTR-LOCAL-GEN',
        treatment: 'ADDED_TO_BALANCE',
        createdAt: '27/10/2026'
      };
      systemData.transactions.push(record);

      var cust = systemData.customers.find(function (c) { return c.id === customerId; });
      if (cust) {
        cust.currentBalance = (cust.currentBalance || 0) + amount;
        cust.accountBalance = cust.currentBalance;
        if (!cust.transactions) cust.transactions = [];
        cust.transactions.push(record);
      }
      return record;
    },
    generateId: function (type) {
      var prefix = type.toUpperCase();
      var validPrefixes = ['I', 'Q', 'STK', 'D', 'C', 'T', 'V'];
      if (validPrefixes.indexOf(prefix) === -1) prefix = 'C';
      return prefix + systemData.companyInfo.baseDate + Math.floor(1000 + Math.random() * 9000);
    }
  };
}));
`;
}
