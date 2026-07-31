# 04 — Vendors / Suppliers

**Backend status: REAL.**

## What already exists
- **Table:** `suppliers` (`000_baseline.sql` L12460) — `site_id`, `name`, `contact_name`, `email`, `phone`, `address` jsonb, `status`, `metadata`; RLS enabled. (Contacts are flat columns — no separate `supplier_contacts` table; do not add one unless a real multi-contact need is confirmed.)
- **Gateway:** `GET /inventory/suppliers`, `POST /inventory/suppliers`. `create_purchase_order_with_lines` validates `supplier_id` against this table.

## The real gap (exposure — verifiable)
- **Typed api-client:** no `suppliers` methods. Add `inventory.suppliers.{list,create}` (also consumed by the PO create form — being added in the PO vertical this phase).
- **Merchant UI:** no vendor management page. Build a vendors list + create/edit (name/contact/email/phone/address).

## Implementation spec
api-client `inventory.suppliers.{list,create}` (+ `update` if the gateway gains a PATCH) → proxy `api/stores/[store]/suppliers` → a Vendors page. Compile + contract verifiable.

**Verdict:** supplier backend is real; Phase-5 delivers the typed client + a vendors UI. No new schema. (An `update`/`delete` gateway verb would be a small additive follow-up if merchants need vendor editing.)
