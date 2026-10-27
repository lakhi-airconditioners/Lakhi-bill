export type IdTypePrefix = 'I' | 'Q' | 'STK' | 'D' | 'C' | 'T' | 'V';

export interface Customer {
  id: string; // e.g., C202610271137
  internalName: string; // Staff dealer notes / alias (e.g. "Sharma Ji - Tally Master Ledger")
  externalName: string; // Official legal name shown on bills and portal
  phone: string;
  email?: string;
  gstin?: string; // GSTIN Identification Number
  pan?: string; // PAN identifier
  notes?: string; // Internal dealer / import notes
  billingAddress: string; // Billing address(es)
  installationAddress: string; // Installation address(es)
  accessPin: string; // 4-digit PIN for quick customer portal access
  accountBalance: number; // Positive (+) = Advance funds; Negative (-) = Credit owed
  openingBalance?: number;
  currentBalance?: number;
  customMiddleId?: string; // "VIP-CORP" or "20261027"
  linkedUid?: string; // Firebase Auth UID if converted to permanent
  transactions?: TransactionRecord[];
  createdAt: string;
  updatedAt?: string;
}

// Strict 6 Vendor Categories mandated by LEA-D 4.0
export type VendorCategory =
  | 'Supplier Stock / Consignment'
  | 'Installation / Labor Wages'
  | 'Freight / Transportation'
  | 'Customer Advance Refund'
  | 'Shop Rent / Utilities'
  | 'Other Expenses';

export interface Vendor {
  id: string; // e.g., V202610271149
  vendorId: string; // V20261027XXXX
  vendorName: string; // Legal supplier / contractor name
  amountWeOwe: number; // Float balance we owe
  category: VendorCategory;
  partyPhone: string;
  targetDueDate: string; // DD/MM/YYYY (default: 15/11/2026)
  billOrderReferenceNo: string; // PO / Invoice ref e.g. PO-8492
  notes: string; // Particulars of consignment / work
  billingAddress: string;
  gstin: string;
  pan: string;
  createdAt: string;
  updatedAt?: string;
}

// Quotation Status: strictly RECORDED or SENT (no DRAFT, no APPROVED/REJECTED)
export type QuotationStatus = 'RECORDED' | 'SENT';

export interface QuotationItem {
  id: string;
  name: string; // Product name e.g. "55-inch 4K Smart OLED TV", "1.5T 5-Star Split AC"
  modelNo: string; // Model number e.g. "OLED55C3PSA"
  indoorModelNo?: string; // Optional indoor model if AC
  outdoorModelNo?: string; // Optional outdoor model if AC
  type: string; // Type: AC, TV, Refrigerator, Washing Machine, Microwave, etc.
  brand?: string;
  quantity: number;
  rate: number; // Base rate or inclusive rate
  taxPercent: number; // e.g. 18% or 28%
  isAmountWithTax: boolean; // Flag to enter/calculate amount with tax
  lineTotal: number;
}

export type PdfProviderType = 'google_drive' | 'onedrive' | 'other' | 'none';

export interface Quotation {
  id: string; // e.g., Q202610274182
  customerId: string;
  customerExternalName: string;
  customerPhone: string;
  billingAddress: string;
  installationAddress: string;
  items: QuotationItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: QuotationStatus; // RECORDED or SENT only
  pdfLink?: string; // Direct PDF view link (URL/cloud/drive link)
  pdfProvider?: PdfProviderType;
  pdfDriveId?: string;
  pdfViewLink?: string;
  pdfDownloadLink?: string;
  gstNumber?: string;
  notes?: string;
  linkedInvoiceIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface InvoiceLineItem {
  id: string;
  name: string; // Product name
  modelNo: string; // Model number
  indoorModelNo?: string; // Optional indoor model if AC
  outdoorModelNo?: string; // Optional outdoor model if AC
  type: string; // Type: AC, TV, Refrigerator, etc.
  brand?: string;
  serialNo?: string; // Single device serial or comma-separated serials
  indoorUnitSerial?: string; // Optional indoor SN if AC
  outdoorUnitSerial?: string; // Optional outdoor SN if AC
  quantity: number;
  rate: number;
  taxPercent: number;
  isAmountWithTax: boolean; // Option to enter amount with tax
  discount: number;
  lineTotal: number;
}

export interface PrepaidSplits {
  fromBalance: number;
  upi: {
    amount: number;
    receivingBank: string;
    utr: string;
  };
  card: {
    amount: number;
    receivingBank: string;
    authId: string;
  };
  chequeOrNeft: {
    amount: number;
    chequeOrSlipOrUtr: string;
    bank: string;
  };
  cash: {
    amount: number;
    drawerRegister: string;
  };
}

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface Invoice {
  id: string; // e.g., I202610271001
  invoiceId?: string;
  customBillId?: string;
  invoiceDate?: string; // "27/10/2026"
  linkQuoteId?: string;
  storeGstin?: string; // "24AAIPU5764D1ZI"
  customerId: string;
  customerExternalName: string;
  customerPhone: string;
  billingAddress: string;
  installationAddress: string;
  linkedQuoteId?: string; // Direct linked quote ID entry option
  cloudLinking?: {
    source: 'Google Drive' | 'OneDrive' | 'Other';
    driveViewLinkOrId: string;
  };
  items: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  roundOffAmount?: number; // Round off adjustment (+/-)
  totalAmount: number;
  prepaidSplits: PrepaidSplits;
  totalPrepaid: number;
  amountDue: number; // totalAmount - totalPrepaid
  paymentStatus: PaymentStatus;
  pdfLink?: string; // Stored PDF view link
  pdfProvider?: PdfProviderType;
  pdfDriveId?: string;
  pdfViewLink?: string;
  pdfDownloadLink?: string;
  gstNumber?: string;
  notes?: string;
  paymentTransId?: string; // Payment transaction ID / UTR / Reference
  createdAt: string;
  updatedAt?: string;
}

// Store Stock ONLY stores stock in store
export type StockStatus = 'AVAILABLE' | 'SOLD' | 'ARCHIVED';
export type LeadStockState = 'ava' | 'sold' | 'achive';

export interface InventoryItem {
  id: string; // STK20261027XXXX
  stockId?: string; // STK20261027XXXX
  sku?: string;
  websiteStockId?: string;
  applianceType?: 'AC' | 'Appliance' | 'TV';
  name: string; // Product name / productFullName
  productFullName?: string;
  modelNo: string; // Model number / setModelNumber
  setModelNumber?: string;
  indoorModelNo?: string; // IDU Model
  outdoorModelNo?: string; // ODU Model
  indoorModel?: string;
  outdoorModel?: string;
  type: string; // AC, TV, Refrigerator, Washing Machine, etc.
  brand: string;
  serialNo: string; // Physical carton barcode / serial number
  indoorUnitSerial?: string; // IDU serial
  outdoorUnitSerial?: string; // ODU serial
  barcode?: string; // Barcode value
  barcodeAdded?: boolean; // Set to true when internal barcode is made/printed
  barcodePrintedAt?: string; // Timestamp when barcode was marked as printed
  hasQrCode?: boolean;
  sellingPrice: number;
  quantity?: number;
  status: StockStatus; // AVAILABLE, SOLD, or ARCHIVED
  stockState?: LeadStockState; // "ava", "sold", "achive"
  assignedInvoiceId?: string;
  isArchived?: boolean; // Set to true when product leaves store
  archivedAt?: string;
  archivedReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ShipmentStatus =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_STORE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED_INSTALLED';

export type LeadDivState =
  | '1. Order Placed'
  | '2. Order Confirmed'
  | '3. In Transit'
  | '4. Arrived at Store'
  | '5. Out for Delivery'
  | '6. Delivered & Installed';

export interface TrackingUpdate {
  id: string;
  timestamp: string;
  message: string;
  location?: string;
}

export interface ShipmentDriver {
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  assignedAt: string;
}

export interface Shipment {
  id: string; // e.g., D202610271001
  deliveryId?: string; // D20261027XXXX
  customIdMiddleText?: string;
  invoiceId?: string; // Invoice link is OPTIONAL (single)
  invoiceIds?: string[]; // Multiple invoices can be linked later!
  linkedInvoiceIds?: string[];
  customerId: string;
  customerExternalName: string;
  customerName?: string;
  customerPhone: string;
  billingAddress?: string;
  deliveryAddress: string; // Delivery/installation address
  installationAddress: string;
  itemsSummary: string;
  status: ShipmentStatus;
  divState?: LeadDivState;
  outForDeliveryEnabled: boolean;
  driverName?: string;
  driverPhone?: string;
  vehicleOrDriver?: string;
  deliveryPersonPhone?: string;
  assignedDriver?: ShipmentDriver;
  ewayBillNo?: string;
  storeContactPhone?: string; // Lakhi Store helpline / contact info (+91 99980 21446)
  storeHelpline?: string;
  liveRouteLink?: string;
  trackingUpdates: TrackingUpdate[]; // Updates that can be added
  messageNotes?: string[];
  createdAt: string;
  updatedAt?: string;
}

export type TransactionType = 'INFLOW' | 'OUTFLOW';
export type PaymentMode = 'UPI' | 'CARD' | 'CHEQUE_NEFT' | 'CASH' | 'BALANCE_ADJUSTMENT';
export type LeadInflowMode = 'UPI Transfer' | 'Cash' | 'Card' | 'Bank Transfer / Cheque';
export type LeadBankDrawer = 'HDFC Bank' | 'Main Drawer 1' | 'SBI Bank';
export type PaymentTreatment = 'LINKED_TO_INVOICE' | 'ADDED_TO_BALANCE';
export type LeadInflowTreatment = 'ADDED_TO_BALANCE' | 'LINK_DIRECTLY_TO_INVOICE';

export interface TransactionRecord {
  id: string; // e.g., T202610271001
  transId?: string;
  transType?: 'Record Store Inflow';
  customerId: string;
  invoiceId?: string;
  type: TransactionType;
  mode: PaymentMode | LeadInflowMode;
  amountInflow?: number;
  bankDrawer?: LeadBankDrawer;
  utrRefNoSlip?: string;
  referenceNo?: string;
  bankOrDrawer: string;
  amount: number;
  treatment: PaymentTreatment | LeadInflowTreatment;
  notes?: string;
  createdAt: string;
}

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface VerificationClaim {
  id: string; // 6-digit code e.g., 948210
  customerName: string;
  customerPhone: string;
  customerNotes?: string;
  status: ClaimStatus;
  matchedCustomerId?: string;
  createdAt: string;
  expiresAt: string; // strict 72-hour lifetime
  approvedAt?: string;
  approvedBy?: string;
}

export type PayableStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface PayableRecord {
  id: string; // e.g. V202610271149
  vendorName: string; // Who we have to pay (Supplier, technician, refund, etc.)
  vendorPhone?: string;
  partyPhone?: string;
  category: VendorCategory | 'SUPPLIER_STOCK' | 'FREIGHT_DELIVERY' | 'LABOR_INSTALLATION' | 'CUSTOMER_REFUND' | 'UTILITY_RENT' | 'OTHER';
  amount: number;
  amountWeOwe?: number;
  dueDate?: string;
  targetDueDate?: string;
  notes?: string;
  billReference?: string;
  billOrderReferenceNo?: string;
  status: PayableStatus;
  paidAt?: string;
  paymentMode?: PaymentMode;
  paymentReference?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BrandLogos {
  logo1x1?: string; // App 1x1 Square Logo
  logoMain?: string; // Main Logo
  logoWithWordmark?: string; // Main Logo with Word "Lakhi"
  updatedAt?: string;
  updatedBy?: string;
}

export interface AdminConfig {
  adminUids: string[];
  gstNumber?: string;
  businessName?: string;
  businessTagline?: string;
  businessPhone?: string;
  logos?: BrandLogos;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  linkedCustomerIds: string[];
  updatedAt: string;
}

// LEA-D 4.0 Master References & Full System Bundle
export interface TallyMastersData {
  godowns: string[];
  stockGroups: string[];
  unitsOfMeasure: string[];
  banksAndCash: string[];
  dutiesAndTaxes: string[];
  expenseLedgers: string[];
}

export interface LeadCompleteSystemData {
  companyInfo: {
    companyName: string;
    storeGstin: string;
    storeHelpline: string;
    baseDate: string;
    version: string;
  };
  dateKey: string;
  customers: Customer[];
  vendors: Vendor[];
  storeStock: InventoryItem[];
  deliveries: Shipment[];
  invoices: Invoice[];
  transactions: TransactionRecord[];
  tallyMasters: TallyMastersData;
}

