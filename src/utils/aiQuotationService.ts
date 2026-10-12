import { QuotationItem, Customer } from '../types';

export interface AiParsedQuotationDraft {
  customerName: string;
  customerPhone?: string;
  billingAddress?: string;
  installationAddress?: string;
  notes?: string;
  items: Array<{
    name: string;
    modelNo?: string;
    type?: string;
    brand?: string;
    serialNo?: string;
    quantity: number;
    rate: number;
    taxPercent: number;
    isAmountWithTax: boolean;
  }>;
}

// Client-side parser fallback in case backend is offline or API key is pending
function fallbackHeuristicParse(prompt: string): AiParsedQuotationDraft {
  const text = prompt.trim();

  // Try to match customer name
  let customerName = 'Direct Customer';
  const nameMatch =
    text.match(/(?:for|to|customer|name|client)[:\s]+([A-Za-z\s]+?)(?:,|\.|\n|phone|mobile|address|\d)/i) ||
    text.match(/^([A-Za-z\s]{3,25})(?:,|\n|\s*\d)/);
  if (nameMatch && nameMatch[1].trim()) {
    customerName = nameMatch[1].trim();
  }

  // Phone number
  let customerPhone = '';
  const phoneMatch = text.match(/(?:\+?91[\s-]?)?([6-9]\d{9})/);
  if (phoneMatch) {
    customerPhone = phoneMatch[1];
  }

  // Address
  let billingAddress = '';
  const addrMatch = text.match(/(?:address|addr|at|location)[:\s]+([^,\n]+)/i);
  if (addrMatch) {
    billingAddress = addrMatch[1].trim();
  }

  // Notes
  let notes = 'Standard Lakhi Electronics & Airconditioners terms apply. 1-year product warranty.';
  const notesMatch = text.match(/(?:note|notes|warranty|terms)[:\s]+([^.\n]+)/i);
  if (notesMatch) {
    notes = notesMatch[1].trim();
  }

  // Extract products
  const items: AiParsedQuotationDraft['items'] = [];

  // Look for brand mentions or AC mentions
  const lines = text.split(/[\n,;]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line looks like an item
    const isItemLine =
      /(daikin|voltas|hitachi|panasonic|lg|carrier|samsung|mitsubishi|lloyd|o general|split|inverter|ac|ton|star)/i.test(
        trimmed
      );

    if (isItemLine) {
      // Quantity
      const qtyMatch = trimmed.match(/(\d+)\s*(?:x|units?|pcs?|nos?|sets?)/i) || trimmed.match(/^(?:qty|quantity)[:\s]*(\d+)/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

      // Rate / Price
      const rateMatch =
        trimmed.match(/(?:₹|rs\.?|inr|rate|price|@)\s*([\d,]+)/i) ||
        trimmed.match(/(\d{4,6})/);
      let rate = 45000;
      if (rateMatch) {
        const parsedRate = parseInt(rateMatch[1].replace(/,/g, ''), 10);
        if (parsedRate > 1000) rate = parsedRate;
      }

      // Model
      const modelMatch = trimmed.match(/(?:model|no\.?)[:\s]*([A-Z0-9-]{5,15})/i) || trimmed.match(/([A-Z]{3,4}\d{2,4}[A-Z0-9]*)/i);
      const modelNo = modelMatch ? modelMatch[1] : 'INVERTER-SERIES';

      // Serial
      const snMatch = trimmed.match(/(?:sn|serial|sno)[:\s]*([A-Z0-9-]+)/i);
      const serialNo = snMatch ? snMatch[1] : '';

      // Brand
      let brand = 'Daikin';
      if (/voltas/i.test(trimmed)) brand = 'Voltas';
      else if (/panasonic/i.test(trimmed)) brand = 'Panasonic';
      else if (/mitsubishi/i.test(trimmed)) brand = 'Mitsubishi';
      else if (/lg/i.test(trimmed)) brand = 'LG';
      else if (/hitachi/i.test(trimmed)) brand = 'Hitachi';
      else if (/samsung/i.test(trimmed)) brand = 'Samsung';
      else if (/carrier/i.test(trimmed)) brand = 'Carrier';

      items.push({
        name: trimmed.replace(/₹[\d,]+/g, '').replace(/@\s*[\d,]+/g, '').trim() || `${brand} 1.5 Ton Split AC`,
        modelNo,
        brand,
        type: 'AC',
        serialNo,
        quantity,
        rate,
        taxPercent: 18,
        isAmountWithTax: true,
      });
    }
  }

  // If no items extracted, create a default parsed item from the text
  if (items.length === 0) {
    items.push({
      name: text.length > 50 ? text.slice(0, 50) + '...' : text,
      modelNo: 'FTKF50TV',
      brand: 'Daikin',
      type: 'AC',
      serialNo: '',
      quantity: 1,
      rate: 45000,
      taxPercent: 18,
      isAmountWithTax: true,
    });
  }

  return {
    customerName,
    customerPhone,
    billingAddress,
    installationAddress: billingAddress,
    notes,
    items,
  };
}

export async function parseQuotationWithAi(prompt: string, isAdmin: boolean = true): Promise<AiParsedQuotationDraft> {
  try {
    const res = await fetch('/api/ai/parse-quotation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, isAdmin }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        return data.data as AiParsedQuotationDraft;
      }
    }
  } catch (err) {
    console.warn('Backend AI quote endpoint failed or unreachable, using smart parser fallback:', err);
  }

  // Fallback if backend API call failed or returns error
  return fallbackHeuristicParse(prompt);
}
