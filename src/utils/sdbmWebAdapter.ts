// src/utils/sdbmWebAdapter.ts

export interface SdbmWebPayload {
  system: string;
  storeInfo: {
    storeName: string;
    gstNumber: string;
    contactPhone: string;
    baseDate: string;
    schemaVersion: string;
  };
  customers: any[];
  inventory: any[];
  invoices: any[];
  quotations: any[];
  shipments: any[];
  transactions: any[];
}

export class SdbmWebAdapter {
  /**
   * Generates a clean JSON string for AI Studio prompt context or file download
   */
  public static exportToJson(data: Partial<SdbmWebPayload>): string {
    const payload: SdbmWebPayload = {
      system: 'SDBM_v1.0_WEB',
      storeInfo: data.storeInfo || {
        storeName: 'Lakhi Electronics & Airconditioners',
        gstNumber: '24AAIPU5764D1ZI',
        contactPhone: '+91 99980 21446',
        baseDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        schemaVersion: '1.0.0',
      },
      customers: data.customers || [],
      inventory: data.inventory || [],
      invoices: data.invoices || [],
      quotations: data.quotations || [],
      shipments: data.shipments || [],
      transactions: data.transactions || [],
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Generates a standalone web script (.js) that registers the data globally in browser
   */
  public static exportToJs(data: Partial<SdbmWebPayload>): string {
    const jsonStr = this.exportToJson(data);
    return `// SDBM Web Standalone Data Module
(function (global) {
  'use strict';
  const sdbmData = ${jsonStr};
  if (typeof window !== 'undefined') {
    window.SDBM_DATA = sdbmData;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = sdbmData;
  }
})(typeof window !== 'undefined' ? window : this);`;
  }

  /**
   * Triggers a browser native download for .json or .js
   * Prevents premature URL revocation in Chromium / WebKit
   */
  public static downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Ingests JSON text from a web file upload or Gemini/AI Studio response
   * Features robust markdown fence extraction and conversational text stripping
   */
  public static importFromText(rawText: string): SdbmWebPayload {
    let clean = (rawText || '').trim();

    // 1. Extract markdown code fences if present anywhere in the conversational text
    const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      clean = codeBlockMatch[1].trim();
    } else {
      // 2. Fallback: Extract outermost JSON object if raw JSON is mixed with conversational text
      const outerJsonObjectMatch = clean.match(/\{[\s\S]*\}/);
      if (outerJsonObjectMatch) {
        clean = outerJsonObjectMatch[0].trim();
      }
    }

    const parsed = JSON.parse(clean);
    const root = parsed.data || parsed;

    return {
      system: root.system || 'SDBM_v1.0_WEB',
      storeInfo: root.storeInfo || root.companyInfo || root.company || {
        storeName: 'Lakhi Electronics & Airconditioners',
        gstNumber: '24AAIPU5764D1ZI',
        contactPhone: '+91 99980 21446',
        baseDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        schemaVersion: '1.0.0',
      },
      customers: Array.isArray(root.customers)
        ? root.customers
        : Array.isArray(root.debtors)
        ? root.debtors
        : [],
      inventory: Array.isArray(root.inventory)
        ? root.inventory
        : Array.isArray(root.stock)
        ? root.stock
        : Array.isArray(root.storeStock)
        ? root.storeStock
        : [],
      invoices: Array.isArray(root.invoices)
        ? root.invoices
        : Array.isArray(root.bills)
        ? root.bills
        : [],
      quotations: Array.isArray(root.quotations)
        ? root.quotations
        : Array.isArray(root.quotes)
        ? root.quotes
        : [],
      shipments: Array.isArray(root.shipments)
        ? root.shipments
        : Array.isArray(root.deliveries)
        ? root.deliveries
        : Array.isArray(root.div)
        ? root.div
        : [],
      transactions: Array.isArray(root.transactions)
        ? root.transactions
        : Array.isArray(root.receipts)
        ? root.receipts
        : Array.isArray(root.inflows)
        ? root.inflows
        : [],
    };
  }
}

export const SDBM_BLUEPRINT_SAMPLE: SdbmWebPayload = {
  system: 'SDBM_v1.0_WEB',
  storeInfo: {
    storeName: 'Lakhi Electronics & Airconditioners',
    gstNumber: '24AAIPU5764D1ZI',
    contactPhone: '+91 99980 21446',
    baseDate: '20261104',
    schemaVersion: '1.0.0',
  },
  customers: [
    {
      id: 'C202611041001',
      externalName: 'Rajesh Kumar',
      internalName: 'Rajesh Kumar (Satellite VIP)',
      phone: '+91 98250 12345',
      email: 'rajesh@example.com',
      billingAddress: '102 Sunrise Towers, Satellite, Ahmedabad',
      installationAddress: 'Same as billing address',
      accessPin: '4102',
      accountBalance: 0.00,
      createdAt: '2026-11-04T10:00:00Z',
    },
  ],
  inventory: [
    {
      id: 'STK202611041001',
      brand: 'DAIKIN',
      name: 'Daikin 1.5 Ton 5-Star Inverter Split AC',
      modelNo: 'FTKF50TV',
      indoorModelNo: 'FTKF50TV-IDU',
      outdoorModelNo: 'RKF50TV-ODU',
      indoorUnitSerial: 'IDU-DAI-982144',
      outdoorUnitSerial: 'ODU-DAI-102938',
      tonnage: 1.5,
      applianceType: 'AC',
      sellingPrice: 45500.00,
      quantity: 1,
      location: 'STORE_GODOWN',
      status: 'AVAILABLE',
      createdAt: '2026-11-04T10:00:00Z',
    },
  ],
  invoices: [
    {
      id: 'I202611041001',
      customBillId: 'INV-1001',
      customerId: 'C202611041001',
      customerExternalName: 'Rajesh Kumar',
      customerPhone: '+91 98250 12345',
      items: [
        {
          name: 'Daikin 1.5 Ton 5-Star Inverter Split AC',
          modelNo: 'FTKF50TV',
          indoorUnitSerial: 'IDU-DAI-982144',
          outdoorUnitSerial: 'ODU-DAI-102938',
          quantity: 1,
          rate: 38559.32,
          taxPercent: 18,
          lineTotal: 45500.00,
        },
      ],
      subtotal: 38559.32,
      taxAmount: 6940.68,
      discountAmount: 0.00,
      roundOffAmount: 0.00,
      totalAmount: 45500.00,
      prepaidSplits: {
        fromBalance: 0.00,
        upi: { amount: 45500.00, receivingBank: 'HDFC Bank', utr: 'UTR-9812739182' },
        card: { amount: 0.00, authId: '' },
        cash: { amount: 0.00 },
      },
      totalPrepaid: 45500.00,
      amountDue: 0.00,
      paymentStatus: 'PAID',
      createdAt: '2026-11-04T10:00:00Z',
    },
  ],
  quotations: [],
  shipments: [],
  transactions: [],
};
