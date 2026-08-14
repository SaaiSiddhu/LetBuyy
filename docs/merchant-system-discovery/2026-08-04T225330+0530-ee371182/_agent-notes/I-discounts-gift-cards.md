# AGENT I — DISCOUNTS, COUPONS, AND GIFT CARDS — DISCOVERY NOTES

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-ee371182`
Repo: `/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store` · Branch `stepup/main` · Commit `ee371182`
Method: static source + SQL reading only. **No runtime execution, no DB connection, no provider calls.**
Therefore **nothing in this note is `VERIFIED_E2E`.** Static ceiling = `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.

Governance read before inspection: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (ART-15 at :239),
root `AGENTS.md` (PAY-R1 :245, WIN-R4 :146, ANTI-R1 :314, ANTI-R4 :317, ANTI-R5 :318, ANTI-R6 :319, CODE-R6 :122),
`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` (winner registry row 19 at :90, Discounts §:210-213,
`gift_cards.balance` duplicate = DEAD at :166). `apps/merchant-control-plane/AGENTS.md`,
`services/api-gateway/AGENTS.md`, `apps/storefront-runtime/AGENTS.md` contain **no** discount/gift-card rules
(grep returned zero hits) — the domain is governed only from the root chain.

---

## 0. HEADLINE VERDICT

1. **The canonical discount engine is NOT wired.** Governance (`LETBUYY_CANONICAL_SYSTEMS.md:90,210-213`, ART-15)
   crowns the *typed 3-class `combines_with`* engine and demotes the scalar single-code RPC. In the code, the exact
   inverse is live: checkout runs the **scalar** `evaluate_checkout_promotion` RPC, and the typed engine
   (`planDiscountStack`) is called **only from its own unit test**. The `discount_allocations` table written by
   migration 143 has **zero writers**.
2. **THREE parallel discount models coexist** (`promotions`/`promotion_codes`/`promotion_effects` — schema with no
   write surface at all; `coupons` — the live one; the typed engine — dormant). That is `WIN-R4` / `ANTI-R1`.
3. **Gift-card balance IS a correct ledger projection** — `ANTI-R4` is *satisfied* on the redemption path, and the
   governance validator pins it. This is the strongest part of the domain. But the gift card has **no customer-facing
   surface at all** (no gift-card field in the storefront checkout UI), and **issuance is not idempotent**.
4. **The biggest concrete money defect found**: `POST /orders/:id/refund/complete` calls
   `restore_gift_card_on_refund` unconditionally, so a **partial** refund restores the **full** gift-card
   redemption — merchant pays twice. Meanwhile the *returns* refund path never restores at all.
5. **India-first date bug**: coupon start/expiry come from `<input type="date">` and are converted with
   `new Date("YYYY-MM-DD").toISOString()` → **UTC midnight = 05:30 IST**. A coupon a merchant sets to expire
   "31 Aug" dies at 05:30 IST on 31 Aug.
6. Coupon **code uniqueness is correctly per-store** (two unique indexes). Coupon **total-usage and per-customer
   limits ARE row-locked** and are concurrency-safe for the `coupons` path — this is the one place where the
   implementation is better than expected. Gift-card redemption is likewise `FOR UPDATE`-locked.
7. Large swathes of the merchant-visible feature surface are **schema-and-Zod-only**: product/collection
   restrictions, automatic discounts, `combines_with`, priority, and per-customer limit are accepted by the API
   schema and then silently dropped or never read.

---

## 1. SYSTEM INVENTORY (what exists)

### 1.1 Database objects

| Object | Migration:line | Money type | Role |
|---|---|---|---|
| `public.coupons` | `database/supabase/migrations/000_baseline.sql:8817-8848` | `numeric(10,2)` + `numeric(12,2)` | LIVE merchant coupon table |
| `public.coupons` typed cols (`discount_class`, `combines_with`, `automatic`, `priority`, `allocation_method`) | `143_executable_discount_stack.sql:5-12` | — | stored, **never read at checkout** |
| `public.discount_allocations` | `143_executable_discount_stack.sql:19-38` | `amount_minor bigint` (correct) | **zero writers** |
| `public.promotions` / `promotion_codes` / `promotion_effects` / `promotion_rules` / `promotion_redemptions` / `promotion_usage_counters` | `000_baseline.sql` (read at `:3890-3942`, written at `:2002-2062`) | numeric | read FIRST by the live RPC; **no create/edit API** |
| `public.gift_card_accounts` | `000_baseline.sql:9366-9387` | `numeric(12,2)`; `balance` CHECK `>= 0` | canonical account (hash + last4) |
| `public.gift_card_ledger_entries` | `000_baseline.sql:9394-9413` | `numeric(12,2)`; `amount >= 0`, `balance_after >= 0` | **balance source of truth** |
| `public.gift_card_redemptions` | `000_baseline.sql:9420-9437` | `numeric(12,2)` | order↔card link |
| `public.gift_cards` (LEGACY) | `000_baseline.sql:9444-9457` | `numeric(10,2)` mutable `balance` | DEAD per `LETBUYY_CANONICAL_SYSTEMS.md:166`; **zero code references** |
| `public.subscription_coupons` / `subscription_coupon_redemptions` | `184_v1_subscription_coupons.sql:9-58` | **`bigint` minor units** | platform→merchant billing coupons (separate domain) |

### 1.2 RPCs

| RPC | Defined | SECURITY DEFINER | Live? |
|---|---|---|---|
| `create_checkout_order` (16-arg) | `170_v1_shipping_rates_gst.sql:31-51` | yes | **LIVE** — the only order-create authority |
| `evaluate_checkout_promotion` | `000_baseline.sql:3873-4032` (only definition) | yes | **LIVE** — the scalar/demoted engine |
| `gift_card_available_balance` | `173_v1_gift_card_issuance_lifecycle.sql:22-52` | yes | LIVE (projection) |
| `issue_gift_card` | `173:59-156` | yes | LIVE |
| `list_gift_cards` | `173:160-194` | yes | LIVE |
| `check_gift_card_balance` | `173:199-243` | yes | LIVE (merchant-only) |
| `set_gift_card_status` | `173:248-319` | yes | LIVE |
| `gift_card_transactions` | `173:323-369` | yes | LIVE |
| `restore_gift_card_on_refund` | `174_v1_gift_card_refund_restore.sql:18-89` | yes | LIVE, invoked from 2 of 3 refund paths |
| `validate_subscription_coupon` | `184:69-154` | yes | LIVE (billing) |
| `redeem_subscription_coupon` | `184:157-211` | yes | LIVE (billing) |

### 1.3 TypeScript engines

| Symbol | File:line | Called from |
|---|---|---|
| `planDiscountStack` (the typed 3-class engine) | `packages/checkout-core/src/index.ts:1204-1269` | `packages/checkout-core/test/checkout-core.test.ts:100,138` **and nothing else** |
| `planCouponCreate` | `packages/checkout-core/src/index.ts:1304-1326` | `services/api-gateway/src/routes/coupons.ts:125` |
| `planCouponUpdate` | `…:1328-1341` | `coupons.ts:194` |
| `planCouponValidation` | `…:1343-1391` | `coupons.ts:275`, `services/api-gateway/src/routes/storefront/public-routes.ts:892` |
| `normalizeCouponRecord` | `…:1283-1302` | `coupons.ts:80,133,157,211` |

### 1.4 Routes / surfaces

| Surface | File:line |
|---|---|
| Gateway coupons router (mounted **twice**) | `services/api-gateway/src/index.ts:807` `/coupons`, `:808` `/discounts` — **same router object** |
| Coupon CRUD + validate | `services/api-gateway/src/routes/coupons.ts:37,84,137,161,215,250` |
| Public storefront coupon validate (unauth) | `services/api-gateway/src/routes/storefront/public-routes.ts:373,858,865-910` |
| Storefront order create (LIVE money path) | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:250-400` |
| `create_checkout_order` adapter | `services/api-gateway/src/execution/order-execution.adapter.ts:158-176` |
| Gift-card routes (attached to products router) | `services/api-gateway/src/routes/gift-cards.ts:38-227`, registered `services/api-gateway/src/routes/products.ts:1002` |
| Gift-card issued email | `services/api-gateway/src/lib/gift-card-email.ts:33-131`; worker recognises at `services/queue-workers/src/index.ts:472` |
| MCP coupon page | `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx` (600 lines) |
| MCP coupon proxies | `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts`, `.../[couponId]/route.ts` |
| MCP gift-card page | `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx` (604 lines) |
| MCP gift-card proxies | `apps/merchant-control-plane/src/app/api/stores/[store]/gift-cards/route.ts`, `.../[id]/route.ts` |
| Storefront coupon proxy | `apps/storefront-runtime/src/app/api/coupons/validate/route.ts` |
| Storefront checkout coupon UI | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:163-165,252-254,361,367-401,1090-1120` |
| Mobile merchant coupon screens | `apps/mobile/merchant-app/lib/screens/discounts/coupons_screen.dart` (623), `coupon_form_screen.dart` (366) |
| Mobile merchant gift-card screen | `apps/mobile/merchant-app/lib/screens/discounts/gift_cards_screen.dart` (483) |

---

## 2. TASK 1 — WHICH DISCOUNT ENGINE IS ACTUALLY WIRED? (parallel-systems determination)

**Answer: the SCALAR single-code RPC is live. The typed 3-class engine is DORMANT. Governance is inverted.**

Evidence chain (all `RPC_FUNCTION` / `GATEWAY_CODE` / `UNIT_TEST`):

1. `LETBUYY_CANONICAL_SYSTEMS.md:90` — winner registry row 19: *"Discounts | The typed 3-class `combines_with`
   discount engine | CANONICAL (activate) | scalar single-code discount RPC"*. `:210-213` — *"the typed engine is
   built but dormant; the live scalar single-code RPC cannot express the `combines_with` matrix"*. `DOC_CLAIM`.
2. The **only** order-create authority is `create_checkout_order`
   (`services/api-gateway/src/execution/order-execution.adapter.ts:158`; migration 166 header line 2 states
   *"keep create_checkout_order as the only order creation authority"*).
3. `create_checkout_order` (latest definition, `170_v1_shipping_rates_gst.sql:31`) calls
   **`evaluate_checkout_promotion`** at `170:185-193` and takes exactly **one** `p_coupon_code text` at `170:39`.
   → Only one code per order is expressible. Stacking is structurally impossible.
4. `evaluate_checkout_promotion` (`000_baseline.sql:3873-4032`) never reads `discount_class`, `combines_with`,
   `automatic`, `priority`, or `allocation_method`. Grep for those identifiers across `services/`, `apps/`,
   `packages/`, `database/` returns only: migration 143, its rollback, `checkout-core`, `checkout-core` tests, the
   gateway `discounts.test.ts`, the tenant-table registry, and docs.
5. `planDiscountStack` (`packages/checkout-core/src/index.ts:1204`) call sites: **only**
   `packages/checkout-core/test/checkout-core.test.ts:100,138`. Zero runtime callers.
6. `discount_allocations` (`143:19-38`) has **zero** insert/update sites anywhere in `services/`, `apps/`, `packages/`.
7. The `/discounts` "V1 API" is an **alias of the same coupons router**:
   `services/api-gateway/src/index.ts:807-808` route `/coupons` and `/discounts` to the identical
   `couponsRouter` object. There is no separate typed-discount API.
8. The test that "proves" Task 007 is a **source-text regex test**, not a behaviour test:
   `services/api-gateway/src/__tests__/discounts.test.ts:40-46` asserts
   `assert.match(indexSource, /api\.route\('\/discounts', couponsRouter\)/)` and
   `assert.match(checkoutCore, /export function planDiscountStack/)` — i.e. it asserts the function *exists in the
   file*, never that it is *invoked*. `ANTI-R3`-shaped governance theater.

**Are BOTH reachable?** Partially, and that is the worst case:
- The typed **configuration** is reachable and persisted — `planCouponCreate`
  (`packages/checkout-core/src/index.ts:1312-1315`) writes `discount_class`, `combines_with`, `automatic`,
  `priority`; `POST /coupons/validate` echoes them back (`coupons.ts:286-287`).
- The typed **evaluation** is not reachable. Checkout ignores every one of those fields.
- Net effect: the API lets a merchant/integrator configure a combinable, automatic, product-class discount, returns
  it as valid, and then checkout behaves as if none of it was set. This is worse than a dormant module — it is a
  configuration surface that lies.

**A third model exists.** `evaluate_checkout_promotion:3890-3921` queries `promotion_codes ⨝ promotions ⨝
promotion_effects` **first**, and only falls back to `coupons` at `:3922-3942`. Grep for `promotion_codes` /
`from('promotions')` / `promotion_redemptions` across `services/api-gateway/src` and
`apps/merchant-control-plane/src` returns hits **only** in
`services/api-gateway/src/tenant/tenant-tables.registry.ts:1807,1829` (registry metadata). There is **no API and no
UI** that can create a promotion or a promotion code — yet the live checkout path evaluates them at higher
precedence than coupons and writes `promotion_redemptions` (`000_baseline.sql:2002-2032`) and
`promotion_usage_counters` (`:2044-2061`) for coupon redemptions.

→ **Three parallel discount systems for one domain, with the governance-named winner being the dormant one.**
`WIN-R4` / `WIN-R5` / `ANTI-R1`.

---

## 3. TASK 2 — FULL VERTICAL TRACES

### 3.1 CREATE COUPON

| # | Link | Evidence | Status |
|---|---|---|---|
| 1 | Merchant entry | MCP `/[store]/coupons` → "New coupon" form | `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:402-480` | UI_CODE |
| 2 | Form payload | code, type, value, min_purchase, max_uses, starts_at, expires_at, is_active — **8 fields only** | `…/coupons/page.tsx:202-210` | UI_CODE |
| 3 | Same-origin proxy | `POST /api/stores/[store]/coupons` | `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts:83-105` | PROXY_CODE |
| 4 | Ownership at proxy | `resolveOwnedStoreId(store)` | same file `:89` | PROXY_CODE |
| 5 | Field mapping | `toWorkerCoupon` — maps only the same 8 fields; `fixed_amount`→`fixed` | same file `:17-28` | PROXY_CODE |
| 6 | Typed API client | `createMerchantApiClient().coupons.create(...)` | same file `:94-96` | API_CLIENT_CODE |
| 7 | Gateway route | `POST /v1/coupons` (and `/v1/discounts`) | `services/api-gateway/src/routes/coupons.ts:84` | GATEWAY_CODE |
| 8 | Auth issuer | merchant session via `api.use('/*', authMiddleware)` `services/api-gateway/src/index.ts:750` (routes mounted at `:807` are *after* the middleware registration in file order — see §9 UNKNOWN-3) | GATEWAY_CODE |
| 9 | Authorization | `verifySiteOwnership(db, body.store_id, …)` `coupons.ts:104`; `assertStaffPermission(…, 'marketing:write')` `coupons.ts:108` | GATEWAY_CODE |
| 10 | Validation | `CreateCouponSchema` `packages/checkout-core/src/index.ts:962-988`; `bogo` rejected at `coupons.ts:91-99` | SERVICE_CODE |
| 11 | Uniqueness | check-then-insert `coupons.ts:112-121` (TOCTOU) **backstopped by** `coupons_site_id_code_key UNIQUE (store_id, code)` `000_baseline.sql:13731` and `idx_coupons_store_code_active UNIQUE (store_id, upper(code)) WHERE deleted_at IS NULL` `000_baseline.sql:16961` | DB_SCHEMA |
| 12 | Insert plan | `planCouponCreate(body).couponInsert` `checkout-core:1304-1326` — writes to the **legacy duplicate columns** (`discount_type`, `discount_value`, `min_order_amount`, `max_discount`, `per_user_limit`) **and** the typed columns | SERVICE_CODE |
| 13 | DB write | `db.from('coupons').insert(...)` via **service-role** client `coupons.ts:123-127` | GATEWAY_CODE |
| 14 | RLS | `coupons` ENABLE+FORCE `143:67-68`; GUC policy `coupons_tenant_site_guc` `143:77`; blanket dynamic policy `app_tenant_guc_*` `164_d4_tenant_role_guc.sql:63-73`. **Gateway connects as service-role (`getSupabaseAdmin` → `createSupabaseServiceClient`, `services/api-gateway/src/lib/supabase.ts:13-19`) so RLS is bypassed; tenancy rests on the TS guard + `verifySiteOwnership`.** | RLS_POLICY |
| — | **MISSING** | `applicable_products`, `applicable_categories` are in `CreateCouponSchema:980-981` and in the table (`000_baseline.sql:8843-8844`) but **`planCouponCreate` does not include them** → silently discarded | SERVICE_CODE |
| — | **MISSING** | `maximum_discount`, `per_customer_limit`, `description`, `discount_class`, `combines_with`, `automatic`, `priority` — never sent by the MCP proxy (`coupons/route.ts:17-28`) → percentage coupons are **always uncapped** and per-customer limit is always the default 1 | PROXY_CODE |

### 3.2 EDIT COUPON

`page.tsx:178-183` (hydrate) → `PATCH /api/stores/[store]/coupons/[couponId]`
(`apps/merchant-control-plane/src/app/api/stores/[store]/coupons/[couponId]/route.ts:31-51`) → `coupons.update` →
`PATCH /v1/coupons/:id` (`services/api-gateway/src/routes/coupons.ts:161`) → ownership `:187` + staff perm `:191`
→ `planCouponUpdate` (`checkout-core:1328-1341`, allow-list `COUPON_UPDATE_FIELDS:1113-1129`) → `.update()` `:200`.
- **MISSING**: `applicable_products` / `applicable_categories` are not in `COUPON_UPDATE_FIELDS` → not editable.
- **Hydration hazard**: `page.tsx:182-183` does `coupon.starts_at.split('T')[0]` on a **UTC** ISO string. Any
  coupon whose timestamp is not UTC-midnight (e.g. created through the mobile app or a direct API call with an IST
  instant) will render **the previous day** in the edit form and be silently re-saved as that wrong day.

### 3.3 DEACTIVATE / DELETE COUPON

`DELETE /v1/coupons/:id` → `services/api-gateway/src/routes/coupons.ts:215-245` → `.update({ is_active: false })`
`:237`. **`deleted_at` is never set.**
- Checkout honours it: `evaluate_checkout_promotion:3928` requires `COALESCE(c.is_active, true) = true`. Good.
- But the partial unique index `idx_coupons_store_code_active … WHERE (deleted_at IS NULL)`
  (`000_baseline.sql:16961`) and the pre-insert check (`coupons.ts:112-117`, no `deleted_at` filter) both still see
  the row → **a "deleted" coupon code can never be recreated** (409 CONFLICT forever). Real merchant-facing defect.
- The mobile app removes the row from its local list on delete (`apps/mobile/merchant-app/lib/services/coupon_service.dart:73-77`)
  while the server only deactivates → UI/server divergence on refresh.

### 3.4 APPLY COUPON AT CHECKOUT (the money path)

| # | Link | Evidence |
|---|---|---|
| 1 | Customer enters code | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:1099-1120` |
| 2 | Client-side preview call | `fetch('/api/coupons/validate?…')` `checkout-client.tsx:382` |
| 3 | Storefront proxy | `apps/storefront-runtime/src/app/api/coupons/validate/route.ts:10-31` (GET, **unauthenticated**) |
| 4 | Gateway public route | `services/api-gateway/src/routes/storefront/public-routes.ts:858-863` → `validateCouponForStore` `:865-910` |
| 5 | Preview computation | `planCouponValidation(coupon, { subtotal, enforceMinimumOrder: true })` `public-routes.ts:892` — subtotal comes from the **query string** (client-supplied) `:867`. Display only. |
| 6 | Client applies discount to displayed total | `checkout-client.tsx:252-254` `totalAmount = max(0, cartTotal + delivery − discountAmount)` |
| 7 | Order submit | `couponCode: appliedCoupon?.code` `checkout-client.tsx:361` |
| 8 | Storefront order proxy | `apps/storefront-runtime/src/app/api/orders/route.ts:48-58` |
| 9 | Gateway public order create | `POST /v1/storefront/:subdomain/orders` `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:250` |
| 10 | Idempotency | `IdempotencyExecutionAdapter.begin(scope 'storefront.checkout.order.create')` `checkout-payment-routes.ts:265-276` |
| 11 | Server shipping | `resolveShippingRate` `:291` (client rate id validated) |
| 12 | Server GST | `:294-366` — **`discount_amount_minor: 0`** at `:353` |
| 13 | RPC call | `OrderExecutionAdapter.createOrder` `:395` → `db.rpc('create_checkout_order', …)` `order-execution.adapter.ts:158` |
| 14 | Server-authoritative discount | `create_checkout_order` `170:185-193` → `evaluate_checkout_promotion(store, code, order.subtotal, shipping, email)` — **subtotal is read from the persisted `orders` row (`v_order.subtotal`, `170:181-183`), not from the client** |
| 15 | Eligibility + limits | `000_baseline.sql:3950-4004` (min order, global count, code count, per-customer count) |
| 16 | Amount computation | `:4006-4020` percentage / fixed / free_shipping, capped at `subtotal + shipping` |
| 17 | Totals | `170:194` `grand_total = subtotal + shipping + tax − discount`, floored at 0 |
| 18 | Persist | `orders.discount`, `orders.coupon_code`, `orders.coupon_discount` `170:282-292` |
| 19 | Audit rows | `order_line_adjustments` `000_baseline.sql:1979-2001`; `promotion_redemptions` `:2002-2032`; `coupons.usage_count += 1` `:2040-2043`; `promotion_usage_counters` upsert `:2044-2061` |
| 20 | Reporting consequence | order CSV export carries `discount` only (`services/api-gateway/src/routes/export.ts:92,510`). **No discount analytics endpoint exists** — grep of `analytics.ts` / `commerce-analytics.ts` for `coupon`/`discount`/`gift_card` returns nothing. |
| 21 | Tests | **MISSING** — no test executes this path |
| 22 | Runtime observation | **MISSING** |

**Second, weaker order path.** `/v1/checkout` (`services/api-gateway/src/index.ts:724`,
`services/api-gateway/src/routes/checkout.ts`) also creates orders via `OrderExecutionAdapter.createOrder`
(`checkout.ts:680`). Its confirm-time discount revalidation (`checkout.ts:404-416`) checks **only** that each code
exists with `is_active = true` — it does **not** re-check expiry, start date, usage limits, or minimum order.
It relies on `create_checkout_order` to re-evaluate, which it does; but the revalidation gate itself is decorative.

### 3.5 USAGE TRACKING

Two counters are maintained for the same fact and are read by different surfaces:

| Counter | Written | Read |
|---|---|---|
| `coupons.usage_count` | `000_baseline.sql:2040-2043` (unconditional `+1` when a discount applied) | **storefront preview** via `planCouponValidation` `checkout-core:1361` (`usageCount >= usageLimit`) and the MCP list column `page.tsx:535` |
| `promotion_redemptions` rows | `000_baseline.sql:2002-2032` (`ON CONFLICT … DO NOTHING`) | **checkout enforcement** `evaluate_checkout_promotion:3966-3980` |

They can diverge (the `usage_count` UPDATE has no `ON CONFLICT` guard while the redemption INSERT does). Divergence
direction is not provable statically. `CONTRADICTORY_EVIDENCE` on which is authoritative.

### 3.6 GIFT CARD — ISSUE → REDEEM → RESTORE

| # | Link | Evidence |
|---|---|---|
| 1 | Merchant issues | MCP `products/gift-cards` page → value + recipient email only `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:200-203` |
| 2 | Proxy | `POST /api/stores/[store]/gift-cards` `apps/merchant-control-plane/src/app/api/stores/[store]/gift-cards/route.ts:25-44` |
| 3 | Gateway | `POST /v1/products/gift-cards` `services/api-gateway/src/routes/gift-cards.ts:62` |
| 4 | AuthZ | `verifySiteOwnership` `gift-cards.ts:70`. **No `assertStaffPermission`** anywhere in the file. |
| 5 | Code generation | `generateGiftCardCodeFromBytes(crypto.getRandomValues(new Uint8Array(16)))` `gift-cards.ts:86` — 128-bit CSPRNG |
| 6 | Idempotency key | `` `gift_card.issue:${store}:${crypto.randomUUID()}` `` `gift-cards.ts:87` — **a fresh random key every call** |
| 7 | RPC | `db.rpc('issue_gift_card', …)` `gift-cards.ts:88-98` → `173:59-156` |
| 8 | DB write | account INSERT `173:103-121` (`ON CONFLICT (site_id, code_hash) DO NOTHING`) + `'issued'` ledger entry `173:127-138` (`ON CONFLICT (site_id, idempotency_key) DO NOTHING`) |
| 9 | Code storage | only `code_hash = encode(digest(code,'sha256'),'hex')` + `code_last4` `173:100-101` — plaintext returned once `gift-cards.ts:100` |
| 10 | Customer delivery | `enqueueGiftCardIssuedEmail` `gift-cards.ts:119-131` → `services/api-gateway/src/lib/gift-card-email.ts:78-131` → queue job `email.gift_card_issued` → `services/queue-workers/src/index.ts:472` |
| 11 | Customer redeems | **MISSING** — the storefront checkout UI has **no gift-card input**. Grep of `apps/storefront-runtime/src` for `gift_card`/`giftCard` returns exactly one hit: the API proxy passthrough `apps/storefront-runtime/src/app/api/orders/route.ts:55`. |
| 12 | Redemption (backend) | `create_checkout_order` `170:196-278`: lookup by hash `170:198-206` **`FOR UPDATE`**; balance projected from ledger `170:210-224`; `LEAST(balance, grand_total)` `170:226`; redemption row `170:233-259`; `'debit'` ledger entry `170:261-278` |
| 13 | Payment due | `payment_due = grand_total − gift_card_amount` `170:280`; order auto-`paid`/`confirmed` if 0 `170:289-290` |
| 14 | Refund restore | `restore_gift_card_on_refund` `174:18-89`, called from `services/api-gateway/src/routes/orders.ts:1198` (PATCH status → cancelled/refunded) and `:1396` (`POST /orders/:id/refund/complete`) |
| 15 | Restore MISSING on returns | `services/api-gateway/src/routes/returns.ts:279` calls `complete_order_refund` with **no** gift-card restore |
| 16 | Reporting | MCP page shows projected balances only; **no liability report**, **no gift-card analytics**. Mobile shows a `_totalBalance` sum (`gift_cards_screen.dart:68`) — the only aggregate liability figure in the product. |
| 17 | Tests | `tests/launch/lb11-giftcards.test.mjs` + `lb11-refund-restore.test.mjs` — **100% regex-on-source**, zero execution |
| 18 | Runtime observation | **MISSING** |

---

## 4. TASK 3 — SERVER-SIDE VALIDATION / CLIENT INFLUENCE ON THE DISCOUNT AMOUNT

**Result: the redemption-time discount amount is server-authoritative. I found no path where the client sets the
amount.** This satisfies `CODE-R6` / `ANTI-R6` for the amount itself.

Proof:
- `create_checkout_order` passes `COALESCE(v_order.subtotal, 0)` (`170:189`) — read back from the `orders` row that
  `create_order_with_inventory_reservations` computed from DB prices — not a client field.
- `evaluate_checkout_promotion` derives `value` / `max_discount` / `min_order_amount` from the DB row
  (`000_baseline.sql:3926-3934`) and computes the discount at `:4006-4020`.
- The client's only inputs to the discount are the **code string** and the **customer email**
  (`checkout-payment-routes.ts:388`, `order-execution.adapter.ts:162,165`).
- `POST /coupons/validate` and the public storefront validate are explicitly documented as preview-only
  (`coupons.ts:247-249`; `pricing_authority: 'checkout'` at `coupons.ts:291`, `checkout-core:1389`).

**Server-side eligibility gaps (enforcement that does NOT exist server-side, in any layer):**

| Rule the API/UI implies | Enforced at redemption? | Evidence |
|---|---|---|
| Date window (start/expire) | YES | `evaluate_checkout_promotion:3936-3937` |
| Minimum order amount | YES | `:3950-3956` |
| Total usage limit | YES (row-locked) | `:3966-3976` |
| Per-code usage limit | YES | `:3978-3980` |
| Per-customer limit | YES **by email string only** | `:3982-4004` |
| `is_active` | YES | `:3928` |
| **Product restriction (`applicable_products`)** | **NO** — never written, never read | `checkout-core:1304-1326` omits it; `evaluate_checkout_promotion` never references it |
| **Collection restriction (`applicable_categories`)** | **NO** — same | same |
| **Customer-segment restriction** | **NOT IMPLEMENTED** — no column, no code | — |
| **`combines_with` / stacking rules** | **NO** — only one code is expressible | `170:39` single `p_coupon_code` |
| **Automatic discounts (`automatic = true`)** | **NO** — stored, never queried | `checkout-core:1314`; no reader |
| **Maximum discount cap on percentage** | Enforced *if set* (`:4009-4011`) but the **web UI can never set it** | `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts:17-28` |

**Client-influence vector that does exist (adjacent, GST):** `checkout-payment-routes.ts:353` passes
`discount_amount_minor: 0` into `calculateGstLine`, so GST is computed on the **pre-discount** line amount, then
`create_checkout_order` subtracts the discount *after* tax (`170:194`). A ₹500-off coupon on a ₹5,000 order still
carries GST on ₹5,000. Under CGST Act s.15(3)(a) a discount recorded at the time of supply reduces the taxable
value. Merchant-facing legal exposure. `[HIGH-STAKES]`

---

## 5. TASK 4 — CONCURRENCY (COUPONS)

**Finding: the `coupons` path IS concurrency-safe for total-usage and per-customer limits. This is better than the
mission brief anticipated and I am reporting it as a positive.**

- `evaluate_checkout_promotion` runs **inside** the caller's transaction (a plpgsql function called by
  `create_checkout_order`, itself invoked as one PostgREST RPC transaction).
- Coupon branch: `SELECT … FROM coupons c WHERE … LIMIT 1 FOR UPDATE` (`000_baseline.sql:3922-3942`, `FOR UPDATE`
  at `:3941`). The row lock is held until COMMIT, so the subsequent `COUNT(*)` on `promotion_redemptions`
  (`:3966-3976`) and the per-customer `COUNT(*)` (`:3986-4001`) are serialized against every other checkout using
  the same coupon. N concurrent checkouts of one coupon **cannot** exceed `usage_limit`.
- Redemption row is additionally protected by `promotion_redemptions_site_id_idempotency_key` uniqueness with
  key `promotion.redemption:<order_id>:<code>` (`000_baseline.sql:2054`, `ON CONFLICT … DO NOTHING` `:2061`).
- `promotion_usage_counters` uses an atomic upsert `ON CONFLICT … DO UPDATE SET usage_count = … + 1` (`:2061-2063`).

**Residual concurrency defects:**
1. **Promotion-level limit is racy.** The lock is `FOR UPDATE OF pc` (`:3916`) — it locks `promotion_codes` only —
   while `promotion_usage_limit` comes from `promotions.usage_limit` (`:3895`) and is checked against a count over
   `promotion_redemptions` for the whole promotion (`:3966-3976`). Two *different* codes of the same promotion,
   redeemed concurrently, can both pass. Currently **unreachable** because there is no API to create promotions
   (§2 point 8), so likelihood LOW, severity if activated P1.
2. **No unique constraint on `(coupon_id, customer_email)`.** Per-customer enforcement is a `COUNT(*)` under the
   coupon row lock — correct, but there is no DB-level backstop. Any future path that does not take the lock
   (e.g. an activated typed engine) would silently lose the guarantee. `DB_SCHEMA` — no such index in
   `000_baseline.sql` or `143`.
3. **Per-customer identity is an email string.** `evaluate_checkout_promotion:3982` uses `LOWER(p_customer_email)`.
   Guest checkout has no `customer_id` binding (`createPublicStorefrontTenantContext`,
   `checkout-payment-randomroutes` — `checkout-payment-routes.ts:264`). `a+1@…`, `a+2@…`, or any new address
   defeats `per_customer_limit` entirely. Real abuse boundary.
4. **`subscription_coupons.max_redemptions` is NOT re-checked at redemption.** `redeem_subscription_coupon`
   (`184:157-211`) locks the coupon `FOR UPDATE` (`184:188`) and increments `used_count` (`184:205-207`) but never
   re-validates `max_redemptions` — that check exists only in the read-only
   `validate_subscription_coupon:116-118`, which takes **no lock**. Platform billing coupon can be over-redeemed
   under concurrency.

---

## 6. TASK 5 — TIME ZONES AND DATE BOUNDARIES

**Confirmed defect. UTC everywhere; merchants think IST.**

- SQL layer is *correct in kind*: `starts_at`/`expires_at` are `timestamp with time zone`
  (`000_baseline.sql:8827-8828`) and are compared against `NOW()`
  (`evaluate_checkout_promotion:3936-3937`, `:3910-3913`) — absolute-instant comparison, no TZ bug **in SQL**.
- The bug is at the **entry point**:
  1. `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:455,461` render `<Input type="date" …>` →
     value is the bare string `"YYYY-MM-DD"`.
  2. `page.tsx:207-208` sends that bare string.
  3. `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts:25-26` passes it through untouched.
  4. `CreateCouponSchema` coerces with `z.coerce.date()` (`packages/checkout-core/src/index.ts:982-983`), then
     `toCouponIsoTimestamp` (`checkout-core:1139-1146`) does `new Date(value).toISOString()`.
  5. ECMA-262 parses a date-only ISO string as **UTC**. `new Date("2026-08-31").toISOString()` =
     `"2026-08-31T00:00:00.000Z"` = **2026-08-31 05:30 IST**.

  **Consequences:**
  - "Expires 31 Aug" → the coupon stops working at **05:30 IST on 31 Aug**; the merchant loses ~18.5 h of the
    intended final day and, more importantly, the whole *intended* last day.
  - "Starts 1 Sep" → the coupon is dead for the first **5 h 30 m** of 1 Sep IST.
  - Correct IST semantics for "valid through 31 Aug" would be `2026-09-01T18:29:59Z`. The stored value is
    **~42.5 hours early**.
- **Round-trip hazard**: `page.tsx:182-183` slices the UTC ISO string (`.split('T')[0]`). Any coupon whose
  timestamp is *not* UTC midnight — e.g. one created through the mobile form, which accepts free-text
  (`apps/mobile/merchant-app/lib/screens/discounts/coupon_form_screen.dart:197`, controller `_expiresAtController`)
  — will display the wrong calendar day and be silently re-saved as that wrong day on the next edit.
- **Display is IST-aware, storage is not**: the list column uses `formatIndiaDate(coupon.expires_at, …)`
  (`page.tsx:537`). So the table shows the merchant an IST-rendered date that disagrees with the UTC instant that
  actually governs the coupon.
- **Gift-card expiry**: `gift_card_accounts.expires_at` is compared `>= NOW()` (`170:203`, `173:238`). The MCP
  gift-card UI **never sets it** (`apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:200-203`
  sends only `initial_value` + `recipient_email`), so no TZ exposure there — but no expiry control either.
- **Financial-year / GST date boundary**: no financial-year handling exists anywhere in the discount or gift-card
  code. GST invoice period boundaries are out of my scope (Agent for GST), but the discount `expires_at` UTC skew
  means a "valid till 31 Mar" campaign closes in the *previous* financial year by IST reckoning.

---

## 7. TASK 6 — PER-SITE CODE SCOPING

**Correct. Coupon codes are scoped per store, not globally.** Proof from the DDL:

- `000_baseline.sql:13731` — `ALTER TABLE ONLY public.coupons ADD CONSTRAINT coupons_site_id_code_key UNIQUE (store_id, code);`
  (the constraint *name* says `site_id` but the columns are `(store_id, code)` — cosmetic naming drift).
- `000_baseline.sql:16961` — `CREATE UNIQUE INDEX idx_coupons_store_code_active ON public.coupons USING btree (store_id, upper(code)) WHERE (deleted_at IS NULL);`
  — this is the case-insensitive per-store guarantee that matters, since lookup normalizes with `UPPER()`
  (`evaluate_checkout_promotion:3925`).

Caveats:
- `coupons.site_id` also exists and is backfilled from `store_id` (`143:14-17`); RLS uses
  `COALESCE(site_id, store_id)` (`143:77`) while all application code and the unique indexes use `store_id`
  (`coupons.ts:63,115,266`; `evaluate_checkout_promotion:3937`). **Dual tenant columns on a live table** — a
  divergence between them would split RLS from uniqueness.
- Gift cards: `gift_card_accounts_site_id_code_hash_key UNIQUE (site_id, code_hash)` (`000_baseline.sql:14147`) —
  correctly per-site.
- `subscription_coupons_code_key ON (upper(code))` (`184:33-34`) — **globally unique, which is correct** for
  platform-level billing coupons.

---

## 8. TASKS 7-10 — GIFT CARDS

### 8.1 Task 7 — BALANCE INVARIANT: **DERIVED. `ANTI-R4` SATISFIED.**

This is the headline *positive* of the domain. Proof:

- The projection formula (identical in three places):
  - `create_checkout_order` — `170_v1_shipping_rates_gst.sql:210-224`
  - `gift_card_available_balance` — `173:32-48`
  - baseline `create_checkout_order` — `000_baseline.sql:1834-1844`

  ```
  SUM(CASE WHEN entry_type IN ('issued','credit','refund_credit','release') THEN amount
           WHEN entry_type IN ('debit','hold','expire','fraud_hold') THEN -amount
           ELSE 0 END)
  ```
- `gift_card_accounts.balance` (`000_baseline.sql:9372`) is written **once**, at issuance, as the initial snapshot
  (`173:108`, `p_initial_value` into both `initial_value` and `balance`) and is **never decremented** anywhere.
  Grep for `SET balance` / `balance = balance` on `gift_card_accounts` returns nothing in migrations or TS.
- The invariant is **machine-pinned**: `scripts/validators/canonical-ledger-only-validator.mjs:174-188` asserts
  `create_checkout_order` *contains* `v_gift_card_balance`, `gift_card_ledger_entries`, `balance_after` and
  *excludes* `UPDATE gift_card_accounts` / `SET balance = balance - v_gift_card_amount`.
- Every read surface uses the projection: `list_gift_cards:178`, `check_gift_card_balance:225`,
  `gift_card_transactions:363`, `issue_gift_card:141`, `set_gift_card_status:281`.
- The legacy mutable-balance table `public.gift_cards` (`000_baseline.sql:9444-9457`) is **DEAD**: zero code
  references (the only repo hit is metadata at `services/api-gateway/src/tenant/tenant-tables.registry.ts:995`).
  It is still present in the schema and still carries a `USING (true) WITH CHECK (true)` policy — see §8.5.

**One latent hole in the projection.** In `create_checkout_order` the SUM has a fallback
(`170:220-223`): `COALESCE(SUM(...), COALESCE(v_gift_card.initial_value, v_gift_card.balance, 0))`. `SUM` returns
NULL only when there are **zero** ledger rows. For a `gift_card_accounts` row created **without** an `'issued'`
entry (any path other than `issue_gift_card` — an import, a manual insert, or the `ON CONFLICT … DO NOTHING` on the
issued entry at `173:138` firing):
- 1st redemption uses `initial_value` as the balance and debits correctly.
- 2nd redemption's SUM = `-debit` (a **negative** number). `create_checkout_order:226`
  `v_gift_card_amount := LEAST(v_gift_card_balance, v_grand_total)` → negative → `:228-230` raises
  *"gift card has no redeemable balance"*.
- Net: **all remaining value on that card is destroyed and the card is bricked.**
- Note `gift_card_available_balance:50` clamps with `GREATEST(…, 0)` — so the merchant *reporting* surface would
  show `0` while `create_checkout_order` sees a negative. The two "canonical" projections are **not identical**.

### 8.2 Task 8 — RPC / IDEMPOTENCY / ON CONFLICT / FOR UPDATE / non-negative CHECK

| Requirement | Status | Evidence |
|---|---|---|
| All money mutations via `SECURITY DEFINER` RPC | **YES** | `gift-cards.ts` uses only `db.rpc(...)` (`:53,88,159,185,211`); zero `.from('gift_card_*').insert/update` anywhere |
| `FOR UPDATE` on the account at redemption | **YES** | `170:206` |
| `FOR UPDATE` on the account at status change | **YES** | `173:275` |
| `FOR UPDATE` on redemptions at restore | **YES** | `174:46` |
| `ON CONFLICT` on redemption row | **YES** | `170:258` on `(site_id, idempotency_key)`, constraint `000_baseline.sql:14179` |
| `ON CONFLICT` on ledger entry | **YES** | `170:277`, `173:138`, `173:305`, `174:67`; constraint `000_baseline.sql:14163` |
| Non-negative enforced **at the DB level** | **YES** | `gift_card_ledger_entries_balance_after_check CHECK (balance_after >= 0)` `000_baseline.sql:9411`; `gift_card_ledger_entries_amount_check CHECK (amount >= 0)` `:9410`; `gift_card_accounts_balance_check CHECK (balance >= 0)` `:9384`; `gift_card_redemptions_amount_check` `:9435` |
| Issuance requires an idempotency key | **YES at the RPC** (`173:81-83`) | but see next row |
| Issuance is idempotent **end to end** | **NO** | `services/api-gateway/src/routes/gift-cards.ts:87` mints `` `gift_card.issue:${store}:${crypto.randomUUID()}` `` on **every** request. The MCP UI (`…/products/gift-cards/page.tsx:197-204`) sends no client key. A double-click, a retry, or a client timeout+retry **issues a second gift card** — real money created twice. `[HIGH-STAKES]` |
| `set_gift_card_status` idempotency | **NO (cosmetic)** | key is `` `gift_card.status:<id>:` || gen_random_uuid() `` (`173:300`) so the `ON CONFLICT DO NOTHING` at `:305` can never fire — every status toggle appends a new audit row. Amount is 0, so no money impact. |
| Money width | **DRIFT** | gift-card and coupon money is `numeric(10,2)`/`numeric(12,2)` (`000_baseline.sql:9370-9371,9399-9400,8823-8825`), not `bigint` minor units. `discount_allocations.amount_minor` (`143:28`) and `subscription_coupons` (`184:15,18`) do it correctly — proving the pattern is known and the older tables were not migrated. Constitution/`AGENTS.md` require paise-minor `bigint` for money. |
| Authorization on issuance | **GAP** | `gift-cards.ts` has **no** `assertStaffPermission` call. Compare `coupons.ts:108,191,232` (`marketing:write`) and `products.ts:1113,1141,1167,1198` (`products:write`). Any principal that clears `verifySiteOwnership` can mint store money. `tests/launch/lb-merchant-admin.test.mjs:145` pins staff-permission coverage for `coupons.ts` (3 sites) but **not** for `gift-cards.ts`. |
| Step-up on issuance | **ABSENT** | governance requires real-HMAC step-up on refund/payout; gift-card issuance is money *creation* and has none. Not a stated violation — a stated gap. |
| Validator coverage | **PARTIAL** | `canonical-ledger-only-validator.mjs:12-25` lists `gift_card_accounts` and `gift_card_ledger_entries` but **omits `gift_card_redemptions`** — a direct TS write to that table would pass the gate. (No such write exists today.) |

### 8.3 Task 9 — CONCURRENCY (GIFT CARDS): **SAFE for same-card double-spend**

- `create_checkout_order:198-206` takes `FOR UPDATE` on the `gift_card_accounts` row **before** projecting the
  balance (`:210-224`). Under READ COMMITTED, the second transaction blocks on the lock, and after acquiring it
  re-executes the ledger SUM as a *new* statement, so it sees the first transaction's committed `'debit'`.
  → **Two simultaneous redemptions of the same card cannot overspend.**
- Lock ordering across the RPC is consistent (`orders` row `170:178-183` → gift card `170:206`), so deadlock risk
  is low.
- `balance_after >= 0` (`000_baseline.sql:9411`) is the DB-level backstop if the lock were ever lost.
- **Residual**: the redemption amount is `LEAST(balance, grand_total)` — there is no partial-redemption UI, no
  "apply ₹X of my ₹Y card". Partial use happens implicitly (the remainder stays on the card) but is not
  merchant/customer controllable.

### 8.4 Task 10 — REFUND RESTORATION: **wired, but wired WRONG on partial refunds and missing on returns**

`restore_gift_card_on_refund` (`174:18-89`) is **not** dormant. Call sites:
1. `services/api-gateway/src/routes/orders.ts:1195-1211` — inside `PATCH /orders/:id` when
   `body.status === 'cancelled' || body.status === 'refunded'` (`:1178`). Whole-order reversal → **correct**.
2. `services/api-gateway/src/routes/orders.ts:1393-1409` — inside `POST /orders/:id/refund/complete` (`:1342`),
   **unconditionally**, with no comparison of the refunded amount to the order total.

Defect at call site 2: `POST /orders/:id/refund` (`orders.ts:1427`) accepts `lines`
(`order-execution.adapter.ts:486-495`, `create_order_return_and_refund` with `p_lines`), i.e. **partial** refunds.
When that partial refund is completed, `restore_gift_card_on_refund` restores **every** committed redemption on the
order at **full amount** (`174:39-47,51-67`). Migration 174's own header (`174:14-16`) says *"Partial refunds of
gift-card orders are deliberately NOT auto-split here"* — the RPC honours that by not splitting; the **call site
does not honour it by not gating**. Net: partial money refund **plus** full gift-card credit = the merchant pays
out more than the order was worth. `[HIGH-STAKES]` `[IRREVERSIBLE]` (the credit is an append-only ledger entry;
reversing it requires a compensating entry no code writes).

Missing call site: `services/api-gateway/src/routes/returns.ts:279` (`POST /returns/:id/refund/complete`) calls
`complete_order_refund` with **no** gift-card restore. A refund processed through the returns workflow silently
destroys the customer's gift-card value — exactly the bug migration 174 was written to fix, left open on one of
the three refund entry points.

Minor: `174:70` uses `IF FOUND` after `INSERT … ON CONFLICT DO NOTHING` to decide whether to flip the redemption to
`'released'`. Correct for double-credit prevention, but if the credit already exists the redemption stays
`'committed'` forever and is re-scanned on every subsequent call.

---

## 9. TASK 11 — ADMIN UI, CUSTOMER DELIVERY, REPORTING

### 9.1 Merchant admin — web (MCP)

**Coupons** (`apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`, 600 lines):
- Present: code, type (percentage / fixed_amount / free_shipping), value, min purchase, max uses, start date,
  expiry date, active toggle, list with `used_count/max_uses` (`:535`) and IST-formatted expiry (`:537`).
- **Absent** (accepted by `CreateCouponSchema` but never sent by the proxy `coupons/route.ts:17-28`):
  `description`, `maximum_discount` (**percentage coupons are therefore always uncapped**), `per_customer_limit`,
  `applicable_products`, `applicable_categories`, `discount_class`, `combines_with`, `automatic`, `priority`.
- No preview, no "which products does this apply to", no revenue-impact figure.

**Gift cards** (`apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx`, 604 lines):
- Present: issue (value + recipient email `:200-203`), one-time code reveal + copy (`:242-249`), list with
  projected balance / status / recipient / redemption count (from `list_gift_cards:173-190`), transactions drawer
  (`gift_card_transactions`), disable / reactivate (`:251-268`).
- **Absent**: expiry date on issue, currency, sender note, recipient name, customer linkage, bulk issuance,
  resend-email, adjust/void with a compensating credit, **total outstanding liability**.

### 9.2 Merchant admin — mobile (Flutter) — **DIVERGES FROM WEB**

- `apps/mobile/merchant-app/lib/screens/discounts/coupon_form_screen.dart` exposes **more** than the web form:
  description (`:139`), minimum (`:164`), **maximum** (`:171`), usage limit (`:181`), **per-customer limit**
  (`:189`), expiry (`:197`). So `maximum_discount` and `per_customer_limit` are settable on mobile and
  **not** settable on web — two merchant clients with different capability for the same money rule.
- `apps/mobile/merchant-app/lib/services/coupon_service.dart:78-85` calls `_api.coupons.validate({store_id, code,
  subtotal})`. The gateway schema is `ValidateCouponSchema` = `{store_id, code, order_total, …}`
  (`packages/checkout-core/src/index.ts:990-996`) where `order_total: MoneySchema`
  (`packages/shared-types/src/index.ts:52-55`) is **required**. The mobile sends `subtotal`, not `order_total`
  → the request fails schema validation. **Mobile coupon validation is BROKEN.**
- `coupon_service.dart:26-33` passes `is_active` as a list filter; `ListCouponsQuery`
  (`checkout-core:998-1001`) only understands `status` → the filter is silently ignored.
- `apps/mobile/merchant-app/lib/screens/discounts/gift_cards_screen.dart:394-467` issues with value + free-text
  ISO expiry, **no recipient email** → no delivery. The plaintext code is shown only via
  `card.code.isEmpty ? card.id : card.code` (`:269`) in the ephemeral in-memory list; after any refresh
  `list_gift_cards` returns no `code`, so the row shows the **UUID** and the plaintext is unrecoverable. A card
  issued on mobile and not transcribed immediately is a permanent, unredeemable liability.
- `gift_cards_screen.dart:68` `_totalBalance` is the **only** aggregate gift-card liability figure in the entire
  product.

### 9.3 Customer-facing surfaces

| Capability | Status | Evidence |
|---|---|---|
| Apply a coupon at checkout | present | `checkout-client.tsx:1099-1120` |
| See why a coupon failed | present (mapped strings) | `storefrontCouponValidationError` `checkout-core:1408-1424` |
| **Apply a gift card at checkout** | **MISSING** | no gift-card input in `checkout-client.tsx`; grep of `apps/storefront-runtime/src` for `gift_card`/`giftCard` → 1 hit, the API passthrough at `app/api/orders/route.ts:55` |
| Check my gift-card balance | **MISSING** | `check_gift_card_balance` is exposed only behind merchant auth + `verifySiteOwnership` (`gift-cards.ts:146-157`) |
| Receive the gift-card code by email | present, best-effort | `gift-cards.ts:116-140` → `gift-card-email.ts:78-131` |
| Automatic / cart-level promotions on the storefront | **NOT IMPLEMENTED** | no reader of `coupons.automatic` |

**Email delivery notes** (`services/api-gateway/src/lib/gift-card-email.ts`):
- The **plaintext gift-card code is placed into the queue message payload** (`:88` `payload: email`, where
  `email.text`/`email.html` embed the code at `:52,61`). The envelope is signed (`signQueueTenantEnvelope` `:96`)
  but the bearer value itself is a redeemable money instrument sitting in queue storage. Worth a security decision.
- `greetingName` (`:38`), `note` (`:40`), and `fromStore` (`:39`) are interpolated into HTML at `:59-64`
  **without escaping** → HTML/markup injection into the outbound email from merchant- and staff-controlled fields.
- If neither `NOTIFICATION_QUEUE` nor a real `RESEND_API_KEY` is configured, the send is skipped with a warn log
  (`:102-112`) and the caller still returns 201 with the code — issuance succeeds, delivery silently does not.
  The merchant's only recovery is the one-time on-screen reveal.

### 9.4 Reporting

- **No discount reporting.** Grep of `services/api-gateway/src/routes/analytics.ts` and
  `commerce-analytics.ts` for `coupon` / `discount` / `gift_card` → **zero hits**.
- **No gift-card liability reporting** on web. `orders.discount_total` / `gift_card_total` are persisted on
  `checkout_sessions` (`000_baseline.sql:8700-8701`) and `orders.discount` is in the CSV export
  (`services/api-gateway/src/routes/export.ts:92,510`) — that is the entirety of it.
- `order_line_adjustments` (`000_baseline.sql:10069`) records `promotion` / `gift_card` adjustment rows but has no
  read surface.

---

## 10. TASK 12 — TESTS

| Test file | What it actually does | Verdict |
|---|---|---|
| `services/api-gateway/src/__tests__/discounts.test.ts` (47 lines, 2 tests) | `readFileSync` + `assert.match` regexes over migration 143, `index.ts`, `coupons.ts`, `checkout-core/src/index.ts` | **STUB_OR_MOCK** — asserts text exists, never executes anything. `:43` literally asserts `/export function planDiscountStack/` while nothing calls it. |
| `tests/executable/discount-postgres.test.mjs` (1 test) | Real Postgres (docker) — applies migration 143, checks `discount_allocations` RLS isolation, rolls back | **Real**, but scoped to DDL/RLS of a table with **zero writers**. Tests no discount behaviour. |
| `packages/checkout-core/test/checkout-core.test.ts:100,138` | Two `planDiscountStack` unit cases | **Real unit test of dead code.** |
| `tests/launch/lb11-giftcards.test.mjs` (11 tests) | 100% `readFileSync` + `assert.match` over migration 173, `gift-cards.ts`, `products.ts`, `gift-card-email.ts`, `queue-workers/src/index.ts`, `commerce-core`, `api-client`, the MCP page | **STUB_OR_MOCK** — no RPC is executed, no card is issued, no balance is computed |
| `tests/launch/lb11-refund-restore.test.mjs` (6 tests) | Same regex-on-source pattern over migration 174 + `orders.ts`. `:46` asserts the PATCH handler contains the call; **no test asserts the `refund/complete` call site is gated on full-vs-partial** | **STUB_OR_MOCK** |
| `tests/launch/lb-merchant-admin.test.mjs:145` | Asserts `coupons.ts` has 3 `assertStaffPermission(... 'marketing:write')` sites | Regex; and it does **not** cover `gift-cards.ts` — which is why the missing staff check there is invisible to the gate |
| e2e | grep of `tests/e2e/` for `coupon`/`gift` → **zero hits** | **MISSING** |

**Coverage that does not exist anywhere:**
- No test issues a gift card and redeems it.
- No test asserts the balance projection numerically.
- No concurrency test (coupon usage limit, gift-card double-spend).
- No test of `evaluate_checkout_promotion` behaviour at all.
- No timezone/date-boundary test.
- No test that a partial refund does not over-restore.
- No test that a returns-path refund restores gift-card value (it doesn't).

---

## 11. TENANCY / RLS POSTURE FOR THIS DOMAIN

- `coupons` + `discount_allocations`: `ENABLE` **and** `FORCE`, plus GUC policy `coupons_tenant_site_guc` /
  `discount_allocations_tenant_site_guc` (`143:67-86`). Correct by the letter of R-1..R-4.
- `gift_card_accounts` / `gift_card_ledger_entries` / `gift_card_redemptions`: the **baseline** gives them only
  `ENABLE` + a `auth.role() = 'service_role'` policy (`000_baseline.sql:24836-24877`) — no FORCE, no GUC.
  **Corrected by migration 164**: `164_d4_tenant_role_guc.sql:33-76` iterates every `public` base table with a
  `site_id`/`store_id` column and applies `ENABLE` + **`FORCE`** + `CREATE POLICY … FOR ALL TO app_tenant USING
  (site_id = public.current_site_id())`. All four gift-card tables and `coupons` are covered by that loop.
  → **My initial reading was wrong and I am correcting it: FORCE + GUC do exist, applied dynamically.**
- **But**: the GUC policy is `FOR ALL TO app_tenant`, and the gateway does **not** use that role. `getSupabaseAdmin`
  (`services/api-gateway/src/lib/supabase.ts:13-19`) returns `createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))`
  — the service-role, RLS-bypassing client wrapped by an in-process guard. Grep of `services/api-gateway/src` for
  `app_tenant` / `SET LOCAL ROLE` returns hits **only in test files**
  (`__tests__/tenant-load-bearing-d4.test.ts:21-27`, which regex-check the migration text). So for coupons and gift
  cards, tenant isolation in production rests on **`verifySiteOwnership` in TypeScript**, not on DB RLS.
  This is the platform-wide `ANTI-R5` posture, not a discount-specific discovery — flagged for the tenancy agent.
- **`public.gift_cards` (legacy, DEAD) carries `CREATE POLICY service_role_gift_cards ON public.gift_cards USING
  (true) WITH CHECK (true)` (`000_baseline.sql:26666`) with no `TO` clause** → it applies to `PUBLIC`. Whether that
  is exploitable depends on table grants to `anon`/`authenticated`, which are **not present in the repo's
  migrations** (Supabase manages them out-of-band). `UNKNOWN` severity; the correct action is deletion of the dead
  table per `LETBUYY_CANONICAL_SYSTEMS.md:166`, which removes the question.
- **Function EXECUTE grants — an evidenced asymmetry.** `184_v1_subscription_coupons.sql:213-216` explicitly does
  `REVOKE ALL ON FUNCTION … FROM PUBLIC` and then grants selectively. Migrations `173` and `174` — which define
  `issue_gift_card` (mints money), `set_gift_card_status`, and `restore_gift_card_on_refund` (credits money) — contain
  **no `REVOKE` and no `GRANT`**. PostgreSQL's default is `EXECUTE` to `PUBLIC` for new functions. Neither `173`,
  `174`, `170`, nor `000_baseline.sql` revokes them (repo-wide grep for `REVOKE` returns only
  `165:463-464`, `163:202,216`, `195:327`). These are `SECURITY DEFINER` functions that take `p_store_id` as a
  **parameter** and perform no internal ownership check. If PostgREST exposes them to `anon`, an unauthenticated
  caller could mint gift cards for an arbitrary site. I could not verify the effective grants without a DB
  connection → **`CONTRADICTORY_EVIDENCE` / must be resolved by a live `\df+` check.** The asymmetry against
  migration 184 is itself strong evidence that this was an omission, not a decision.

---

## 12. GAP LIST

Provisional IDs `G-I-nn`. Commander to renumber.

---

### G-I-01 — The governance-canonical typed discount engine is dormant; the demoted scalar RPC is the live checkout engine
- **Domain**: Discounts · **Status**: `DORMANT_FLAGGED` (typed engine) + `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (scalar engine)
- **Impact**: The platform cannot express any of the discount semantics the Constitution says it must
  (`combines_with` matrix, product/order/shipping classes, automatic discounts, stacking). Merchants get one code
  per order, no cap on percentage, no product targeting. The `combines_with` fields *are* configurable and *are*
  returned as valid by `POST /coupons/validate`, so the API misrepresents platform behaviour.
- **Evidence**: `LETBUYY_CANONICAL_SYSTEMS.md:90,210-213` (`DOC_CLAIM`); `packages/checkout-core/src/index.ts:1204-1269`
  (`SERVICE_CODE`); call-site grep → only `packages/checkout-core/test/checkout-core.test.ts:100,138` (`UNIT_TEST`);
  `database/supabase/migrations/170_v1_shipping_rates_gst.sql:39,185-193` (`RPC_FUNCTION`);
  `services/api-gateway/src/index.ts:807-808` (`GATEWAY_CODE`); `143_executable_discount_stack.sql:19-38` with zero
  writers (`DB_SCHEMA`); `services/api-gateway/src/__tests__/discounts.test.ts:40-46` (`UNIT_TEST`).
- **Expected**: ART-15 — the typed engine evaluates the cart, writes `discount_allocations`, and the scalar RPC is
  `LEGACY`.
- **Root cause**: Task 007 delivered the schema + a pure allocator + an alias mount, and shipped regex tests that
  assert existence rather than invocation. `planDiscountStack` also only *allocates* pre-computed `amountMinor`
  values — the rule-evaluation half of the engine was never written.
- **Blast radius**: every order; `create_checkout_order`, `evaluate_checkout_promotion`, `coupons` table,
  `discount_allocations`, the coupons/discounts API, both merchant clients, the storefront checkout.
- **Invariant**: none directly, but `WIN-R4` / `ANTI-R1` / `ANTI-R3`.
- **Severity** P1 · **Likelihood** HIGH (certain — it is the current state) · **Reversibility** reversible
- **Dependencies**: G-I-02 (the third model), G-I-05 (single-code parameter), the checkout agent's order-path findings.
- **Remediation approach**: ARB decision first — either (a) build the missing rule-evaluation half of the typed
  engine, route `create_checkout_order` through it, write `discount_allocations`, and mark
  `evaluate_checkout_promotion` `TRANSITIONAL`→`LEGACY` per `LETBUYY_CANONICAL_SYSTEMS.md:213`; or (b) formally
  re-litigate the winner and demote the typed engine, deleting `discount_allocations` and the typed columns. What
  must **not** continue is both existing with the loser live. Replace the regex tests with behavioural tests that
  fail if `planDiscountStack` has no runtime caller.
- **Acceptance**: one engine reachable from checkout; a test asserts a discount row lands in the chosen
  allocation table; the demoted engine is annotated `LEGACY` with a deletion wave.
- **Tests required**: integration (Postgres) — apply two combinable and two non-combinable discounts, assert the
  allocation set; a static test that fails when a "canonical" exported engine has zero non-test callers.
- **Owner**: ARB + lead engineer · **Confidence**: HIGH

---

### G-I-02 — A third, write-surface-less promotion model is evaluated ahead of coupons in the live money path
- **Domain**: Discounts · **Status**: `DORMANT_FLAGGED`
- **Impact**: `evaluate_checkout_promotion` queries `promotion_codes ⨝ promotions ⨝ promotion_effects` **first** and
  only falls back to `coupons`. Nothing can create those rows. Dead branch in the hottest money RPC; also the
  source of the promotion-level usage-limit race (G-I-09). If rows ever appear (import, ops script, future
  feature), they silently outrank every merchant coupon.
- **Evidence**: `000_baseline.sql:3890-3921` (promotion branch, `RPC_FUNCTION`) vs `:3922-3942` (coupon fallback);
  grep for `promotion_codes` / `from('promotions')` across `services/api-gateway/src` +
  `apps/merchant-control-plane/src` → only `services/api-gateway/src/tenant/tenant-tables.registry.ts:1807,1829`
  (`GATEWAY_CODE`); coupon redemptions are nevertheless written into `promotion_redemptions`
  (`000_baseline.sql:2002-2032`) and `promotion_usage_counters` (`:2044-2061`).
- **Expected**: one discount model per `WIN-R4`.
- **Root cause**: UNKNOWN — an older promotions design was schema'd and half-wired, then coupons were bolted into
  the same evaluation function.
- **Blast radius**: `evaluate_checkout_promotion`, 6 tables, all orders.
- **Invariant**: `[HIGH-STAKES]` (it is inside the money RPC) · **Severity** P2 · **Likelihood** MEDIUM
- **Remediation approach**: as part of the G-I-01 ARB decision, either give promotions a real surface or strip the
  branch from the RPC and mark the tables `LEGACY` with a deletion wave. Do not leave a higher-precedence dead
  branch inside a money function.
- **Acceptance**: `evaluate_checkout_promotion` (or its successor) reads exactly one model.
- **Owner**: ARB · **Confidence**: HIGH

---

### G-I-03 — `POST /orders/:id/refund/complete` over-restores gift-card value on partial refunds
- **Domain**: Gift cards / refunds · **Status**: `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (defect present in code)
- **Impact**: A merchant refunds ₹200 of a ₹1,000 order that was paid ₹1,000 by gift card. The customer receives
  ₹200 back **and** the full ₹1,000 is credited back onto the gift card. Direct, silent merchant loss, repeatable.
- **Evidence**: `services/api-gateway/src/routes/orders.ts:1342` (route accepts partial refund completion),
  `:1393-1409` (unconditional `db.rpc('restore_gift_card_on_refund')`) — `GATEWAY_CODE`;
  `services/api-gateway/src/routes/orders.ts:1427` + `services/api-gateway/src/execution/order-execution.adapter.ts:486-495`
  (partial refunds via `p_lines`) — `SERVICE_CODE`;
  `database/supabase/migrations/174_v1_gift_card_refund_restore.sql:39-47,51-67` (restores **all** committed
  redemptions at full amount) and `:14-16` (the header explicitly says partial refunds are not split) — `RPC_FUNCTION`.
- **Expected**: restore proportionally to the refunded amount, or refuse to auto-restore on partial refunds and
  surface a merchant decision.
- **Missing link**: the call site has no full-vs-partial gate.
- **Blast radius**: every gift-card-funded order that is partially refunded.
- **Invariant**: `[HIGH-STAKES]` `[IRREVERSIBLE]` (append-only credit; no compensating-entry path exists)
- **Severity** P0 · **Likelihood** MEDIUM (needs a gift-card order + a partial refund; both are supported features)
- **Dependencies**: G-I-04 (the returns path), G-I-06 (no gift-card checkout UI reduces today's reachability)
- **Remediation approach**: gate the restore on "the refund reverses the whole order" (compare the refunded total
  against `orders.total + gift_card_total`, or read the refund row's line coverage), and add a proportional split
  RPC for partial cases with its own idempotency key. **Never** write `gift_card_ledger_entries` from TypeScript —
  extend or add a `SECURITY DEFINER` RPC.
- **Acceptance**: a partial refund restores at most the refunded share; a full refund restores exactly once; both
  are idempotent under replay.
- **Tests required**: Postgres integration — full refund restores once; partial refund restores the proportional
  amount; double-completion credits nothing extra.
- **Owner**: lead engineer + ARB (money RPC) · **Confidence**: HIGH

---

### G-I-04 — The returns refund path never restores gift-card value
- **Domain**: Gift cards / returns · **Status**: `NOT_IMPLEMENTED` (on that path)
- **Impact**: A refund completed through the returns workflow silently destroys the customer's redeemed gift-card
  balance — precisely the bug migration 174 exists to fix, left open on one of three entry points.
- **Evidence**: `services/api-gateway/src/routes/returns.ts:279-286` calls `complete_order_refund` with no
  subsequent `restore_gift_card_on_refund` (`GATEWAY_CODE`); contrast `orders.ts:1198` and `:1396`
  (`GATEWAY_CODE`); `174:1-6` states the destruction consequence (`RPC_FUNCTION`).
- **Expected**: every refund-completion path restores gift-card tender.
- **Missing link**: the call was added to `orders.ts` only.
- **Blast radius**: all returns-driven refunds of gift-card-funded orders.
- **Invariant**: `[HIGH-STAKES]` `[IRREVERSIBLE]` · **Severity** P1 · **Likelihood** MEDIUM
- **Remediation approach**: fold gift-card restoration into `complete_order_refund` itself (one place, inside the
  transaction) rather than replicating the call at every route — that also fixes future paths. Requires ARB because
  `complete_order_refund` is validator-pinned.
- **Acceptance**: restoring is a property of refund completion, not of a particular route; a test proves all three
  entry points restore.
- **Owner**: ARB + lead engineer · **Confidence**: HIGH

---

### G-I-05 — Coupon start/expiry are stored as UTC midnight from a bare `type="date"` input (India-first date bug)
- **Domain**: Discounts / India-first · **Status**: `BROKEN`
- **Impact**: Every date-bounded campaign is wrong by up to ~29.5 hours. "Expires 31 Aug" stops working at
  05:30 IST on 31 Aug; "Starts 1 Sep" is dead for the first 5.5 hours of the day. Merchants will read this as
  "the coupon randomly stopped working". Compounded because the list column renders the value with
  `formatIndiaDate` (`page.tsx:537`), so the UI shows an IST date that disagrees with the governing instant.
- **Evidence**: `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:455,461` (`type="date"`) and `:207-208`
  (bare string sent) — `UI_CODE`;
  `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts:25-26` (passthrough) — `PROXY_CODE`;
  `packages/checkout-core/src/index.ts:982-983` (`z.coerce.date()`) and `:1139-1146` (`toCouponIsoTimestamp` →
  `new Date(v).toISOString()`) — `SERVICE_CODE`;
  `database/supabase/migrations/000_baseline.sql:3936-3937` (`NOW()` comparison, correct in kind) — `RPC_FUNCTION`;
  edit-hydration slice `page.tsx:182-183` — `UI_CODE`.
- **Expected**: `starts_at` = start-of-day IST; `expires_at` = end-of-day IST (`23:59:59.999+05:30`), stored as the
  correct UTC instant.
- **Missing link**: no timezone normalization anywhere between the date picker and the DB.
- **Blast radius**: every coupon; both merchant clients; `evaluate_checkout_promotion`; the storefront preview.
- **Invariant**: none (no money invariant) but merchant-trust critical · **Severity** P1 · **Likelihood** HIGH (certain)
- **Remediation approach**: normalize at one boundary — convert merchant-entered dates to IST day boundaries before
  persisting, and render stored instants back in IST for the form. Do the conversion in `checkout-core` so all
  clients inherit it. Add a stated policy (store-timezone vs platform-IST) — the platform is India-first, so IST is
  the sane default, but a merchant-timezone field is the more correct long-term answer.
- **Acceptance**: a coupon set to expire 31 Aug is valid at 23:59 IST on 31 Aug and invalid at 00:01 IST on 1 Sep;
  editing an existing coupon shows the same date the merchant entered.
- **Tests required**: unit tests over `toCouponIsoTimestamp` for IST boundaries; an integration test that fixes
  `NOW()` around the IST boundary.
- **Owner**: lead engineer · **Confidence**: HIGH

---

### G-I-06 — Gift cards have no customer-facing surface: no checkout input, no balance check
- **Domain**: Gift cards · **Status**: `BACKEND_ONLY`
- **Impact**: The entire gift-card redemption engine (schema, ledger, RPC, `FOR UPDATE`, refund restore) is
  unreachable by a customer. A merchant can issue and email a code; the recipient has nowhere to enter it.
  Redemption is reachable only by hand-crafting a `giftCardCode` field in the order API.
- **Evidence**: grep of `apps/storefront-runtime/src` for `gift_card`/`giftCard` → one hit,
  `apps/storefront-runtime/src/app/api/orders/route.ts:55` (`UI_CODE`); the checkout client has a coupon input
  (`checkout-client.tsx:1099-1120`) and no gift-card input (`UI_CODE`); the gateway accepts it
  (`services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:388`, `GATEWAY_CODE`); the RPC implements
  it (`170:196-278`, `RPC_FUNCTION`); balance check is merchant-auth-gated (`gift-cards.ts:146-157`, `GATEWAY_CODE`).
- **Expected**: gift-card field in checkout, applied balance line in the summary, and a public
  "check my balance" surface.
- **Missing link**: storefront UI.
- **Blast radius**: the whole gift-card feature; also masks the reachability of G-I-03/G-I-04 today.
- **Invariant**: `[HIGH-STAKES]` (it gates money movement) · **Severity** P1 · **Likelihood** HIGH (certain)
- **Remediation approach**: add the gift-card field to the storefront checkout and a **rate-limited, code-hash-based**
  public balance endpoint. Do **not** expose `check_gift_card_balance` publicly as-is — it is a code-guessing
  oracle. Add Turnstile/rate-limit, return only masked data.
- **Acceptance**: a customer can redeem an emailed code end-to-end; a partial redemption leaves the remainder
  spendable; the storefront shows the applied amount and the residual payment due.
- **Tests required**: e2e issue→email→redeem→partial-remainder; abuse test for the balance endpoint.
- **Owner**: founder (product decision) + lead engineer · **Confidence**: HIGH

---

### G-I-07 — Gift-card issuance is not idempotent and has no staff-permission gate
- **Domain**: Gift cards · **Status**: `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (defect present)
- **Impact**: (a) Every `POST /products/gift-cards` mints a fresh idempotency key, so a double-click, a client
  timeout+retry, or a proxy retry **issues a second card** — money created twice, with no linkage between them.
  (b) There is no `assertStaffPermission` on any gift-card route, so any principal passing `verifySiteOwnership`
  can mint store money — while the *less* dangerous coupon routes are gated on `marketing:write`.
- **Evidence**: `services/api-gateway/src/routes/gift-cards.ts:87` (`crypto.randomUUID()` per call) — `GATEWAY_CODE`;
  `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:197-204` (no client key) — `UI_CODE`;
  `database/supabase/migrations/173_v1_gift_card_issuance_lifecycle.sql:81-83,91-97` (the RPC *is* idempotent on the
  key it is given) — `RPC_FUNCTION`; absence of `assertStaffPermission` in `gift-cards.ts` vs presence at
  `services/api-gateway/src/routes/coupons.ts:108,191,232` and
  `services/api-gateway/src/routes/products.ts:1113,1141,1167,1198` — `GATEWAY_CODE`;
  `tests/launch/lb-merchant-admin.test.mjs:145` pins the coupon check and omits gift cards — `UNIT_TEST`.
- **Expected**: a client-supplied idempotency key threaded end-to-end (as `orders`/`checkout` already do via
  `IdempotencyExecutionAdapter`), and a `marketing:write`-or-stronger permission on money creation.
- **Blast radius**: every gift card ever issued; store liability.
- **Invariant**: `[HIGH-STAKES]` `[IRREVERSIBLE]` (an over-issued card is redeemable money)
- **Severity** P1 · **Likelihood** HIGH (a double-click is enough)
- **Remediation approach**: require an `Idempotency-Key` header / body field on issuance and pass it to
  `issue_gift_card`; add `assertStaffPermission(…, 'marketing:write')` (or a dedicated `giftcards:issue`) to all
  five gift-card routes; consider step-up for issuance above a threshold, consistent with the refund/payout policy.
- **Acceptance**: replaying the same issuance request returns the same card; a staff member without the permission
  gets 403; the staff-permission test covers `gift-cards.ts`.
- **Owner**: security + lead engineer · **Confidence**: HIGH

---

### G-I-08 — Coupon product/collection restrictions and automatic discounts are accepted and silently discarded
- **Domain**: Discounts · **Status**: `NOT_IMPLEMENTED` (presented as `UI_ONLY`/API-only)
- **Impact**: An API client (or the mobile app, or a future web form) can set `applicable_products` /
  `applicable_categories`; the request succeeds; the values are never stored and never enforced. A coupon a
  merchant believes is limited to one product applies to the entire cart. Likewise `automatic: true` is persisted
  and never acted on — no automatic discount ever applies.
- **Evidence**: `packages/checkout-core/src/index.ts:980-981` (schema accepts them) vs `:1304-1326`
  (`planCouponCreate` omits them) and `:1113-1129` (`COUPON_UPDATE_FIELDS` omits them) — `SERVICE_CODE`;
  columns exist `database/supabase/migrations/000_baseline.sql:8843-8844` — `DB_SCHEMA`;
  `evaluate_checkout_promotion:3873-4032` never references them — `RPC_FUNCTION`;
  `automatic` written at `checkout-core:1314`, zero readers — `SERVICE_CODE`.
- **Expected**: either enforce at redemption or reject the fields at the API boundary.
- **Missing link**: the persist plan and the evaluation RPC.
- **Blast radius**: any merchant/integrator relying on targeted or automatic discounts.
- **Invariant**: `[HIGH-STAKES]` (uncontrolled discount scope on money) · **Severity** P1 · **Likelihood** MEDIUM
- **Remediation approach**: part of the G-I-01 engine decision. In the interim, the honest fix is to **reject**
  unsupported fields with a clear 422 rather than accept-and-drop (`ANTI-R9` spirit — no silent success).
- **Acceptance**: either a product-restricted coupon fails to apply to an ineligible cart, or setting the field
  returns an explicit "not supported in V1" error.
- **Owner**: lead engineer · **Confidence**: HIGH

---

### G-I-09 — Per-customer limits are email-string-based and have no DB backstop; promotion-level limit is racy
- **Domain**: Discounts / abuse · **Status**: `PARTIAL`
- **Impact**: `per_customer_limit` is enforced by counting `promotion_redemptions` rows matching a lowercased
  email. Guest checkout carries no `customer_id`, so `a+1@x.com`, `a+2@x.com`, or any fresh address defeats it
  entirely. Separately, the promotion-level `usage_limit` is checked while holding a lock on `promotion_codes` only
  → concurrent redemptions of two different codes of the same promotion can both pass (dormant today, see G-I-02).
- **Evidence**: `database/supabase/migrations/000_baseline.sql:3982-4004` (email-based count) and `:3916`
  (`FOR UPDATE OF pc`) vs `:3966-3976` (count over the whole promotion) — `RPC_FUNCTION`; no
  `UNIQUE (coupon_id, customer_email)` index in `000_baseline.sql` or `143` — `DB_SCHEMA`; public storefront tenant
  context has no customer binding, `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:264` —
  `GATEWAY_CODE`.
- **Expected**: per-customer limits keyed on an authenticated customer identity where one exists, with a DB unique
  backstop; promotion-level limits locked at the promotion row.
- **Blast radius**: coupon abuse / margin leakage.
- **Invariant**: `[HIGH-STAKES]` · **Severity** P2 · **Likelihood** HIGH for the email bypass, LOW for the race
  (promotions unreachable)
- **Remediation approach**: bind to `store_customers.id` when the buyer is logged in; add a normalized-email +
  optional phone fallback for guests; add a partial unique index as a DB backstop; if promotions are kept, lock the
  promotion row not just the code row.
- **Acceptance**: a limit-1 coupon cannot be used twice by the same authenticated customer; a concurrency test
  proves the promotion-level limit holds.
- **Owner**: lead engineer + founder (guest-abuse policy) · **Confidence**: HIGH

---

### G-I-10 — GST is computed on the pre-discount amount
- **Domain**: Discounts × GST · **Status**: `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (defect present)
- **Impact**: The customer is charged GST on the undiscounted value; the invoice overstates output tax; the
  merchant's GSTR filings will not reconcile with the amount actually collected. Under CGST Act s.15(3)(a) a
  discount recorded at the time of supply reduces the taxable value.
- **Evidence**: `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:346-360` passes
  `discount_amount_minor: 0` into `calculateGstLine` (`:353`) — `GATEWAY_CODE`;
  `database/supabase/migrations/170_v1_shipping_rates_gst.sql:159` `v_tax_amount := COALESCE(p_tax_amount, 0)` and
  `:194` `grand_total = subtotal + shipping + tax − discount` (tax computed before discount is known) —
  `RPC_FUNCTION`; `calculateGstLine` supports `discount_amount_minor` as a first-class field (the gateway just
  never populates it).
- **Expected**: discount is resolved server-side **before** GST, allocated to lines, and passed into
  `calculateGstLine`.
- **Missing link**: the gateway computes tax before it knows the discount; the discount is resolved inside the RPC
  afterwards. Ordering inversion.
- **Blast radius**: every discounted order's invoice and tax liability.
- **Invariant**: `[HIGH-STAKES]` · **Severity** P1 · **Likelihood** HIGH (any discounted order in a GST-registered store)
- **Dependencies**: G-I-01 (the discount engine must be able to allocate to lines before tax).
- **Remediation approach**: move discount resolution ahead of GST computation — either compute the discount in the
  gateway before the tax loop (using the same server-authoritative source) or move GST computation inside
  `create_checkout_order` after the discount is known. Cross-check with the GST agent; the invoice is immutable, so
  this must be right before any real invoice is issued.
- **Acceptance**: a ₹5,000 order with a ₹500 coupon shows GST computed on ₹4,500 on the order and the invoice.
- **Owner**: CA-tax + ARB + lead engineer · **Confidence**: HIGH (on the code path); the legal characterization
  should be confirmed by the CA.

---

### G-I-11 — Coupon "delete" only deactivates, and the code can then never be reused
- **Domain**: Discounts / UX · **Status**: `PARTIAL`
- **Impact**: `DELETE /v1/coupons/:id` sets `is_active = false` and leaves `deleted_at` NULL, so the row keeps
  occupying `UNIQUE (store_id, upper(code)) WHERE deleted_at IS NULL`. Re-creating a retired code returns 409
  forever. The list keeps growing. The mobile client removes the row locally, so it reappears on refresh.
- **Evidence**: `services/api-gateway/src/routes/coupons.ts:235-238` — `GATEWAY_CODE`;
  `database/supabase/migrations/000_baseline.sql:16961` (partial unique index) — `DB_SCHEMA`;
  `coupons.ts:112-117` (pre-insert check with no `deleted_at` filter) — `GATEWAY_CODE`;
  `apps/mobile/merchant-app/lib/services/coupon_service.dart:73-77` — `UI_CODE`.
- **Expected**: soft-delete sets `deleted_at`; the code becomes reusable; deleted coupons drop out of the list.
- **Severity** P2 · **Likelihood** HIGH · **Invariant**: none
- **Remediation approach**: set `deleted_at` on delete, filter it in list/get/create-uniqueness, and keep
  `is_active` for pause/resume. Verify `evaluate_checkout_promotion:3929` already excludes `deleted_at IS NOT NULL`
  (it does) so no checkout regression.
- **Owner**: lead engineer · **Confidence**: HIGH

---

### G-I-12 — Merchant web UI cannot set the discount cap, per-customer limit, or description; mobile can
- **Domain**: Discounts / UI parity · **Status**: `PARTIAL`
- **Impact**: On the web, every percentage coupon is **uncapped** (a "20% off" coupon on a ₹50,000 order gives away
  ₹10,000 with no ceiling) and `per_customer_limit` is stuck at the schema default of 1. The mobile merchant app
  exposes both. Two clients, two different money rules.
- **Evidence**: `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts:17-28` and
  `.../[couponId]/route.ts:17-28` (8-field map) — `PROXY_CODE`;
  `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx:202-210` — `UI_CODE`;
  `apps/mobile/merchant-app/lib/screens/discounts/coupon_form_screen.dart:164,171,181,189` — `UI_CODE`;
  the cap **is** enforced when set: `000_baseline.sql:4009-4011` — `RPC_FUNCTION`;
  `packages/checkout-core/src/index.ts:977,979` (schema supports both) — `SERVICE_CODE`.
- **Severity** P1 (uncapped percentage discount is a direct margin risk) · **Likelihood** HIGH
- **Invariant**: `[HIGH-STAKES]`
- **Remediation approach**: add `maximum_discount`, `per_customer_limit`, and `description` to the web form and the
  proxy field map; consider making `maximum_discount` **required** for percentage coupons above a threshold.
- **Owner**: lead engineer + founder (whether to force a cap) · **Confidence**: HIGH

---

### G-I-13 — Mobile merchant coupon validation is broken (wrong field name); mobile gift-card issuance loses the code
- **Domain**: Discounts / Gift cards — mobile · **Status**: `BROKEN`
- **Impact**: (a) `CouponService.validateCoupon` sends `subtotal` where the gateway requires `order_total` → the
  request fails schema validation every time. (b) Mobile gift-card issuance collects no recipient email, so no
  delivery email is sent, and the plaintext code is only rendered in the ephemeral in-memory list row — after any
  refresh the row shows the account UUID and the code is **unrecoverable**. The card is a permanent unredeemable
  liability.
- **Evidence**: `apps/mobile/merchant-app/lib/services/coupon_service.dart:78-85` vs
  `packages/checkout-core/src/index.ts:990-996` (`order_total` required) and
  `packages/shared-types/src/index.ts:52-55` — `UI_CODE` + `SERVICE_CODE`;
  `apps/mobile/merchant-app/lib/screens/discounts/gift_cards_screen.dart:394-467` (no recipient field) and `:269`
  (`card.code.isEmpty ? card.id : card.code`) — `UI_CODE`;
  `services/api-gateway/src/routes/gift-cards.ts:100` (code returned once, never persisted) — `GATEWAY_CODE`;
  `apps/mobile/merchant-app/lib/services/coupon_service.dart:26-33` (`is_active` filter ignored vs
  `ListCouponsQuery` `checkout-core:998-1001`) — `UI_CODE`.
- **Severity** P2 · **Likelihood** HIGH (deterministic)
- **Invariant**: `[HIGH-STAKES]` for the gift-card half (an unredeemable issued card is a real liability)
- **Remediation approach**: align the mobile payloads to the shared contracts (ideally generate the Dart client
  from the same schema); add a recipient-email field and a persistent one-time reveal dialog with copy, mirroring
  the web page.
- **Owner**: lead engineer · **Confidence**: HIGH

---

### G-I-14 — Gift-card ledger projection has a divergent fallback that can brick a card
- **Domain**: Gift cards · **Status**: `PARTIAL`
- **Impact**: For any `gift_card_accounts` row without an `'issued'` ledger entry, the first redemption succeeds
  using `initial_value` as the balance, but the second redemption computes a **negative** balance and raises
  *"gift card has no redeemable balance"* — destroying the remaining value. Meanwhile
  `gift_card_available_balance` clamps to 0 (`GREATEST`) so the merchant's UI reports `0` and the RPC reports
  negative: the two "canonical" projections are not identical.
- **Evidence**: `database/supabase/migrations/170_v1_shipping_rates_gst.sql:210-224` (fallback, **no** `GREATEST`)
  and `:226-230` — `RPC_FUNCTION`;
  `database/supabase/migrations/173_v1_gift_card_issuance_lifecycle.sql:32-50` (`GREATEST(…, 0)` at `:50`) —
  `RPC_FUNCTION`; the entry INSERT is `ON CONFLICT … DO NOTHING` (`173:138`), which can leave an account without
  its issued entry.
- **Expected**: one projection function used by every reader **including** `create_checkout_order`; no
  `initial_value` fallback (an account with no ledger has zero spendable balance by definition).
- **Severity** P2 · **Likelihood** LOW today (all issuance goes through `issue_gift_card`), HIGH impact if it fires
- **Invariant**: `[HIGH-STAKES]` `[IRREVERSIBLE]`
- **Remediation approach**: have `create_checkout_order` call `gift_card_available_balance` instead of inlining the
  SUM, drop the `initial_value` fallback, and add a data check that every `gift_card_accounts` row has an `'issued'`
  entry. Requires ARB (touching `create_checkout_order`).
- **Owner**: ARB + lead engineer · **Confidence**: MEDIUM (the trigger condition is not proven to exist in data)

---

### G-I-15 — No `REVOKE`/`GRANT` on the gift-card `SECURITY DEFINER` RPCs, unlike the subscription-coupon RPCs
- **Domain**: Gift cards / security · **Status**: `CONTRADICTORY_EVIDENCE` (repo shows no grant control; effective
  grants not verifiable statically)
- **Impact if the default holds**: PostgreSQL grants `EXECUTE` to `PUBLIC` on new functions. `issue_gift_card`,
  `set_gift_card_status`, and `restore_gift_card_on_refund` are `SECURITY DEFINER`, take `p_store_id` as a
  **parameter**, and perform **no internal ownership check** — the only authorization is `verifySiteOwnership` at
  the gateway route. If PostgREST exposes them to `anon`, an unauthenticated caller with the public anon key could
  mint gift cards for an arbitrary `site_id`.
- **Evidence**: `database/supabase/migrations/184_v1_subscription_coupons.sql:213-216` explicitly revokes from
  `PUBLIC` and grants selectively — `RPC_FUNCTION`; `173_v1_gift_card_issuance_lifecycle.sql` and
  `174_v1_gift_card_refund_restore.sql` contain **no** `GRANT`/`REVOKE` (whole-file read) — `RPC_FUNCTION`;
  repo-wide grep for `REVOKE` returns only `165:463-464`, `163:202,216`, `195:327` — `DB_SCHEMA`;
  the RPCs take `p_store_id` with no ownership assertion (`173:59-97`, `174:18-37`) — `RPC_FUNCTION`.
- **Why not asserted as a violation**: effective grants also depend on Supabase's own role bootstrap, which is not
  in this repo. `BLOCKED_EXTERNAL` to confirm — needs a `\df+ public.issue_gift_card` against a real database.
- **Severity** P0 **if confirmed**, else P2 (defence-in-depth) · **Likelihood** UNKNOWN
- **Invariant**: `[HIGH-STAKES]`
- **Remediation approach**: mirror migration 184 — `REVOKE ALL … FROM PUBLIC` and grant `EXECUTE` to
  `service_role` only, for every money RPC in 170/173/174. Additionally add an in-RPC ownership assertion so the
  function is safe regardless of grant state.
- **Acceptance**: a validator asserts every `SECURITY DEFINER` money RPC has an explicit `REVOKE … FROM PUBLIC`.
- **Owner**: security + ARB · **Confidence**: MEDIUM on the risk, HIGH on the asymmetry

---

### G-I-16 — Coupon and gift-card money is `numeric`, not `bigint` minor units
- **Domain**: Discounts / Gift cards · **Status**: `PARTIAL` (governance drift)
- **Impact**: Mixed money representation across the estate. `discount_allocations.amount_minor bigint` (`143:28`)
  and `subscription_coupons` (`184:15,18,44-46`) are correct; `coupons` (`000_baseline.sql:8823-8825,8840-8841`)
  and all three gift-card tables (`:9370-9371,9399-9400,9426`) are `numeric(10,2)`/`numeric(12,2)`. Every
  conversion boundary is a rounding-bug opportunity, and one already exists in the tax path
  (`checkout-payment-routes.ts:365` `computedTaxAmount = taxMinor / 100`).
- **Evidence**: as cited · `DB_SCHEMA`; governance requirement `AGENTS.md:245` and CLAUDE.md
  ("`*_minor bigint` money"); `LETBUYY_CANONICAL_SYSTEMS.md:166` lists `LEG-043` int32/numeric money columns for
  deletion in Wave 5 — so this is a **known, scheduled** item, not a new discovery.
- **Severity** P2 · **Likelihood** MEDIUM · **Invariant**: `[HIGH-STAKES]`
- **Remediation approach**: follow the existing `LEG-043` / Wave-5 plan; do not do it piecemeal.
- **Owner**: ARB · **Confidence**: HIGH

---

### G-I-17 — Discount and gift-card behaviour has no behavioural test coverage; the "tests" are source-text regexes
- **Domain**: Discounts / Gift cards / governance · **Status**: `STUB_OR_MOCK`
- **Impact**: The gate is green on this domain while none of it has ever been executed. The regex tests
  structurally cannot catch any of G-I-01 … G-I-16: `discounts.test.ts:43` asserts `planDiscountStack` *exists*
  while nothing calls it; `lb11-refund-restore.test.mjs:43-47` asserts the PATCH call site exists but says nothing
  about the ungated `refund/complete` call site.
- **Evidence**: `services/api-gateway/src/__tests__/discounts.test.ts` (entire file, 47 lines — every assertion is
  `assert.match` over `readFileSync`) — `UNIT_TEST`; `tests/launch/lb11-giftcards.test.mjs:27-110` (same pattern) —
  `UNIT_TEST`; `tests/launch/lb11-refund-restore.test.mjs:19-59` (same) — `UNIT_TEST`;
  `tests/executable/discount-postgres.test.mjs:105` — the only real-Postgres test, and it exercises a table with
  zero writers — `INTEGRATION_TEST`; grep of `tests/e2e/` for `coupon`/`gift` → zero — `E2E_TEST` MISSING.
- **Severity** P1 · **Likelihood** HIGH · **Invariant**: none directly; `ANTI-R3` in spirit
- **Remediation approach**: add real Postgres integration tests for: coupon eligibility matrix, concurrent
  redemption against `usage_limit`, IST date boundaries, gift-card issue→redeem→partial-remainder, concurrent
  double-redemption, full vs partial refund restoration. Then add a static validator that fails when a symbol
  declared canonical has zero non-test callers.
- **Owner**: lead engineer · **Confidence**: HIGH

---

### G-I-18 — Gift-card plaintext codes traverse the queue payload and the email is built with unescaped interpolation
- **Domain**: Gift cards / security · **Status**: `IMPLEMENTED_NOT_RUNTIME_VERIFIED`
- **Impact**: (a) The redeemable bearer instrument (the plaintext code) is written into a Cloudflare Queue message
  body; anyone with queue read access holds spendable money. (b) `greetingName`, `note`, and `fromStore` are
  interpolated into the HTML email without escaping → markup injection from merchant/staff-controlled fields.
  (c) If neither queue nor Resend is configured, issuance returns 201 with the code while the email is silently
  skipped — the merchant may believe delivery happened.
- **Evidence**: `services/api-gateway/src/lib/gift-card-email.ts:52,61` (code embedded), `:83-97` (payload → queue),
  `:59-64` (unescaped `${greetingName}` / `${note}` / `${fromStore}` in HTML), `:102-112` (silent skip) —
  `SERVICE_CODE`; `services/api-gateway/src/routes/gift-cards.ts:116-140` (best-effort, never blocks) —
  `GATEWAY_CODE`.
- **Severity** P2 · **Likelihood** MEDIUM · **Invariant**: `[HIGH-STAKES]`
- **Remediation approach**: pass an opaque one-time-retrieval reference through the queue instead of the plaintext
  (or encrypt the payload field); HTML-escape all interpolated values; surface a delivery-status signal to the
  merchant instead of a silent skip (`ANTI-R9`).
- **Owner**: security · **Confidence**: HIGH

---

### G-I-19 — No discount or gift-card reporting; no gift-card liability figure on the web
- **Domain**: Reporting · **Status**: `NOT_IMPLEMENTED`
- **Impact**: A merchant cannot answer "how much did discounts cost me", "which coupon drove revenue", or "what is
  my outstanding gift-card liability" — the last is a balance-sheet item.
- **Evidence**: grep of `services/api-gateway/src/routes/analytics.ts` and `commerce-analytics.ts` for
  `coupon`/`discount`/`gift_card` → zero hits — `GATEWAY_CODE`; the only exposure is `orders.discount` in the CSV
  export (`services/api-gateway/src/routes/export.ts:92,510`) — `GATEWAY_CODE`; the only aggregate liability figure
  anywhere is `apps/mobile/merchant-app/lib/screens/discounts/gift_cards_screen.dart:68` — `UI_CODE`;
  `order_line_adjustments` (`000_baseline.sql:10069`) is written (`:1979-2001`) and never read.
- **Severity** P2 · **Likelihood** HIGH · **Invariant**: none (but liability reporting has accounting implications)
- **Remediation approach**: add a discount-performance read endpoint over `order_line_adjustments` /
  `promotion_redemptions`, and a gift-card liability read over `gift_card_available_balance` summed per site.
  Read-only; no new money mutation.
- **Owner**: founder (what merchants need) + lead engineer · **Confidence**: HIGH

---

### G-I-20 — `subscription_coupons.max_redemptions` is not enforced at redemption
- **Domain**: Platform billing coupons (adjacent) · **Status**: `PARTIAL`
- **Impact**: `redeem_subscription_coupon` locks the coupon row and increments `used_count` but never re-checks
  `max_redemptions`; the only check lives in the **unlocked, read-only** `validate_subscription_coupon`. Concurrent
  or replayed subscriptions can exceed a launch-offer cap (the seeded `LAUNCH20` has `max_redemptions = 1000`).
- **Evidence**: `database/supabase/migrations/184_v1_subscription_coupons.sql:116-118` (check, no lock) vs
  `:185-207` (lock + increment, no check) — `RPC_FUNCTION`; seeds at `:219-229` — `DB_SCHEMA`;
  call sites `services/api-gateway/src/routes/payments.ts:948,1008-1016` — `GATEWAY_CODE`.
- **Severity** P2 · **Likelihood** MEDIUM · **Invariant**: `[HIGH-STAKES]` (platform revenue)
- **Remediation approach**: move the `max_redemptions` and per-merchant checks inside `redeem_subscription_coupon`
  after the `FOR UPDATE`, and return a refusal verdict instead of recording.
- **Owner**: lead engineer + founder · **Confidence**: HIGH

---

### G-I-21 — Legacy DEAD `gift_cards` table retains a `USING (true)` policy
- **Domain**: Gift cards / tenancy · **Status**: `PARTIAL`
- **Impact**: `CREATE POLICY service_role_gift_cards ON public.gift_cards USING (true) WITH CHECK (true)` has no
  `TO` clause, so it applies to `PUBLIC`. The table is DEAD (zero code references) but still present with a
  mutable `balance` column. Whether it is reachable depends on table grants managed outside the repo.
- **Evidence**: `database/supabase/migrations/000_baseline.sql:26666` — `RLS_POLICY`;
  `:9444-9457` (table with mutable `balance`) — `DB_SCHEMA`; zero code references (only
  `services/api-gateway/src/tenant/tenant-tables.registry.ts:995`) — `GATEWAY_CODE`;
  `LETBUYY_CANONICAL_SYSTEMS.md:166` marks `gift_cards.balance` DEAD — `DOC_CLAIM`.
- **Severity** P2 · **Likelihood** LOW · **Invariant**: `[HIGH-STAKES]` (`ANTI-R4` shape, `ANTI-R5` shape)
- **Remediation approach**: execute the already-planned deletion (per `LETBUYY_CANONICAL_SYSTEMS.md:166`) with a
  rollback script; in the interim, drop the `USING (true)` policy.
- **Owner**: ARB · **Confidence**: HIGH

---

## 13. THINGS THAT ARE CORRECT (recorded so the dossier is not one-sided)

1. **Gift-card balance is a genuine ledger projection**, identical formula in three places, machine-pinned by
   `scripts/validators/canonical-ledger-only-validator.mjs:174-188`. `ANTI-R4` **satisfied**.
2. **Gift-card redemption is `FOR UPDATE`-locked** (`170:206`) and cannot be double-spent concurrently.
3. **Coupon total-usage and per-customer limits are row-locked** (`000_baseline.sql:3941`) and are concurrency-safe
   for the live coupon path.
4. **Coupon codes are correctly per-store unique**, case-insensitively (`000_baseline.sql:13731,16961`).
5. **Discount amounts are server-authoritative.** No path lets the client set the amount; the subtotal is read back
   from the persisted order row. `CODE-R6` **satisfied** for the discount amount.
6. **All gift-card mutations go through `SECURITY DEFINER` RPCs** with `ON CONFLICT` and DB-level `>= 0` CHECKs.
   Zero direct `.from('gift_card_*')` writes in TypeScript.
7. **Gift-card codes are stored hashed** (SHA-256) with only `code_last4` in the clear; the plaintext is never
   persisted by the gateway.
8. **Fraud hold works**: `set_gift_card_status` (`173:248-319`) gates redemption via `status = 'active'`
   (`170:201`) without burning balance.
9. **The platform's own billing-coupon system (`184`) is well built**: bigint minor units, `FOR UPDATE`, plan and
   billing-period restrictions, a unique idempotency key, and an **explicit `REVOKE … FROM PUBLIC`** — it is the
   model the storefront coupon system should be measured against.
10. **`bogo` is scope-locked at the API** with an honest 422 (`coupons.ts:91-99,170-178`) even though the DB CHECK
    allows it — a good example of an honest capability boundary.

---

## 14. CONTRADICTIONS

1. **Governance vs code — discount engine.** `LETBUYY_CANONICAL_SYSTEMS.md:90,210-213` + ART-15 say the typed
   engine is live and the scalar is demoted. `170:185-193` + the zero-caller `planDiscountStack` say the exact
   opposite. The build ledger (`EXECUTION_LEDGER.md`, task 007 row) records the task as **done**.
2. **Two "canonical" gift-card balance projections.** `gift_card_available_balance:50` clamps with
   `GREATEST(…, 0)`; the inline projection in `create_checkout_order:210-224` does not. Same claimed formula,
   different behaviour at the edge.
3. **Two usage counters.** `coupons.usage_count` (read by the storefront preview) vs `promotion_redemptions` COUNT
   (read by checkout enforcement). Which is authoritative is not stated anywhere.
4. **Merchant client capability divergence.** The mobile coupon form exposes `maximum_discount` and
   `per_customer_limit`; the web form does not. Same API, two different merchant realities.
5. **Migration 174's stated boundary vs its call site.** `174:14-16` says partial refunds are deliberately not
   auto-split; `orders.ts:1393-1409` invokes it on every refund completion including partial ones.
6. **Grant discipline within the same repo.** `184:213-216` revokes its money functions from `PUBLIC`; `173`/`174`
   define money functions with no grant control at all.
7. **`applicable_products` exists in the DB, in the Zod schema, and in the API contract — and in no code path.**
8. **Documentation drift**: root `AGENTS.md:245` still says the canonical ledger is "mig 139-161"; the repo has 187
   migration files up to 195. (Already flagged by the commander; reconfirmed from this domain's angle since
   173/174/184 are all above 161 and all touch money.)

---

## 15. UNKNOWNS / BLOCKED

- **UNKNOWN-1 — Effective function EXECUTE grants.** Cannot be determined from the repo (see G-I-15). Needs
  `\df+ public.issue_gift_card` etc. against a real database. `BLOCKED_EXTERNAL`.
- **UNKNOWN-2 — Effective table grants to `anon`/`authenticated`.** Not present in migrations; Supabase manages
  them out-of-band. Determines whether G-I-21 is exploitable. `BLOCKED_EXTERNAL`.
- **UNKNOWN-3 — Middleware ordering.** `api.route('/coupons', …)` is registered at `services/api-gateway/src/index.ts:807`,
  **after** `api.use('/*', authMiddleware)` at `:750` in file order. Hono applies middleware registered before a
  route handler; I read the ordering as auth-protected, and the coupon handlers themselves call
  `c.get('auth')` unconditionally (`coupons.ts:38,85,138,162,218,256`), which would throw if auth were absent —
  but I did not execute it. Confirming this is the identity/gateway agent's call.
- **UNKNOWN-4 — Whether any `gift_card_accounts` rows exist without an `'issued'` ledger entry** (the G-I-14
  trigger). Data question; not answerable statically.
- **UNKNOWN-5 — Rate limiting on the public coupon-validate oracle.** `queryCostRateLimit` is applied at
  `services/api-gateway/src/index.ts:681` with `pointsPerSecond: 20, capacity: 200` and a `skip` predicate
  (`shouldSkipGatewayQueryCostLimit`) I did not read. Whether that is sufficient to prevent coupon-code
  enumeration against `GET /storefront/:subdomain/coupons/validate` (unauthenticated,
  `public-routes.ts:858-910`) is unresolved.
- **UNKNOWN-6 — Whether `createTenantGuardedSupabaseClient` constrains `.rpc()` calls** or only table access. If it
  only guards `.from(...)`, then every gift-card RPC's tenant safety rests solely on `verifySiteOwnership`. I did
  not read `services/api-gateway/src/tenant/tenant-scoped.ts`; flagged for the tenancy agent.
- **UNKNOWN-7 — Runtime behaviour of everything above.** No RPC was executed, no order was created, no card was
  issued. Every status in this note is capped at `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.

---

## 16. SEVERITY ROLL-UP

| ID | Title | Sev | Stakes |
|---|---|---|---|
| G-I-03 | Partial refund over-restores gift-card value | P0 | HIGH-STAKES · IRREVERSIBLE |
| G-I-15 | No REVOKE on gift-card money RPCs (unconfirmed) | P0 if confirmed | HIGH-STAKES |
| G-I-01 | Canonical typed discount engine dormant; demoted engine live | P1 | — |
| G-I-04 | Returns refund path never restores gift-card value | P1 | HIGH-STAKES · IRREVERSIBLE |
| G-I-05 | Coupon dates stored as UTC midnight (IST bug) | P1 | — |
| G-I-06 | No customer-facing gift-card surface | P1 | HIGH-STAKES |
| G-I-07 | Gift-card issuance not idempotent; no staff permission | P1 | HIGH-STAKES · IRREVERSIBLE |
| G-I-08 | Product/collection restrictions + automatic discounts dropped | P1 | HIGH-STAKES |
| G-I-10 | GST computed pre-discount | P1 | HIGH-STAKES |
| G-I-12 | Web UI cannot cap percentage discounts | P1 | HIGH-STAKES |
| G-I-17 | No behavioural test coverage (regex-only) | P1 | — |
| G-I-02 | Third, unreachable promotion model evaluated first | P2 | HIGH-STAKES |
| G-I-09 | Email-based per-customer limit; racy promotion limit | P2 | HIGH-STAKES |
| G-I-11 | "Delete" only deactivates; code unreusable | P2 | — |
| G-I-13 | Mobile coupon validate broken; mobile gift-card code lost | P2 | HIGH-STAKES |
| G-I-14 | Divergent balance projection fallback can brick a card | P2 | HIGH-STAKES · IRREVERSIBLE |
| G-I-16 | numeric money instead of bigint minor | P2 | HIGH-STAKES |
| G-I-18 | Plaintext code in queue payload; unescaped email HTML | P2 | HIGH-STAKES |
| G-I-19 | No discount/gift-card reporting or liability figure | P2 | — |
| G-I-20 | subscription_coupons max_redemptions not enforced at redeem | P2 | HIGH-STAKES |
| G-I-21 | DEAD gift_cards table retains USING(true) policy | P2 | HIGH-STAKES |

---

*End of Agent I notes. Read-only pass; no repository file other than this note was created, edited, or deleted.*
