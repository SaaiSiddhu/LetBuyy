# LETBUYY FINAL ARCHITECTURE SCORECARD + CLOSING DELIVERABLE

> **Document type:** DOC 07 of the Governance Rewrite — the final architecture scorecard **and** the program's closing deliverable (the five ranked TOP-20 lists + the implementation-readiness verdict).
> **Authority position (per `_GOVERNANCE_SPINE.md` S2):** subordinate to the Constitution (DOC 01), AGENTS_V2 (DOC 02), and the Canonical Systems registry (DOC 03); it **scores** the architecture those docs ratify — it does not re-litigate the winners (S5 is decided).
> **Supersedes:** all prior scattered scorecards (the June-09 sets, the per-audit verdicts). This is the single, weighted, evidence-anchored state-of-the-platform reading the program closes on.
> **Date:** 2026-06-10 · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · **Evidence baseline:** `stepup/main` @ `c4fc3cd6`, working tree dirty.
> **Evidence base (read first, not re-litigated here):** `FORENSIC_MASTER_2026_06_10/` (291 issues / 9 S0; `TOP_250_PLATFORM_ISSUES.md` ISSUE-IDs), `STRATEGIC_CANONICALIZATION_2026_06_10/` (`PRODUCTION_READINESS_GAP_REPORT.md` W-00…W-37 completion%/effort; `CANONICAL_ARCHITECTURE_MATRIX.md` LEG/DEL/CANONICAL; `SHOPIFY_ALIGNMENT_REPORT.md` align/diverge/leapfrog), and `_GOVERNANCE_SPINE.md` (S5 winners / S6 never-build / S7 phases).

> **The one-line state of the platform.** *LetBuyy built the hard, correct cores V1 asked for — a Stripe-grade double-entry ledger, a server-authoritative cart, a competent four-flow auth surface, a Polaris-grade token engine, a Shopify-OS-2.0-shaped theme model, and a genuinely strong cached storefront — then left them un-wired to the live paths, governed by the rejected constitution, and unmergeable behind a 30-commit branch lag. Current weighted architecture score: **~3.0/10. Target: 10/10. Headline gap: 7.0 points / ~80 engineering-weeks / ~4–6 months wall-clock to a responsible beta, gated on the 9 S0s and the deploy meta-blocker.*** The program is **deletion and completion, not new construction.**

---

## PART A — THE ARCHITECTURE SCORECARD (DOC 07)

### A.1 — How to read the scores

- **Current State (0–10):** the working-tree architecture quality against the V1 target, grounded in forensic evidence. It is **not** "live readiness" — *nothing in the working tree is live* until the deploy meta-blocker clears (`main` is 30 commits behind; ISSUE-002), so every "current" score is tree-state and **live readiness is ≈0/10 platform-wide** until P1. A domain can be "well-architected in tree" and "0% in production."
- **Target State:** **10/10** for every domain — the V1 canonical end-state for the 100→1k→10k India envelope (S3/S4), *not* a Shopify-1M end-state.
- **Gap = Target − Current.** **Priority:** P0 (go-live blocker / live exploit) · P1 (beta-hardening, money/legal) · P2 (pre-scale correctness) · P3 (debt/polish).
- **Effort:** eng-weeks to reach the *beta-ready* bar for that domain (excludes deferred 10k-end-state scope), sized XS/S/M/L (XS ≤0.5 · S 0.5–1.5 · M 2–4 · L 5–10).
- **Scoring basis:** each domain rolls up the relevant `PRODUCTION_READINESS_GAP_REPORT.md` winners (W-NN completion%) and the forensic severity (S0/S1 weight), converted to a 0–10 architecture score (completion% ÷ 10, then docked for any open S0/S1 that makes the built part untrustworthy on the live path).

### A.2 — The scorecard table

| # | Domain | Current /10 | Target | Gap | Priority | Effort (eng-wk · size) | Business impact (one line) |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| 1 | **Architecture (topology/runtime)** | **6** | 10 | 4 | P1 | 8–12 · M | The 8-runtime monolith estate is genuinely right; over-deploy + dead-package debt + governance-for-the-wrong-arch is the drag. |
| 2 | **Identity / Auth / Sessions** | **3** | 10 | 7 | **P0** | 14–18 · L | A live unauthenticated account-takeover ships on every branch; 4 parallel auth impls; one shared secret forges 7 trust domains. |
| 3 | **Payments (capture/refund/COD)** | **3** | 10 | 7 | **P0** | 10–14 · L | Live capture/refund/COD post **zero** canonical ledger; a 3% rake violates the public 0%-fee promise; step-up is a forgeable string check. |
| 4 | **Ledger (double-entry SSOT)** | **6** | 10 | 4 | **P0** | (rolls into Payments) | The kernel is Stripe-grade and correct — but fed by new APIs and **starved by the legacy paths that carry 100% of live volume**; 4 parallel ledgers persist. |
| 5 | **Settlement / Payout / Recon** | **4** | 10 | 6 | **P0** | 8–12 · L | Hardcoded `razorpayx` self-custody (regulatory breach); recon/backfill schedulers are DDL-real, wiring-dead → wallet locks; no reconcile-on-uncertainty strands payouts. |
| 6 | **Tenant Isolation** | **2** | 10 | 8 | **P0** | 15–20 · L | The structural long-pole: gateway connects as `service_role` so RLS is decorative platform-wide, **plus 6 anon PUBLIC table leaks + an anon-writable super-admin allowlist** — live cross-tenant read/write. |
| 7 | **Theme Engine** | **5** | 10 | 5 | P2 | 4–6 · M (beta) | A Shopify-OS-2.0-grade model with two renderers; the Liquid winner is built-but-flagged-OFF, the live React fork is the duplication tax; editor is the strong point. |
| 8 | **Checkout / Cart / Inventory** | **5** | 10 | 5 | **P0** | 6–9 · L | The cart is server-authoritative and oversell-safe (the hard part is right) — but the hosted `checkout.letbuyy.com` origin the signed handoff targets is a **404**, and the sweeper/side-doors leak stock. |
| 9 | **Merchant OS / Mobile** | **6** | 10 | 4 | P1 | 6–10 · M | The best-finished surfaces (Flutter app 3.1/5, web OS operator-first) — held back by debug-keystore-only release, a 305-line pass-through BFF, no Money node, no honesty badge. |
| 10 | **UI / UX / Design System** | **5** | 10 | 5 | P1/P3 | 4–6 · M | A Polaris-grade token engine fractured into 3 token sources + 8 hand-rolled shells (2/9 adoption); the ratchet baselines drift as "passing"; no provider-mode honesty badge anywhere. |
| 11 | **Operations / Observability** | **3** | 10 | 7 | P1 | 3–5 · M | The least-built kernel: logs+redaction exist but **alerting is absent and the restore drill is staged-never-executed (PITR off)** — a single-region money DB with no proven recovery. |
| 12 | **Deployment / Release** | **1** | 10 | 9 | **P0** | 1–2 · S | The meta-blocker: `main` is 30 commits behind, so **every "complete" fix — including the S0 patch — is undeployed**; the deployed estate runs pre-wave code. Catastrophe-to-effort ratio is the headline. |
| 13 | **Security (cross-cutting)** | **2** | 10 | 8 | **P0** | 8–12 · M | Posture 2.4/5: the 9 S0s + buyer-facing stored-XSS pair + `unsafe-inline` CSP + webhook SSRF + mock-only KMS (PII plaintext). Attacks are logged and ignored. |
| | **WEIGHTED OVERALL** | **≈3.0** | **10** | **7.0** | **—** | **~80 eng-wk** | A correct core hidden behind a green governance gate that certifies the rejected architecture while live S0s ship. |

**Weighting (founder/go-live lens).** The overall is risk-weighted, not a flat average, because a leak or a wrong book outranks a polish gap: Tenant Isolation, Payments, Ledger, Settlement, Identity, Deployment, Security carry **~70% of the weight** (money-correctness + data-leak + live-exploit + the universal deploy precondition); Checkout/Theme/Merchant-OS carry **~22%**; UI/UX + Operations carry **~8%**. On a flat average the 13 domains score ~3.9/10; **risk-weighted they land ≈3.0/10**, because the heaviest domains (Tenancy 2, Deployment 1, Security 2, Payments 3, Identity 3) are the lowest. **Target 10/10 weighted; headline gap 7.0.** *(Cross-check: this aligns with the forensic master's "~2.4–2.5/5" engineering reality = ~4.8–5.0/10 on raw build quality, docked to ~3.0 once the live-exploit + undeployed-remediation reality is priced in — the gap between "built" and "trustworthy on the live path.")*

### A.3 — Per-domain justification (evidence-anchored)

**1. Architecture — 6/10.** The canonical 8-runtime estate (modular monolith `api-gateway` ~83k LOC + `queue-workers` + `webhook-service` + `mobile-bff` + 4 Vercel apps over one Postgres on Cloudflare/Vercel) genuinely deploys and is the *correct* topology for the envelope (ARCH §3.1 APPROVED; W-02 = 80%). It loses 4 points to: (a) **over-deploy** — the V1-rejected `app-marketplace` (19.5k LOC) + `developer-portal` ship to production "an empty mall" (ISSUE-061, R-11), and a redundant ops console; (b) **fabricated topology** — `production-topology.json` stamps 6 reserved services as `environment:"production"` plus k8s/Helm/Firebase fantasy infra; (c) **the governance inversion** — CI enforces the *rejected* 9-app/CQRS/multi-region `AGENTS.md` and references V1 zero times. 10/10 = the V1 8-runtime list deployed, reserved services honestly `reserved`, dead packages deleted, governance retargeted to V1.

**2. Identity / Auth — 3/10.** Individually the flows are real and coherent (bcrypt-12, CSPRNG OTP, rotating reuse-detecting sessions, real OAuth2-PKCE-S256) — the *new* Shopify identity model, correctly chosen (SHOPIFY §5 ALIGN). But it scores 3, not 6, because of **live exploits and structural smear**: the `/api/auth/switch` **unauthenticated account-takeover is fixed only in an uncommitted working tree — every deployable branch is exploitable** (ISSUE-001, S0); identity is implemented **4 ways** (identity-platform lib + gateway `routes/auth.ts` 1,441 ln + identity-foundation 18-file shadow + legacy Supabase `/auth/*`; ISSUE-064); a single shared `AUTH_SECRET` HS256 is the fallback across **7 trust domains** so the verification key is the forgery key (ISSUE-027, S1); the OIDC provider is a 501 skeleton advertising a `MOCK_JWKS` it cannot sign with (AUTH-020). 10/10 = identity-platform sole **asymmetric** issuer for all 3 realms, HS256 path gone, default-deny middleware, OIDC honestly deferred (404, not placeholder).

**3. Payments — 3/10.** The capture/refund **V1 API** posts canonical correctly — but the storefront and **every webhook** use the legacy `confirm_order_payment_with_ledger` RPC that, despite its name, inserts **zero** `ledger_*` rows (`grep "INSERT INTO ledger_" = 0`; ISSUE-010), so the canonical book is blind to ~100% of live captures; refunds via the returns path and COD remittance are likewise un-ledgered (ISSUE-018/019). On top of the wiring gap sit two constitution violations: a live **3% GMV rake + 18% GST-on-fee** against the public 0%-fee promise (ISSUE-015), and a **forgeable step-up** (any string ≥12 chars + fresh timestamp passes; ISSUE-012). 10/10 = every live money event posts canonical idempotently, `commission_bps=0`, real HMAC/stored-challenge step-up.

**4. Ledger — 6/10.** The kernel is genuinely Stripe-grade: 8 named accounts (`139:83-92`), bigint paise, Σdebit=Σcredit trigger, append-only trigger, `post_ledger_transaction` idempotent + balance-checked, `claim_payout_statement_release` FOR-UPDATE-gated (the double-release fix done right). It scores 6 not 9 because **completeness, not correctness, is the gap** — it is starved by the legacy volume paths (see Payments), 4 parallel legacy ledger families persist beside it (`wallet_/partner_payout_/gift_/store_credit_`; ISSUE-065), and append-only is **trigger-only with zero `REVOKE`** in the corpus — one `DISABLE TRIGGER` mutates money history (ISSUE-021). 10/10 = the canonical ledger is the *sole* feed, REVOKE+RESTRICT-hardened, compat tables read-only-derived, historical backfill proven to zero drift.

**5. Settlement / Payout / Recon — 4/10.** Settlement ingest is correct (posts only when balanced + zero-break, **no auto-plug** — keep it; W-15). But the payout **rail is hardcoded `razorpayx`** — a from-own-account disbursement product that is a direct R-6 self-custody breach, with metadata falsely stamping `no_custody:true` (ISSUE-014); and **two load-bearing schedulers are DDL-real, wiring-dead** — the wallet→canonical backfill/assert (`160:260,279`) has zero callers so the wallet endpoint hard-fails 409 `LEDGER_RECONCILIATION_REQUIRED` indefinitely (ISSUE-023), and there is **no reconcile-on-uncertainty for money-out** so a PA-success+local-fail strands a payout with money gone and no break (ISSUE-070/PAY-013). 10/10 = PA-split (Route/Cashfree) custodies, LetBuyy only instructs + mirrors, schedulers wired, reconcile-to-zero-or-suspense.

**6. Tenant Isolation — 2/10 (the structural long-pole).** Two compounding failures. **Architectural:** the gateway is stateless PostgREST connecting as `service_role`, which **BYPASSES RLS** — the repo's own migration `107:17-19` admits it — so FORCE-RLS + the per-tx GUC bridge (built, fail-closed *in tests*) **never engage in production**; the GUC statement factory and `tenantScoped()` have **zero live callers** (ISSUE-009, S0; FND-008/DB-004). **Acute:** 6 baseline `service_role_* USING(true)` policies lack a `TO` clause and therefore grant **anon** read/write on orders/customers/billing/products/sites/subscriptions, plus an **anon-writable `super_admin_allowlist`** (self-grant platform super-admin) and anon `PATCH sites.user_id` (store takeover) — ISSUE-003…008, six S0s. The DDL is excellent; it is decorative. 10/10 = `app_tenant` non-bypass pooled connection runs `SET LOCAL app.site_id` from a *validated claim* per request, FORCE+GUC on all 261 tenant tables, `service_role` demoted to an audited break-glass hatch, all 6 PUBLIC policies dropped.

**7. Theme Engine — 5/10.** The most genuinely-built subsystem — a real OS-2.0 model (sections/blocks/JSON-templates/section-groups + typed schema + versioning/rollback), ~62% Shopify parity in code, the clearest "copied the load-bearing pattern" success (SHOPIFY §2). It scores 5 because the **strategic winner is turned off**: the Liquid/portable renderer is built but `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`, so the live path is a React-per-section fork that Liquid was meant to replace (ISSUE/THEME-001), with a brittle **regex output-sanitizer** (a hard security gate before any Liquid render reaches buyers; ISSUE-016 storefront stored-XSS), three schema sources, and two draft systems written in the same call (THEME-003/004/005). The editor (web + Flutter) is the protected differentiator at 80%. 10/10 = Liquid is the default renderer (per-theme + canary), DOMPurify sanitizer, one schema source, one draft system. **Correctly deferred** to Wave 3+ — the only beta theme action is FREEZE the duplication.

**8. Checkout / Cart / Inventory — 5/10.** APPROVED in the compliance audit: server-priced lines, oversell-safe under `FOR UPDATE`, one `create_checkout_order` RPC, per-step idempotency, a real forward-only state machine, signed HMAC handoff (W-19 = 90%). The 5-point dock is **the origin it hands off to**: `checkout.letbuyy.com` has **no serving surface, route, or DNS** — the signed URL points at a 404 host (ISSUE-030, "the point of the exercise"); the signature does not bind cart *contents* (mutable in the 10-min window; CHK-001); the stale-reservation sweeper is wired to no cron (ISSUE-024) and 2 side-doors bypass the reserve→commit path (ISSUE-029). 10/10 = hosted origin live, cart-bound signature, public order-door gated behind the handoff, sweeper scheduled.

**9. Merchant OS / Mobile — 6/10.** The strongest cluster: the Flutter merchant app is the best surface (3.1/5; login *works* on prod with real Turnstile + secure storage), the web control plane is genuinely operator-first with the deepest `@letbuyy/ui` adoption. It loses 4 to: the mobile **release pipeline is debug-keystore only** (a hard *ship-the-app* blocker; ISSUE-052); `mobile-bff` is a **305-line pass-through with zero composite endpoints** — the N+1 it exists to kill is fully live (~7 serial round-trips; ISSUE-034/057); no first-class Money node; the TD-5 parity catalog (~974 ln) is still routed (ISSUE/LEG-072); no honesty badge. 10/10 = real release signing, real fan-in BFF composites, Money node, TD-5 deleted, honesty badge.

**10. UI / UX / Design System — 5/10.** A Polaris-grade token engine (`tokens.ts` 1,388 ln, DTCG) + a real CI ratchet exist — the foundation is strong. But it fractures into **3 token sources**, **8 hand-rolled shells (AppNavigation adoption 2/9)**, 4 mobile color classes (mobile is a de-facto separate DS bypassing the generated bridge), and the **ratchet baselines existing drift as "passing"** rather than blocking (573 rgb/hsl + 1,382 px frozen as OK; ISSUE-055), with stylelint wired but never installed (ISSUE-056). No provider-mode honesty badge component exists anywhere (ISSUE/ARCH-020). 10/10 = one token source, one shell 9/9, ratchet that blocks + burns down, honesty badge on every money surface, WCAG AA. **Mostly Phase-E debt** — the one go-live-relevant item is the honesty badge.

**11. Operations / Observability — 3/10.** The platform built the *recording* half and skipped the *reacting* half — the least-complete kernel (W-35 = 35%). Structured JSON logs + validator-enforced PII redaction + an audit dual-write exist, but **alerting is absent** (dangerous-input + CSRF events are `console.warn`'d, never alerted or blocked — SEC-017/OWASP-A09), the **restore drill is staged-never-executed with PITR explicitly skipped** (`SKIP-W0-PITR-TIER`) so a single-region money DB has **no proven recovery** (ARCH-035, a V1 P0 hole), and no money-correctness monitors run (`pa_clearing` drift, reconciliation variance, stranded payouts all unmonitored). 10/10 = structured-logs+redaction, audit relay, alerting that fires + blocks, **a tested restore drill with PITR live**, money-drift monitors.

**12. Deployment / Release — 1/10 (the meta-blocker).** `production-deploy.yml` triggers only on `main`, which is **30 commits behind** `stepup/main` where every fix lives; the S0 auth patch is uncommitted in a dirty tree (ISSUE-001/002). The consequence dominates the whole scorecard: **none of the 8 "complete" remediation waves reach production** — the deployed estate runs pre-wave code, so every other domain's "current" score is tree-only and live readiness is ≈0. It scores 1 (the pipeline exists and deploys 13 runtimes) not 0. The catastrophe-to-effort ratio is the headline: **1–2 eng-weeks** unblocks everything. 10/10 = `main` is the deploy branch and current, S0 committed + deployed, branch-lag CI guard, one staging workflow.

**13. Security (cross-cutting) — 2/10.** Posture 2.4/5. Beyond the 9 S0s (rolled into Identity/Tenancy above), the live-exploit surface includes a **buyer-facing stored-XSS pair** through a bypassable regex sanitizer (ISSUE-016) under a `script-src 'unsafe-inline'` CSP that removes the only containment (ISSUE-017), an **outbound webhook SSRF with exfiltration** to cloud-metadata/internal hosts (ISSUE-020), **mock-only KMS** so the constitution's strongest data control is unimplemented and PII is plaintext (ISSUE-026), and the A09 failure that attacks are logged and ignored. 10/10 = the 9 S0s closed, DOMPurify + nonce-CSP, SSRF blocklist, real KMS envelope-encrypting PII, security events alerted + blocked.

---

## PART B — THE FINAL DELIVERABLE: FIVE RANKED TOP-20 LISTS

> *The thing a leader reads first.* Each list is ranked by value/safety/leverage. Every item carries a one-line rationale + the ISSUE-ID / LEG-DEL ref / evidence. These are the program's closing artifacts — the decisions ratified, the systems to delete, the foundations to build, the blockers to clear, and the principles to adopt.

### B.1 — TOP 20 CRITICAL DECISIONS (the strategic-winner + governance decisions this program ratifies)

> *What the company has now decided is true. These become constitutional articles (DOC 01) and the winner registry (DOC 03).*

| # | Decision | Rationale + evidence |
|---:|---|---|
| 1 | **One modular monolith + 4 satellites over one Postgres — never a service fleet.** | The 8-runtime estate already works; the 22-service/CQRS/multi-region end-state is rejected for the 100→10k envelope (Spine S3/S4; ISSUE-045/046). |
| 2 | **The canonical append-only double-entry ledger is the SOLE money source of truth; balance always derived, never a mutable column.** | The kernel is Stripe-grade and correct; the 4 legacy ledgers + mutable balances are the drift (Spine S5; ISSUE-065; `139:83-92`). |
| 3 | **`identity-platform` is the SOLE token issuer for all 3 realms; every other runtime is verify-only.** | Collapses the 4 parallel auth impls; ends the "two/four parallel systems" auth tax (Spine S5; ISSUE-064). |
| 4 | **Tokens are ASYMMETRIC (EdDSA/Ed25519, ES256 fallback) — the verification key must stop being the forgery key.** | One shared `AUTH_SECRET` HS256 forges 7 trust domains today (ISSUE-027; AUTH-002). |
| 5 | **RLS is load-bearing: `app_tenant` non-bypass connection + per-tx GUC from validated claims fail-closed; `service_role` is a narrow audited hatch.** | RLS is decorative platform-wide today because the gateway is `service_role` (ISSUE-009). |
| 6 | **ONE constitution + V1-enforcing validators — the generated `AGENTS.md` and the 181 theater validators are retired.** | CI certifies the *rejected* architecture green while 9 S0s ship; zero validators reference V1 (ISSUE-045/046). |
| 7 | **0% transaction fee, permanent — any GMV/transaction rake is forbidden.** | The 3% rake violates the public promise and forfeits the strategic wedge; monetize via subscription only (ISSUE-015; SHOP-004). |
| 8 | **NEVER custody funds — merchant is MoR on their own Razorpay; a licensed PA (Route/Cashfree) custodies + disburses; LetBuyy only instructs + mirrors.** | The hardcoded `razorpayx` self-custody rail is an R-6 regulatory breach (ISSUE-014). |
| 9 | **Liquid / portable-theme (OS-2.0) is the strategic theme winner; React-per-section is a frozen first-party fast-path, delete-or-keep decided by Wave-6 data.** | Liquid is the only renderer that supports a marketplace / 3rd-party authors / portable themes; it is built but flagged OFF (THEME-001; SHOPIFY §2). |
| 10 | **Server-authoritative commerce with a single hosted `checkout.letbuyy.com` origin; orders only via `create_checkout_order`.** | The cart is already server-authoritative; the hosted origin is "the point of the exercise" and is a 404 (ISSUE-030; SHOPIFY §4). |
| 11 | **Money is `bigint` paise on every path — one representation.** | 4 representations coexist; one missed `::bigint` cast = 100× error; int32 overflows at ₹2.14cr (ISSUE-025/042). |
| 12 | **Reconcile to zero-break-or-explained-suspense — never auto-plug; money-out has reconcile-on-uncertainty.** | Settlement ingest already refuses to auto-plug (keep it); the gap is the un-wired schedulers + no payout reconciler (ISSUE-023/070). |
| 13 | **Real cryptographic step-up (HMAC/stored-challenge, actor+action-bound, single-use) + maker≠checker on money-out; append-only enforced by trigger AND `REVOKE`.** | Today's step-up is a forgeable string-length check; there is no second approver; append-only is trigger-only (ISSUE-012/021/038). |
| 14 | **Transactional outbox + typed catalog (same-tx write) — never an event bus; reserved `event-bus` stays empty.** | The dual-write is non-atomic today (loses events on crash); the outbox is the correct primitive (ISSUE-028). |
| 15 | **WhatsApp is a SCOPED commerce channel — order-lifecycle + COD-confirm + a fail-closed DPDP consent ledger — never the full in-thread stack.** | The durable India wedge is two S-sized features; full in-WhatsApp commerce is years premature (R-7; Spine S5). |
| 16 | **ONE design-system token source + ONE shell (`AppNavigation`) + a provider-mode honesty badge everywhere a stub could read as success.** | 3 token sources, shell 2/9, no badge — "a stub must never read as success" (V1 P4; ISSUE-049/055; ARCH-020). |
| 17 | **India-only; design for 100→1k→10k merchants; NEVER optimize for 100k+/1M+.** | ~30k orders/mo is trivial for one Postgres; sharding/multi-region/event-sourcing are out of scope by constitutional rule, not opinion (Spine S3). |
| 18 | **Passwordless-native identity (email/SMS OTP + OAuth2-S256-PKCE); OIDC IdP + passkeys are honestly deferred (404, never placeholder JWKS).** | This is exactly where Shopify landed Feb 2026, and LetBuyy has no legacy password/Multipass corpus to migrate — a clean leapfrog (SHOPIFY §5). |
| 19 | **`main` is the single deploy branch and must stay current; a branch-lag CI guard prevents silent re-accumulation.** | The 30-commit lag is the meta-blocker that makes every other fix undeployed (ISSUE-002). |
| 20 | **The Shopify *end-state* machinery (3rd-party app marketplace + checkout extensions + Wasm runtime) is FROZEN behind a named trigger — reconsider at ~5k merchants + inbound developer demand.** | It is the #1 premature mimicry — "an empty mall with no supply"; keep the OAuth2/PKCE seam, delete the running executor (R-11; ISSUE-047/061; SHOPIFY §6). |

### B.2 — TOP 20 LEGACY SYSTEMS TO DELETE (ranked by value/safety)

> *Delete now or after the winner serves + zero-drift proof. Ranked by the catastrophe-or-cost removed per unit effort. LEG/DEL refs trace to `LEGACY_ERADICATION_REGISTER.md` / `SAFE_DELETION_PLAN.md` / the matrix.*

| # | System to delete | Why / fate · evidence |
|---:|---|---|
| 1 | **The 6 anon `USING(true)` → PUBLIC RLS policies** (orders/customers/billing/products/sites/subscriptions) | DEAD now — live anon read/write of commerce-core; replace with `TO service_role` + owner + REVOKE (ISSUE-004…008; matrix A2). |
| 2 | **The anon-writable `super_admin_allowlist` policy** | DEAD now — self-grant platform super-admin; the same mechanism but escalating to root (ISSUE-003; LEG-… A1). |
| 3 | **The `/api/auth/switch` takeover code path (HEAD)** | DEAD — unauthenticated account-takeover; the working-tree fix replaces it (commit + deploy) (ISSUE-001; LEG-028). |
| 4 | **The hardcoded `razorpayx` self-custody payout rail** | DEAD — R-6 regulatory breach; replace with PA-split default (ISSUE-014; LEG-039). |
| 5 | **The 3% GMV `commission_bps DEFAULT 300` rake + GST-on-fee** | DEAD — set `commission_bps=0`, stop auto-seeding (ISSUE-015; LEG-042). |
| 6 | **The forgeable `verifySensitiveActionStepUp` string-length check** | DEAD — replace with real HMAC/stored-challenge step-up off the 153 tables (ISSUE-012; LEG-040). |
| 7 | **The CQRS/saga/projection package cluster** (`projection-runtime`, `distributed-runtime`, `orchestration`, `extension-host`, `app-engine`, `application-services` ~13.3k LOC) | DEAD — capability absent from the envelope; inline the few used contracts then SAFE_DELETE (LEG-001…006; ISSUE/ARCH-026; W-37). |
| 8 | **`legacy/firebase/` (~15.3k LOC abandoned backend)** | DEAD → archive; the platform is Supabase + Workers (LEG-071; TOPO-019). |
| 9 | **The ~36 rejected-architecture "theater" validators** (replay/projection/saga/CRDT/failover/WAL/lease/multi-region) | DEAD — they enforce the rejected arch and *block* deletion of dead packages; SAFE_DELETE after retarget (LEG-063; ISSUE-046). |
| 10 | **The generated `AGENTS.md` (9-app canon) as active law** | TRANSITIONAL→retire — regenerate from V1 §6 / replace with AGENTS_V2; retire/retarget the generator so it can never re-promote drift (LEG-076; ISSUE-045). |
| 11 | **The 4 parallel legacy ledger families** (`wallet_/partner_payout_/gift_card_/store_credit_ledger_entries` + mutable balances) | LEGACY — make read-only projections of canonical; writes go through `post_ledger_transaction` (ISSUE-065; LEG-034…038). |
| 12 | **The TD-5 mobile parity catalog (`merchant_feature_*` ~974 ln, routed)** | DEAD — replace with real screens; it is fabricated parity (LEG-072; TOPO-012). |
| 13 | **The live Wasm checkout-functions runtime + `CheckoutExtensionHost`** | DEAD (R-11) — rip the executor out of the payment path; keep a documented seam (ISSUE-047; LEG-011). |
| 14 | **The gateway `identity-foundation/` shadow stack (18 files, 1,655 ln) + gateway `routes/auth.ts` session-mint (1,441 ln)** | DEAD/LEGACY — collapse to identity-platform; gateway → verify-only (ISSUE-064; LEG-024/025). |
| 15 | **The legacy Supabase `/auth/*` surface + 2nd reset pipeline + `user_metadata.role` channel** | LEGACY/DEAD — closes the role-escalation channel + orphan reset; one session regime (LEG-026/027; AUTH-004/010). |
| 16 | **`runtime-composition` wired into the storefront read path** | DEAD (DELETE_AFTER unwire) — the "dormant" label is fiction; unwire then delete (ISSUE-062; LEG-008). |
| 17 | **k8s/Helm fantasy infra + the duplicate staging workflow + fabricated `production-topology.json` reserved entries** | DEAD → archive/regenerate — Cloudflare+Vercel only; one staging workflow; topology derived from the real matrix (LEG-066/067/065; TOPO-013/015/016). |
| 18 | **The 8 hand-rolled navigation shells + 4 mobile color classes + 3rd token sources** | LEGACY — collapse to one `AppNavigation` + one generated bridge + one token source (ISSUE-049/050; LEG-030). |
| 19 | **The int32-paise / numeric-rupee / numeric(16,4) money columns** | LEGACY — bigint paise everywhere via expand/backfill/contract (ISSUE-025/042; LEG-043). |
| 20 | **~37 product-dead tables (theme-legacy ×6, ops-theater, diagnostics) + duplicate `provider_payment_id` index + ~60 superseded root docs** | DEAD → SAFE_DELETE after live-writer confirmation / archive — pure dead weight (LEG-050/061/062/075; UNVERIFIED live writers — confirm via `pg_stat_user_tables`). |

### B.3 — TOP 20 FOUNDATIONAL FIXES (the build/complete actions)

> *The work that turns "built in tree" into "trustworthy on the live path." Ranked by criticality × leverage. ISSUE-IDs anchor each.*

| # | Foundational fix | What it does · evidence |
|---:|---|---|
| 1 | **Unblock deploy + commit the S0 patch + add a branch-lag guard** | Makes every other fix shippable; the universal precondition (ISSUE-001/002; W-00). |
| 2 | **Drop the 6 PUBLIC policies + lock the allowlist (migration 162 + REVOKE)** | Closes the live anon leak set in one S-effort migration (ISSUE-003…008; W-11). |
| 3 | **Take the gateway off blanket `service_role`; build `withTenantTx(siteId, fn)` on a pooled `app_tenant` connection** | Engages RLS+FORCE+GUC for the first time; the structural long-pole (ISSUE-009; W-08, the largest single line). |
| 4 | **Ledger the live capture/refund/COD paths idempotently** | The #1 money-wiring blocker — makes the canonical book see live volume (ISSUE-010/011/018/019; W-13). |
| 5 | **Close reconciliation — wire the backfill/assert schedulers + add a payout reconcile-on-uncertainty** | Unlocks the wallet (today a permanent 409) and stops payouts stranding (ISSUE-023/070; W-15). |
| 6 | **Switch the payout rail to PA-split + wire the split-instruction client + derive `no_custody` from the rail** | Removes the self-custody breach; the regulatory gate (ISSUE-014; W-14). |
| 7 | **Set `commission_bps=0` + remove the double fee-posting + REVOKE UPDATE/DELETE on ledger/audit (RESTRICT FKs)** | Honors the 0% promise; hardens append-only against `DISABLE TRIGGER` (ISSUE-015/021/035; W-17). |
| 8 | **Real cryptographic step-up off the 153 tables + maker≠checker on money-out** | Replaces the forgeable second factor; two-person control on disbursement (ISSUE-012/038; W-17/36). |
| 9 | **Migrate the token kernel to asymmetric (Ed25519/ES256) + remove all 8 `|| AUTH_SECRET` fallbacks** | Verification keys stop being forgery keys; unblocks a real OIDC IdP (ISSUE-027; W-05). |
| 10 | **Collapse the 4 auth impls to identity-platform + default-deny `middleware.ts`** | One issuer, one session/cookie/logout regime (ISSUE-064; W-04). |
| 11 | **Build + deploy the hosted `checkout.letbuyy.com` origin + bind cart contents into the signature** | Makes the signed handoff a live link, not a 404; server-authoritative end-to-end (ISSUE-030; CHK-001; W-20). |
| 12 | **Make the outbox dual-write atomic (SECURITY DEFINER RPC, domain row + outbox in one tx; missing-table fatal) + move the relay to QW** | Stops losing money/lifecycle events on crash (ISSUE-028; W-32). |
| 13 | **Build the compensation executor (QW job: captured-but-order-failed ⇒ idempotent auto-refund)** | Delivers the buyer-protection guarantee V1 §9 promises; today the rows are written but never run (ISSUE-022; W-33). |
| 14 | **Schedule the stale-reservation sweeper + unify the 2 inventory side-doors onto reserve→commit** | Stops phantom OOS + unbounded table growth + oversell (ISSUE-024/029; W-21). |
| 15 | **Finish the bigint-paise cutover (expand→backfill→verify→contract) across orders/refunds/gift/usage** | Kills the cast-error + overflow class; pre-scale but a beta-hardening item (ISSUE-025/042; W-16). |
| 16 | **Apply FORCE+GUC to all 261 tenant tables (registry-driven backfill) + `SET NOT NULL` the 64 nullable tenant keys** | Makes the DB backstop unconditional once #3 lands (ISSUE-031; W-10). |
| 17 | **Ship the provider-mode honesty badge in `@letbuyy/ui` + Dart, bound to `provider_mode`, validator-enforced on money screens** | "A stub must never read as success" — the one go-live-relevant DS item (ISSUE/ARCH-020; W-31). |
| 18 | **Build the DPDP consent ledger + DSR export/erasure; gate WhatsApp sends on it (fail-closed)** | India legal requirement; the WhatsApp wedge needs it (D-10; W-07). |
| 19 | **Build the mobile-bff composites (`/v1/dashboard` fan-in) + a real release-signing pipeline** | Kills the dashboard N+1; makes the app shippable (ISSUE-034/052/057; W-29/28). |
| 20 | **Retarget governance to V1 (rewrite canonical lists, delete theater validators, add the 5 missing V1 gates) so deletions can land** | CI must enforce V1, not block the cleanup; the prerequisite to executing the deletion plan (ISSUE-045/046; W-01). |

### B.4 — TOP 20 PRODUCTION BLOCKERS (what blocks go-live)

> *The hard gates. The 9 S0s + the deploy meta-blocker + the money-correctness + observability set. All must close before any real merchant / live keys. Ranked by blast radius.*

| # | Blocker | Why it blocks go-live · evidence |
|---:|---|---|
| 1 | **Deploy meta-blocker — `main` 30 behind; S0 fix uncommitted** | Nothing ships; the deployed estate runs pre-wave code (ISSUE-002; S0). |
| 2 | **`/api/auth/switch` unauthenticated account-takeover (live on every branch)** | Full takeover of any merchant/staff account (ISSUE-001; S0). |
| 3 | **`super_admin_allowlist` anon INSERT → platform super-admin** | Anyone self-grants root; defeats all ops RBAC (ISSUE-003; S0). |
| 4 | **`sites` anon read + ownership-write → store takeover** | Anon takes over any store + reads all stores (ISSUE-004; S0). |
| 5 | **`orders` anon read+write → cross-tenant PII / payment-id leak** | Bulk order + customer-PII + payment-id exposure with the public key (ISSUE-005; S0). |
| 6 | **`products`/variants/options anon read+write** | All tenants' catalog readable + writable with the anon key (ISSUE-006; S0). |
| 7 | **`subscriptions`/`billing_history` anon read+write** | Billing tamper / plan-gate bypass / revenue-data leak (ISSUE-007; S0). |
| 8 | **`store_customers`/activity/wishlists bulk PII anon read** | Bulk customer-PII exfiltration (ISSUE-008; S0). |
| 9 | **Gateway runs as `service_role` → RLS+FORCE+GUC decorative platform-wide** | The architectural reason the leaks are catastrophic; no DB backstop on the live write path (ISSUE-009; S0). |
| 10 | **Live capture/refund/COD post ZERO canonical ledger** | The day live keys connect, the books are wrong for ~100% of volume; payouts gate to zero, the wallet locks (ISSUE-010/011/018/019; S1, money-gate). |
| 11 | **Hardcoded `razorpayx` self-custody payout rail** | R-6 regulatory breach + false `no_custody` stamp if taken live (ISSUE-014; S1). |
| 12 | **3% GMV rake against the public 0%-fee promise** | Merchants silently charged; trust/legal exposure; wedge forfeited (ISSUE-015; S1). |
| 13 | **Forgeable step-up on refund/payout + no maker-checker** | A single compromised owner session can drain payouts when live (ISSUE-012/038; S1). |
| 14 | **Reconciliation schedulers DDL-real, wiring-dead → wallet 409 forever + no money-out reconcile-on-uncertainty** | Wallet product-dead; a PA-success+local-fail strands money with no break (ISSUE-023/070; S1). |
| 15 | **Hosted `checkout.letbuyy.com` origin is a 404** | The signed handoff is a dead link in prod; the PCI-scope-shrinking checkout is absent (ISSUE-030; S1). |
| 16 | **Buyer-facing stored-XSS pair (regex sanitizer) under `unsafe-inline` CSP** | Cookie/session theft, card-skimmer on the storefront; CSP removes the only containment (ISSUE-016/017; S1). |
| 17 | **Outbound webhook SSRF with exfiltration** | SSRF to cloud-metadata/internal hosts with a response echo (ISSUE-020; S1). |
| 18 | **No tested restore drill / PITR off — single-region money DB, unproven recovery** | A V1 P0 hole; a DB SPOF with no proven recovery (ARCH-035; W-35). |
| 19 | **No alerting + no money-correctness monitors** | Attacks logged-and-ignored; `pa_clearing` drift / reconciliation variance / stranded payouts unmonitored (SEC-017/A09; ARCH-037). |
| 20 | **Outbox non-atomic + compensation executor never runs + append-only un-REVOKE'd** | Events lost on crash; captured-but-failed money strands; one `DISABLE TRIGGER` mutates history (ISSUE-028/022/021; S1). |

> **Note on counts.** The forensic master ratifies **9 live, continuously-exploitable S0s** (#2–#10 above) + the **deploy meta-blocker** (#1) as the Phase-A "stop the bleed" set; the remaining blockers (#10–#20) are the S1 "latent-until-live-keys" money/security/observability cluster that must close before live keys per the Phase-B "money-safe" gate. All **33 go-live blockers** close by end of Phase B / Wave 2. **UNVERIFIED:** the 6 anon GRANTs are set by Supabase's managed bootstrap outside the repo — strongly evidenced as live (migration 107 header + Supabase defaults + zero REVOKE) but require an anon-key probe / `\dp public.orders` before final S0 sign-off.

### B.5 — TOP 20 SHOPIFY-INSPIRED IMPROVEMENTS (principles to adopt — and what to IGNORE)

> *Copy Shopify's load-bearing **patterns**, never its **topology**. Ranked by leverage for the India 100→10k envelope. Source: `SHOPIFY_ALIGNMENT_REPORT.md` (SHOP-IDs).*

**ADOPT (the load-bearing patterns):**

| # | Principle to adopt | Why · Shopify ref |
|---:|---|---|
| 1 | **Liquid Online-Store-2.0 themes** (sections/blocks/JSON-templates/section-groups + typed `{% schema %}`) as the canonical renderer | The only model that supports a marketplace / 3rd-party authors / portable themes; already ~62% built (SHOPIFY §2; THEME-001). |
| 2 | **The data-only sandbox render contract** (scrub `__proto__`/secrets/`on*`, cap depth/keys, upload forbids `{% render %}`/`<script>`) | This is the *actual* security-load-bearing part of Shopify's design — the reason untrusted merchants can author themes safely (SHOPIFY §2). |
| 3 | **Theme blocks (reusable, nestable ≤8 deep)** — adopt now, ahead of Shopify's own painful sections-v1→blocks transition | LetBuyy has the schema machinery and no legacy theme corpus — a clean leapfrog (SHOP-015). |
| 4 | **Server-authoritative, declarative, sandboxed checkout** — one server RPC the merchant cannot subvert | Shopify's "checkout is server logic" doctrine; the cart already does the hard part right (SHOPIFY §4; CHK §1). |
| 5 | **No `checkout.liquid` / no Scripts to ever carry** — born where Shopify arrived in 2026 | Shopify spent ~2.5 years + forced auto-upgrades to kill scriptable checkout; LetBuyy skips the entire migration tax — state it as an asset (SHOPIFY §4). |
| 6 | **Passwordless-native identity (email/SMS OTP) + OAuth2-S256-PKCE + OIDC-ready** | Exactly where Shopify landed Feb 2026; LetBuyy has no legacy password/Multipass corpus to migrate (SHOPIFY §5; L-2). |
| 7 | **A discoverable OIDC provider** (`/.well-known/openid-configuration`) as the headless identity contract — built when demand arrives, never as a placeholder | Shopify's Customer Account API *is* OIDC; LetBuyy's is a 501 skeleton today — defer honestly, do not advertise a fake JWKS (SHOPIFY §5; AUTH-020). |
| 8 | **Polaris density + operator-first admin IA** (data tables, Orders/Money/Customers primary) | The admin is already Polaris-shaped; finish the operator-first IA + a first-class Money node (SHOPIFY §7; UIUX-009). |
| 9 | **One token design-system source + an app-shell component** (Shopify's App-Bridge+Polaris-from-CDN unification logic) | One `tokens.ts` source + `AppNavigation` 9/9 — the same "one styling authority" principle, minus the iframe (SHOPIFY §6; ISSUE-049). |
| 10 | **Theme Check-equivalent "Issues" panel** in the editor by surfacing the validator already built | A product-grade quality surface for theme authors at near-zero cost (SHOP-016; THEME-016). |
| 11 | **Dynamic sources / metafield binding** (bind section settings to collections/pages/metafields) | The single biggest *capability* gap vs OS-2.0 — the thing merchants hit first (SHOP-014; THEME-007). |
| 12 | **A Billing/subscription spine** (recurring/usage), monetizing the platform — never the sale | The correct monetization analog; keep subscription billing, set the transaction fee to 0% (SHOP-004). |
| 13 | **A reviewed/sandboxed extensibility *seam*** (interface where a future Functions-equivalent plugs in) — seam only, executor deleted | Keep the OAuth2/PKCE + app-block seam; remove the running Wasm executor until ~5k-merchant demand (SHOPIFY §6; R-11). |
| 14 | **(Later, P2+) A Shop-Pay-equivalent express checkout = UPI intent + saved address one-tap** | A natural India leapfrog — but only after core checkout is solid (SHOP-022). |

**IGNORE (Shopify's 1M-merchant end-state — explicitly out of scope for the envelope):**

| # | Shopify thing to IGNORE | Why it is wrong for LetBuyy now · ref |
|---:|---|---|
| 15 | **The dual storefront runtime (Hydrogen + Oxygen / headless Storefront-API tier)** | Serves a 1M-merchant headless-developer population LetBuyy does not have; run ONE Liquid-SSR runtime (SHOPIFY §3; SHOP-021). |
| 16 | **The 3rd-party app marketplace as a live tier + checkout UI-extensions + Wasm Functions runtime** | The #1 premature mimicry — "an empty mall with no supply"; FROZEN behind ~5k merchants + developer demand (SHOPIFY §6; ISSUE-047/061; R-11). |
| 17 | **Shopify-as-merchant-of-record / Shopify-Payments-style fund custody** | LetBuyy's intentional, regulatory-correct divergence: merchant is MoR on their own Razorpay, a PA custodies — LetBuyy never holds funds (SHOPIFY §4; ISSUE-014). |
| 18 | **The service-fleet topology + CQRS/saga/multi-region/sharding** | Shopify's scale-driven infra; for 100→10k India merchants it is the same error as activating 22 services (Spine S3; ISSUE-046). |
| 19 | **Native enterprise SSO / passkeys / custom-auth as platform features now** | Shopify itself delegates these to external IdPs; defer to ~5k merchants (demand-gated, on the asymmetric kernel) (SHOPIFY §5; IDN-027). |
| 20 | **Cross-merchant network wallet / Shop-ID-style buyer vault** | A network-scale buyer-identity product; out of envelope — no cross-merchant wallet (Spine S6; SHOPIFY §4). |

---

## PART C — THE VERDICT: IS LETBUYY READY TO BEGIN IMPLEMENTATION?

### C.1 — The decisive answer (3 lines)

**No — LetBuyy is not ready for *feature* implementation, and no agent should be granted implementation authority today.** The platform ships with **9 live S0 vulnerabilities** (an unauthenticated account-takeover + 6 anon table leaks + an anon-writable super-admin + an architectural RLS bypass), a **money layer that contradicts its own 0%-fee / no-custody constitution**, and a **green governance gate that certifies the rejected architecture** — all behind a deploy pipeline that **cannot ship a single fix** because `main` is 30 commits behind. **But it *is* ready to begin the FOUNDATION phases (P0–P2) under this governance the moment the governance is ratified** — because the fixes mostly exist (they are unmerged, unwired, or one default-number away), and the program has named every one.

**Distinguish the two readiness states precisely:**
- **Ready to begin the FOUNDATION phases (P0–P2: constitution, deploy-unblock, tenant-isolation, money-correctness) under this governance — YES, once ratified.** This is *remediation under law*, not feature construction.
- **Ready for FEATURE implementation — NO, not until the P3+ foundations land** (the 9 S0s closed, the money paths ledgered, the hosted origin live, the restore drill executed). Authorizing feature work before the foundations is exactly how the platform accreted "two parallel systems" at every layer in the first place.

### C.2 — Exactly what must be true before Codex receives implementation authority

Three gates, in order. **No gate may be skipped, and Gate 1 must complete before any code authority is granted at all.**

**GATE 1 — GOVERNANCE RATIFIED (the authority precondition).** Codex gets *zero* implementation authority until the law is settled:
1. **These 7 governance docs are accepted by the ARB** and the authority chain (Spine S2) is in force: Constitution (DOC 01) > AGENTS_V2 (DOC 02) > Canonical Systems registry (DOC 03) > Legacy-Elimination + Foundation-Roadmap (DOC 04/05) > UI-UX + domain governance (DOC 06) > this scorecard (DOC 07).
2. **AGENTS_V2 is promoted** and the generated `AGENTS.md` is retired; the generator is retargeted or killed so it can never again promote drift to law (ISSUE-045; LEG-076).
3. **The validators are retargeted to V1** — the ~36 theater validators removed, the canonical lists rewritten to the 8-runtime topology, the 5 missing V1 gates added (rollback-pairing ≥138, deploy↔V1-topology, `.store`-ban, `commission_bps=0`, topology anti-fabrication). The gate must enforce V1, not block the cleanup (ISSUE-046; W-01).
4. **The canonical-systems registry is LOCKED** so no agent builds a parallel system — every domain names its one true winner and its losers' fate (DOC 03; matrix). *This is the single most important durable control: the platform's defining failure mode is "two parallel systems," and the registry is the law that forbids a third.*

**GATE 2 — THE P0/P1 GATES CLOSED (the go-live precondition).** Before live keys / a real merchant:
5. **The deploy meta-blocker is cleared** — `main` fast-forwarded, the S0 patch committed + deployed, a branch-lag CI guard installed (ISSUE-001/002; W-00). *Until this clears, nothing the team builds is real.*
6. **All 9 S0s are closed and verified** — the switch fix live, the 6 PUBLIC policies dropped + REVOKE'd, the allowlist locked, and the gateway off blanket `service_role` with RLS+GUC engaged (ISSUE-001…009). Plus the anon-key probe (`\dp public.orders`) to convert the one UNVERIFIED S0 to confirmed.
7. **The money layer is correct for live keys** — capture/refund/COD ledgered, reconciliation closed, PA-split replacing razorpayx, `commission_bps=0`, real step-up (the Phase-B "money-safe" set; ISSUE-010…015).
8. **The observability floor is real** — a **tested restore drill with PITR live** + alerting that fires + money-drift monitors (the V1 P0 hole; ARCH-035; W-35).

**GATE 3 — THE PARALLEL-SYSTEM LOCK (the durable control, enforced continuously).**
9. **No new construction outside the registry.** Feature authority (P3+) is granted domain-by-domain *only after that domain's foundation lands and its losers are deleted* — never before. A new system in a domain that already has a canonical winner is a governance violation, blocked at CI by the retargeted validators.

### C.3 — The precise readiness gate (one sentence)

> **Codex receives FOUNDATION authority (P0–P2) the instant GATE 1 closes (the 7 docs ratified, AGENTS_V2 promoted, validators retargeted, registry locked); it receives FEATURE authority (P3+) only domain-by-domain as GATE 2 closes for that domain (its foundation landed, its S0/S1s cleared, its losers deleted) — and never builds a system that already has a named canonical winner (GATE 3).** Everything before GATE 1 is governance, not engineering; everything between GATE 1 and GATE 2 is remediation under law, not features; feature implementation begins only after the foundations are real.

---

## APPENDIX — UNVERIFIED / LIVE-ONLY (carried forward, never silently upgraded to fact)

Every completion%/score above measures the **working tree**; **live readiness is ≈0/10 platform-wide** until the deploy meta-blocker clears (ISSUE-002). The load-bearing UNVERIFIED items a leader must not treat as settled:

1. **Live/deployed state of everything** — this is a tree audit; no fix (RLS policies, schedulers, indexes) is provably in the *production* DB; the live estate runs pre-wave code.
2. **The 6 anon RLS-to-PUBLIC GRANTs** — set by Supabase's managed bootstrap outside the repo; strongly evidenced live (107 header + Supabase defaults + zero REVOKE) but require an anon-key probe / `\dp public.orders` before final S0 sign-off.
3. **Money-kernel test depth** — ~20 Postgres test files exist and the waves claim PASS, but were **not executed in-audit**; property/concurrency rigor is asserted by file presence, and the tests cover the *V1* paths, not the legacy paths that carry live volume.
4. **The cross-tenant red-team suite (RT-1…9), the switch regression test, the capture↔settlement recon E2E, and the Liquid Security suite are SPECIFIED, not built** — every go-live-gating domain needs its security/concurrency suite *built*, not just its happy path.
5. **Dispute/chargeback log** — no dedicated table/route located; likely MISSING but not exhaustively disproven.
6. **Shared `AUTH_SECRET` reuse** — the forgery *surface* is code-proven; the live secret reuse is not inspectable from source.
7. **Performance figures** — all latency/round-trip counts are *code-estimated*, not measured (no profiler, no live traffic).
8. **Live DNS / `.store` vs `.com` routing** — asserted from config; live DNS state UNVERIFIED.
9. **The ops-console survivor** (`admin-web` vs `platform-operations-portal`) is an **ARB decision, not a code fact**.
10. **`legacy/firebase` git-tracked LOC** (37 reported vs empty from the Linux mount) — on-disk LOC confirmed; classification unchanged; proof = `git ls-files legacy/` from the macOS root.

*End of DOC 07 — Final Architecture Scorecard + Closing Deliverable. Scores measure the working tree at `stepup/main` @ `c4fc3cd6` (dirty), 2026-06-10; live readiness is gated on the deploy meta-blocker. This document scores and closes; the Constitution (DOC 01) and Canonical Systems registry (DOC 03) hold the authority it reports against. No repo code was modified.*
