# Phase 15 — AI Context Query Packs

**Reusable `graphify` query packs per domain. Built on the verified node labels in this repo. Run after `graphify update .`; via MCP use `query_graph`/`shortest_path`/`get_neighbors`. (Packs touching SQL RPCs require SQL indexing — flagged ⚠️.)**

## checkout-flow
```
graphify explain "checkout-core"
graphify explain "create_checkout_order"            # ⚠️ SQL — needs schema indexing
graphify path "storefront-runtime" "api-gateway"
graphify path "checkout" "ledger"                   # ⚠️ tail is SQL
graphify explain "shipping-rate-resolver"
```

## payment-flow
```
graphify explain "payments.ts"
graphify explain "razorpay"
graphify get_neighbors "confirmPayment"
graphify path "checkout-payment-routes" "postPaymentLedger"
```

## refund-flow
```
graphify explain "refund"
graphify path "payments.ts" "ledger_entries"        # ⚠️ SQL tail
graphify explain "verifySensitiveActionStepUp"
```

## giftcard-flow  ⚠️ (RPCs ungraphed until SQL indexed)
```
graphify explain "gift-cards.ts"
graphify explain "issue_gift_card"                  # ⚠️ SQL
graphify path "checkout" "gift_card"
```

## merchant-flow
```
graphify explain "createMerchantApiClient"
graphify explain "resolveOwnedStoreId"
graphify path "merchant-control-plane" "api-gateway"
```

## tenant-flow
```
graphify explain "getSupabaseAdmin"
graphify explain "createTenantGuardedSupabaseClient"
graphify path "<route>" "verifySiteOwnership"        # missing path = candidate ownership gap
```

## identity-flow
```
graphify explain "identity-platform"
graphify explain "issueCustomerSession"
graphify explain "identity-session-verifier"
graphify path "merchant login" "identity-platform"
```

## shipping-flow
```
graphify explain "shipping-rate-resolver"
graphify path "checkout-client" "shipping_rates"     # surfaces the shippingRateId drop
```

## marketplace-flow
```
graphify explain "app-marketplace"
graphify get_neighbors "app-api.ts"
```

## developer-flow
```
graphify explain "developer-portal"
graphify explain "oauth/token"
```

## theme-flow
```
graphify explain "theme-engine"
graphify explain "renderer-registry"
graphify path "announcementBar" "renderer-registry"  # surfaces LB-8 missing renderer
```

## security-flow
```
graphify explain "verifySiteOwnership"
graphify explain "step-up"
graphify explain "webhook HMAC"
graphify path "<mutating route>" "verifySiteOwnership"
```

**Usage pattern:** for an impact-safe edit, `graphify get_pr_impact` on the changed files first; for an audit, run the relevant pack and look for *missing* paths (a route that can't reach `verifySiteOwnership`, a section with no renderer edge). The existing curated library is in `docs/ai-infrastructure/graphify-queries.md`; this extends it into per-flow packs.
