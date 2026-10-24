/**
 * Tally Prime XML Utility
 * Handles decoding of Tally Prime Master exports (Units, Groups, Ledgers, Taxes)
 * and bidirectional XML creation for Sales Invoices and Delivery Challans with Serial/Batch tracking.
 */

export interface DecodedTallyUnit {
  name: string;
  simpleUnit: boolean;
  decimalPlaces: number;
  uqcName: string;
}

export interface DecodedTallyGroup {
  name: string;
  parent: string;
}

export interface DecodedTallyLedger {
  name: string;
  parent: string;
  openingBalance: number;
  balanceType: 'Dr' | 'Cr' | 'Nil';
  pan: string;
  gstin: string;
  state: string;
  address: string[];
  mobile: string;
  isBillwise: boolean;
}

export interface DecodedInventoryBatch {
  batchOrSerial: string;
  godown: string;
  actualQty?: string;
  billedQty?: string;
  amount?: number;
}

export interface DecodedInvoiceItem {
  itemName: string;
  actualQty: string;
  billedQty: string;
  rate: string;
  amount: number;
  batches: DecodedInventoryBatch[];
}

export interface DecodedLedgerEntry {
  ledgerName: string;
  amount: number;
  isDebit: boolean;
}

export interface DecodedTallyVoucher {
  voucherType: string;
  voucherNumber: string;
  date: string;
  partyName: string;
  isInvoice: boolean;
  totalAmount: number;
  items: DecodedInvoiceItem[];
  ledgerEntries: DecodedLedgerEntry[];
}

export interface DecodedTallyData {
  companyName: string;
  units: DecodedTallyUnit[];
  groups: DecodedTallyGroup[];
  ledgers: DecodedTallyLedger[];
  vouchers: DecodedTallyVoucher[];
}

/**
 * Parses raw Tally XML export text into structured JSON data.
 */
export function parseTallyXml(xmlString: string): DecodedTallyData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const companyEl = xmlDoc.querySelector('STATICVARIABLES > SVCURRENTCOMPANY');
  const companyName = companyEl ? companyEl.textContent?.trim() || '' : '';

  const result: DecodedTallyData = {
    companyName,
    units: [],
    groups: [],
    ledgers: [],
    vouchers: []
  };

  const messages = xmlDoc.querySelectorAll('TALLYMESSAGE');

  messages.forEach((msg) => {
    // 1. Process Units of Measurement
    const unitEl = msg.querySelector('UNIT');
    if (unitEl) {
      const name = unitEl.getAttribute('NAME') || unitEl.querySelector('NAME')?.textContent?.trim() || '';
      const decimals = parseInt(unitEl.querySelector('DECIMALPLACES')?.textContent?.trim() || '0', 10);
      const uqc = unitEl.querySelector('REPORTINGUQCNAME')?.textContent?.trim() || '';
      result.units.push({
        name,
        simpleUnit: unitEl.querySelector('ISSIMPLEUNIT')?.textContent?.trim().toLowerCase() === 'yes',
        decimalPlaces: Number.isNaN(decimals) ? 0 : decimals,
        uqcName: uqc
      });
      return;
    }

    // 2. Process Account Groups
    const groupEl = msg.querySelector('GROUP');
    if (groupEl) {
      const name = groupEl.getAttribute('NAME') || groupEl.querySelector('NAME')?.textContent?.trim() || '';
      const parent = groupEl.querySelector('PARENT')?.textContent?.trim() || '';
      if (name) {
        result.groups.push({ name, parent });
      }
      return;
    }

    // 3. Process Ledgers (Customers, Creditors, Accounts)
    const ledgerEl = msg.querySelector('LEDGER');
    if (ledgerEl) {
      const name = ledgerEl.getAttribute('NAME') || ledgerEl.querySelector('NAME')?.textContent?.trim() || '';
      const parent = ledgerEl.querySelector('PARENT')?.textContent?.trim() || '';
      const rawBal = parseFloat(ledgerEl.querySelector('OPENINGBALANCE')?.textContent?.trim() || '0');
      const pan = ledgerEl.querySelector('INCOMETAXNUMBER')?.textContent?.trim() || '';
      
      const gstin = ledgerEl.querySelector('LEDGSTREGDETAILS\\.LIST > GSTIN, GSTIN')?.textContent?.trim() || '';
      const state = ledgerEl.querySelector('LEDMAILINGDETAILS\\.LIST > STATE, STATE')?.textContent?.trim() || '';
      const mobile = ledgerEl.querySelector('LEDGERMOBILE')?.textContent?.trim() || 
                     ledgerEl.querySelector('CONTACTDETAILS\\.LIST > PHONENUMBER')?.textContent?.trim() || '';

      const addressLines: string[] = [];
      ledgerEl.querySelectorAll('ADDRESS\\.LIST > ADDRESS').forEach((addr) => {
        if (addr.textContent?.trim()) addressLines.push(addr.textContent.trim());
      });

      result.ledgers.push({
        name,
        parent,
        openingBalance: Math.abs(rawBal),
        balanceType: rawBal < 0 ? 'Cr' : (rawBal > 0 ? 'Dr' : 'Nil'),
        pan,
        gstin,
        state,
        address: addressLines,
        mobile,
        isBillwise: ledgerEl.querySelector('ISBILLWISEON')?.textContent?.trim().toLowerCase() === 'yes'
      });
      return;
    }

    // 4. Process Vouchers (Invoices, Challans, Payments)
    const voucherEl = msg.querySelector('VOUCHER');
    if (voucherEl) {
      const vType = voucherEl.querySelector('VOUCHERTYPENAME')?.textContent?.trim() || 
                    voucherEl.getAttribute('VCHTYPE') || '';
      const vNumber = voucherEl.querySelector('VOUCHERNUMBER')?.textContent?.trim() || '';
      const vDate = voucherEl.querySelector('DATE')?.textContent?.trim() || '';
      const party = voucherEl.querySelector('PARTYLEDGERNAME')?.textContent?.trim() || '';
      const isInvoice = voucherEl.querySelector('ISINVOICE')?.textContent?.trim().toLowerCase() === 'yes';

      const items: DecodedInvoiceItem[] = [];
      voucherEl.querySelectorAll('ALLINVENTORYENTRIES\\.LIST').forEach((inv) => {
        const itemName = inv.querySelector('STOCKITEMNAME')?.textContent?.trim() || '';
        const actualQty = inv.querySelector('ACTUALQTY')?.textContent?.trim() || '';
        const billedQty = inv.querySelector('BILLEDQTY')?.textContent?.trim() || '';
        const rate = inv.querySelector('RATE')?.textContent?.trim() || '';
        const amount = Math.abs(parseFloat(inv.querySelector('AMOUNT')?.textContent?.trim() || '0'));

        const batches: DecodedInventoryBatch[] = [];
        inv.querySelectorAll('BATCHALLOCATIONS\\.LIST').forEach((b) => {
          batches.push({
            batchOrSerial: b.querySelector('BATCHNAME')?.textContent?.trim() || '',
            godown: b.querySelector('GODOWNNAME')?.textContent?.trim() || '',
            actualQty: b.querySelector('ACTUALQTY')?.textContent?.trim() || '',
            billedQty: b.querySelector('BILLEDQTY')?.textContent?.trim() || '',
            amount: parseFloat(b.querySelector('AMOUNT')?.textContent?.trim() || '0')
          });
        });

        items.push({ itemName, actualQty, billedQty, rate, amount, batches });
      });

      const ledgerEntries: DecodedLedgerEntry[] = [];
      let totalAmount = 0;

      voucherEl.querySelectorAll('ALLLEDGERENTRIES\\.LIST').forEach((led) => {
        const lName = led.querySelector('LEDGERNAME')?.textContent?.trim() || '';
        const amt = parseFloat(led.querySelector('AMOUNT')?.textContent?.trim() || '0');
        const isDeb = led.querySelector('ISDEEMEDPOSITIVE')?.textContent?.trim().toLowerCase() === 'yes';

        if (Math.abs(amt) > totalAmount) {
          totalAmount = Math.abs(amt);
        }

        ledgerEntries.push({
          ledgerName: lName,
          amount: Math.abs(amt),
          isDebit: isDeb
        });
      });

      result.vouchers.push({
        voucherType: vType,
        voucherNumber: vNumber,
        date: vDate,
        partyName: party,
        isInvoice,
        totalAmount,
        items,
        ledgerEntries
      });
    }
  });

  return result;
}

export interface TallySalesItemInput {
  name: string;
  qty: number;
  unit: string;
  rate: number;
  godown?: string;
  serialNo?: string;
}

export interface TallySalesExportParams {
  companyName: string;
  voucherNumber: string;
  date: string; // YYYYMMDD
  partyName: string;
  isDeliveryChallan?: boolean;
  items: TallySalesItemInput[];
  taxRatePercent?: number; // Defaults to 18
  isInterstate?: boolean;
}

/**
 * Builds standard XML for importing Sales Invoices or Delivery Challans with Serial/Batch details into Tally.
 */
export function generateTallySalesXml(params: TallySalesExportParams): string {
  const vchType = params.isDeliveryChallan ? 'Delivery Note' : 'Sales';
  let subtotal = 0;

  const inventoryXml = params.items
    .map((item) => {
      const itemTotal = item.qty * item.rate;
      subtotal += itemTotal;
      const amtStr = params.isDeliveryChallan ? `-${itemTotal.toFixed(2)}` : `${itemTotal.toFixed(2)}`;

      const batchXml = item.serialNo
        ? `
       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>${item.godown || 'Main Location'}</GODOWNNAME>
        <BATCHNAME>${item.serialNo}</BATCHNAME>
        <ACTUALQTY>${item.qty} ${item.unit}</ACTUALQTY>
        <BILLEDQTY>${item.qty} ${item.unit}</BILLEDQTY>
        <AMOUNT>${amtStr}</AMOUNT>
       </BATCHALLOCATIONS.LIST>`
        : '';

      return `
      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>${item.name}</STOCKITEMNAME>
       <ACTUALQTY>${item.qty} ${item.unit}</ACTUALQTY>
       <BILLEDQTY>${item.qty} ${item.unit}</BILLEDQTY>
       <RATE>${item.rate.toFixed(2)}/${item.unit}</RATE>
       <AMOUNT>${amtStr}</AMOUNT>${batchXml}
      </ALLINVENTORYENTRIES.LIST>`;
    })
    .join('');

  let ledgerEntriesXml = '';

  if (!params.isDeliveryChallan) {
    const taxRate = params.taxRatePercent ?? 18;
    const taxTotal = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxTotal;

    const taxLedgers = params.isInterstate
      ? `
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Output IGST @ ${taxRate}%</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${taxTotal.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`
      : `
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Output CGST @ ${(taxRate / 2)}%</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${(taxTotal / 2).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Output SGST @ ${(taxRate / 2)}%</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${(taxTotal / 2).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;

    ledgerEntriesXml = `
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${params.partyName}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <AMOUNT>-${grandTotal.toFixed(2)}</AMOUNT>
       <BILLALLOCATIONS.LIST>
        <NAME>${params.voucherNumber}</NAME>
        <BILLTYPE>New Ref</BILLTYPE>
        <AMOUNT>-${grandTotal.toFixed(2)}</AMOUNT>
       </BILLALLOCATIONS.LIST>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>Sales Account</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${subtotal.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>${taxLedgers}`;
  }

  return `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${params.companyName}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="${vchType}" Action="Create">
      <DATE>${params.date}</DATE>
      <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${params.voucherNumber}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${params.partyName}</PARTYLEDGERNAME>
      <ISINVOICE>Yes</ISINVOICE>${ledgerEntriesXml}${inventoryXml}
     </VOUCHER>
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}
