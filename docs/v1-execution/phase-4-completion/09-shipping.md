# 09 — Shipping Settings

**Readiness: ~75% UI / ~90% gateway.** LB-7 (server-resolved rates) confirmed present.

## Real
Zones CRUD (create/edit/delete), rate add/delete (`handleAddRate`/`handleDeleteRate` — LB-7, confirmed real `fetch` calls), server-authoritative `resolveShippingRate`, 4 rate types in the schema, api-client shipping namespace.

## Gaps (documented)
- **Rate edit (update price/name): no PATCH proxy** at `shipping/rates/[rateId]` (DELETE-only) — gateway PATCH exists. P1 (clean proxy add, like the collections fix).
- UI hardcodes `type: 'flat'` — can't create weight/price-based/free rates from the UI (schema supports all 4). P1.
- Shipping profiles + serviceability/pincode rules: tables exist, no UI/route. P2 (V1.1).
- **Live carrier (Shiprocket): hard-blocked by design** (`liveLogisticsProviderAvailable()=false`) — CAP-C16 / V1.1, not a V1 blocker.
- Zone country field is free-text (no ISO validation). P2.

**Verdict:** flat-rate zone shipping is launch-functional; rate-edit proxy + non-flat rate types are clean code adds; live carrier is correctly deferred.
