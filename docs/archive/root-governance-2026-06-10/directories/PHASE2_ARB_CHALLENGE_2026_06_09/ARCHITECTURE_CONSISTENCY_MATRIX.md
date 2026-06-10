# ARCHITECTURE_CONSISTENCY_MATRIX

Cross-check of **`LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`** (the self-declared *“FROZEN & EXECUTABLE”* authority that supersedes the earlier Freeze) against the **code reality** established by this forensic. Verdicts: **IMPLEMENTED · PARTIAL · VIOLATED · COMPLIANT-DEFERRAL · REQUIRES-REDESIGN (impossible as currently built).**

## Headline
V1 is a genuinely good, right-sized architecture (“ship a monolith, rent rails, never custody money, keep the scaffolding dormant”). **The code follows V1 where it’s cheap and violates V1 exactly where the money and trust live.** The two most damaging violations: it **invested in the very packages V1 ordered to stay dormant**, and it **did not build the double-entry-ledger-as-source-of-truth + maker-checker payout** that V1 made non-negotiable.

## Decision matrix

| V1 decision (Appendix A/B) | V1 state | Code reality | Verdict | Evidence |
|---|---|---|---|---|
| Modular monolith; contexts = modules | APPROVED | `api-gateway` is the one backend | **IMPLEMENTED** | `services/api-gateway` |
| 22/13 services REJECTED; reserved stay EMPTY | REJECTED activation | 6 services manifest-only | **IMPLEMENTED** | `services/*/runtime.manifest.json` |
| **Dormant scaffolding (`distributed-runtime`, `projection-runtime`, `orchestration`, `extension-host`) — “no investment”** | REJECTED/dormant | **114+ files built, in `tsconfig.workspace.json` build closure**, 0 runtime use | **VIOLATED** | V1 §4 (line 83); `tsconfig.workspace.json:24,26` |
| Checkout = modules in monolith + hosted origin; `checkout-runtime` REJECTED | APPROVED (in-monolith) | `checkout-runtime` empty (good) **but** confirm creates no order | **PARTIAL** | `routes/checkout.ts:454-509` |
| Server-authoritative cart/checkout-session | APPROVED (P0/P1) | Client cart; confirm flips state only | **VIOLATED** | `routes/checkout.ts:454-509` |
| Merchant-owned PSP credentials (Model C) | APPROVED — load-bearing | Supported, but default mode = `mock` | **PARTIAL** | `routes/payments.ts:130` |
| **Money-out via licensed PA + double-entry settlement ledger** | APPROVED | Payout fabricated; **balance from mutable table, not ledger** | **VIOLATED** | `payout-transfer-adapter:82-103`; `wallet.ts:66-92` |
| **Ledger as the money source of truth** | APPROVED | Kernel real but bypassed; reconciliation auto-plugs | **REQUIRES-REDESIGN** | `wallet.ts:66-92`; `billing-core:558,601-615` |
| **Maker-checker on manual payout (thin ops sliver)** | APPROVED (Appendix B #15) | Dual-control attached to **orphan** `payouts` table; live `payout_statements` path ungated | **VIOLATED** | `migrations/151:126-129` vs `routes/payouts.ts:464-521` |
| One DB + **RLS + FORCE** as tenant boundary | APPROVED | App path runs `service_role` (BYPASSRLS); some policies `USING(true)` | **REQUIRES-REDESIGN** | `lib/supabase.ts`; `migrations` `USING(true)` |
| Transactional outbox + typed catalog (no bus/saga) | APPROVED | Outbox real (SKIP LOCKED + idempotency) **but capped ~4,800/day** | **PARTIAL** | `wrangler.toml` cron; `index.ts:855` |
| Partitioning DEFERRED to P2; keep dormant helper | DEFERRED | Partition shadows built, not cut over | **COMPLIANT-DEFERRAL** | `migrations/080,081` |
| Observability: structured logs+redaction, tracing/metrics, alerting, **backups+restore** (P0/P1) | APPROVED | Config-only; no PITR; PII-in-logs risk | **VIOLATED** | `infrastructure/observability/*`; `production-deploy.yml:234-237` |
| WhatsApp lifecycle + COD-confirm + consent (P1) | APPROVED | Twilio path real; sandbox default; secret = `SKIP_NEEDS_HUMAN` | **PARTIAL** | `whatsapp-commerce-adapter`; `wrangler.toml:260` |
| Notifications = router in monolith/QW; `notification-service` REJECTED | APPROVED | Router exists; `notification-service` empty | **IMPLEMENTED** | `services/notification-service` (empty) |
| Analytics = in-DB rollups/MVs; pipeline REJECTED | APPROVED | Rollups + MV real; `analytics-pipeline` empty | **IMPLEMENTED** | `routes/analytics.ts` |
| GraphQL / Extensions / Liquid / AI / Marketplace | REJECTED/DEFERRED | `FEATURE_*="false"` in prod; code dormant | **COMPLIANT** (but undisclosed) | `wrangler.toml:239-241` |
| Mobile login real **before beta** | P0 blocker | Turnstile placeholder blocks prod login | **VIOLATED** | `wrangler.toml` Turnstile; mobile audit |
| KYC queue / dispute log (thin ops sliver) | APPROVED | KYC sandbox auto-verify | **PARTIAL** | `routes/kyc.ts:71-79` |

## V1 violations summary (what to correct first)
1. **Stop investing in the dormant tower** (V1 §4) — quarantine `distributed-runtime`/`projection-runtime`/`orchestration` out of the build.
2. **Build the money architecture V1 actually approved** — PA payout rail + ledger-as-source-of-truth + maker-checker on the *live* payout path + capture-to-ledger.
3. **Make RLS+FORCE real or replace it** — V1 named RLS+FORCE as the tenant boundary; the service-role path nullifies it. Redesign to a tenant-scoped client or per-request JWT/GUC.
4. **Deliver the observability V1 put in P0/P1** — backups+restore, structured logs+redaction, alerting.
5. **Finish server-authoritative checkout + mobile login** — V1’s two beta gates.

## What V1 got right (return to it; don’t re-architect)
The monolith, the “rent rails / never custody” regulatory call, the outbox-not-event-bus choice, the defer-partitioning call, and keeping AI/marketplace/extensions as dormant seams are all sound. **The platform’s correct architecture already exists on paper in V1 — the gap is execution fidelity, not design.**
