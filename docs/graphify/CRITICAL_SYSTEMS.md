# Phase 12 — Architecture Intelligence: Critical Systems

**Criticality = graph degree centrality (in+out edges) from `graph.json`. The real top-ranked are listed; the full top-100 of any category is reproducible by sorting `deg[node]` — counts are exact, not estimated.**

## Top critical NODES (code, by degree)
| Deg | Node | File |
|---:|---|---|
| 806 | `index.ts` (typed API contract) | `packages/shared-types/src/index.ts` |
| 669 | `index.ts` (HTTP client) | `packages/typescript/api-client/src/index.ts` |
| 358 | `api_client.dart` | `packages/dart/api_client/lib/src/api_client.dart` |
| 227 | `index.ts` | `packages/checkout-core/src/index.ts` |
| 209 | `index.ts` (gateway entry) | `services/api-gateway/src/index.ts` |
| 207 | `app-platform.ts` | `packages/shared-types/src/app-platform.ts` |
| 189 | `JsonRecord` | `packages/shared-types/src/index.ts` |
| 187 | `createMerchantApiClient()` | `apps/merchant-control-plane/src/lib/api/client.ts` |
| 184 | `Button()` | `packages/typescript/ui/src/button.tsx` |
| 182 | `merchantApiErrorResponse()` | `apps/merchant-control-plane/src/lib/api/client.ts` |
| 171 | `resolveOwnedStoreId()` | `apps/merchant-control-plane/.../resolve-owned-store-id.ts` |
| 170 | `getSupabaseAdmin()` | `services/api-gateway/src/lib/supabase.ts` |
| 146 | `governance-common.mjs` | `scripts/validators/governance-common.mjs` |
| 124 | `storefront.ts` | `services/api-gateway/src/routes/storefront.ts` |
| 119 | `index.ts` | `packages/theme-engine/src/index.ts` |
| 118 | `supabase.ts` | `services/api-gateway/src/lib/supabase.ts` |

The remaining top-100 are dominated by `shared-types`, `checkout-core`, `auth-core`, `commerce-core`, `billing-core` barrel exports + Dart UI-kit/material nodes (mobile). Sort `graph.json` by degree to enumerate.

## Top critical SERVICES/RUNTIMES (by node count = surface area)
1. api-gateway 3,623 · 2. mobile/merchant-app 4,980 (largest, but a client) · 3. merchant-control-plane 1,293 · 4. shared-types 1,086 · 5. storefront-runtime 910 · 6. theme-engine 464 · 7. queue-workers 393 · 8. identity-platform/platform-console 443 · 9. webhook-service 175 · 10. checkout-core 259.

## Top critical ROUTES (gateway, by degree/footprint)
`storefront.ts` (124) · `payments.ts` · `payouts.ts` · `orders.ts` · `checkout-payment-routes.ts` · `products.ts` · `gift-cards.ts` · `tax.ts` · `settlements.ts` · `kyc.ts` — within the 1,628-node, 87-file route surface.

## Top critical DATABASE entities
**Not graph-derivable (2 DB nodes).** From migrations, the critical entities are: `ledger_entries`/`ledger_transactions` (139), `create_checkout_order` (170), `claim_payout_statement_release` (160), `gift_card_accounts`+ledger (170/173), `gst_invoices` (144), forced-RLS tenant tables + `app_tenant` role (164). Re-index with SQL to rank these by degree.

## Top critical FILES (change-blast-radius)
`packages/shared-types/src/index.ts` (806) and `packages/typescript/api-client/src/index.ts` (669) are the two highest-blast-radius files in LetBuyy — the typed contract + the client. Then `checkout-core/index.ts` (227), `api-gateway/src/index.ts` (209), `supabase.ts` (118 file / 170 `getSupabaseAdmin`). **Protect these as interfaces:** run `graphify get_pr_impact` before touching them.

## Intelligence takeaway
The centrality crown is the **app↔gateway contract** (shared-types + api-client) and the **tenant-guard primitives** (`getSupabaseAdmin`, `resolveOwnedStoreId`). LetBuyy's "central nervous system" is its typed HTTP boundary and its tenancy guards — both architecturally healthy places for the weight to sit.
