# 05 — Customers

**Readiness (merchant UI): ~25%.** The list is production-quality; the rest of the rich gateway is unconsumed.

> Note: the prior `04-customers-audit.md` 78% score is the **storefront shopper** experience (registration/login/addresses/wishlist), a different surface. This is the **merchant dashboard**.

## Real
Customer list (7 columns), 5 client-side views, client-side sort, search (→ gateway), filter chips, bulk "copy emails", loading/empty/error states, INR + en-IN.

## Gaps (documented — UI; gateway is rich + ready)
- **No customer detail page** — rows not clickable; `GET /:email` (full profile + order history + addresses) unconsumed. **CRITICAL** (the single biggest gap).
- No timeline (`customer_activity_log` unread), no notes UI (gateway CRUD exists), no merchant address view, no real segmentation (the 5 "views" are client-side placeholders mimicking segments — the gateway `/segments` CRUD is unused).
- No customer create, send-email, merge, GDPR delete/export UI. MEDIUM.
- Hardcoded limit=100 (no server pagination). MEDIUM.

**Verdict:** the bottleneck is exclusively the merchant frontend — the gateway is ready. The highest-value single fix is a `/customers/[email]` detail page (unlocks addresses/notes/history/timeline). Documented as the top remaining item; not built here (UI, needs visual verification).
