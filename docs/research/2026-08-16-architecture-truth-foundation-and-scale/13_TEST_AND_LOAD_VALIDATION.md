# 13 — Test and Load Validation Programme

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `f52abca7ef6b2ddfc39f03b38206779cbe543e46` · branch `stepup/main` · 2026-08-16.

---

## 0. Conclusion first

1. **The 110-validator gate is a static-analysis suite, not a behavioural one.** I reparsed `scripts/validate-governance.mjs:70-181` programmatically: 110 entries, 110 unique. **0 make an HTTP request. 0 connect to PostgreSQL. 0 boot a Worker or a Next app. Exactly 2 spawn a subprocess.** `VERIFIED-SOURCE`.
2. **But real behavioural coverage exists and is load-bearing.** `.github/workflows/ci.yml:121,164` run `pnpm run test:behavioral`, which docker-starts `postgres:16-alpine` and executes **21 unskippable real-SQL suites** containing **48 `SET ROLE` statements**. `VERIFIED-CONFIG` + `VERIFIED-SOURCE`.
3. **The money-ledger indictment in the discovery pass was REFUTED and I confirm the refutation.** `post_ledger_transaction` is the transitive kernel of every production money write, reached via `post_settlement_ledger_transaction` (`165_d5_canonical_money_paths.sql:253`) from `confirm_order_payment_with_ledger` / `complete_order_refund` / `record_order_payment_failure_with_ledger` (`168_b1_b2_capture_refund_ledgering.sql:238,401,663`). The behavioural ledger proof is on the right kernel.
4. **There is no load testing of any kind.** No `k6`, `artillery`, `autocannon`, `locust`, or `gatling` dependency exists in any `package.json` or workflow (`rg` over all manifests and `.github/`: zero hits). `tests/performance/` is 10 `readFileSync`-and-`includes` files that measure nothing.
5. **Three defects I found myself that the digest did not report** are, in my judgement, the most consequential findings in this document — all three are *silent skips in lanes that are counted as gates*. See §A.4.
6. **The programme below is a proposal.** Nothing in §B, §C, §D is ratified. §C carries a hard safety rule that governs every load activity.

---

# A. Current coverage honesty matrix

## A.1 What the gate lane actually is

*Method:* I parsed the `validators` array out of `scripts/validate-governance.mjs` and classified every file in `scripts/validators/` by mechanism. This reproduces and slightly refines the discovery-digest census.

| Mechanism over the 110 gate-lane validators | Count | State |
|---|---:|---|
| Makes an HTTP request (`fetch`/`undici`/`axios`/`node:http`) | **0** | `VERIFIED-SOURCE` |
| Connects to PostgreSQL | **0** | `VERIFIED-SOURCE` |
| Boots a Worker or a Next app | **0** | `VERIFIED-SOURCE` |
| Spawns a subprocess that reproduces the checked work | **2** | `VERIFIED-SOURCE` |
| Uses substring/regex matching at all | 99 | `VERIFIED-SOURCE` |
| Parses JSON/TOML at all | 46 | `VERIFIED-SOURCE` |
| Text-matching **only** (no structured parse) | 56 | `VERIFIED-SOURCE` |
| JSON-parse **only** (no text matching) | 3 | `VERIFIED-SOURCE` |
| Neither text nor JSON (pure `exists()` / git listing) | 8 | `VERIFIED-SOURCE` |

The two subprocess validators are `scripts/validators/mobile-token-validator.mjs:3-8` (re-runs the token generator with `--check`) and `scripts/validators/branch-lag-guard-validator.mjs:57-90` (shells to `git rev-list`). A third, `manifest-lineage-validator.mjs:24-28,52`, *recomputes* SHA-256 over checked-in config files — computational reproduction rather than text matching. So **3/110 execute or recompute; 0/110 observe runtime.**

**Requested four-bucket classification** (by primary mechanism, strict reading — from the discovery inventory, which I reproduced independently):

| Bucket | Count | Definition |
|---|---:|---|
| **Behavioural** | **2** | Executes the work being checked |
| **Structural** | ~13 | Assertions are over *parsed* values (48 if "parses JSON at all" is the criterion) |
| **Grep / regex** | ~93 | Assertions are over source text (56 use text matching exclusively) |
| **File-presence** | ~2 | `exists()` only |

**Two of the 110 are one-line aliases.** `scripts/validators/undeclared-import-validator.mjs:1` is exactly `import "./dependency-manifest-validator.mjs";` and `scripts/validators/wrangler-env-validator.mjs:1` is exactly `import "./cloudflare-environment-validator.mjs";`. Both aliases *and* both targets are in the gate array, so the distinct-check count is **108**, and `undeclared-import-validator.mjs` sits in `criticalGateValidators` (`scripts/validate-governance.mjs:200-206`) next to its own target — the "critical five" are four. Severity per adversarial pass: **S2**. `VERIFIED-SOURCE`.

> A green gate is evidence about the **shape of the source tree**. It is not evidence about runtime, deployment, throughput, latency, contention, or degradation. Nothing in the gate observes any of those at any merchant count.

## A.2 Corrected findings carried from the adversarial pass

Where the adversarial pass corrected a discovery finding, the corrected form is used.

### A.2.1 Two gate validators' offender scan is dead code in a real gate run — **S2** (corrected down from S1)

`scripts/validators/rls-force-coverage-validator.mjs:36` and `scripts/validators/one-system-per-domain-validator.mjs:28` both open their offender loop with `if (!entry.extra) continue;`. `scripts/validators/phase-b-common.mjs:52-59` marks **every real workspace file `extra: false`**; only fixtures injected via `LETBUYY_PHASE_B_EXTRA_FILES_JSON` get `extra: true` (`phase-b-common.mjs:19-43`), and that variable is set nowhere except `tests/governance/phase-b-validators.test.mjs:147`. During `pnpm run validate:governance` both loops iterate every file and `continue` immediately. I reproduced every step of this. `VERIFIED-SOURCE`.

**Corrected scope, and it matters:**

- `rls-force-coverage`'s residual enforcement is four fixed-target greps (`:13-32`), including certifying the RT-1..RT-9 red-team by asserting the literal English string `"RT-9 authenticated users must not be able to self-add super admins"` appears in the test file (`:30-31`). Adding that string satisfies the check with no test running.
- `one-system-per-domain` is **not** wholly inert — `:9-22` performs live assertions over `config/runtime/production-topology.json`. Only its regex scan is dead.
- **There is no currently-masked violation.** `database/supabase/migrations/164_d4_tenant_role_guc.sql:39-74` dynamically `ENABLE`s + `FORCE`s RLS on every table carrying a tenant column at migration time, and every post-164 migration that creates a tenant table (176, 184, 185, 194, 195) already includes `FORCE`. This is a **latent missing preventive control**, not a live RLS exposure.
- Fixing it is not a one-line deletion: enabling the loop as written would flag ~35 legacy migration files, so the ratchet needs baselining to migrations > 164.

### A.2.2 The 21 mandated "enterprise test proof files" import zero production modules — **S2** (corrected down from S1)

`scripts/validators/test-coverage-governance-validator.mjs:9-35` requires 21 named test files to **exist** (`exists(file)` only, no content check). I checked the import lines of all 21 mechanically: **every one imports only `node:` builtins.** `VERIFIED-SOURCE`. (One apparent counter-example, `tests/operations/rate-limit-collapse.test.mjs`, matches `from './middleware/rateLimit'` only *inside an assertion regex* at `:15` — it is not an import.)

Corrected sub-scope:

| Class | Count | Files |
|---|---:|---|
| Pure `spawnSync(validator)` + `assert.equal(status,0)` wrappers | 8 | `typescript-governance`, `migration-safety`, `cloudflare-isolation`, `cloudflare-binding-governance`, `dependency-governance`, `operations/runtime-governance`, `operations/rollback-lineage-governance`, `ci/ci-simulation` |
| Hybrid (spawn + real-artifact assertions) | 2 | `contracts/manifest-lineage-governance`, `ci/workflow-trigger-coverage` |
| **Self-referential tautology** (reimplements production logic, asserts against its own copy) | **3** | `tests/replay/replay-determinism.test.mjs:4-58` (own `replay()` reducer, `:67` asserts it deep-equals itself); `tests/queues/queue-recovery.test.mjs:4-35` (own `queueRetryDelayMs`/`planQueueRecovery`); `tests/feature-flags/feature-flag-governance.test.mjs:5-18` (own FNV-1a `stableBucket`, asserts `f(x)===f(x)`) |
| Executes a shipped production script and asserts fail-closed | 2 | `tests/operations/deployment-safety.test.mjs:5-29`; `tests/security/execution-mode.test.mjs:5-21` |
| Binds to real shipped source/config text (grep, but not tautological) | 6 | `production-deploy-workflow`, `rate-limit-collapse`, `queue-bulk-cost`, `queue-storm-controls`, `contracts/event-contracts`, `contracts/runtime-lifecycle-contract` |

The **concrete** coverage gap is queue retry delay: the shipped policy is `eventRetryDelaySeconds` at `packages/event-core/src/index.ts:804` (base 30 s, exponential, cap 3600 s), called at `services/queue-workers/src/platform-queue-consumer.ts:1596` and `services/api-gateway/src/execution/{queue,outbox}-execution.adapter.ts:688/236`. **No test in the repository imports or executes it**; the tautology's local copy encodes a *different* policy (1000 ms base, 10000 ms cap). Conversely, DLQ/quarantine behaviour **is** bound to the shipped consumer by `tests/operations/queue-storm-controls.test.mjs:16-33,63-75` (asserting `QueueProcessingError`, `quarantinedDelivery`, `DeterministicQueueJobError`, `quarantine_platform_queue_job`, migration 089, and production `max_concurrency <= 10`).

### A.2.3 TEST-R10's replay clause is unimplemented — **S2** (corrected down from S1)

`AGENTS.md:214` mandates ephemeral-Postgres suites in CI "(replay 000→161, `SET ROLE` to the production-shaped role, assert behavioral invariants)". *Note the mandate text says* **`000→161`**; the migration set at this SHA is **126 files spanning 000 then 073→197** (`ls database/supabase/migrations/*.sql | wc -l` = 126; last file `197_letbuyy_core_first_class_theme.sql`). Neither range is replayed.

- The **primary** clause IS satisfied: `ci.yml:121,164` → `pnpm run test:behavioral` (`package.json:120`) → `scripts/governance/foundation-ephemeral-postgres.mjs` starts `postgres:16-alpine` → `node --test --test-concurrency=1 tests/*/*.test.mjs`, 48 `SET ROLE` statements across the executable suites.
- The **replay** clause is not: `foundation-ephemeral-postgres.mjs:55-73` applies **zero** migrations, and each suite runs `DROP SCHEMA IF EXISTS public CASCADE`, hand-builds a fixture, then applies 1–5 hand-picked migrations — sometimes numerically out of order (`tests/executable/foundation-wave1-money-postgres.test.mjs:12-18` applies 139, 119, 142, 151, 160).
- `tests/migrations/v2-migration-replayability.test.mjs:47-80` is a `readFileSync`/regex grep over a hard-coded 19-file list, not a replay.
- **The sharper consequence, which the digest under-stated:** the fixture schemas materially diverge from the real one. `tests/executable/money-ledger-postgres.test.mjs:94-100` creates `public.sites` with 5 columns; the real table (`000_baseline.sql:11961-11981`) requires `store_name`, `site_type`, `subdomain` `NOT NULL` and dozens more. The money-kernel behavioural evidence is about a fabricated schema.
- **Mitigations that keep this at S2:** `migration-safety-validator.mjs:17-22` statically bans destructive DDL across all tracked migrations; `v2-migration-replayability.test.mjs:56-71` enforces idempotency patterns on 19 files; and `staging-deploy.yml:46` runs `supabase db push --include-all` against a real staging DB before `production-deploy.yml:281` reaches production — so apply-order breakage surfaces pre-production.

**I independently confirmed the highest migration any executable suite loads is 164** (`rg -on "migrations/[0-9]+[a-z_0-9]*\.sql" tests/executable/*.mjs | sort -u`): 107, 119, 139, 141–154, 161, 163, 164. **165, 168, and 170 — the migrations containing the deployed bodies of `post_settlement_ledger_transaction`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `record_order_payment_failure_with_ledger` and `create_checkout_order` — are loaded by no behavioural test.**

### A.2.4 The money-ledger indictment was **REFUTED** — reported here as a refutation, not a defect

The discovery pass claimed the only behavioural money proof targets an RPC with zero production callers. **That is wrong, and I verified the refutation myself:**

```
services/api-gateway/src/execution/payment-execution.adapter.ts
    → confirm_order_payment_with_ledger        (168_b1_b2_capture_refund_ledgering.sql:133)
        → post_settlement_ledger_transaction   (called at 168:238)
            → post_ledger_transaction          (called at 165_d5_canonical_money_paths.sql:253)
```

`post_settlement_ledger_transaction` is also called at `168:401` (`complete_order_refund`) and `168:663` (`record_order_payment_failure_with_ledger`), and directly from TypeScript at `services/api-gateway/src/routes/commission.ts:148` (plus `routes/settlements.ts:175`, `routes/payouts.ts:195`, `lib/payment-route-support.ts:185`). **`tests/executable/money-ledger-postgres.test.mjs` therefore proves append-only enforcement, Σdebit = Σcredit (`ledger_balance_breaks() = 0`) and 12-writer idempotency on the exact kernel every production money write funnels through.** `VERIFIED-SOURCE`.

The **residual, S3** finding is narrow and stated above in A.2.3: no executable test loads 165/168/170, so the *entry-point* bodies are covered by source-regex assertion only (`services/api-gateway/src/__tests__/money-d5-ledger.test.ts:134,143,154`; `settlements.test.ts:32,55,60`).

## A.3 The genuine positives, stated plainly

| Positive | Evidence | State |
|---|---|---|
| **21 unskippable real-SQL suites run on every PR.** `pnpm run test:behavioral` chains container start with `&&`, so absent Docker fails the step rather than skipping | `package.json:120`; `scripts/governance/foundation-ephemeral-postgres.mjs:5,55-73`; `.github/workflows/ci.yml:121,164`; 20 of 21 files in `tests/executable/` contain `docker exec … psql -v ON_ERROR_STOP=1`, plus `tests/identity-foundation/identity-foundation-postgres.test.mjs:9,23` | `VERIFIED-CONFIG` + `VERIFIED-SOURCE` |
| **48 `SET ROLE` statements** across the executable suites (32 `app_user`, 6 `authenticated`, 5 `anon`, 4 `executable_app_user`) — production-shaped role testing, not superuser testing | `grep -oE "(^\|[^A-Z])SET ROLE" tests/executable/*.mjs` = 48; per-file max 10 in `security-rls-hardening-postgres.test.mjs` | `VERIFIED-SOURCE` |
| **Tenant red-team is real and build-failing**, positive-control-first (`'1'` for owner row asserted *before* `'0'` for cross-tenant), no env conditional | `tests/executable/tenant-redteam-postgres.test.mjs:253-292` | `VERIFIED-TEST` |
| **Ledger append-only + balance + 12-way concurrent idempotency** are behaviourally proven on the production kernel | `tests/executable/money-ledger-postgres.test.mjs:142-282` | `VERIFIED-TEST` |
| **Outbox same-transaction atomicity** proven by an explicit `ROLLBACK` followed by a `count(*) = 0` assertion | `tests/executable/foundation-reference-postgres.test.mjs:255-267` | `VERIFIED-TEST` |
| **Inventory oversell prevention under contention**: 2 concurrent reserves on 1 unit, exactly 1 fulfilled and 1 rejected | `tests/executable/inventory-postgres.test.mjs:204-208` | `VERIFIED-TEST` |
| **Session rotation and reuse rejection** proven behaviourally on migration 161 | `tests/executable/foundation-wave4-session-postgres.test.mjs:66` | `VERIFIED-TEST` |
| **Real ES256 crypto forgery test**: generates a keypair, signs, mutates the signature, re-signs with HS256, and omits the `jti`, asserting rejection in all three cases against the actual verifier | `services/api-gateway/src/__tests__/identity-issuer-d3.test.ts:93-153` (imports `validateIdentityIssuedMerchantSessionToken` at `:5`) | `VERIFIED-TEST` |
| **Liquid sandbox security is a real render test**, SEC-1..SEC-10 (DOMPurify FORBID lists, SSTI, drop depth/key limits, prototype pollution, CSS token injection, `javascript:` href) | `packages/theme-engine/test/qi-security.test.ts` (630 lines, header `:3-14`) | `VERIFIED-TEST` |
| **Playwright against staging is a hard `needs:` predecessor of production deploy** — `staging-e2e` → `migrate-production` → `deploy-workers-production` | `.github/workflows/production-deploy.yml:172-198`, `:225-229`, `:285-289` | `VERIFIED-CONFIG` |
| 19 of 82 gateway unit tests import real modules rather than grepping them | `services/api-gateway/src/__tests__/` — e.g. `internal-auth-keyring.test.ts:8`, `customer-engagement.security.test.ts:6-7`, `automation-rule-eval.test.ts:14` | `VERIFIED-SOURCE` |

## A.4 Where my own reading contradicts the digest — **my reading wins**

These four items were established by direct source reading at this SHA. Three of them are silent-skip defects in lanes that other documents treat as gates; I regard them as the most important content in this section.

### A.4.1 The theme tenant-isolation suite **silently skips in CI** because it looks for the wrong container

`tests/security/theme-tenant-isolation.test.mjs` is **not** a source-grep (the digest inventory classified `tests/security/` as "3 files, 2 are source-grep"). It is a genuine `docker exec … psql` behavioural RLS test with paired positive controls and a residue check (`:54-58`, `:213-217`, `:225`). **But:**

```
tests/security/theme-tenant-isolation.test.mjs:31
  const container = process.env.LETBUYY_SUPABASE_PG_CONTAINER || 'supabase_db_Letbuyy_Store';

scripts/governance/foundation-ephemeral-postgres.mjs:5
  const container = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || "letbuyy-executable-pg";

tests/security/theme-tenant-isolation.test.mjs:204-210
  const reachable = databaseReachable();
  const skip = reachable ? false : `Supabase Postgres container "${container}" is not reachable…`;
  describe('theme tenant isolation (migration 196 RLS, live schema)', { skip }, () => {
```

`test:behavioral` (`package.json:120`) glob `tests/*/*.test.mjs` **does** match this file, so it is collected in CI — and then skips, because the container it wants is the local Supabase CLI container, not the ephemeral one CI starts. **Migration 196's theme RLS hardening — the only suite in the repository that claims to run against the real schema rather than a hand-built fixture — is never executed by CI.** `VERIFIED-SOURCE`. Severity in my judgement: **S2** (a tenant-isolation proof that reports green without running).

### A.4.2 The production-gating E2E suite **skips instead of failing** when staging is unreachable

`production-deploy.yml:204` sets `LETBUYY_E2E_REQUIRE_REAL_STACK: "1"`, and `tests/e2e/smoke/release-gates.spec.ts:4,34-38` honours it — `skipOrFail` **throws** when the flag is set. Good.

**But the two journey specs and the homepage smoke do not read that variable at all.** They call bare `test.skip`:

| File | Skip condition | Effect under the production gate |
|---|---|---|
| `tests/e2e/customer-journey.spec.ts:6-9` (called `:73`) | target unreachable, or HTTP ≥ 500 | The **only** end-to-end checkout journey skips; job passes |
| `tests/e2e/customer-journey.spec.ts:53` | cart URL not resolvable | skips |
| `tests/e2e/merchant-journey.spec.ts:9-12` (called `:57-59`) | any of marketing / identity / merchant unreachable or 5xx | skips |
| `tests/e2e/merchant-journey.spec.ts:64,72,95,100` | signup input / submit / product save / publish control "was not visible" | **A broken merchant signup form is a skip, not a failure** |
| `tests/e2e/smoke/homepage.spec.ts:8-11` | any surface unreachable or 5xx | skips |
| `tests/e2e/federation/real-stack.ts:132`, `federation/identity-sso.spec.ts:40` | gateway rejects staging internal auth | skips |

A gate that passes when the environment under test is down, or when the UI control it needs has vanished, is not a gate. `VERIFIED-SOURCE`. Severity in my judgement: **S2**.

**Spec count correction.** The digest says `tests/e2e/` holds "10 spec files"; the adversarial pass says "only 2 spec files". **Both are wrong.** `tests/e2e/` contains **9 `.spec.ts` files** (2 top-level journeys, 2 under `smoke/`, 5 under `federation/`) plus one non-spec helper `federation/real-stack.ts` — 10 files, 1,033 lines total. `production-deploy.yml:198` runs all of `tests/e2e/`; `:515` and `staging-deploy.yml:268` run only `tests/e2e/smoke/`.

### A.4.3 `deploy-staging.yml` **does** have a smoke job — but it probes a hardcoded literal

The digest states the active staging lane has "no test or smoke step at all". It has one: `deploy-staging.yml:174-215`, a `smoke-test-staging` job with four `curl` health checks. **Three qualifications, all of which I verified:**

1. Every step is gated on `env.HAS_CLOUDFLARE_CREDS == 'true' && env.HAS_VERCEL_CREDS == 'true'` (`:184`, `:192`, `:199`, `:209`); without credentials the job prints `SKIP:` and passes (`:180-182`).
2. The API check asserts `HTTP 200` from `https://api-staging.letbuyy.com/v1/health`. That route returns `healthResponse()` — a **hardcoded** `status: 'healthy'` object with **no dependency probe of any kind** (`services/api-gateway/src/index.ts:311-318`, literal at `:313`; mounted at `:670` and `:677`).
3. Two of the four accept `302` as success (`:200`, `:211`).

So the correct statement is: **the active staging lane has a liveness ping against a constant, and no functional test.** `VERIFIED-CONFIG` + `VERIFIED-SOURCE`.

### A.4.4 One SLO exists in the repository — and it is measured against that same constant

My brief said "no SLOs currently exist anywhere in the repo." That is **not** accurate at this SHA. `infrastructure/monitoring/slo-catalog.yaml:1-9` defines exactly one:

```yaml
- name: deployment-gate-success
  sli: successful_deployment_health_gates / total_deployment_health_gates
  target: 100
  window: 30d
```

Its SLI is populated from the health-gate probes described in A.4.3, i.e. from an endpoint that returns a hardcoded literal. Nothing else consumes the file (`rg slo-catalog` finds only `docs/governance/sre-governance.md:7` and audit reports). **There is no availability, latency, checkout-success, payment-success, refund-success, or queue-lag SLO for any user-facing surface** — which is the substance my brief intended, and which §D proposes to fill. `VERIFIED-CONFIG`.

## A.5 Per-invariant coverage table

Legend: **BEHAVIORAL** = a test executes the real implementation and asserts the invariant · **STRUCTURAL-ONLY** = assertions over parsed config/manifests · **GREP-ONLY** = assertions over source text · **ABSENT** = nothing.

| # | Invariant | Verdict | Providing artefact | Note |
|---|---|---|---|---|
| 1 | **Tenant isolation** (RT-1..RT-9) | **BEHAVIORAL (fixture-scoped)** | `tests/executable/tenant-redteam-postgres.test.mjs:253-292`; fixture at `:66-120`; migrations at `:11-19` | Real `SET ROLE`, positive-control-first, build-failing. **13 hand-built tables, migrations 163+164 only.** Mandated path `tests/security/cross-tenant-redteam-postgres.test.mjs` (`AGENTS.md:205`) **does not exist**. Registry-wide FORCE coverage is GREP-ONLY with a dead scan (§A.2.1). Theme tables: behavioural but **skipped in CI** (§A.4.1) |
| 2 | **Sole issuer** (ES256 merchant / HS256 customer, never crossed) | **BEHAVIORAL (partial)** | `services/api-gateway/src/__tests__/identity-issuer-d3.test.ts:93-153` | Real keypair, forgery, HS256 rejection, missing-`jti` rejection. **No `alg:'none'` case. No dual-verify drain-gate proving zero legacy HS256 verifications** (TEST-R5, `AGENTS.md:206`). Gate-side check is `identity-sole-issuer-validator.mjs:17-22`, which detects only `new SignJWT` / `jwt.sign(` / an HS256 header literal |
| 3 | **Session rotation / revocation** | **BEHAVIORAL** | `tests/executable/foundation-wave4-session-postgres.test.mjs:66` (migration 161) | Rotates, rejects reuse, rolls back. Everything else in `session-security-validator.mjs:9-80` is identifier-substring assertion |
| 4 | **Checkout handoff binding** (signed handoff) | **GREP-ONLY** | `services/api-gateway/src/__tests__/checkout.test.ts:1-20+`, `checkout-d6.test.ts`, `cart.test.ts` — all `readFileSync` + `assert.match` | `tests/executable/checkout-postgres.test.mjs:133` is behavioural but covers the **state machine and session/branding isolation** on migration 146, not signature binding |
| 5 | **Server-side totals** (amounts computed in the RPC, never client) | **GREP-ONLY** | `services/api-gateway/src/__tests__/payments.test.ts`, `orders-data-integrity.test.ts` (both `readFileSync`-based) | The RPC that computes them, `create_checkout_order` (`170_v1_shipping_rates_gst.sql:31`), is loaded by **no** executable test |
| 6 | **Inventory contention** (no oversell) | **BEHAVIORAL** | `tests/executable/inventory-postgres.test.mjs:204-208` | 2 concurrent reserves on 1 unit via `Promise.allSettled`. Proves correctness under contention; **proves nothing about throughput** — no N-writer sweep, no hot-SKU ceiling measurement |
| 7 | **Duplicate payment webhook** (exactly-once effect) | **GREP-ONLY** | `services/api-gateway/src/__tests__/payments.test.ts` (source assertions) | No executable test exercises `confirm_order_payment_with_ledger` (migration 168, unloaded). Double-webhook races are serialised in SQL by `SELECT … FOR UPDATE` at `168:167-171` — an unexercised code path |
| 8 | **Duplicate capture / refund** | **BEHAVIORAL at the kernel; GREP-ONLY at the entry point** | Kernel: `tests/executable/money-ledger-postgres.test.mjs:242-255` (12 concurrent `psql` writers collapse to 1 transaction / 2 entries); `tests/executable/settlement-postgres.test.mjs:264-277` (same idempotency key ⇒ same transaction id, on migration 151) | Entry points `complete_order_refund` / `record_order_payment_failure_with_ledger` (migration 168) unexercised. The **superseded** 151 body is what settlement tests run, not the current 165 body |
| 9 | **Ledger balance property** (Σdebit = Σcredit) | **BEHAVIORAL** | `tests/executable/money-ledger-postgres.test.mjs` — `ledger_balance_breaks() = 0` asserted at `:167`, `:191`, `:214`; `tests/executable/foundation-wave1-money-postgres.test.mjs:151-205` | Not property-based over randomised amounts/tenders/accounts as TEST-R3 requires (`AGENTS.md:204`) — fixed scenarios only |
| 10 | **Reconciliation-to-zero** (book ties to PSP + COD) | **ABSENT from every automated lane** | `scripts/money-certification/check-invariants.mjs:25-32` implements I1–I8 (double-entry, append-only, provider conservation, merchant conservation, zero rake, idempotency, single writer, COD symmetry) with a `--probe` negative control; exposed as `pnpm money:invariants` at `package.json:128` | `grep -rn money-certification .github/` → **zero matches.** `AGENTS.md:204` calls it "the money-cluster deploy gate AND the deletion gate for every legacy money path." It is invoked by nothing and requires a `STAGING_DB_URL` no workflow supplies |
| 11 | **Append-only enforcement** | **BEHAVIORAL** | `tests/executable/money-ledger-postgres.test.mjs` — `UPDATE` and `DELETE` on `ledger_entries` asserted to throw `/ledger is append-only/` | Proven on migration 139's triggers |
| 12 | **Outbox same-transaction atomicity** | **BEHAVIORAL** | `tests/executable/foundation-reference-postgres.test.mjs:255-267` | Explicit `ROLLBACK` then `count(*) = 0` on the outbox row |
| 13 | **Queue retry / DLQ idempotency** | **Retry: ABSENT. DLQ/quarantine: GREP-ONLY (bound to real symbols)** | Retry: shipped `eventRetryDelaySeconds` at `packages/event-core/src/index.ts:804`; `rg eventRetryDelaySeconds tests/` → **zero hits**; `tests/queues/queue-recovery.test.mjs:4-35` asserts against its own different policy. DLQ: `tests/operations/queue-storm-controls.test.mjs:16-33,63-75,77-86` | Contract lane `tests/contracts/domain-event-contracts.test.ts:3-6` **does** import `packages/event-core` real modules — the only production-module import in the mandated surface |
| 14 | **Liquid sandbox / XSS** | **BEHAVIORAL (conditionally executed)** | `packages/theme-engine/test/qi-security.test.ts` — SEC-1..SEC-10, real render + assert | Runs in CI **only** when `packages/theme-engine` is in the `pnpm turbo test --filter="...[HEAD^1]"` changed set (`ci.yml:126`). **No render-parity (Liquid ≡ React screenshot/DOM-diff) gate exists anywhere**, which TEST-R6 makes a hard prerequisite for Liquid reaching a buyer (`AGENTS.md:207`) |
| 15 | **Cache tenant isolation** | **GREP-ONLY** | `tests/performance/storefront-cache.test.mjs:1-20` — `readFileSync` of `storefront-cache.ts`, route source, `themes.ts`, `index.ts`, `wrangler.toml`, then `source.includes(needle)` | No test constructs two tenants and proves one cannot read the other's cached entry |
| 16 | **Cache invalidation** | **GREP-ONLY** | Same file — asserts `STOREFRONT_CACHE_TTL_SECONDS = 60` appears in source | No test writes, invalidates, and re-reads. The multi-domain invalidation defect (`07_CAPACITY_MODEL.md` §3.3) is untestable by any current artefact |
| 17 | **Backup restore** | **ABSENT** | `scripts/governance/foundation-restore-drill.mjs` defaults to `--plan` (prints and exits 0) and its `--execute` path refuses non-localhost targets; only reference is `package.json:127` (`:plan`); `grep -rn restore-drill .github/` → zero. `production-deploy.yml:250-255` runs `pg_dump` + `pg_restore --list` (a TOC listing, not a restore). `config/runtime/database-recovery-policy.json` marks PITR `human-required-paid-tier` and lists "RPO/RTO target recorded" as *resume evidence* — i.e. not yet recorded | **RTO and RPO are unproven numbers.** `HUMAN-REQUIRED` |
| 18 | **Deploy rollback** | **STRUCTURAL-ONLY** | `rollback-integrity-validator.mjs` over `config/runtime/deployment-lineage-manifest.json`, which self-declares `mode: "governance-contract-not-live-evidence"`; `tests/operations/rollback-lineage-governance.test.mjs` is a validator wrapper | **Migration** rollback SQL *is* behaviourally applied at the end of most executable suites (e.g. `money-ledger-postgres.test.mjs:276-281`), and 48 rollback files exist under `database/supabase/rollback/`. **Worker/app deploy rollback is never executed** |
| 19 | **Branch alignment** | **BEHAVIORAL in the enforced lane only; degenerate in the gate lane** | `scripts/validators/branch-lag-guard-validator.mjs:69-120`. Real `git rev-list --count HEAD..origin/<integration>` only when `LETBUYY_ENFORCE_BRANCH_LAG=1` (set in `production-deploy.yml` and `branch-lag-monitor.yml`). Otherwise `:111-116` reduces to `rev-list --count HEAD > 0` — "the branch has commits" | On the audited branch `stepup/main` the degenerate assertion is what runs, contributing a guaranteed pass to the 110 |

**Summary of the 19:** BEHAVIORAL 8 (two of them fixture- or condition-scoped) · BEHAVIORAL-at-kernel-only 1 · STRUCTURAL-ONLY 1 · GREP-ONLY 6 · ABSENT 3.

---

# B. The programme to build

**Status: `PROPOSED — NOT RATIFIED`.** Nothing below is an implementation order. Ordering is by ratio of invariant-risk retired to effort, not by layer purity.

| # | Layer | Must prove | Currently |
|---|---|---|---|
| **L1** | **Unit + property** | Money arithmetic in minor units with no float; GST rounding to the paise; discount/tender stacking; `Σdebit = Σcredit` as a **property over randomised** amounts × tenders × accounts (TEST-R3, `AGENTS.md:204`); `eventRetryDelaySeconds` (`packages/event-core/src/index.ts:804`) exponent/cap/base by importing the shipped function; `stableBucket` from `packages/shared-types/src/index.ts`, not a local copy | 3 tautologies to delete/rewrite (A.2.2); no property-based money test |
| **L2** | **Postgres integration with FULL migration replay** | Apply **every** file in `database/supabase/migrations/` in numeric order (000 then 073→197, 126 files) against an ephemeral container; fail on any error; then run **all** behavioural suites against **that** schema instead of hand-built fixtures. This is the single highest-value change in the programme: it closes A.2.3 *and* the fixture-drift problem *and* unblocks L3/L6/L7 | **Unimplemented.** TEST-R10's replay clause (`AGENTS.md:214`) has no implementation; `foundation-ephemeral-postgres.mjs:55-73` applies zero migrations |
| **L3** | **RPC behavioural coverage on the deployed bodies** | Load migrations **165, 168, 170** and exercise `create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `record_order_payment_failure_with_ledger`, `post_settlement_ledger_transaction` (current 165 body, with source-ownership resolution and tenant-GUC mismatch check) | None loaded (§A.2.3) |
| **L4** | **Contract** | Gateway route ⇄ client typings; domain-event payload schemas by **importing** `packages/event-core`; app-route ⇄ gateway proxy lockstep; `@letbuyy/api-client` surface | Partially real: `tests/contracts/*.test.ts` via `tsx --test` (`ci.yml:169`) imports production modules; the 43 `.mjs` files in `tests/contracts` are source-greps |
| **L5** | **E2E commerce journeys** | Browse → cart → checkout → COD order → merchant sees it; browse → checkout → Razorpay **test-mode** → webhook → order paid → refund → gift-card restore; custom-domain storefront; merchant signup → product → publish. **Every skip converted to a failure under `LETBUYY_E2E_REQUIRE_REAL_STACK=1`** | 9 specs exist; the journey specs skip silently (§A.4.2); no Playwright in `ci.yml` at all |
| **L6** | **Tenant red-team RT-1..RT-9** | Against the **full replayed schema** and the full tenant-table registry (`scripts/governance/tenant-registry-common.mjs`), not 13 hand-built tables: anon probe · forged `site_id` · missing predicate · worker payload forgery · `service_role` abuse · GUC-from-param · unset-GUC ⇒ 0 rows · non-registry table · ownership-column confusion. Positive control first, every case. **Re-point `theme-tenant-isolation.test.mjs` at the CI container** (§A.4.1) | Real but fixture-scoped; theme arm skipped in CI |
| **L7** | **Auth forgery / replay / escalation** | Forge-with-public-key fails · `alg:'none'` rejected · HS256 rejected post-cutover · replayed `jti` rejected by a **durable** cache · `user_metadata.role` escalation blocked · `/api/auth/switch` returns 401 without valid session + membership · **dual-verify drain gate proving zero legacy HS256 verifications before HS256 is dropped** | `identity-issuer-d3.test.ts:93-153` covers forgery/HS256/missing-`jti`; `alg:'none'`, escalation, switch-takeover, and drain gate are absent |
| **L8** | **Money reconciliation + concurrency** | Wire `pnpm money:invariants` (`package.json:128`) — **`--probe` first, to prove the instrument is not broken** — into staging and production deploy lanes with I1–I8 asserted zero-break-or-explained-suspense; fault-injected PA-success + local-fail resolves to suspense and never strands | Harness exists, invoked by nothing (row 10 of §A.5) |
| **L9** | **Checkout / inventory contention** | N-writer sweep on **one** SKU (N = 2, 10, 50, 200, 1000): measured achieved reserves/s, p99 lock wait, connection occupancy, zero oversell at every N. This is the measurement that falsifies `06` Finding W-3 and `07` rank 6 | Only N = 2 exists |
| **L10** | **Cache correctness AND tenant isolation** | Tenant A's cached storefront/catalog entry is **never** served to tenant B under any key collision; publish → invalidate → next read is fresh; invalidation fans out to **every** domain a tenant owns (subdomain + apex + www), which Vercel's documented per-domain revalidation scope makes a real defect (`07` §3.3); stale-while-revalidate actually refreshes | GREP-ONLY (rows 15–16) |
| **L11** | **Queue retry / DLQ / idempotency** | Import the shipped retry policy; drive the real consumer; prove: retry backoff schedule matches `eventRetryDelaySeconds`; exhausted deliveries land in the DLQ/quarantine path (`quarantine_platform_queue_job`) and are **not silently deleted** (Cloudflare deletes retry-exhausted messages permanently without a DLQ — `10_VENDOR_LIMITS_AND_COSTS.md`); at-least-once redelivery produces exactly one effect; out-of-order delivery is tolerated (queues are explicitly unordered) | Retry ABSENT; DLQ GREP-ONLY |
| **L12** | **Theme security / parity / performance** | Keep SEC-1..SEC-10 and make it unconditional (not `turbo --filter` gated); add **render parity**: screenshot/DOM-diff Liquid ≡ React **per section**, gating each section port, as TEST-R6 requires; restore a **baseline-relative** benchmark guard alongside the absolute ceiling | Security real but conditional; **parity gate does not exist**; the benchmark asserts a flat `productionSteady < 200` (`packages/theme-engine/test/liquid-render-benchmark.test.ts:238-241`) against a recorded steady of ~11 ms — **~18× headroom, no baseline reference** since commit `bf599a3e` |
| **L13** | **Backup / restore drill** | Scheduled job that restores the latest `pg_dump` into an ephemeral container and asserts table count, a sample of row counts, extension/role/ownership/sequence survival. **Record the drill date, duration, and the resulting RTO/RPO numbers** — `config/runtime/database-recovery-policy.json` lists those as resume evidence and they exist nowhere | ABSENT (row 17) |
| **L14** | **Deploy / rollback drill** | Deploy a known-bad Worker revision to staging, detect via a real functional probe (not `/v1/health`, §A.4.3), roll back, and assert recovery — with measured detection and recovery times | STRUCTURAL-ONLY (row 18) |
| **L15** | **Load** | §C. Sustained arrival-rate runs per band against isolated staging with synthetic tenants | ABSENT — no load tool in the repository |
| **L16** | **Soak** | ≥ 8 h at Band A steady rate. Targets: `outbox_events` unrelayed depth trend (falsifies `07` Finding C-8), `runtime_telemetry_metrics` + `worker_request_logs` row growth and disk headroom, connection-pool wait-time drift, memory growth in Workers (128 MB hard cap), KV write spend | ABSENT |
| **L17** | **Spike** | 0 → 5,000 concurrent in 30 s. Counts `FUNCTION_THROTTLED` 503s against Vercel's 1,000-concurrent-per-10-s-per-region governor and measures how many requests the CDN absorbs. Falsifies `07` Finding C-9 | ABSENT |
| **L18** | **Stress-to-failure** | Ramp until something breaks; **record which thing breaks first and at what number.** The bottleneck order in `07` §4 is an inference until this runs | ABSENT |
| **L19** | **Provider-failure simulation** | Razorpay 15-min outage then compressed backlog replay (Band F); Supabase read-only mode (disk-full behaviour); KV 429 storm; Turnstile siteverify timeout — note Turnstile is fail-closed **without a timeout**, so a siteverify outage takes signup/login fully down; Upstash unavailable ⇒ KV fallback ⇒ 1-write/s/key ceiling | ABSENT |

**Wiring changes the programme depends on** (config, not new tests):

| Change | Target | Why |
|---|---|---|
| Add Playwright smoke to `ci.yml` and to `deploy-staging.yml` (the **active** lane) | `.github/workflows/` | `ci.yml` has no Playwright step; `deploy-staging.yml`'s only check is a liveness ping against a constant (§A.4.3) |
| Delete or re-trigger `staging-deploy.yml` | `.github/workflows/staging-deploy.yml:3-6` | Its push trigger is retired (`workflow_dispatch` only), so its Playwright step is counted as coverage while being unreachable |
| Run `pnpm turbo test` unfiltered on the protected branches | `ci.yml:126` | `--filter="...[HEAD^1]"` means a package whose tests break can stay broken indefinitely |
| Make `ci-simulation-validator.mjs` parse the workflow graph | `scripts/validators/ci-simulation-validator.mjs:8-100` | It substring-matches YAML text, so a fragment in a job that can never trigger satisfies it |
| Mark `branch-lag-guard-validator` `NOT_APPLICABLE` when enforcement is off | `branch-lag-guard-validator.mjs:110-116` | So the 110 count reflects checks that actually ran |
| Report two coverage numbers everywhere | `AGENTS.md` | ~223 of 582 test files (≈38%) are source-greps that never load the code under test; the headline count implies assurance it does not carry |

---

# C. Load model

## C.0 SAFETY RULE — read before any load activity

> ### Load tests run **only** against an isolated staging environment with synthetic tenants.
>
> **Never** against production. **Never** against an unapproved external endpoint. **Never** against a live payment provider.

| Rule | Concrete form at this repository |
|---|---|
| **Isolated environment** | A staging Supabase project and staging Cloudflare/Vercel environments distinct from production. Verify by connection string and account ID before every run. `production-deploy.yml` targets must be unreachable from the injector's credentials |
| **Synthetic tenants only** | Every seeded `site_id` carries a reserved prefix; every product/order/customer row is prefix-tagged and deleted by a teardown that asserts zero residue (the pattern already used at `tests/security/theme-tenant-isolation.test.mjs:216-224`) |
| **No real money** | Razorpay **test-mode** keys only. Any run that can reach a live key is aborted at setup. COD paths use synthetic remittance fixtures |
| **No real notifications** | Resend and WhatsApp adapters pointed at sandbox/sink endpoints. A load run that emails or messages a real person is a failed run regardless of its numbers |
| **No third-party endpoint** | Do not drive load through any external site or provider dashboard. Provider-failure simulation (L19) uses local fault injection, not real provider abuse |
| **Provider terms** | Confirm the Cloudflare and Vercel acceptable-use position on synthetic load against your own origins **before** the first run. `HUMAN-REQUIRED` |
| **Blast-radius caps** | Hard per-run ceilings (below) enforced in the injector config, not by operator discipline |
| **Auto-abort** | Every run aborts on: error rate > 5% for 60 s · DB CPU > 80% for 120 s · **disk utilisation > 85%** · pool wait time > 500 ms p95 · projected spend > the run's cap |

**The disk cap is not boilerplate.** `07` §2 establishes that every API request writes 1 `runtime_telemetry_metrics` row plus (usually) 1 `worker_request_logs` row, and migration `131_hot_table_partition_shadow_mirror.sql` puts an `AFTER INSERT/UPDATE/DELETE` trigger on both that mirrors into a shadow partitioned table. At Band A (~1,787 origin RPS) that is roughly 1,800–3,600 primary rows/s plus mirror rows — **a 30-minute run writes millions of rows**, and Supabase puts a project into **read-only mode when disk is full**, clearing only below 95%, with disk autoscale limited to 4 modifications per rolling 24 h. **A load test can therefore brick the staging database for a day.** Either disable telemetry inserts for the run (and say so in the result, because you are then not measuring the real write path) or size disk headroom to the run's projected row count in advance. `INFERRED` over `VERIFIED-SOURCE` + primary-source vendor limits.

## C.1 Common model parameters

| Parameter | Value | Source |
|---|---|---|
| Arrival model | **Open** (constant/ramping arrival rate), not closed VU loops | Closed models mask queueing collapse — the failure mode of interest |
| Session duration | 450 s (6 page views at 0.8 actions/min) | `06` §2.2 base case |
| `dynamic_requests_per_action` | 4 | `06` §3.2 — **itself a falsification target** |
| Injector VUs (open model) | `arrival_rate × mean_request_duration`, Little's Law | Not `= modelled concurrency`; see per-band table |
| Tenant distribution | Zipf, α ≈ 1.0, over the synthetic tenant set | Uniform tenant distribution would hide the hot-tenant failure the platform is most likely to meet first (`06` Band E) |
| Catalog sizes | 3 cohorts: 20 SKUs (long tail), 500 SKUs (typical), 20,000 SKUs (whale) | Exercises N+1 and pagination cost per `06` §3.3 |
| Cache state | Every band run **twice**: cold (fresh deploy, purged caches) and warm (≥ 10 min of the same mix) | `07` Finding C-2 predicts the two are indistinguishable today — that prediction is the test |
| Authenticated share | 25% buyer-session-verify traffic (uncacheable by construction) | `06` §4 traffic mix |
| Request mix | `06` §4 matrix, verbatim: 60% static / 20% storefront HTML / 25% catalog / 5% search / 15% session verify / 8% cart read / 4% cart mutate / 1.5% shipping quote / 1.5% checkout step / 1% inventory reserve / 0.8% payment initiate / 0.8% payment verify / 3% order status / 2% merchant dashboard | `06` §4 |

## C.2 Per-band load specification

| | **Band G** (governed envelope) | **Band A** (100k online) | **Band B** (1M online) | **Band E** (hot-SKU skew) | **Band F** (webhook storm) |
|---|---|---|---|---|---|
| **Purpose** | Prove the platform serves the scale it is **already governed for** | Prove ~100× headroom after `07` ranks 1–8 | Find where the connection/CPU wall actually is | Find the **per-SKU** serialisation ceiling | Prove correlated write load does not collapse checkout |
| **Modelled concurrency** | ~1,400 concurrent sessions | 100,000 | 1,000,000 | 50k–500k on **one** tenant | Band A baseline |
| **Arrival rate (actions/s)** | 18.5 peak page views/s | 1,333 | 13,333 | Band A aggregate, 70–95% on one tenant | Band A + backlog |
| **Target dynamic RPS** | 74 | 5,333 | 53,333 | ~5,300 | ~5,300 + webhook burst |
| **Target origin RPS** | 7–20 | 1,787 (720 at 10% uncacheable) | 17,867 (7,200 at 10%) | ~1,800 | ~1,800 |
| **Injector VUs** (open, @200 ms mean) | ~15 | ~1,070 | ~10,700 — **distributed injection required (≥ 8 injectors)** | ~1,100 + 250 for the reserve arm | ~1,100 |
| **Order rate** | 0.046/s (1 per 22 s) | 1.9/s | 19/s | Band A rate, concentrated | 1.9/s |
| **Tenant distribution** | 10,000 synthetic tenants, Zipf | 10,000, Zipf | 10,000, Zipf | **1 tenant at 70–95%** | 10,000, Zipf |
| **Hot-SKU skew** | none | 5% of reserves on top-10 SKUs | same | **10,000+ buyers on ONE SKU; sweep reserve attempts 500 → 5,000/s** | none |
| **Webhook + retry injection** | baseline rate | baseline | baseline | baseline | **15-min provider outage, then the full backlog compressed into ~2 min, *while* checkout peaks** — Band A ⇒ ~1,710 queued webhooks ⇒ ~14/s replay |
| **Ramp** | 0→peak over 5 min | 10 min | 20 min, stepped (25/50/75/100%) | 2 min (flash-sale onset is fast) | Baseline 10 min, then instant backlog release |
| **Duration** | 60 min | 60 min (+ 8 h soak variant) | 30 min | 15 min | 30 min |
| **Safety cap** | 200 RPS hard ceiling | 3,000 origin RPS; abort > 4,000 | 25,000 origin RPS; abort > 30,000; **spend cap declared before the run** | 6,000 reserve/s ceiling | 5,000 webhook/s ceiling |
| **PASS** | Origin p95 < 300 ms · errors < 0.1% · **zero** `RATE_LIMIT_UNAVAILABLE` 503s · outbox unrelayed depth flat · zero oversell · reconciliation I1–I8 zero-break | Origin p95 < 500 ms · errors < 0.5% · pool wait p95 < 50 ms · DB CPU < 70% · outbox depth flat · I1–I8 zero-break | Record the number at which each ceiling binds. **There is no pass mark — this run exists to produce measurements** | **Zero oversell at every N** · reserves/s ceiling recorded · **other tenants' p95 unaffected** (this is the isolation assertion, and the one most likely to fail) | Checkout p95 degradation < 2× baseline · zero duplicate payment effects · zero lost webhooks · queue drains within 5 min of backlog release |
| **FAIL** | Any 503 from the rate limiter; any oversell; any ledger break; outbox depth trending up | Any ledger break; pool exhaustion; > 1% 5xx | n/a (measurement run) | Any oversell; any cross-tenant p95 degradation > 2× | Any duplicate capture; any silently-dropped message |

**Band G is the run that matters first.** `07` §5 states the system **as currently configured does not serve Band G** — four ceilings bind at or below it. Band G is therefore not a formality; it is the falsification test for the packet's most important claim, and it is cheap (≈15 injector VUs).

**Bands C and D are deliberately excluded.** `07` §5 concludes both require read replicas and/or partitioning, which the Constitution forbids (§6 Never-Build items 3 and 4). Load-testing an architecture that is constitutionally unavailable produces no actionable number. Run them only if and when an amendment ratifies the topology.

---

# D. Proposed SLOs

**Status: `PROPOSED — NOT RATIFIED`.** Per §A.4.4, the repository contains exactly **one** SLO — `infrastructure/monitoring/slo-catalog.yaml:1-9`, `deployment-gate-success`, whose SLI derives from a health endpoint returning a hardcoded literal (`services/api-gateway/src/index.ts:311-318`). **No latency, availability, error-rate, or correctness SLO exists for any user-facing surface.** Every row below is a proposal requiring founder/ARB ratification and, critically, **a telemetry pipeline that does not yet exist** — `10_VENDOR_LIMITS_AND_COSTS.md` and the observability dimension establish that Analytics Engine data points are currently write-only and nothing queries them.

| Surface | p50 | p95 | p99 | Error rate | Availability | Correctness invariant | Freshness |
|---|---|---|---|---|---|---|---|
| **Cached storefront HTML** | 50 ms | 150 ms | 400 ms | < 0.05% 5xx | 99.95% | Correct tenant, always — a cross-tenant serve is a **P0 regardless of rate** | ≤ 300 s stale |
| **Uncached storefront HTML** | 250 ms | 800 ms | 1,500 ms | < 0.2% 5xx | 99.9% | Same | immediate |
| **Catalog API** (list/detail) | 40 ms | 150 ms | 400 ms | < 0.1% | 99.95% | Price and availability match the DB at read time | ≤ 60 s |
| **Merchant mutation** (product/collection/theme save) | 150 ms | 600 ms | 1,200 ms | < 0.5% | 99.5% | Write is durable before 2xx; exactly one outbox event emitted **in the same transaction** | immediate |
| **Cart** (read + mutate) | 60 ms / 120 ms | 200 ms / 400 ms | 500 ms / 900 ms | < 0.2% | 99.9% | Cart totals recomputed server-side; never client-supplied | immediate |
| **Checkout step** | 120 ms | 400 ms | 900 ms | **< 0.1%** | **99.95%** | Server-authoritative totals/tax/shipping computed in the RPC from DB | immediate |
| **Payment verify** (signature + confirm) | 150 ms | 500 ms | 1,000 ms | **< 0.05%** | **99.99%** | HMAC-SHA256 verified server-side with constant-time compare; **exactly one** ledger effect per `idempotency_key`; Σdebit = Σcredit | immediate |
| **Order create** | 200 ms | 700 ms | 1,500 ms | **< 0.05%** | **99.95%** | Inventory reserved or order rejected — **never oversold**; order + ledger + outbox in one transaction | immediate |
| **Webhook processing** (ingest → effect) | 200 ms ack | 500 ms ack | 1,000 ms ack | < 0.1% non-2xx ack | 99.99% ack | Ack fast, process async; duplicate delivery ⇒ exactly one effect; **zero permanently-dropped messages** (Cloudflare deletes retry-exhausted messages without a DLQ) | effect ≤ 60 s p95 |
| **Dashboard / BFF** | 300 ms | 1,000 ms | 2,500 ms | < 1% | 99.5% | Tenant-scoped rows only | ≤ 60 s |
| **Queue time-to-drain** | — | **≤ 5 min** from enqueue to effect at Band A | ≤ 15 min | < 0.1% to DLQ | 99.9% | At-least-once with idempotent handlers; **no tenant starved** — max per-tenant wait ≤ 3× median (no claim function currently has a `site_id` term, so this SLO is presently unmeetable by construction) | — |
| **Identity** (login, session verify, JWKS) | 80 ms | 250 ms | 600 ms | < 0.1% | **99.99%** | Correct issuer per audience, never crossed; replayed `jti` rejected; **fails closed** | JWKS ≤ 300 s |
| **Media** (upload, R2 read) | 200 ms / 40 ms | 1,500 ms / 150 ms | 4,000 ms / 400 ms | < 0.5% | 99.9% | Tenant-scoped object keys; no cross-tenant read | immutable (hashed) |

**Three notes on adopting these.**
1. Availability figures assume a **functional** probe. The current `/v1/health` cannot express any of them (§A.4.3).
2. Error-rate and latency SLOs require per-route percentile telemetry that is queried, not merely written.
3. The correctness invariants are the load-bearing column. A latency SLO that is met while the ledger breaks is a worse outcome than the reverse.

---

# E. Falsification table

Every capacity and coverage claim in this packet, with the exact measurement that would refute it. **Nothing in this table has been run.**

## E.1 Workload-model claims (reproduced and extended from `06` §8)

| Claim | Source | Falsified by |
|---|---|---|
| `dynamic_requests_per_action ≈ 4` | `06` §3.2 | Real browser trace of a storefront session; count non-static requests. Any value outside 3–5 |
| `db_queries_per_route` values | `06` §3.3 | Query-count instrumentation per route under a synthetic session |
| `mean_txn_duration ≈ 2 ms` | `06` §3.3 | `pg_stat_statements.mean_exec_time` on the checkout/reserve statements |
| Hot-SKU serialisation ceiling ≈ 1/lock-hold-time | `06` W-3, `07` rank 6 | **L9**: N concurrent reserves on one SKU, N ∈ {2,10,50,200,1000}; measure achieved reserves/s and p99 lock wait |
| Uncacheable share (base case 30%) | `06` §4 | Cache-hit telemetry by route class — **not currently emitted** (`04`); or the direct probe in E.2 |
| Connection requirement (~13 at Band A, ~129 at Band B) | `06` §5 | Load test at fixed RPS; observe `pg_stat_activity` backends and pool wait time |
| Session duration 450 s / 6 page views | `06` §2.2 | Analytics on real sessions once telemetry is queryable |
| Band G peak ≈ 18.5 page views/s, 1 order / 22 s | `06` Band G | Any real traffic sample at 10k merchants |

## E.2 Capacity-model claims (reproduced and extended from `07` §6)

| Claim | Source | Falsified by |
|---|---|---|
| KV limiter binds at ~2 concurrent requests sharing a key | `07` C-1 | Fire 10 concurrent requests sharing one rate-limit key against staging; observe HTTP 429 from KV and the subsequent isolate-wide `503 RATE_LIMIT_UNAVAILABLE` window (`rateLimit.ts:1078-1088`). **No 429 ⇒ the finding is refuted** |
| Storefront cache hit ratio ≈ 0 | `07` C-2 | Request the same product page twice; inspect `x-vercel-cache` and Worker cache headers; count gateway invocations. **A `HIT` on the second request refutes it** |
| Telemetry ≈ 1–2 DB writes per request | `07` C-7 | `pg_stat_statements` insert counts for `runtime_telemetry_metrics` / `worker_request_logs` vs total request count over the same window |
| Outbox relay deficit at Band G (4,800/day vs 6,000–8,000 needed) | `07` C-8 | Synthesise 1,000 orders/day; measure `outbox_events` unrelayed depth over 72 h. **Flat depth refutes it** |
| Connection plateau / Little's Law failure mode | `07` C-4 | Load test at fixed RPS while stepping mean transaction duration 20 ms → 400 ms; observe pool wait time and slot occupancy |
| Vercel burst governor rejects above 1,000 concurrent/10 s/region | `07` C-9 | **L17**: ramp 0 → 5,000 concurrent in 30 s against staging; count `FUNCTION_THROTTLED` 503s |
| Hyperdrive query cache does not invalidate on write | `07` C-6 | Write through the gateway, immediately read the same row through a cached binding; a fresh value refutes it |
| Workers are not a bottleneck at any modelled band | `07` §3.1 | **L18** stress-to-failure: if Error 1102 (CPU exhaustion) appears before any DB/KV/Vercel ceiling, the bottleneck order is wrong |
| Queue claim functions starve tenants (no `site_id` term) | `07` §3.6 | **Band E** run: measure max per-tenant queue wait while one tenant floods. Bounded per-tenant wait refutes it |
| Vercel domain provisioning 100 additions/hr | `07` C-10 | Time a batch of synthetic domain additions against a staging team. `HUMAN-REQUIRED` — provider-side |
| `SET LOCAL` is safe under Supavisor transaction mode | `07` §3.4(1) | Two sequential transactions on the same pooled backend; assert tenant GUC does not leak from the first into the second |
| Bottleneck **order** (ranks 1–11) | `07` §4 | **L18**: record which ceiling binds first at each band. **Any reordering falsifies the ranking** |
| "Ranks 1–8 plausibly carry the platform to Band A" | `07` C-11 | Fix ranks 1–8 on staging, then run Band A. Failure to meet the Band A PASS row in §C.2 refutes it |

## E.3 Coverage and gate claims made in **this** document

| Claim | Falsified by |
|---|---|
| 0 of 110 gate validators make an HTTP request, connect to Postgres, or boot a runtime | Re-run the classification over `scripts/validate-governance.mjs:70-181`; any hit for `fetch`/`undici`/a Postgres client/an app import refutes it |
| Exactly 2 gate validators spawn a subprocess | Same scan for `spawnSync`/`execSync`/`spawn(`. (Note the trap: `migration-safety-validator.mjs:123` contains the literal `spawnSync(` only as a **forbidden token being searched for**) |
| The two dead scan loops inspect zero repository files | Instrument `rls-force-coverage-validator.mjs:36` / `one-system-per-domain-validator.mjs:28` with a counter and run `pnpm run validate:governance`. Any non-zero count refutes it |
| All 21 mandated test-proof files import zero production modules | Parse the import lines of all 21; any non-`node:` import refutes it |
| No executable test loads migration 165, 168, or 170 | `rg -on "migrations/[0-9]+" tests/executable/*.mjs \| sort -u` — any hit ≥ 165 refutes it |
| `theme-tenant-isolation.test.mjs` skips in CI | Run `pnpm run test:behavioral` and read the reporter output for that describe block. Execution refutes it |
| `customer-journey.spec.ts` skips rather than fails when staging is unreachable | Run `production-deploy.yml`'s E2E step against a deliberately-down staging URL; a **failed** job refutes it |
| `post_ledger_transaction` is the transitive kernel of every production money write | Find a production money write that bypasses `post_settlement_ledger_transaction`; any such path refutes the refutation and reinstates the original S1 finding |
| 110 gate entries, 110 unique, 108 distinct checks | Re-parse the array; a different count refutes it |
| Exactly one SLO exists in the repository | Any second SLO definition outside `infrastructure/monitoring/slo-catalog.yaml` refutes it |
| No load-testing tool exists in the repository | Any `k6`/`artillery`/`autocannon`/`locust`/`gatling` dependency or workflow step refutes it |

---

## Cross-references

- `01_EVIDENCE_METHOD_AND_INDEX.md` — evidence states; the verification ladder this document sits on (step 9 at best)
- `02_GOVERNED_ARCHITECTURE.md` — TEST-R3/R4/R5/R6/R10 as law; ART-02 / R-18 on what a green gate must mean
- `04_LIVE_DEPLOYMENT_TRUTH.md` — why no measurement in this document can be `VERIFIED-LIVE`
- `06_10M_WORKLOAD_DEFINITION.md` — bands G/A/B/C/D/E/F, the traffic-mix matrix, §8 falsification criteria reproduced in §E.1
- `07_CAPACITY_MODEL.md` — component budgets and bottleneck order; §6 falsification reproduced and extended in §E.2
- `14_FOUNDATION_ACTION_REGISTER.md` — where the §B wiring changes belong as actions
- `17_OPEN_QUESTIONS_AND_HUMAN_ACTIONS.md` — the `HUMAN-REQUIRED` items in §C.0 (provider load-testing terms) and §D (SLO ratification)
