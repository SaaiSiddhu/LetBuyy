# FINAL REPOSITORY TRUTH CERTIFICATION — LETBUYY

**Date:** 2026-06-12 · **HEAD:** `f961e23a` (`stepup/main`, clean tree) · **Gate:** GREEN (106 gate-lane validators)
**Mode:** Adversarial multi-agent deep research (8 parallel auditor agents covering 20 audit roles + independent counter-verification of every load-bearing finding)
**Method:** Repository evidence only. No prior report, ledger, certification, or roadmap was trusted. Every claim below was attacked; what survived is certified.
**Status of this file:** UNTRACKED deliverable. Tracking it requires a deliberate commit; per repo precedent (P0, commit `4d900a02`), certification documents may require a `PROMPTS.md` registry row in the same commit to keep `prompt-perimeter-validator` green.

---

## 0. EXECUTIVE SUMMARY

The adversarial program failed to disprove the **core convergence**: one canonical append-only double-entry ledger with DB-enforced immutability and atomic capture/refund/COD/payout posting; one modular monolith (api-gateway) + 4 satellite Workers; one region; no self-custody payout rail; 0% commission enforced by migration + validator; an honest execution ledger with **zero overclaims and zero underclaims** across all 13 launch-readiness commits; and governance memory that candidly discloses its own gaps.

The program **succeeded** in disproving completeness. The repository is a converged, honestly-documented foundation **wrapped around seven blocker-grade facts**: production (`origin/main`) is 170 commits stale and still ships the `/api/auth/switch` account takeover, a 3% rake, and pre-RLS-hardening leaks; the mandated `main..stepup/main == 0` invariant is violated (= 6); the active branch deploys to staging through a workflow with **no governance gate**; the gate lane remains blind to untracked migrations; the money-invariant runner (I1–I8) is **structurally false-green**; the AI-credit purchase path posts money to nothing; and one shared `INTERNAL_API_SECRET` across ~10 runtimes makes internal identity assertions forgeable from any compromised runtime.

**Foundation Era verdict: NOT COMPLETE.** See §5.

---

## 1. SCOREBOARD

| Domain | Score | One-line basis |
|---|---|---|
| Strategic Winners | **5.5/10** | 3 winners fully real (monolith, one-region, governance chain); 4 partial (ledger, identity, Liquid, RLS+GUC) |
| Strategic Losers | **5/10** | Microservices/CQRS/saga/self-custody REMOVED; GraphQL+extensions (5,063 LOC) and parallel identity/money stores STILL ACTIVE |
| Architecture | **6/10** | Topology real and enforced; ~30K LOC frozen apps in half-quarantine; rejected runtimes mounted behind fail-open flags |
| Governance | **5/10** | Law coherent, registry honest; but gate absent from active-branch deploy path and untracked-blind; ~half of validators assert text, not reality |
| Money | **6.5/10** | Spine certified (atomic, DB-enforced, real rails); AI-credit un-ledgered; gift-card/store-credit outside ledger; invariant runner false-green |
| Identity | **4/10** | Switch-takeover fixed, step-up real, mobile login real; but 9 issuers, shared secrets across ~10 runtimes, parallel GoTrue systems |
| Liquid | **3/10** | Engine production-grade but renders 0% by default; parity 0/200; canary header observability-only; cart/checkout/account unreachable by Liquid |
| Cleanup | **4/10** | Flags/prompts/branches(local) clean; P2.1 BLOCKED, P2.4 ABORTED, OAuth residue in secret matrix, 43MB binaries, `origin/develop` stale |
| Launch Readiness | **4/10** | Scaffolds genuine and TBD-free; zero harnesses runnable/wired; invariant runner false-green; parity unexecuted; P1 precondition stale |
| **Repository Reality** | **5/10** | Local tree: converged and honest (~7/10). Production reality: 170 commits stale, ships known takeover (~1/10). The repo is two realities. |

---

## 2. CLAIM-BY-CLAIM VERDICTS

### CLAIM 1 — Architecture Freeze Complete → **MAJOR GAP**
- CERTIFIED: reserved roots truly manifest-only (2 files each, 0 code); no deprecated alias (`apps/admin|auth|checkout|internal|merchant|storefront|analytics`, `mobile/operator-team-app`) exists outside `docs/archive/`; zero imports from frozen apps into active runtimes; deploy matrix = 5 Vercel apps + 4 Workers, no Dockerfiles, no fly.toml.
- GAP: "frozen" = de-deployed, not removed — `app-marketplace` (12,040 LOC), `theme-marketplace` (9,500), `developer-portal` (4,422), `platform-operations-portal` (3,926) ≈ **29,888 LOC** registered in `config/runtime/production-topology.json:198-223` yet excluded from build/lint/typecheck (`package.json:11,12,67`). Contradictory half-quarantine.
- GAP: rejected runtimes still mounted (see Claim 4).

### CLAIM 2 — Governance Freeze Complete → **MAJOR GAP** (gate = partial theater on the path that matters)
- CERTIFIED: root `AGENTS.md` is the promoted hand-authored V2 (DOC 02), subordinate to the Constitution; old source demoted to a pointer stub; 78 AGENTS.md files, nested ones subordinate; no internal law contradiction; money IS validator-enforced with real SQL-body parsing (`canonical-ledger-only-validator.mjs:146-188`, `commission-bps-zero-validator.mjs`); `production-deploy.yml:50-51` DOES run the gate (prior audit's claim now false); prompt perimeter validator does real tree-vs-registry checks.
- **BLOCKER:** `.github/workflows/deploy-staging.yml:4-5` deploys the **active branch** `stepup/main` to staging Cloudflare + Vercel with **zero** governance/validate step and **no** untracked-migration guard (counter-verified: grep for validate/governance/ls-files = 0 hits). No validator covers staging deploys (`deployment-safety-validator.mjs:72-91` scopes to main+production patterns only).
- **BLOCKER:** `sequential-migration-validator.mjs:9` iterates `getTrackedFiles()` only — never tracked-vs-disk. The proven untracked-migration blindness is **unclosed** in the gate lane; only the production workflow's `git ls-files --others` guard catches it, and that never runs for the active branch.
- GAP: validator census — of ~118 distinct gate checks, ~55 assert reality (AST/SQL/config cross-checks), ~45 assert document/config text, ~18 assert absence; weakest are existence/grep/fixture-only no-ops (`test-coverage-governance-validator.mjs:32` passes empty files; `one-system-per-domain-validator.mjs:27` scans only injected fixtures; `rls-force-coverage-validator.mjs:36` skips real new migrations).
- GAP: mandated invariant `main..stepup/main == 0` (MERGE_RUNBOOK.md:9,34; AGENTS.md:212,330 DEPLOY-R1 "MUST NOT let the lag silently re-accumulate") is **currently 6**. The forbidden failure mode has recurred at HEAD.

### CLAIM 3 — Strategic Winners Implemented → **PARTIAL**
| Winner | Verdict | Decisive evidence |
|---|---|---|
| Modular Monolith | **REAL** | api-gateway hosts checkout/payments/payouts/wallet/settlements/orders/themes; single Worker (`wrangler.toml`); 4 satellites; 0 Dockerfiles |
| One Region | **REAL** | No multi-region config anywhere; governance uniformly forbids it; no validator mandates it (prior "self-block" disproven) |
| Governance Chain | **REAL** (doc layer) | Constitution → root AGENTS_V2 → nested AGENTS, consistent; enforcement gaps are Claim 2's, not the chain's |
| Canonical Ledger | **PARTIAL→REAL on main rails** | See Claim 6 |
| Identity Platform | **PARTIAL** | See Claim 7 |
| Liquid | **PARTIAL (dormant)** | See Claim 8 |
| RLS + GUC | **PARTIAL (schema-real, hot-path-bypassed)** | 433 ENABLE RLS + 717 policies + real `current_site_id()` GUC; but runtime uses `getSupabaseAdmin` (bypasses RLS) **916×** vs RLS-respecting client **1×** (counter-verified: 916). 118 `TO service_role USING (true)` policies. Hot-path tenant isolation is the app-layer JS Proxy (`tenant-scoped.ts:112`), contradicting Constitution §3.5 ("database is the load-bearing backstop") |

### CLAIM 4 — Strategic Losers Removed → **MAJOR GAP**
| Loser | Verdict | Evidence |
|---|---|---|
| Microservice fleet | REMOVED | Reserved roots manifest-only; 4 canonical Workers only |
| CQRS / event sourcing / saga | REMOVED | Replaced by transactional outbox (`outbox-execution.adapter.ts`); no projection/saga imports in active runtimes |
| Self-custody payouts (razorpayx) | REMOVED | Rail = `razorpay_route` (`payouts.ts:121,135`); zero `razorpayx`/`fund_account` in services/packages; manual rail throws to human runbook |
| Wasm app-functions runtime | **PARTIALLY REMOVED** | `app-functions-runtime.ts` (623 LOC, real `WebAssembly.compile/instantiate`) still present, **zero importers** (live caller severed by `e469a7c0`); deletion BLOCKED by `SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB` |
| Extension registry runtime | **STILL ACTIVE** | `extension-routes.ts` (500 LOC) mounted via `app-store.ts:1456` → `index.ts:690`; live in staging |
| GraphQL surface | **STILL ACTIVE** | 3,940 LOC mounted at `/storefront/graphql`, `/admin/graphql` (`index.ts:684-685,713`); prod flag "false", staging/default "true"; **flag middleware fails OPEN** (`featureFlags.ts:25` returns `!isProductionRuntime` when unset) |
| Duplicate theme systems | REMOVED | Exactly 2 renderers (React + liquidjs), one canonical theme model; marketplace tables are commerce wrappers; mobile editor produces the same Liquid bundle |
| Duplicate money systems | **PARTIALLY REMOVED** | Wallet is a reconciled projection; but gift-card (×2 tables) + store-credit balances remain independent mutable money stores outside the canonical ledger |
| Parallel identity (GoTrue) | **STILL ACTIVE** | See Claim 7 |

### CLAIM 5 — Cleanup Program Complete → **FALSE (MAJOR GAP)**
- The repo's own ledger rows concede it: P2.1 **BLOCKED** (1,123 LOC Wasm+extension routes remain — the prior cert's "~785 LOC" undercounts by ~338), P2.4 **ABORTED**, P2.5 local-only (`origin/develop` remains, fully merged, 0 unmerged commits), P2.3 **PARTIAL** (templates cleaned; 10 Social-OAuth declarations survive in `config/env/staging-production-secret-matrix.json:69-73,199-203` with zero readers).
- 43MB / 176 tracked PNGs under `artifacts/shopify-ux/` referenced only by archived docs. Dead deps beyond any document's count (`react-email`, `@react-email/components` in identity-platform; `@types/nodemailer` in theme-engine; 8 in archived firebase manifest). Two committed certs contradict each other on the dep count (P2.4 "all 14 live" vs FINAL_SAFE_DELETION "14 dead").
- CERTIFIED within scope: 2 dead flags genuinely removed; root md budget = 9/9 held; PROMPTS.md registry clean (no orphans either direction); provider posture honest (1 live email provider = Resend; SES/SendGrid honest stubs; razorpay/stripe/paypal/cashfree live; firebase archived); no tracked `.DS_Store`.

### CLAIM 6 — Money Architecture Converged → **PARTIAL (MAJOR GAP)** — Money Score 6.5/10
- CERTIFIED (the spine survived attack): ledger is append-only with UPDATE/DELETE-rejecting triggers (`139:163,358`) + deferrable balance-enforcement trigger (`139:378`); balances derived via SUM, never mutated; capture/refund/payment-failure post balanced double-entry **atomically inside single plpgsql functions** (`168_…sql:237,400,662`); `capture_posted_to_ledger` is set only after an independent verification SELECT (`checkout.ts:653-690`) — the prior false-flag claim is REFUTED; payout client is a real authenticated Razorpay Route `/v1/transfers` call with Idempotency-Key (`payout-transfer-adapter/index.ts:168-228`); double-release guarded by `claim_payout_statement_release` (lock + idempotency + balance re-check, `160:357-421`); recon scheduled 4×/day (`queue-workers/wrangler.toml:20`) and never auto-plugs; step-up (428) enforced on `refund.approve` / `payout.release` / `dsr.erase`.
- **BLOCKER:** AI-credit purchase (`ai.ts:1063-1112`) builds `purchaseRecord` and returns it in JSON with `credit_grant_deferred_until_canonical_ledger: true` — **no insert, no RPC, no ledger row, no consumer exists** (0 matches in queue-workers). Counter-verified. Fails closed, but the revenue line is un-ledgered and non-functional.
- **BLOCKER (shared with Claim 10):** I1–I8 runner `check-invariants.mjs:53-58` — `passed = result.status === 0`; all 8 SQL files are plain SELECTs with 0 `RAISE`/`ON_ERROR_STOP` (counter-verified). psql exits 0 while printing violation rows → **a corrupt ledger reports PASS**.
- MAJOR: gift-card (`gift_card_accounts.balance`, legacy `gift_cards.balance`) and store-credit (`store_credit.balance_minor`) are mutable money truths with private sub-ledgers, never reconciled into the canonical ledger; recon worker logs mismatches (`writeQueueLog('info')`) instead of alerting or using `assert_money_ledger_site_reconciliation`.
- MINOR: rake formula still computes `grossAmount × commission_bps` (`commission.ts:292`) — 0% holds via migration 162 default+backfill, DB constraint (152), and validator, not via code; I5's column check targets the wrong table; payout post-transfer ledger stamp is 3 sequential calls (crash window detectable by recon, not atomic).

### CLAIM 7 — Identity Architecture Converged → **REJECTED (MAJOR GAP, blocker-adjacent)** — Identity Score 4/10
- CERTIFIED: `/api/auth/switch` takeover is FIXED in committed code (`switch/route.ts:56-63` valid-session required; `:69-81` target must be proven-on-device; rate-limit + CSRF); step-up is real crypto (HMAC, 10-min window, jti replay guard, TOTP re-verification before issuance); mobile login converged onto identity-platform (CSRF + in-app Turnstile + `/api/auth/login`; BFF issues no tokens); EdDSA/ES256 issuance + JWKS verification genuinely implemented; OIDC honestly a gated 501 skeleton.
- **BLOCKER:** one `STAGING_INTERNAL_API_SECRET` is pushed as `INTERNAL_API_SECRET` to api-gateway, webhook-service, queue-workers AND the Vercel app build env (`staging-deploy.yml:88,89,115,134,152,232` — counter-verified), with `AUTH_SECRET`/`CUSTOMER_SESSION_SECRET` likewise shared (prod: `production-deploy.yml:315-319`; matrix: `staging-production-secret-matrix.json:29-79`). ~10 runtimes can mint internal identity headers the gateway trusts (`internal-auth.ts:128-152`). Any compromised runtime forges identity.
- MAJOR: identity-platform is NOT the sole issuer — **9 distinct issuers**: gateway opaque sessions in non-prod (`auth.ts:1140` — EdDSA required only when `isProductionGatewayRuntime`), Supabase GoTrue for sellers (`auth.ts:1342-1414`) and employees (`employee.ts:50-119`), auth-core HS256 customer/platform/app/magic-link tokens, storefront self-issued customer sessions + gate tokens, console sessions falling back to shared `AUTH_SECRET` (`console-session.ts:24`). Asymmetric crypto is prod-conditional config, not architecture.
- MAJOR: KYC does not gate payouts (zero kyc references in `payouts.ts`; `/:id/settle` gates on step-up only) — KYC is advisory reporting.

### CLAIM 8 — Liquid Is Strategic Winner → **SHARED OWNERSHIP — Liquid is the designated, dormant challenger; React is the production winner today**
- Default render = React, triple-pinned: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (`theme-governance.ts:14`), CI validator forces the literal `= false` (`theme-governance-validator.mjs:60-61`), no committed store/seed sets `liquidRenderingCanary` and no committed `liquidBundle` exists (grep `database/` = 0). **0% of pages render Liquid in committed state.**
- The Liquid engine itself is real and production-grade (`theme-renderer.ts:188-301`, liquidjs + sanitization + drops + app-blocks). ~60-64% of surfaces are Liquid-*capable* via the composition engine; **cart, checkout, account(×4), orders are React-only with no Liquid path; search route doesn't exist**.
- Canary machinery (P5) is observability-only: `X-Lb-Render-Engine` is a **response** label hard-wired to `react` (reads an unset env var, `proxy.ts:171-172`), never an inbound selector; telemetry = `console.log` JSON (`composition-engine.tsx:385-394`), no sink. Parity: 0/200 matrix cells filled; snapshot corpus empty; `capture-snapshot.mjs:64` prints a hardcoded header string instead of reading the real header; harness not CI-wired (0 matches in `.github/`); only 3 of 10 matrix dimensions have code.

### CLAIM 9 — React Is Frozen → **FALSE as stated (MAJOR GAP)**
- Only NEW `.tsx` files in `apps/storefront-runtime/src/components/sections/` are blocked against a 20-file allowlist (`no-new-react-sections-validator.mjs:9-37`). Routes, layout, product components, lib, and modifications to the existing 20 are unconstrained — and actively committed (`8991f600`, `99bbb425`, `09381db5`, `da57fa11`, `e469a7c0`).
- No React-deletion mechanism exists in code; deletion is explicitly forbidden until parity + ARB flip + G+30d (`LIQUID_ACTIVATION_PROGRAM.md:5,60-62`). Accurate statement: "new React *sections* are frozen; the React path is live, mutable, and the default."

### CLAIM 10 — Repository-Side Launch Work Complete → **FALSE (MAJOR GAP)** — Launch Readiness Score 4/10
- CERTIFIED: P0–P6 commits are exactly what they claim (13/13 diff-vs-message MATCH); scaffolds are honest — 0 TBD/TODO/PLACEHOLDER in the entire `LAUNCH_READINESS_2026_06_12/` tree; GO/NO-GO 16 rows evidence-linked to real paths; S1–S12 scenario harnesses are genuine JS with real asserts (BigInt double-entry verification, over-refund rejection) against real RPCs.
- **BLOCKER:** the one automated money gate (I1–I8 runner) is false-green by construction (§Claim 6).
- MAJOR: nothing is runnable repo-side — no npm script, no CI wiring, no fixtures for S1–S12 or invariants (`evidence/d-money-certification/` empty); parity 0% with stubbed header read; P1's verified precondition (`main..stepup/main == 0`) is stale-false at HEAD (= 6).
- MINOR: P2 deletions materially undone (blocked/aborted, §Claim 5); M1–M5 exist as one template, not 5 instantiated checklists (correctly a pilot-time action).

### SECTION I — Execution Ledger vs Git → **CERTIFIED (HONEST)**
- **0 overclaims, 0 underclaims.** All 13 commits in `5c2d3993..HEAD` have matching rows; 11 substantive rows diff-verified (`git diff-tree`); foundation squash commit `72e80c2b` exists. The one imperfection (P0 accidentally tracked the Codex twin prompt) is self-disclosed in row 200 and fixed in the next commit. No force-push/rewrite in the audited range; reflog intact (1,081 entries). `EXECUTABLE_HUMAN_REQUIRED.md`: 22 rows, 0 falsely marked done. `SKIPPED_HUMAN_DECISIONS.md` discloses the stale-prod risk more candidly than any prior audit. P0 same-commit rule satisfied in `4d900a02`.
- MINOR: `Commit` column uses "this commit" in 3 rows; validator-count phrasing (105/106) is gate-lane, consistent.

---

## 3. BLOCKER REGISTER (all confirmed by ≥2 independent passes)

| # | Blocker | Type | Evidence |
|---|---|---|---|
| B1 | **Production branch ships the takeover.** `origin/main` = `c2547049` (2026-06-09), 170 commits behind HEAD; contains pre-fix `/api/auth/switch` (mints session for any `email_verified` body), `commission_bps: 300`, and lacks migrations 160/162/163/164 + the EdDSA verifier. Zero pushes have ever occurred; prod deploy guard is additionally unsatisfiable (origin has no `stepup/main` ref for `branch-lag-guard-validator` to fetch) | HUMAN seam (disclosed by SKIP-A2/D1/A4) | `git show origin/main:...` sentinels |
| B2 | **Mandated branch invariant violated.** `main..stepup/main` = 6, law requires 0 (AGENTS.md:330 DEPLOY-R1; MERGE_RUNBOOK.md:9) — the exact "silent re-accumulation" DEPLOY-R1 forbids | REPO (one local command) | `git rev-list --count` |
| B3 | **Active branch deploys ungated.** `deploy-staging.yml` (push → `stepup/main`) runs wrangler+vercel deploys with no governance gate and no untracked-migration guard; no validator scopes staging | REPO | `deploy-staging.yml:4-5`; grep = 0 |
| B4 | **Gate blind to untracked migrations.** `sequential-migration-validator.mjs:9` reads `getTrackedFiles()` only; the historically-proven hole is unclosed in the gate lane | REPO | validator source |
| B5 | **False-green money invariants.** `check-invariants.mjs:57` equates psql exit 0 with PASS; all 8 invariant SQLs are plain SELECTs (0 RAISE/ON_ERROR_STOP) — violations print and PASS | REPO | counter-verified |
| B6 | **AI-credit purchase posts to nothing.** No persistence, no ledger row, no grant, no consumer; 202 + deferred-grant flag to a consumer that doesn't exist | REPO | `ai.ts:1063-1112`; counter-verified |
| B7 | **Shared signing secrets across ~10 runtimes.** One `INTERNAL_API_SECRET` (workers + all Next apps) + shared `AUTH_SECRET`/`CUSTOMER_SESSION_SECRET`; internal identity headers forgeable from any runtime; EdDSA sole-issuer is prod-conditional only | REPO+HUMAN (secret architecture) | `staging-deploy.yml:88-232`; counter-verified |

**Major gaps (non-blocker):** RLS hot-path bypass 916:1 with app-layer proxy as real guard; parallel GoTrue identity (sellers + employees); gift-card/store-credit money stores outside ledger; 5,063 LOC GraphQL+extensions mounted with fail-open flag middleware (P2.1 ARB-blocked); Liquid parity 0/200 + stubbed snapshot capture + telemetry-to-stdout; React freeze scoped to one directory; ~30K LOC frozen apps in contradictory half-quarantine; 43MB tracked screenshots; recon logs-not-alerts; KYC not gating payouts; dead deps/env residue beyond documented counts; `origin/develop` stale.

---

## 4. WHAT SURVIVED ADVERSARIAL ATTACK (CERTIFIED REGISTER)

Modular monolith · one region (no self-block — disproven) · governance authority chain (Constitution → root V2 → subordinate nested) · canonical ledger spine: atomic capture/refund/COD/payout with DB-enforced append-only + balance triggers · `capture_posted_to_ledger` truthful (verification-SELECT-backed) · real Razorpay Route payout client with idempotent, lock-guarded release · no self-custody rail anywhere · 0% rake in data+constraint+validator · recon alive, scheduled, never auto-plugs · `/api/auth/switch` fix committed · step-up real (TOTP re-auth, enforced on money endpoints) · mobile login unblocked via identity-platform · OIDC honestly skeletoned · two-realm cookie isolation (storefront host-only) · reserved roots manifest-only · deprecated aliases absent · no frozen→active imports · single theme model, exactly 2 renderers, no third engine · provider posture honest (1 live email provider) · prompt perimeter clean · root md budget held (9/9) · S1–S12 harness code genuine (real asserts) · GO/NO-GO evidence-linked, 0 TBDs · **execution ledger honest: 0 overclaims, 0 underclaims, no history rewrite** · governance memory (SKIP/HR files) accurate and self-critical.

---

## 5. FINAL ANSWER

**Is LetBuyy Foundation Era actually complete? — NO.**

It is **converged and honest, but not closed**. Closure requires, at minimum: B2 (re-point `main`), B3 (gate the active-branch deploy workflow), B4 (tracked-vs-disk migration check), B5 (make I1–I8 assert), B6 (ledger or remove the AI-credit purchase path), B7 (per-runtime secrets / enforce EdDSA issuer outside prod) — all repository-side — plus the disclosed human seams: push `stepup/main` + `main` to origin (B1), branch protection, first gated deploy, ARB closure of the GraphQL/extensions deletion (P2.1), and live execution of the money/parity/pilot evidence the scaffolds were built to produce.

Until B1 executes, every local achievement is invisible to production: **the deployed product remains the pre-foundation build with a known account takeover and a 3% rake.** The Foundation Era cannot be certified closed while its fixes exist only on an unpushed branch.

**Certification withheld: FOUNDATION ERA — OPEN. Next phase remains: complete B2–B7 repo-side, then execute the human seam (B1), then Launch Readiness & Real-World Validation.**

---

*Generated 2026-06-12 by adversarial multi-agent audit (8 parallel auditors + counter-verification). Supersedes FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12 as the current truth view.*
