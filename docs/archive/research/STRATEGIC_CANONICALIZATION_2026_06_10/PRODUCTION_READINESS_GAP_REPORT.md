# LETBUYY — PRODUCTION READINESS GAP REPORT (Part 10)

> **Program:** Strategic Canonicalization 2026-06-10 · **Part 10 — Implementation Readiness Analysis**
> **Author:** Principal Product-Infrastructure Engineer, Architecture Review Board (ABR)
> **Date:** 2026-06-10
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` (working tree, `stepup/main` @ `5cf9e64e`, dirty tree)
> **Status:** AUTHORITATIVE readiness assessment for every canonical strategic winner named across the A0–A9 domain deliverables. Subordinate to `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (the constitution) and to `_ANCHOR_DECISIONS_SPINE.md` (the coherence backbone). This document scores *completion and remaining effort*; it does not re-litigate which implementation wins (that is the sibling deliverables' job).

---

## 0. Methodology & evidence base

This report answers one question per strategic winner: **how close to production is the implementation that should still exist at 10,000 India merchants, and what is the remaining effort to get it beta-ready?**

**Authoritative inputs, read in full and honored:**
- `_ANCHOR_DECISIONS_SPINE.md` (A0–A9) — names every strategic winner and its classification.
- The nine sibling domain deliverables in `STRATEGIC_CANONICALIZATION_2026_06_10/`: `IDENTITY_MIGRATION_MASTER_PLAN.md` (D-01…D-14), `MONEY_SYSTEM_CANONICALIZATION_PLAN.md` (MNY-001…016), `TENANT_ISOLATION_CANONICALIZATION_PLAN.md` (TEN-001…), `THEME_MIGRATION_MASTER_PLAN.md` (DEC-1…), `UI_UX_UNIFICATION_MASTER_PLAN.md`, `PLATFORM_SIMPLIFICATION_PLAN.md` (PLT-001…009), `SHOPIFY_ALIGNMENT_REPORT.md`, `LEGACY_ERADICATION_REGISTER.md`, `SAFE_DELETION_PLAN.md`. Each provides per-decision **Complexity (XS/S/M/L)** and **Wave** that this report aggregates into completion% and eng-week estimates.
- `FORENSIC_MASTER_2026_06_10/`: `ARCHITECTURE_COMPLIANCE_AUDIT.md` (per-module APPROVED/PARTIAL/MISSING/DEAD verdicts + the "DDL-real wiring-dead" register; ARCH-001…038), `PERFORMANCE_AUDIT.md` (PERF-001…025, observability/worker gaps), `SECURITY_FORENSIC_AUDIT.md` (SEC-001…024, OWASP A09 logging/monitoring), `DATABASE_FORENSIC_AUDIT.md`, `TOP_250_PLATFORM_ISSUES.md` (ISSUE-001…291; the 9-S0 / 41-S1 set; complexity histogram), `LETBUYY_MASTER_EXECUTION_PLAN.md` (Phases A–E, critical path, risk burn-down).
- `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`.

**Completion% rubric (evidence-anchored, deliberately conservative).** A component is scored across seven dimensions — **functionality · tests · migrations · integrations · security · observability · monitoring** — then rolled into a single number weighted toward *runtime wiring over schema presence*, because the audit's single most-repeated finding is "DDL-real, wiring-dead." The bands:

| Band | Meaning |
|---|---|
| **85–100%** | Built and wired end-to-end on the live path; remaining work is hardening, breadth, or a named deferral. |
| **60–84%** | Core exists and largely works, but a load-bearing piece is missing wiring, tests, breadth, or a security/observability layer. |
| **40–59%** | Schema/skeleton real, runtime partial — the classic "DDL-real, wiring-dead" or "two-parallel-systems" case; the winner is recognizable but not trustworthy. |
| **15–39%** | Skeleton/stub only; the capability is named and seam-present but not functional. |
| **0–14%** | Absent or a 501/placeholder; greenfield build. |

**Effort rubric.** XS ≈ ≤0.5 eng-wk · S ≈ 0.5–1.5 eng-wk · M ≈ 2–4 eng-wk · L ≈ 5–10 eng-wk. "Remaining effort" is the eng-weeks to reach **beta-ready** (live keys connectable, no S0/S1 open on that winner), NOT to reach the 10k-merchant end-state (deferred capability is excluded from the beta number and called out separately). Estimates are single-squad and assume the Wave-0 deploy meta-blocker is cleared first.

**Confidence.** *High* = claim is code-verified at `path:line` in this/forensic pass. *Med* = code-verified but depth (e.g. test rigor, runtime ordering) inferred. *Low* = live-only / deployment-state / UNVERIFIED from the repo.

**Hard caveat that frames every number below.** Completion% measures the *working tree*. **Nothing in the working tree is live**: `main` (the sole production-deploy trigger) is **30 commits behind** `stepup/main`, so every "complete" wave — including the uncommitted `/api/auth/switch` S0 fix — is **undeployed** (TOPO-001/002, ISSUE-001/002). A winner can be "75% complete in tree" and **0% live**. This report scores the tree; the deploy meta-blocker (RDY-000) is the precondition that makes any of it real.

---

## 1. Executive verdict

**Overall platform readiness for the canonical V1 architecture: ≈ 55% complete (working tree), and ≈ 0% live.** The honest one-line read: *LetBuyy has built the hard, correct cores — a Stripe-grade double-entry ledger, a real server-authoritative cart, a competent four-flow auth surface, a Polaris-grade token engine, a Shopify-grade theme model with two renderers, and a genuinely strong cached storefront — and then left them un-wired to the live paths, governed by the rejected constitution, and unmergeable behind a 30-commit branch lag.* The platform's readiness is bimodal: **schema/skeleton completeness is high (~70–90% almost everywhere), runtime/wiring completeness is the gap (~40–60% on the load-bearing money/tenancy/checkout paths)**, which is exactly the "DDL-real, wiring-dead" signature the forensic audit names in four load-bearing places (compensation executor, reservation sweeper, ledger reconciliation scheduler, hosted-checkout origin) and the "two parallel systems" pattern in four more (legacy vs canonical ledger, React vs Liquid renderer, legacy vs V1 auth, dual draft systems).

**Total eng-weeks to beta-ready: ≈ 70–95 eng-weeks of focused work** (call it **~80 eng-weeks** as the planning number), distributed roughly as: Wave-0 deploy/branch unblock + S0 closure ~6–8; tenancy backbone (off-`service_role` + RLS-everywhere) ~12–16 (the single largest line, an L long-pole); money canonicalization (ledger the 3 paths + reconciliation + PA-split + bigint + outbox/compensation + backfill) ~22–28; identity consolidation (commit S0 + asymmetric re-key + collapse 3 impls + RBAC/claims→GUC) ~14–18; checkout completion (hosted origin + cart-bound signature + sweeper + compensation) ~6–9; mobile-bff composites + mobile release pipeline ~3–5; theme freeze-the-duplication + schema/draft/compose unification (NOT the Liquid flip) ~4–6; UI/UX honesty-badge (the one go-live-relevant DS item) ~1–2; observability/backups/restore-drill ~3–5; platform/governance retarget + domain migration ~5–7. With **2–3 parallel squads** (Platform/Security, Finance/Payments, Checkout, plus Mobile/Identity/Theme part-time) running the V1 §13 squad map, the **wall-clock to beta is ~4–6 months**, bounded by the serial critical path *deploy → engage-RLS → ledger-the-capture → close-reconciliation → safe-PA-split-payout → hosted-origin handoff* (Master Plan §5.1). The 10k-end-state extras (Liquid renderer migration, OIDC IdP, passkeys, theme/app marketplaces, gift-card-as-tender) add another large block of effort but are **correctly deferred** and excluded from the beta number.

**The three readiness truths the scorecard makes precise:**
1. **The cores are real; the wiring is the work.** Money kernel DDL is ~90% but the live capture/refund/COD paths post *zero* ledger → the money winner sits at ~55%. The cart is ~90% but the hosted checkout origin it hands off to is a 404 → the checkout winner sits at ~55%.
2. **Tenancy is the structural long-pole.** RLS is decorative platform-wide because the gateway is `service_role`; the GUC bridge is dead code with zero live callers. This is ~30% complete, an L-effort cutover, and a go-live gate that *also gates* the claims→GUC half of identity and the load-bearing half of every per-table policy.
3. **Test/observability/monitoring are the quiet failures.** The 181-validator gate is governance theater (enforces the rejected architecture, references V1 zero times); real unit/integration tests exist only for the money and tenancy kernels (~20 Postgres test files, never executed in-audit), buyer/checkout/mobile have thin-to-no automated coverage, and the V1-mandated observability quartet (structured-logs+redaction ✓ partial / audit relay ✓ partial / alerting ✗ / backups+tested restore drill ✗) is the least-built kernel in the platform.

---

## 2. Readiness scorecard (every winner × completion% × effort × go-live gating)

> Completion% = working-tree completion against the V1 target. "Beta effort" = eng-weeks to beta-ready (excludes deferred 10k-end-state scope, which is noted). Size in {XS,S,M,L}. Gating = must close before any real merchant / live keys.

| # | Strategic winner (canonical component) | Domain | Completion % | Beta effort (eng-wk) | Size | Go-live gating | Confidence |
|---|---|---|---:|---:|:--:|:--:|:--:|
| W-00 | Deploy pipeline + branch-lag unblock (the meta-blocker) | A0/Platform | **10%** | 1–2 | S | **YES** | High |
| W-01 | One-constitution + governance retarget to V1 (kill 181-validator theater) | A0/Platform | **20%** | 4–6 | M | No (gates deletions) | High |
| W-02 | Canonical topology (8-runtime: monolith+QW+webhook+bff+4 apps) | A0/Platform | **80%** | 3–5 | No (mostly true) | No | High |
| W-03 | Domain canonicalization to `letbuyy.com` (kill `.store` split-brain) | A0/Platform | **35%** | 2–4 | No (P0 infra) | Med |
| W-04 | identity-platform as SOLE issuer (collapse 4 auth impls → 1) | A1/Identity | **45%** | 8–11 | Partial (S0 portion YES) | High |
| W-05 | Asymmetric sole-signer token kernel (HS256-shared → EdDSA/ES256) | A1/Identity | **30%** | 5–8 | No (S1, latent) | High |
| W-06 | OIDC provider (real IdP) | A1/Identity | **5%** | (deferred) ~8–10 | No (deferred) | High |
| W-07 | DPDP consent ledger + DSR export/erasure | A1/Identity | **15%** | 3–4 | Partial (DPDP legal) | High |
| W-08 | Layered RLS + GUC tenancy backstop (off `service_role`) | A2/Tenancy | **30%** | 12–16 | **YES** | High |
| W-09 | App-layer query-lint guard + ownership layers (defense-in-depth) | A2/Tenancy | **70%** | 2–3 | No (keep+tighten) | High |
| W-10 | FORCE+GUC on all 261 tenant tables | A2/Tenancy | **20%** | 3–5 | Partial (with W-08) | High |
| W-11 | The 6/7 anon RLS-to-PUBLIC leak + allowlist closure (S0) | A2/Security | **0%** | 1–2 | **YES** | High (policy) / Low (live grant) |
| W-12 | Canonical append-only double-entry ledger (SSOT) | A3/Money | **65%** | (rolls into W-13..18) | — | **YES** | High |
| W-13 | Ledger the capture/refund/COD live paths (the wiring) | A3/Money | **40%** | 6–9 | **YES** | High |
| W-14 | PA-split payout mirror (kill `razorpayx` self-custody) | A3/Money | **45%** | 4–6 | **YES** | High |
| W-15 | Reconciliation closure + scheduler + reconcile-on-uncertainty | A3/Money | **50%** | 4–6 | **YES** | High |
| W-16 | bigint-paise money representation cutover (4 reps → 1) | A3/Money | **40%** | 5–7 | No (S2, pre-scale) | High |
| W-17 | Real cryptographic step-up + commission=0 + append-only hardening | A3/Money | **45%** | 3–5 | **YES** | High |
| W-18 | Zero-loss historical ledger backfill | A3/Money | **25%** | 5–7 | No (completeness gate) | Med |
| W-19 | Server-authoritative cart + checkout-session state machine | A4/Checkout | **90%** | 1–2 | No (mostly done) | High |
| W-20 | Hosted checkout origin `checkout.letbuyy.com` | A4/Checkout | **15%** | 5–7 | **YES** | High |
| W-21 | Inventory reserve→commit + stale-reservation sweeper (wire it) | A4/Checkout | **70%** | 1–2 | No (sweeper S) | High |
| W-22 | Liquid theme system (Online-Store-2.0) — the renderer flip | A5/Theme | **40%** | (deferred) ~10–14 | No (deferred Wave 3+) | High |
| W-23 | Theme foundation unification (3 schema→1, 2 drafts→1, compose→1) | A5/Theme | **55%** | 4–6 | No (Liquid prereq) | High |
| W-24 | Theme editor (web + Flutter) — the differentiator | A5/Theme | **80%** | 1–3 | No (protect it) | High |
| W-25 | theme-marketplace machinery (catalog dormant) | A5/Theme | **75%** | (deferred catalog) | No (deferred Wave 5) | High |
| W-26 | Storefront runtime (SSR/ISR + 3-tier KV cache) | A6/Storefront | **80%** | 2–3 | No | High |
| W-27 | Merchant control plane (web OS, operator-first IA) | A7/Merchant-OS | **70%** | 3–5 | No | Med |
| W-28 | Merchant mobile app (Flutter) + release pipeline | A7/Mobile | **65%** | 3–5 | No (release-sign S) | High |
| W-29 | mobile-bff composite/fan-in BFF (kill dashboard N+1) | A7/Mobile-BFF | **35%** | 3–5 | No | High |
| W-30 | Unified design system (1 token source + 1 shell + ratchet) | A8/UI-UX | **55%** | (mostly deferred) 4–6 | No (debt, Phase E) | High |
| W-31 | Provider-mode honesty badge (money-surface truth) | A8/UI-UX | **10%** | 1–2 | Partial (money honesty) | High |
| W-32 | Transactional outbox (same-tx write) + typed catalog | A3/A9/Events | **55%** | 2–4 | No (P0 kernel, S1) | High |
| W-33 | Scoped compensation executor (captured-but-failed ⇒ auto-refund) | A4/A9/Events | **35%** | 2–3 | No (buyer-protection S1) | High |
| W-34 | webhook-service (HMAC + timestamp + nonce + DLQ) | A9/Webhooks | **80%** | 1–2 | No | High |
| W-35 | Observability/monitoring kernel (logs+redaction/alerting/backups/restore) | X-cut | **35%** | 3–5 | Partial (restore drill) | Med |
| W-36 | Thin internal-ops sliver (refund / maker-checker payout / dispute / KYC) | A9/Ops | **55%** | 3–4 | No | Med |
| W-37 | SAFE_DELETE dead packages (CQRS/saga/projection/extension scaffolding) | A9/Cleanup | **0%** | 2–3 | No (gated on W-01) | High |

**Scorecard roll-ups.** Winners **<50% complete (11):** W-00 (10), W-01 (20), W-03 (35), W-04 (45), W-05 (30), W-06 (5), W-07 (15), W-08 (30), W-10 (20), W-11 (0), W-13 (40), W-14 (45), W-16 (40), W-17 (45), W-18 (25), W-20 (15), W-22 (40), W-29 (35), W-31 (10), W-33 (35), W-35 (35), W-37 (0). *(22 of 38 at <50% if you count the greenfield/cleanup items; the load-bearing go-live <50% set is the money-wiring, tenancy, hosted-origin, identity, and honesty-badge cluster.)* **Go-live-gating winners (must close for beta): W-00, W-04 (S0 part), W-08, W-11, W-12/13/14/15/17 (money), W-20.** Everything else is product-completeness (Phase D) or debt (Phase E).

---

## 3. Per-winner readiness blocks

> Each block: Component · Strategic role · Completion % (basis) · Missing (functionality/tests/migrations/integrations/security/observability/monitoring) · Remaining effort · Blocking dependencies · Go-live gating · Confidence. Evidence is anchored `path:line` or to a forensic ID.

### W-00 — Deploy pipeline + branch-lag unblock (the meta-blocker)
- **Strategic role:** The universal precondition. `production-deploy.yml` triggers only on `main`, which is 30 commits behind the integration branch where every fix lives. Nothing ships until this clears.
- **Completion: 10%** — basis: pipeline exists and deploys 13 runtimes, but is structurally unable to ship current work; the S0 auth fix is uncommitted/untracked in the dirty tree (TOPO-001/002, ISSUE-001/002; `git rev-list --count main..stepup/main` = 30).
- **Missing — functionality:** commit the S0 fix + test; execute `MERGE_RUNBOOK.md` (ff `stepup/main`→`develop`→`main`); collapse the two racing staging workflows to one; add a branch-lag CI guard. **tests:** the untracked `auth-switch-guard.test.ts` must land. **migrations:** none. **integrations:** none. **security:** the commit *is* the S0 closure. **observability/monitoring:** branch-lag alert so it can't silently re-accumulate.
- **Effort:** 1–2 eng-wk · **S**. **Deps:** clean-tree/worktree discipline (ISSUE-171). **Go-live gating: YES** (literally first). **Confidence:** High.

### W-01 — One-constitution + governance retarget to V1
- **Strategic role:** CI must enforce V1, not the rejected 9-app/CQRS/multi-region `AGENTS.md`. Today 181 validators enforce the superseded architecture and reference V1 zero times — governance theater that *certifies the rejected architecture green while 9 S0s ship live*.
- **Completion: 20%** — basis: a minority lane of V1-aligned validators exists (`foundation-antifabrication-gate`, `beta-readiness` Turnstile, `tenant-isolation-validator`, `compensation-governance`), but ~70 validators mandate replay/projection/saga/CRDT/failover/multi-region; `architecture-validator.mjs:73-76` *requires* the marketplace roots to exist (ARCH-005/006, TOPO-024).
- **Missing — functionality:** regenerate `AGENTS.md` from V1 §6; rewrite `governance-common.mjs` canonical lists to the 4-app+4-worker topology; delete the ~70 rejected-architecture validators; add the 5 missing V1 gates (migration-rollback pairing ≥138, deploy-manifest↔V1-topology, `.store`-ban, commission-bps=0, topology-JSON anti-fabrication). **tests:** validator self-tests. **migrations:** none. **integrations:** the retarget must land *before* the W-37 deletions (today deleting dead packages fails CI). **security/observability/monitoring:** n/a.
- **Effort:** 4–6 eng-wk · **M**. **Deps:** W-00. **Go-live gating:** No (but gates W-37 and the de-deploys). **Confidence:** High.

### W-02 — Canonical topology (8-runtime estate)
- **Strategic role:** One modular monolith + QW + webhook + mobile-bff + 4 apps over one RLS Postgres on Cloudflare/Vercel.
- **Completion: 80%** — basis: the 8-runtime core genuinely deploys; reserved services are clean manifest-only; no deprecated alias recreated (ARCH §3.1 APPROVED; PLATFORM table "STAY CANONICAL: 10"). Drift is *over*-deploy (app-marketplace + developer-portal ship; theme-marketplace catalog; one redundant ops console) + `production-topology.json` fabricating 6 reserved services as `environment:"production"`.
- **Missing — functionality:** de-deploy app-marketplace + developer-portal (FREEZE per R-11); fold platform-operations-portal into platform-console; regenerate `production-topology.json` from the real deploy matrix; `git mv` the Firebase `legacy/` + Helm fantasy to `docs/archive/`. **tests:** topology-drift validator (W-01). **integrations:** none. **security/observability/monitoring:** n/a.
- **Effort:** 3–5 eng-wk · **M**. **Deps:** W-01 (retarget first). **Go-live gating:** No. **Confidence:** High.

### W-03 — Domain canonicalization to `letbuyy.com`
- **Strategic role:** Kill the split-brain (`api.letbuyy.store`/`webhooks.letbuyy.store` live vs `bff.letbuyy.com`); `letbuyy.com` is canonical (V1 §16 P0).
- **Completion: 35%** — basis: `bff.letbuyy.com` exists; everything else is `.store`; `dns.tf` manages only `letbuyy.store` with no `checkout` record (ARCH-018, PLT-008; `infrastructure/dns/dns.tf:5-126`).
- **Missing — functionality:** migrate wrangler routes to `api.letbuyy.com`/`webhooks.letbuyy.com`; 301 the `.store` hosts; add `letbuyy.com` DNS zone incl. `checkout.` (couples to W-20). **tests:** `.store`-ban validator. **migrations:** none (infra/DNS). **integrations:** cookie `COOKIE_DOMAIN` flip is coupled to identity W-04 (D-07) to avoid an SSO break. **security:** cookie-domain flip risk. **observability/monitoring:** n/a.
- **Effort:** 2–4 eng-wk · **M**. **Deps:** W-00; couples to W-20 + identity D-07. **Go-live gating:** No (P0 infra hygiene). **Confidence:** Med (live DNS state UNVERIFIED).

### W-04 — identity-platform as SOLE issuer (collapse 4 auth impls → 1)
- **Strategic role:** One issuer for all 3 realms (merchant/staff, buyer, operator) — OTP, login, sessions, cookies, refresh, consent, OIDC. Today: 4 parallel impls (identity-platform lib + gateway `routes/auth.ts` 1,441 ln + identity-foundation shadow stack + legacy Supabase `/auth/*`).
- **Completion: 45%** — basis: individual flows are real and coherent (bcrypt-12, CSPRNG OTP, rotating reuse-detecting merchant sessions via `validate_and_rotate_merchant_session`, real app-OAuth2-PKCE), but smeared across 4 impls; the `/api/auth/switch` S0 fix is **uncommitted working-tree-only**; no `middleware.ts` default-deny exists (Identity D-01/D-06; AUTH §1).
- **Missing — functionality:** commit+deploy the switch fix (S0); deprecate→delete legacy Supabase `/auth/*` (closes the `user_metadata.role` escalation channel + orphan reset pipeline); SAFE_DELETE the identity-foundation shadow stack; reduce gateway to verify-only; add default-deny `middleware.ts`; unify sessions/cookies/logout under one service. **tests:** switch regression test (untracked today); cross-realm session/logout E2E; the AUTH §12 walkthroughs A–E must all fail. **migrations:** none new (DB primitives kept). **integrations:** mobile-bff/web apps must not depend on Supabase-native tokens post-cutover. **security:** the switch S0; the `/lookup` enumeration oracle; `user_metadata.role` channel. **observability:** durable JTI replay cache (today a per-isolate `Map`, AUTH-021). **monitoring:** auth-failure/lockout telemetry.
- **Effort:** 8–11 eng-wk · **L** (consolidation, not rewrite). **Deps:** W-00, W-05 (asymmetric so the surviving path is the signed one). **Go-live gating:** **YES** for the S0 switch + allowlist portion; the broader collapse is Wave 2–3. **Confidence:** High.

### W-05 — Asymmetric sole-signer token kernel (HS256-shared → EdDSA/ES256)
- **Strategic role:** identity-platform holds the sole private signing key; all other services verify-only with the public key; per-audience claims. Removes the "verification key = forgery key" property: today one `AUTH_SECRET` HS256 leak forges 7 trust domains (console MFA-bypassed, checkout grants, media tickets, identity cookies).
- **Completion: 30%** — basis: algorithm-confusion is already designed out (high-value tokens omit a JWT header; the one real JWT pins HS256; timing-safe compare), but *everything is symmetric* and `AUTH_SECRET` is the universal fallback across 8 sites; OIDC JWKS is a literal-string `MOCK_JWKS` (Identity D-03/§5; AUTH-002; `cookies.ts:13`, `console-session.ts:24`, etc.).
- **Missing — functionality:** the full D0–D4 dual-verify cutover (provision Ed25519/ES256 keypair in real KMS; dual-issue; old-token drain; drop HS256 with alg+kid+aud pinning; prove rotation); remove all 8 `|| AUTH_SECRET` fallbacks; cap `lb_accounts` TTL from 365d→≤90d (prerequisite to the drain). **tests:** sign/verify round-trip; forge-with-public-key must FAIL; wrong-`aud` rejected; alg-pinning rejects `none`/HS256-post-D3; cross-service contract fixtures. **migrations:** none. **integrations:** cross-service contract change across identity-platform + api-gateway + webhook-service + platform-console + auth-core — the only cross-service contract change in identity. **security:** the whole point. **observability:** telemetry showing zero legacy-HS256 verifications before D3 (the drop gate). **monitoring:** key-rotation alerting.
- **Effort:** 5–8 eng-wk · **L** (high operational risk; staged cutover). **Deps:** real KMS (the gateway mock-KMS must become real); `keys.ts` JWKS wired. **Go-live gating:** No (S1, latent until a leak) — but a strong beta hardening item. **Confidence:** High.

### W-06 — OIDC provider (real IdP)
- **Strategic role:** Discoverable identity provider (Shopify Customer-Account-API analog) for SSO/headless/partner apps.
- **Completion: 5%** — basis: a **501 skeleton** — every `oauth2/*` + `.well-known/*` route wraps `oidcSkeletonResponse` (404 flag-off, `mock:true` discovery, literal `MOCK_JWKS`, 501 functional endpoints); 0/16 IdP capabilities work (Identity D-13; AUTH-020).
- **Missing — everything:** client registry, authorize+consent (PKCE/state/nonce), token, userinfo, refresh rotation, revocation/introspection, back/front-channel logout, real rotating JWKS. **Security foot-gun today:** it advertises an ES256 JWKS it cannot sign with — must serve 404, not placeholder, until real.
- **Effort:** ~8–10 eng-wk · **L** — **DEFERRED** (Wave 7, demand-gated on SSO/headless need). **Deps:** W-05 (real key service), W-04 (session service), W-07 (consent ledger). **Go-live gating:** No (correctly deferred). **Confidence:** High.

### W-07 — DPDP consent ledger + DSR export/erasure
- **Strategic role:** Append-only consent ledger governing WhatsApp/marketing/analytics + DSR export/erasure. A legal requirement for India.
- **Completion: 15%** — basis: nobody owns consent; the OIDC consent route 501s; no consent ledger, no DSR path; the WhatsApp `wa_optins` ledger is the same primitive done in one place (Identity D-10; V1 §3).
- **Missing — functionality:** `consents` schema; write API in identity-platform; DSR export (assemble subject data) + erasure (tombstone/anonymize) in gateway; wire WhatsApp opt-in to it. **tests:** consent record/withdraw blocks the matching send; DSR export+erasure E2E; append-only/tamper-evident. **migrations:** `consents` table + DSR audit. **integrations:** WhatsApp send checks ledger before dispatch. **security:** only subject/authorized-ops can trigger DSR. **observability:** consent-change audit. **monitoring:** DSR SLA.
- **Effort:** 3–4 eng-wk · **M** (P1). **Deps:** none hard. **Go-live gating:** Partial (DPDP is a legal go-live consideration for India; the WhatsApp wedge needs it). **Confidence:** High.

### W-08 — Layered RLS + GUC tenancy backstop (off `service_role`) — *the structural long-pole*
- **Strategic role:** Make RLS load-bearing for the first time: tenant data flows over a Hyperdrive-pooled transactional connection under a non-`BYPASSRLS` role `app_tenant` that runs `SET LOCAL app.site_id` from validated claims per request; `service_role` demoted to an audited break-glass hatch.
- **Completion: 30%** — basis: the DDL is excellent and **proven fail-closed under a non-bypass role in tests** (`money-ledger-postgres.test.mjs:257-264` returns 0 rows with GUC unset), but production runs **single-layer (app discipline only)** — the gateway is stateless PostgREST as `service_role` which BYPASSES RLS (the repo's own `107:17-19` admits it), the GUC statement factory has **zero live callers** (dead code, FND-016), and `tenantScoped()` has 0 call sites (FND-008/DB-004, ARCH-008, TEN-002).
- **Missing — functionality:** create `app_tenant` role + grants; build `withTenantTx(siteId, fn)` on Hyperdrive `pg`; staged S-1→S0(shadow)→S1(reads)→S2(writes)→S3(narrow-hatch) cutover; `withServiceRole(reason, fn)` audited hatch. **tests:** cross-tenant red-team suite (RT-1…RT-9) with positive-control-first; forged-`site_id`→0-rows (RT-2); unset-GUC→0-rows (RT-7); shadow-divergence→0-unexpected. **migrations:** role + grants. **integrations:** **hard dependency on identity W-05** — the GUC must be sourced from a *validated* claim, not client-writable `user_metadata` (until W-05, source from the ownership-verified siteId). **security:** the entire isolation guarantee. **observability:** `rls_shadow_divergences` audit; escape-hatch audit rows. **monitoring:** divergence-rate + pool-exhaustion alerts.
- **Effort:** 12–16 eng-wk · **L** (the largest single line; a real connection-architecture change with cutover risk). **Deps:** W-00; identity W-05 (claim integrity); Hyperdrive activation; W-10 for full effect. **Go-live gating:** **YES**. **Confidence:** High.

### W-09 — App-layer query-lint guard + ownership layers
- **Strategic role:** Permanent outer defense-in-depth (L1 predicate guard + L2 ownership) that catches a class the DB cannot (forgot-to-scope, right-column-wrong-value).
- **Completion: 70%** — basis: the Proxy guard exists and rejects registered-table queries lacking a tenant predicate; CI asserts `getSupabaseAdminFromEnv` wraps it; ownership checks (`verifySiteOwnership`) are real per-route. Limits: presence-not-value (FND-012), non-registry tables pass (FND-013), owner columns count as scope (FND-023), not wired into workers/webhook (FND-014) (TEN-003).
- **Missing — functionality:** make non-registry tables default-deny; split `scopeColumns` into tenant vs owner; wrap the worker client. **tests:** RT-3/8/9; contract test registry==guard coverage. **migrations:** none. **integrations:** worker/webhook scan coverage. **security:** the tightenings. **observability/monitoring:** guard-rejection metrics.
- **Effort:** 2–3 eng-wk · **S** (tightenings; the guard exists). **Deps:** registry generator; W-08 for worker wrapping. **Go-live gating:** No (keep+tighten). **Confidence:** High.

### W-10 — FORCE+GUC on all 261 tenant tables
- **Strategic role:** Every tenant table gets ENABLE+FORCE + `USING(site_id=current_site_id())` so the DB backstop is unconditional.
- **Completion: 20%** — basis: only the executable-era set (~41 of 261) carries FORCE+GUC; ~220 baseline tenant tables are ENABLE-only (bypassable by the owner/`service_role`); 64 nullable tenant columns; inventory/media lack FORCE+GUC (FND-009/021/022, TEN-004).
- **Missing — functionality:** registry-driven backfill migration applying the template; backfill+`SET NOT NULL` the 64 nullable tenant columns first. **tests:** contract test registry==policy coverage; RT-7 extended to all. **migrations:** the backfill (inert under `service_role`, so DDL can land early). **integrations:** keys on `store_id` until TD-7 (W-08-adjacent) collapses to `site_id`. **security:** the load-bearing effect after W-08. **observability/monitoring:** n/a.
- **Effort:** 3–5 eng-wk · **M**. **Deps:** registry; W-08 (live effect); nullable backfill. **Go-live gating:** Partial (with W-08). **Confidence:** High.

### W-11 — The anon RLS-to-PUBLIC leaks + super-admin allowlist closure (S0)
- **Strategic role:** Close 6 baseline `service_role_* USING(true)` policies that grant **anon** read/write of orders/customers/billing/products/sites/subscriptions, plus an anon-writable `super_admin_allowlist` (self-grant platform super-admin) and anon `PATCH sites.user_id` (store takeover).
- **Completion: 0%** — basis: the policies are unambiguously wrong (`000_baseline.sql:26571,26627,26669,26690,26718,26725,26739`); no `REVOKE` exists anywhere in the corpus; migration 107's header is first-party evidence anon grants are live (ISSUE-003…008, FND-001…006, TEN-001).
- **Missing — functionality:** migration `162` dropping+recreating each policy as `TO service_role` + correct owner/public-active policies; `REVOKE INSERT/UPDATE/DELETE FROM anon, authenticated`; allowlist audit trigger. **tests:** RT-1 anon probe (all denied) with positive+negative control; CI policy-lint forbidding `USING(true)` without `TO`+predicate. **migrations:** `162` + paired rollback. **integrations:** re-scoping to `TO service_role` cannot break gateway paths (it connects as `service_role`). **security:** the live S0. **observability:** allowlist INSERT audit. **monitoring:** one-shot live anon-key probe (`\dp public.orders`) to confirm closure.
- **Effort:** 1–2 eng-wk · **S** (catastrophe-to-effort ratio is the headline). **Deps:** W-00 (CI migration-replay so it can't be skipped). **Go-live gating:** **YES**. **Confidence:** High (policy) / **Low** (live grant state UNVERIFIED — the one item that needs an anon-key probe before final S0 sign-off).

### W-12 — Canonical append-only double-entry ledger (SSOT)
- **Strategic role:** The single money source of truth; balance always derived (`ledger_account_balance_minor`), never a mutable column.
- **Completion: 65%** — basis: the kernel is genuinely Stripe-grade (8 named accounts `139:83-92`, bigint, Σdebit=Σcredit trigger, append-only trigger, `writer_module='settlement'` CHECK, `post_ledger_transaction` idempotent+balance-checked, `claim_payout_statement_release` FOR-UPDATE+gated) — but it is *fed by the new admin/settlement APIs and starved by the legacy paths that carry real volume*, and 4 parallel legacy ledger families persist beside it (MNY-001, ARCH §3.2 PARTIAL, ARCH-021).
- **Missing:** the *completeness* of the book — see W-13 (capture/refund/COD wiring), W-15 (reconciliation), W-18 (backfill), W-16 (representation), W-17 (append-only hardening). The ledger itself needs only `REVOKE`+RESTRICT hardening and in-RPC tenant derivation.
- **Effort:** rolls into W-13…W-18. **Deps:** all money wiring items. **Go-live gating:** **YES** (as the umbrella). **Confidence:** High.

### W-13 — Ledger the capture/refund/COD live paths (the #1 money wiring blocker)
- **Strategic role:** Make every live money event post to canonical. Today the legacy `confirm_order_payment_with_ledger` captures money and posts **zero** ledger entries despite its name (`grep "INSERT INTO ledger_" 000_baseline.sql` = 0); `complete_order_refund` and COD remittance are likewise un-ledgered.
- **Completion: 40%** — basis: the V1 capture/refund API *does* post canonical (`payments.ts:289-317,543`), but the storefront + every webhook use the legacy un-ledgered RPC, so the ledger is blind to ~100% of live volume; hosted checkout even stamps `capture_posted_to_ledger:true` falsely (MNY-003/004/005, PAY-001/002/003/019, ISSUE-010/011/018/019).
- **Missing — functionality:** post the F6 capture ledger inside the legacy RPC (or route all captures through the V1 adapter) idempotently; ledger the returns-path refund + unify the cumulative-refund cap on the ledger; COD adapter posts `cod_receivable` at confirm/collect + relieves at remittance with signed breaks; forbid ledger posting for `mode != live`. **tests:** capture→balanced `pa_clearing→merchant_payable`; E2E capture→ledger→settlement→payout→refund→reconcile; concurrency double-webhook/double-verify → exactly one posting. **migrations:** COD `*_minor` int→bigint (couples W-16). **integrations:** webhook + storefront verify + admin paths. **security:** in-RPC tenant derivation (couples W-17/MNY-007). **observability:** posting metrics; the `capture_posted_to_ledger` flag set only when a txn id exists. **monitoring:** `pa_clearing` drift alert.
- **Effort:** 6–9 eng-wk · **M** (additive idempotent posting on hot paths). **Deps:** W-08/W-17 (tenant GUC from claims), idempotency lattice (present). **Go-live gating:** **YES** (without it payouts gate to zero and the wallet locks on 100% of volume). **Confidence:** High.

### W-14 — PA-split payout mirror (kill `razorpayx` self-custody)
- **Strategic role:** The licensed PA (Razorpay Route / Cashfree) custodies and disburses; LetBuyy posts a thin split-instruction + statement + reconciliation, never custodying.
- **Completion: 45%** — basis: status-mirroring + provider-gated fail-closed release + the double-release fix (`claim_payout_statement_release`) are real and correct, but the rail is hardcoded `razorpayx` (a from-own-account disbursement product, R-6 breach) and metadata falsely stamps `no_custody:true`; the split-instruction client is unimplemented (DDL-only) (MNY-006, ARCH-002, PAY-014; `payouts.ts:119-121`).
- **Missing — functionality:** rail returns `razorpay_route`/`cashfree`; wire the split-instruction client; assert the rail is a split product; derive `no_custody` from the rail. **tests:** contract test payout refuses non-split rails; metadata matches rail; E2E split-instruction in mock. **migrations:** align `payout_statements.rail` CHECK with `151`. **integrations:** the licensed-PA onboarding (live = `[HUMAN-REQUIRED]`). **security:** regulatory-critical. **observability:** payout-status telemetry. **monitoring:** disbursement reconciliation.
- **Effort:** 4–6 eng-wk · **M** (regulatory-critical; latent until live keys). **Deps:** W-15 (reconcile-on-uncertainty) + W-17 (real step-up) gate *trusting* payouts. **Go-live gating:** **YES**. **Confidence:** High.

### W-15 — Reconciliation closure + scheduler + reconcile-on-uncertainty
- **Strategic role:** Settlement ingests PA/COD statements → posts canonical → reconciles to zero-break-or-explained-suspense; a scheduler runs the wallet→canonical reconciliation; money-out has reconcile-on-uncertainty so no payout strands.
- **Completion: 50%** — basis: settlement ingest is *correct* (posts only when balanced + zero-break, no auto-plug — V1 §8 behavior, keep it), but two load-bearing schedulers are **DDL-real, wiring-dead**: `assert_money_ledger_site_reconciliation`/`backfill_wallet_ledger_to_canonical` (`160:260,279`) have **zero callers**, so the wallet endpoint hard-fails 409 `LEDGER_RECONCILIATION_REQUIRED` indefinitely (ARCH-037), and there is **no reconcile-on-uncertainty for money-out** — a PA-success+local-fail strands a payout in `processing` with money gone and no break (MNY-012, PAY-013).
- **Missing — functionality:** QW scheduled job invoking backfill+assert per active site; payout status reconciler (poll/callback → suspense/break + idempotent retry); signed `recon_breaks` (today `amount>0`+`Math.abs` so short vs over are indistinguishable). **tests:** fault-injection PA-success+local-fail resolves; concurrency double-settle→one transfer; signed-break test. **migrations:** signed-variance column. **integrations:** QW scheduler. **security:** break resolution = maker-checker + real step-up. **observability:** variance≠0 alert (the honesty gate). **monitoring:** aged-suspense dashboard.
- **Effort:** 4–6 eng-wk · **M**. **Deps:** W-13 (capture must be ledgered for reconciliation to be *possible* at all — the precondition). **Go-live gating:** **YES**. **Confidence:** High.

### W-16 — bigint-paise money representation cutover (4 reps → 1)
- **Strategic role:** One money representation (bigint paise) on every path, killing the cast-error class, the int32 overflow (₹2.14cr), and the gift-card precision split.
- **Completion: 40%** — basis: the canonical kernel is already bigint, and migration 160 added `_bigint` shadows for the int32 columns, but 4 representations coexist live (bigint-paise / int32-paise / numeric-rupee / numeric(16,4)); a missed `::bigint` cast = 100× error (MNY-002, DB-003).
- **Missing — functionality:** expand→backfill→verify→contract across `orders.*`, `refunds.amount`, gift cards, `usage_meter_entries`; finish the 160 cutover so `_bigint` is authoritative; resolve the ½-paisa rounding hazard on `orders.total` by deriving from minor units. **tests:** per-row equality job (zero mismatches required); overflow test (>₹2.14cr no wrap); recon byte-identical pre/post contract. **migrations:** the expand/contract pairs (fix the 151/160 `DROP COLUMN` rollback residue). **integrations:** API serializers flip to bigint. **security:** n/a. **observability:** equality-mismatch alert. **monitoring:** n/a.
- **Effort:** 5–7 eng-wk · **L** (a money-representation cutover across the live schema). **Deps:** W-13 (ledgered capture gives the harness ground truth). **Go-live gating:** No (S2; pre-scale, but a beta-hardening item). **Confidence:** High.

### W-17 — Real cryptographic step-up + commission=0 + append-only hardening
- **Strategic role:** Real HMAC/stored-challenge step-up (actor+action-bound, single-use) on payout/refund; 0% commission permanent; append-only enforced by trigger AND `REVOKE`.
- **Completion: 45%** — basis: the `step_up_challenges`/`sensitive_action_approvals` tables exist (migration 153) but are never consulted — the current second factor is a **forgeable string-length check** (`security-controls.ts:27`, any string ≥12 chars + fresh timestamp = "valid"); a live **3% GMV rake** + 18% GST-on-fee is deducted from every payout against a public 0%-fee promise; append-only is **trigger-only with zero `REVOKE`** in the corpus (one `DISABLE TRIGGER` from mutating history) (MNY-008/009/013, PAY-008/018/021, ARCH-001/025).
- **Missing — functionality:** challenge issue→verify against the 153 tables; set `commission_bps=0` + stop auto-seeding + remove the double fee-posting; `REVOKE UPDATE,DELETE` from `service_role`/PUBLIC + no-login owner + ledger/audit FKs CASCADE→RESTRICT. **tests:** forged/replayed/wrong-actor step-up rejected; no fee leg at 0%; `merchant_payable` never double-debited; UPDATE/DELETE on `ledger_entries` denied even to `service_role`. **migrations:** `REVOKE`+RESTRICT migration; commission default change. **integrations:** `payout:release` permission + maker≠checker (W-36). **security:** the forgeable step-up + the rake. **observability:** step-up failure telemetry. **monitoring:** commission-bps=0 CI ratchet.
- **Effort:** 3–5 eng-wk · **S–M** (commission=0 is S; step-up + REVOKE is M). **Deps:** none hard (tables exist). **Go-live gating:** **YES** (the forgeable step-up + the public-promise-violating rake). **Confidence:** High.

### W-18 — Zero-loss historical ledger backfill
- **Strategic role:** Post the historical legacy money state into canonical so the ledger is *complete* (not just correct going forward), validated to zero drift before any compat table is retired.
- **Completion: 25%** — basis: `backfill_wallet_ledger_to_canonical` (`160:279`) exists as a tool but is a standing cross-tenant footgun with no orchestration; the compat tables/mutable balances hold money state the ledger never saw (MNY-015, DB-012).
- **Missing — functionality:** orchestrated, gated, idempotent per-site backfill; zero-loss proof harness. **tests:** per-site derived `merchant_payable` == reconciled legacy available within 0 paise; row-count parity; `money_ledger_site_reconciliations` == `verified`. **migrations:** none new (uses the tool, then drops it). **integrations:** reconciliation harness. **security:** break-glass gating. **observability:** variance dashboard. **monitoring:** drift alert.
- **Effort:** 5–7 eng-wk · **L** (reconciles real historical money). **Deps:** W-13/14/15/16 (all adapters land so the going-forward book is correct). **Go-live gating:** No (completeness gate before retiring legacy; not a *new-merchant* blocker since there is no production money yet). **Confidence:** Med.

### W-19 — Server-authoritative cart + checkout-session state machine
- **Strategic role:** Server-priced, oversell-safe, idempotent cart + a `contact→delivery→payment-intent→confirm` state machine in the monolith; orders only via `create_checkout_order`.
- **Completion: 90%** — basis: APPROVED in the compliance audit — server-priced lines, channel CHECK, email capture + abandonment events, signed handoff (HMAC, 10-min expiry, fail-closed signing secret), per-step idempotency, confirm-time re-validation with FOR-UPDATE reservations; the classic list-then-detail N+1 is absent (batched `.in()`) (ARCH §8 APPROVED, CHK audit; `cart-routes.ts:541-575`, `checkout.ts:324-467`).
- **Missing — functionality:** bind cart *contents* into the signature (today the signature covers store:cart:token:channel:expiry, not the line items — W-20 dependency); demote the legacy client React cart to a thin view. **tests:** last-unit concurrency depth (file present, depth UNVERIFIED); cart-bound-signature test. **migrations:** none. **integrations:** the hosted origin (W-20). **security:** cart-tamper via signature. **observability:** cart funnel metrics. **monitoring:** abandonment rate.
- **Effort:** 1–2 eng-wk · **S**. **Deps:** W-20. **Go-live gating:** No (mostly done; the gap is the origin it hands to). **Confidence:** High.

### W-20 — Hosted checkout origin `checkout.letbuyy.com`
- **Strategic role:** The single PCI-scope-shrinking buyer checkout origin the signed handoff targets. V1 called this "the point of the exercise."
- **Completion: 15%** — basis: the URL generator targets `https://checkout.<domain>/checkout` and the checkout API state machine exists, but **no surface serves the origin** — no `/checkout` root page in `apps/storefront-runtime/src/app/`, no middleware/rewrite, no `checkout` DNS record; the signed URL today points at a 404 host (ARCH-003, CHK-015, MISSING; `cart-routes.ts:293-303`).
- **Missing — functionality:** storefront host-routing (middleware on `checkout.*`) + a root `/checkout` page consuming the signed params + rendering the checkout client; DNS record (couples W-03). **tests:** E2E signed-handoff → hosted page → confirm; the cart-bound signature (W-19). **migrations:** none. **integrations:** storefront-runtime + DNS + the checkout API. **security:** the single-origin PCI-scope goal; retire the legacy tenant-path checkout + Stripe/PayPal Next handlers once it lands. **observability:** checkout-origin latency. **monitoring:** handoff success rate.
- **Effort:** 5–7 eng-wk · **L** (a buyer-facing surface build; an L long-pole on the critical path). **Deps:** W-03 (DNS), W-19 (cart-bound signature). **Go-live gating:** **YES** (the signed handoff is a dead link without it). **Confidence:** High.

### W-21 — Inventory reserve→commit lifecycle + stale-reservation sweeper
- **Strategic role:** Single reserve→commit lifecycle with `version` optimistic concurrency + a scheduled stale-reservation sweeper.
- **Completion: 70%** — basis: the reserve/commit/release RPCs row-lock (FOR UPDATE / SKIP LOCKED) with version optimistic concurrency and are wired into routes, TTL-clamped — but the sweeper `expire_inventory_reservations` (`141:304`) is **DDL-real, wiring-dead** (zero callers), so reservations never release → phantom out-of-stock + unbounded table growth; 2 side doors (direct-`available`-decrement, order-edit add-item-without-reservation) bypass the one path (ARCH-012, CHK-002…005, PERF §5; "DEAD wiring").
- **Missing — functionality:** schedule the sweeper (gateway cron or QW job every N min); unify the 2 side doors onto the one path. **tests:** last-unit concurrency; sweeper releases expired. **migrations:** none. **integrations:** cron/QW scheduler. **security:** n/a. **observability:** reservation-table-size metric. **monitoring:** stale-reservation count alert.
- **Effort:** 1–2 eng-wk · **S** (the sweeper is a one-line cron wire; side-door unification is the rest). **Deps:** none. **Go-live gating:** No (degrades over months, not at merchant #1). **Confidence:** High.

### W-22 — Liquid theme system (the renderer flip)
- **Strategic role:** The Online-Store-2.0-shaped Liquid/portable engine is the canonical winner (the only architecture that supports a theme marketplace, 3rd-party authors, portable themes, app-blocks). React-per-section is a first-party-only dead-end.
- **Completion: 40%** — basis: the Liquid engine is **built but feature-flagged OFF** (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) — a genuine data-only sandbox (`ownPropertyOnly`, drop scrub, parse/render/memory limits, upload-time tag forbidding) but with a brittle regex output-sanitizer and no live traffic; the React renderer is the live ~62%-Shopify-parity path (THEME-001, DEC-1; `theme-governance.ts:14`, `theme-renderer.ts`).
- **Missing — functionality:** per-theme `renderer.engine` switch + canary; ~20 first-party `sections/*.liquid` ports with `{% schema %}` parity; replace the regex sanitizer with DOMPurify/allowlist (a HARD entry gate); un-orphan the engine renderer. **tests:** screenshot/DOM-diff render-parity harness; the Security suite (SSTI/XSS/sandbox-escape) as a hard gate; per-section render unit tests. **migrations:** `renderer.engine` column. **integrations:** storefront-runtime hosts it. **security:** the sanitizer replacement before any Liquid render reaches buyers. **observability:** render-latency parity. **monitoring:** per-theme render-error rate.
- **Effort:** ~10–14 eng-wk · **L** — **DEFERRED** (Wave 3+, gated on tenancy landing + theme-marketplace/3rd-party demand). The only Wave-1 theme action is **FREEZE the duplication** (W-23-adjacent). **Deps:** W-08 (tenancy), W-23 (foundation unification), DOMPurify. **Go-live gating:** No (correctly deferred). **Confidence:** High.

### W-23 — Theme foundation unification (3 schema→1, 2 drafts→1, compose→1)
- **Strategic role:** Collapse the duplication that is the live "two parallel systems" tax in the theme domain — the Liquid-flip prerequisite.
- **Completion: 55%** — basis: three schema sources (engine `BUILT_IN_SECTION_SCHEMAS` + storefront `RUNTIME_SECTION_SCHEMAS` + DB manifests), **two draft systems written in the same call** (`theme_editor_drafts` + the `theme_instance_drafts`/`theme_draft_patches` spine), a forked compose path; validation itself is single and strong (THEME-003/004/005, DEC-3/4/5).
- **Missing — functionality:** generate storefront+DB schema from the engine registry + CI parity gate; make `theme_editor_drafts` a read-shim then drop; route the React path through `composeStorefrontTheme`; resolve 4 placeholder sections + `announcementBar` mismatch; drop the publish JS fallback; de-dup snapshot; de-silence schema-degradation. **tests:** golden-schema snapshot + parity check; draft→patch→publish→rollback round-trip. **migrations:** draft consolidation. **integrations:** storefront + DB + editor. **security:** n/a. **observability:** de-silenced degradation warnings. **monitoring:** schema-drift CI.
- **Effort:** 4–6 eng-wk · **M**. **Deps:** W-08 (theme persistence tenant-safe first). **Go-live gating:** No (Liquid prerequisite, not a beta gate). **Confidence:** High.

### W-24 — Theme editor (web + Flutter) — the differentiator
- **Strategic role:** The protected differentiator; renderer-agnostic (edits `SectionModel`, survives the renderer swap untouched).
- **Completion: 80%** — basis: dense real web editor (add/remove/reorder/visibility/typed-settings/undo-redo/autosave/preview/publish) + an at-or-above Flutter editor (50-state undo, device frames, layers drawer); both on shared backend contracts (THEME-006, DEC-7).
- **Missing — functionality:** web drag-and-drop reorder (Flutter has it); Theme-Check "Issues" panel; rename mislabeled "AI hooks"→"Smart defaults" (R-15 honesty); align mobile fallback slug. **tests:** editor E2E runs identically on `renderer.engine=react|liquid`. **migrations:** none. **integrations:** schema unification (W-23) for the lint panel. **security:** n/a. **observability:** n/a. **monitoring:** n/a.
- **Effort:** 1–3 eng-wk · **M** (drag-reorder + lint panel; the rename is XS). **Deps:** W-23. **Go-live gating:** No (protect it; don't break it). **Confidence:** High.

### W-25 — theme-marketplace machinery (catalog dormant)
- **Strategic role:** Real release-creating install machinery; catalog seeded at the demand trigger.
- **Completion: 75%** — basis: ~50 files of real machinery (DB-backed listing/search, rate-limited bundle upload, purchases/installs, Razorpay verify, `installTheme` that purchase-gates + publishes a release), but only `urban-kicks` seeded (deliberately, to keep metrics honest) (THEME-008, DEC-10).
- **Missing — functionality:** author 5–10 first-party Liquid-bundle themes (the catalog). **Everything else is built.** **tests:** install→release per new theme. **migrations:** none. **integrations:** the Liquid engine (W-22). **security/observability/monitoring:** n/a.
- **Effort:** catalog authoring is **DEFERRED** (Wave 5, gated on demand); machinery needs nothing. **Deps:** W-22. **Go-live gating:** No (deferred). **Confidence:** High.

### W-26 — Storefront runtime (SSR/ISR + 3-tier KV cache)
- **Strategic role:** The canonical buyer read path; one runtime (no Hydrogen/Oxygen split); hosts the Liquid renderer at target state.
- **Completion: 80%** — basis: the audited strong point — server-rendered Next.js ISR + a real Cloudflare Cache-API + KV-versioned cache + Next Data Cache, batched hydration, AVIF/WebP, Hyperdrive-pooled reads; "fast on cache hit" (PERF §1 verdict 3.0/5 with storefront as the strong point).
- **Missing — functionality:** unwire+delete `runtime-composition` (a rejected/dormant artifact wired into the storefront page); host the Liquid renderer (W-22). **tests:** store-route smoke. **migrations:** none. **integrations:** the Liquid renderer at target. **security:** stored-XSS pair on the storefront (ISSUE-016/017, SEC). **observability:** cache hit-rate. **monitoring:** storefront p95.
- **Effort:** 2–3 eng-wk · **S–M** (unwire is the bulk; XSS pair is separate security). **Deps:** W-22 for the renderer; W-01 for the dead-package deletion. **Go-live gating:** No (the XSS pair is gated separately under Security Phase A). **Confidence:** High.

### W-27 — Merchant control plane (web OS, operator-first IA)
- **Strategic role:** Canonical merchant web surface, operator-first (Orders/Money/Customers primary).
- **Completion: 70%** — basis: deepest `@letbuyy/ui` adoption (~74 import files), best a11y on platform, genuinely operator-first — but carries the largest single CSS drift store (`globals.css` 10,335 lines), has NOT adopted `AppNavigation`, and lacks a first-class Money/Finance node; dashboard issues ~6–8 serial round-trips (UI-UX §3.1, PERF-002).
- **Missing — functionality:** adopt `AppNavigation` (the highest-value shell migration); add the Money node; collapse the dashboard fan-out (couples mobile-bff pattern). **tests:** thin automated coverage (source-level audit). **migrations:** none. **integrations:** the shell + composite reads. **security:** session/CSRF (identity). **observability:** page metrics. **monitoring:** dashboard latency.
- **Effort:** 3–5 eng-wk · **M** (shell adoption + Money node + fan-out). **Deps:** W-30 (shell), identity. **Go-live gating:** No. **Confidence:** Med.

### W-28 — Merchant mobile app (Flutter) + release pipeline
- **Strategic role:** The best-finished surface (3.1/5); canonical mobile merchant OS.
- **Completion: 65%** — basis: login *works* on prod (real Turnstile + secure-storage tokens), strong theme editor, real screens for all families — but the **release pipeline is debug-keystore only** (no production signing → a hard release blocker), the TD-5 parity catalog (~974 lines) is still present+routed, no honesty badge, dashboard ~7 serial round-trips, no cert pinning (MOBILE audit, ARCH-009, AUTH-018; "BUILDS debug only").
- **Missing — functionality:** production release signing/pipeline; delete TD-5 (`merchant_feature_screen.dart`/`_definitions.dart` + route case); cert pinning + `debugPrint` strip + email-prefill to secure storage. **tests:** mobile widget/integration coverage is thin. **migrations:** none. **integrations:** mobile-bff composites (W-29); honesty badge (W-31). **security:** cert pinning. **observability:** crash reporting. **monitoring:** release health.
- **Effort:** 3–5 eng-wk · **M** (release-sign is S; TD-5 delete is S; pinning is M). **Deps:** W-29, W-31. **Go-live gating:** No (the app builds; release-sign gates *shipping the app*, not the platform). **Confidence:** High.

### W-29 — mobile-bff composite/fan-in BFF
- **Strategic role:** The N+1-killing tier the topology charters it as; today a 305-line pass-through proxy with zero composite endpoints.
- **Completion: 35%** — basis: the Turnstile verifier + session-signing proxy are real and fail-closed, but `app.all('/v1/*', proxyToGateway)` is the whole surface — the dashboard fan-out it exists to collapse is fully present (~7 mobile / ~6–8 web serial round-trips) (ARCH-019, PERF-001/002/003, PLT-009; `mobile-bff/src/index.ts:302`).
- **Missing — functionality:** `GET /v1/dashboard` (fan in 6–8 blocks + 5 rollups over the service binding); `GET /v1/orders/:id/bundle`; interim Wave-1 `Future.wait` the 5 mobile analytics calls (Flutter-side, no BFF dep). **tests:** composite payload contract + dashboard one-round-trip E2E + latency vs ~7-call baseline. **migrations:** none. **integrations:** the gateway over `env.API_GATEWAY_SERVICE`. **security:** keep the allow-listed proxy. **observability:** composite latency. **monitoring:** N+1 regression.
- **Effort:** 3–5 eng-wk · **M** (L for full fan-in coverage; interim is XS). **Deps:** none. **Go-live gating:** No (latency, not correctness). **Confidence:** High.

### W-30 — Unified design system (1 token source + 1 shell + ratchet)
- **Strategic role:** One token source (`@letbuyy/ui` DTCG) for web + a generated Dart bridge; one shell (`AppNavigation`); a ratchet that BLOCKS new drift.
- **Completion: 55%** — basis: a Polaris-grade token engine (`tokens.ts` 1,388 lines) + a real CI ratchet exist, but fractured into 3 token sources, 8 hand-rolled navs (shell adoption **2/9**), 4 mobile color classes (mobile is a de-facto separate DS — `ThemeData` bypasses the generated bridge), per-app `--lb-*` redefinitions; the ratchet *baselines* existing drift as "passing" rather than blocking; stylelint exists but CI never calls it (UI-UX §0/§1; `design-system-baseline.json`).
- **Missing — functionality:** roll `AppNavigation` 2/9→9/9 (merchant first); re-point mobile `ThemeData` at the generated bridge + extend it for type/density + delete the duplicate color classes; install stylelint + wire `lint:css` to CI; promote warn-only color/form rules to error after burn-down; scheduled `--update` lowering each ratchet 10%/release. **tests:** ratchet/parity CI. **migrations:** none. **integrations:** every app shell. **security:** n/a. **observability:** drift metrics. **monitoring:** the ratchet clock.
- **Effort:** 4–6 eng-wk · **M** — **mostly DEFERRED** to Phase E (debt, NOT a go-live blocker), with the **one exception being W-31 (honesty badge)**. **Deps:** W-01 (ratchet under one constitution). **Go-live gating:** No (the floor is "no migration regresses a11y"). **Confidence:** High.

### W-31 — Provider-mode honesty badge (money-surface truth)
- **Strategic role:** A shared `ProviderModeBadge` on every money/fulfillment surface (web + Flutter) bound to backend `provider_mode` — V1 Principle 4 / R2 ("a stub must never read as success").
- **Completion: 10%** — basis: **no badge component exists** anywhere (repo-wide grep empty); the only mode surface is a raw `provider_mode ?? 'sandbox'` text echo on one mobile tile (`money_screen.dart:256`) (ARCH-020, MOB-005, UI-UX §3 row).
- **Missing — functionality:** build the shared badge in `@letbuyy/ui` + Dart `ui_kit`; bind to `provider_mode` payload fields; validator-enforce on money screens. **tests:** badge renders the right mode; validator fires if a money screen lacks it. **migrations:** none. **integrations:** every money/fulfillment surface (web + mobile). **security:** truth-in-UI (prevents a sandbox payout reading as real). **observability:** n/a. **monitoring:** n/a.
- **Effort:** 1–2 eng-wk · **S**. **Deps:** the money payloads expose `provider_mode` (W-14/15). **Go-live gating:** Partial (a money-honesty requirement that ships alongside real payouts in Waves 2–3 — the one go-live-relevant DS item). **Confidence:** High.

### W-32 — Transactional outbox (same-tx write) + typed catalog
- **Strategic role:** Reliable events via one transactional outbox (not an event bus); the typed catalog is library-only.
- **Completion: 55%** — basis: the typed catalog is APPROVED (versioned contracts, dedupe on `event_id`), and the outbox table + claim/complete/fail RPCs + relay exist — but the **core guarantee is broken**: the dual-write is non-atomic (domain write + `outbox_events` upsert are separate Supabase REST calls; a crash between loses the event; a missing table silently returns `null`), and the relay runs in the api-gateway cron, not QW (ARCH-004/013, P5 PARTIAL; `event-execution.adapter.ts:60-88`).
- **Missing — functionality:** move emits into SECURITY DEFINER RPCs that write domain row + outbox in one transaction (the `post_settlement_ledger_transaction` pattern proves it); make missing-table fatal; move the relay to a QW scheduled handler. **tests:** crash-between-writes loses no event; missing-table fails loudly. **migrations:** none. **integrations:** every money/lifecycle emit (order.paid → WhatsApp/webhooks/settlement). **security:** n/a. **observability:** outbox lag metric. **monitoring:** un-relayed-event alert.
- **Effort:** 2–4 eng-wk · **M**. **Deps:** couples W-13 (money RPCs). **Go-live gating:** No (S1 reliability; P0 kernel in V1, so a strong beta item). **Confidence:** High.

### W-33 — Scoped compensation executor (captured-but-failed ⇒ auto-refund)
- **Strategic role:** The buyer-protection guarantee V1 §9 promises: a captured-but-order-failed payment auto-refunds.
- **Completion: 35%** — basis: the `compensation_actions` table + flow CHECK exist and checkout *records* a pending `refund_payment_intent` on confirm failure — but **no executor exists anywhere** (grep for consumers: only the registry + the checkout writer), so the mandated auto-refund **never runs** and stranded captures need manual ops (ARCH-011, PAY-026; "functionally DEAD at execution").
- **Missing — functionality:** a QW job claiming `(status=pending, action=refund_payment_intent)` and running an idempotent refund via the canonical refund adapter. **tests:** fault-injection capture-succeeds+order-fails → executor issues an idempotent refund that posts canonical. **migrations:** none. **integrations:** the refund adapter (W-13). **security:** n/a. **observability:** compensation backlog. **monitoring:** stranded-capture alert.
- **Effort:** 2–3 eng-wk · **M**. **Deps:** W-13 (refund adapter is the compensation action). **Go-live gating:** No (S1 buyer-protection; latent until live captures). **Confidence:** High.

### W-34 — webhook-service (HMAC + timestamp + nonce + DLQ)
- **Strategic role:** Inbound HMAC + timestamp-window + nonce; outbound signed merchant deliveries with DLQ, outbox-sourced.
- **Completion: 80%** — basis: APPROVED — Razorpay HMAC timing-safe + timestamp observation, Stripe scheme, outbound `X-LetBuyy-Signature/Timestamp/Nonce`, outbox-sourced `webhook_deliveries` fanout, retry/failure paths (ARCH §3.1 APPROVED). Gaps: inbound dedup has no timestamp-*window* and suppresses retries after a processing failure (a transiently-failed capture leaves an order unpaid); SSRF on outbound fetch (ISSUE-020).
- **Missing — functionality:** add timestamp-window rejection; mark dedup `processed` only after side effects (self-heal); SSRF blocklist (private/loopback/link-local/ULA, re-check after redirect). **tests:** replay-old-body rejected by window; failed-then-redelivered capture becomes paid; SSRF blocked. **migrations:** none. **integrations:** money paths (W-16/MNY-016). **security:** SSRF + replay window. **observability:** DLQ depth. **monitoring:** delivery-failure rate.
- **Effort:** 1–2 eng-wk · **S–M**. **Deps:** identity W-05 for the `INTERNAL_API_SECRET` split. **Go-live gating:** No (the SSRF is gated separately under Security Phase A). **Confidence:** High.

### W-35 — Observability / monitoring kernel
- **Strategic role:** V1 P0 requires structured logs + PII redaction, audit relay, alerting, and **backups + a tested restore drill**.
- **Completion: 35%** — basis: structured JSON logs with request/dispatcher ids exist; `replayable-secret-redaction` is validator-enforced; audit dual-write exists; telemetry adapter wired in QW — **but alerting is absent** (dangerous-input + CSRF events are `console.warn`'d, never alerted/blocked — SEC-017/A09), and the **restore drill is staged but never executed with PITR explicitly skipped** (`SKIP-W0-PITR-TIER`), so a single-region DB SPOF has no proven recovery (ARCH-035, V1 P0 "tested restore drill"; SECURITY A09 PARTIAL). See §4 for the full quartet.
- **Missing — functionality:** wire security/audit events to alerting + ingress block for clear-cut payloads; execute the restore drill against a staging fixture + activate PITR `[HUMAN-REQUIRED]`. **tests:** restore-drill evidence; alert-fires test. **migrations:** none. **integrations:** SIEM/alerting sink. **security:** the A09 logging-failure gap. **observability:** the audit relay completion. **monitoring:** the alerting layer itself + backup-success monitoring.
- **Effort:** 3–5 eng-wk · **M** (restore drill is S but human-gated; alerting wiring is M). **Deps:** W-00 (deploy). **Go-live gating:** Partial (a *tested* restore drill is a V1 P0; alerting is strongly advisable for live money). **Confidence:** Med.

### W-36 — Thin internal-ops sliver
- **Strategic role:** One internal-ops surface: manual refund, **maker-checker on manual payout**, dispute log, KYC review queue with a real provider.
- **Completion: 55%** — basis: refund-with-step-up + a KYC queue with a real-provider adapter (Signzy/HyperVerge, live fail-closed) exist — but **maker-checker (second approver) does not exist** (single-actor step-up only), the dispute/chargeback log is **not located** (likely MISSING/UNVERIFIED), and the full internal OS far exceeds the sliver (risk/T&S/support/incident jobs active in P0, should be frozen) (ARCH §3.3 PARTIAL, ARCH-022/029).
- **Missing — functionality:** add second-approver (distinct actor) on payout.release + recon-break resolution; build the dispute log; flag-freeze the non-sliver internal-OS jobs. **tests:** maker≠checker enforced; dispute-log CRUD. **migrations:** dispute-log table (if MISSING). **integrations:** payout (W-14), KYC. **security:** two-person control on money-out. **observability:** ops-action audit. **monitoring:** KYC queue SLA.
- **Effort:** 3–4 eng-wk · **M**. **Deps:** W-14/W-17. **Go-live gating:** No (maker-checker matters once live payouts flow; not at merchant #1). **Confidence:** Med (dispute log UNVERIFIED).

### W-37 — SAFE_DELETE dead packages
- **Strategic role:** Delete the rejected CQRS/saga/projection/extension scaffolding (`projection-runtime`, `distributed-runtime`, `orchestration`, `extension-host`, `app-engine`) + `runtime-composition` (unwire first).
- **Completion: 0%** — basis: not started, and **blocked** — these packages are load-bearing imports in active runtimes (`queue-execution.adapter.ts`, `platform-queue-consumer.ts`) and 4 validators keep them alive (a validator-liveness loop), so deletion fails CI today (ARCH-026, PLATFORM "DEAD" rows, SAFE_DELETION_PLAN).
- **Missing — functionality:** inline the few used contracts into `event-core`/`shared-types`; unwire `runtime-composition` from the storefront; then delete; retarget/delete the 4 keeping-alive validators. **tests:** zero-importers check post-unwire. **migrations:** none. **integrations:** the unwire. **security/observability/monitoring:** n/a.
- **Effort:** 2–3 eng-wk · **M**. **Deps:** **W-01** (retarget validators first, else deletion fails CI). **Go-live gating:** No (cleanup). **Confidence:** High.

---

## 4. Observability & monitoring gap section

V1's P0 observability kernel mandates **five** things: structured logging + PII redaction · tracing · metrics · audit relay · alerting · **backups + a *tested* restore drill**. The platform has built the *recording* half and skipped the *reacting* half. This is the least-complete kernel in the platform (W-35, ~35%).

| V1 requirement | Exists? | Evidence | Gap | Effort |
|---|---|---|---|---|
| **Structured logging + PII redaction** | **Partial (✓ logs / ✓ redaction)** | Structured JSON logs with request/dispatcher ids (`index.ts:833-858`); `lib/replayable-secret-redaction.ts` validator-enforced | Coverage breadth across all services unverified; `debugPrint` in mobile may surface error bodies (AUTH-025) | S |
| **Tracing** | **Partial** | request/dispatcher ids propagate | No distributed trace IDs across the BFF→gateway→PostgREST hops; the round-trip tax is invisible without it | M |
| **Metrics** | **Partial** | telemetry adapter wired in QW; queue batch metrics | No hot-path latency/cache-hit/N+1 metrics surfaced; PERF figures are code-estimated, not measured (PERF §0 UNVERIFIED) | M |
| **Audit relay** | **Partial** | audit dual-write (`audit-dual-write.ts`, `audit_activity_events`) | Same non-atomic dual-write defect as the outbox (REST after commit; can lose audit rows) — couples W-32 | M |
| **Alerting** | **MISSING** | — | **The decisive gap.** Dangerous-input + CSRF events are `console.warn`'d, never alerted or blocked (SEC-017 / OWASP A09 PARTIAL); webhook DLQ/poisoning telemetry exists but no replay-poison guard (SEC-009); security events observed but not actioned | M |
| **Backups + tested restore drill** | **MISSING (the P0 hole)** | drill is *staged* (`scripts/governance/foundation-restore-drill.mjs`) but **PITR explicitly skipped** (`SKIP-W0-PITR-TIER`); never executed (ARCH-035) | A single-region DB SPOF (V1 R10) with **no proven recovery**. V1 P0 demands a *tested* drill. | S (human-gated) |
| **Money-correctness monitoring** | **MISSING** | wallet honesty gate surfaces variance, but no scheduler runs it (ARCH-037) | No alert on `pa_clearing` drift, `variance≠0`, stranded payouts, or stale reservations — the very signals the un-wired schedulers (W-15/W-21) would emit | (in W-15/21) |

**The biggest observability/monitoring gaps, ranked:**
1. **No tested restore drill / PITR off** — a single-region money platform with unproven recovery (W-35; ARCH-035). *V1 P0; gates a responsible beta.*
2. **No alerting on security/abuse events** — attacks are logged and ignored (SEC-017/A09).
3. **No money-correctness monitoring** — the honesty gates exist but nothing runs or alerts on them; `pa_clearing` drift, reconciliation variance, stranded payouts, and stale-reservation bloat are all unmonitored (ARCH-037, ARCH-012, PAY-013).
4. **Non-atomic audit relay** — the audit trail can silently drop rows (same defect as the outbox; W-32/W-35).
5. **No distributed tracing/latency metrics** — the dominant performance variable (PostgREST round-trip count) is invisible; the dashboard N+1 (PERF-001/002) cannot be measured, only counted in code.

---

## 5. Test-coverage reality section

**The 181-validator gate is governance theater, not test coverage.** It enforces the rejected `AGENTS.md` architecture (CQRS/replay/projection/saga/multi-region certifications), references V1 zero times, and — most damningly — **certifies the platform green while 9 S0s ship live** (ARCH-005/006, TOPO-024, 000_MASTER_INDEX Q2). Validators are *structural lints* (file-presence, line-count, import hygiene), not behavioral tests. Real automated test coverage is concentrated in exactly two kernels and thin-to-absent everywhere else.

| Winner | Real unit/integration/e2e coverage (what is actually tested) | Reality |
|---|---|---|
| **Money kernel (W-12…18)** | **Strongest.** ~20 Postgres test files (`tests/executable/money-ledger-postgres.test.mjs`, `settlement-postgres.test.mjs`, `foundation-wave1-money-postgres.test.mjs`) replay migrations against an ephemeral PG, `SET ROLE`, and assert balanced/append-only/fail-closed properties | **Med confidence** — the files exist and waves claim PASS, but **were not executed in-audit** (UNVERIFIED depth); property-based/concurrency rigor is asserted by file presence, not re-proven. And the tests cover the *V1* paths, not the legacy paths that carry live volume (W-13). |
| **Tenancy (W-08…11)** | `security-rls-hardening-postgres.test.mjs` replays + `SET ROLE` + asserts policy behavior; `money-ledger` proves unset-GUC→0-rows under `executable_app_user` | Med — the fail-closed *property* is proven for a non-bypass role; the **production** path (service_role bypass) is exactly what's untested because it's the thing being fixed. The cross-tenant red-team suite (RT-1…9) is **specified, not yet built**. |
| **Checkout/cart (W-19)** | `inventory-postgres.test.mjs` last-unit concurrency (file present, depth UNVERIFIED); idempotency adapter tests | Med — core has tests; the cart-bound-signature and hosted-origin E2E don't exist (the origin doesn't exist). |
| **Identity (W-04/05)** | The switch S0 regression test is **untracked** (doesn't exist in tree yet); the AUTH §12 walkthroughs A–E are the *target* security suite, **not yet built**; the asymmetric-cutover contract tests are specified | Low — the single most important auth test (switch 401-without-session) is not in the tree; cross-service token contract fixtures are unbuilt. |
| **Theme (W-22…24)** | Validation logic (`collectThemeTemplateValidationIssues`) is real and tested-by-use; the render-parity (screenshot/DOM-diff) harness and the Liquid Security suite (SSTI/XSS/sandbox) are **specified as Wave-3 gates, not built** | Low for the migration — the parity + security harnesses are the *gate* for a flip that hasn't happened. |
| **Storefront (W-26)** | Implicit via the cache/render path; no enumerated automated suite found | Low — relies on the cache being correct; no store-route smoke suite enumerated. |
| **Mobile (W-28)** | Thin — the audit is source-level; no enumerated widget/integration coverage | Low. |
| **Observability (W-35)** | None for alerting/restore (they don't exist); redaction is validator-enforced | Low. |
| **webhook/outbox (W-32/34)** | Replay-safety via provider event ids; outbox claim/complete RPCs | Med for the happy path; the crash-between-writes and replay-window cases are **untested** (the defects). |

**Test-coverage verdict:** **real coverage exists only for the money and tenancy *kernels* (and only their V1 paths, only at unverified depth), is happy-path-only for webhook/outbox, and is essentially absent for identity-security, checkout-origin, theme-migration, storefront, mobile, and the entire observability layer.** The headline numbers in the scorecard treat "tests" as a *weak* dimension almost everywhere precisely because the 181-validator green is not coverage — it is the opposite, a gate that mistakes structure for safety. **Every go-live-gating winner needs its security/concurrency suite *built*, not just its happy path.** The most urgent test gaps are: the switch regression test (untracked), the cross-tenant red-team suite (specified), the capture↔settlement reconciliation E2E (specified), and the Liquid Security suite (the flip gate).

---

## 6. Completion-vs-go-live rollup

**The question: sum the effort to reach beta-ready.** "Beta-ready" = the platform can connect live PSP/Route keys and onboard a real merchant with no S0/S1 open and a responsible observability floor. This is the **Phase A + Phase B** scope of the Master Plan (all 9 S0s close in A; all 33 go-live blockers close by end of B), plus the minimum of Phase D needed for a buyer to actually check out.

**Go-live-gating winners and their beta effort:**

| Winner | Completion% | Beta effort (eng-wk) | Why it gates |
|---|---:|---:|---|
| W-00 deploy unblock | 10% | 1–2 | Nothing ships otherwise |
| W-11 anon RLS leaks + allowlist (S0) | 0% | 1–2 | Live data + privilege leak |
| W-04 switch S0 + identity collapse (S0 portion) | 45% | 2 (S0) of 8–11 | Live account takeover |
| W-08 tenancy backbone (off service_role) | 30% | 12–16 | RLS decorative platform-wide |
| W-13 ledger the live capture/refund/COD | 40% | 6–9 | Ledger blind to 100% of volume |
| W-15 reconciliation closure + scheduler | 50% | 4–6 | Wallet locks; payouts can't be trusted |
| W-14 PA-split (kill razorpayx) | 45% | 4–6 | R-6 self-custody / regulatory |
| W-17 real step-up + commission=0 + REVOKE | 45% | 3–5 | Forgeable money-auth + public-promise rake |
| W-20 hosted checkout origin | 15% | 5–7 | Signed handoff is a dead link |
| W-31 honesty badge (money surfaces) | 10% | 1–2 | A stub must not read as success |
| W-35 observability floor (restore drill + alerting) | 35% | 3–5 | V1 P0 tested restore + money alerts |
| **Plus strongly-advised beta hardening** | | | |
| W-05 asymmetric token re-key | 30% | 5–8 | One leak forges 7 domains (S1) |
| W-32 transactional outbox | 55% | 2–4 | Events lost on crash (S1) |
| W-33 compensation executor | 35% | 2–3 | Captured-but-failed strands money (S1) |
| W-21 reservation sweeper + side doors | 70% | 1–2 | Phantom OOS / unbounded growth |
| W-07 DPDP consent + DSR | 15% | 3–4 | India legal |
| W-34 webhook replay-window + SSRF | 80% | 1–2 | Replay self-heal + SSRF |
| W-29 mobile-bff composites (interim) | 35% | 1 (interim) of 3–5 | Dashboard latency |
| W-01 governance retarget (so fixes can land) | 20% | 4–6 | Deletions fail CI otherwise |
| W-03 domain canonicalization (couples W-20) | 35% | 2–4 | `.store`→`.com`, checkout DNS |

**Beta rollup math.** The strict go-live-gating set sums to **~42–60 eng-weeks** (dominated by W-08 tenancy at 12–16 and the money cluster W-13/14/15/17 at ~17–26). Adding the strongly-advised beta hardening (asymmetric re-key, outbox, compensation, consent, governance retarget, domain) brings it to **~70–95 eng-weeks** — the **~80 eng-week** planning number in the executive verdict. **Serial critical path** (Master Plan §5.1): *clean-tree → commit switch fix → deploy capability → engage RLS off-service_role → ledger GUC from claims → capture posts ledger → reconciliation closes → safe PA-split payout → hosted origin → usable handoff → beta-ready checkout.* The two genuine L long-poles on that path are **W-08 (off-service_role)** and **W-20 (hosted origin)** — fund them first within their waves. With 2–3 parallel squads, **wall-clock ≈ 4–6 months** to beta, bounded by that serial spine; everything off it (XSS/SSRF security cluster, governance/constitution, DS debt, the Liquid flip, OIDC, marketplaces) parallelizes or is deferred. **Excluded from the beta number (deferred 10k-end-state):** W-06 OIDC (~8–10), W-22 Liquid flip (~10–14), W-18 historical backfill (~5–7, only matters once there's real legacy money), W-16 bigint cutover (~5–7, pre-scale), W-25 catalog authoring, passkeys, gift-card-as-tender, the full DS ratchet-down — a further large block that does not gate the first real merchant.

---

## 7. Readiness Gap Findings

> ID | Winner | Completion% | Biggest gap | Remaining effort | Go-live gating | Evidence (path/ID)

| ID | Winner | Compl% | Biggest gap | Effort | Gating | Evidence |
|---|---|---:|---|---|:--:|---|
| RDY-000 | Deploy pipeline + branch lag | 10% | `main` 30 commits behind; S0 fix uncommitted ⇒ nothing ships | 1–2 wk / S | **YES** | TOPO-001/002, ISSUE-001/002; `production-deploy.yml:4-6` |
| RDY-001 | One-constitution + governance retarget | 20% | 181 validators enforce the rejected arch; V1 referenced 0× | 4–6 wk / M | No (gates deletions) | ARCH-005/006, TOPO-024 |
| RDY-002 | Canonical 8-runtime topology | 80% | Over-deploy (marketplace/dev-portal/2nd console) + fabricated reserved services | 3–5 wk / M | No | PLATFORM 4-realities table; `production-topology.json` |
| RDY-003 | Domain → `letbuyy.com` | 35% | `.store` split-brain live; no `checkout` DNS record | 2–4 wk / M | No (P0 infra) | ARCH-018, PLT-008; `dns.tf:5-126` |
| RDY-004 | identity-platform sole issuer | 45% | 4 parallel auth impls; switch S0 uncommitted; no default-deny middleware | 8–11 wk / L | **YES** (S0 part) | Identity D-01/D-06; AUTH §1 |
| RDY-005 | Asymmetric sole-signer token kernel | 30% | All-symmetric; `AUTH_SECRET` forges 7 domains; MOCK_JWKS | 5–8 wk / L | No (S1) | AUTH-002; Identity §5 |
| RDY-006 | OIDC provider | 5% | 501 skeleton; 0/16 capabilities; advertises unusable JWKS | ~8–10 wk / L (deferred) | No | AUTH-020; Identity D-13 |
| RDY-007 | DPDP consent ledger + DSR | 15% | Nobody owns consent; no ledger, no DSR (India legal) | 3–4 wk / M | Partial | Identity D-10; V1 §3 |
| RDY-008 | Layered RLS+GUC tenancy backstop | 30% | Gateway = service_role ⇒ RLS decorative; GUC bridge has 0 live callers | 12–16 wk / L | **YES** | FND-008, DB-004, ARCH-008, TEN-002; `107:17-19` |
| RDY-009 | App-layer query-lint + ownership | 70% | Presence-not-value; non-registry tables pass; not in workers | 2–3 wk / S | No | FND-012/013/014, TEN-003 |
| RDY-010 | FORCE+GUC on all 261 tenant tables | 20% | ~220 baseline tables ENABLE-only (owner-bypassable); 64 nullable keys | 3–5 wk / M | Partial | FND-009/021/022, TEN-004 |
| RDY-011 | Anon RLS-to-PUBLIC leaks + allowlist (S0) | 0% | 6 `USING(true)` anon policies + anon-writable super-admin | 1–2 wk / S | **YES** | ISSUE-003…008; `000_baseline.sql:26571-26739` |
| RDY-012 | Canonical double-entry ledger (SSOT) | 65% | Fed by new APIs, starved by legacy volume paths; 4 parallel ledgers | (rolls up) | **YES** | MNY-001, ARCH-021; `139:83-92` |
| RDY-013 | Ledger the live capture/refund/COD | 40% | Legacy capture/refund/COD post ZERO ledger ⇒ book blind to ~100% volume | 6–9 wk / M | **YES** | MNY-003/004/005, PAY-001/002/003; `baseline:1590` (INSERT ledger_=0) |
| RDY-014 | PA-split payout (kill razorpayx) | 45% | Hardcoded `razorpayx` self-custody (R-6); split client unbuilt | 4–6 wk / M | **YES** | MNY-006, ARCH-002, PAY-014; `payouts.ts:119-121` |
| RDY-015 | Reconciliation closure + schedulers | 50% | Recon/backfill schedulers DDL-real, wiring-dead (0 callers) → wallet locks; no money-out reconcile-on-uncertainty | 4–6 wk / M | **YES** | ARCH-037, MNY-012, PAY-013; `160:260,279` |
| RDY-016 | bigint-paise representation cutover | 40% | 4 money reps coexist live; missed cast = 100× error; int32 overflow | 5–7 wk / L | No (S2) | MNY-002, DB-003 |
| RDY-017 | Real step-up + commission=0 + REVOKE | 45% | Forgeable string-length step-up; live 3% rake vs 0% promise; append-only trigger-only (0 REVOKE) | 3–5 wk / M | **YES** | MNY-008/009/013, PAY-008/018/021, ARCH-001 |
| RDY-018 | Zero-loss historical backfill | 25% | Backfill tool is a cross-tenant footgun; no orchestration/proof | 5–7 wk / L | No (completeness) | MNY-015, DB-012; `160:279` |
| RDY-019 | Server-authoritative cart + session | 90% | Signature not cart-content-bound; legacy client cart persists | 1–2 wk / S | No | ARCH §8 APPROVED; `cart-routes.ts:541-575` |
| RDY-020 | Hosted checkout origin | 15% | No serving surface/DNS/rewrite ⇒ signed handoff = 404 host | 5–7 wk / L | **YES** | ARCH-003, CHK-015 (MISSING); `cart-routes.ts:293-303` |
| RDY-021 | Inventory sweeper + side doors | 70% | Sweeper DDL-real, wiring-dead (0 callers); 2 oversell side doors | 1–2 wk / S | No | ARCH-012, CHK-002…005; `141:304` |
| RDY-022 | Liquid theme system (renderer flip) | 40% | Liquid engine shipped but flagged OFF; regex sanitizer; ~20 ports + Security suite unbuilt | ~10–14 wk / L (deferred) | No | THEME-001/012, DEC-1; `theme-governance.ts:14` |
| RDY-023 | Theme foundation unification | 55% | 3 schema sources, 2 draft systems written in one call, forked compose | 4–6 wk / M | No | THEME-003/004/005, DEC-3/4/5 |
| RDY-024 | Theme editor (web + Flutter) | 80% | Web drag-reorder + lint panel missing; "AI hooks" mislabeled | 1–3 wk / M | No | THEME-006/011, DEC-7 |
| RDY-025 | theme-marketplace machinery | 75% | Catalog = 1 theme (deferred); machinery complete | (deferred) | No | THEME-008, DEC-10 |
| RDY-026 | Storefront runtime (SSR + cache) | 80% | `runtime-composition` dormant-pkg wired in; stored-XSS pair | 2–3 wk / S–M | No | PERF §1; ISSUE-016/017; A6 |
| RDY-027 | Merchant control plane (web OS) | 70% | No `AppNavigation` adoption; no Money node; dashboard fan-out | 3–5 wk / M | No | UI-UX §3.1; PERF-002 |
| RDY-028 | Merchant mobile app + release | 65% | Debug-keystore only (release blocker); TD-5 ~974 ln present; no badge/pinning | 3–5 wk / M | No | MOBILE audit, ARCH-009, AUTH-018 |
| RDY-029 | mobile-bff composites | 35% | 305-line pass-through; zero composite endpoints (its raison d'être) | 3–5 wk / M | No | ARCH-019, PERF-001/002/003; `mobile-bff/src/index.ts:302` |
| RDY-030 | Unified design system | 55% | 3 token sources; shell 2/9; mobile bypasses bridge; ratchet baselines drift | 4–6 wk / M (mostly deferred) | No | UI-UX §0/§1; `design-system-baseline.json` |
| RDY-031 | Provider-mode honesty badge | 10% | No badge component anywhere; one raw text echo | 1–2 wk / S | Partial | ARCH-020, MOB-005; `money_screen.dart:256` |
| RDY-032 | Transactional outbox + catalog | 55% | Dual-write non-atomic (REST after commit; silent null); relay in wrong service | 2–4 wk / M | No (S1) | ARCH-004/013; `event-execution.adapter.ts:60-88` |
| RDY-033 | Compensation executor | 35% | Rows written, **zero executors** ⇒ auto-refund never runs | 2–3 wk / M | No (S1) | ARCH-011, PAY-026; `checkout.ts:396-424` |
| RDY-034 | webhook-service | 80% | No timestamp-window; retry suppressed after failure; outbound SSRF | 1–2 wk / S–M | No | ARCH §3.1 APPROVED; PAY-016, ISSUE-020 |
| RDY-035 | Observability/monitoring kernel | 35% | No alerting; restore drill staged-not-executed (PITR skipped); no money-drift monitors | 3–5 wk / M | Partial | ARCH-035, SEC-017/A09; `SKIP-W0-PITR-TIER` |
| RDY-036 | Thin internal-ops sliver | 55% | No maker-checker (single-actor only); dispute log likely MISSING | 3–4 wk / M | No | ARCH-022/029 (dispute log UNVERIFIED) |
| RDY-037 | SAFE_DELETE dead packages | 0% | Dead packages are load-bearing imports + validator-kept ⇒ deletion fails CI | 2–3 wk / M | No | ARCH-026; SAFE_DELETION_PLAN |

---

## 8. UNVERIFIED register (carried forward; never silently upgraded to fact)

1. **Live/deployed state of everything** — this is a working-tree audit. No fix (RLS policies, indexes, workers) is provably in the *production* database; `main` is 30 behind, so the live estate runs pre-wave code. **Every completion% above is tree-state; live readiness is ≈0% until RDY-000 clears.** (Confidence on "live" = Low across the board.)
2. **The 6 anon RLS-to-PUBLIC GRANTs (RDY-011)** are set by Supabase's managed bootstrap outside the repo; strongly evidenced as live (107 header + Supabase defaults + zero REVOKE) but require an anon-key probe / `\dp public.orders` before final S0 sign-off.
3. **Money-kernel test depth (RDY-012…018)** — ~20 Postgres test files exist and waves claim PASS, but were **not executed in-audit**; property/concurrency rigor is asserted by file presence.
4. **Reconcile-on-uncertainty for UPI collect-timeout** — not located; may exist under another name (PAY/ARCH UNVERIFIED).
5. **Dispute/chargeback log (RDY-036)** — no dedicated table/route found; likely MISSING but not exhaustively disproven.
6. **COD no-confirm ⇒ auto-cancel/hold timer** — no scheduled job found (consistent with the missing-timer pattern).
7. **Shared `AUTH_SECRET` topology** — secret values not inspectable from source; the forgery *surface* is code-proven, the live secret reuse is not.
8. **Mobile cert-pinning / Flutter security depth (RDY-028)** — assessed from files read only; pinning absence and `debugPrint` leakage are inferences.
9. **Performance figures (RDY-026/029, observability §4)** — all latency/round-trip counts are *code-estimated*, not measured (no profiler, no live traffic); real p95/cache-hit/bundle-bytes are UNVERIFIED.
10. **Fine-grained RBAC enforcement breadth** — spot-checked, not exhaustively traced across all mutation routes.
11. **Live DNS / domain state (RDY-003)** — `.store` vs `.com` routing asserted from config; live DNS UNVERIFIED.

---

*End of Part 10 — Production Readiness Gap Report. Evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty, 2026-06-10. Completion percentages measure the working tree; live readiness is gated on RDY-000 (the deploy meta-blocker). This document scores readiness; the A1–A9 sibling deliverables own the canonical decisions it scores against. No repo code was modified.*
