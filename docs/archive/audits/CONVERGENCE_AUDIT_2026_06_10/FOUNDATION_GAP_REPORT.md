# FOUNDATION GAP REPORT — Convergence Audit Phase 7

**Phase:** 7 — Foundation Gap (launch-blocker enumeration)
**Question (verbatim):** *"Ignore feature requests. Ignore future dreams. Ignore Shopify parity. Determine: what blocks production TODAY?"*
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `5cf9e64e` (2026-06-10) · working tree massively dirty (512 D / 410 M / 76 ??). Deploy branch `main` @ `bf8c18c1` is 30 commits behind and is the only push-triggered production deploy path.
**Method:** Read-only. Derived from the 5 mandatory truth reports (`MONEY_TRUTH`, `IDENTITY_TRUTH`, `DATABASE_TRUTH`, `THEME_PARITY`, `MOBILE_TRUTH`) + `PRODUCTION_READINESS_REPORT` + `_PREMISES_SEED.md` + `SKIPPED_HUMAN_DECISIONS.md`, with my own line-level re-verification of the load-bearing claims and direct probes of the least-covered surfaces (observability/monitoring, recovery configs, runbooks, rate limiting, governance self-mandate). Every gap carries a path:line or prior-report citation. No file modified except this report.

> **The three-realities caveat governs everything below.** Per `_PREMISES_SEED.md` and `PRODUCTION_READINESS_REPORT §5`, three versions of this platform exist: `main` (condemned, the only deploy target), `HEAD` (+30, interim), and the **uncommitted working tree** (the hardened end-state, zero git history). Unless a gap is explicitly tagged Class C, the working tree already fixes it — but the fix is one `git clean -fd` from nonexistence and has never deployed. This report scores the **working-tree end-state**, because that is the only version worth launching; the Class A column records what must be committed/merged to make that true, and §"What is NOT a blocker" de-scopes the feature/parity noise.

---

## 1. Executive Summary

**There is no version of this repository that can take a real merchant, a real shopper, and real money today.** The launch-blocking failures cluster into three structurally different classes, and the single most important output of this phase is that **the three classes do not substitute for each other** — committing the working tree (Class A) does not write a payout client (Class C); provisioning secrets (Class B) does not ledger the storefront capture path (Class C). A launch plan that resolves only one class still cannot launch.

1. **The hardened platform is uncommitted (Class A is the gate before every other class matters).** Every security/money/tenancy fix — the `/api/auth/switch` takeover patch, the asymmetric identity topology, migrations 162–166, the COD atomic ledger, DOMPurify, commission-zero, fail-closed Android signing — exists only as an uncommitted dirty tree on a non-deploy branch. The deploy branch (`main`) ships the pre-hardening platform that two prior forensic audits condemned. `git clean -fd` destroys the constitutional layer and all audit programs (zero git history). This is one gap, but it sits in front of all the others.

2. **Even the end-state cannot move money correctly (the Class-C money core).** The storefront payment-confirmation path — the one every shopper hits — terminates in `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`), whose function body contains **zero** canonical-ledger writes (line-verified: 0 `post_ledger_transaction`/`INSERT INTO ledger_entries` inside the function). 2 of 3 refund paths are equally un-ledgered. **No payout provider client exists** — `initiateTransfer` unconditionally throws `PayoutProviderUnavailable` (`payout-transfer-adapter/index.ts:104-105`), so a merchant can never be paid. The merchant wallet **fails closed at HTTP 409 forever** (`wallet.ts:163-176`) because the reconciliation RPCs that would clear it have zero runtime callers. None of this is fixed by any commit or any secret.

3. **Identity and authorization are partly real, partly theater.** The asymmetric issuer covers exactly one token type (merchant session); shopper/console/app/accounts realms remain HS256 over a shared `AUTH_SECRET`. Step-up authorization on refund/payout/DSR-erase is a self-served mock token (`security.ts:123`; `security-controls.ts:27`), and a validator certifies the mock. OIDC is a 501 skeleton. Live identity keys are unprovisioned (`SKIP-D3`) — without them merchant login **fails closed in production** by the seam's own blast-radius statement.

4. **Operate-ability is a stage set.** There is **no alert delivery channel of any kind** end-to-end: `prometheus-rules.yaml` alerts on seven `letbuyy_*`/`http_*` metrics with **zero code emitters** (grep-verified), two of them owned by `services/event-bus` (an empty reserved directory); `otel-collector.yaml` exports to a Kubernetes cluster whose configs were deleted; **no error-tracking SDK exists in any runtime** (zero sentry/otel/pager dependency in any `package.json`/`pubspec.yaml`). PITR is unprovisioned (`SKIP-W0`) and the restore drill has only ever run in `plan` mode against local Postgres — recovery is one encrypted `pg_dump` deep. The first signal of a production breach would be a customer tweet.

5. **CI actively mandates rejected architecture.** Two validators (`whole-repo-end-state-validator.mjs:172`, `survivability-governance-validator.mjs:94`) loop `["india","apac","eu","us"]` and hard-require a 4-region `globalRegions` contract + chaos/failover evidence that the ratified Constitution explicitly forbids. The gate passes today only because it reads an untracked file off the dirty disk; in a clean CI checkout `rls-force-coverage-validator` would **error** (it `readFile`s untracked migration 164).

**Counts:** **11 S0 launch-blockers**, **13 S1**, **9 S2**, **4 S3** (37 ranked gaps). **Class split: A (commit/merge seam) ≈ 4 · B (human-only seam) ≈ 9 · C (genuine missing capability) ≈ 24.** The dominant blocker class is **C** — code that does not exist in any branch — which means the gap to launch is materially larger than "commit and provision."

**Verdict:** After commit + merge + the ~9 launch-blocking human seams, the platform could run a **supervised closed beta of ~100 merchants on online card/UPI payments with manual finance operations** — but only after the storefront capture path is ledgered, refunds are ledgered, a payout client exists, the wallet 409 is operator-clearable, step-up is real, mobile login's token double-spend is fixed, and a money-reconciliation alert channel exists. None of those seven are commit-or-secret fixes.

---

## 2. Method & Severity Definitions

**Severity (launch-blocking lens, not generic quality):**
- **S0 — launch-blocking.** A real merchant + real shopper + real money path is broken, unsafe, or impossible. The platform cannot open to its first paying user until this is closed. (Money cannot flow / cannot reconcile / cannot pay out; identity takeover or login-fails-closed; tenant data leak; no production error visibility for money breaks; the persistence seam that gates all of the above.)
- **S1 — severe, ship-gating for a *credible* beta.** Not strictly fatal on day one with heavy manual mitigation, but a closed beta is negligent without it (un-revocable sessions, signature-only payment verify, no paging, recovery-by-pg_dump-only, mobile login unusable).
- **S2 — important, degrades trust/operability** but tolerable in a badged/manual beta (residual permissive RLS outside the leak set, second backend, dead-code drift, broken workspace build).
- **S3 — cleanup / latent foot-gun**, no near-term launch impact (numbering collisions, dead tables, decorative flags).

**Probability** = likelihood the gap is *hit in production* during a real beta (High/Med/Low), independent of severity. A latent race is Med even if S0; a path every shopper traverses is High.

**Class (mandatory A/B/C):**
- **(A) repo-fixable-but-uncommitted** — the fix exists in the working tree; the only barrier is `git add -A` + commit + the `stepup/main → main` merge. The commit/merge **seam**.
- **(B) human-only seam** — listed in `SKIPPED_HUMAN_DECISIONS.md`; requires a human with provider/DNS/key/secret/console authority. No code change closes it.
- **(C) genuine missing capability** — code that does not exist in any branch (main/HEAD/worktree). **Survives any commit or merge.** No secret fixes it.

Scope = the 12 foundation domains. Live infrastructure was not accessible; all live-state claims are flagged UNVERIFIED (§Unknowns). Where my probe re-verified a prior claim at the line level, it is noted "(line-verified)".

---

## 3. Domain Gap Sections

Each gap: **Severity · Probability · Class** then Business / Merchant / Revenue / Production impact and Evidence.

### 3.1 Identity

**ID-1 · `/api/auth/switch` account takeover live on the deploy branch — S0 · High · Class A**
`main`'s `/api/auth/switch` mints a session for **any** `email_verified` user with no current-session proof, CSRF only (`git show main:.../switch/route.ts`, quoted IDENTITY_TRUTH §2). Fix (valid-session + proven-account guards) is uncommitted working-tree only.
*Business:* total trust collapse — any user becomes any merchant/admin by knowing an email. *Merchant:* their store, money, and PII are seizable. *Revenue:* unbounded fraud + regulatory. *Production:* the deploy branch ships this; merging the working tree closes it.

**ID-2 · Asymmetric identity topology + live keys undeployed/unprovisioned — S0 · High · Class A + Class B**
The ES256/EdDSA sole-issuer topology, JWKS verification, and CI key wiring are working-tree-only (Class A); the **live keypairs/JWKS/OIDC client registrations/Turnstile prod secret** are `SKIP-D3-IDENTITY-LIVE-PROVIDERS` (Class B). The seam's own blast radius: *"merchant login/session issuance will fail in staging or production until matching private/public identity keys… are supplied."*
*Merchant:* cannot log in at all once the new topology deploys without keys. *Production:* fail-closed outage, not a silent bug.

**ID-3 · Step-up authorization is mock theater — S0 · High · Class C**
`/security/step-up/challenges` mints `mock-step-up-${uuid}` pre-verified; `verifySensitiveActionStepUp` only checks token length ≥12 + a 10-min timestamp window (`security.ts:123`; `security-controls.ts:27`). This guards **refund, payout release, and DSR-erase**. `stepup-crypto-validator.mjs` allowlists the mock (certifies it). No real challenge (TOTP/passkey/re-auth) exists in any branch.
*Business:* the strongest authorization control on money-out and data-erase is bypassable by anyone who can call the mock endpoint. *Revenue:* refund/payout abuse. *Production:* survives any merge.

**ID-4 · OIDC / OAuth / passkeys absent — S2 · Med · Class C**
Every `/oauth2/*` + `/.well-known/*` returns `oidcSkeletonResponse` with `implemented:false` (501); published JWKS serves a disabled placeholder key; Google/Apple `/auth/callback` → `oauth_unavailable`; no WebAuthn (IDENTITY_TRUTH §7). Not launch-fatal for password-login beta, but every "social login"/SSO claim is non-functional.

**ID-5 · `AUTH_SECRET` monoculture across realms — S1 · Med · Class C**
The asymmetric re-key covers exactly one token type. The shared symmetric `AUTH_SECRET` still signs the PII-bearing `lb_accounts` cookie (90d), platform-console + customer sessions, and media/export/checkout signing helpers (IDENTITY_TRUTH R4; `cookies.ts`, `console-session.ts`, `media.ts`, `checkout.ts`, `export.ts`). One leak forges across identity and money realms. Rotation is `SKIP-W4` (Class B), but the *single-secret design itself* is Class C.

**ID-6 · Stateless customer/console JWTs are unrevocable — S1 · Med · Class C**
Shopper (`lb_customer_session`, 7d) and console (8h) sessions are stateless JWTs with no server row and no revocation list (IDENTITY_TRUTH §3). A stolen shopper/staff token is valid until expiry; logout cannot kill it.

### 3.2 Security

**SEC-1 · Tenant Proxy guard bypassable via raw-REST adapter — S1 · Med · Class C**
The runtime tenant guard is a pattern-based `Proxy`; registered tables accessed through `supabase-adapter` raw-REST helpers (`selectSupabaseRows`/`patchSupabaseRows`/`supabaseServiceHeaders`, `index.ts:65-150`) **bypass it entirely** with the service-role key over `fetch` (IDENTITY_TRUTH R5). 664 `getSupabaseAdmin()` sites rely on the guard; the raw helpers are an unguarded hole in it.

**SEC-2 · Signature-only storefront payment verify — S1 · High · Class C**
`razorpay-adapter.verify()` checks the signature but never fetches capture status/amount (`razorpay-adapter:323-358`; helper exists unused at `:117-130`). An authorized-not-captured payment can flip an order to `paid` (MONEY_TRUTH §8). Mitigated by server-side order binding but not eliminated. The subscription path does it right; the storefront path does not.

**SEC-3 · Queue tenant envelope fails open — S2 · Med · Class C**
`queue-tenant-envelope.ts:38-40` returns the body **unsigned** when `siteId` is missing or the secret is a placeholder. Envelope integrity is best-effort, not enforced at sign time (IDENTITY_TRUTH R9).

**SEC-4 · Per-isolate replay-JTI cache — S2 · Low · Class C**
Internal-auth replay protection is an in-memory `Map` per Cloudflare isolate (`internal-auth.ts:45`) — not globally consistent; a replayed internal JWT can land on a different isolate (IDENTITY_TRUTH R13).

**SEC-5 · JS-readable CSRF + parent-domain SSO cookie — S2 · Low · Class C**
`letbuyy_csrf` is `httpOnly:false` by design and `lb_session` is parent-domain (SSO). One XSS on any platform app reads CSRF and rides the shared cookie across all apps (IDENTITY_TRUTH R12).

**SEC-6 · mTLS / Cloudflare Access perimeter not enforced — S2 · Med · Class B**
Internal routes fail closed behind repo credentials, but the live Access/mTLS perimeter is `SKIP-W4-MTLS-CF-ACCESS`. Defense-in-depth deferred; acceptable behind the existing fail-closed perimeter but unproven.

### 3.3 Payments

**PAY-1 · Storefront capture path writes no ledger entries — S0 · High · Class C**
The dominant shopper money path (public Razorpay verify + all 4 provider webhooks) ends in `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`) — **function body has 0 canonical-ledger writes** (line-verified via function-body extraction; 0 `post_ledger_transaction`/`INSERT INTO ledger_entries`). The `_with_ledger` suffix is naming theater; canonical capture exists only on the V1 `/payments` surface. Every real sale is `payment_transactions` rows and vibes.
*Business:* the platform's books for its primary money path do not exist. *Merchant:* their revenue isn't in the canonical ledger, so payout gross and wallet are unreliable. *Revenue:* reconciliation is impossible; disputes unresolvable. *Production:* survives any merge — this is the #1 code gap.

**PAY-2 · No payout provider client — merchants can never be paid — S0 · High · Class C**
`initiateTransfer` throws `PayoutProviderUnavailable` whenever `options.provider` is absent (`payout-transfer-adapter/index.ts:104-105`, line-verified), and no `PayoutProviderClient` implementation exists or is wired in any branch. The DB claim guard (`claim_payout_statement_release`, 160) is sound, but everything past it is fail-closed dead code.
*Merchant:* the core promise — "sell, get paid" — is unfulfillable. *Revenue:* no GMV ever settles to a merchant bank account through code. *Production:* fail-closed (safe) but absolute.

**PAY-3 · Reconciliation wiring-dead → wallet 409s forever — S0 · High · Class C**
`refresh/assert_money_ledger_site_reconciliation` + `backfill_wallet_ledger_to_canonical` (160:198-355) have **zero runtime callers**; nothing schedules them. `wallet.ts:163-176` fails closed at 409 `LEDGER_RECONCILIATION_REQUIRED` unless a verified zero-variance row exists (line-verified). So the merchant wallet read is **permanently unavailable** until an operator manually runs a backfill — and there is no in-product operator action to do so.
*Merchant:* cannot see their balance, ever, out of the box. *Production:* combined with PAY-1 (un-ledgered captures don't credit `merchant_payable`), the 409 is the *default* state for real stores.

**PAY-4 · Refunds split-brained (2 of 3 paths un-ledgered) — S0 · Med · Class C**
`complete_order_refund` (orders path, `baseline:1039-1208`) and the webhook `refund.created` path mark refunds succeeded with **no canonical ledger entry**; only `POST /payments/:id/refund` is canonical (MONEY_TRUTH §2b). Refund money state diverges from the ledger on the paths merchants actually use.

**PAY-5 · `merchant_payable` triple-writer, no cross-source dedup — S1 · Med · Class C**
Three independent credit writers (capture posting, commission reconcile, settlement ingest) are each idempotent only within their own `source_type/source_id`; nothing prevents the same paid order being credited twice via two writers, and payout gross is computed from a fourth ledger-independent number (`orders.total`) (MONEY_TRUTH §1.5). Double-credit is *legal* under current keys.

**PAY-6 · Commission defaults to 3% on every committed branch — S1 · High · Class A**
`main` and `HEAD` default `commission_bps` to 300 (DB `119:81/108` + code `?? 300` fallbacks). Zero-commission (the killed pricing) lives only in untracked migration 162 + working-tree code (MONEY_TRUTH §6). Deploying from any committed ref silently rakes 3% — the exact pricing the business plan condemned.

**PAY-7 · Subscription + app-marketplace revenue never enter the ledger — S2 · Med · Class C**
Merchant subscription platform revenue and the app-marketplace 15% fee never post to the canonical ledger (MONEY_TRUTH §4.1; `billing-core:458-459`). Platform's own revenue is off-book.

### 3.4 Ledger

**LED-1 · Canonical ledger fixes (160/165) untracked — S0 · High · Class A**
Migration 160 (reconciliation tables, `claim_payout_statement_release` balance gate, capture/refund ledger columns) and 165 (settlement source-row ownership, ledger UPDATE/DELETE revoke) are untracked. `main` ends at 158 — **no payout double-release guard, no reconciliation tables** on the deploy branch (DATABASE_TRUTH §3; MONEY_TRUTH §11).
*Production:* a clean checkout `supabase db push` from HEAD silently omits 162-166; the kernel ships without its authority layer.

**LED-2 · Settlement writer trusted caller-supplied `site_id` (cross-tenant posting) on HEAD — S1 · Med · Class A**
At HEAD, `post_settlement_ledger_transaction` (151:23) sets the tenant GUC from caller-supplied `p_site_id` — a cross-tenant posting surface. The fix (derive ownership from the source row, reject mismatch) is untracked migration 165 only (MONEY_TRUTH §2a). One commit away from existing.

**LED-3 · `162` rewrites historical commission rows in place — S2 · Low · Class A/C**
`162_phase_a_commission_zero` issues bare `UPDATE … SET commission_bps=0, net_payable_minor=gross_amount_minor` on settled historical rows with no ledger/audit entry (DATABASE_TRUTH §7.1) — an append-only-ledger system silently mutating financial history. A governance contradiction baked into the migration itself.

**LED-4 · Ledger immutability relies on triggers only until 165 — S2 · Low · Class A**
UPDATE/DELETE `REVOKE` from `service_role` exists only in untracked 165:463-464; HEAD relies on append-only triggers alone, which a superuser/owner could drop (MONEY_TRUTH §3). Hardened only in the uncommitted tree.

### 3.5 Settlement

**SET-1 · Settlement amounts are caller-declared, no provider feed — S1 · Med · Class C**
`POST /settlements/ingest` takes gross/fee/gst/net/reserve from the request body (`settlements.ts:185`); there is **no provider statement ingestion** to reconcile against (MONEY_TRUTH §5). Settlement truth is self-declared; live split-rail credentials are `SKIP-D5` (Class B), but the absence of a provider-feed reconciler is Class C.

**SET-2 · Settlement breaks skip posting with no auto-remediation — S2 · Med · Class C**
A non-zero `recon_break_minor` opens a `recon_breaks` row and **skips** the ledger posting (`settlements.ts:265-280`); nothing plugs or escalates it. Money silently stalls in suspense with no operator surface (correct fail-loud, but no remediation path).

**SET-3 · Scheduled `payouts` instruction rows never executed — S2 · Low · Class C**
Settlement ingest schedules `payouts` rows with `status='scheduled'` that **no executor consumes** (MONEY_TRUTH §4.4). A second, parallel payout object model that goes nowhere — compounds PAY-2.

### 3.6 Checkout

**CHK-1 · Live checkout cutover unprovisioned — S1 · High · Class B**
`SKIP-D6`: `checkout.letbuyy.com` DNS + Vercel host attach + `CHECKOUT_SIGNING_SECRET` + migration 166 apply + carrier creds. Without it *"production checkout URLs fail closed."* The reserve→commit inventory code (166) hard-depends on the untracked migration — deploying code without it = checkout outage.

**CHK-2 · Checkout digest binding + inventory authority (166) untracked — S1 · Med · Class A**
The cart-content HMAC digest binding (anti-tamper) and `create_order_with_inventory_reservations` reserve→commit authority (166:8-66) are working-tree only (MONEY_TRUTH §9; CHECKOUT scoring). On `main`: a tampered cart survives the handoff and there is no reserve→commit (oversell window).

**CHK-3 · Checkout confirm inherits PAY-1 (un-ledgered) + SEC-2 (sig-only) — S0/S1 · High · Class C**
The checkout success path converges on the same no-ledger `confirm_order_payment_with_ledger` and the same signature-only verify. Cross-listed; the checkout domain does not add a *new* code gap but inherits the two money S0/S1s on the path shoppers traverse.

### 3.7 Themes

**THM-1 · Liquid renderer unsalvageable for real stores while constitution mandates Liquid-first — S1 · High (if React deleted) · Class C**
The ratified winner (Liquid) cannot run a real store: **no header/footer sections** (Liquid plan hard-codes empty groups → a canaried store renders no nav/cart/search/account, `template-resolver.ts:213-216`); only an `index` template (product/cart routes render the homepage); first-party commerce sections render hard-coded strings, not the catalog; cart/customer drops are stubs; head/SEO output is discarded at runtime; **no write path for the canary** (no API/UI/SQL); no editor (web or Flutter) has Liquid awareness (THEME_PARITY §9-10). React deletion-readiness: **NOT-READY** by the platform's own deferred-flip record. *This is not a launch blocker for the React storefront (which works) — it is a blocker for the ratified roadmap.* De-scoped from S0 because React serves every store fine today.

**THM-2 · Weak regex theme sanitizer on the deploy branch — S1 · Med · Class A**
`main`/HEAD ship the 3-regex sanitizer with no auto-escape between merchant-controlled theme HTML and shoppers' browsers (`HEAD:theme-renderer.ts:606-610`). DOMPurify + LiquidJS auto-escape exist only in the working tree (THEME_PARITY §6). XSS exposure on every storefront until D7 commits.

**THM-3 · 5 of 24 built-in section types render a fallback box — S2 · Med · Class C**
`announcementBar`, `collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero` have no React renderer; the **default** Urban Kicks template ships an `announcementBar`, so default stores render a placeholder there (THEME_PARITY §2.3). Visible defect on day one for default themes.

### 3.8 Storefront

**STF-1 · Storefront cookie `secure` gated on `NODE_ENV==='production'` only — S2 · Low · Class C**
`lb_customer_session` sets `secure` from `process.env.NODE_ENV === 'production'` (`storefront/session.ts:61`), narrower than the platform cookies' hard `secure:true`. A non-`production` NODE_ENV deploy ships the shopper cookie without Secure (IDENTITY_TRUTH R11).

**STF-2 · Public storefront tenant context grants `checkout:create` by `siteId` alone — S2 · Low · Class C**
`createPublicStorefrontTenantContext` builds a context with `userId:null` from a `siteId` with no ownership check (`tenant-context.ts:260`) — correct for public reads but the `checkout:create` grant is scoped only by `siteId`. Low risk, noted.

**STF-3 · Portfolio/resume residue still routed — S3 · Low · Class A**
`/portfolio` and `/resume` are still mounted (`index.ts:738-739`) and `portfolio.ts` is BFF-allowlisted; product-dead personal-site subsystem wired into the live gateway (DATABASE_TRUTH §6; MOBILE_TRUTH §5). Cleanup.

### 3.9 Mobile

**MOB-1 · Production login broken by Turnstile token double-spend — S0 · High · Class C**
The app pre-verifies the single-use Turnstile token at the BFF (`store_auth_service.dart:379` → BFF siteverify consumes it, `mobile-bff/index.ts:140-151`), then submits the **same** token to identity login, which re-verifies and gets `timeout-or-duplicate` (MOBILE_TRUTH §1.3). The second check fails closed → login fails. This is a **code bug**, not the secret seam. The Turnstile prod secret (`SKIP-W7`, Class B) is a *second* independent failure mode on the same path.
*Merchant:* cannot log into the mobile app in production at all.

**MOB-2 · 34 of 64 screens unreachable, incl. the theme editor — S1 · High · Class C**
34 screens have no inbound navigation, including the 631-line `ThemeScreen` + 1,200-line `SectionEditorScreen` (the app's historically strongest surface), KYC, 2FA, returns, inventory, coupons, staff, billing (MOBILE_TRUTH §3). All 36 `/features/*` routes exist only to satisfy validators; nothing navigates to them. "Mobile parity" is a route table the nav graph does not deliver.

**MOB-3 · No store-publish pipeline (no Play upload, no iOS lane) — S1 · Med · Class A/B**
The Android release lane (`mobile-merchant-release.yml`, untracked, Class A) builds a signed AAB as a CI artifact only — **no Play upload step, no iOS job, no fastlane/store metadata** (Class C for the missing pipeline). Signing keystores/Play creds are `SKIP-D8` (Class B). HEAD ships debug-signed releases. No "mobile launch" is possible until a publish lane exists *and* is provisioned.

**MOB-4 · Dead deep-link router + 161 MB build cache at repo root — S3 · Low · Class A**
`AppDeepLinkRouter` (GoRouter) is never mounted; `go_router` is a dependency for dead code; AndroidManifest has no intent filters (MOBILE_TRUTH §4). Root `build/` is 161 MB (gitignored, machine-local). Cleanup.

### 3.10 Infrastructure / Observability

**OBS-1 · No alerting end-to-end (the launch-critical operability gap) — S0 · High · Class C**
`prometheus-rules.yaml` defines 7 alerts on `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds`, `letbuyy_event_store_integrity_failures`, `letbuyy_slo_remaining_error_budget_percent`, `letbuyy_deployment_health_gate_failed_total`, `letbuyy_regional_routing_override_active`, `http_server_errors_total{runtime="api-gateway"}` — **with zero code emitters** (grep across services/packages/apps/scripts: no hits). Two alerts are owned by `services/event-bus`, an empty reserved directory. `otel-collector.yaml` exports to `*.letbuyy-observability.svc.cluster.local` (deleted k8s). **No error-tracking SDK in any runtime** (zero sentry/otel/pager dependency in any `package.json`/`pubspec.yaml`). There is **no alert delivery channel** (no PagerDuty/Opsgenie/Slack/webhook). The Sentry DSN seam (`SKIP-W3`, Class B) is moot: provisioning a DSN does nothing because no SDK consumes it (Class C).
*Production:* a money-reconciliation break, payment failure, or breach produces no signal. The first notification is a customer report. **This is a launch blocker for any platform moving money.**

**OBS-2 · Money-reconciliation-break alerting exists only as a preflight flag name — S0 · High · Class C**
`production-safety-preflight.json:23-26` names `MONEY_LEDGER_RECONCILIATION_ALERT_READY` as a precondition, but the underlying capability (a reconciliation job emitting a metric to an alert channel) does not exist — there is no scheduled reconciliation caller (PAY-3) and no alert channel (OBS-1). The one alert a commerce platform cannot launch without is a string in a config file.

**OBS-3 · Observability config points at nonexistent infrastructure — S2 · Med · Class A/C**
6 Grafana dashboard JSONs with no Grafana/datasource; `slo-catalog.yaml` assigns SLOs to `services/checkout-runtime` and `services/event-bus` (empty reserved roots). The configs should be retargeted to the real Analytics Engine dataset or archived; the *capability* they imply is missing (Class C).

**OBS-4 · CI mandates rejected 4-region + chaos/failover architecture — S1 · High · Class A**
`whole-repo-end-state-validator.mjs:172` and `survivability-governance-validator.mjs:94` both loop `["india","apac","eu","us"]` and hard-require `production-topology.json` `globalRegions` (line 34-38) + `chaos/run-chaos-evidence.mjs` + `failover` evidence + `multi-region-runtime.json` — architecture the ratified Constitution **forbids** (ARCHITECTURE_TRUTH §1.2). CI machine-enforces the loser. Repo-fixable (remove the validator locks) but a self-inflicted gate.

**OBS-5 · Rate limiting is the one genuinely-real operability primitive — (not a gap; noted)**
`middleware/rateLimit.ts` is Upstash-Redis-first with KV fallback and **fail-closed** (`allowed:false` on unavailable, lines 226/240/275/341, line-verified). Health endpoints + 2%-sampled telemetry into a Cloudflare Analytics Engine dataset are real. This is the floor the rest of observability fails to reach.

### 3.11 Governance

**GOV-1 · Entire hardened platform uncommitted; `git clean -fd` destroys it — S0 · High · Class A**
512 D / 410 M / 76 ?? paths; every `EXECUTION_LEDGER.md` row says "not committed." The constitutional layer, both archives, the ledger, and 7 audit programs have **zero git history** — one `git clean -fd` from nonexistence; `git commit -am` (tracked-only) would orphan the untracked archives (GOVERNANCE_TRUTH §4.4). This is the persistence seam that gates every Class-A fix above.

**GOV-2 · `stepup/main → main` merge is a gated human seam against a stale runbook — S0 · High · Class A/B**
`SKIP-D1`: nothing reaches production until a privileged clean-tree merge happens, and `MERGE_RUNBOOK.md` describes a merge of branches that no longer exist (GOVERNANCE_TRUTH §6.1). `main` is the only push-triggered deploy path.

**GOV-3 · Validators pass only because they read untracked files off the dirty disk — S1 · High · Class A**
`rls-force-coverage-validator` `readFile`s untracked `164_d4_tenant_role_guc.sql` (DATABASE_TRUTH §9) — passes on this machine, **errors in a clean CI checkout** where the file is absent. `migration-safety-validator` scans `getTrackedFiles()` only, so it is structurally blind to the highest-risk untracked migrations 162-166. The gate is green for the wrong reason.

**GOV-4 · GATE-1 ratification + ops-survivor ARB unsigned — S2 · Low · Class B**
`SKIP-GATE1-ARB-RATIFICATION` + `SKIP-GATE-OPS-SURVIVOR-ARB`: the Constitution self-declares a ratification that never happened (`LETBUYY_CONSTITUTION.md:5-8`). Governance formality; deferrable but the law is "not in force" until signed.

**GOV-5 · ~12 DANGEROUS live prompts + 38 stale nested AGENTS.md re-teach rejected architecture — S2 · Med · Class A**
Per PROMPT_DRIFT §3.3-3.4 and `_PREMISES_SEED.md`: dangerous agent prompts under `docs/` and 38 stale scan-generated nested `AGENTS.md` can cause an agent to re-execute the multi-region/CQRS architecture the canon rejects. Repo-fixable (archive/rewrite).

### 3.12 Database

**DB-1 · Migrations 162-166 untracked → silent omission on clean deploy — S0 · High · Class A**
A CI checkout of HEAD pushes only 000-161; the four CRITICAL fixes (commission-zero, live-data-leak RLS, app_tenant GUC, canonical money) + checkout authority (166) **silently do not deploy** (DATABASE_TRUTH §8). Cross-listed with LED-1/GOV-1; called out here because the *database* is where the omission bites hardest.

**DB-2 · 25 PUBLIC `USING(true)`/`WITH CHECK(true)` policies survive outside the validator allowlist — S1 · Med · Class C**
Static final-state replay finds 25 permissive policies outside the 12-table allowlist — including `service_role_*`-**named-but-PUBLIC** policies (omit `TO service_role`) on `gift_cards`, `pages`, `collections`, `onboarding_attempts`, `ai_usage`, `auth_password_set_intents` — the exact `163` bug class, never fixed for these (DATABASE_TRUTH §5). No validator blocks them. Runtime anon-reachability is UNVERIFIED (needs live grants) but the policy shape is a latent tenant/PII leak.

**DB-3 · Anon RLS leak class open on the deploy branch — S0 · High · Class A**
At `main` (migrations end at 158), 163 (closes PUBLIC `USING(true)` on 11 sensitive tables) and 164 (`app_tenant` FORCE) **do not exist**; the forensic anon-leak class (orders/wishlists/subscriptions readable by any anon-key holder) is **live** (DATABASE_TRUTH §3). Fixed only in untracked 163/164.

**DB-4 · No `DROP TABLE` ever → dead product-era tables accumulate forever — S3 · Low · Class B/C**
Strictly additive chain; `portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`, `gift_card_accounts` persist with near-zero refs (DATABASE_TRUTH §6). Drop deferred to live writer probe (`SKIP-D11`, Class B). Schema-complexity foot-gun, not a launch blocker.

**DB-5 · `129` numbering collision + duplicate `provider_payment_id` index + 68 unrollback-able migrations — S3 · Low · Class A/B**
Two `129_*` files; `107` and `142` create functionally identical unique indexes on `payment_transactions(gateway, provider_payment_id)` (DATABASE_TRUTH §6, drop deferred `SKIP-D11`, Class B); 68 additive migrations (073-138,140,157) have no rollback by `forward-fix-preferred` policy (DATABASE_TRUTH §8). Latent foot-guns.

---

## 4. MASTER RANKED GAP TABLE

All 37 gaps, severity-ordered. S0 launch-blockers first; within a tier, ordered by Class-C-first (genuine-missing-capability outranks commit-seam because it survives the merge) then by probability/blast radius.

| Rank | Gap | Domain | Sev | Class | Prob | Merchant / Revenue impact | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Storefront capture path writes no ledger entries | Payments | S0 | C | High | Primary revenue path off-book; payout/wallet unreliable | `000_baseline.sql:1590` (fn body 0 ledger writes, line-verified); MONEY_TRUTH §2a |
| 2 | No payout provider client (`initiateTransfer` throws) | Payments | S0 | C | High | Merchant can never be paid; no GMV settles | `payout-transfer-adapter/index.ts:104-105` (line-verified) |
| 3 | Reconciliation wiring-dead → wallet 409s forever | Payments/Ledger | S0 | C | High | Merchant can't see balance out of the box | `wallet.ts:163-176` (line-verified); MONEY_TRUTH §1.9 |
| 4 | Step-up authorization is mock theater (refund/payout/DSR) | Identity | S0 | C | High | Money-out + data-erase auth bypassable | `security.ts:123`; `security-controls.ts:27` |
| 5 | Mobile production login broken (Turnstile double-spend) | Mobile | S0 | C | High | Cannot log into mobile app in prod | `store_auth_service.dart:379`; `mobile-bff/index.ts:140-151`; MOBILE_TRUTH §1.3 |
| 6 | No alerting end-to-end (no emitters, no SDK, no channel) | Infra/Obs | S0 | C | High | Money breaks/breaches produce no signal | `prometheus-rules.yaml` vs 0 emitters (grep-verified); no SDK in any manifest |
| 7 | Money-reconciliation-break alerting is a config flag name only | Infra/Obs | S0 | C | High | The one alert money cannot launch without is absent | `production-safety-preflight.json:23-26` + OBS-1 |
| 8 | Refunds split-brained (2 of 3 paths un-ledgered) | Payments | S0 | C | Med | Refund money state diverges from books | `baseline:1039-1208`; MONEY_TRUTH §2b |
| 9 | `/api/auth/switch` account takeover live on `main` | Identity/Security | S0 | A | High | Any user becomes any merchant/admin | `git show main:.../switch/route.ts`; IDENTITY_TRUTH §2 |
| 10 | Anon RLS leak class open on deploy branch (163/164 absent) | Database | S0 | A | High | Other stores' orders readable by anon-key holder | DATABASE_TRUTH §3 |
| 11 | Migrations 162-166 untracked → silent omission on clean deploy | Database/Ledger | S0 | A | High | Money/RLS/checkout fixes don't deploy | DATABASE_TRUTH §8; MONEY_TRUTH §11 |
| 12 | Entire hardened platform uncommitted (`git clean -fd` destroys) | Governance | S0 | A | High | The fix for ranks 9-11 is one command from gone | `EXECUTION_LEDGER.md` (all rows); GOVERNANCE_TRUTH §4.4 |
| 13 | `stepup/main → main` merge is a gated seam vs stale runbook | Governance | S0 | A/B | High | Nothing reaches prod until privileged merge | `SKIP-D1`; GOVERNANCE_TRUTH §6.1 |
| 14 | Identity asymmetric topology + live keys undeployed/unprovisioned | Identity | S0 | A/B | High | Merchant login fails closed once new topology deploys w/o keys | IDENTITY_TRUTH R2; `SKIP-D3` |
| 15 | Signature-only storefront payment verify (no capture-status fetch) | Security/Payments | S1 | C | High | Authorized-not-captured marks order paid | `razorpay-adapter:323-358`; MONEY_TRUTH §8 |
| 16 | `merchant_payable` triple-writer, no cross-source dedup | Payments | S1 | C | Med | Same order can be credited twice | MONEY_TRUTH §1.5 |
| 17 | Settlement amounts caller-declared, no provider-feed reconciler | Settlement | S1 | C | Med | Settlement truth self-declared, undetectable drift | `settlements.ts:185`; MONEY_TRUTH §5 |
| 18 | Tenant Proxy guard bypassable via raw-REST adapter | Security | S1 | C | Med | Unguarded service-role on registered tables | `supabase-adapter/index.ts:65-150`; IDENTITY_TRUTH R5 |
| 19 | `AUTH_SECRET` monoculture across realms | Identity/Security | S1 | C | Med | One leak forges identity + money | IDENTITY_TRUTH R4 |
| 20 | Stateless customer/console JWTs unrevocable | Identity | S1 | C | Med | Stolen shopper/staff token valid until expiry | IDENTITY_TRUTH §3 |
| 21 | Mobile: 34/64 screens unreachable incl. theme editor | Mobile | S1 | C | High | Half the app (incl. KYC/2FA/returns) invisible | MOBILE_TRUTH §3 |
| 22 | Liquid unsalvageable for real stores vs Liquid-first mandate | Themes | S1 | C | High* | React deletion NOT-READY; roadmap blocked | THEME_PARITY §9-10 (*if React deleted) |
| 23 | Commission defaults 3% on every committed branch | Payments | S1 | A | High | Silent 3% rake (killed pricing) on deploy | MONEY_TRUTH §6 |
| 24 | Canonical ledger authority (160/165) untracked | Ledger | S1 | A | High | Kernel ships w/o payout guard + reconciliation | DATABASE_TRUTH §3; MONEY_TRUTH §11 |
| 25 | Weak regex theme sanitizer on deploy branch | Themes/Security | S1 | A | Med | XSS on every storefront until D7 commits | `HEAD:theme-renderer.ts:606-610` |
| 26 | Checkout digest binding + inventory authority (166) untracked | Checkout | S1 | A | Med | Tampered cart survives; oversell window on `main` | MONEY_TRUTH §9 |
| 27 | Live checkout cutover unprovisioned (DNS/secret/166) | Checkout | S1 | B | High | Production checkout URLs fail closed | `SKIP-D6` |
| 28 | No mobile store-publish pipeline (no Play/iOS lane) | Mobile | S1 | A/B/C | Med | No "mobile launch" possible | MOBILE_TRUTH §7; `SKIP-D8` |
| 29 | Settlement-writer caller-supplied `site_id` on HEAD (cross-tenant) | Ledger | S1 | A | Med | Cross-tenant posting surface until 165 | `151:23`; MONEY_TRUTH §2a |
| 30 | Validators pass only by reading untracked files off disk | Governance | S1 | A | High | Gate errors in clean CI; green for wrong reason | DATABASE_TRUTH §9 |
| 31 | CI mandates rejected 4-region + chaos/failover architecture | Infra/Gov | S1 | A | High | CI enforces the loser; constitution conflict | `whole-repo-end-state-validator.mjs:172`; `survivability-governance-validator.mjs:94` (line-verified) |
| 32 | PITR unprovisioned + restore drill plan-only | Infra/Ops | S1 | B | Med | Recovery is one pg_dump deep | `database-recovery-policy.json`; `SKIP-W0` |
| 33 | 25 residual PUBLIC `USING(true)` policies outside allowlist | Database | S1 | C | Med | Latent anon/PII leak (gift_cards/pages/collections) | DATABASE_TRUTH §5 |
| 34 | Subscription + app-marketplace revenue off-book | Payments | S2 | C | Med | Platform's own revenue not in ledger | MONEY_TRUTH §4.1 |
| 35 | Merchant-control-plane second backend (62 routes) | Architecture/DB | S2 | C | Med | Two writers per domain; drift risk | CODEBASE_REALITY §1.9 (62 route files verified) |
| 36 | OIDC/OAuth/passkeys absent (501 skeleton) | Identity | S2 | C | Med | All social-login/SSO claims non-functional | IDENTITY_TRUTH §7 |
| 37 | Cleanup cluster (dead tables, 129 collision, dup index, deep-link router, portfolio routes, obs theater, prompt drift) | Multi | S2/S3 | A/B/C | Low | Foot-guns, schema bloat, agent re-teach | DATABASE_TRUTH §6,8; MOBILE_TRUTH §4; PROMPT_DRIFT §3.3 |

*Rows 15-20 (the S1 Class-C money/identity hardening) and the S2/S3 cluster (rows 34-37) collapse several same-class gaps for the ranked view; the per-domain sections above enumerate each individually (SEC-3/4/5, PAY-7, SET-2/3, THM-3, STF-1/2, GOV-4/5, DB-4/5).*

---

## 5. S0 Launch-Blocker Shortlist with A/B/C Split

**11 distinct S0 launch-blockers.** Grouped by class to make the planning truth explicit: **resolving one class does not resolve the others.**

### Class A — repo-fixable but uncommitted (the commit/merge seam) — 5 of the S0s
These vanish the moment the working tree is committed and `stepup/main` merges to `main` (and the archive-orphan trap is avoided). They are *one privileged action* away.
- **#9** `/api/auth/switch` takeover (fix is in the working tree).
- **#10** Anon RLS leak class (163/164 fix the tables).
- **#11 / #12** Migrations 162-166 untracked + the whole tree uncommitted (`git clean -fd` destruction risk).
- **#13** The `stepup/main → main` merge itself (also has a Class-B human-approval component, `SKIP-D1`).

### Class B — human-only seams (no code change closes them) — overlaps #13, #14
Launch-blocking subset of `SKIPPED_HUMAN_DECISIONS.md` (~9 of ~22 seams are launch-blocking):
- **SKIP-D1** merge (privileged clean-tree merge) · **SKIP-D3** identity live keys/JWKS/OIDC/Turnstile (without them merchant login **fails closed**) · **SKIP-PROVIDER-SECRETS** (prod wrangler vars hold `SKIP_NEEDS_HUMAN_*` placeholders today, `wrangler.toml:255-267`) · **SKIP-PROD-DNS-CUTOVER** + **SKIP-W3-DNS-CUTOVER** (`.com` may not resolve) · **SKIP-D6** checkout cutover (prod checkout URLs fail closed) · **SKIP-PROD-DEPLOY-PROMOTION** (branch protection; else the next push to `main` is the deploy) · **SKIP-D2 + SKIP-D4** live RLS/grant/FORCE probes (cannot prove the leak class is closed live) · **SKIP-D5** live money reconciliation + split-rail credentials (wallet stays 409 until zero-variance evidence) · **SKIP-W0-PITR** (running money on pg_dump-only recovery).
- *Deferrable (badged/fail-closed):* `SKIP-GATE1-ARB-RATIFICATION`, `SKIP-GATE-OPS-SURVIVOR-ARB`, `SKIP-D8`/`SKIP-W7` mobile signing/Turnstile, `SKIP-D10`/`SKIP-W7` WhatsApp, `SKIP-W4` rotation + mTLS, `SKIP-D11` cleanup probes.

### Class C — genuine missing capability (survives any merge AND any secret) — 6 of the S0s, the dominant blocker class
**No commit and no secret closes these. They are net-new code.**
- **#1** Storefront capture path must post canonical `payment_capture` ledger entries (the SQL chain or its TS adapter writes none today).
- **#2** A real payout provider client (Razorpay Route / Cashfree split) must exist and be wired before any payout can move money.
- **#3** A scheduled reconciliation caller must exist and the wallet 409 must be operator-clearable in-product.
- **#4** `verifySensitiveActionStepUp` must verify a real TOTP/passkey/re-auth challenge (and the validator must stop allowlisting the mock).
- **#5** Mobile login must spend the Turnstile token exactly once (drop BFF pre-verify or mint per-verifier tokens).
- **#6 / #7** An alert delivery channel (pager/Slack/email) fed by **emitted** metrics + an error-tracking SDK must exist; money-reconciliation-break alerting must be real before live money flows.
- *(plus S0 #8, refunds: all three refund paths must post canonical reversing entries.)*

**The shape of the launch gap:** Class A is *one merge*. Class B is *~9 provisioning actions*. **Class C is ~6 genuine engineering builds on the money/identity/operability core** — and these are the long pole. A team that commits + merges + provisions still has a platform that cannot ledger a sale, pay a merchant, show a wallet balance, enforce step-up, log a merchant into mobile, or alert on a money break.

---

## 6. What is NOT a Blocker (explicit de-scope)

Per the user's framing — *ignore feature requests, future dreams, Shopify parity* — the following are explicitly **not** launch blockers and must not be conflated with the gaps above:

- **Liquid-first theme migration.** The React/JSON storefront **works and serves every store today** (20 frozen sections, header/footer chrome, live catalog binding, ISR). Liquid's ~10 capability gaps (THM-1) block the *ratified roadmap*, not the launch. De-scoped to S1-roadmap, not S0. (React deletion is a future dream; keeping React is the working reality.)
- **OIDC / OAuth / passkeys / WebAuthn** (ID-4). Password login + TOTP MFA is real and sufficient for a closed beta. Social login is a feature, not a blocker.
- **Shopify feature parity** generally — multi-template Liquid bundles, app embeds, masonry layouts, motion variants, asset pipeline, snippets/partials — all roadmap, none launch-gating.
- **WhatsApp live sends** (`SKIP-D10`/`SKIP-W7`) — sandbox-badged sends are acceptable for beta; this is a notification-channel feature.
- **Multi-region / chaos / failover / survivability suite.** Not only not-a-blocker — it is **rejected architecture** the CI wrongly mandates (OBS-4). The blocker is the *validator lock*, not the absence of multi-region.
- **The 36 `/features/*` mobile routes and the second theme editor** — these are dead code to delete, not features to finish; their absence from navigation is correct, their *existence* is the drift.
- **App-marketplace / developer-portal / theme-marketplace apps** — frozen, not production deploy targets; their staleness is governance cleanup, not a launch gap.
- **iOS app** — the merchant beta can be Android + web; iOS is a future lane (MOB-3 notes its absence but does not gate an Android/web beta).
- **Subscription/app-marketplace revenue ledgering** (PAY-7) — platform-side accounting; can be reconciled manually in a 100-merchant beta. S2, not S0.

---

## 7. Unknowns / UNVERIFIED

1. **All live infrastructure state** — deployed worker/app versions, which migrations are actually applied to production Supabase, live DNS, Vercel projects, secret values, whether 162-166 were applied out-of-band. No live access; repo self-labels `mode: governance-contract-not-live-evidence`.
2. **Whether the `/switch` fix or any hardening already shipped to production out-of-band** — IDENTITY_TRUTH flags this explicitly UNVERIFIED. The deployable-branch inference is the most defensible, not a certainty.
3. **Runtime anon-reachability of the 25 residual PUBLIC `service_role_*` policies** (`gift_cards`/`pages`/`collections`/`onboarding_attempts`/`ai_usage`/`auth_password_set_intents`) — depends on table-level GRANTs not visible statically; needs live `pg_policies` + `role_table_grants`. The *policy shape* is verified; live exposure is not (DATABASE_TRUTH §11.5).
4. **Live Cloudflare Turnstile verdicts** — the mobile double-spend is code-derived; if prod keys were test "always-pass" keys, duplicates would succeed. Dart-defines pin real `0x4…` site keys, not test keys (MOBILE_TRUTH §11).
5. **Whether the Analytics Engine dataset (`letbuyy-production-telemetry`) is queried by any consumer outside the repo** — no in-repo dashboard/query consumer found; it may be the de-facto telemetry store with an external consumer, which would partially soften OBS-1's "lights off" framing (but still leaves no *alert* path).
6. **Behavioral test execution** for theme-engine/identity/mobile suites — blocked by esbuild darwin/linux mismatch and missing Flutter SDK in the audit sandbox; suites read, not run. D-phase VERIFY rows claim implementer runs (UNVERIFIED here).
7. **Whether GitHub branch protection / environment approvals exist** (`SKIP-PROD-DEPLOY-PROMOTION` is recorded pending; not observable from the repo).
8. **`main`'s payout adapter behavior at `bf8c18c1`** — the throw is verified at HEAD/worktree; `main` behavior is inferred from migration-158 absence, not read line-by-line (MONEY_TRUTH §11).
9. **Whether any production store row carries `liquidRenderingCanary: true`** — no setter exists in-repo; presumed none, UNVERIFIED against live DB.
10. **Function-body completeness for `record_order_payment_failure_with_ledger` / `attach_order_payment_reference_with_ledger`** — verified ledger-free via repo-wide grep; only `confirm_order_payment_with_ledger` and `complete_order_refund` were extracted and read line-by-line (this audit re-verified the former: 0 ledger writes in body).

---

*End of FOUNDATION_GAP_REPORT. Discovery only — read-only git; no repository file modified except this report. All anchored gaps re-verified at the line level where cited "(line-verified)"; all others carry prior-report citations.*
