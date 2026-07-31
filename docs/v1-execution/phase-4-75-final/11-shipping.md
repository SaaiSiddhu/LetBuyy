# 11 — Shipping

**Shipping: ~78% → ~80%.** Rate CRUD is now both fully proxied (Phase 4.5) and RBAC-enforced (Phase 4.75).

## Done (verified)
- **Rate-edit PATCH proxy** (Phase 4.5) — `api/stores/[store]/shipping/rates/[rateId]` PATCH → `shipping.rates.update` (was DELETE-only → couldn't edit).
- **RBAC enforcement** (Phase 4.75) — `shipping:write` guard on POST/PATCH/DELETE `/shipping` rate routes (dry-run-safe).
- Zones CRUD + rate add/delete + server-authoritative `resolveShippingRate` (LB-7) — real, from prior phases.

## Remaining (UI + V1.1)
- **Rate-edit UI button + non-flat rate types** — the UI still hardcodes `type:'flat'`; the schema + proxy support weight/price-based/free. Frontend work (needs visual verification).
- **Zone PATCH/DELETE RBAC** + tax-rate RBAC — same one-line guard pattern, not yet wired.
- Shipping profiles + serviceability/pincode UI — tables exist, no UI (V1.1).
- Live carrier (Shiprocket) — correctly hard-blocked by design (CAP-C16 / V1.1).

**Verdict:** flat-rate zone shipping is launch-functional, now edit-capable + access-controlled at the API layer; non-flat UI + zone/tax RBAC are clean follow-ups.
