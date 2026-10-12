# Security Specification & Threat Model

## 1. Data Invariants
- Admin operations and staff management can only be conducted by authorized staff or authenticated admin (`mitanshrs@gmail.com`).
- Public customers can view their own orders, invoices, quotations, balance ledger, and delivery tracking via customer credentials (direct ID + PIN, verified Google account, or active verified session).
- 72-hour claims must enforce strict 72-hour lifetime boundaries and prevent tampering with expiry stamps or self-approval.
- Invoice payments must never have negative totals or spoofed balance allocations.
- Inventory indoor and outdoor serial numbers must be recorded without arbitrary field poisoning.
- Completed or archived documents are locked or updated only through explicit archive actions.

## 2. The "Dirty Dozen" Payloads (Adversarial Tests)
1. **Admin Spoofing Payload**: Unauthenticated user trying to write to `/customers` or `/invoices`.
2. **Ghost Field Injection (Shadow Update)**: Updating an invoice with injected `{ "isSuperAdmin": true }`.
3. **Negative Payment Exploitation**: Submitting invoice payment split with `{ "fromBalance": -99999 }`.
4. **Claim Self-Approval**: Customer client attempting to write `{ "status": "APPROVED", "matchedCustomerId": "C123" }` directly to `/claims/{id}`.
5. **72-Hour Expiry Bypass**: Injected claim with `{ "expiresAt": "2099-01-01T00:00:00Z" }`.
6. **Denial of Wallet Document ID Injection**: Attempting to create document with 2000-character random buffer key.
7. **Cross-Customer Invoice Query Scraping**: Customer trying to list or read invoices belonging to another customer ID.
8. **Orphan Serial Tampering**: Modifying assigned indoor/outdoor unit serial numbers after delivery is completed.
9. **Balance Inflation**: Injecting an unverified positive transaction `{ "amount": 500000, "treatment": "ADDED_TO_BALANCE" }` without staff authorization.
10. **Quotation Status Hijacking**: Direct forced state transition to CONVERTED without valid customer linkage.
11. **Shipment Route Injection**: Malicious external actor modifying driver coordinates and delivery milestones.
12. **Archived Document Overwrite**: Attempting to wipe archived invoice payload with empty object.

## 3. Test Runner Coverage (firestore.rules.test.ts)
The rules enforce that all 12 adversarial vectors trigger `PERMISSION_DENIED`.
Unauthenticated writes are blocked across all collections.
Public read of claims is restricted to status verification.
Customer document queries require customer isolation or admin authentication.
