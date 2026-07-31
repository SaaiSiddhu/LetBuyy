# 07 — Inventory Transfers

**Backend status: REAL (reuse, do not rebuild).**

## What already exists
- **Tables** (`000_baseline.sql`, RLS): `inventory_transfers` (transfer_number, source/destination location, status: reserved/shipped/partially_received/received/cancelled, idempotency_key), `inventory_transfer_lines` (qty requested/shipped/received), `inventory_transfer_receipts` (idempotency NOT NULL).
- **RPCs (SECURITY DEFINER):** `create_inventory_transfer_with_lines` (reserves from source, emits transfer_reserved), `ship_inventory_transfer`, `receive_inventory_transfer(_line)` (source debit / destination credit, emits transfer_received; auto-ships if still reserved).
- **Gateway:** `GET/POST /inventory/transfers`, `POST /inventory/transfers/:id/ship`, `POST /inventory/transfers/:id/receive`.

The transfer lifecycle (reserve → ship → receive) is **fully implemented + ledgered** across locations.

## The real gap (exposure — verifiable)
- **Typed api-client:** add `inventory.transfers.{list,create,ship,receive}`.
- **Merchant UI:** replace the transfers stub with a real list + create (source/dest location + line items) + ship + receive actions.

## Implementation spec
api-client `inventory.transfers.*` → proxies `api/stores/[store]/transfers` (+ `/[id]/ship`, `/[id]/receive`) → a Transfers page (list/create/ship/receive). Reuses the locations methods from `03`. Same pattern + verifiability as the PO vertical (`05`). Compile + contract verifiable; flow needs a live DB.

**Verdict:** transfer backend is real + ledgered; Phase-5 delivers the typed client + UI (same proven pattern as Purchase Orders). No new schema. Multi-location is already supported (`inventory_locations`), so transfers are usable the moment 2+ locations exist.
