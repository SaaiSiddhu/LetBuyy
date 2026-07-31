# 02 — Warehouses / Locations

**Exposure: ~30% → ~70%.** Location management UI shipped over the existing `inventory_locations` backend.

## Shipped this phase (verified)
- **Locations page** `[store]/products/locations/page.tsx` (360 lines) — list (name + city/state from address jsonb, default badge, status) + create modal (name + address + `is_default` switch, auto-checked when no locations exist). Consumes the existing `/api/stores/[store]/inventory-locations` proxy (`inventory.locations.{list,create}`). Loading/empty/error, token-clean. **Nav-linked** (Products → Locations).

## Design decision (reuse, don't duplicate)
Location IS the warehouse abstraction — no separate `warehouses` table was created. Multi-location stock is `inventory_levels.location_id`.

## Remaining (exposure)
- Per-location stock view (filter `inventory_levels` by location), location detail/metrics, edit/delete (gateway has no PATCH/DELETE for locations yet — additive follow-up).

**Verdict:** merchants can now create + view stock locations; per-location inventory + edit are exposure follow-ups. No new schema.
