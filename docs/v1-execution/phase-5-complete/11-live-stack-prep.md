# 11 — Live-Stack Preparation

**Purpose:** make every compile/contract/unit-verified vertical *flow-verifiable* the moment a staging stack exists. **No fabricated runtime results** — this is tooling + procedure, not claimed outcomes.

## The verification gap (honest)
Everything in Phases 5 → 5-complete is **compile + contract + unit** verified (the smart-collection + automation + audit evaluators are unit-proven). What is NOT verified, because there is no database/gateway here:
- Gateway routes actually receiving auth/JWT + hitting Supabase under RLS.
- The create→ship→receive→inventory-level round-trips (PO, transfers).
- Smart-collection preview matching real products; analytics aggregates returning real numbers.
- The 30 RBAC guards actually 403-ing a viewer in `enforce` mode.

## Staging bring-up procedure
1. `pnpm dev` with `services/api-gateway` on `:9010` + Supabase creds (the merchant app proxies require the gateway — see [[gateway-not-in-pnpm-dev]]).
2. Apply all migrations incl. any new ones (audit/automation are NOT yet authored as migrations — they are blueprints in `01`/`03` pending ARB).
3. Seed: one store + a few products/variants + ≥2 inventory locations + one supplier (so PO/transfer/smart-collection/analytics have data).

## Verification matrix to run on staging (per vertical)
- **PO:** create PO → receive (partial) → assert `inventory_levels` rose + `inventory_events` (po_received) emitted.
- **Transfer:** create → ship → receive → assert source debit / destination credit + events.
- **Smart collection:** create a rule → preview → assert matching product count is correct vs a manual query.
- **Reservations/receipts:** assert the explorers list real rows; analytics KPIs match manual `COUNT`s.
- **RBAC:** set `MERCHANT_STAFF_RBAC_MODE=enforce`; assert a viewer-role staff is 403'd on a write, a manager allowed, the owner always passes — then inspect `staff_rbac_decision` logs.
- **Payment toggles:** flip COD off → assert `sites.cod_enabled=false` persisted + checkout reflects it.

## Tooling to add (when staging exists)
- A `scripts/verify-commerce-live.mjs` smoke script that, given a base URL + a merchant session, probes each commerce proxy and asserts a 2xx + shape (skeleton specced; not authored unrun here to avoid shipping never-executed "verification" code).
- Seed SQL fixtures under `tests/fixtures/commerce/` for deterministic staging data.

**Verdict:** the verification procedure + matrix are defined; running them is the post-freeze step that converts compile/contract/unit verification into flow verification. Nothing here claims a runtime result that was not produced.
