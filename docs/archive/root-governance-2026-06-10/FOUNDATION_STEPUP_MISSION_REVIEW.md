# FOUNDATION_STEPUP_MISSION_REVIEW (red-team)

> Adversarial review of `CODEX_FOUNDATION_STEPUP_MISSION.md` as a production-critical mission executed **autonomously** by Codex across the whole monorepo. Architecture is frozen; this review adds only safety/clarity/guardrails. Severity: **S0** catastrophic (data/money loss, security, prod outage) · **S1** mission/build/CI failure · **S2** rollback/checkpoint/ordering gap · **S3** ambiguity.

## Verdict
The mission is strategically correct but **operationally unsafe for autonomous execution**. It assumes a static repo (stale `file:line` addresses), a clean cutover (no data backfill), a single-shot run (no resumability), and a do-everything scope that **implicitly includes deploying money changes to production**. Five S0s must be closed before Codex is allowed to run it.

---

## S0 — Catastrophic (must fix)

### R-1 · Ledger-balance backfill is missing → every merchant balance zeroes on cutover
- **Category:** 10 (money), 5 (migration). **Why dangerous:** Wave 1.1 switches spendable balance to read from `ledger_entries`, but the ledger was never populated for historical captures/settlements (capture→ledger never ran before). **Failure scenario:** the moment the read flips, every existing merchant’s available balance collapses toward ₹0; payouts compute against wrong balances; support storm; real financial harm.
- **Exact fix:** require a **one-time, verified ledger backfill** of all historical money events **before** the balance-source flip, behind a reconciliation assertion (sum of backfilled ledger ≡ prior wallet balances per site, within tolerance 0).
- **Text to add (Wave 1, new task 1a, before 1.1):** *“1a. LEDGER BACKFILL (blocking): write a one-time, idempotent, resumable backfill that posts historical capture/settlement/payout/refund events into `ledger_entries` for every site. Before flipping the balance source (1.1), assert per-site `SUM(ledger) ≡ prior wallet_ledger balance` (tolerance 0); on any mismatch, STOP (do not SKIP). The flip in 1.1 is gated behind backfill-verified.”*

### R-2 · `integer→bigint` as a direct `ALTER TYPE` on live money tables → lock + rewrite + risk
- **Category:** 5, 8, 10. **Why dangerous:** `ALTER COLUMN … TYPE bigint` rewrites the whole table under an `ACCESS EXCLUSIVE` lock; on a hot money table this is an outage and is hard to roll back mid-flight.
- **Exact fix:** mandate the **expand–contract** pattern, never a direct type change.
- **Text to add (Wave 1.8, replace):** *“1.8 Money-width via EXPAND–CONTRACT only: (i) add `*_minor_v2 bigint` nullable; (ii) backfill in batches; (iii) dual-write both columns; (iv) verify `v2 ≡ old` for 100% rows; (v) switch reads to `v2`; (vi) drop the old column in a later migration after a soak. No `ALTER TYPE` on a populated money column. Each step is its own forward-only migration with a tested `down`.”*

### R-3 · Mission may auto-deploy money/tenancy changes to production
- **Category:** 15 (deployment), 1 (directives). **Why dangerous:** “do everything in one go” + a `production-deploy.yml` edit implies an autonomous agent could ship and run money migrations against prod with no human in the loop.
- **Exact fix:** the mission is **build-and-prove only**; production deploy + prod migrations are an explicit **human-gated step**, never executed by Codex.
- **Text to add (Prime Directive 7):** *“7. NO PRODUCTION ACTIONS. Codex never deploys to production, never runs a migration against a shared/staging/prod database, and never rotates a live secret. It produces code + migrations + green tests in a branch; applying them to any shared environment is a human-gated step recorded as SKIP-DEPLOY.”*

### R-4 · Tenant-table registry is unbounded (“…then the rest”) → silent cross-tenant IDOR
- **Category:** 4, 9. **Why dangerous:** Wave 2 names a few hot routes “first” then “the rest”; one tenant table omitted from the scoped layer = a permanent silent IDOR that no test will catch unless the registry is exhaustive.
- **Exact fix:** derive the **complete** tenant-table set from the schema and assert exhaustiveness.
- **Text to add (Wave 2, task 0):** *“2.0 Build `tenant-tables.registry.ts` by enumerating every table with a `store_id`/`site_id`/owner column from the live schema; add a `gate` validator that FAILS if any such table is absent from the registry or is reachable via `getSupabaseAdmin().from()` outside `tenantScoped`. The IDOR test suite iterates the registry — ‘every resource’ = every registry entry.”*

### R-5 · No fresh repository audit → Codex edits stale `file:line` addresses
- **Category:** 6 (repo discovery), 19. **Why dangerous:** the mission’s line numbers are days old and shift as Codex edits; acting on them blindly edits the wrong code; quarantine “0 importers” may be false now.
- **Exact fix:** a mandatory **PHASE A — Repository Truth Audit** before Wave 0; all `file:line` are *hints*, located by symbol at execution time.
- **Text to add:** see Focus Area A below + Prime Directive: *“All `file:line` references are HINTS. Locate every edit target by symbol/string search at execution time and re-verify before editing. Never edit by line number alone.”*

---

## S1 — Mission / build / CI failure

### R-6 · Turning ratchet + lint into blocking gates bricks CI on Day 1
- **Category:** 13, 16. **Why dangerous:** the repo already has 574 inline styles + 152 arbitrary radii; flipping the gate to blocking fails every PR — including the foundation work itself — instantly.
- **Fix/Text (Wave 5):** *“Gates ratchet on NEW violations only: snapshot current counts as the baseline; the gate fails only on increases. Existing debt burns down on a non-blocking track. Never enable a gate that fails on the pre-existing baseline.”*

### R-7 · Renderer↔registry enforcement can blank live storefronts
- **Category:** 12 (theme). **Why dangerous:** sections that rendered via lenient `rendererKey` dispatch may fail strict validation → live stores render nothing.
- **Fix/Text (Wave 6):** *“Ship render-validation in WARN mode first; audit existing stores’ section types against the registry; only switch to ENFORCE after 0 unresolved mismatches. Provide a fallback placeholder for unknown sections, never a blank page.”*

### R-8 · Quarantine can break the build / deploy filters
- **Category:** 7, 17. **Why dangerous:** removing `distributed-runtime` etc. from `tsconfig.workspace.json` may break a transitive reference (e.g., `runtime-composition` storefront edge use), failing the build; deploy filters may still target them.
- **Fix:** the DELETE→QUARANTINE→VERIFY→DELETE protocol (Focus C) with a build-green gate after each quarantine.

### R-9 · CI gate reclassification may silently drop a real gate
- **Category:** 16. **Fix/Text (Wave 0):** *“The `gate`/`report` split must preserve every validator that has ever failed on a real defect; reclassification requires a one-line justification per demoted validator in `validators.manifest.json`; never demote `circular-import`, `dependency-graph`, `undeclared-import`, `package-export`.”*

### R-10 · “One mission, one go” vs “one wave per branch” integration is undefined
- **Category:** 1, 19. **Why dangerous:** later waves depend on earlier waves’ code; isolated branches that never integrate break dependencies; an interrupted run can’t resume.
- **Fix/Text:** *“Define an integration branch `stepup/main`. Each wave branches from `stepup/main`, lands green, and merges back before the next wave starts. A wave is the unit of checkpoint + resumability.”*

### R-11 · Test environment is assumed, not provisioned
- **Category:** 16, 10. **Why dangerous:** money/tenancy behavioral tests need a Postgres with the schema applied; if absent, ‘prove it’ is impossible and Codex may SKIP the proof.
- **Fix/Text (Wave 0):** *“Provision an ephemeral Postgres test fixture with all migrations applied + seed; all acceptance tests run against it. If the fixture cannot start, STOP (do not SKIP) — a wave cannot complete without its proof.”*

---

## S2 — Rollback / checkpoint / ordering

### R-12 · Rollbacks are one-liners, not runbooks → **Focus D** per-wave checkpoint + rollback report required.
### R-13 · No “build + dependency-graph green after every wave” gate → add to the wave checkpoint.
### R-14 · Observability ordered after money (Wave 3 > Wave 1) → for any shared-env rollout, the reconciliation-break alert must be live before a money cutover. **Text:** *“In any environment beyond local, Wave 3.observability + reconciliation alert must be active before Wave 1 cutovers run there.”*
### R-15 · Reconciliation un-plug (Wave 1.7) may surface pre-existing hidden breaks and hard-fail. **Text:** *“Before removing the auto-plug, snapshot current breaks; expect them; route to alerts, not hard failures, for a soak window; never let un-plugging block the build.”*
### R-16 · Intra-wave ordering unspecified (e.g., backfill → bigint → balance-flip). **Text:** add an explicit task order per wave with hard predecessors.
### R-17 · Money-write freeze window during balance-source cutover unaddressed (inconsistency window). **Text:** *“Perform the balance-source flip behind a per-site short maintenance flag or a transaction that snapshots+verifies; never flip while writes are in flight without a consistency proof.”*

## S3 — Ambiguity (clarity)

### R-18 · Which PA? (RazorpayX vs Cashfree) → **Text:** *“Implement a `PayoutProvider` interface; default adapter = RazorpayX Route; both credentials are SKIP. No fabricated fallback — the adapter throws `PayoutProviderUnavailable` when creds absent.”*
### R-19 · Which perimeter mechanism? → **Text:** *“Default = IP-allowlist + signed-internal-token; mTLS/CF-Access is a SKIP infra decision.”*
### R-20 · “themable surfaces” undefined → **Text:** enumerate (all `apps/*/src/**/*.tsx` except `marketing-site` if exiled; storefront under burn-down cap).
### R-21 · Inline-style cap value/schedule undefined → **Text:** *“Cap = current count; ratchet down 10%/wave; gate fails on any increase.”*
### R-22 · Marketing-site “migrate or exile” is a product/branding decision → **Text:** *“Default = exile as a non-product island (lint-exempt + excluded from the design score); migration onto tokens is a SKIP product call.”*
### R-23 · “DELETE the fabricated-UTR path” vs “no creds ⇒ OFF” → clarified in R-18 (replace with throwing adapter; no fake fallback).
### R-24 · No canonical `isProductionRuntime` → **Text:** *“Use one shared `isProductionRuntime(env)` helper everywhere mode/secret/gating is decided.”*

---

## SKIP-protocol hardening (Category 18)
### R-25 · SKIP has no blocking-vs-nonblocking taxonomy. **Why dangerous:** you can SKIP WhatsApp, but you must NOT “SKIP” tenant isolation or ship a half-built callable money path.
- **Text to add:** *“SKIP taxonomy — **CLASS-A (non-blocking):** external integrations (PA, WhatsApp, KYC, tax, Turnstile, Sentry, KMS, DNS) — gate OFF, log, continue. **CLASS-B (blocking):** correctness/safety on a P0 path (tenant isolation, ledger backfill, money lock/balance-check, mock-in-prod). CLASS-B may NEVER be SKIP’d — if blocked, STOP and report. A SKIP’d feature must default OFF with a startup assertion that it stays OFF while its secret is a sentinel, and must leave no callable half-built money path.”*

## Context preservation (Category 19) → **Focus E** below (status + ledger + resumability).
## Reporting (Category 20) → **Focus F**/checkpoint report schema below.

---

## Special focus areas (explicit answers)

**A. Repository Truth Audit — YES, mandatory before Wave 0.**
Add **PHASE A**: Codex audits current state and emits, with **no code changes**: `FOUNDATION_REPO_STATE.md` (current dispositions vs the authority table, drift flagged), `ACTIVE_DEPLOYMENT_TOPOLOGY.md` (what actually deploys, from CI/wrangler/vercel), `BUILD_GRAPH.md` (`tsconfig.workspace.json` project refs + turbo), `IMPORT_GRAPH.md` (per-package importer counts — the live 0-importer proof for every QUARANTINE target). Every later wave re-verifies its targets against PHASE A outputs; quarantine requires a 0-importer proof at current HEAD.

**B. Safe DB migrations — YES, expand–contract for all type/format changes** (R-2). Plus: forward-only, never edit a shipped migration; each migration has a tested `down`; `lock_timeout` + `statement_timeout` set; indexes `CONCURRENTLY`; run on a staging clone with row-count + checksum verification before it’s considered done; money migrations additionally require the reconciliation assertion (R-1).

**C. Quarantine safety — YES, DELETE→QUARANTINE→VERIFY→DELETE is mandatory.**
No path is hard-deleted in one step. Protocol: (1) prove 0 importers at HEAD (PHASE A); (2) `git mv` to `quarantine/` + remove from build/deploy filters; (3) verify build + `validate:dependencies` + deploy-filter green; (4) soak one full wave; (5) only then may a *separate, human-approved* change delete. Build artifacts (`artifacts/`,`build/`,`test-results/`) are git-ignored, not deleted from history.

**D. Wave checkpoints — YES, every wave is gated.** Before a wave starts: branch checkpoint from `stepup/main` + read STATUS + re-anchor on the SSOT. Before a wave is “done”: build + dependency-graph green; the wave’s behavioral acceptance tests green; **implementation report** + **rollback report** + **governance report** written; STATUS flipped to `wave-N: complete`; merge to `stepup/main`. No wave proceeds until the prior wave’s checkpoint is green.

**E. Codex context preservation — YES, required.** `FOUNDATION_STEPUP_STATUS.md` (a wave state machine: pending/in-progress/blocked/complete + the in-progress task id = the resumability marker); `FOUNDATION_STEPUP_LEDGER.md` (append-only per-wave change log); `FOUNDATION_STEPUP_SKIPPED.md` (the SKIP log). Rule: at the start of every wave Codex re-reads STATUS + SSOT + PHASE A outputs and works strictly wave-by-wave (never holds the whole repo in context). A resumed run continues from the in-progress marker; completed waves are never re-run (migrations guarded by existence checks).

**F. Deployment safety — YES.** Codex performs no production action (R-3). For shared environments: dry-run every migration on a staging clone; run the staging E2E gate; production application of code + migrations is a human step recorded as `SKIP-DEPLOY` with the exact apply + verify + rollback runbook. Money cutovers in any shared env require observability + reconciliation alert live first (R-14).

---

## Scorecard
| Dimension | Before | After V2 (target) | What closes the gap |
|---|--:|--:|---|
| Foundation Strategy | 10/10 | **10/10** | unchanged (architecture frozen) |
| Architecture Alignment | 10/10 | **10/10** | unchanged |
| Execution Safety | 8/10 | **10/10** | R-1/R-2 migration safety, R-3 no-prod, R-4 registry, expand–contract, quarantine protocol, rollback runbooks, money-freeze window |
| Codex Readiness | 8.5/10 | **10/10** | PHASE A audit, symbol-not-line addressing, STATUS/LEDGER resumability, wave checkpoints + report schema, test fixture, SKIP taxonomy, integration-branch model |

**The 25 fixes above are folded into `FOUNDATION_STEPUP_MISSION_V2.md`. None change the architecture, waves, priorities, scope, frozen decisions, KEEP/REWRITE/QUARANTINE table, or acceptance criteria — they add safety, clarity, and resumability only.**
