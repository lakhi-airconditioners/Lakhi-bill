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
Furthermore, you can PERFORM ACTIONS directly on the system. When the user asks to create a quotation, invoice, add stock, mark a delivery as arrived, navigate, or lookup something, formulate the structured action payload!

AVAILABLE ACTIONS:
1. "CREATE_QUOTATION": User wants to create/make a quotation under a customer name with products, serial numbers, quantities, rates, etc.
   Payload must include customerName, optional customerPhone, billingAddress, installationAddress, notes, and items array (each with name, modelNo, type, brand, serialNo, quantity, rate, taxPercent, isAmountWithTax).
2. "CREATE_INVOICE": User wants to generate an invoice.
   Payload includes customerName, customerPhone, items array (with serial numbers), etc.
3. "ADD_STOCK": User wants to add an appliance / stock item to store stock. Support multi-unit / batch additions!
   Payload: { name, brand, modelNo, type, serialNo, sellingPrice, quantity: number, serialNumbers: string[] }
   If the user asks to add multiple units (e.g., "Add 3 Voltas 1.5T ACs to stock" or "Add 3 units of model FTKF50"), set quantity: 3. If they specify serial numbers (e.g. "serials VOL-01, VOL-02, VOL-03"), set serialNumbers: ["VOL-01", "VOL-02", "VOL-03"]. If serials are not specified, set serialNumbers to empty array (the system will auto-generate them).
4. "MARK_DELIVERY_ARRIVED": User wants to mark a delivery / shipment as arrived at store or delivered.
   Payload: { shipmentId, status: "ARRIVED_AT_STORE" | "DELIVERED_INSTALLED" }
5. "NAVIGATE_TAB": User wants to switch to a screen / tab.
   Payload: { tabId: "quick" | "quotations" | "invoices" | "inventory" | "shipments" | "customers" | "khata" | "claims" }
6. "NONE": General question, answer, calculation, advice, or database query without a direct system mutation.

CRITICAL INSTRUCTIONS:
- When answering queries about stock or deliveries, cite specific model numbers, serial numbers, customer names, or tracking numbers from the database snapshot.
- For quotation creation, extract every product detail and serial number carefully. If the user mentions multiple serial numbers, assign them properly.
- Keep the natural response concise, professional, friendly, and helpful. Mention that you prepared the details and will show them for confirmation.
- Output strictly in valid JSON with "reply" and "action" fields.`;

    if (!process.env.GEMINI_API_KEY) {
      // Fallback heuristic if API key is not configured
      const reply = `I received: "${message}". What would you like to check or create in the system?`;
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
                    'CREATE_QUOTATION',
                    'CREATE_INVOICE',
                    'ADD_STOCK',
                    'MARK_DELIVERY_ARRIVED',
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
