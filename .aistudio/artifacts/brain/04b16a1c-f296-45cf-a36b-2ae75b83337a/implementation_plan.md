# Implementation Plan: Universal Store AI, Customer Copilot, Notification Center, Logo Customization & Bidirectional +91 Phone Matcher

This plan details the end-to-end implementation for the features requested:
1. **Configurable Brand Logos**: Full customization for 1x1 app logo, main logo, and main logo with the word "Lakhi", with live app-wide sync and favicon/PWA manifest support.
2. **Real-Time Updates & In-App Notification Center**: Both browser push notifications and an in-app notification center log for customer updates (invoices, shipments, quotations, payments), with permission prompt and unread highlights.
3. **Session Persistence (Installed App vs Website)**: Indefinite session storage in `localStorage` for installed web apps (PWA / standalone mode) until manual logout, while keeping standard website tab sessions transient.
4. **72-Hour Claim Refresh Persistence**: Persisting active 72-hour claims in storage and Firestore so refreshing the page preserves the active claim state, countdown, and resolution.
5. **Smart Customer Code & Bidirectional Phone Matcher (`+91...` & Raw Resolver)**:
   - Auto-detecting if an input is numeric, code, or a phone number.
   - Extracting the raw core number (stripping `+91`, `91`, leading `0`, spaces, hyphens).
   - Multi-step pattern search: querying `raw`, `+91{raw}`, `+91 {raw}`, `91{raw}`, `0{raw}`, and checking stored phone normalization where `normalize(storedPhone) === raw`.
   - Simultaneous fallback checking against Customer ID / Customer Code.
6. **Customer AI Assistant**: Dedicated in-app copilot for customers to ask questions about their invoices, shipments, deliveries, warranties, quotations, and account balances.
7. **Store AI Universal Copilot**: Full task execution across invoices (edit discounts, create, delete with confirmation), inventory, quotations, shipments, and customer sessions.
8. **Console Error Auditing & Fixes**: Eliminating console warnings and errors.

---

## 1. User Review Required

> [!IMPORTANT]
> - **Irreversible AI Actions**: Per user clarification, the Store AI will present a quick inline confirmation card before executing destructive or high-impact actions (e.g., deleting an invoice, altering discounts, or deleting inventory items).
> - **Push Notifications**: Browser notifications require user permission. An in-app banner will politely prompt users to enable browser notifications; in-app notification badges and the log menu will always work regardless of browser permission.
> - **Installed App Login**: Customer login persistence is tied to `(display-mode: standalone)`. In standalone mode, sessions remain stored indefinitely; in standard browser tabs, sessions do not persist across browser restarts.
> - **Phone Matcher (+91 System)**: Works bidirectionally. Whether the customer enters a raw 10-digit number, `+91...`, `91...`, or `0...`, and whether the customer record in the database was saved with `+91`, `91`, `0`, or raw format, the system finds the exact match.

---

## 2. Proposed Changes

### Component 1: Logo Customization & App-Wide Display
#### Files: `src/context/AppContext.tsx`, `src/components/common/LakhiLogo.tsx`, `src/components/staff/BrandLogoManager.tsx`, `src/components/Header.tsx`
- Ensure `BrandLogos` interface cleanly supports:
  - `logo1x1`: Square 1:1 icon for app shortcuts, mobile home screens, favicon, and compact avatars.
  - `logoMain`: Symbol / emblem mark for headers, cards, and icons.
  - `logoWithWordmark`: Full horizontal logo including the word "Lakhi" (or custom brand title) for main navigation bars, splash screens, and PDF invoice headers.
- Update `LakhiLogo.tsx` to handle all 3 variants (`'1x1' | 'main' | 'wordmark' | 'full'`), falling back gracefully to SVG brand artwork if a custom image is not yet set.
- In `BrandLogoManager.tsx`, provide dedicated upload/URL/preset sections for all three logo types with live preview in mobile, desktop header, and PDF print preview.
- Sync `logo1x1` dynamically to HTML `<link rel="icon">` and `<link rel="apple-touch-icon">`.

---

### Component 2: Session Persistence & 72-Hour Claim Fix
#### Files: `src/context/AppContext.tsx`, `src/components/customer/CustomerPortal.tsx`
- **Installed App Detection**:
  - Implement `isInstalledWebApp()` utility: checks `window.matchMedia('(display-mode: standalone)').matches` or `(window.navigator as any).standalone === true`.
  - When a customer logs in:
    - If running as installed web app: persist `activeCustomer` ID and details into `localStorage` (`lakhi_pwa_customer_session`). Upon app launch, automatically restore the customer session indefinitely until they click Log Out.
    - If running in standard browser tab: store session in `sessionStorage` or component state only, clearing when the browser tab is closed so it does not persist across restarts.
- **72-Hour Claim Persistence Fix**:
  - When a customer generates a 72-hour claim, save the claim record (`claimCode`, `customerId`, `name`, `phone`, `timestamp`) into `localStorage` (`lakhi_active_72h_claim`).
  - On page refresh, check for an existing active claim less than 72 hours old; if present, verify its latest status from Firestore `claims` collection and keep the claim UI active with the code, countdown, and status.
  - When approved or manually dismissed, clear the stored claim.

---

### Component 3: Smart Customer Code & Bidirectional `+91` Phone Matcher
#### Files: `src/utils/phoneMatcher.ts`, `src/context/AppContext.tsx`, `src/components/customer/CustomerPortal.tsx`
- Build a dedicated utility `phoneMatcher.ts` with:
  1. **Raw Extractor**:
     - Strips formatting: spaces, hyphens, parentheses.
     - Strips country prefix `+91`, `91`, and leading `0` to extract the canonical 10-digit `rawNumber`.
     - Example: `"+91 98765-43210"` -> `9876543210`; `"09876543210"` -> `9876543210`; `"919876543210"` -> `9876543210`.
  2. **Candidate Permutations (`___ + raw`)**:
     - `raw`: `${raw}` (e.g. `9876543210`)
     - `plus91`: `+91${raw}` (e.g. `+919876543210`)
     - `plus91Space`: `+91 ${raw}` (e.g. `+91 9876543210`)
     - `ninetyOne`: `91${raw}` (e.g. `919876543210`)
     - `zeroPrefix`: `0${raw}` (e.g. `09876543210`)
  3. **Bidirectional Resolution Algorithm**:
     - Step A: If the input matches a Customer ID format (`LAK-CUST-...` or alphanumeric code), check direct ID / Code match.
     - Step B: Extract `raw` number from input. If valid (e.g. 10 digits):
       - Check if any customer's `phone` or `secondaryPhone` directly equals `raw`.
       - Check if any customer's phone matches candidate prefixes: `+91${raw}`, `+91 ${raw}`, `91${raw}`, `0${raw}`.
       - Check normalized customer phone: extract raw digits of all stored customer phone numbers and match where `extractRawPhone(customer.phone) === raw`.
       - If no direct match in memory, execute Firestore queries against `phone` using `in` filter with `[raw, '+91' + raw, '+91 ' + raw, '91' + raw, '0' + raw]`.
     - Step C: Fallback to searching Customer Code field or PIN.
- Integrate seamlessly into `CustomerPortal.tsx` so users can type their phone number in ANY format (`9876543210`, `+91 9876543210`, `09876543210`) or their Customer ID into the exact same login field.

---

### Component 4: Real-Time Updates & In-App Notification Center
#### Files: `src/types/index.ts`, `src/context/AppContext.tsx`, `src/components/customer/CustomerNotificationsModal.tsx`, `src/components/customer/CustomerPortal.tsx`, `src/utils/notificationService.ts`
- **In-App Notification Center**:
  - Add an Updates / Notifications bell button in the Customer Portal header with an unread badge counter.
  - Clicking opens the **Updates & Notifications Log**:
    - Categorized updates:
      - 📄 **Invoice Added / Modified**: *"Invoice #LAK-INV-102 created for ₹42,500. Balance due: ₹0"*
      - 🚚 **Order & Delivery Updates**: *"Your Daikin 1.5T AC order is Out for Delivery with driver Rajesh (+91 98765...)"*
      - 📝 **Quotation Ready**: *"A new quotation #LAK-QUO-88 was generated for your inquiry"*
      - 💳 **Payment Received**: *"Payment of ₹15,000 received via UPI for Invoice #LAK-INV-102"*
    - Highlight unread notifications with distinct styling (e.g. pulse indicator, subtle colored background).
    - "Mark All as Read" and per-item read status stored in `localStorage` (`lakhi_read_notifications`).
- **Browser Push Notification Suggestion**:
  - Banner in the customer portal: *"Turn on notifications to get instant updates on order dispatch, invoice copies, and service status"*.
  - Clicking "Turn on Notifications" requests browser permission via `Notification.requestPermission()`.
  - When permitted, trigger a native browser `Notification` whenever a new shipment status update, invoice, or quote arrives for the customer.

---

### Component 5: Customer AI Copilot
#### Files: `server.ts`, `src/components/customer/CustomerAiAssistantModal.tsx`, `src/components/customer/CustomerPortal.tsx`
- Create `/api/ai/customer-chat` endpoint in `server.ts` powered by `gemini-3.8-flash`.
- Provide contextual data restricted to the authenticated customer:
  - Active customer profile, name, phone, address.
  - List of invoices, payment balances, outstanding dues.
  - Shipments, delivery stages, driver names, tracking notes.
  - Warranties and serial numbers of purchased units.
  - Store support hotline (+91 99980 21446) and operating hours.
- Customer AI UI:
  - Accessible via a floating "Ask Lakhi AI" button in CustomerPortal.
  - Suggested quick prompts: *"Where is my order right now?"*, *"What is my pending balance?"*, *"Show my AC warranty details"*, *"Send me a copy of my latest invoice"*.
  - Conversational, polite, and accurate customer support in English/Hindi.

---

### Component 6: Store AI Universal Copilot
#### Files: `server.ts`, `src/components/common/AiAssistantDrawer.tsx`
- Expand `/api/ai/chat` tools/actions to support **any** task that can be done on the website:
  1. `EDIT_INVOICE`: Change discount (e.g., change discount from 500 to 1000), update line items, tax, payment status, or notes.
  2. `DELETE_INVOICE`: Delete an invoice (requires confirmation card!).
  3. `CREATE_INVOICE`: Create an invoice with items, discounts, customer details, and stock deduction.
  4. `CREATE_QUOTATION` & `EDIT_QUOTATION`: Create or edit quotations.
  5. `DELETE_QUOTATION`: Delete quotation (with confirmation card!).
  6. `ADD_STOCK` & `DELETE_STOCK`: Add single or batch stock, or delete/mark sold.
  7. `UPDATE_SHIPMENT`: Change delivery stage (e.g. "Mark Mr. Div shipment as Arrived at Store"), assign driver, add tracking notes.
  8. `RECORD_PAYMENT`: Record a payment against an invoice or customer dues.
  9. `LOGIN_CUSTOMER`: Look up and switch/login to a customer account directly via ID or PIN.
  10. `NAVIGATE_TAB`: Switch tabs immediately.
- Confirmation Card UI:
  - For destructive/irreversible actions (`DELETE_INVOICE`, `EDIT_INVOICE`, `DELETE_STOCK`), show an interactive card in the chat: *"Warning: This will change invoice discount to ₹1,000. Confirm execution?"* with **[Confirm]** and **[Cancel]** buttons.

---

### Component 7: Console Errors & Build Verification
#### Files: `src/App.tsx`, `src/components/*`
- Audit and fix console warnings/errors (e.g., missing canvas fallback, unhandled promise rejections, date formatting warnings).
- Run `lint_applet` and `compile_applet`.

---

## 3. Verification Plan

### Automated Verification
- Run `lint_applet` (TypeScript checks) to verify no compilation errors.
- Run `compile_applet` (Vite build) to ensure complete production bundle compilation.

### Manual Verification Walkthrough
1. **Brand Logos**:
   - Open Settings > Brand & Logos. Upload or select a 1x1 app logo, main logo, and logo with "Lakhi". Verify immediate update across Header, Customer Portal, and favicon.
2. **PWA vs Website Session**:
   - Log into Customer Portal in standard browser tab. Refresh page: confirm session behavior matches web rules.
   - Test in standalone mode: verify session is saved indefinitely.
3. **72-Hour Claim Refresh**:
   - Generate a 72-hour claim. Refresh the page: verify the active claim code, timer, and pending approval state remain intact.
4. **Smart Code & Bidirectional Phone Matcher (`+91...` & Raw Resolver)**:
   - Test with:
     - Raw digits: `9876543210`
     - With `+91`: `+919876543210` and `+91 9876543210`
     - With `0`: `09876543210`
     - With `91`: `919876543210`
     - Stored customer in database with `+91` prefix when user enters raw digits, and vice versa.
     - Direct Customer ID: `LAK-CUST-101`.
   - Verify all variants resolve the correct customer instantly.
5. **Notification Center & Push**:
   - Check notification bell in Customer Portal; view invoice and shipment status logs; toggle notification permission; mark unread items as read.
6. **Customer AI**:
   - Ask: *"Where is my order?"* and *"What is my invoice amount?"*; verify accurate responses based on customer data.
7. **Store AI Universal Automation**:
   - Command: *"Change discount on invoice LAK-INV-101 to 1000"* -> verify confirmation prompt and successful execution.
   - Command: *"Mark shipment for Div as arrived at store"* -> verify status update.
