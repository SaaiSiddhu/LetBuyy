# 03 — Warehouses / Locations

**Backend status: REAL.** The location model IS the warehouse abstraction (no separate `warehouses` table needed — building one would duplicate).

## What already exists
- **Table:** `inventory_locations` (`000_baseline.sql` L9584) — `store_id`, `name`, `address` jsonb, `is_default`, `status`, RLS GUC policy. Multi-location stock via `inventory_levels.location_id → inventory_locations.id`.
- **RPCs:** `ensure_default_inventory_location(store_id)`, `ensure_inventory_level_for_location(...)`.
- **Gateway:** `GET /inventory/locations`, `POST /inventory/locations`.

## The real gap (exposure — verifiable)
- **Typed api-client:** no `locations` methods. Add `inventory.locations.{list,create}` (also needed by the PO + transfer forms — reused).
- **Merchant UI:** no locations management page. Build a locations list + create (name/address/default) under products/inventory or settings.

## Implementation spec
api-client `inventory.locations.{list,create}` → proxy `api/stores/[store]/inventory-locations` → a Locations management view. Stock-per-location is already in `inventory_levels` (surface it on the inventory page filtered by location). Compile + contract verifiable.

**Decision:** keep the **location = warehouse** model. Do NOT introduce a separate `warehouses` table (duplicate-system risk; the mission forbids it). If true multi-warehouse hierarchy is ever needed, that is a V2 schema decision requiring ARB.

**Verdict:** warehouse/location backend is real; Phase-5 delivers the typed client + a locations UI. No new schema.
