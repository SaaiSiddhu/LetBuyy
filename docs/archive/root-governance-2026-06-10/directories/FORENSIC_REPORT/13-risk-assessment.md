# Risk Assessment & Production Readiness

## Production risks

| Risk | Likelihood × Impact | Basis |
|------|--------------------|-------|
| Gateway outage = total platform outage (storefronts, admin, auth, apps, payments share one Worker) | Medium × Critical | V-C1; single `api.letbuyy.store` route; webhook/queue workers depend on it via service binding |
| Regression shipping unnoticed (no behavioral test net: 0 package tests, no e2e; CI gates are typecheck/lint/governance + 5 gateway unit suites) | High × High | C-2; `.github/workflows/ci.yml` |
| Bad theme publish takes a live store down instantly (one-step publish, no staged release) | Medium × High | V-H6 |
| Outbox/webhook latency or stall (dispatch trigger unproven) | Unknown × Medium | I-2 |
| Email-dependent flows silently incomplete (employee invites, store-owner notifications) | Certain × Low-Med | 3 TODOs |
| Demo path divergence masking pipeline regressions | Medium × Low | V-H2 |

## Scaling risks

- Vertical-only backend: one Worker, route handlers 20,340 LOC; per-tenant load shares one isolate model + one Supabase. Hyperdrive present, but no read-replica/cache tier evidence at gateway.
- `storefront.ts` (4,320 lines) is the hot path for every storefront request; any change risks all tenants.
- Distributed-runtime machinery (queues, checkpoints, replay) writes ~60 ops tables on the same Postgres as commerce data — operational telemetry contends with transactional load.
- Search absent: catalog growth has no discovery path (I-3).
- INR/Razorpay coupling blocks geographic scaling at the contract level (V-M7).

## Security risks

| Item | Severity | Evidence |
|------|----------|----------|
| Unthrottled storefront customer login + guest order lookup (brute-force/enumeration surface) | High | V-H4 |
| `devOtp` in non-prod responses (staging compromise → account takeover if staging shares user data) | High (env-conditional) | V-H8 |
| Static `PLATFORM_CONSOLE_API_TOKEN` for super-admin API plane (no rotation evidence, no per-operator identity at API layer) | High | V-H7 |
| Signup email enumeration (409 on existing verified) | Medium | identity signup route |
| Rate-limit keying on `x-forwarded-for` (spoofable off-Cloudflare) | Medium | `rate-limit.ts` |
| CSRF token non-httpOnly (accepted trade-off, sameSite:strict) | Low | identity proxy.ts:50 |
| Positives: RLS on 230/233 tables (352 policies); store-ownership check on every sampled admin route; HMAC-signed internal calls; hashed app tokens; no committed secrets; pnpm overrides pin patched deps (hono, undici, …); tenant-isolation + payment-idempotency unit tests exist | — | violations §PASS list |

## Maintainability risks

- Dual maintenance of section schemas (3 sites) and TS↔Dart contracts (manual mirror).
- Validator brittleness: 132 scripts assert string fragments in source files — refactors require synchronized edits to `config/runtime/*.json` contracts or governance CI fails for non-architectural reasons; conversely the suite passes regardless of behavior. Cost without confidence.
- 73 root documents obscure which architecture statements are current (already producing contradictions).
- Single-file giants: `shared-types/src/index.ts` 2,081 lines; `app-engine/src/index.ts` 1,779; `storefront.ts` 4,320; `app-store.ts` 2,721.

## Developer-experience risks

- New engineers face 3 conflicting platform inventories + 6 phantom services before reaching real code.
- No local end-to-end story evidenced (seed endpoint disabled; demo store bypasses pipeline).
- Ecosystem developers (theme/app) have docs but no CLI, SDK, or sandbox — onboarding is manual JSON + OAuth by hand.

## Production Readiness Assessment

| Dimension | Verdict | Basis |
|-----------|---------|-------|
| Core commerce flows (catalog→cart→checkout→order, COD/Razorpay/Cashfree) | **Conditionally ready** — code paths complete, behaviorally untested | app reports; payments idempotency tests are the only behavior tests |
| Multi-tenancy & data isolation | **Ready** | subdomain routing + per-route ownership checks + 98.7% RLS |
| Theme platform (merchant-facing) | **Ready with caveats** | drafts/releases/rollback real; one-step publish; preview fidelity gap |
| App platform (third-party-facing) | **Not ready** | install→render gap (I-1), no tooling, review pipeline scaffold |
| Search/discovery | **Not ready** | no runtime |
| Notifications/email | **Partially ready** | identity emails live; commerce notification TODOs |
| Mobile | **Merchant ready; shopper absent** | merchant-app real; shopper-app empty |
| Observability/ops | **Instrumented but unproven** | telemetry tables + Analytics Engine wired; load/chaos/certification suites never run by default; no committed live evidence |
| Disaster recovery / resilience claims | **Unverified** | replay/failover/recovery validated only as documents (C-2/Dead Code §5) |
| Deployment | **Ready (single-provider)** | real wrangler+terraform orchestrators, fail-closed; Cloudflare-only |
| Compliance posture | **Partial** | GDPR webhook topics present; downstream fulfillment + PCI evidence absent |

**Overall:** suitable as a single-region, India-market, merchant-operated storefront platform run by a small team that can tolerate the monolith; **not yet** the multi-sided Shopify-class platform its documentation describes. The certification/validator layer should be treated as design documentation, not as operational assurance, in any diligence valuation.
