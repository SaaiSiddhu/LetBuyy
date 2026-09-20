# PRODUCTION READINESS REPORT — Repository Truth Audit 2026-06-10

**Axis:** Production readiness synthesis (all 11 domains, dual-scored)
**Auditor:** Production-readiness auditor, wave 2. **Discovery only** — the only file written is this report.
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `c4fc3cd6` (2026-06-10) · working tree massively dirty (512 D / 410 M / 76 ?? per wave-1 counts) · `main` @ `4bcae19a` (2026-06-09) is the **only branch production CI deploys from** (`.github/workflows/production-deploy.yml:3-7`, push-triggered) and is **30 commits behind** `stepup/main` with **none** of the Phase A–D13 hardening.
**Inputs:** all nine wave-1 reports in this directory (governance, architecture, prompt-drift, codebase, database, theme, identity, money, mobile) plus my own targeted spot-checks of observability/operations surfaces (`infrastructure/monitoring/`, `infrastructure/observability/`, gateway `middleware/observability.ts`/`rateLimit.ts`/`onError`, `docs/runbooks/`, `config/runtime/database-recovery-policy.json`, `production-safety-preflight.json`, `infrastructure/scripts/deploy/verify-health-gates.mjs`, prod wrangler vars, `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`).
**Date:** 2026-06-10.

---

## 1. Executive Summary

**Overall: 2.3 / 10 as-deployable today (from `main`) · 5.5 / 10 working-tree end-state (committed + merged + human seams resolved). The 3.2-point gap is not a quality gap — it is a version-control and human-seam gap, plus a hard core of genuine missing capability that no commit fixes.**

1. **Three repositories live in one.** `main` (deploys to production) carries the pre-hardening platform: live account takeover (`/api/auth/switch`), open anon RLS leaks, a 3% commission rake, no payout double-release guard (migrations end at 158), regex theme sanitizer, debug-signed mobile builds, and a 9-app Vercel matrix that deploys the four "frozen" apps (verified: `git show main:.github/workflows/production-deploy.yml` matrix includes `theme-marketplace`). `stepup/main` HEAD adds waves 0–7 (ledger authority 159–161, capture/refund postings). The **working tree alone** contains the actual end-state: migrations 162–166, the identity asymmetric topology, the `/switch` fix, RLS FORCE+GUC, COD atomic ledger, checkout digest binding, DOMPurify, fail-closed Android signing, all money validators, and the entire constitutional layer — every row of `EXECUTION_LEDGER.md` says "not committed", and the Constitution, both archives, and seven prior audit programs are **untracked with zero git history** (one `git clean -fd` from nonexistence).
2. **Even the end-state does not let real money flow correctly.** The storefront payment-confirmation path — the one shoppers actually hit — terminates in `confirm_order_payment_with_ledger` (`database/supabase/migrations/000_baseline.sql:1590`), which writes **zero canonical ledger entries** in every state (main/HEAD/worktree). Two of three refund paths are un-ledgered. No payout provider client exists (`initiateTransfer` unconditionally throws — `packages/infrastructure/payout-transfer-adapter/index.ts:103-105`), so no payout can ever move money. Reconciliation RPCs have zero runtime callers and the merchant wallet **fails closed at 409 forever** until an operator manually runs a backfill (`services/api-gateway/src/routes/wallet.ts:163-176`). Step-up authorization for refunds/payouts/DSR-erase is satisfied by a self-served mock token (`security.ts:123`, `security-controls.ts:27`).
3. **~22 human-only seams gate launch** (`SKIPPED_HUMAN_DECISIONS.md`): identity signing keys, provider secrets, DNS cutover, checkout signing secret, PITR, Sentry DSN, the `stepup/main → main` merge itself, and live DB probes. Roughly 10 of them are launch-blocking for a real merchant + shopper + money (§7B); committed `SKIP_NEEDS_HUMAN_*` placeholders sit in production wrangler vars today (`services/api-gateway/wrangler.toml:255-267`, `services/queue-workers/wrangler.toml:39-47`).
4. **Observability is half real, half stage-set.** Real: structured JSON logs with request IDs, 2%-sampled request telemetry into a Cloudflare Analytics Engine dataset, fail-closed Upstash/KV rate limiting, health endpoints, an incident-command API with DB tables, an encrypted pre-migration `pg_dump` in the deploy pipeline (present at `main`). Stage-set: `infrastructure/observability/prometheus-rules.yaml` alerts on seven `letbuyy_*` metrics that **no code emits** (repo-wide grep: zero emitters); `otel-collector.yaml` exports to `tempo.letbuyy-observability.svc.cluster.local` — a Kubernetes cluster whose configs were deleted from this repo; `slo-catalog.yaml` assigns SLOs to `services/checkout-runtime` and `services/event-bus`, both **manifest-only empty directories**; no error-tracking SDK exists anywhere (mobile `SENTRY_DSN` is a `SKIP_NEEDS_HUMAN_` placeholder with no `sentry` package in `pubspec.yaml`); there is **no alert delivery channel of any kind**.
5. **Verdict:** Do not launch from `main` under any circumstances (§9 narrative — it is a breach-and-insolvency generator). After commit + merge + seam resolution, the platform could plausibly run a **closed beta of ~100 merchants on online payments with manual finance operations** — but not before the storefront capture path is ledgered, refunds are ledgered, a payout provider client exists, step-up is real, and mobile login's token double-spend is fixed.

---

## 2. Scoring Method

- Each domain is scored 0–10 **twice**:
  - **(a) As-deployable today** — what a push-triggered production deploy from `main` (`4bcae19a`) would ship. This is the only deploy path that exists.
  - **(b) Working-tree end-state** — the dirty tree committed, merged to `main`, deployed, **and** all human-only seams in `SKIPPED_HUMAN_DECISIONS.md` resolved (keys/secrets/DNS/PITR provisioned, probes run). Genuine missing capability (code that does not exist in any state) still caps this score.
- 0 = absent/actively dangerous · 3 = skeleton/unsafe for real users · 5 = works for a supervised beta with manual ops · 7 = production-credible with known gaps · 9+ = hardened.
- **Weights** (commerce platform — money, identity, and tenancy carry the blast radius): payments .16, identity .13, tenancy .13, security .12, checkout .10, operations .08, observability .07, themes .07, architecture .06, mobile .05, governance .03.
- Every score cites wave-1 evidence (report + path) or my own spot-checks. Live infrastructure was not accessible; all live-state claims are marked UNVERIFIED.

---

## 3. Domain Scores

### 3.1 Governance — (a) 2.0 · (b) 7.0

At `main`/HEAD the operative law is the scan-generated 2026-06-08 `AGENTS.md` plus a 181-validator gate containing the GATE-1 self-block — the regime the hardening audit scored 2.5 "in force" and that the rewrite exists to replace (GOVERNANCE_TRUTH §1, §3.3). The working tree carries the best governance the repo has had: promoted hand-authored AGENTS_V2 at root (3-hunk delta from source), a 7-doc constitutional stack, theater purge (181→90 gate validators, 38 theater docs archived), and a passing gate (90/90, run by wave 1). It is entirely uncommitted and human-unratified (`SKIP-GATE1-ARB-RATIFICATION`), the Constitution self-declares a ratification that never happened (`LETBUYY_CONSTITUTION.md:5-8`), and a miniature self-block was rebuilt: `whole-repo-end-state-validator.mjs:172-193` + `survivability-governance-validator.mjs` machine-mandate the rejected 4-region/chaos/failover artifacts the Constitution forbids (ARCHITECTURE_TRUTH §1.2).
**Blockers:** uncommitted constitutional layer (zero git history); ratification seam; recreated survivability self-block; ≥10 surviving contradicting `docs/governance/*` docs; 38 stale scan-generated nested `AGENTS.md`; ~12 DANGEROUS live prompts under `docs/` (PROMPT_DRIFT §3.3-3.4); `MERGE_RUNBOOK.md` describes a merge of branches that no longer exist (GOVERNANCE_TRUTH §6.1); missing `_GOVERNANCE_SPINE.md` cited 26× by canon docs.

### 3.2 Architecture — (a) 3.0 · (b) 6.5

`main` still encodes "four mutually-contradictory self-definitions": CQRS/distributed package cluster on disk, 9-app deploy matrix including frozen apps, generated AGENTS.md as law (ARCHITECTURE_TRUTH §3.3). The working tree converges on one coherent canon (monolith + 4 satellites + 5 apps, one Postgres, reserved seams honest, D11 package deletion clean at the import level — zero residual `@letbuyy/<rejected>` imports, CODEBASE_REALITY §1.5). End-state caps: a **second backend** lives inside `apps/merchant-control-plane` (62 Next API routes duplicating gateway-owned domains — two writers per domain for products/orders/themes/billing, CODEBASE_REALITY §1.9, §4); the multi-region contract is machine-enforced into CI against the constitution (`config/runtime/production-topology.json:34-39` `globalRegions` india/apac/eu/us, locked by two validators); root TS build graph broken (`tsconfig.workspace.json:68` references nonexistent `packages/typescript/utils`; no package has `dist/`, so standalone `tsc -p` hits TS6305 — CODEBASE_REALITY §1.6, §7); reserved manifests contain garbled find/replace prose; portfolio/resume residue still routed (`/portfolio`, `/resume` mounted at `index.ts:738-739`).
**Blockers:** merchant-control-plane parallel API surface; machine-enforced multi-region fabrication; broken workspace build graph; staging still deploys 3 frozen apps (`staging-deploy.yml:189-200`); `config/vercel/projects.json` still declares production projects for all 9 apps.

### 3.3 Tenancy — (a) 2.0 · (b) 6.5

At `main`, migrations end at 158: migration 163 (closes PUBLIC `USING(true)` on 11 sensitive tables) and 164 (`app_tenant` NOBYPASSRLS role + GUC-driven FORCE policies across the 261-table registry) **do not exist** — the anon leak class found by the forensic master is live, and every query runs as service_role (DATABASE_TRUTH §3, §5). The working tree is materially fixed: 163+164 untracked but present, `withTenantTx` does real `SET LOCAL ROLE app_tenant` + GUC and refuses fake REST transactions, a runtime Proxy guard forces tenant predicates on registry tables, registry (261 entries) consistent with schema (IDENTITY_TRUTH §5; DATABASE_TRUTH §10). End-state caps (genuine, not seams): **25 PUBLIC/anon `USING(true)`/`WITH CHECK(true)` policies survive in final state** outside the validator's 12-table allowlist — including `service_role_*`-named-but-PUBLIC policies on `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents` (DATABASE_TRUTH §5); the raw-REST supabase-adapter helpers bypass the Proxy guard entirely (`packages/infrastructure/supabase-adapter/index.ts:65-150`); 664 `getSupabaseAdmin()` service-role call sites remain the norm; the queue tenant envelope **fails open** when `siteId` or the secret is missing (`queue-tenant-envelope.ts:38-40`). Live FORCE/grant state is a human probe seam (SKIP-D2/D4).
**Blockers:** untracked 163/164 (would not deploy from a clean checkout; `rls-force-coverage-validator` reads the untracked file and would **error** in clean CI — DATABASE_TRUTH §8); 25 surviving permissive policies; raw-REST bypass; fail-open envelope; live probes unexecuted.

### 3.4 Security — (a) 2.0 · (b) 6.0

`main` ships the SEC-C1 account takeover (`/api/auth/switch` mints a session for any `email_verified` user with no proof — quoted from `git show main:` in IDENTITY_TRUTH §2), no switch rate-limit bucket, regex-only theme sanitizer (3 `.replace()` chains at HEAD `theme-renderer.ts:606-610`), shared `AUTH_SECRET` signing everything, and debug-signed Android release builds. The working tree fixes the headline items: switch guards (valid session + proven account, ordered correctly), Turnstile and rate limiting fail closed in production (verified in `middleware/rateLimit.ts` + identity `rate-limit.ts:106-110`), DOMPurify + LiquidJS auto-escape with fragment/head/document modes (THEME_PARITY §3.2), TOTP secrets AES-GCM encrypted, internal IP-allowlist perimeter, fail-closed release signing. End-state caps: **step-up is mock theater** — `mock-step-up-${uuid}` minted pre-verified, verification = length ≥ 12 + timestamp window, and `stepup-crypto-validator` allowlists the mock (IDENTITY_TRUTH §7); shared symmetric `AUTH_SECRET` still signs the PII-bearing `lb_accounts` cookie (90d), console and customer sessions, media/export/checkout helpers, and is an accepted webhook-service internal credential (MONEY_TRUTH §8); replay-JTI cache is per-isolate in-memory; storefront Razorpay verify checks signature only, never capture status (MONEY_TRUTH §8); stateless customer/console JWTs are unrevocable; JS-readable CSRF + parent-domain SSO cookie makes one platform-app XSS ride everything.
**Blockers:** step-up mock guarding refund/payout/DSR; `AUTH_SECRET` monoculture; signature-only payment verify; per-isolate replay cache; secret rotation + mTLS/Access perimeter are human seams (SKIP-W4-*).

### 3.5 Identity — (a) 2.0 · (b) 5.5

At `main`: opaque `randomHex(32)` session tokens minted by the gateway, the takeover above, no identity-issued tokens, no JWKS anywhere, no CI key distribution (IDENTITY_TRUTH §2 divergence table). Working tree: a credible asymmetric topology — identity-platform is sole ES256/EdDSA issuer for merchant sessions, gateway verifies against env-injected public JWKS before any DB write, private JWK scoped to identity-platform in CI. End-state caps (genuine): the asymmetric property covers **exactly one token type** — shopper, console, app-OAuth, magic-link, and `lb_accounts` all remain HS256 over shared secrets (IDENTITY_TRUTH §1); **OIDC is a pure 404/501 skeleton** — all `/oauth2/*` + `/.well-known/*` return `oidcSkeletonResponse` with `implemented:false`, and the published JWKS endpoint serves a disabled placeholder key; Google/Apple OAuth is unimplemented (`/auth/callback` → `oauth_unavailable`); no passkeys/WebAuthn; the switch-guard test is text-matching, not behavioral. Live keys/registrations are seam SKIP-D3 (without them, **merchant login fails closed in production** — the seam's own blast-radius statement).
**Blockers:** entire topology uncommitted; SKIP-D3 keys; OIDC/OAuth/passkey absent (capability); HS256 realms remaining; revocation absent for customer/console tokens.

### 3.6 Payments / Money — (a) 1.5 · (b) 4.5

`main` is actively dangerous: no migration 160 → **no payout double-release claim guard, no reconciliation tables**; no capture/refund ledger columns or postings; old non-atomic COD wallet-credit path; commission defaults **300 bps (3%)** in DB and code fallbacks; `razorpayx` self-custody defaults; settlement writer sets the tenant GUC from caller-supplied `p_site_id` (cross-tenant posting surface, 151:23) (MONEY_TRUTH §6, §9). Working tree: a genuinely well-built double-entry kernel (append-only triggers, deferred balance constraint, idempotent posting, FORCE RLS), canonical capture/refund on the V1 `/payments` surface, atomic COD RPC (165), source-row-derived settlement ownership, ledger UPDATE/DELETE revoked from every role, commission zero + validators, payout claim with ledger-balance interlock (160:357-421). **End-state caps — the genuine holes (§7C):** the storefront/webhook confirm chain (`confirm_order_payment_with_ledger`, baseline:1590) writes **no ledger entries** — naming theater on the dominant customer path; `complete_order_refund` and the webhook `refund.created` path are un-ledgered; **no payout provider client exists** — release is fail-closed dead code; reconciliation refreshers have **zero runtime callers** and the wallet read 409s until manual ops; `merchant_payable` has three independent credit writers with no cross-source dedup (same rupee can legally enter twice); subscription platform revenue and the 15% app-marketplace fee never enter the ledger; the canonical-ledger validator scans TS only and cannot see SQL writers, and the `orders` table isn't in its ratchet list; no executed test covers 165's RPCs. Migrations 162–166 are untracked; worktree COD code hard-depends on untracked 165 (deploying code without the migration = COD outage).
**Blockers:** every item above; SKIP-D5 live reconciliation evidence; SKIP-PROVIDER-SECRETS; SKIP-W0-PITR (running money without PITR).

### 3.7 Checkout — (a) 3.0 · (b) 6.0

Checkout exists in the gateway + storefront-runtime in all states (cart, checkout sessions, `create_checkout_order`, COD + online flows). At `main`: no cart-digest binding on the handoff (a tampered cart survives), legacy JSON-items stock mutation inside payment confirm, no reserve→commit inventory (166 absent), no hosted-checkout origin contract. Working tree (D6): handoff HMAC binds a canonical cart-content digest, hosted checkout recomputes and rejects mutated carts, order creation goes through `create_order_with_inventory_reservations` (reserve→commit, 166:8-66), stale-reservation sweeper scheduled in queue-workers, `checkout.letbuyy.com` Terraform/env contract present (MONEY_TRUTH §9; EXECUTION_LEDGER D6). End-state caps: payment confirmation on this path is un-ledgered (money axis); Razorpay verify is signature-only (authorized-not-captured can mark an order paid — MONEY_TRUTH §8); `services/checkout-runtime` is a reserved empty root, so `checkout.letbuyy.com` has no dedicated runtime owner (it is served by storefront-runtime — acceptable per canon but the origin contract names a host the reserved service will never serve); live cutover (DNS + `CHECKOUT_SIGNING_SECRET` + migration 166 + carrier creds) is seam SKIP-D6 — without it, **production checkout URLs fail closed**.
**Blockers:** SKIP-D6 cutover; un-ledgered confirm; signature-only verify; migration 166 untracked.

### 3.8 Themes — (a) 4.0 · (b) 6.0

The React/JSON-contract theme system is real and serves every store in all states: 20 frozen sections + header/footer chrome, schema-driven editor with drafts/publish/releases, live catalog data binding, ISR caching (THEME_PARITY §2, §5). At `main` it ships with the 3-regex sanitizer and no auto-escape — merchant-controlled HTML surfaces are weakly XSS-protected. Working tree adds DOMPurify defense-in-depth, the 20-mapping parity table, the React freeze validator, and a default-OFF per-theme Liquid canary whose platform-wide flip is recorded as ARB-deferred. **Liquid itself is unsalvageable for a real store** (genuine capability gap, both states): no header/footer sections — the Liquid plan hard-codes empty groups, so a canaried store loses all chrome; the only bundle is a test fixture with a single `index` template (product/cart routes render the homepage); first-party commerce sections render hard-coded strings, not the catalog; cart/customer drops are stubs; head/SEO output is discarded at runtime; **no write path for the canary exists** (no API, no UI, no SQL); no editor (web or Flutter) has any Liquid awareness; `FEATURE_LIQUID` is consumed by no gate (THEME_PARITY §4-5, §9). Deletion-readiness of React: NOT-READY (the report's own verdict).
**Blockers:** weak sanitizer at `main`; Liquid-first roadmap blocked on ~10 named capability gaps; D7 uncommitted.

### 3.9 Mobile — (a) 1.5 · (b) 3.5

At `main`/HEAD: release builds are **debug-signed** (`signingConfig = getByName("debug")` at HEAD), the parity catalog is present, and login is broken in production. Working tree: fail-closed signing, signed-AAB release lane (untracked workflow, manual dispatch only), composite dashboard BFF endpoint, provider-mode badges, token bridge verified in sync (generator `--check` exit 0). End-state caps (genuine code defects, present in the worktree): **login Turnstile token double-spend** — the app pre-verifies the single-use token at the BFF (which consumes it via siteverify) then submits the same token to identity login, which verifies again and gets `timeout-or-duplicate` (MOBILE_TRUTH §1.3); **34 of 64 screens are unreachable** including the entire theme editor (631 + 1,200-line screens with zero construction sites), KYC, 2FA, returns, inventory, coupons, staff, billing; all 36 `/features/*` routes have zero inbound navigation (they exist to satisfy validators); deep-link router never mounted; no Play upload step, no iOS lane, no store metadata; shopper app does not exist (reserved). Turnstile prod secret + signing keystores are seams (SKIP-W7, SKIP-D8) — but the double-spend is not a seam, it is a bug.
**Blockers:** token double-spend; unreachable surface (incl. theme editor); no store-publish pipeline; seams SKIP-W7/SKIP-D8.

### 3.10 Observability — (a) 2.5 · (b) 4.0

**Real (verified by me, largely committed):** gateway `middleware/observability.ts` writes structured JSON logs with level/request-id/trace-id and samples request records (2% storefront, 100% errors/auth/payment/admin) into Postgres + a Cloudflare Analytics Engine dataset (`letbuyy-production-telemetry` binding in wrangler); `app.onError` returns structured 500s with request IDs (`index.ts:787`); rate limiting is Upstash-Redis-first with KV fallback and explicit production semantics; `verify-health-gates.mjs` probes live `https://api.letbuyy.com/v1/health` etc.; webhook/queue processing records evidence rows. **Theater/missing (verified by me):** `prometheus-rules.yaml` defines 7 alerts on metrics (`letbuyy_replay_lag_seconds`, `letbuyy_event_store_integrity_failures`, `letbuyy_queue_dead_letter_total`, `letbuyy_slo_remaining_error_budget_percent`…) with **zero emitters anywhere in the repo** (grep across services/apps/packages/scripts: no hits); `otel-collector.yaml` exports to Tempo/Loki at `*.letbuyy-observability.svc.cluster.local` — Kubernetes that does not exist (helm/k8s deleted in WT; never provisioned per repo); six Grafana dashboard JSONs have no Grafana nor a datasource; `slo-catalog.yaml` assigns SLOs to `services/checkout-runtime` and `services/event-bus` (empty reserved roots); **no error-tracking SDK exists in any runtime** — the only `SENTRY` references are mobile dart-define placeholders, and `pubspec.yaml` has no sentry package, so resolving SKIP-W3-SENTRY-DSN provisions a DSN that nothing would consume; **no alert delivery channel** (no PagerDuty/Opsgenie/Slack/webhook-alert config anywhere); preflight evidence flags (`RUNTIME_TELEMETRY_READY`, `MONEY_LEDGER_RECONCILIATION_ALERT_READY`) are human-gated and unclaimed. Money-reconciliation alerting — the one alert a commerce platform cannot launch without — exists only as a preflight flag name.
**Blockers:** no alerting path end-to-end (capability, not just a seam); no error-tracker SDK; theater configs pointing at nonexistent infra; SKIP-W3-SENTRY-DSN; AE dataset has no documented dashboard/query consumer.

### 3.11 Operations — (a) 3.0 · (b) 5.5

**Real:** production pipeline with credential preflight, migration gate, **encrypted logical `pg_dump` backup before prod migration** (present at `main` — verified `git show main:` contains the step), staging E2E gate, worker deploys with secret pushes, post-deploy smoke against `letbuyy.com`; rollback runbook + `production-rollback.mjs` (exists on disk); 20 runbooks of which ~12 are operable (deployment-rollback, incident-sev1, secret-rotation, queue-dlq-redrive, custom-domain smoke); incident-command API (`routes/operations/incident-command.ts` mounted at `/operations`) with real tables (migration 133: incidents, postmortems, oncall_schedules); DLQ pairs provisioned in Terraform. **Gaps:** at `main` there is **no branch-lag guard** (it is part of the uncommitted D1 work — the enforcement of merging is itself unmerged) and the matrix deploys the frozen four; PITR is human-gated (SKIP-W0) and the restore drill has only ever run in plan mode (`database-recovery-policy.json`: `codexDefaultMode: "plan"`) — so recovery is **one unrestorable pg_dump artifact deep**; on-call exists as a DB table with no paging integration; the sev1 runbook's first step calls `POST /v1/operations/runtime/incidents`, reachable only by staff who would learn of the incident from… nothing, since no alert channel exists; theater runbooks (regional-failover, survivability-suite, chaos-drill) are load-bearing for validators; production certification is "credential-gated and unclaimed" (EXECUTION_LEDGER D11-D13-VERIFY); migration runner config refs are `PRODUCTION_PROJECT_REF_PLACEHOLDER` (CI uses a secret DB URL instead).
**Blockers:** SKIP-W0-PITR + restore drill; SKIP-PROD-DEPLOY-PROMOTION (branch protection); merge seam SKIP-D1; no paging; staging deploys frozen apps; certification unclaimed.

---

## 4. Overall Scores

| Domain | Weight | (a) As-deployable today (`main`) | (b) Working-tree end-state |
|---|---|---|---|
| Payments / money | 0.16 | 1.5 | 4.5 |
| Identity | 0.13 | 2.0 | 5.5 |
| Tenancy | 0.13 | 2.0 | 6.5 |
| Security | 0.12 | 2.0 | 6.0 |
| Checkout | 0.10 | 3.0 | 6.0 |
| Operations | 0.08 | 3.0 | 5.5 |
| Observability | 0.07 | 2.5 | 4.0 |
| Themes | 0.07 | 4.0 | 6.0 |
| Architecture | 0.06 | 3.0 | 6.5 |
| Mobile | 0.05 | 1.5 | 3.5 |
| Governance | 0.03 | 2.0 | 7.0 |
| **Weighted overall** | 1.00 | **2.3 / 10** | **5.5 / 10** |

Interpretation: (a) 2.3 = a system that would actively harm its first real users (takeover, leaks, rake, unguarded payouts). (b) 5.5 = a supervised closed beta is plausible **after** the §7C capability items in money/identity/mobile are closed; it is not "ship to the open market".

---

## 5. The Seam Is the Story

The single largest production-readiness fact is not any one defect: it is that **the entire hardened platform exists only as an uncommitted dirty working tree** on a non-deploy branch, while the deploy branch carries the dangerous predecessor. Every wave-1 report independently converges on this:

- 512 deleted / 410 modified / 76 untracked paths; all 40 `EXECUTION_LEDGER.md` rows say "not committed".
- Migrations 162–166 (+5 rollbacks) untracked — a clean-checkout `supabase db push` silently omits the commission-zero, RLS-leak, app_tenant-GUC, canonical-money, and checkout-inventory fixes; `migration-safety-validator` scans tracked files only and is structurally blind to them (DATABASE_TRUTH §8).
- The constitutional layer, both 2026-06-10 archives, `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, and seven prior audit programs have **zero commits on any branch** — `git clean -fd` destroys them; `git commit -am` (tracked-only) commits 60 root-doc deletions while orphaning their untracked archive copies (GOVERNANCE_TRUTH §4.4, §6 #8).
- `rls-force-coverage-validator` reads untracked `164_…sql` from disk — the gate **passes on this machine and would error in clean CI** (DATABASE_TRUTH §9).
- The branch-lag guard that blocks deploying a stale `main` is itself part of the uncommitted diff.

---

## 6. Blocking Issues — Class A: repo-fixable but uncommitted (the merge/commit seam)

Ordered by severity. Fix = `git add -A` + commit on `stepup/main`, merge to `main` (the real merge, not `MERGE_RUNBOOK.md`'s obsolete one), push.

| # | Item | Evidence |
|---|---|---|
| A1 | All Phase A–D13 security/money/tenancy hardening uncommitted: `/switch` takeover fix, asymmetric identity topology + CI key wiring, migrations 162–166, COD atomic ledger route, settlement ownership fix, checkout digest binding, DOMPurify sanitizer, fail-closed Android signing, all Phase B/C/D validators | IDENTITY_TRUTH §2; MONEY_TRUTH §9; DATABASE_TRUTH §3; THEME_PARITY §1.1; MOBILE_TRUTH §10; `EXECUTION_LEDGER.md` (every row) |
| A2 | `main` is 30 commits behind and is the only production deploy trigger; merging is gated by human seam SKIP-D1 and a runbook that describes the wrong merge | CODEBASE_REALITY §1.2; GOVERNANCE_TRUTH §6 #1 |
| A3 | Untracked constitutional layer + archives + ledger + 7 audit programs (zero git history); `git clean -fd` destruction risk; tracked-only-commit archive-orphan trap | GOVERNANCE_TRUTH §4.4, §6 #8 |
| A4 | Worktree code ↔ untracked migration coupling: COD reconcile route calls a 165-only RPC; `rls-force-coverage-validator` requires untracked 164 on disk | MONEY_TRUTH §9; DATABASE_TRUTH §8-9 |
| A5 | Mobile release lane (`mobile-merchant-release.yml`) and signing fix untracked; HEAD ships debug-signed releases | MOBILE_TRUTH §7, §10 |
| A6 | Staging matrix still deploys 3 frozen apps; `config/vercel/projects.json` still declares 9 production projects — repo-fixable drift | CODEBASE_REALITY §1.3 |

## 7. Blocking Issues — Class B: human-only seams (`SKIPPED_HUMAN_DECISIONS.md`)

**Launch-blocking for real merchant + real shopper + real money:**

| Seam | Why blocking |
|---|---|
| SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE | Nothing reaches production until the privileged clean-tree merge happens |
| SKIP-D3-IDENTITY-LIVE-PROVIDERS | Without ES256/Ed25519 keypairs + JWKS secrets, merchant login **fails closed** in staging and production (seam's own blast-radius row) |
| SKIP-PROVIDER-SECRETS | Payment/ESP/Cloudflare/Vercel production secrets; today prod wrangler vars contain committed `SKIP_NEEDS_HUMAN_*` placeholders (verified: gateway lines 255-267, queue-workers 39-47) |
| SKIP-PROD-DNS-CUTOVER + SKIP-W3-DNS-CUTOVER | Canonical `letbuyy.com` hostnames may not resolve/attach |
| SKIP-D6-LIVE-CHECKOUT-CUTOVER | `checkout.letbuyy.com` DNS + `CHECKOUT_SIGNING_SECRET` + migration 166 apply; without it production checkout URLs fail closed |
| SKIP-PROD-DEPLOY-PROMOTION | Branch protection/environment approvals — without it the next push to `main` is the deploy |
| SKIP-D2-LIVE-ANON-GRANT-PROBE + SKIP-D4-LIVE-FORCE-COVERAGE-PROBE | Until probed, live RLS/grant state is unknown; the repo cannot prove the leak class is closed in the deployed DB |
| SKIP-D5-LIVE-MONEY-RECONCILIATION | Wallet reads 409 (`LEDGER_RECONCILIATION_REQUIRED`) until zero-variance evidence exists; split-rail credentials unprovisioned |
| SKIP-W0-PITR-TIER | Running real money on pg_dump-only recovery (restore drill never executed beyond plan mode) is launch-negligent |
| SKIP-W3-SENTRY-DSN | Production error visibility/alert routing — though note §3.10: a DSN alone fixes nothing because no SDK exists (Class C) |

**Deferrable (post-launch acceptable, badged/fail-closed in the meantime):** SKIP-GATE1-ARB-RATIFICATION and SKIP-GATE-OPS-SURVIVOR-ARB (governance formalities); SKIP-D8-MOBILE-RELEASE-SIGNING-SECRETS and SKIP-W7-MOBILE-TURNSTILE-SECRET (mobile can follow web); SKIP-D10/SKIP-W7 WhatsApp WABA/HSM (sandbox-badged sends); SKIP-W4-LIVE-SECRET-ROTATION (hygiene, dual-secret support exists); SKIP-W4-MTLS-CF-ACCESS (defense-in-depth behind existing fail-closed perimeter); SKIP-D11 index/dead-table live probes (cleanup).

## 8. Blocking Issues — Class C: genuine missing capability (no commit or secret fixes these)

Ordered by severity:

| # | Capability gap | Evidence |
|---|---|---|
| C1 | **Storefront capture path un-ledgered**: every shopper payment confirm (public verify + all 4 provider webhooks) ends in `confirm_order_payment_with_ledger` which writes zero canonical ledger rows | MONEY_TRUTH §1.2, §2a; baseline:1590 |
| C2 | **Refunds split-brained**: `complete_order_refund` (orders path) and webhook `refund.created` mark refunds succeeded with no ledger entry; only the V1 `/payments` path is canonical | MONEY_TRUTH §2b |
| C3 | **No payout provider client** — `initiateTransfer` unconditionally throws; payouts cannot move money in any state (safe, but a merchant can never be paid) | MONEY_TRUTH §1.6, §4.4 |
| C4 | **Reconciliation wiring-dead**: `refresh/assert_money_ledger_site_reconciliation` + `backfill_wallet_ledger_to_canonical` have zero runtime callers; wallet endpoint 409s permanently; no scheduler | MONEY_TRUTH §1.9, §5 |
| C5 | **Step-up is mock theater** on refund/payout/DSR-erase; validator certifies the mock | IDENTITY_TRUTH §7, R3 |
| C6 | **Mobile login token double-spend** (BFF pre-verify consumes the single-use Turnstile token, identity re-verifies) — a code bug in the worktree, beyond the secret seam | MOBILE_TRUTH §1.3 |
| C7 | **25 surviving PUBLIC `USING(true)` policies** outside the validator allowlist (incl. `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents`) + raw-REST service-role bypass of the tenant Proxy guard | DATABASE_TRUTH §5; IDENTITY_TRUTH R5 |
| C8 | **`merchant_payable` triple-writer with no cross-source dedup** — same paid order can be credited twice via different writers; payout gross computed from a fourth, ledger-independent number (`orders.total`) | MONEY_TRUTH §1.5 |
| C9 | **Liquid canary unsalvageable for real stores** (no header/footer, one template, no data binding, no canary setter, no editor) while the constitution mandates Liquid-first — the strategic bet has ~10 named gaps before any real store can use it | THEME_PARITY §9-10 |
| C10 | **OIDC skeleton / no OAuth / no passkeys** — every `/oauth2/*` route is a 501 stub; Google/Apple login unimplemented | IDENTITY_TRUTH §7 |
| C11 | **No alerting end-to-end**: prometheus rules with zero metric emitters, otel exporting to nonexistent k8s, no error-tracking SDK, no paging/delivery channel; money-reconciliation alerting exists only as a preflight flag name | my spot-checks §3.10 |
| C12 | **Merchant-control-plane second backend** — 62 API routes duplicating gateway domains; two writers per domain (products/orders/themes/billing) | CODEBASE_REALITY §1.9 |
| C13 | **Mobile navigation**: 34/64 screens unreachable incl. the theme editor; no Play/App Store publish pipeline; no iOS lane | MOBILE_TRUTH §1.1-1.2, §7 |
| C14 | **Signature-only storefront payment verify** (no capture-status/amount fetch) — authorized-not-captured payments can mark orders paid | MONEY_TRUTH §8 |
| C15 | **Machine-enforced multi-region fabrication** — `globalRegions` 4-region contract + survivability validator locked into CI against the constitution | ARCHITECTURE_TRUTH §1.2, §7.1-7.2 |
| C16 | Queue tenant envelope fails open; per-isolate replay cache; `AUTH_SECRET` monoculture across realms | IDENTITY_TRUTH R4, R9, R13 |
| C17 | Workspace `tsc -b` broken (dangling `packages/typescript/utils` ref; no dist anywhere) — only the turbo path typechecks | CODEBASE_REALITY §1.6 |
| C18 | Subscription platform revenue and app-marketplace 15% fee never enter the canonical ledger | MONEY_TRUTH §4.1 |

---

## 9. Required Actions (discovery-level: what must become true)

**Persistence (before anything else):**
1. The working tree must be committed (`git add -A`, including all archives/untracked migrations/validators) and `stepup/main` merged to `main`; the archive-orphan commit trap must not fire. `MERGE_RUNBOOK.md` must describe the actual merge before anyone follows it.
2. Migrations 162–166 must be tracked so `supabase db push --include-all` from a clean checkout applies them; `migration-safety-validator` must be able to see them.

**Money (the core):**
3. The storefront payment confirm path must write canonical ledger entries; currently `confirm_order_payment_with_ledger` writes none (baseline:1590) — the SQL chain or its TS adapter must post `payment_capture` transactions.
4. All three refund paths must post canonical reversing entries; currently only `POST /payments/:id/refund` does.
5. A real payout provider client (Razorpay Route / Cashfree split) must exist and be wired before any payout release can succeed; today `initiateTransfer` throws unconditionally.
6. `refresh_money_ledger_site_reconciliation` must gain a scheduled runtime caller, and the wallet 409 state must be operator-clearable in-product; today the RPCs have zero callers.
7. `merchant_payable` must converge on a single credit writer per economic event (or cross-writer dedup keyed on the order/payment), and payout gross must derive from the ledger, not `orders.total`.
8. Storefront Razorpay verify must confirm provider capture status/amount (the helper exists at razorpay-adapter:117-130 and is unused on this path).

**Identity/security:**
9. `verifySensitiveActionStepUp` must verify a real challenge (TOTP/passkey/re-auth), and `stepup-crypto-validator` must stop allowlisting the mock.
10. The remaining HS256/`AUTH_SECRET` realms (accounts cookie, console, customer, webhook internal auth, media/export signing) must move to scoped secrets or asymmetric verification.
11. The 25 surviving PUBLIC `USING(true)` policies must be re-scoped (`TO service_role`) or documented as intentionally public; the raw-REST supabase-adapter helpers must be tenant-guarded or deleted; the queue envelope must fail closed.

**Product paths:**
12. Mobile login must spend the Turnstile token exactly once (drop the BFF pre-verify or mint per-verifier tokens); mobile navigation must reach its 34 dead screens or delete them; a store-publish lane (Play upload, iOS) must exist before "mobile launch" is claimed.
13. Liquid must gain header/footer sections, multi-template bundles, commerce drops bound to the catalog, a canary write path, and a merchant install/edit surface — or the Liquid-first roadmap must be formally re-staged; React deletion is NOT-READY by the platform's own deferred-flip record.
14. The merchant-control-plane API surface must collapse into the gateway (one writer per domain) per the canonical-systems registry.

**Operate-ability:**
15. An alert delivery channel must exist (pager/Slack/email) fed by metrics that are actually emitted; the prometheus/otel/grafana/slo theater must be retargeted to Analytics-Engine-backed reality or archived; an error-tracking SDK must exist in code before the DSN seam matters; money-reconciliation-break alerting must be real before live money flows.
16. PITR must be enabled and a restore drill executed with recorded RPO/RTO before real money; the survivability/multi-region validator lock (`survivability-governance-validator.mjs`, `whole-repo-end-state-validator.mjs:172-193`, `production-topology.json:34-39`) must be removed so CI stops mandating rejected architecture.
17. The ~12 DANGEROUS prompts under `docs/` (PROMPT_DRIFT §3.3-3.4), the 38 stale nested `AGENTS.md`, and the `AGENT-R16`→`memory/lessons.md`/`tasks/todo.md` fossil loop must be archived/rewritten so no agent re-executes the rejected architecture.

---

## 10. "What would happen if you launched today from `main`" (≤1 page, brutal)

You push the launch commit to `main`. The pipeline runs credential preflight — with `SKIP_NEEDS_HUMAN_*` placeholders committed in wrangler vars and most provider secrets unprovisioned, the deploy most likely **dies right there** (SKIP-PROVIDER-SECRETS). Suppose ops force-feeds it secrets and it goes out. There is no branch-lag guard at `main` (it's in the uncommitted diff), so nothing notices you just shipped the 2026-06-09 platform.

The Vercel matrix deploys **nine** apps, including the four "frozen" ones — `theme-marketplace`, `app-marketplace`, `developer-portal`, `platform-operations-portal` go to production with live project IDs (`git show main:` matrix; `config/vercel/projects.json:79-137`). The DB migration job applies migrations up to **158**: no RLS leak fix, no `app_tenant` role, no payout release guard, no reconciliation tables, no commission-zero.

A merchant signs up. Login works (web). Their session is an opaque hex token; every request the platform makes on their behalf runs as **service_role** against a database where `orders`, wishlists, subscriptions and ~11 sensitive tables still carry PUBLIC `USING(true)` policies — any holder of the anon key can read other stores' orders (FORENSIC_MASTER's 6 anon leaks; fixed only in untracked 163). Any attacker who knows any verified user's email can call `POST /api/auth/switch` and **become them** — no session, no proof, CSRF only (IDENTITY_TRUTH §2, quoted from `main`). That includes becoming the merchant.

A shopper buys something. Checkout works; Razorpay verify checks the signature but not capture status, and `confirm_order_payment` flips the order to paid with **no ledger entry** — the platform's books for its dominant money path are `payment_transactions` rows and vibes. The merchant is silently charged a **3% commission** (`?? 300` fallbacks live at `main` — the pricing the business plan killed). A refund marks itself succeeded with no ledger trace. COD remittance does two non-atomic writes and credits a wallet ledger nobody reconciles. When the merchant requests a payout, there is **no `claim_payout_statement_release` guard at main** (migration 160 absent) — double-release is a race, the default rail is self-custody `razorpayx`, and whether anything actually transfers depends on pre-D-phase adapter code this audit marks UNVERIFIED at `main`; in the best case it errors, in the worst it records a transfer that never reconciles against anything, because reconciliation tables don't exist at 158.

Their storefront renders through the React engine with a **three-regex sanitizer** between merchant-supplied theme content and shoppers' browsers. The merchant downloads the mobile app: login **fails** — the Turnstile production secret is deliberately unprovisioned and the token is double-spent by design (MOBILE_TRUTH §1.3); the APK on the Play Store, had anyone uploaded one, would be **debug-signed**.

Meanwhile, nobody on the team knows any of this is happening: errors go to `console.error` JSON lines and an Analytics Engine dataset with no dashboard; the seven Prometheus alerts watch metrics nothing emits, routed to runbooks for chaos drills the constitution forbids; there is no Sentry SDK, no pager, no alert channel. The first signal of the breach is a customer tweet. Recovery is one encrypted pg_dump from the deploy run — PITR was never enabled, and the restore drill has only ever run in `plan` mode.

Launching today from `main` is not a degraded launch; it is shipping the exact artifact two forensic audits condemned, minus every fix, with the lights off.

---

## 11. Unknowns / UNVERIFIED

1. **All live infrastructure state** (deployed worker/app versions, applied migrations, DNS, Vercel projects, secret values, whether 162–166 were ever applied out-of-band): no live access; repo self-labels `mode: governance-contract-not-live-evidence`.
2. Whether `main`'s payout adapter at `4bcae19a` fabricates UTRs or fails — MONEY_TRUTH verified the throw at HEAD/worktree only; `main` behavior inferred from migration absence, not read line-by-line.
3. Live Cloudflare Turnstile verdicts (double-spend inference is code-derived; real site keys, not test keys, are pinned).
4. Whether any production store row carries `liquidRenderingCanary: true` (no setter exists in-repo; presumed none).
5. Behavioral test execution for theme-engine/identity suites (esbuild darwin/linux mismatch in audit sandboxes; suites read, not run — D-phase VERIFY rows claim implementer runs).
6. Whether the AE dataset (`letbuyy-production-telemetry`) is provisioned/queried anywhere outside the repo (no dashboard consumer found in-repo).
7. Whether GitHub branch protection/environment approvals exist (SKIP-PROD-DEPLOY-PROMOTION is recorded as pending; not observable from the repo).
8. Whether any out-of-band hotfix already shipped the `/switch` fix to production (IDENTITY_TRUTH flags this explicitly UNVERIFIED).
9. Exact reachability of `verify-health-gates.mjs` live endpoint probes in CI today (script verified on disk; live run results unobservable).
10. Byte-fidelity of archived audit directories without HEAD originals (no prior state to diff).

---

*End of report. Discovery only — no repository file modified except this report.*
