# 06 — CROSS-APP DATA FLOW

**HEAD `c7c82847` · code-verified.** The architecture is a **modular monolith**: `api-gateway` (Hono Worker) owns the write/commerce truth; the Next.js apps are thin views that call it through a typed `@letbuyy/api-client`; async work fans out through 5 Cloudflare queues to `queue-workers`. There is **one** data backbone, not parallel ones.

## The integration map

| Integration | Wiring | Status |
|---|---|---|
| Merchant → Storefront | merchant publishes theme release → `sites.template_config` → storefront `mapSupabaseToStore` reads it | ✅ |
| Merchant → Orders | merchant order routes proxy `api-gateway` order routes (one state machine) | ✅ |
| Merchant → Inventory | inventory RPCs (row-locked) shared; reservation inside `create_checkout_order` | ✅ |
| Merchant → Customers | `store_customers` read via gateway; one customer table per tenant | ✅ |
| Internal → Orders | platform-console reads orders via gateway internal-console routes | ✅ |
| Internal → Refunds | merchant refund UI (LB-3) is the V1 path; console force-refund = V1.1 | partial |
| Teams → Permissions | platform RBAC enforced; **merchant RBAC not wired to gates** (owner-only) | partial (by design) |
| Identity → all apps | merchant ES256 sessions issued by `identity-platform`, verified at gateway against JWKS; customer HS256 separate; internal allowlist+TOTP | ✅ |
| Events / async | gateway `outbox_events` → `claim_outbox_events` → `platform_queue_jobs` → queue-workers (notifications/analytics/search/webhook side-effects) | ✅ |
| Storefront ↔ gateway | `next.config.ts` rewrites `/api/storefront/:sub/:path*` → gateway (this is why "no local cart route" is fine) | ✅ |

## Broken / missing / duplicated

- **Broken:** gift-card issuance↔redemption (writes `gift_cards`, reads `gift_card_accounts`) — a cross-table dataflow defect (LB-11).
- **Missing:** merchant staff invite → acceptance → role-gated access (no acceptance page; gates inert).
- **Missing (thin):** storefront search → server search backend (trigram indexes + SEARCH_QUEUE exist but the storefront query path is client-side).
- **Duplicated:** none load-bearing. The session's #1 historical anti-pattern ("two parallel systems") has been converged — one ledger, one issuer, one storefront runtime, one tenant key. The dormant `runtime-composition` package is the only residual (unwire-then-delete per ART-18).

## Identity is the correct single hub

`identity-platform` is the sole asymmetric issuer; api-gateway verifies; no app re-issues merchant tokens; customer sessions are a separate HS256 realm. No second issuer, no shared secret across realms. This is the cleanest cross-app contract in the repo.

**Verdict:** cross-app dataflow is coherent and single-backbone. The only real cross-app breaks are gift cards (defect) and merchant-teams (deferred); search is thin.
