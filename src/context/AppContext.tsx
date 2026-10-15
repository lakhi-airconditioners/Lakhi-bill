import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  getDocFromServer,
  query,
  where,
  getDocs,
  deleteField,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  Customer,
  Quotation,
  QuotationItem,
  Invoice,
  InvoiceLineItem,
  InventoryItem,
  Shipment,
  TrackingUpdate,
  TransactionRecord,
  VerificationClaim,
  AdminConfig,
  BrandLogos,
  PdfProviderType,
  PayableRecord,
  PaymentMode,
} from '../types';
import { generateUniqueId, generateClaimCode } from '../utils/idGenerator';

interface AppContextType {
  // Theme Mode
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Store Business & GST Settings
  gstNumber: string;
  updateGstNumber: (newGst: string) => Promise<void>;

  // Brand & Logos Customization
  brandLogos: BrandLogos;
  updateBrandLogos: (logos: Partial<BrandLogos>) => Promise<void>;
  resetBrandLogo: (target: 'logo1x1' | 'logoMain' | 'logoWithWordmark' | 'all') => Promise<void>;

  // Auth & Roles
  currentUser: User | null;
  isAdmin: boolean;
  adminUids: string[];
  addAdminUid: (uid: string) => Promise<void>;
  removeAdminUid: (uid: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  viewMode: 'STAFF' | 'CUSTOMER';
  setViewMode: (mode: 'STAFF' | 'CUSTOMER') => void;

  // Active Customer Session
  activeCustomer: Customer | null;
  loginCustomerById: (id: string, pin: string) => Promise<{ success: boolean; message: string }>;
  loginCustomerByPhone: (phone: string, pin: string) => Promise<{ success: boolean; message: string; customer?: Customer }>;
  findCustomerByPhone: (phone: string) => Promise<Customer | null>;
  logoutCustomer: () => void;
  linkCustomerAccount: (customerId: string, email: string) => Promise<void>;
  changeCustomerPin: (customerId: string, newPin: string, currentPin?: string) => Promise<{ success: boolean; message: string }>;
  userLinkedCustomerIds: string[];
  linkCustomerToUserAccount: (customerId: string) => Promise<void>;
  unlinkCustomerFromUserAccount: (customerId: string) => Promise<void>;

  // Data Collections (Empty by default, populated from Firestore)
  customers: Customer[];
  quotations: Quotation[];
  invoices: Invoice[];
  inventory: InventoryItem[];
  shipments: Shipment[];
  transactions: TransactionRecord[];
  claims: VerificationClaim[];
  payables: PayableRecord[];

  // Loading & Sync
  isLoading: boolean;
  isFirebaseConnected: boolean;

  // Mutations
  addCustomer: (data: Partial<Customer>, customCode?: string) => Promise<string>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;

  addQuotation: (data: {
    customerId: string;
    customerExternalName: string;
    customerPhone: string;
    billingAddress: string;
    installationAddress: string;
    items: QuotationItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    status: 'RECORDED' | 'SENT';
    pdfLink?: string;
    pdfProvider?: PdfProviderType;
    pdfDriveId?: string;
    pdfViewLink?: string;
    pdfDownloadLink?: string;
    gstNumber?: string;
    notes?: string;
    createdAt?: string;
  }, customCode?: string) => Promise<string>;
  updateQuotationStatus: (id: string, status: 'RECORDED' | 'SENT') => Promise<void>;
  updateQuotation: (id: string, data: Partial<Quotation>) => Promise<void>;

  addInvoice: (data: {
    customerId: string;
    customerExternalName: string;
    customerPhone: string;
    billingAddress: string;
    installationAddress: string;
    linkedQuoteId?: string;
    items: InvoiceLineItem[];
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    roundOffAmount?: number;
    totalAmount: number;
    prepaidSplits: Invoice['prepaidSplits'];
    totalPrepaid: number;
    amountDue: number;
    paymentStatus: Invoice['paymentStatus'];
    pdfLink?: string;
    pdfProvider?: PdfProviderType;
    pdfDriveId?: string;
    pdfViewLink?: string;
    pdfDownloadLink?: string;
    gstNumber?: string;
    notes?: string;
    paymentTransId?: string;
    createdAt?: string;
    subtractStockItemIds?: string[]; // Optional stock to subtract/mark as SOLD
  }, customCode?: string) => Promise<string>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;

  recordPaymentForInvoice: (
    invoiceId: string,
    amount: number,
    mode: TransactionRecord['mode'],
    referenceNo: string,
    bankOrDrawer: string,
    treatment: 'LINKED_TO_INVOICE' | 'ADDED_TO_BALANCE',
    notes?: string,
    customerId?: string
  ) => Promise<string>;

  // Store Stock Only Mutations
  addInventoryItem: (data: {
    name: string;
    modelNo: string;
    type: string;
    brand: string;
    serialNo: string;
    sellingPrice: number;
    stockId?: string;
  }) => Promise<string>;
  updateInventoryItem: (id: string, data: Partial<InventoryItem>) => Promise<void>;
  markInventorySold: (id: string, invoiceId?: string) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  archiveInventoryItem: (id: string, reason?: string) => Promise<void>;
  unarchiveInventoryItem: (id: string) => Promise<void>;

  // Shipments & Tracking
  addShipment: (data: {
    customerId: string;
    customerExternalName: string;
    customerPhone: string;
    billingAddress?: string;
    deliveryAddress: string;
    installationAddress: string;
    itemsSummary: string;
    invoiceId?: string; // Optional invoice link!
    invoiceIds?: string[]; // Multiple invoices can be linked!
    outForDeliveryEnabled?: boolean;
    driverName?: string;
    driverPhone?: string;
    storeContactPhone?: string;
    liveRouteLink?: string;
  }, customCode?: string) => Promise<string>;
  addShipmentTrackingUpdate: (
    shipmentId: string,
    message: string,
    location?: string,
    customTimestamp?: string
  ) => Promise<void>;
  updateShipmentStatus: (
    shipmentId: string,
    status: Shipment['status'],
    outForDeliveryEnabled?: boolean,
    driverName?: string,
    driverPhone?: string,
    storeContactPhone?: string,
    customMessage?: string,
    location?: string,
    customTimestamp?: string
  ) => Promise<void>;
  linkInvoicesToShipment: (shipmentId: string, invoiceIds: string[]) => Promise<void>;
  updateShipment: (id: string, data: Partial<Shipment>) => Promise<void>;

  // Claims
  submitVerificationClaim: (customerName: string, customerPhone: string, notes?: string) => Promise<string>;
  approveClaim: (claimId: string, targetCustomerId?: string) => Promise<void>;
  rejectClaim: (claimId: string) => Promise<void>;

  // Payables (Who we have to pay - Vendors, suppliers, refunds)
  addPayable: (data: Omit<PayableRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePayable: (id: string, data: Partial<PayableRecord>) => Promise<void>;
  deletePayable: (id: string) => Promise<void>;
  settlePayable: (id: string, mode: PaymentMode, reference?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'STAFF' | 'CUSTOMER'>('CUSTOMER');
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  // Theme Management (Light mode default)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lakhi_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light'; // Light mode is default
  });

  useEffect(() => {
    localStorage.setItem('lakhi_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Data Collections (No pre-set values, starts completely empty)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [claims, setClaims] = useState<VerificationClaim[]>([]);
  const [payables, setPayables] = useState<PayableRecord[]>([]);

  // List of Admin UIDs and Store Config in Firebase
  const [adminUids, setAdminUids] = useState<string[]>([]);
  const [gstNumber, setGstNumber] = useState<string>('');
  const [brandLogos, setBrandLogos] = useState<BrandLogos>(() => {
    try {
      const saved = localStorage.getItem('lakhi_brand_logos');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Dynamically synchronize favicon / apple touch icon when logo1x1 is set
  useEffect(() => {
    if (brandLogos.logo1x1) {
      const iconLinks = document.querySelectorAll<HTMLLinkElement>(
        "link[rel='icon'], link[rel='apple-touch-icon'], link[rel='shortcut icon']"
      );
      if (iconLinks.length > 0) {
        iconLinks.forEach((link) => {
          link.href = brandLogos.logo1x1!;
        });
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = brandLogos.logo1x1;
        document.head.appendChild(newLink);
      }
    }
  }, [brandLogos.logo1x1]);

  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

  // 1. Mandatory connection test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setIsFirebaseConnected(true);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        } else {
          setIsFirebaseConnected(true);
        }
      }
    }
    testConnection();
  }, []);

  // User Account Linked Customer IDs (Stored strictly in Firebase account user_accounts/{uid}, not browser localStorage)
  const [userLinkedCustomerIds, setUserLinkedCustomerIds] = useState<string[]>([]);

  // 2. Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoading(false);
      if (!user) {
        setUserLinkedCustomerIds([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to user's linked customer accounts in Firebase user_accounts/{uid}
  useEffect(() => {
    if (!currentUser) {
      setUserLinkedCustomerIds([]);
      return;
    }

    const unsubUserAccount = onSnapshot(
      doc(db, 'user_accounts', currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserLinkedCustomerIds(Array.isArray(data.linkedCustomerIds) ? data.linkedCustomerIds : []);
        } else {
          setUserLinkedCustomerIds([]);
        }
      },
      (error) => {
        console.warn('User accounts listener error', error);
      }
    );

    return () => unsubUserAccount();
  }, [currentUser]);

  // 3. Admin UIDs & Store Config listener from Firebase system/admins doc
  useEffect(() => {
    const unsubAdmins = onSnapshot(
      doc(db, 'system', 'admins'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AdminConfig;
          setAdminUids(data.adminUids || []);
          if (data.gstNumber !== undefined) {
            setGstNumber(data.gstNumber || '');
          }
          if (data.logos !== undefined) {
            const safeLogos = data.logos || {};
            setBrandLogos(safeLogos);
            try {
              localStorage.setItem('lakhi_brand_logos', JSON.stringify(safeLogos));
            } catch (e) {
              console.warn('Failed to cache logos in localStorage', e);
            }
          }
        } else {
          // If no admin doc exists, default list is empty
          setAdminUids([]);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'system/admins', false);
      }
    );
    return () => unsubAdmins();
  }, []);

  // Determine if the current authenticated user is an authorized Admin
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.email === 'mitanshrs@gmail.com') return true;
    return adminUids.includes(currentUser.uid);
  }, [currentUser, adminUids]);

  // If user is not admin, ensure viewMode is CUSTOMER
  useEffect(() => {
    if (!isAdmin && viewMode === 'STAFF') {
      setViewMode('CUSTOMER');
    }
  }, [isAdmin, viewMode]);

  // Add / Remove Admin UIDs in Firebase
  const addAdminUid = async (uidToRegister: string) => {
    const trimmed = uidToRegister.trim();
    if (!trimmed) return;
    try {
      const updatedList = Array.from(new Set([...adminUids, trimmed]));
      await setDoc(doc(db, 'system', 'admins'), {
        adminUids: updatedList,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || 'admin',
      });
      setAdminUids(updatedList);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system/admins');
    }
  };

  const removeAdminUid = async (uidToRemove: string) => {
    try {
      const updatedList = adminUids.filter((u) => u !== uidToRemove);
      await setDoc(doc(db, 'system', 'admins'), {
        adminUids: updatedList,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || 'admin',
      });
      setAdminUids(updatedList);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system/admins');
    }
  };

  // 4. Real-time Firestore Listeners: Continuously synchronize master collections
  useEffect(() => {
    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        const list: Customer[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as Customer));
        setCustomers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers', false)
    );

    const unsubQuotations = onSnapshot(
      collection(db, 'quotations'),
      (snapshot) => {
        const list: Quotation[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as Quotation));
        setQuotations(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'quotations', false)
    );

    const unsubInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snapshot) => {
        const list: Invoice[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as Invoice));
        setInvoices(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices', false)
    );

    const unsubInventory = onSnapshot(
      collection(db, 'inventory'),
      (snapshot) => {
        const list: InventoryItem[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as InventoryItem));
        setInventory(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventory', false)
    );

    const unsubShipments = onSnapshot(
      collection(db, 'shipments'),
      (snapshot) => {
        const list: Shipment[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as Shipment));
        setShipments(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'shipments', false)
    );

    const unsubTransactions = onSnapshot(
      collection(db, 'transactions'),
      (snapshot) => {
        const list: TransactionRecord[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as TransactionRecord));
        setTransactions(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions', false)
    );

    const unsubClaims = onSnapshot(
      collection(db, 'claims'),
      (snapshot) => {
        const list: VerificationClaim[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as VerificationClaim));
        setClaims(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'claims', false)
    );

    const unsubPayables = onSnapshot(
      collection(db, 'payables'),
      (snapshot) => {
        const list: PayableRecord[] = [];
        snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as PayableRecord));
        setPayables(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payables', false)
    );

    return () => {
      unsubCustomers();
      unsubQuotations();
      unsubInvoices();
      unsubInventory();
      unsubShipments();
      unsubTransactions();
      unsubClaims();
      unsubPayables();
    };
  }, []);

  // Auth Actions
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-In failed', error);
    }
  };

  const logOut = async () => {
    await signOut(auth);
    setViewMode('CUSTOMER');
  };

  // Customer Portal Session Logic
  const loginCustomerById = async (id: string, pin: string): Promise<{ success: boolean; message: string }> => {
    const formattedId = id.trim().toUpperCase();
    const formattedPin = pin.trim();

    try {
      const snap = await getDoc(doc(db, 'customers', formattedId));
      if (!snap.exists()) {
        return { success: false, message: 'Customer ID not found. Use "Find your ID" or 72h claim.' };
      }
      const data = { ...snap.data(), id: snap.id } as Customer;
      if (data.accessPin !== formattedPin) {
        return { success: false, message: 'Invalid 4-digit PIN for this customer ID.' };
      }

      setActiveCustomer(data);
      return { success: true, message: 'Login successful' };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `customers/${formattedId}`, false);
      return { success: false, message: 'Unable to verify credentials from database.' };
    }
  };

  const findCustomerByPhone = async (phone: string): Promise<Customer | null> => {
    const clean = phone.replace(/\D/g, '');
    if (!clean) return null;
    try {
      const match = customers.find((c) => c.phone.replace(/\D/g, '') === clean);
      if (match) return match;
      const q = query(collection(db, 'customers'), where('phone', '==', phone.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { ...d.data(), id: d.id } as Customer;
      }
      return null;
    } catch (err) {
      console.warn('Customer lookup error', err);
      return null;
    }
  };

  const loginCustomerByPhone = async (
    phone: string,
    pin: string
  ): Promise<{ success: boolean; message: string; customer?: Customer }> => {
    const found = await findCustomerByPhone(phone);
    if (!found) {
      return { success: false, message: 'No registered customer account found for this phone number.' };
    }

    if (found.accessPin !== pin.trim()) {
      return { success: false, message: 'Invalid 4-digit PIN for this phone number account.' };
    }

    setActiveCustomer(found);
    return { success: true, message: 'Login successful', customer: found };
  };

  const logoutCustomer = () => {
    setActiveCustomer(null);
  };

  // Change Customer PIN (Used by both Customer Portal & Staff Operations)
  const changeCustomerPin = async (
    customerId: string,
    newPin: string,
    currentPin?: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanPin = newPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return { success: false, message: 'PIN must be exactly 4 numeric digits.' };
    }

    try {
      const snap = await getDoc(doc(db, 'customers', customerId));
      if (!snap.exists()) {
        return { success: false, message: 'Customer account not found.' };
      }
      const custData = snap.data() as Customer;

      // If called from customer side, verify current PIN unless staff admin is doing the reset
      if (currentPin !== undefined && !isAdmin) {
        if (custData.accessPin !== currentPin.trim()) {
          return { success: false, message: 'Current PIN is incorrect.' };
        }
      }

      await updateDoc(doc(db, 'customers', customerId), {
        accessPin: cleanPin,
        updatedAt: new Date().toISOString(),
      });

      if (activeCustomer && activeCustomer.id === customerId) {
        setActiveCustomer({
          ...activeCustomer,
          accessPin: cleanPin,
          updatedAt: new Date().toISOString(),
        });
      }

      return { success: true, message: 'Access PIN updated successfully.' };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${customerId}`);
      return { success: false, message: 'Failed to update PIN in database.' };
    }
  };

  // Link Customer ID to Authenticated Firebase User Account (Stored only in Firebase user_accounts doc)
  const linkCustomerToUserAccount = async (customerId: string) => {
    if (!currentUser) return;
    const formattedId = customerId.trim().toUpperCase();
    try {
      const userRef = doc(db, 'user_accounts', currentUser.uid);
      const snap = await getDoc(userRef);
      const currentList: string[] = snap.exists() && Array.isArray(snap.data()?.linkedCustomerIds)
        ? snap.data().linkedCustomerIds
        : [];

      const updatedList = Array.from(new Set([...currentList, formattedId]));
      await setDoc(userRef, {
        uid: currentUser.uid,
        email: currentUser.email || '',
        linkedCustomerIds: updatedList,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setUserLinkedCustomerIds(updatedList);
    } catch (err) {
      console.error('Error linking customer to user account in Firebase', err);
    }
  };

  // Unlink Customer ID from Authenticated Firebase User Account
  const unlinkCustomerFromUserAccount = async (customerId: string) => {
    if (!currentUser) return;
    const formattedId = customerId.trim().toUpperCase();
    try {
      const userRef = doc(db, 'user_accounts', currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const currentList: string[] = Array.isArray(snap.data()?.linkedCustomerIds)
          ? snap.data().linkedCustomerIds
          : [];
        const updatedList = currentList.filter((id) => id !== formattedId);
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email || '',
          linkedCustomerIds: updatedList,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        setUserLinkedCustomerIds(updatedList);
      }
    } catch (err) {
      console.error('Error unlinking customer from user account in Firebase', err);
    }
  };

  const linkCustomerAccount = async (customerId: string, email: string) => {
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        linkedUid: currentUser?.uid || '',
        email: email.trim(),
        updatedAt: new Date().toISOString(),
      });
      if (activeCustomer && activeCustomer.id === customerId) {
        setActiveCustomer({
          ...activeCustomer,
          linkedUid: currentUser?.uid || '',
          email: email.trim(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${customerId}`);
    }
  };

  // Customer Management
  const addCustomer = async (data: Partial<Customer>, customCode?: string): Promise<string> => {
    const isCustom = !!(customCode && customCode.trim());
    const newId = await generateUniqueId({
      type: 'C',
      customText: customCode,
      useCustom: isCustom,
      includeRandomSuffix: isCustom ? false : true,
    });
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    const record: Customer = {
      id: newId,
      internalName: data.internalName || 'New Client',
      externalName: data.externalName || data.internalName || 'Customer',
      phone: data.phone || '',
      email: data.email || '',
      billingAddress: data.billingAddress || '',
      installationAddress: data.installationAddress || data.billingAddress || '',
      accessPin: data.accessPin || pin,
      accountBalance: data.accountBalance || 0,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'customers', newId), record);
      return newId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `customers/${newId}`);
      return newId;
    }
  };

  const updateCustomer = async (id: string, data: Partial<Customer>) => {
    try {
      await updateDoc(doc(db, 'customers', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${id}`);
    }
  };

  // Quotation Management (Multi-product, RECORDED or SENT only, billing + installation address)
  const addQuotation = async (
    data: {
      customerId: string;
      customerExternalName: string;
      customerPhone: string;
      billingAddress: string;
      installationAddress: string;
      items: QuotationItem[];
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
      status: 'RECORDED' | 'SENT';
      pdfLink?: string;
      pdfProvider?: PdfProviderType;
      pdfDriveId?: string;
      pdfViewLink?: string;
      pdfDownloadLink?: string;
      gstNumber?: string;
      notes?: string;
      createdAt?: string;
    },
    customCode?: string
  ): Promise<string> => {
    const isCustom = !!(customCode && customCode.trim());
    const newId = await generateUniqueId({
      type: 'Q',
      customText: customCode,
      useCustom: isCustom,
      includeRandomSuffix: isCustom ? false : true,
    });

    const quote: Quotation = {
      id: newId,
      customerId: data.customerId,
      customerExternalName: data.customerExternalName,
      customerPhone: data.customerPhone,
      billingAddress: data.billingAddress,
      installationAddress: data.installationAddress,
      items: data.items,
      subtotal: data.subtotal,
      taxAmount: data.taxAmount,
      totalAmount: data.totalAmount,
      status: data.status,
      pdfLink: data.pdfViewLink || data.pdfLink || '',
      pdfProvider: data.pdfProvider,
      pdfDriveId: data.pdfDriveId,
      pdfViewLink: data.pdfViewLink,
      pdfDownloadLink: data.pdfDownloadLink,
      gstNumber: data.gstNumber || gstNumber || '',
      notes: data.notes || '',
      createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'quotations', newId), quote);
      return newId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `quotations/${newId}`);
      return newId;
    }
  };

  const updateQuotationStatus = async (id: string, status: 'RECORDED' | 'SENT') => {
    try {
      await updateDoc(doc(db, 'quotations', id), {
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quotations/${id}`);
    }
  };

  const updateQuotation = async (id: string, data: Partial<Quotation>) => {
    try {
      await updateDoc(doc(db, 'quotations', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quotations/${id}`);
    }
  };

  // Invoice & Split-Billing Management (Multi-product, tax toggle, billing + installation address, optional quote link)
  const addInvoice = async (
    data: {
      customerId: string;
      customerExternalName: string;
      customerPhone: string;
      billingAddress: string;
      installationAddress: string;
      linkedQuoteId?: string;
      items: InvoiceLineItem[];
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      roundOffAmount?: number;
      totalAmount: number;
      prepaidSplits: Invoice['prepaidSplits'];
      totalPrepaid: number;
      amountDue: number;
      paymentStatus: Invoice['paymentStatus'];
      pdfLink?: string;
      pdfProvider?: PdfProviderType;
      pdfDriveId?: string;
      pdfViewLink?: string;
      pdfDownloadLink?: string;
      gstNumber?: string;
      notes?: string;
      paymentTransId?: string;
      createdAt?: string;
      subtractStockItemIds?: string[];
    },
    customCode?: string
  ): Promise<string> => {
    const isCustom = !!(customCode && customCode.trim());
    const newId = await generateUniqueId({
      type: 'I',
      customText: customCode,
      useCustom: isCustom,
      includeRandomSuffix: isCustom ? false : true,
    });

    const invoice: Invoice = {
      id: newId,
      customerId: data.customerId,
      customerExternalName: data.customerExternalName,
      customerPhone: data.customerPhone,
      billingAddress: data.billingAddress,
      installationAddress: data.installationAddress,
      linkedQuoteId: data.linkedQuoteId || '',
      items: data.items,
      subtotal: data.subtotal,
      taxAmount: data.taxAmount,
      discountAmount: data.discountAmount,
      roundOffAmount: data.roundOffAmount || 0,
      totalAmount: data.totalAmount,
      prepaidSplits: data.prepaidSplits,
      totalPrepaid: data.totalPrepaid,
      amountDue: data.amountDue,
      paymentStatus: data.paymentStatus,
      pdfLink: data.pdfViewLink || data.pdfLink || '',
      pdfProvider: data.pdfProvider,
      pdfDriveId: data.pdfDriveId,
      pdfViewLink: data.pdfViewLink,
      pdfDownloadLink: data.pdfDownloadLink,
      gstNumber: data.gstNumber || gstNumber || '',
      notes: data.notes || '',
      paymentTransId: data.paymentTransId || '',
      createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'invoices', newId), invoice);

      // If customer balance was applied in prepaid splits, deduct from customer account balance
      if (data.prepaidSplits.fromBalance > 0) {
        const cust = customers.find((c) => c.id === data.customerId);
        if (cust) {
          const newBal = cust.accountBalance - data.prepaidSplits.fromBalance;
          await updateDoc(doc(db, 'customers', cust.id), {
            accountBalance: newBal,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // If stock items were marked for deduction, mark them as SOLD
      if (data.subtractStockItemIds && data.subtractStockItemIds.length > 0) {
        for (const stockId of data.subtractStockItemIds) {
          await updateDoc(doc(db, 'inventory', stockId), {
            status: 'SOLD',
            assignedInvoiceId: newId,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return newId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `invoices/${newId}`);
      return newId;
    }
  };

  const updateInvoice = async (id: string, data: Partial<Invoice>) => {
    try {
      await updateDoc(doc(db, 'invoices', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${id}`);
    }
  };

  const recordPaymentForInvoice = async (
    invoiceId: string,
    amount: number,
    mode: TransactionRecord['mode'],
    referenceNo: string,
    bankOrDrawer: string,
    treatment: 'LINKED_TO_INVOICE' | 'ADDED_TO_BALANCE',
    notes?: string,
    customerId?: string
  ): Promise<string> => {
    const txId = await generateUniqueId({ type: 'T' });
    const inv = invoices.find((i) => i.id === invoiceId);
    const targetCustId = customerId || (inv ? inv.customerId : activeCustomer?.id || '');

    const txRecord: TransactionRecord = {
      id: txId,
      customerId: targetCustId,
      invoiceId: treatment === 'LINKED_TO_INVOICE' && invoiceId ? invoiceId : '',
      type: 'INFLOW',
      mode,
      referenceNo: referenceNo || '',
      bankOrDrawer: bankOrDrawer || '',
      amount,
      treatment,
      notes: notes ||
        (invoiceId
          ? `Payment for Invoice ${invoiceId}`
          : `Account Balance Inflow for ${targetCustId}`),
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'transactions', txId), txRecord);

      if (treatment === 'LINKED_TO_INVOICE' && inv) {
        const newTotalPrepaid = inv.totalPrepaid + amount;
        const newDue = Math.max(0, inv.totalAmount - newTotalPrepaid);
        const newStatus: Invoice['paymentStatus'] =
          newDue === 0 ? 'PAID' : newTotalPrepaid > 0 ? 'PARTIAL' : 'UNPAID';

        const invoiceUpdates: Partial<Invoice> = {
          totalPrepaid: newTotalPrepaid,
          amountDue: newDue,
          paymentStatus: newStatus,
          updatedAt: new Date().toISOString(),
        };
        if (referenceNo && referenceNo.trim()) {
          invoiceUpdates.paymentTransId = referenceNo.trim();
        }

        await updateDoc(doc(db, 'invoices', inv.id), invoiceUpdates);
      } else if (treatment === 'ADDED_TO_BALANCE' && targetCustId) {
        const cust = customers.find((c) => c.id === targetCustId);
        if (cust) {
          await updateDoc(doc(db, 'customers', cust.id), {
            accountBalance: (cust.accountBalance || 0) + amount,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return txId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `transactions/${txId}`);
      return txId;
    }
  };

  // Stock In Store Only (No godown, no shipping stock, only available stock in store)
  const addInventoryItem = async (data: {
    name: string;
    modelNo: string;
    type: string;
    brand: string;
    serialNo: string;
    sellingPrice: number;
    stockId?: string;
  }): Promise<string> => {
    // Deterministic short sequence number
    const count = inventory.length + 1;
    const cleanSeq = String(count).padStart(2, '0');
    const newSku = `SKU-${Date.now().toString().slice(-6)}-${cleanSeq}`;

    // Format dedicated Stock ID: eg {sr no}-{id}
    const cleanSerial = (data.serialNo || '').trim();
    const stockId = data.stockId?.trim() || (cleanSerial ? `${cleanSerial}-${cleanSeq}` : `STK-${(data.modelNo || 'AC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${cleanSeq}`);

    const item: InventoryItem = {
      id: newSku,
      stockId,
      name: data.name,
      modelNo: data.modelNo,
      type: data.type,
      brand: data.brand,
      serialNo: data.serialNo, // Physical manufacturer barcode / serial number is strictly preserved
      barcode: data.serialNo,
      status: 'AVAILABLE',
      sellingPrice: data.sellingPrice,
      isArchived: false,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'inventory', newSku), item);
      return newSku;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `inventory/${newSku}`);
      return newSku;
    }
  };

  const markInventorySold = async (id: string, invoiceId?: string) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        status: 'SOLD',
        assignedInvoiceId: invoiceId || '',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const archiveInventoryItem = async (id: string, reason?: string) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        status: 'ARCHIVED',
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedReason: reason || 'Product left the store (Delivered & Installed)',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const unarchiveInventoryItem = async (id: string) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        status: 'AVAILABLE',
        isArchived: false,
        archivedAt: deleteField(),
        archivedReason: deleteField(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const deleteInventoryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const updateInventoryItem = async (id: string, data: Partial<InventoryItem>) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  // Shipments & Tracking Updates (Invoice link is optional, tracking updates array)
  const addShipment = async (
    data: {
      customerId: string;
      customerExternalName: string;
      customerPhone: string;
      billingAddress?: string;
      deliveryAddress: string;
      installationAddress: string;
      itemsSummary: string;
      invoiceId?: string;
      invoiceIds?: string[];
      outForDeliveryEnabled?: boolean;
      driverName?: string;
      driverPhone?: string;
      storeContactPhone?: string;
      liveRouteLink?: string;
    },
    customCode?: string
  ): Promise<string> => {
    const newId = await generateUniqueId({
      type: 'D',
      customText: customCode,
      useCustom: !!customCode,
      includeRandomSuffix: false,
    });

    const initialUpdate: TrackingUpdate = {
      id: `TRK-1`,
      timestamp: new Date().toISOString(),
      message: 'Order Placed - Equipment sourcing registered in Lakhi system',
      location: data.deliveryAddress || 'Lakhi Store Premises',
    };

    const initialInvoiceIds = Array.from(
      new Set(
        [
          ...(data.invoiceIds || []),
          data.invoiceId ? data.invoiceId : '',
        ].filter(Boolean)
      )
    );

    const record: Shipment = {
      id: newId,
      invoiceId: initialInvoiceIds[0] || '',
      invoiceIds: initialInvoiceIds,
      customerId: data.customerId,
      customerExternalName: data.customerExternalName,
      customerPhone: data.customerPhone,
      billingAddress: data.billingAddress || '',
      deliveryAddress: data.deliveryAddress,
      installationAddress: data.installationAddress,
      itemsSummary: data.itemsSummary,
      status: 'ORDER_PLACED',
      outForDeliveryEnabled: !!data.outForDeliveryEnabled,
      driverName: data.driverName || '',
      driverPhone: data.driverPhone || '',
      storeContactPhone: data.storeContactPhone || '+91 99980 21446',
      liveRouteLink: data.liveRouteLink || '',
      trackingUpdates: [initialUpdate],
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'shipments', newId), record);
      return newId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shipments/${newId}`);
      return newId;
    }
  };

  const addShipmentTrackingUpdate = async (
    shipmentId: string,
    message: string,
    location?: string,
    customTimestamp?: string
  ) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    const newUpdate: TrackingUpdate = {
      id: `TRK-${Date.now().toString().slice(-4)}`,
      timestamp: customTimestamp ? new Date(customTimestamp).toISOString() : new Date().toISOString(),
      message: message.trim(),
      location: location ? location.trim() : undefined,
    };

    const updatedList = [...(target.trackingUpdates || []), newUpdate];

    try {
      await updateDoc(doc(db, 'shipments', shipmentId), {
        trackingUpdates: updatedList,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shipments/${shipmentId}`);
    }
  };

  const updateShipmentStatus = async (
    shipmentId: string,
    status: Shipment['status'],
    outForDeliveryEnabled?: boolean,
    driverName?: string,
    driverPhone?: string,
    storeContactPhone?: string,
    customMessage?: string,
    location?: string,
    customTimestamp?: string
  ) => {
    try {
      const target = shipments.find((s) => s.id === shipmentId);
      const effectiveDriverName = driverName !== undefined ? driverName : target?.driverName || '';
      const effectiveDriverPhone = driverPhone !== undefined ? driverPhone : target?.driverPhone || '';
      const effectiveStorePhone = storeContactPhone !== undefined ? storeContactPhone : target?.storeContactPhone || '+91 99980 21446';

      const statusLabels: Record<Shipment['status'], string> = {
        ORDER_PLACED: '1. Order Placed - Equipment sourcing registered in Lakhi system',
        ORDER_CONFIRMED: '2. Order Confirmed - Model & inventory reservation verified',
        IN_TRANSIT: '3. In Transit - Equipment dispatched to Lakhi store',
        ARRIVED_AT_STORE: '4. Arrived at Store - Received and quality inspected on store premises',
        OUT_FOR_DELIVERY: `5. Out for Delivery - Dispatched with Driver ${effectiveDriverName || 'Assigned'} ${effectiveDriverPhone ? `(Ph: ${effectiveDriverPhone})` : ''} | Store Helpline: ${effectiveStorePhone}`,
        DELIVERED_INSTALLED: '6. Delivered & Installed - Delivered and setup verified at site',
      };

      const newUpdate: TrackingUpdate = {
        id: `TRK-${Date.now().toString().slice(-4)}`,
        timestamp: customTimestamp ? new Date(customTimestamp).toISOString() : new Date().toISOString(),
        message: customMessage || statusLabels[status] || `Status updated to ${status}`,
        location: location || target?.deliveryAddress || 'Lakhi Store Premises',
      };

      const updates: Partial<Shipment> = {
        status,
        trackingUpdates: [...(target?.trackingUpdates || []), newUpdate],
        updatedAt: new Date().toISOString(),
      };
      if (outForDeliveryEnabled !== undefined) updates.outForDeliveryEnabled = outForDeliveryEnabled;
      if (driverName !== undefined) updates.driverName = driverName;
      if (driverPhone !== undefined) updates.driverPhone = driverPhone;
      if (storeContactPhone !== undefined) updates.storeContactPhone = storeContactPhone;

      await updateDoc(doc(db, 'shipments', shipmentId), updates);

      // Once product leaves the store and is delivered & installed, automatically archive it from active stock
      if (status === 'DELIVERED_INSTALLED') {
        const invoiceIdsToMatch = [target?.invoiceId, ...(target?.invoiceIds || [])].filter(Boolean) as string[];
        const itemsToArchive = inventory.filter((item) => {
          if (item.isArchived || item.status === 'ARCHIVED') return false;
          if (item.assignedInvoiceId && invoiceIdsToMatch.includes(item.assignedInvoiceId)) return true;
          if (target?.itemsSummary && item.serialNo && target.itemsSummary.toLowerCase().includes(item.serialNo.toLowerCase())) return true;
          return false;
        });

        for (const itm of itemsToArchive) {
          try {
            await updateDoc(doc(db, 'inventory', itm.id), {
              status: 'ARCHIVED',
              isArchived: true,
              archivedAt: new Date().toISOString(),
              archivedReason: `Delivered & Installed via Shipment #${shipmentId}`,
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('Could not archive item on delivered & installed:', e);
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shipments/${shipmentId}`);
    }
  };

  const linkInvoicesToShipment = async (shipmentId: string, invoiceIds: string[]) => {
    try {
      const target = shipments.find((s) => s.id === shipmentId);
      const cleaned = Array.from(new Set(invoiceIds.map((id) => id.trim().toUpperCase()).filter(Boolean)));

      const newUpdate: TrackingUpdate = {
        id: `TRK-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        message: cleaned.length > 0
          ? `Linked Invoice(s): ${cleaned.join(', ')}`
          : 'Invoices unlinked from this delivery',
      };

      await updateDoc(doc(db, 'shipments', shipmentId), {
        invoiceId: cleaned[0] || '',
        invoiceIds: cleaned,
        trackingUpdates: [...(target?.trackingUpdates || []), newUpdate],
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shipments/${shipmentId}`);
    }
  };

  const updateShipment = async (id: string, data: Partial<Shipment>) => {
    try {
      await updateDoc(doc(db, 'shipments', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shipments/${id}`);
    }
  };

  // 72-Hour Verification Claims
  const submitVerificationClaim = async (
    customerName: string,
    customerPhone: string,
    notes?: string
  ): Promise<string> => {
    const claimCode = generateClaimCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const claim: VerificationClaim = {
      id: claimCode,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerNotes: notes || '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    try {
      await setDoc(doc(db, 'claims', claimCode), claim);
      return claimCode;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `claims/${claimCode}`);
      return claimCode;
    }
  };

  const approveClaim = async (claimId: string, targetCustomerId?: string) => {
    try {
      await updateDoc(doc(db, 'claims', claimId), {
        status: 'APPROVED',
        matchedCustomerId: targetCustomerId || '',
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser?.email || 'admin',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  };

  const rejectClaim = async (claimId: string) => {
    try {
      await updateDoc(doc(db, 'claims', claimId), {
        status: 'REJECTED',
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser?.email || 'admin',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  };

  const updateGstNumber = async (newGst: string) => {
    try {
      const clean = newGst.trim().toUpperCase();
      await setDoc(
        doc(db, 'system', 'admins'),
        {
          adminUids,
          gstNumber: clean,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.email || 'admin',
        },
        { merge: true }
      );
      setGstNumber(clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system/admins');
    }
  };

  const updateBrandLogos = async (newLogos: Partial<BrandLogos>) => {
    try {
      const merged: BrandLogos = {
        ...brandLogos,
        ...newLogos,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || 'admin',
      };
      if (newLogos.logo1x1 === '') delete merged.logo1x1;
      if (newLogos.logoMain === '') delete merged.logoMain;
      if (newLogos.logoWithWordmark === '') delete merged.logoWithWordmark;

      await setDoc(
        doc(db, 'system', 'admins'),
        {
          logos: merged,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.email || 'admin',
        },
        { merge: true }
      );
      setBrandLogos(merged);
      try {
        localStorage.setItem('lakhi_brand_logos', JSON.stringify(merged));
      } catch (e) {
        console.warn('Failed to cache logos in localStorage', e);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system/admins');
    }
  };

  const resetBrandLogo = async (target: 'logo1x1' | 'logoMain' | 'logoWithWordmark' | 'all') => {
    try {
      let updated: BrandLogos = { ...brandLogos };
      if (target === 'all') {
        updated = {};
      } else {
        delete updated[target];
      }
      updated.updatedAt = new Date().toISOString();
      updated.updatedBy = currentUser?.email || 'admin';

      await setDoc(
        doc(db, 'system', 'admins'),
        {
          logos: updated,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.email || 'admin',
        },
        { merge: true }
      );
      setBrandLogos(updated);
      try {
        localStorage.setItem('lakhi_brand_logos', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to cache logos in localStorage', e);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system/admins');
    }
  };

  const addPayable = async (data: Omit<PayableRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `PAY-${Date.now()}`;
    const newPayable: PayableRecord = {
      ...data,
      id,
      status: data.status || 'PENDING',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'payables', id), newPayable);
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `payables/${id}`);
      throw err;
    }
  };

  const updatePayable = async (id: string, data: Partial<PayableRecord>) => {
    try {
      await updateDoc(doc(db, 'payables', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payables/${id}`);
      throw err;
    }
  };

  const deletePayable = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'payables', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payables/${id}`);
      throw err;
    }
  };

  const settlePayable = async (id: string, mode: PaymentMode, reference?: string) => {
    try {
      await updateDoc(doc(db, 'payables', id), {
        status: 'PAID',
        paidAt: new Date().toISOString(),
        paymentMode: mode,
        paymentReference: reference || '',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payables/${id}`);
      throw err;
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        gstNumber,
        updateGstNumber,
        brandLogos,
        updateBrandLogos,
        resetBrandLogo,
        currentUser,
        isAdmin,
        adminUids,
        addAdminUid,
        removeAdminUid,
        signInWithGoogle,
        logOut,
        viewMode,
        setViewMode,
        activeCustomer,
        loginCustomerById,
        loginCustomerByPhone,
        findCustomerByPhone,
        logoutCustomer,
        linkCustomerAccount,
        changeCustomerPin,
        userLinkedCustomerIds,
        linkCustomerToUserAccount,
        unlinkCustomerFromUserAccount,
        customers,
        quotations,
        invoices,
        inventory,
        shipments,
        transactions,
        claims,
        payables,
        isLoading,
        isFirebaseConnected,
        addCustomer,
        updateCustomer,
        addQuotation,
        updateQuotationStatus,
        updateQuotation,
        addInvoice,
        updateInvoice,
        recordPaymentForInvoice,
        addInventoryItem,
        updateInventoryItem,
        markInventorySold,
        deleteInventoryItem,
        archiveInventoryItem,
        unarchiveInventoryItem,
        addShipment,
        addShipmentTrackingUpdate,
        updateShipmentStatus,
        linkInvoicesToShipment,
        updateShipment,
        submitVerificationClaim,
        approveClaim,
        rejectClaim,
        addPayable,
        updatePayable,
        deletePayable,
        settlePayable,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
