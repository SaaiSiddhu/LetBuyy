# 17 — Production Readiness Assessment

Question: can LetBuyy take real merchants and real money today, and what gates the launch (doc 14 Phase 9)? Verdict: **NOT READY — conditional path defined.** Current posture is "credential-gated plan-ready" by its own manifests (`config/runtime/live-production-certification.json`), i.e., the system has never proven itself against live infrastructure.

---

## 1. Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Functional completeness (commerce core) | 7/10 | products/orders/payments/customers/coupons/inventory real in gateway; checkout UI + 4 PSPs + COD; GST invoicing |
| Theme platform | 4/10 | docs 03–04 gaps; dual engines |
| Security | 5/10 | strong middleware stack; S-01…S-08 open (doc 16 §2) |
| Data integrity | 5/10 | RLS + audit columns broadly present; tenancy nullability (DB-01); no down-migrations; restore never drilled |
| **Deploy/release engineering** | 4/10 | dual prod workflows; deploys **silently skip** without creds (`HAS_CLOUDFLARE_CREDS` guard); no gradual rollout for workers |
| **Testing/verification** | 3/10 | 132 validators = manifest self-checks; gateway tests = source-regex; E2E skips when staging unreachable; k6 hits `/v1/health` only; chaos/load never executed (evidence gitignored) |
| Observability | 4/10 | dashboards/SLO catalog/OTel configs EXIST as files; ingestion path partial (queue lag + request logs real); no alert routing proven; no error tracker |
| Operational maturity | 4/10 | rich ops API surface (replay/DLQ/dispatch endpoints exist); runbooks present as docs; none exercised (no drill evidence) |
| Compliance/legal | 5/10 | GST plumbing real; policies pages exist; app-data-redaction topics defined but unenforced (V-27); no pen test |
| **Overall** | **41/100** | coincidentally matches Shopify-gap score |

## 2. The Core Problem: Evidence vs. Assertion

The repo asserts readiness through manifests that validate themselves:

- `provider-evidence-validator.mjs` **passes by confirming no live evidence exists** (plan mode).
- `production-certification-execution.json`: `mode: "provider-backed-execute-required"` — execute mode never run.
- CI deploy steps: `if HAS_CLOUDFLARE_CREDS == 'true'` → without secrets, pipeline goes green having deployed nothing.
- Playwright: `test.skip()` when staging unreachable → green without testing.
- api-gateway `__tests__`: `assert.match(sourceText, /pattern/)` — code-shape tests, not behavior tests.

**Principle for Phase 9:** a check may be green only if the thing it claims was actually exercised. Absence of credentials/environment must FAIL the gate, not skip it.

## 3. Launch Gate Checklist (all must be ✓; owns Phase 9)

### 3.1 Release engineering
- [ ] One production workflow (delete the duplicate — doc 05 D1); environments: staging auto, production manual-approve.
- [ ] Cred-presence asserted (fail-closed) for Cloudflare, Vercel, Supabase in deploy jobs.
- [ ] Worker gradual rollout (10%→100%) + instant rollback rehearsed; Vercel rollback rehearsed; DB down-migration rehearsed (≥079 set).
- [ ] Wrangler/Terraform drift check against live account (real `verify-provider-contracts.mjs --execute` — script EXISTS).

### 3.2 Verification
- [ ] Smoke E2E (signup→create store→install theme→publish→storefront renders→add to cart→test-mode checkout→order visible in admin) — non-skippable, runs on staging on every deploy, blocks production.
- [ ] Contract tests from OpenAPI on all `/v1` stable routes (doc 12 §5).
- [ ] Theme-engine conformance suite green (doc 07 §11).
- [ ] k6: real commerce scenario at 5× expected peak; thresholds enforced (`load/` harness EXISTS — point it at flows, set `LETBUYY_API_BASE_URL`, run `--mode=execute`).
- [ ] One chaos drill executed (queue-worker kill + DLQ replay via existing ops endpoints) with written timing evidence.

### 3.3 Data
- [ ] Backup restore drill: fresh Supabase restore from backup + migration replay; RTO/RPO documented (DB-02 in doc 16 §3).
- [ ] Tenancy constraints live (079/080) + orphan scan zero.
- [ ] Retention jobs active (doc 11 §8).

### 3.4 Security
- [ ] S-01…S-05 merged (doc 16 §2); pen-test pass on auth/tenancy/payment paths (external or structured internal).
- [ ] Secret inventory + rotation runbook executed once for real (incl. `INTERNAL_API_SECRET` per-service split).
- [ ] Rate limits load-verified on auth + storefront customer endpoints.

### 3.5 Observability & Ops
- [ ] SLOs from `infrastructure/monitoring/slo-catalog.yaml` emitting real series; alerts routed (pager/email) and test-fired.
- [ ] Error tracking (Sentry-class) wired in apps + workers.
- [ ] Dashboards (Grafana JSONs EXIST) bound to live datasources; on-call + incident runbook game-day executed.
- [ ] Status page + maintenance-mode switch for storefronts.

### 3.6 Validator descope (truth alignment)
- [ ] Keep: import/alias/topology, runtime-manifest presence, migration-safety, env-validator, supply-chain. Retire/merge the ~80 manifest-assert validators into `topology-lint`; delete validators that pass on absence-of-evidence. CI time and false confidence both drop.

## 4. Conditional GO

GO when §3 = 100% plus 2-week staging soak within SLO error budget and Phase 7 cutover complete (one engine). Anything earlier is a **closed beta** behind invite, COD/test-mode payments only, ≤50 stores — acceptable from end of Phase 4 if S-01–S-03 are fixed (Phase 1) and the smoke E2E gate is live.
