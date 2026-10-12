# Implementation Plan: Multi-Unit / Batch Stock Ingestion & Duplication

Enable staff administrators to add the same product multiple times (e.g., 3 units of the same AC model) into Store Stock via:
1. **Batch Quantity Input** in the Add Stock form with individual or auto-generated serial numbers.
2. **One-Click Duplicate / Clone** button directly on items in the Store Stock table.
3. **Lakhi AI Voice & Text Command** support to add multiple units in a single natural language request.

---

## 1. User Review & Answer Summary

Based on your clarification:
- **Mode of adding**: Enable **all** options (Add Stock form quantity field, Table Duplicate/Clone button, and Lakhi AI voice/typing).
- **Serial Number Handling**: Support entering individual serial numbers for each unit OR one-click auto-generating sequential serial numbers (e.g. `DKN-FTKF-01`, `DKN-FTKF-02`, `DKN-FTKF-03`).

---

## 2. Proposed Architectural Changes

### A. Store Stock Modal (`InventoryGodown.tsx`)
- Add a **Quantity** counter (`1` to `50`, default `1`) to the "Add Stock Item" modal.
- When `Quantity > 1`:
  - Show a dynamic serial number grid with an input for each unit ($1 \dots N$).
  - Provide an **"⚡ Auto-generate Sequential Serials"** button that automatically fills formatted serial numbers based on Brand, Model, and timestamp sequence.
  - Provide a **"Paste Comma / Line-separated Serials"** quick paste area for barcode scanner batch input.
- In `handleAddStock`: loop over the $N$ items and batch create them in Firestore / `addInventoryItem`.

### B. Table Quick Duplicate / Clone (`InventoryGodown.tsx`)
- In each row of the Store Stock table (next to Edit, QR Label, and Bill), add a **Copy / Duplicate** action button (`Copy` icon).
- Clicking it opens a quick modal:
  - Pre-fills the Product Name, Model, Brand, Type, and Selling Price.
  - Lets staff choose quantity to create (e.g. `1`, `2`, `3` more units).
  - Prompts for or auto-generates the new serial numbers.
  - Confirms and immediately creates the cloned stock units.

### C. Lakhi AI Multi-Unit Command Support (`server.ts` & `AiAssistantDrawer.tsx`)
- Update `ADD_STOCK` action schema in `server.ts` to support optional `quantity: number` and `serialNumbers: string[]`.
- In `AiAssistantDrawer.tsx`:
  - Update `ADD_STOCK` execution handler to loop and create all units if `quantity > 1` or if multiple serials are supplied.
  - Display the batch items and their serials inside the interactive in-chat action card before staff confirms.

---

## 3. Verification Plan

1. **Batch Add Modal Test**:
   - Open Add Stock in Store Stock tab. Set Quantity = 3.
   - Test "⚡ Auto-generate Serials" and verify 3 distinct serials are populated.
   - Submit and verify 3 individual available stock items appear in the table.
2. **Duplicate Button Test**:
   - Click "Duplicate" on an existing Daikin AC in the table.
   - Choose 2 additional units, confirm, and verify 2 new units are added to available stock with their own serials.
3. **Lakhi AI Batch Test**:
   - In Lakhi AI chat/mic, say: *"Add 3 Voltas 1.5T ACs model 185V to stock at 38000 each with serials VOL-01, VOL-02, VOL-03"*.
   - Confirm the action card in chat and verify all 3 units appear in store inventory.
4. **Build & Typecheck**:
   - Run `lint_applet` and `compile_applet` to ensure zero compilation or TypeScript errors.
