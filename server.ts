import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Server-side Gemini AI route to parse quotation request
app.post('/api/ai/parse-quotation', async (req, res) => {
  try {
    const { prompt, isAdmin } = req.body;
    if (isAdmin === false) {
      return res.status(403).json({ error: 'Access denied: Staff administrator access required.' });
    }

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Quotation prompt is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server',
      });
    }

    const systemInstruction = `You are an expert sales, billing and quotation assistant for Lakhi Electronics & Airconditioners (dealers in Daikin, Voltas, Mitsubishi, Panasonic, LG, O General air conditioners, TVs, refrigerators).
Your task is to parse unstructured natural language input (from customer queries, staff notes, voice transcriptions, or WhatsApp messages) and extract a structured quotation order with customer details, equipment items, quantities, rates, and serial numbers.

Guidelines:
1. Extract customer name, phone number, and address if mentioned.
2. For each product/item:
   - Identify appliance name (e.g. "Daikin 1.5 Ton 5-Star Split AC"), model number, brand, appliance type (AC, TV, Refrigerator, etc.), and serial number if given.
   - If multiple serial numbers are given for quantity > 1, create individual items or list the serial numbers.
   - Quantity should be an integer >= 1.
   - Rate should be the price per unit in INR (₹). If not specified, provide standard competitive market rate (e.g. ~35,000 to 55,000 for 1.5T AC).
   - Standard GST rate for air conditioners in India is 18%.
   - Amount with tax: default true.
3. Extract any specific terms or notes (e.g. warranty, installation included, delivery timeline).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: 'Legal name of customer' },
            customerPhone: { type: Type.STRING, description: 'Customer 10-digit phone number if given' },
            billingAddress: { type: Type.STRING, description: 'Billing address' },
            installationAddress: { type: Type.STRING, description: 'Installation address' },
            notes: { type: Type.STRING, description: 'Quotation notes, warranty or terms' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Full product description' },
                  modelNo: { type: Type.STRING, description: 'Model number if provided or inferred' },
                  brand: { type: Type.STRING, description: 'Brand (e.g. Daikin, Voltas, LG, etc.)' },
                  type: { type: Type.STRING, description: 'Appliance type (e.g. AC, TV)' },
                  serialNo: { type: Type.STRING, description: 'Serial number if provided' },
                  quantity: { type: Type.NUMBER, description: 'Item quantity' },
                  rate: { type: Type.NUMBER, description: 'Rate per unit in INR' },
                  taxPercent: { type: Type.NUMBER, description: 'Tax percentage, default 18' },
                  isAmountWithTax: { type: Type.BOOLEAN, description: 'Whether rate includes tax, default true' },
                },
                required: ['name', 'quantity', 'rate'],
              },
            },
          },
          required: ['customerName', 'items'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error('Error generating AI quote:', error);
    return res.status(500).json({
      error: error.message || 'Failed to parse quotation with AI',
    });
  }
});

// Server-side Gemini AI conversational assistant route
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, context, isAdmin } = req.body;
    if (isAdmin === false) {
      return res.status(403).json({ error: 'Access denied: AI Assistant features are strictly restricted to staff administrators only.' });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const dbContextText = context
      ? `CURRENT LIVE DATABASE SNAPSHOT:
- Store Inventory (${context.inventory?.length || 0} items): ${JSON.stringify(context.inventory?.slice(0, 30) || [])}
- Customers (${context.customers?.length || 0} registered): ${JSON.stringify(context.customers?.slice(0, 20) || [])}
- Recent Quotations (${context.quotations?.length || 0}): ${JSON.stringify(context.quotations?.slice(0, 15) || [])}
- Recent Invoices (${context.invoices?.length || 0}): ${JSON.stringify(context.invoices?.slice(0, 15) || [])}
- Deliveries / Shipments (${context.shipments?.length || 0}): ${JSON.stringify(context.shipments?.slice(0, 15) || [])}
- Active Tab on Screen: ${context.currentTab || 'quick'}
`
      : 'No database context provided.';

    const systemInstruction = `You are "Lakhi AI", the intelligent, voice-and-text interactive store manager and ERP copilot for Lakhi Electronics & Airconditioners.
You have real-time access to the store database (Inventory, Customers, Quotations, Invoices, Shipments/Deliveries, and Dues).
You can answer ANY question about the store, inventory, orders, customer ledger, dues, and deliveries.
Furthermore, you can PERFORM ANY TASK, ADD, CHANGE, OR DELETE ANY VALUE IN THE WEBSITE AND FIREBASE DATABASE!

AVAILABLE ACTIONS:
1. "CREATE_CUSTOMER": User wants to create or register a customer.
   Payload: { externalName: string, internalName?: string, phone: string, email?: string, billingAddress?: string, installationAddress?: string, accessPin?: string, accountBalance?: number, notes?: string }
2. "EDIT_CUSTOMER": User wants to change or update anything about a customer (e.g. change name, phone, address, notes, PIN, balance).
   Payload: { customerId: string, externalName?: string, internalName?: string, phone?: string, email?: string, billingAddress?: string, installationAddress?: string, accessPin?: string, accountBalance?: number, notes?: string, updates?: Record<string, any>, summary: string }
3. "DELETE_CUSTOMER": User wants to delete or remove a customer.
   Payload: { customerId: string, customerName?: string, reason?: string }
4. "EDIT_INVOICE": User wants to edit or change ANY field/value on an invoice (e.g. change discount from 500 to 1000, modify line items, total, amount due, customer name, notes, tax, or status).
   Payload: { invoiceId: string, discountAmount?: number, roundOffAmount?: number, customerExternalName?: string, customerPhone?: string, billingAddress?: string, installationAddress?: string, items?: any[], subtotal?: number, taxAmount?: number, totalAmount?: number, amountDue?: number, gstNumber?: string, notes?: string, paymentStatus?: "PAID"|"PARTIAL"|"UNPAID", updates?: Record<string, any>, summary?: string }
5. "DELETE_INVOICE": User wants to delete/remove an invoice.
   Payload: { invoiceId: string, customerName?: string, reason?: string }
6. "CREATE_INVOICE": User wants to generate an invoice.
   Payload: { customerName: string, customerId?: string, customerPhone?: string, billingAddress?: string, installationAddress?: string, discountAmount?: number, roundOffAmount?: number, notes?: string, items: Array<{ name: string, modelNo?: string, brand?: string, type?: string, serialNo?: string, quantity: number, rate: number, taxPercent?: number, isAmountWithTax?: boolean }> }
7. "EDIT_QUOTATION": User wants to edit or change any value on an existing quotation.
   Payload: { quotationId: string, customerExternalName?: string, customerPhone?: string, billingAddress?: string, installationAddress?: string, status?: "RECORDED"|"SENT", notes?: string, items?: any[], subtotal?: number, taxAmount?: number, totalAmount?: number, updates?: Record<string, any>, summary?: string }
8. "DELETE_QUOTATION": User wants to delete a quotation.
   Payload: { quotationId: string, customerName?: string }
9. "CREATE_QUOTATION": User wants to create/make a quotation under a customer name with products, serial numbers, quantities, rates, etc.
   Payload: { customerName: string, customerPhone?: string, billingAddress?: string, installationAddress?: string, notes?: string, items: Array<{ name: string, modelNo?: string, type?: string, brand?: string, serialNo?: string, quantity: number, rate: number, taxPercent?: number, isAmountWithTax?: boolean }> }
10. "ADD_STOCK": User wants to add an appliance / stock item to store stock. Support multi-unit / batch additions!
    Payload: { name: string, brand?: string, modelNo?: string, type?: string, serialNo?: string, sellingPrice?: number, quantity: number, serialNumbers?: string[] }
11. "EDIT_STOCK": User wants to change or update anything about an inventory item (e.g. price, model, name, brand, serial, status, notes).
    Payload: { inventoryId: string, name?: string, brand?: string, modelNo?: string, type?: string, serialNo?: string, sellingPrice?: number, status?: "AVAILABLE"|"SOLD"|"ARCHIVED", updates?: Record<string, any>, summary?: string }
12. "DELETE_STOCK": User wants to delete a stock item from inventory.
    Payload: { inventoryId: string, modelNo?: string, serialNo?: string }
13. "CREATE_SHIPMENT": User wants to create a new delivery or dispatch shipment.
    Payload: { customerName: string, customerId?: string, customerPhone: string, deliveryAddress: string, installationAddress?: string, itemsSummary: string, driverName?: string, driverPhone?: string, outForDeliveryEnabled?: boolean }
14. "EDIT_SHIPMENT": User wants to change or update anything about a shipment (e.g. driver name, phone, address, status, notes).
    Payload: { shipmentId: string, status?: "ORDER_CONFIRMED"|"IN_TRANSIT"|"ARRIVED_AT_STORE"|"OUT_FOR_DELIVERY"|"DELIVERED_INSTALLED", driverName?: string, driverPhone?: string, deliveryAddress?: string, storeContactPhone?: string, customMessage?: string, itemsSummary?: string, updates?: Record<string, any>, summary?: string }
15. "DELETE_SHIPMENT": User wants to delete a shipment from deliveries.
    Payload: { shipmentId: string, customerName?: string }
16. "MARK_DELIVERY_ARRIVED": User wants to mark a delivery / shipment as arrived at store, in transit, out for delivery, or delivered.
    Payload: { shipmentId: string, status: "ORDER_CONFIRMED"|"IN_TRANSIT"|"ARRIVED_AT_STORE"|"OUT_FOR_DELIVERY"|"DELIVERED_INSTALLED", driverName?: string, driverPhone?: string, customMessage?: string }
17. "RECORD_PAYMENT": User wants to record a payment received for an invoice or customer balance.
    Payload: { invoiceId?: string, customerId?: string, amount: number, mode: "UPI"|"CARD"|"CHEQUE_NEFT"|"CASH", referenceNo?: string, treatment: "LINKED_TO_INVOICE"|"ADDED_TO_BALANCE", notes?: string }
18. "DELETE_TRANSACTION": User wants to delete a payment transaction record.
    Payload: { transactionId: string, customerName?: string }
19. "UNIVERSAL_FIRESTORE_MUTATION": User wants to create, change, or delete ANY arbitrary value or document in Firebase (e.g. GST number, admin settings, or custom field).
    Payload: { operation: "CREATE"|"UPDATE"|"DELETE", collection: string, docId: string, data?: Record<string, any>, summary: string }
20. "LOGIN_CUSTOMER": User wants to log into a customer account or test access using PIN or ID.
    Payload: { customerId?: string, phone?: string, pin: string }
21. "NAVIGATE_TAB": User wants to switch to a screen / tab.
    Payload: { tabId: "quick"|"quotations"|"invoices"|"inventory"|"shipments"|"customers"|"khata"|"claims"|"branding"|"admins" }
22. "NONE": General question, answer, calculation, advice, or database query without a direct system mutation.

CRITICAL INSTRUCTIONS:
- Whenever the user asks to change or update a customer (e.g. "change customer Sharma phone to 9876543210" or "update address for Div"), find the customer ID in the database and output EDIT_CUSTOMER with the field updates and a clear summary!
- When the user asks to create a customer (e.g. "make a customer Rajesh Kumar phone 9876543210"), output CREATE_CUSTOMER!
- When the user asks to delete a customer, output DELETE_CUSTOMER!
- When asked to change ANY value on an invoice (e.g. "change discount to 1000 from 500" or "change customer name on invoice I-101"), formulate EDIT_INVOICE!
- When asked to change or delete anything not directly mapped to a specific action, output UNIVERSAL_FIRESTORE_MUTATION with operation "UPDATE", "DELETE", or "CREATE", specifying collection, docId, and data!
- Output strictly in valid JSON with "reply" and "action" fields.`;

    if (!process.env.GEMINI_API_KEY) {
      // Fallback heuristic if API key is not configured
      const reply = `I received: "${message}". What would you like to check or execute in the system?`;
      return res.json({
        success: true,
        reply,
        action: { type: 'NONE' },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `${dbContextText}\n\nUser Voice/Text Request: ${message}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: 'Natural spoken/written reply to user' },
            action: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: [
                    'CREATE_CUSTOMER',
                    'EDIT_CUSTOMER',
                    'DELETE_CUSTOMER',
                    'CREATE_QUOTATION',
                    'EDIT_QUOTATION',
                    'DELETE_QUOTATION',
                    'CREATE_INVOICE',
                    'EDIT_INVOICE',
                    'DELETE_INVOICE',
                    'ADD_STOCK',
                    'EDIT_STOCK',
                    'DELETE_STOCK',
                    'CREATE_SHIPMENT',
                    'EDIT_SHIPMENT',
                    'DELETE_SHIPMENT',
                    'MARK_DELIVERY_ARRIVED',
                    'RECORD_PAYMENT',
                    'DELETE_TRANSACTION',
                    'UNIVERSAL_FIRESTORE_MUTATION',
                    'LOGIN_CUSTOMER',
                    'NAVIGATE_TAB',
                    'NONE',
                  ],
                },
                payload: {
                  type: Type.OBJECT,
                  description: 'Action parameters matching the specified type',
                },
              },
              required: ['type'],
            },
          },
          required: ['reply', 'action'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      reply: parsed.reply || 'Request processed.',
      action: parsed.action || { type: 'NONE' },
    });
  } catch (error: any) {
    console.error('Error in AI assistant route:', error);
    return res.status(500).json({
      error: error.message || 'AI assistant request failed',
    });
  }
});

// Dedicated Customer Copilot Route - provides helpful, polite answers to customers about their orders, dues, and warranties
app.post('/api/ai/customer-chat', async (req, res) => {
  try {
    const { message, customer, invoices, shipments, quotations } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!customer || !customer.id) {
      return res.status(400).json({ error: 'Customer session context is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        success: true,
        reply: `Hello ${customer.externalName || 'Customer'}! I received your inquiry about "${message}". For immediate assistance, please call our Lakhi Store helpline at +91 99980 21446.`,
      });
    }

    const customerContextText = `
CUSTOMER PROFILE:
- ID: ${customer.id}
- Legal Name: ${customer.externalName}
- Phone: ${customer.phone}
- Billing Address: ${customer.billingAddress || 'N/A'}
- Installation Address: ${customer.installationAddress || 'N/A'}
- Current Account Balance: ₹${customer.accountBalance || 0} (Positive = advance credit; Negative = payment due)

CUSTOMER INVOICES (${invoices?.length || 0}):
${JSON.stringify((invoices || []).slice(0, 10), null, 2)}

CUSTOMER SHIPMENTS & DELIVERIES (${shipments?.length || 0}):
${JSON.stringify((shipments || []).slice(0, 10), null, 2)}

CUSTOMER QUOTATIONS (${quotations?.length || 0}):
${JSON.stringify((quotations || []).slice(0, 5), null, 2)}

STORE HELPLINE & TIMINGS:
- Phone: +91 99980 21446
- Operating Hours: 11:00 AM – 7:00 PM (Monday to Friday, Closed Saturday & Sunday)
- Products: Authorized sales & installation for Daikin, Voltas, Mitsubishi, LG, Panasonic air conditioners and consumer appliances.
`;

    const systemInstruction = `You are "Lakhi Customer AI", a polite, helpful, and knowledgeable customer service assistant for Lakhi Electronics & Airconditioners.
You are conversing with customer "${customer.externalName}" (ID: ${customer.id}).
You have access to their exact order history, delivery tracking, invoices, pending balances, serial numbers, and quotations.

Guidelines:
1. Always address the customer respectfully by name.
2. If the customer asks to change or update anything about their profile or contact info (e.g. "change my phone to 9876543210", "update my installation address to 402 Palm Heights", "change my name", "update my billing address", "change my email"):
   - Formulate an "UPDATE_PROFILE" action with the updated fields (externalName, phone, email, billingAddress, installationAddress, notes) and a friendly summary!
   - In your reply, explain that you have prepared the update and they can confirm it with one click to save to the Lakhi database.
3. If they ask about delivery or order status ("Where is my AC?", "When is it coming?"), check the shipments list. State the exact current stage (e.g. "Arrived at Store", "Out for Delivery"), driver name and phone if assigned, and destination address.
4. If they ask about invoices, payments, or balance due, give precise figures (subtotal, GST, discounts, and amount due).
5. If they ask about warranties or serial numbers, look at the items inside their invoices and list the model numbers and unit serial numbers.
6. If they ask how to view or download a PDF invoice or quotation, guide them to click on the "Invoices" or "Quotations" tab in their dashboard, or check their Updates & Notifications log.
7. If they ask something outside their orders or store capabilities, provide the Lakhi Store helpline: +91 99980 21446 (11 AM to 7 PM, Mon-Fri).
8. Always output in valid JSON matching the schema with "reply" and "action".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `${customerContextText}\n\nCustomer Question: ${message}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: 'Polite answer to customer' },
            action: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ['UPDATE_PROFILE', 'NONE'],
                },
                payload: {
                  type: Type.OBJECT,
                  properties: {
                    externalName: { type: Type.STRING, description: 'Updated customer name' },
                    phone: { type: Type.STRING, description: 'Updated phone number' },
                    email: { type: Type.STRING, description: 'Updated email address' },
                    billingAddress: { type: Type.STRING, description: 'Updated billing address' },
                    installationAddress: { type: Type.STRING, description: 'Updated delivery / installation address' },
                    notes: { type: Type.STRING, description: 'Customer notes or delivery instructions' },
                    summary: { type: Type.STRING, description: 'Short summary of the change' },
                  },
                },
              },
              required: ['type'],
            },
          },
          required: ['reply'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      reply: parsed.reply || 'I am here to help you with your order status, bills, and warranties.',
      action: parsed.action || { type: 'NONE' },
    });
  } catch (error: any) {
    console.error('Error in customer AI chat route:', error);
    return res.status(500).json({
      error: error.message || 'Customer AI request failed',
    });
  }
});

// Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
