# 03 — Suppliers / Vendors

**Exposure: ~35% → ~65%.** Vendor management UI shipped over the existing `suppliers` backend.

## Shipped this phase (verified)
- **Vendors page** `[store]/products/suppliers/page.tsx` (372 lines) — list (name + city/state, contact, email mailto, phone, status) + create modal (name + contact/email/phone/address). Consumes the existing `/api/stores/[store]/suppliers` proxy (`inventory.suppliers.{list,create}`). Loading/empty/error, token-clean. **Nav-linked** (Products → Vendors).

## Remaining (exposure)
- Supplier detail page, edit/delete (gateway has no PATCH/DELETE for suppliers — additive follow-up), supplier-linked PO history (the PO create form already references suppliers), metrics.

**Verdict:** merchants can now create + view vendors and select them on POs; detail/edit are exposure follow-ups. No new schema (contacts remain flat columns — no `supplier_contacts` duplicate created).
