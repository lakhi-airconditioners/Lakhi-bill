# Tally Prime Masters & Transactions XML Parser & Sorter

An enhanced Tally XML engine capable of parsing unified `Masters & Transactions` XML payloads containing `<UNIT>`, `<GODOWN>`, `<STOCKITEM>`, `<LEDGER>`, `<VOUCHER VCHTYPE="Delivery Note">`, and `<VOUCHER VCHTYPE="Sales">` nodes with dual serial numbers (`IDU:... / ODU:...`), zero-sum ledger balancing, master lookup enrichment, and YYYYMMDD date sorting.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following confirmed choices govern the implementation:

- **Confirmed Decision 1: Chronological Sorting Order**
  Transactions will be parsed from `<DATE>YYYYMMDD</DATE>` into standard datetime objects and sorted **chronologically ascending by Date**, then alphabetically by Voucher Number.
- **Confirmed Decision 2: Master Metadata Enrichment**
  Voucher inventory lines and party entries will be automatically cross-referenced with Master `<LEDGER>` and `<STOCKITEM>` tags to pull GSTIN, GST Registration Type, HSN Codes, Stock Parent Groups, and Base Units.
- **Confirmed Decision 3: Zero-Sum Sign Normalization**
  Zero-sum Tally ledger entries ($\sum \text{AMOUNT} = 0$, e.g. Party `-41,300.00`, Sales `35,000.00`, CGST `3,150.00`, SGST `3,150.00`) will be normalized into positive party debit totals, taxable revenue, and tax subtotals in UI views while preserving underlying math.
- **Confirmed Decision 4: Delivery Note vs. Sales Voucher Architecture**
  - **Delivery Note (`VCHTYPE="Delivery Note"`)**: Parsed as inventory-only dispatches with Godown and dual serial numbers (`idu_serial` & `odu_serial`) without requiring financial ledger entries.
  - **Sales Invoice (`VCHTYPE="Sales"`)**: Parsed as complete commercial billing vouchers with both itemized inventory batch allocations and balanced accounting ledger entries.

---

## 1. Overview & Core Concept

### What It Does
1. **Master Section Extraction**: Parses `<UNIT>` (e.g. `SET`), `<GODOWN>` (e.g. `Central Warehouse`), `<STOCKITEM>` (HSNCode `84151010`, Parent `Split AC`, Unit `SET`), and `<LEDGER>` (`Sundry Debtors`, GSTIN `24AJUPS3679Q1ZW`, `Regular` registration type).
2. **Dual Serial Extraction**: Automatically parses `<BATCHNAME>IDU:VOLT-882190 / ODU:VOLT-993412</BATCHNAME>` into `idu_serial` (`VOLT-882190`) and `odu_serial` (`VOLT-993412`).
3. **Transaction Date Parsing & Sorting**: Converts YYYYMMDD strings (e.g. `20261014` $\rightarrow$ `2026-10-14`) into Javascript `Date` objects and sorts all vouchers by Date ascending, then Voucher Number.
4. **Master Enrichment Engine**: Links `Metro Cooling Center` in vouchers to Master Ledger GSTIN (`24AJUPS3679Q1ZW`) and `1.5 Ton Split AC 5 Star` to HSN Code `84151010`.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **1-Click Sample Test Drive**:
   - Click **"Load Masters & Transactions Sample XML"** in the Tally Integration Hub to instantly test the exact provided XML payload.
2. **Master & Transaction Register View**:
   - View Masters Summary Cards (`1 Units`, `1 Godown`, `1 Stock Item`, `1 Ledger`).
   - View Chronologically Sorted Transaction Register showing:
     - **DC/001/26-27** (Delivery Note • Date: Oct 14, 2026 • Godown: Central Warehouse • IDU: VOLT-882190 | ODU: VOLT-993412)
     - **INV/001/26-27** (Sales Invoice • Date: Oct 15, 2026 • Total: ₹41,300.00 • Taxable: ₹35,000.00 • CGST: ₹3,150.00 • SGST: ₹3,150.00 • GSTIN: 24AJUPS3679Q1ZW • HSN: 84151010)

### Visual Identity & Theme
- **Style**: High-density B2B SaaS Dashboard conforming to Lakhi ERP guidelines.
- **Color Palette**: Slate neutral canvas, Crimson primary accent (`#DC2626`), Teal for Delivery Notes, Purple for Sales Invoices, Emerald for Master Badges.
- **Typography**: `Plus Jakarta Sans` for headers, `font-mono tabular-nums` (`JetBrains Mono`) for dates, voucher numbers, serials, and tax figures.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Master Lookup Cross-Referencing**
  - *Chosen Approach*: Build a temporary Master index (`masterLedgersMap`, `masterStockItemsMap`) during XML parsing, then enrich every voucher transaction line item with HSN Code, GSTIN, and Parent Group during the second pass.
  - *Why*: Tally XML Vouchers often omit HSN codes or GSTINs on individual lines, relying on Master definitions. Pre-indexing guarantees 100% complete transaction records.
- **Decision 2: Date Conversion & Multi-Field Sorting**
  - *Chosen Approach*: Parse YYYYMMDD via `new Date(year, month - 1, day).getTime()`. Sort array via `.sort((a, b) => a.dateObj - b.dateObj || a.voucherNumber.localeCompare(b.voucherNumber))`.

---

## 4. Technical Architecture & Data Strategy

### System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Unified Tally XML Payload Input                           │
│     (<ENVELOPE> -> <REPORTNAME>Masters & Transactions</REPORTNAME>)          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         parseTallyXmlData() Engine                          │
│  Pass 1: Build Masters Maps                                                 │
│    - unitsMap: { SET: { isSimpleUnit: true } }                              │
│    - godownsMap: { "Central Warehouse": { name: "Central Warehouse" } }     │
│    - stockItemsMap: { "1.5 Ton Split AC 5 Star": { hsnCode: "84151010" } }  │
│    - ledgersMap: { "Metro Cooling Center": { gstin: "24AJUPS3679Q1ZW" } }   │
│                                                                             │
│  Pass 2: Parse Vouchers & Extract Dual Serials                              │
│    - BATCHNAME -> extractDualSerials() -> idu_serial, odu_serial            │
│    - ALLLEDGERENTRIES -> Party Debit, CGST, SGST, IGST (Zero-sum check)     │
│    - Enrich Vouchers with GSTIN & HSNCode from Pass 1 Maps                  │
│                                                                             │
│  Pass 3: Chronological Sorting                                              │
│    - Date(YYYYMMDD) -> sort by dateAsc, then voucherNumberAsc               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TallyPrimeManager React Component                      │
│  - "Load Masters & Transactions Sample XML" 1-Click Button                  │
│  - Master Summary Pills & Enriched Transaction Table                        │
│  - Live Firestore Database Sync (Customers, Inventory, Invoices, Shipments) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model Additions in `tallyHelper.ts`

```typescript
export interface ParsedTallyUnit {
  name: string;
  isSimpleUnit?: boolean;
}

export interface ParsedTallyGodown {
  name: string;
}

export interface ParsedTallyMasterSummary {
  units: ParsedTallyUnit[];
  godowns: ParsedTallyGodown[];
  stockItems: ParsedTallyStockItem[];
  ledgers: ParsedTallyCustomer[];
}

export interface ParsedTallyVoucher {
  voucherNumber: string;
  dateStr: string; // YYYYMMDD
  dateFormatted: string; // YYYY-MM-DD
  dateObj: Date;
  vchType: 'SALES' | 'DELIVERY_NOTE' | 'OTHER';
  partyLedgerName: string;
  partyGstin?: string;
  gstRegistrationType?: string;
  totalAmount: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  items: Array<{
    name: string;
    hsnCode?: string;
    quantity: number;
    unit?: string;
    rate?: number;
    amount?: number;
    godownName?: string;
    batchName?: string;
    idu_serial?: string;
    odu_serial?: string;
  }>;
}
```

### Implementation Plan Steps
1. **Update `src/utils/tallyHelper.ts`**:
   - Add parsing for `<UNIT>` and `<GODOWN>` tags.
   - Update `parseTallyXmlData` to run two passes:
     - Pass 1: Parse and store Master Ledgers and Stock Items in lookup maps.
     - Pass 2: Parse Vouchers, extract `idu_serial` & `odu_serial` from `<BATCHNAME>`, verify zero-sum ledger entries, and enrich with Pass 1 Master metadata.
     - Pass 3: Convert `<DATE>YYYYMMDD</DATE>` to standard JS Date and sort chronologically ascending by Date, then Voucher Number.
   - Add `SAMPLE_TALLY_MASTERS_AND_TRANSACTIONS_XML` constant containing the exact sample payload provided.
2. **Update `src/components/staff/TallyPrimeManager.tsx`**:
   - Add a 1-click test button **"Load Masters & Transactions Sample XML"**.
   - Render Master Summary cards (Units, Godowns, Stock Items, Ledgers).
   - Render the chronologically sorted Transaction Register with enriched GSTIN and HSN badges, dual serial pills (`IDU: ...`, `ODU: ...`), and zero-sum tax breakdowns.
3. **Compile & Verify**:
   - Run `compile_applet` and `lint_applet` to verify compilation.
