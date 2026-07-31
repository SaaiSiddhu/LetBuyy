# 05 — Known Gaps (carried into Phase 5)

Consolidated from `phase-4-completion/15`, `phase-4-5-completion/05`, `phase-4-75-final/13`. These are the authoritative open items at lock time. **None is a Phase-4 regression** — they are unbuilt scope or inherited WIP.

## A. Cannot be closed in this environment (no running authenticated stack)
- **Flow/visual verification of every merchant UI page** (new + existing). All Phase-4.x UI is compile + contract verified, never flow-verified. This is the dominant cap on "completion."
- **Enable staff-RBAC enforcement** — flip `MERCHANT_STAFF_RBAC_MODE=enforce` only after dry-run logs confirm owners pass + the right staff are gated against a real staff session. **The RBAC gap is not fully closed until this flip.**

## B. Needs net-new backend/schema (would be fabrication to build blind)
- Purchase Orders, Inventory Transfers, Inventory history/reservations ledger (need PO/transfer/movement tables + RPCs; multi-location is likely V1.1).
- Smart-collection rule engine (conditions evaluation backend + rule-builder UI).
- Settings: email/notification persistence, functional payment-method toggles (need confirmed write paths).

## C. UI follow-ups (live-stack-gated, confirmed backends)
- Orders: timeline/events, returns UI, risk context, tags.
- Customers: create/merge/GDPR UI; segment-filtered customer list (`?segment=` wiring); activity timeline read endpoint.
- Collections: edit/delete buttons (proxy exists).
- Shipping: non-flat rate-type UI; zone/tax RBAC wiring.
- Marketing: abandoned-cart detection worker; SEO/redirect dashboards; campaign edit flow.
- RBAC: broaden enforcement to secondary writes (drafts, addresses, segments, taxes, zones, settings, inventory, domains, analytics) + invite-acceptance page.
- UX: coupons mobile `<table>` (the one functional mobile regression).

## D. Deploy seams (human, not code) — H2/H3 (domains DNS/SSL/Vercel), H6 (Resend email/SPF-DKIM-DMARC).

## E. Inherited repo-wide WIP (NOT Phase-4 merchant; tracked, non-blocking for this lock)
- **tenant-isolation** 🔴 — `tenant-tables.registry.ts` drift; fix = run `scripts/generators/generate-tenant-table-registry.mjs` (driven by parallel-workstream schema, not merchant code).
- **design-system** 🔴 — cross-app CSS drift (marketing-site/identity/shared); Phase-4 app pages added 0 new.
- **Gateway unit suite** 3 pre-existing fails (AI route, analytics migration RLS, storefront payment route).
- Pending parallel-workstream migrations (`04`).

**Priority for Phase 5:** stand up a staging merchant stack (unblocks A + C verification + the RBAC enforce flip), then resolve E (a registry regen + a CSS drift sweep), then tackle B by confirmed-scope.
