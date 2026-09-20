# LetBuyy Unified Commerce — Guidance Handoff

- **Date:** 2026-09-19 · **For:** any engineer or AI advisor guiding the founder without access to the audit conversation.
- **Main report:** [`LETBUYY_UNIFIED_COMMERCE_CURRENT_STATE_AND_GAP_REPORT.md`](./LETBUYY_UNIFIED_COMMERCE_CURRENT_STATE_AND_GAP_REPORT.md) (section numbers below refer to it).
- **Snapshot audited:** LetBuyy `develop` = `bda7f7f8` (2026-09-12) in the `LetBuyy-develop` worktree; the workspace checkout `Projects/Start_Up/LetBuyy` is a stale branch at `823aa5ee`, 611 commits behind. Agrimore = `Projects/Start_Up/Agrimore_Supabase`, branch `foundation-rebuild` @ `6a33bf8`, with a large uncommitted cleanup in flight. File:line references resolve against those SHAs.
- Prepared as a single-agent session (no subagents, no delegation). Nothing was implemented, deployed, committed or pushed; no secret values appear here.

---

## 1. What the founder intends to build

One platform (working name "Letbuyy Store", not a confirmed legal or product name) combining LetBuyy and Agrimore:

1. Ecommerce **store builder** (merchant-branded storefronts).
2. Ecommerce **marketplace** (cross-merchant discovery and purchase).
3. **Quick commerce** (local rapid delivery).
4. **One merchant application** (catalogue, locations, channel participation, stock, orders, finances).
5. **Store operations** (receiving, stock handling, pick, pack, stage, handover).
6. **Rider delivery** (assignments, acceptance, pickup, tracking, proof, earnings).
7. **Adaptive POS** — **not started anywhere**; new development. Native Windows (C#/.NET/WinUI 3) and macOS (Swift/SwiftUI/AppKit) for POS and Admin; Flutter for mobile.
8. Central administration and **Sales Associate** workflows where justified.

Same customer across marketplace and quick commerce; same merchant across storefront, marketplace and quick commerce where eligible; merchants may fulfil from their own store or place goods in a platform dark store or a participating partner (distinct custody arrangements, not assumed eligible by default); circle/polygon zones, overlapping eligible stores, customer choice, server-side eligibility; each app has its own canonical UI system on a shared foundation; Agrimore's one-location-per-basket rule is not to be carried into every channel silently, nor split orders introduced silently.

---

## 2. What LetBuyy demonstrably does today (verified in this audit)

Evidence level in brackets. "Reproduced" = executed in this audit on real Postgres in throwaway containers or in-process.

- **Tenant isolation at the database**: `sites`/`site_id` root, RLS ENABLE+FORCE, transaction-local GUC; unset context → zero rows; red-team RT-1…RT-9 pass [reproduced]. 279 tenant tables registered, 0 service-role bypasses [validator].
- **Checkout correctness under concurrency**: two concurrent checkouts on stock=1 → one order; five concurrent replays of one idempotency key → one order; removing the advisory lock breaks it (control) [reproduced].
- **Inventory RPCs**: reserve/commit/release/expiry, transfers with partial receipt, committed-quantity release exactly once [reproduced].
- **Double-entry ledger with an enforced balance trigger and immutable entries**; gift card, loyalty, wallet, ad credit are ledger projections; commission is 0 by validator [reproduced + validator] (§13).
- **Parent purchase + child orders** (multi-merchant model) with platform-level tenancy the merchant realm cannot read [reproduced].
- **Razorpay chain in source**: server-side amounts, provider order bound to the order, HMAC verify with constant-time compare and replay check, webhook raw-body HMAC with provider-event uniqueness, internal HMAC hop [inspected source].
- **Identity**: ES256/EdDSA issuer for merchant and buyer realms with JWKS verification in the gateway; Turnstile and rate limits on registration/login [inspected source].
- **Store builder**: subdomain + custom domain (TXT challenge, Vercel SSL), theme editor drafts/publish/releases/rollback/preview, host routing with tenant-boundary checks, sanitised themes (no scripts/embeds/style attrs), robots/sitemap [inspected source].
- **Marketplace foundation**: `channel_listings` (storefront | marketplace | instant), moderation state machine, keyset feed RPC, public feed/category/detail routes, admin moderation screens [inspected source; RPC suites exist].
- **Unit and contract lanes**: 277/277 contracts, 962 gateway tests (953 pass, 0 fail, 9 skipped), gateway typecheck clean [reproduced].

## 3. Present but unverified

- **Any HTTP-level or browser behaviour.** No database exists anywhere by owner decision (D-11); the local end-to-end stack has never been booted (`E2E_DEVELOP` unreached); deploy workflows are dispatch-only; the GitHub remote is unreadable. Treat every route and UI claim as `CLAIMED_NOT_VERIFIED`.
- Five `next build`s green and the 46-suite executable battery green — **historical (2026-09-12)**, not re-run.
- Flutter builds (`merchant_app`, `customer_app`) — built once in a prior phase; not re-verified.
- Liquid renderer activation state, step-up cryptography on refunds/payouts, courier live mode, queue lag, alert delivery, backup/restore — declared or partially measured, never observed live.

## 4. Missing or unsafe (the gap)

| Area | State | Ref |
|---|---|---|
| Geography | **No coordinates, PostGIS, polygons or radius logic anywhere** in 175 migrations; serviceability is pincode rules | §11.1 |
| Fulfilment custody | A location always belongs to the selling store; transfers refuse cross-site destinations; no custodian role, acceptance, fee or loss model; in-transit is only "reserved at source" | §10.2 |
| Location/channel pricing | One price per product; `channel_listings.pricing_policy` stored but never applied | §9 |
| Quick-commerce backend | No quote-with-expiry on the live path, no eligibility hook, no dispatch, rider, proof, tracking, Store Ops transitions; donor Flutter UIs wired to nothing | §11 |
| POS | Absent; the Constitution only names `pos` as a channel value | §12 |
| Operator login | `admin_web` uses a dev-only magic link; **production returns an error** → moderation can never approve a listing → marketplace feed stays empty | LB-ORG-004 |
| Staff permissions | Server checks default to `dryrun` (log, never block) | LB-ORG-003 |
| Organisation model | DDL exists behind a flag, no wiring | LB-ORG-002 |
| Customer identity | Three identities (per-store HS256, platform buyer ES256 email-only, Firebase in the shipped app); no phone OTP; no platform address book | §7.2 |
| Payments hygiene | RPC accepts caller-supplied tax; refund `created` treated as `refunded`; late payment after unpaid-stock release unguarded (inspected, untested) | LB-PAY-002/003/004 |
| Operations | Nothing deployed; Vercel IDs placeholders; no alert receiver; restore never drilled; `develop` exists only on one disk | §15 |
| Barcode/SKU uniqueness | No UNIQUE constraint found | LB-CAT-002 |

## 5. Agrimore capabilities that look reusable — and the conditions

Reusable **as design and schema donors, not as code to import**:

- **Zones and stores**: `ops.service_zones (geography polygon, GiST)`, `ops.dark_stores (point, service_radius_m, accepts_orders, target_sla_seconds)`, addresses with geography — re-key to LetBuyy tenancy and a custody-aware location; **replace** `find_serviceable_store` (nearest-single-store, radius only, no overlap list).
- **Dispatch**: `logistics.deliveries` (versioned), `rider_assignments` (unique offer id, expiry, offered/accepted/rejected/expired), `assign_rider` and `transition_delivery(expected_version)` — the best-shaped donor piece.
- **Requirements**: PDR-0001/0002/0003 and ADR-0004/0006/0007/0008 state the physical-commerce rules more precisely than anything in LetBuyy; use them as specs.
- **Flows/UX**: Store Ops (queue, pick, pack, ready, handover), Rider (availability, offers, proof, earnings), per-app design directions (ADR-0010).

Conditions before any reuse: fix the auth response parsing defect (`payload.user.id`, still present in gateway, realtime gateway and Edge helper); do not adopt Edge Functions that trust `x-user-id` headers from the caller; do not adopt `confirm-payment`'s optional signature check; Agrimore RLS has no `FORCE` and one `USING (true)` — re-express every table under LetBuyy's GUC model; quote expiry is unscheduled there; the Razorpay credential rotation in `SKIPPED_TASKS.md` is still OPEN; the current tree is a rebuilt skeleton — earlier audits describing a larger app no longer apply. Read it at a committed SHA, not the in-flight index.

## 6. Proposed authoritative services and data boundaries (recommendation)

- **Postgres (Supabase shape) is the only commerce authority**: tenancy, catalogue, offers, inventory (incl. custody), orders/purchases, ledger, dispatch state. New quick-commerce and POS tables follow `site_id` + FORCE RLS + GUC, with locations getting their own scoped memberships.
- **`services/api-gateway`** owns all synchronous commerce including the new modules (serviceability, fulfilment locations & custody, Instant quote, Store Ops transitions, dispatch commands, counter sale). No second gateway; no Agrimore Workers/Edge Functions imported.
- **`services/queue-workers`** owns expiry sweepers (quotes, reservations, offers), dispatch re-offers, notifications, reconciliation.
- **`apps/identity-platform`** issues every realm (merchant, buyer, and new rider/custodian/associate capabilities as scoped memberships, not new symmetric secrets); phone-OTP credential added there.
- **`apps/merchant_web` + `apps/merchant_app`** = the one merchant application; Store Ops as a role mode for merchant-run locations, a separate app only for partner staff.
- **`apps/admin_web`** = the one admin (D-4) unless the founder overrides for native; fix its login first.
- **New roots for native POS/Admin** require a Constitution amendment and ARB approval before source exists.
- Ownership vs custody vs location vs sellable vs reserved vs committed are separate fields/records; one price per (channel, location, effective window); one stock number per location; one ledger.

## 7. Most important unresolved decisions (founder)

1. **Fee model** — LetBuyy: 0% forever (D-1, constitutional). Agrimore: 3–4% blended commission. Cannot both hold.
2. **Custody stance** — "never a money custodian" vs collecting buyer payment and settling partners/riders; plus physical custody fees.
3. **D-2 merchant of record / invoicing party** (needs counsel).
4. **Cart model** — recommended: separate baskets per mode, one location per Instant basket, parent purchase for the marketplace (§7.4).
5. **Native Central Admin vs `admin_web`** (D-4 says `admin_web`).
6. **Constitution amendments** for native app roots and channel vocabulary; any reserved-service activation.
7. **Store Ops** as mode vs app; **first POS domain** (recommended: clothing); hardware; maps and SMS providers; partner custody contract terms.

## 8. Recommended first engineering slice and acceptance evidence

**Do first, on the existing product (repairs):** boot the local stack and record one sandbox journey; make operator login work outside dev; switch staff RBAC to `enforce` with route probes; guard late-payment-after-release and refund `created`; move or guard tax in the checkout RPC; back up `develop` off this disk.

**Then the first physical-commerce slice (no money):** one merchant, two locations (own + partner under a new custody model), five fixed-unit SKUs, the 20-shirts transfer with partner acceptance and an in-transit interval, one circle zone with serviceability and buyer choice, one Instant basket with a quote that expires, one picker flow, one rider offer → acceptance → proof, sandbox payment, reconciliation to zero.

**Acceptance evidence (what must be shown, not said):** each behaviour as an executable Postgres suite in the repository's runner (concurrent last-unit across storefront and Instant; offer race → one acceptance; quote expiry exactly once; custodian-only receipt; unset GUC → zero rows on every new table); existing suites still green; a recorded local end-to-end run; a diff limited to the phase's declared files.

## 9. Links

- Main report sections: §6 store builder · §7 marketplace/identity/cart · §8 tenancy/roles · §9 catalogue/pricing · §10 inventory/custody (20-shirts scenario) · §11 quick commerce and Agrimore primitives · §12 POS · §13 money · §14 security · §15 infrastructure · §17 traces · §18 tests · §19 reuse matrix · §21 backlog · §23 decisions.
- Key LetBuyy files (develop @ `bda7f7f8`): `services/api-gateway/src/index.ts` (mounts), `routes/inventory.ts`, `routes/storefront/checkout-payment-routes.ts`, `execution/order-execution.adapter.ts`, `lib/tenant-context.ts`, `middleware/staff-permission.ts`, `services/webhook-service/src/index.ts`, `apps/identity-platform/src/lib/auth/identity-issued-session.ts`, `apps/customer_web/src/proxy.ts`, `apps/admin_web/src/app/api/console-auth/login/route.ts`, migrations `139`, `141`, `166`, `168`, `211`, `216`, `217`, `219`, `223`, `234`, `246`, `tests/executable/*`, `scripts/governance/run-executable-suites.mjs`.
- Key Agrimore files: `docs/product/PDR-0002-partner-commerce-model.md`, `docs/decisions/ADR-0004…0008`, `supabase/migrations/000003_geography_and_stores.sql`, `000008_delivery_dispatch.sql`, `000011_rpc_checkout.sql`, `000012_rpc_delivery.sql`, `supabase/functions/_shared/worker_context.ts`, `workers/api-gateway/src/routes.ts`.
- Decision register: `.claude/skills/letbuyy/references/decisions.md`; prior evidence: `docs/evidence/integration/2026-09-12-develop-integration.md`, `docs/evidence/production-readiness/2026-08-24-readiness-evidence.md`.

## 10. Cautions — conclusions the evidence does not support

- Do **not** say POS exists, is "half done", or is a theme away; nothing implements it.
- Do **not** read "most infrastructure exists" as "most of the merger exists": the commerce core is real; the physical-commerce layer (geo, custody, dispatch, Store Ops, POS, operator access) is absent.
- Do **not** infer that a shared buyer identity lets a merchant see other merchants' customers; the schema forbids it and must keep forbidding it.
- Do **not** describe LetBuyy's inventory as "shared inventory" across owners or locations; it is one stock number per (store, location), with no custody model.
- Do **not** cite the green suites as production readiness; nine of eleven readiness dimensions are partial or unmeasured, and nothing is deployed.
- Do **not** treat the single-location basket or a mixed cart as decided; it is a founder decision with trade-offs.
- Do **not** promise conflict-free offline POS sales or shared stock with partners whose own tills are uncaptured.
- Do **not** quote Agrimore's earlier audits as the current tree; the repository was rebuilt and is mid-cleanup.
- Do **not** claim any route, screen or provider integration works until a running stack has exercised it.
