# CODEX — FOUNDATION STEP-UP MISSION V2 (hardened execution bible)

**Supersedes** `CODEX_FOUNDATION_STEPUP_MISSION.md`. **Nothing about the architecture, the 8 waves, their order, priorities, scope boundaries, FROZEN decisions, the KEEP/FREEZE/REWRITE/QUARANTINE table, or the acceptance criteria has changed.** V2 adds only: a repository truth audit, migration safety, quarantine safety, wave checkpoints, rollback runbooks, context/resumability, deployment safety, and reporting. Single authority: `LETBUYY_FOUNDATION_AUTHORITY/LETBUYY_SINGLE_SOURCE_OF_TRUTH.md`. Review basis: `FOUNDATION_STEPUP_MISSION_REVIEW.md` (R-1…R-25 folded in).

## HOW TO RUN
One continuous mission, but **wave-by-wave with checkpoints**. Integration branch = `stepup/main` (cut from the current default). Each wave branches from `stepup/main`, lands green through its checkpoint, merges back, then the next wave begins. **Resumable:** on (re)start, read `FOUNDATION_STEPUP_STATUS.md` and continue from the in-progress marker; never re-run a completed wave. **Build-and-prove only — Codex performs no production action.** Codex **updates `FOUNDATION_EXECUTION_DASHBOARD.md` after every wave** (the control tower) and obeys **`FOUNDATION_REPO_LOCKS.md`** — never edit a locked path without a `FROZEN-OVERRIDE: <human>` trailer.

---

## 1. PRIME DIRECTIVES (violations fail the mission)
1. **NEVER fabricate** money, identity, or success. Gate-and-SKIP instead (§2).
2. **MONEY POSTS TO THE LEDGER, ALWAYS**, atomically + idempotently; spendable balance is **read from the ledger** (after backfill — Wave 1.1a).
3. **TENANCY IS FAIL-CLOSED**; no tenant-table access without a scoping predicate.
4. **DON’T TOUCH THE FROZEN CORE (§7).**
5. **PROVE IT** — a wave is done only when its behavioral tests pass against the real test fixture (§4.7). Name-grep validators ≠ proof.
6. **SMALL, REVERSIBLE, LOGGED** — one wave per branch; conventional commits; per-wave reports (§4.2).
7. **NO PRODUCTION ACTIONS (new).** Codex never deploys to production, never runs a migration against a shared/staging/prod DB, never rotates a live secret. It produces code + migrations + green tests in a branch; applying to any shared env is a human step logged as `SKIP-DEPLOY` with an apply/verify/rollback runbook.
8. **ADDRESS BY SYMBOL, NOT LINE (new).** Every `file:line` in this mission is a HINT; locate each target by symbol/string search at execution time and re-verify before editing. Never edit by line number alone (lines drift as you work).
9. **STOP vs SKIP (new).** SKIP only CLASS-A items (§2). For CLASS-B (correctness/safety on a P0 path) or any ambiguity that risks data/money/tenancy, **STOP and write a `BLOCKED` report** — never guess, never fake, never SKIP.

## 2. SKIP TAXONOMY (Category 18 / R-25)
- **CLASS-A — non-blocking** (external inputs): PA creds, WhatsApp/Twilio, KYC vendor, tax IRP, Turnstile key, Sentry DSN, KMS, DNS cutover, the Liquid product decision. → implement around it, gate the feature **OFF** (flag defaults disabled/sandbox + a startup assertion it stays OFF while its secret is a sentinel), append `FOUNDATION_STEPUP_SKIPPED.md`, continue. Leave **no callable half-built money path**.
- **CLASS-B — blocking** (must never be SKIP’d): tenant isolation, ledger backfill, payout lock/balance-check, mock-in-prod removal, frozen-file protection. If blocked → **STOP + report**, do not proceed past that wave.

SKIP entry format:
```
## SKIP-<id> · <wave> · <feature> · CLASS-A
BLOCKED BY: <exact human input>
GATED AT: <file:flag holding it OFF>
TO RESUME: <what the human supplies + the acceptance test to run>
```

---

## 3. PHASE A — REPOSITORY TRUTH AUDIT (mandatory, BEFORE Wave 0, NO code changes) (Focus A / R-5)
Codex audits the current repo and emits four artifacts; every later wave re-verifies its targets against them.
- `FOUNDATION_REPO_STATE.md` — current disposition of every folder vs the PART A authority table (§5); **flag any drift** (new folders, moved files, changed line numbers).
- `ACTIVE_DEPLOYMENT_TOPOLOGY.md` — what actually deploys, derived from `.github/workflows/*`, `wrangler.toml`, `vercel.json` (not from docs).
- `BUILD_GRAPH.md` — `tsconfig.workspace.json` project references + `turbo.json` pipeline.
- `IMPORT_GRAPH.md` — per-package importer counts; the **live 0-importer proof at current HEAD** for every QUARANTINE target.
**Gate:** PHASE A complete + committed before Wave 0. Any QUARANTINE/DELETE later requires its 0-importer proof to still hold at that moment.

---

## 3.5 PHASE A.5 — RISK MATRIX (mandatory, AFTER PHASE A, BEFORE Wave 0)
Generate/verify `FOUNDATION_RISK_MATRIX.md` — one register (Risk · Severity · Current State · Mitigation) across money / auth-identity / tenancy / theme-design-mobile / build-migration / execution-deployment, derived from `FOUNDATION_STEPUP_MISSION_REVIEW.md` + the PHASE A audit + the SSOT, and **verified against the current code**. **Gate:** every S0 has a named mitigation owned by a wave or control; committed before Wave 0. (A seeded version exists; PHASE A.5 reconciles it against the live audit and updates any drift.)

---

## 4. GLOBAL EXECUTION PROTOCOLS

### 4.1 Wave checkpoint (Focus D / R-12,R-13) — every wave passes ALL before merging to `stepup/main`
1. Branch `stepup/wave-<n>-<slug>` from `stepup/main`; set STATUS `wave-n: in-progress`.
2. Re-anchor: re-read SSOT + STATUS + PHASE A outputs; re-locate targets by symbol.
3. Do the wave tasks in their stated order (hard predecessors honored).
4. **Green gates:** `pnpm run build` green · `pnpm run validate:dependencies` green (acyclic preserved) · the wave’s behavioral acceptance tests green against the §4.7 fixture.
5. **Reports written** (§4.2): implementation + rollback + governance.
6. STATUS `wave-n: complete`; merge to `stepup/main`. No next wave until this is green.

### 4.2 Reporting schema (Category 20 / Focus F) — per wave, appended to `FOUNDATION_STEPUP_LEDGER.md`
```
# WAVE <n> — <name> — <date>
CHANGES: <bullet list: file → what changed (by symbol)>
TESTS: <test name → pass + what it proves>
MIGRATIONS: <id → expand/contract step + verification result>
ROLLBACK: <exact git + migration-down steps to revert THIS wave>
GOVERNANCE: <frozen-file check result; dependency-graph result; gate changes + justification>
SKIPS: <SKIP-ids spun off>
```

### 4.3 Migration safety (Focus B / R-2,R-15,R-16) — for EVERY schema change
Forward-only (never edit a shipped migration); each migration is idempotent (guarded by existence checks so a resumed run won’t double-apply) and ships a tested `down`. Set `lock_timeout` + `statement_timeout`; create indexes `CONCURRENTLY`. **Type/format changes use EXPAND→CONTRACT only** (add new col → batch backfill → dual-write → verify 100% equality → switch reads → drop old later). **Money migrations** additionally require the reconciliation assertion (Wave 1.1a). Run on a staging clone with row-count + checksum verification before “done.”

### 4.4 Quarantine safety (Focus C / R-8) — DELETE→QUARANTINE→VERIFY→DELETE
No one-step hard delete. (1) 0-importer proof at HEAD (PHASE A); (2) `git mv` to `quarantine/` + remove from build/deploy filters; (3) verify build + `validate:dependencies` + deploy filters green; (4) soak one wave; (5) hard delete only via a separate human-approved change. Build outputs (`artifacts/`,`build/`,`test-results/`) are git-ignored, not history-deleted. `runtime-composition`: confirm the storefront edge use first — if real, KEEP minimal, do not quarantine.

### 4.5 Context preservation & resumability (Focus E / R-10)
`FOUNDATION_STEPUP_STATUS.md` is a wave state machine (`pending|in-progress|blocked|complete` + the in-progress task id = resume marker). Work strictly wave-by-wave; never hold the whole repo in context. On restart, continue from the marker; completed waves are immutable.

### 4.6 Deployment safety (Focus F / R-3,R-14)
No prod actions by Codex. For shared envs (human-run): dry-run every migration on a staging clone; pass the staging E2E gate; money cutovers require observability + the reconciliation-break alert live **first**. Production apply is a human `SKIP-DEPLOY` with a runbook.

### 4.7 Test fixture (R-11)
Wave 0 provisions an ephemeral Postgres with all migrations + seed applied; all acceptance tests run against it. If it can’t start → **STOP** (a wave cannot complete without its proof).

---

## 5. PART A — REPOSITORY IMPLEMENTATION AUTHORITY (inherited verbatim from v1; condensed)
**KEEP+REWRITE:** `services/api-gateway`, `apps/{merchant-control-plane,storefront-runtime,identity-platform,platform-console,platform-operations-portal,developer-portal,marketing-site}`, `apps/mobile/merchant-app`, `packages/{infrastructure,payments,billing-core,auth-core,theme-engine}`. **KEEP:** `services/{queue-workers,webhook-service,mobile-bff}`, `packages/typescript/*`, `packages/{commerce-core,checkout-core,cms-core,tenant-core,notification-core,search-core,event-core,shared-types,dart,identity-core,session-core,token-core,permission-core,organization-core,audit-core}`, `database/`,`infrastructure/`,`scripts/`,`config/`,`tests/`,`docs/`. **KEEP-DORMANT (no investment):** `apps/{app-marketplace,theme-marketplace}`. **FREEZE:** `migrations/139,141,147`, `packages/typescript/ui/src/tokens.ts`, `packages/theme-engine` section model. **REWRITE (forward-migrate):** `migrations/119`. **QUARANTINE:** `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}`, `apps/mobile/{operator-app,shopper-app}`, `packages/{distributed-runtime,projection-runtime,orchestration,application-services,app-engine,extension-host}` (and `runtime-composition` only if 0 real importers), `legacy/`,`chaos/`,`load/`. **DELETE-from-VCS:** `artifacts/`,`build/`,`test-results/` (gitignore). **REFERENCE:** the audit folders + `LETBUYY_FOUNDATION_AUTHORITY/` (authority). *(Full rationale: v1 PART A — unchanged.)*

---

## 6. PART B — THE 8 WAVES (order preserved; safety folded in)

Backups (Wave 3.1) are **staged in Wave 0** so they exist before Wave 1 migrations.

### WAVE 0 — TRUTH HARNESS (+ test fixture + backup staging)
As v1 (anti-fabrication `gate`; validators `gate`/`report` split — never demote `circular-import`/`dependency-graph`/`undeclared-import`/`package-export`, justify each demotion per R-9; replace `money.test.ts` with real ledger tests; flag-truth doc). **Add:** provision the §4.7 Postgres fixture; stage Wave-3.1 backup/PITR config + restore-drill script (SKIP paid tier). **Acceptance:** planted fake UTR fails CI; money tests execute `post_ledger_transaction`; lanes split; fixture starts; restore-drill script present.

### WAVE 1 — MONEY FIXES (ordered; backfill first)
**1.1a LEDGER BACKFILL (blocking, R-1):** idempotent, resumable backfill of all historical capture/settlement/payout/refund events into `ledger_entries` per site; **assert per-site `SUM(ledger) ≡ prior wallet balance` (tolerance 0)** before any read-flip; mismatch → STOP. **1.1 Balance source → ledger** (`routes/wallet.ts` `summarize`) behind a per-site consistency-verified flip (R-17). **1.2 Capture→ledger** (`buildPaymentCaptureLedgerPosting`, `packages/payments/src/index.ts`). **1.3 Payout safety** (`routes/payouts.ts`): `FOR UPDATE` + balance check + idempotency key + state-guard; maker-checker on the **live `payout_statements`**. **1.4 Real PA adapter** via a `PayoutProvider` interface, default RazorpayX Route, throws `PayoutProviderUnavailable` when creds absent (CLASS-A SKIP, gated OFF, **no fake fallback** — R-18); delete the fabricated-UTR path. **1.5 Refunds→ledger** (`refund_clearing`; partial-refund fix). **1.6 Remove fee/GST double-book.** **1.7 Stop reconciliation auto-plug** (`billing-core`) — snapshot existing breaks, route to alerts not hard-fail during soak (R-15). **1.8 Money width EXPAND→CONTRACT** (R-2). **1.9 Kill `mock` default** via the canonical `isProductionRuntime` helper (R-24). **Acceptance:** as v1 + backfill reconciliation passes + the expand/contract verification is 100% + `ledger_balance_breaks()` empty after lifecycle.

### WAVE 2 — TENANT ISOLATION (registry-exhaustive)
**2.0 (R-4):** generate `tenant-tables.registry.ts` from the live schema (every table with `store_id`/`site_id`/owner); a `gate` validator FAILS if any such table is missing or reachable outside `tenantScoped`. Then as v1: tenant-scoped layer; migrate the registry’s routes (not “the rest” — the registry IS the list); ESLint ban; drop `USING(true)`; remove static `super_admin`; `requireRole` server-side. **Guard:** do not loosen any existing ownership check while migrating. **Acceptance:** IDOR test iterates the registry → 403/404 for every entry; `tenantScoped` throws on unscoped access; god-token dead.

### WAVE 3 — PRODUCTION SAFETY
As v1 (backups+PITR; secret preflight blocks `SKIP_NEEDS_HUMAN`; rate-limit **fail-closed**; deploy observability + PII redaction + reconciliation-break alert; domain unify). **Add (R-14):** in any shared env, observability + reconciliation alert must be live before Wave-1 cutovers run there. CLASS-A SKIPs: PITR tier, Sentry DSN, DNS.

### WAVE 4 — SESSION SECURITY
As v1 (isolate+rotate internal secret ≠ cookie/OAuth/TOTP/money-header; lock gateway perimeter — **default IP-allowlist + signed-internal-token**, mTLS/CF-Access is a CLASS-A SKIP per R-19; nonce/jti replay protection; idle+rotation+reuse-detection+revocation; enforce MFA; per-principal admin TOTP; collapse stores + dual-accept). Secret rotation here is **code + config only**; the live-secret rotation itself is a human `SKIP-DEPLOY`. **Acceptance:** as v1.

### WAVE 5 — DESIGN GOVERNANCE (baseline-ratchet)
**R-6:** snapshot current counts as the baseline; gates fail only on **increases**; existing debt burns down non-blocking. Cap = current inline-style count, ratchet −10%/wave (R-21). `marketing-site` **default = exile** (lint-exempt, excluded from score); token-migration is a CLASS-A SKIP product call (R-22). Then as v1 (generate mobile tokens + delete 5 Dart files; unify shells/headers/sidebars/tables). “Themable surfaces” = all `apps/*/src/**/*.tsx` except exiled `marketing-site` (R-20). **Acceptance:** CI fails on a NEW hex/arbitrary-radius; `generate-mobile-tokens --check` green; no workspace dup.

### WAVE 6 — THEME GOVERNANCE (warn→enforce)
**R-7:** ship renderer↔registry validation in **WARN** mode; audit existing stores’ section types vs registry; switch to ENFORCE only after 0 unresolved mismatches; unknown sections render a **fallback placeholder, never a blank page**. Then as v1 (finish 12/24 schemas; schema-migration runner; app-block real-or-removed; Liquid decision = CLASS-A SKIP, default OFF + honest; collapse dual-draft). **Acceptance:** no saved section silently renders nothing; all 24 built-ins schemaed; a schema change migrates existing stores in a test.

### WAVE 7 — BETA READINESS
As v1 (mobile login — Turnstile key CLASS-A SKIP, app still builds/runs gated; **server-authoritative checkout** confirm creates order + posts capture to ledger; WhatsApp lifecycle+COD — secrets CLASS-A SKIP; quarantine the theater via §4.4 protocol; OIDC honest 501; final gate). **Add:** the mobile Flutter workspace must still build after the operator/shopper-app quarantine + token generation. **Acceptance:** as v1 + Flutter build green.

### WAVE FINAL — FINAL AUDIT (verification, AFTER Wave 7)
**Objective:** catch debt that finished "green." Re-derive the dependency audit, import graph, build graph, tenant audit, ledger audit, and frozen-path audit; **compare each against the PHASE A baseline**; run `FOUNDATION_FINAL_AUDIT.md` end to end. No new implementation beyond fix-and-re-verify (which loops back through §4.1). **Acceptance:** every check in `FOUNDATION_FINAL_AUDIT.md` PASS; zero unintended drift vs PHASE A; no new debt; the §8 gate green. **Any ✗ blocks mission completion** (fix or record a BLOCK — never hand-wave).

---

## 7. FROZEN (unchanged — do not modify without human sign-off)
Ledger kernel `139`; inventory `141`; order SM `147`; theme section/block model; `tokens.ts`; package-boundary acyclicity; auth primitives (bcrypt-12, AES-GCM TOTP, opaque revocable sessions, SEC-H3, the `/api/auth/switch` fix); cross-realm cookie isolation; the “never custody money / rent rails” decision. **Add:** a pre-commit `gate` that FAILS if any FROZEN path is modified without an explicit `FROZEN-OVERRIDE: <human>` trailer.

## 8. FINAL ACCEPTANCE GATE (v1 gate + new safety gates)
v1 items 1–10, PLUS: (11) PHASE A artifacts present + drift reconciled; (12) **ledger backfill reconciliation = 0 variance per site**; (13) tenant-table registry proven exhaustive (no schema table with `store_id`/`site_id` missing); (14) every schema change used expand→contract with 100% verification + a tested `down`; (15) every QUARANTINE has a HEAD 0-importer proof + build stayed green; (16) per-wave reports (impl+rollback+governance) exist for all 8 waves; (17) no FROZEN path modified without override; (18) zero CLASS-B SKIPs; every CLASS-A SKIP gated OFF + logged; (19) **no production action taken** — all shared-env applies are `SKIP-DEPLOY` runbooks; (20) `build` + `validate:dependencies` + all behavioral suites green on `stepup/main`; (21) `FOUNDATION_RISK_MATRIX.md` produced at PHASE A.5 with every S0 mitigated; (22) `FOUNDATION_EXECUTION_DASHBOARD.md` shows all waves complete, 0 open blockers, every SKIP CLASS-A + gated; (23) **`FOUNDATION_FINAL_AUDIT.md` (WAVE FINAL) all-green** — re-derived dependency/import/build/tenant/ledger/frozen audits match the PHASE A baseline with zero unintended drift and no new debt.

## 9. ARTIFACTS CODEX MAINTAINS
`FOUNDATION_STEPUP_STATUS.md` (resumable state machine) · `FOUNDATION_STEPUP_LEDGER.md` (per-wave reports) · `FOUNDATION_STEPUP_SKIPPED.md` (SKIP log) · PHASE A: `FOUNDATION_REPO_STATE.md`,`ACTIVE_DEPLOYMENT_TOPOLOGY.md`,`BUILD_GRAPH.md`,`IMPORT_GRAPH.md` · `tenant-tables.registry.ts`.
**Control set (read/maintain throughout):** `FOUNDATION_EXECUTION_DASHBOARD.md` (control tower — update every wave) · `FOUNDATION_REPO_LOCKS.md` (frozen paths — obey) · `FOUNDATION_RISK_MATRIX.md` (PHASE A.5 — verify) · `FOUNDATION_FINAL_AUDIT.md` (WAVE FINAL — run to completion).

---
> **Run wave-by-wave from `stepup/main`. Audit first (PHASE A). Backfill before you flip balances. Expand→contract every type change. Quarantine, verify, then (later, human) delete. Prove every wave on a real fixture, report it, checkpoint it. SKIP CLASS-A, STOP on CLASS-B, never touch prod. When the 20-point gate is green, the foundation is true — safely.**
