# PHASE L11 — ORDERS

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only.

1. **Purpose.** Render order history and order detail through Liquid over the existing order-read APIs.
2. **Repository Reality.** Two engine-agnostic read surfaces: logged-in history `/api/customer/orders` (→ gateway `customer-engagement-routes.ts:1012`) and guest lookup `/api/orders/{check,login,set-password}` (→ `:829-863`). `order-service.ts` is a read/auth wrapper over the gateway (creation/mutation owned by the worker). React `orders/orders-client.tsx` (447) + `account/orders/page.tsx` (228) consume them.
3. **Current State.** Backend complete; React pages; no Liquid order templates.
4. **Target State.** Liquid order-history + `customers/order` (detail) templates over the same APIs (logged-in + guest-lookup).
5. **Files To Modify.** `theme-bundle.ts` (order templates).
6. **Files To Create.** None (backends exist).
7. **Files To Delete.** None — React order pages KEEP-TEMP until L17.
8. **Dependencies.** L10.
9. **Validator Impact.** Schema; `domain-boundary-validator.mjs:250-262` allow-lists the 3 `order-service` importers — reuse, no change.
10. **Migration Impact.** None.
11. **Testing Requirements.** Logged-in history renders real orders; guest lookup (email/phone + password) renders orders; order detail binds line items/totals/status.
12. **Performance Requirements.** Paginate history; dynamic (not ISR); bounded.
13. **Security Requirements.** Logged-in history session-scoped; guest lookup gated by credential verification (`verifyCustomerPassword`) + enumeration-safe; no cross-customer leakage.
14. **Tenancy Requirements.** Orders RLS-governed, scoped by `site_id` + customer/contact.
15. **Identity Requirements.** Customer session for history; guest lookup mints/uses the same HS256 session post-verify.
16. **Money Requirements.** Order totals are **display of already-ledgered** values (read-only); the canonical ledger and refund/payout paths are untouched; no money mutation in render.
17. **Rollback Plan.** Remove order templates → React order pages.
18. **Success Criteria.** A shopper views order history + detail on Liquid pages (logged-in and guest).
19. **Exit Criteria.** Order render + lookup tests green; order parity cells green.
20. **Evidence Requirements.** Rendered order history/detail; guest-lookup trace; binding tests.
