# LB-7 (Shipping Rates + GST) — CERTIFICATION

**Date:** 2026-06-13 · **HEAD:** `140a73db` (LB-7 = uncommitted working tree) · **Verdict: (A) COMPLETE — pending commit only.**

## Determination

LB-7 is **functionally complete and validated**. The single thing preventing a fully-green gate is that migration 170 is untracked and **this sandbox cannot `git add`** (`.git/index.lock` un-removable). That is a commit seam, not a code defect.

## Requirements vs evidence

| Requirement | Result | Evidence |
|---|---|---|
| Merchant shipping rates honored at checkout (no hardcoded free/₹99) | ✅ | `170_v1_shipping_rates_gst.sql` resolves rate server-side via `shipping_rates`→`shipping_zones` (`site_id` exists since mig 145); `shipping-rate-resolver.ts` server-authoritative |
| GST computed server-side, never trusted from client | ✅ | `checkout-payment-routes.ts:27,350` `calculateGstLine`; `:293` `resolveShippingRate`; no `body.shipping_amount` copy |
| Hosted checkout stops trusting client quote | ✅ | `checkout.ts:528-553` `resolveShippingRate` + `server_resolved:true` |
| `bogo` coupon blocked (V1 scope) | ✅ | `coupons.ts:90,166` → 422 `UNSUPPORTED_DISCOUNT_TYPE` (POST+PATCH) |
| Overload-safe migration (no PGRST203) | ✅ | guarded `DROP FUNCTION IF EXISTS` of the 14-arg overload + `CREATE OR REPLACE` 16-arg; no grant regression (no per-function GRANT; SECURITY DEFINER default execute preserved) |
| Tests pass | ✅ | `lb7-shipping-gst.test.mjs` **28/28**; full launch suite **75/75**; federation **3/3** |
| Typecheck passes | ✅ | `tsc --noEmit -p services/api-gateway` → **0 errors** |
| Gate passes | 🟡 | green on **all 123 validators except** sequential-migration (untracked-170 commit artifact) |
| No regressions | ✅ | behavioral 24/26; both failures proven pre-existing baseline (`zod` module-resolution; stale stripe test obsoleted by committed LB-2 — 0 occurrences at HEAD) |

## Reconciliations applied this session (both strengthen, neither weakens)

1. **lb7 test #5** — replaced the over-broad `doesNotMatch(/DROP FUNCTION/)` (which wrongly banned the *required* overload retirement) with: require `CREATE OR REPLACE`, require guarded `DROP FUNCTION IF EXISTS public.create_checkout_order`, forbid bare `CREATE FUNCTION`.
2. **lb6 test #9** — P4-4 route count 124→127 in lockstep with `domain-boundary-validator.mjs` (LB-7 added the shipping proxy routes), same pattern as 115→123→124.

## To finalize (human, outside sandbox)

```
rm -f .git/index.lock                     # if no live git process holds it
git add database/supabase/migrations/170_v1_shipping_rates_gst.sql \
        services/api-gateway/src/lib/shipping-rate-resolver.ts \
        services/api-gateway/src/execution/order-execution.adapter.ts \
        services/api-gateway/src/routes/storefront/checkout-payment-routes.ts \
        services/api-gateway/src/routes/checkout.ts services/api-gateway/src/routes/coupons.ts \
        apps/storefront-runtime/src/app/api/shipping \
        apps/storefront-runtime/src/app/store/\[subdomain\]/checkout/checkout-client.tsx \
        apps/merchant-control-plane/src/app/api/stores/\[store\]/shipping/rates \
        apps/merchant-control-plane/src/app/\[store\]/settings/shipping/page.tsx \
        scripts/validators/domain-boundary-validator.mjs docs/governance/app-api-route-ownership.md \
        tests/federation/app-api-route-ownership.test.mjs \
        tests/launch/lb7-shipping-gst.test.mjs tests/launch/lb6-collections.test.mjs EXECUTION_LEDGER.md
node scripts/validate-governance.mjs --lane=gate   # → 123/123 green
git commit -m "v1-launch-b5: LB-7 shipping rates honored + GST invocation"
```

**Note:** LB-7's live behavior additionally depends on human seam **H6** (shipping rates are merchant-entered data; GST display is code-complete) and the broader go-live seams. No further LB-7 code is required.
