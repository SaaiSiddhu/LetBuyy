# Production Readiness Assessment

**Investigation date:** 2026-06-05 (second pass, post-remediation; HEAD `127a850e`)
**Nature:** A factual, evidence‑cited assessment of the platform's *current* readiness across the dimensions a production‑operations review examines, now carrying a **delta vs. the first pass** for each dimension. Documents what exists and what is absent; prescribes nothing.

**Readiness scale:** **Operational** (implemented, wired, exercised) · **Partial** (gaps / unwired pieces / no exercise evidence) · **Contract‑only** (declared, no executing implementation) · **Absent**.

Synthesized from [14 Risk](14-risk-assessment.md), [08 Error & Misconfiguration](08-error-misconfiguration.md), [11 Architecture](11-architecture-violations.md), [07 Integration](07-integration.md).

---

## Readiness scorecard (with first→second-pass delta)

| Dimension | 1st pass | 2nd pass | Basis for change |
|---|---|---|---|
| Deployment & environments | Partial | **Partial** (unchanged) | Two prod workflows still race on push‑to‑main; `deploy-production.yml` still no migration gate; an ops test now asserts the two stay in sync |
| Database & migrations | Partial | **Partial** (doc improved) | Migration history now contiguous `000`+`073…089`; AGENTS.md citation fixed; two roots (PG15 vs PG17) + gateless `db push` persist |
| Backend ownership integrity | — | **Operational** (NEW, improved) | Single‑writer enforced + validator + regression test; the clearest readiness gain of the cycle |
| Automated testing | Contract‑only | **Partial** | 12/12 no‑op → **10/12**; webhook‑service (12 tests) + queue‑workers (2) real; 5 new federation suites pass; **but** 2 new `.ts` contract tests run in no runner (incl. the internal‑payment auth test) |
| Observability (metrics/alerts) | Contract‑only | **Contract‑only** (unchanged) | `writeDataPoint` still never called; no OTel/prom‑client; `infrastructure/` untouched |
| Logging | Partial | **Partial** | app‑marketplace gained a structured logger + `no-console`; no central aggregation |
| Error tracking | Absent | **Absent** | no Sentry/equivalent found |
| Secret management | Operational | **Partial ↓** | still no committed live secrets, **but** N‑2: app `access_token` + show‑once webhook secret now persisted plaintext in `idempotency_keys` ~24h |
| AuthN/AuthZ (platform) | Partial | **Partial ↓ on one path** | merchant credential split unchanged (H‑7); ops plane still static bearer with non‑timing‑safe compare; **N‑1**: internal payment routes fail open off‑prod |
| Payments | Partial | **Partial** | 4 PSPs with signature verify intact; webhook→order finalization now *depends on the gateway* via service binding (new coupling); app billing still test‑mode |
| Scaling & resilience | Partial | **Partial ↓** | SPOFs unchanged (one gateway/Supabase/Redis); gateway chokepoint grew (37 routers; `storefront.ts` 4,833) |
| Rate limiting / abuse | Partial | **Partial** | storefront customer login still unprotected |
| Build reliability | Partial | **Partial (claim‑only)** | remediation ledger claims `turbo typecheck` 60/60 + lint pass; only governance 129/129 independently reproduced here (no `node_modules`/pnpm in this env) |
| Backup / restore / DR | Contract‑only | **Contract‑only** | unchanged |
| Background‑job monitoring | Partial | **Partial ↓** | hot‑table partition lifecycle still has no scheduler; NEW: dead `webhook-deliveries` queue jobs accumulate forever (N‑6) |

**Net:** one dimension clearly improved (backend ownership), one improved partially (testing), two regressed on a specific path (secret management, auth), the rest unchanged. No dimension reached "Operational" that wasn't already, except the new ownership‑integrity row.

---

## 1. Deployment & environments — Partial (unchanged)
Two production deploy workflows still trigger on push to `main` with different concurrency groups (race); `deploy-production.yml` still has no migration job and no staging gate, and `echo "SKIP"`s on missing creds. The only delta is `developer-portal` being added to both 9‑app matrices and an operations test that now asserts the "legacy" workflow stays in sync — codifying the duplication rather than removing it. Staging/prod separation remains cleanly encoded; Worker rollback remains lineage‑gated. ([14](14-risk-assessment.md))

## 2. Database & migrations — Partial (documentation improved)
Migration history is now contiguous (`000_baseline.sql` + `073…089`, 18 files) and `AGENTS.md`'s citation was corrected — closing first‑pass C‑12. Still open: two diverging roots (`supabase/` PG15 vs `database/supabase/` PG17), production `db push --include-all` with no in‑repo approval gate, and the hot‑table partition lifecycle (migration 079) with no scheduler/caller. Migration `087` added template‑scoped theme drafts (an `ALTER` on `theme_editor_drafts`, despite its `theme_template_drafts` filename). ([01](01-repository-inventory.md), [14](14-risk-assessment.md))

## 3. Backend ownership integrity — Operational (new, the cycle's biggest gain)
Previously every core table was writable from multiple runtimes. Now `webhook-service` and `queue-workers` route all mutations to `orders`/`products`/`subscriptions`/`sites`/`billing_history`/`outbox_events` through gateway internal endpoints, `webhook-service` keeps only its own `payment_webhook_events`, and `single-writer-ownership-validator.mjs` (107 files) + a source regression test lock it. This is real, enforced, and verified. The trade‑off is a new bidirectional gateway↔webhook service‑binding cycle (noted in [11](11-architecture-violations.md)) and the N‑1 auth regression on the new payment endpoints (below). ([07](07-integration.md), [11](11-architecture-violations.md))

## 4. Testing — Partial (improved from contract‑only, with a sharp caveat)
12/12 no‑op test scripts → **10/12**: `webhook-service` (12 passing behavior tests) and `queue-workers` (2) are now wired, and five new federation suites pass (marketplace error handling, install store‑ownership, review verified‑install, plus the event‑contract suite). **Caveat that matters for readiness:** the two new TypeScript contract tests — `tests/contracts/storefront-internal-payment-routes.test.ts` and `domain-event-contracts.test.ts` — are matched by **no runner** (root globs are `.mjs`‑only, no workflow calls `tsx`), and the internal‑payment test asserts only the production fail‑closed branch. So the test that exists for the most sensitive new surface neither runs nor covers the dangerous case. `api-gateway` itself still ships `echo 'No tests yet'` despite 7 real `__tests__` files. ([14](14-risk-assessment.md), [08](08-error-misconfiguration.md), [17](17-evidence-appendix.md))

## 5. Security hygiene — Partial, with two new regressions on sensitive paths
Positives intact: no committed live secrets; timing‑safe webhook signature verification for all four PSPs; current dependency stack with CVE pins. Regressions introduced this cycle:

- **N‑1 (auth):** `routes/storefront/internal-payment-routes.ts:71‑76` fails **open** when `INTERNAL_API_SECRET` is unset and `ENVIRONMENT≠production` (base default `staging`), guarding payment confirm/failure endpoints — while sibling internal routers fail closed. ✅ verified.
- **N‑2 (secrets):** app `access_token` + show‑once webhook `signing_secret` persisted plaintext in `idempotency_keys.response_body` for ~24h. ✅ verified.

Unchanged operational‑security items: merchant password verification still runs in the Next app with the hash over HTTP (H‑7, now validator‑whitelisted); ops plane still a single static bearer with a non‑timing‑safe `!==` compare; credentialed wildcard‑subdomain CORS; 122 raw `error.message` sites behind a 3‑code denylist; dev MFA bypass + OTP echo unchanged (NODE_ENV‑guarded). ([08](08-error-misconfiguration.md), [11](11-architecture-violations.md), [14](14-risk-assessment.md))

## 6. Observability — Contract‑only (unchanged)
The Prometheus/Grafana/SLO stack still references metrics no runtime emits; `writeDataPoint` is still never called; there is still no OTel/prom‑client dependency and no error tracking. The remediation did not touch `infrastructure/`. Production incidents remain human/log‑detected. ([14](14-risk-assessment.md))

## 7. Scaling & resilience — Partial (slightly worse at the chokepoint)
SPOFs unchanged (one gateway, one Supabase, one Redis; `FAILOVER_REGION` string‑only). The gateway monolith grew — 37 mounted routers, `storefront.ts` 4,833 lines — and webhook payment finalization now *depends* on the gateway through the service binding, so the gateway is a slightly larger single point of failure than before. ([11](11-architecture-violations.md), [14](14-risk-assessment.md))

## 8. The governance-vs-reality gap — narrower, still real
The suite is now **129/129** and the new validator means the green result genuinely covers single‑writer ownership and the reconciled runtime map — it certifies *more* than it did. It still does not measure: the open product Criticals, N‑1's off‑prod fail‑open branch, runtime behavior, live telemetry, or whether the unwired `.ts` tests pass. The first‑pass caution narrows but holds: **a green governance run now certifies structure *and ownership*, not capability or path‑level safety.** ([17](17-evidence-appendix.md))

---

### Evidence Index (this report)
- Single‑writer enforcement, validator, regression test — `FORENSIC_REPORT/07-integration.md`, `11-architecture-violations.md`
- N‑1 fail‑open, N‑2 plaintext secrets, N‑3 unwired tests — `FORENSIC_REPORT/08-error-misconfiguration.md`, `14-risk-assessment.md`, `17-evidence-appendix.md`
- Deploy workflows, observability, SPOFs, partition lifecycle, base‑URL defaults — `FORENSIC_REPORT/14-risk-assessment.md`
- Test‑script states, governance 129/129 — `FORENSIC_REPORT/03-application-investigation.md`, `17-evidence-appendix.md`
- Migration topology, validator count — `FORENSIC_REPORT/01-repository-inventory.md`
