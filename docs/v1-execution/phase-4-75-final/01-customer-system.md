# 01 — Customer System

**Customers: ~55% → ~58%.** The detail page (Phase 4.5) is now access-controlled; deeper customer features remain.

## Done (verified)
- **Customer detail page** (Phase 4.5) — `[store]/customers/[email]/page.tsx` + detail/notes proxies + clickable list rows. Profile, order history, addresses, notes (view+add), honest empty states. Real API, no mock data, token-clean, contract-tested.
- **RBAC** (Phase 4.75) — `customers:write` guard on customer create (POST /) + update (PATCH /:email).

## Remaining (UI / needs running stack)
- **Segmentation** — the list "views" (active/has-orders/high-value/new) are still client-side filters; the gateway has real segment CRUD (`/segments`, preview) — a segment-builder UI is unbuilt. (Agent-02 scope; UI.)
- **Customer create UI**, send-email, merge, GDPR export/delete — gateway endpoints exist (`POST /`, `/:email/email`, `/:email/merge`, `DELETE /:email`); no merchant UI.
- **Activity timeline** — `customer_activity_log` exists; the detail page shows an honest empty state (no dedicated read endpoint wired).
- **Server-side list pagination** (currently limit=100).
- DELETE/addresses/segments write RBAC — same guard pattern, not yet wired.

**Verdict:** the highest-value customer surface (detail + notes) is real and now guarded; segmentation + lifecycle actions are the remaining UI, each needing a running stack to verify.
