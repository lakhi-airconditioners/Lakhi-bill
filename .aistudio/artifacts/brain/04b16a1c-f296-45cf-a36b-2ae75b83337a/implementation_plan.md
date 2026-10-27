# Legacy Tally to LEA-D 4.0 Data Normalization & System Migration Plan

Implementation plan to ingest raw or legacy Tally XML/JSON/TXT/CSV data and convert it deterministically into the **LEA-D 4.0 (Lakhi Electronics Airconditioners - Data)** schema. The system guarantees strict separation of buyers and sellers, standard ID formatting, stock mapping, delivery tracking, and exports both `LA_D_Complete_System.txt` (JSON) and `LA_D_Complete_System.js` (Universal UMD/CommonJS module).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions govern how legacy data is ingested, processed, and merged into the application state:

- **Confirmed Decision 1**: Incoming Tally records will be cleaned, transformed into LEA-D 4.0 structures, and merged/upserted directly into the application state using deterministic ID collision checks.
- **Confirmed Decision 2**: Data normalization will be executed strictly against user-loaded/parsed Tally files (XML, CSV, JSON, TXT), giving staff instant audit, mapping, and download capability for `LA_D_Complete_System.txt` and `LA_D_Complete_System.js`.

---

## 1. Overview & Core Concept

The **LEA-D 4.0 Normalization Engine** acts as the definitive data bridge between legacy Tally ERP systems and Lakhi Electronics Airconditioners' cloud workflow. It parses raw or glitchy Tally dumps, strips XML escape artifacts (`&#...;`, control bytes), categorizes parties strictly into Debtors (Customers) and Creditors (Vendors), validates all IDs against regex `^(I|Q|STK|D|C|T|V)[0-9]{8}[0-9]{4}$`, and produces production-ready system files.

---

## 2. User Experience & Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│              LAKHI ELECTRONICS - TALLY TO LEA-D 4.0 MIGRATION          │
├─────────────────────────────────────────────────────────────────────────┤
│ [ File Ingestion Zone ]  xml | csv | json | txt                            │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  Drag & Drop Tally XML/CSV export or Click to Upload               │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ [ Normalization Summary Cards ]                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Customers   │  │   Vendors    │  │ Store Stock  │  │  Challans    │ │
│  │ C20261027... │  │ V20261027... │  │ STK20261027. │  │ D20261027... │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                         │
│ [ Data Inspection & Category Mapping Tabs ]                            │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Debtors (Buyers) | Creditors (Sellers - 6 Categories) | Invoices    │ │
│ │ Deliveries      | Inflow Receipts                    | Masters     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ [ Export & Synchronize Actions ]                                        │
│  [ Download LA_D_Complete_System.txt ]   [ Download LA_D_Complete_System.js ]│
│  [ Commit & Upsert to Store State ]                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Visual Identity**: Professional industrial utility aesthetic with clean slate grey backdrop (`#0f172a`), emerald accent badges (`#10b981`), and clear tabular audit views.
- **Interactive Feedback**: Instant file validation feedback, regex error reporting for malformed IDs, category drop-down selectors for Vendor classification, and single-click bundle export.

---

## 3. Key Product Decisions & Trade-Offs

- **Deterministic ID Allocation (`[Type][YYYYMMDD][XXXX]`)**:
  - *Chosen Approach*: Prefix matching entity type (`I`, `Q`, `STK`, `D`, `C`, `T`, `V`) followed by base date (`20261027`) and sequential 4-digit zero-padded index (`1001`, `1002`).
  - *Why*: Ensures 100% collision-free cross-referencing between Tally bill allocations, delivery notes, and tax invoices.
- **Strict Party Partitioning**:
  - *Chosen Approach*: Sundry Debtors are routed strictly to `customers` (`C20261027XXXX`). Sundry Creditors are routed strictly to `vendors` (`V20261027XXXX`) and assigned exactly one of 6 mandated business categories (`Supplier Stock / Consignment`, `Installation / Labor Wages`, `Freight / Transportation`, `Customer Advance Refund`, `Shop Rent / Utilities`, `Other Expenses`).
  - *Why*: Prevents accounting pollution where suppliers appear as buyers or vice versa.
- **Dual Export Modules**:
  - *Chosen Approach*: Generates `LA_D_Complete_System.txt` (formatted JSON schema payload) and `LA_D_Complete_System.js` (Universal UMD JS module exposing search and transaction methods).
  - *Why*: Serves both immediate ERP file backups and browser/node runtime integrations.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TALLY DATA INGESTION ENGINE                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      SANITIZATION & CLEANING PHASE                     │
│  - Strip XML escape artifacts (&#...;), ASCII control codes           │
│  - Regex ID formatting: ^(I|Q|STK|D|C|T|V)20261027[0-9]{4}$            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   LEA-D 4.0 SCHEMA TRANSFORMATION                      │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │   customers[]    │  │    vendors[]     │  │     storeStock[]     │ │
│  │ (Sundry Debtors) │  │(Sundry Creditors)│  │ (Stock Items & Split)│ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │   deliveries[]   │  │    invoices[]    │  │    transactions[]    │ │
│  │(Delivery Challan)│  │  (Tax Invoices)  │  │ (Store Inflow Rec.)  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                        tallyMasters                              │ │
│  │  (godowns, stockGroups, unitsOfMeasure, banksAndCash, etc.)      │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        OUTPUT & SYSTEM EXPORT                          │
│  - LA_D_Complete_System.txt (Clean LEA-D 4.0 JSON System Data)        │
│  - LA_D_Complete_System.js  (Universal UMD JS module with query API)   │
│  - Merged directly into AppContext state & persisted to Firestore      │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Schema Definition (LEA-D 4.0)

1. **Customers (`customers[]`)**:
   - `customerId`: `C20261027XXXX`
   - `customMiddleId`: `"VIP-CORP"` or `"20261027"`
   - `externalName`, `internalName`, `phoneNumber`, `portalAccessPin` (4-digit)
   - `email`, `openingBalance`, `currentBalance`, `billingAddress`, `installationAddress`
   - `gstin`, `pan`, `transactions[]`

2. **Vendors (`vendors[]`)**:
   - `vendorId`: `V20261027XXXX`
   - `vendorName`, `amountWeOwe`, `partyPhone`, `targetDueDate` (`15/11/2026`), `billOrderReferenceNo`, `notes`, `billingAddress`, `gstin`, `pan`
   - `category`: Exactly 1 of `["Supplier Stock / Consignment", "Installation / Labor Wages", "Freight / Transportation", "Customer Advance Refund", "Shop Rent / Utilities", "Other Expenses"]`

3. **Store Stock (`storeStock[]`)**:
   - `stockId`: `STK20261027XXXX`
   - `sku`, `websiteStockId`, `applianceType` (`"AC"` | `"Appliance"` | `"TV"`), `brand`, `productFullName`, `setModelNumber`
   - Split AC fields: `indoorModel`, `indoorUnitSerial`, `outdoorModel`, `outdoorUnitSerial`
   - `sellingPrice`, `quantity`, `stockState` (`"ava"` | `"sold"` | `"achive"`), `hasQrCode` (boolean)

4. **Deliveries (`deliveries[]`)**:
   - `deliveryId`: `D20261027XXXX`
   - `customIdMiddleText`, `customerId`, `customerName`, `customerPhone`, `linkedInvoiceIds[]`
   - `billingAddress`, `installationAddress`, `itemsSummary`, `storeHelpline` (`"+91 99980 21446"`)
   - `assignedDriver`: `{ driverName, driverPhone, vehicleNumber, assignedAt }`
   - `divState`: Exactly 1 of `["1. Order Placed", "2. Order Confirmed", "3. In Transit", "4. Arrived at Store", "5. Out for Delivery", "6. Delivered & Installed"]`
   - `messageNotes[]`: Timestamped status logs

5. **Invoices (`invoices[]`)**:
   - `invoiceId`: `I20261027XXXX`
   - `customBillId`, `invoiceDate` (`"27/10/2026"`), `linkQuoteId`, `storeGstin` (`"24AAIPU5764D1ZI"`)
   - `customer`, `cloudLinking` (`source`, `driveViewLinkOrId`), `items[]` (18%/28% tax, rate, inclusive total)
   - `calculation`: `subtotal`, `tax`, `specialDiscount`, `roundOffAmount`, `totalBill`, `prepaidSplit` (`fromAccountBalance`, `upiAmount`, `upiUtr`, `cardAmount`, `cardAuthCode`, `chequeBankTransfer`, `chequeRef`, `cashTendered`), `totalPrepaid`, `amountDue`

6. **Transactions (`transactions[]`)**:
   - `transId`: `T20261027XXXX`
   - `transType`: `"Record Store Inflow"`
   - `customerId`, `amountInflow`
   - `mode`: `"UPI Transfer"` | `"Cash"` | `"Card"` | `"Bank Transfer / Cheque"`
   - `bankDrawer`: `"HDFC Bank"` | `"Main Drawer 1"` | `"SBI Bank"`
   - `utrRefNoSlip`, `treatment`: `"ADDED_TO_BALANCE"` | `"LINK_DIRECTLY_TO_INVOICE"`

7. **Master Tables (`tallyMasters`)**:
   - `godowns[]`, `stockGroups[]`, `unitsOfMeasure[]`, `banksAndCash[]`, `dutiesAndTaxes[]`, `expenseLedgers[]`

---

## 5. Implementation Steps & Tasks

1. **Update System Types (`src/types/index.ts`)**:
   - Extend existing types to incorporate full LEA-D 4.0 fields and strict vendor category definitions.
2. **Build LEA-D 4.0 Normalization Service (`src/utils/leadNormalizationService.ts`)**:
   - Implement `cleanTallyRawText` to strip XML/control characters.
   - Implement `generateLeadId(type, dateStr, counter)` following regex `^(I|Q|STK|D|C|T|V)[0-9]{8}[0-9]{4}$`.
   - Implement parser routines to convert Tally Debtors -> `customers`, Tally Creditors -> `vendors`, Stock -> `storeStock`, Delivery Notes -> `deliveries`, Sales -> `invoices`, Inflows -> `transactions`, and Master references.
   - Implement exporters: `generateLeadCompleteSystemTxt(normalizedData)` and `generateLeadCompleteSystemJs(normalizedData)`.
3. **Upgrade Tally Manager UI (`src/components/staff/TallyPrimeManager.tsx`)**:
   - Add LEA-D 4.0 Normalization tab with live file upload (XML/CSV/TXT/JSON).
   - Display transformation stats, deterministic ID validation status, party separation tables, and vendor category mapping.
   - Provide instant download triggers for `LA_D_Complete_System.txt` and `LA_D_Complete_System.js`.
   - Provide "Merge & Upsert to LEA-D Store" action button to commit normalized records directly to `AppContext`.
4. **Verification & Build Validation**:
   - Run compilation check using `compile_applet` to verify TypeScript types and UI compatibility.
