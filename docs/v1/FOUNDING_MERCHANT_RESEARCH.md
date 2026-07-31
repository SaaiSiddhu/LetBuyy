# Founding Merchant Program — Billing Architecture Research

> LCIS-first research mapping the **existing** canonical billing/subscription architecture that the Founding Merchant Program extends. Every claim below is grounded in the repository (file:line) and LCIS artifacts (`graphify-out/*.json`). The founding program creates **no parallel billing system** — it is metadata + an allocation ledger hung off the existing spine.
>
> **Ownership note (CODEOWNERS):** `/database/**` and `/services/api-gateway/src/routes/payments.ts` → `@saai-sidd`. Pricing logic code-owner = `@letbuyy/billing-core`. LCIS domain owner for merchant subscriptions = **`merchant`** domain (`money:false`), distinct from the **`payments`** domain (`money:true`, order/checkout ledger).

---

## 1. `plans` (pricing catalog)
- **Current state:** `000_baseline.sql:10384`. 36 columns; keyed by unique `(site_type, slug)` (`plans_site_type_slug_key`). Holds `price_monthly_inr`, `price_yearly_inr`, `promo_price_inr`/`promo_months`/`promo_label`, `features jsonb`, `compare_features jsonb`, `is_active`, `display_order`, `is_popular`, `requires_contact`, `trial_days`, `razorpay_plan_id_monthly/yearly`, `version`. Global (`tenant:false`, `money:false`).
- **Ownership:** RLS policies `anyone_read_plans` (public read) + `super_admin_manage_plans` (write). Versioning trigger `trg_plans_version`. Catalog logic owned by `@letbuyy/billing-core`.
- **Dependencies:** read by `subscription-checkout.ts`, `billing.ts loadPlan()`, `payments.ts`, and indirectly by `resolve_site_entitlements()` via `plan_slug`.
- **Risks:** prices are **whole INR integers** (₹299), not paise — `planBillingAmountMinor` multiplies to minor for Razorpay. The legacy slugs differ across layers (catalog vs DB CHECK vs marketing), so introducing `launch/growth/...` must be consistent.
- **Blast radius:** changing `plans.price_monthly_inr` affects new checkouts, renewals, the public pricing page, and entitlement resolution. **Founders must be excluded** (they read locked snapshots — see PRICE_LOCK docs).

## 2. `subscriptions` (merchant subscription state)
- **Current state:** `000_baseline.sql:12406`. 26 columns. `user_id`, `plan text` (CHECK `free/starter/business/enterprise`), `plan_id uuid`, `status` (CHECK `active/cancelled/past_due/trialing`), `store_id`, `site_id`, `amount_paid`, `currency`, `billing_period`, `razorpay_order_id`/`razorpay_payment_id`, `external_subscription_id`, `promo_ends_at`, plus autopay columns from `152_executable_billing_autopay.sql` (`mandate_id`, `idempotency_key`, `dunning_status`, `dunning_attempts`, `next_dunning_at`).
- **Ownership:** RLS `users_own_subscription`, `service_role_subscriptions`, `subscriptions_tenant_site_guc`; triggers `audit_subscriptions`, `update_subscriptions_updated_at`. Tenant-scoped (`tenant:true`).
- **Dependencies:** written by `SubscriptionExecutionAdapter`; read by `resolve_site_entitlements()`, billing routes.
- **Risks (CRITICAL):** the `subscriptions_plan_check` CHECK **rejects `launch`/`growth`** → inserting a new-slug subscription throws. Must be expanded (migration 176) preserving legacy values. The live verify path (`payments.ts:933`) is **not idempotency-keyed** (the sandbox `/subscribe` path is), so rapid double-submits can create two active rows.
- **Blast radius:** the activation insert touches `subscriptions`, `sites`, `billing_history`. This is the allocation chokepoint's neighborhood.

## 3. `plan_entitlements` (runtime entitlements)
- **Current state:** `000_baseline.sql:10363`. Keyed by unique `(site_type, plan_slug)`; holds `features text[]`, `limits jsonb`, `entitlements jsonb`, `is_active`. Distinct from `plans` (catalog/pricing vs runtime grants).
- **Ownership:** RLS `plan_entitlements_public_read`, `plan_entitlements_service_all`.
- **Dependencies:** the only entitlements source read by `resolve_site_entitlements()`.
- **Risks:** if `launch`/`growth` rows are **not seeded**, `resolve_site_entitlements()` falls back to `'free'` → founders silently get free features. Seed is mandatory (migration 178).
- **Blast radius:** every entitlement check across all apps resolves through this table.

## 4. `resolve_site_entitlements(p_site_id)` (SECURITY DEFINER)
- **Current state:** `000_baseline.sql:7268`. Reads the site's latest `active|trialing` subscription → derives `plan_slug` → reads `plan_entitlements` (with `store` fallback) → merges `site_entitlement_overrides` → returns `{site_id, site_type, plan, features, limits, entitlements}`.
- **Ownership:** `@saai-sidd` (DB). Consumed by `SaasExecutionAdapter.resolveEntitlements()` (`saas-execution.adapter.ts`).
- **Dependencies:** `sites`, `subscriptions`, `plans`, `plan_entitlements`, `site_entitlement_overrides`.
- **Risks:** plan-slug fallback to `free`. **Does not resolve price** (entitlements only) — pricing lock is a separate concern handled by `resolveMerchantPricing()`/`resolve_merchant_locked_price()`.
- **Blast radius:** entitlement gating platform-wide; the founding program does **not** modify this RPC (founders get their plan's normal entitlements; only price is locked).

## 5. `@letbuyy/billing-core`
- **Current state:** `packages/typescript/billing-core/src/index.ts` (1242 lines). Exports `SubscriptionTier` (`free|starter|business|enterprise`), `STORE_BILLING_TIER_DEFINITIONS`, `getStoreBillingTierDefinition`, `resolvePlanEntitlementSnapshot`, `applyStorePlanTierDefaults`, `planBillingAmountMinor`, `planMerchantRazorpayBillingCheckout`, `planSandboxUpiAutopayMandate`, `planBillingDunning`, types `BillingPlanCatalogRecord`/`SubscriptionBillingPeriod`.
- **Ownership:** canonical owner of pricing/entitlement logic. Local `AGENTS.md`: no imports from `apps/*`/`services/*`; "prefer completing the canonical owner over adding a parallel implementation."
- **Dependencies:** pure (framework-free); consumed by gateway routes + adapters.
- **Risks:** `SubscriptionTier` is a TS union threaded widely — adding members surfaces exhaustiveness errors (desirable, compile-time).
- **Blast radius:** every charge amount + entitlement default flows through this package. `resolveMerchantPricing()` + `applyFoundingLockToPlan()` will live here.

## 6. Payment verification & subscription activation
- **Current state:** Live path `routes/payments.ts:~895-953`: HMAC verify + `fetchRazorpayPayment()` → asserts `status='captured'` **and** `capturedAmount ≥ planBillingAmountMinor(plan)` **and** order binding (`payments.ts:912-929`) — a strong server-side replay defense — then calls `activateMerchantSubscription()` (`:933`).
- **Activation chokepoint:** `SubscriptionExecutionAdapter.activateMerchantSubscription()` (`subscription-execution.adapter.ts:49`): cancels prior active sub → inserts new `status='active'` (`plan=slug`, `amount_paid`, `site_id`) → sets `sites.trial_status='paid'` when `amountPaid>0` → records `billing_history` invoice. **Reached by 4 callers:** `payments.ts:933` (live), `billing.ts:323` (sandbox autopay), `internal-billing.ts:116` (internal), `subscription-checkout.ts:69` (free).
- **Ownership:** adapter declares a `runtimeBridge` forbidding `business-sequencing` → allocation **decision** must live in the RPC, the adapter only calls it.
- **Risks:** allocation must be non-fatal (never roll back a paid sub); verify path lacks idempotency key.
- **Blast radius:** the single point through which founding allocation is triggered.

## 7. Renewal / upgrade / downgrade / cancellation / reactivation
- **Renewal:** charge amount computed by `planBillingAmountMinor(plan, period)` — see exhaustive call-site map in `PRICE_LOCK_VERIFICATION.md` (`billing.ts:229`, `internal-billing.ts:115`, `payments.ts:902`, `subscription-checkout.ts` via `planMerchantRazorpayBillingCheckout:60`). **Today renewals read catalog price — the lock is NOT yet honored.**
- **Upgrade/downgrade:** a new activation replacing the prior (the adapter cancels the prior active sub then inserts the new plan). Founding status lives on `sites`, so it persists across plan changes; the locked target-plan price must be applied at the charge.
- **Cancellation:** `subscriptions.status='cancelled'`, `cancelled_at` set (`syncProviderSubscription` / adapter). Founding columns on `sites` remain (lifetime).
- **Reactivation:** re-runs activation; allocation is idempotent on `site_id` (no new slot); lock re-applies from `sites` snapshot.
- **Risks:** **renewal/upgrade lock enforcement is the #1 correctness item** (catalog-priced today).
- **Blast radius:** `merchant` LCIS domain (routes `billing`, `internal-billing`).

## 8. Razorpay integration
- **Current state:** `@letbuyy/infrastructure/razorpay-adapter` — `createRazorpayOrder` (one-time, server-authoritative amount), `createRazorpaySubscription` (native recurring, bound to `plans.razorpay_plan_id_*`), `fetchRazorpayPayment` (capture check). `planMerchantRazorpayBillingCheckout` chooses mode (`free_activation` | `razorpay_subscription` | `razorpay_order`).
- **Risks (price-lock-critical):** **native subscription mode binds a `razorpay_plan_id` whose price is the catalog price** → it cannot represent a per-merchant locked price. Founders must use **order/mandate (server-authoritative) mode**. Documented + enforced in PRICE_LOCK docs.
- **Blast radius:** all paid checkout/renewal.

## 9. API client (`@letbuyy/api-client`)
- **Current state:** `packages/typescript/api-client/src/index.ts` (5029 lines, single file). Group pattern at `:4558`: `payments = { plans, subscription: { get, history, cancel, order, recover, verify } }` using `this.requestData<T>('/path', {...options, query|method|body})`.
- **Ownership:** typed contract for route-ownership lockstep (apps never touch DB directly).
- **Risks:** public (unauthenticated) marketing calls need a public client/base-URL variant.
- **Blast radius:** adding `foundingProgram` + `foundingAdmin` groups mirroring `payments`.

## 10. Merchant & Admin UI
- **Merchant (`apps/merchant-control-plane`):** billing page `app/[store]/settings/billing/page.tsx` (proxy → `apiClient.payments.subscription.*`), `lib/billing/plan-ui.ts`, `app/[store]/dashboard/DashboardClient.tsx`. Proxy pattern: `app/api/stores/[store]/billing/route.ts` → `createMerchantApiClient()`. Design: `@letbuyy/ui` + `--lb-*` tokens + `formatInrCurrency`. → `FoundingMerchantCard` renders here.
- **Admin (`apps/platform-console`):** `app/(dashboard)/subscriptions/page.tsx` + `SubscriptionManagementIndexTable.tsx`. → "Founding Administration" page mirrors this; super-admin only; recovery ops + audit.
- **Marketing (`apps/marketing-site`):** `components/Pricing.tsx` (hardcoded placeholder, no API routes today). → flag-gated V1 pricing + live counter via gateway public endpoint.
- **Risks:** must handle loading/empty/error (non-founding merchants); never compute price client-side; respect design-system ratchet (no raw px / `rounded-[...]`).
- **Blast radius:** additive components + one proxy route per app; nav registration.

---

## Summary of gaps the implementation closes
1. `subscriptions_plan_check` rejects new slugs → **expand** (176).
2. `plan_entitlements` lacks launch/growth → **seed** (178).
3. Renewal/upgrade charge reads catalog price → **route through `resolveMerchantPricing` + force order mode for founders** (PRICE_LOCK docs + billing-core + gateway).
4. No subscription-refund path exists (refunds domain is order-scoped) → **new `reclaim_founding_merchant()` + refund hook**.
5. Live verify path not idempotency-keyed → **allocation idempotent on `site_id`**, recommend verify-path key.
