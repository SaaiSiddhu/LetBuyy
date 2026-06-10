# LETBUYY — SINGLE SOURCE OF TRUTH

> **Status:** THE authoritative implementation guide. Consumes and reconciles every prior report (forensics, Phase-2 challenge, money/identity verdicts, execution plan, CTO verdict, Architecture-Freeze-V1, Merchant-OS audit, business plan, deep audit, zero-trust + the 29-doc auth corpus). **Code beats docs; newer audits beat older; conflicts are shown and resolved.** No optimism, no marketing.
> **Date:** 2026-06-09 · **Composite maturity: ≈43/100** · **Verdict: REQUIRES RESTRUCTURING** (a two-quarter, truth-first foundation step-up — **not** a rewrite).

---

## 0. Conflicts resolved (the reason this document exists)

| # | Conflict | Resolution (justified by evidence) |
|---|---|---|
| C1 | **Identity Transformation Blueprint** (“build the full central IdP/OIDC/4-realm now”) vs **Architecture-Freeze-V1** (“defer OIDC, foundation-first, rent rails”). | **V1 wins on sequencing; the Blueprint wins as the north-star.** Ratify the IdP design; **defer the build to P2–P3.** Pull only the security-critical subset forward (secret isolation, perimeter lock, revocable sessions) because the shared `AUTH_SECRET` also authorizes money headers (`auth-core:447`). |
| C2 | **Master verdict:** “fabricated payouts = the #1 money risk.” vs **Phase-2:** sandbox-default moves no money; the real P0s are logic defects. | **Phase-2 wins.** Top money risks are: balance-from-mutable-table, payout double-release (no lock/balance check), refund-not-ledgered, reconciliation auto-plug, revenue double-book. Fabricated payout is **P2 (“not wired”)**. |
| C3 | “The ledger is the system of record / crown jewel.” vs Phase-2: the kernel is real but **bypassed**. | **Both true, reconciled:** the ledger *kernel* (`migrations/139`) is genuinely double-entry + append-only — a real asset — **but spendable balance reads from the mutable `wallet_ledger_entries` table** (`wallet.ts:66-92`). Making the ledger authoritative is a **P0**. |
| C4 | “RLS is entirely inert.” vs Phase-2: partially scoped. | **App path bypasses RLS via service-role (true);** several financial tables have scoped `authenticated` policies for direct-SDK access (`migrations/119:196-216`); some policies are `USING(true)` (worse). Fix = fail-closed tenant layer, not “turn RLS on.” |
| C5 | Internal HMAC trust scored a **strength** (forensics F19) vs a **CRITICAL forgery surface** (Phase-2 + ZERO_TRUST). | **CRITICAL wins.** One reused secret + public gateway = identity forgery **and** money-header authorization. |
| C6 | Infra: “partition shadows not cut over = HIGH risk.” vs V1: “defer partitioning.” | **V1 wins — compliant deferral.** Risk is real only at 10k+; monitor the trigger, don’t partition now. |
| C7 | Several older audits list CRITICALs (internal-payment fail-open, Razorpay-replay, committed `all.env`). | **Stale — cleared by Phase-2:** fail-open is fixed, replay is mitigated, `all.env` is not in this tree. Do not re-litigate. |

---

## 1. Current state
A single real backend (`services/api-gateway`, 62 routes, Hono/Workers/Supabase, no ORM) + `queue-workers`/`webhook-service`/`mobile-bff`, fronting 9 Next.js apps and a Flutter merchant app, rendering multi-tenant section/block storefronts. Around a genuinely strong commerce **core** sits a large layer of **scaffolding that runs in zero production paths**. The platform **can take money but cannot truthfully move or account for it**, its **tenant boundary is convention not construction**, and **production is unobservable and un-backed-up**.

## 2. Core strengths (protect — see Kill/Quarantine guardrails)
Double-entry ledger **kernel** (`139`); concurrency-safe inventory (`141`); order state machine (`147`); inbound payment webhook HMAC + idempotency; section/block theme engine; four-layer design tokens (9/9 adoption, 0 `.tsx` hex); acyclic module graph; opaque server-revocable merchant sessions; bcrypt-12 + AES-GCM TOTP + SEC-H3; cross-realm cookie isolation; a genuinely sound *design* corpus (auth north-star, V1 freeze).

## 3. Core weaknesses
Money **logic** (mutable-balance-as-truth, payout double-release, refund-not-ledgered, reconciliation auto-plug, revenue double-book, `integer` overflow, mock default); **tenant** isolation by convention (service-role); **identity** asserted via a reused shared secret on a public gateway; sessions 30-day no-rotation; **no backups/observability**; rate-limit fails open; theme renderer↔registry decoupled + Liquid/extensions off in prod; design governance unenforced; ~46% validators are theater; the repo **violates V1** by investing in the dormant tower.

## 4. Domain truths (one line each, evidence-anchored)
- **Architecture truth:** a sound modular monolith dressed as a microservice mesh; the distributed-runtime tower has **0 product call-sites** yet is in the build (`tsconfig.workspace.json:24,26`) — V1 §4 ordered it dormant.
- **Identity truth:** no central issuer; the gateway trusts app-asserted HMAC identity headers signed by **one secret that also authorizes money** (`auth-core:447`); OIDC is a 501 skeleton. The fix is designed (auth corpus) but unbuilt.
- **Money truth:** the ledger kernel is real but **not authoritative**; payout release has **no lock and no balance check** (`payouts.ts:505-521`); refunds don’t hit the ledger; reconciliation **auto-plugs** breaks (`billing-core:558,601-615`). **Not launchable for real money as-is.**
- **Theme truth:** real OS2.0-shaped engine, **half-wired** (renderer ignores the registry) and **half-disabled** (`FEATURE_LIQUID/EXTENSIONS="false"` in prod).
- **Design truth:** one token system, **no enforced authority**; 2 parallel token systems + 334 mobile literals + 574 storefront inline styles + duplicate shells.
- **Production truth:** coherent Workers+Vercel deploy with a real E2E gate, but **no PITR**, **observability undeployed**, **rate-limit fails open**, **Hyperdrive bound-but-unused**, **outbox capped ~4,800/day**.
- **Business truth:** the opportunity is real (India SMB commerce; UPI zero-MDR wedge; 0%-fee headline; kill the 2.5% GMV rake). The **“rent rails, never custody money” regulatory call (V1) is the load-bearing business decision** — and it is exactly what the fabricated payout violates. The business model is sound and **moot until money moves truthfully.**

## 5. The ONLY approved roadmap
> Anything not on this list is **out of scope** until its tier is reached.

**P0 — Existential (Q1). A merchant can be paid truthfully; no tenant can read another’s data.**
Ledger-as-source-of-truth (balance reads from `ledger_entries`); payout release `FOR UPDATE` + balance check + idempotency + maker-checker on the **live** `payout_statements`; capture→ledger; refunds→ledger; remove fee/GST double-booking; reconciliation stops auto-plugging; `integer→bigint`; kill `mock` default; fail-closed tenant data layer + remove `USING(true)` + remove static `super_admin`; **continuous backups + PITR + restore drill**; rate-limit fail-closed; **isolate+rotate the internal secret + lock the gateway perimeter**; the WS-0 truth/anti-fabrication harness.

**P1 — Beta blockers (Q2). Closed beta with real merchants.**
Mobile login (Turnstile); server-authoritative checkout (confirm creates order+payment); enforce MFA + per-principal admin TOTP; revocable sessions + idle + rotation; deploy observability; WhatsApp lifecycle + COD; quarantine the theater; design ratchet as a blocking gate; theme renderer↔registry contract + the Liquid in-or-out decision.

**P2 — Growth (Q3+). 1,000-merchant GA track.**
Identity Platform / OIDC / SSO build (migration Waves 1–6); collapse the 2 stores; real logistics/KYC/tax rails; search service + Hyperdrive pooling; full design-authority enforcement (kill parallel token systems, generate mobile tokens, unify shells); theme marketplace enablement + schema migration.

**P3 — Future. Platform depth.**
Passkeys + consent + federation (Waves 7–8); org/tenant layer above `site_id`; notification/analytics pipelines as services *only if scale demands*; visual theme editor; WCAG a11y pass.

**P4 — Post-scale (decade-early per V1 — do NOT start).**
3rd-party app marketplace ecosystem; AI/NLU; Wasm/extensibility platform; reseller network; multi-region.

## 6. Execution order & dependencies
```
[GATE: P0 money + tenancy]  ──>  P1 (beta)  ──>  P2 (identity/scale)  ──>  P3  ──>  P4
WS-0 truth harness ─┬─ WS-1 money (needs WS-5.1 backups) ─┬─ WS-10 scale
                    ├─ WS-2 tenancy ───────────────────────┤
                    ├─ WS-5 prod safety (5.1 first) ─ WS-6 observability
                    ├─ WS-3/4 identity/session ─ Identity Waves 1–8 (gated behind P0)
                    ├─ WS-7 design governance
                    └─ WS-9 architecture cleanup (after WS-3/4)
```
Identity migration Waves do **not** begin before the P0 gate (except Wave 0’s secret/perimeter subset). Full detail: `LETBUYY_FOUNDATION_EXECUTION_MASTER_PLAN.md` + `IDENTITY_MIGRATION_PLAN.md`.

## 7. Kill list (delete)
Fabricating payout adapter; default `mock` payment mode; static `super_admin` token; reconciliation auto-plug-to-reserve; platform-fee/GST double-booking; `USING(true)` RLS policies; legacy `users` store + `lb_csrf` + legacy Supabase Auth (post-migration); name-grep validators as **gates** (demote to report).

## 8. Quarantine list (keep history, remove from build/topology)
`distributed-runtime` / `projection-runtime` / `orchestration` tower; `identity-foundation` V2 (gateway + app); the 6 paper services; the OIDC skeleton (serve an honest 501); the dormant in-memory theme registry runtime.

## 9. Deferred list (right idea, wrong time)
Full OIDC IdP / passkeys / consent / federation (P2–P3); DB partitioning (V1 P2 trigger); search / notification / analytics **services** (in-DB/router until scale demands); marketplace; AI; reseller links; multi-region; advanced SLO/chaos governance.

## 10. Future investments (post-foundation)
Central Identity Platform as a product surface; a real 3rd-party app + theme ecosystem; AI merchant copilots; multi-region for non-India expansion. **None before P2.**

## 11. Explicit guardrails
- **What MUST be fixed first:** the seven money-logic P0s + fail-closed tenancy + backups/PITR + secret-isolation/perimeter. Nothing else matters until these land.
- **What NOT to build:** OIDC now · marketplace · AI · Wasm/extensions · the 13-service platform · reseller network · multi-region · more validators.
- **What NOT to touch (freeze):** ledger kernel `139` · inventory `141` · order SM `147` · theme registry model · design-token source · package boundaries · auth primitives (bcrypt/TOTP/opaque sessions/SEC-H3) · cross-realm cookie isolation · the “never custody money” regulatory decision.
- **What NOT to refactor:** the modular monolith into microservices; the acyclic package graph.
- **What NOT to migrate:** do not shard/partition now; do not flip the cookie domain before the `.store→.com` DNS move; do not start identity Waves before the P0 gate.

## 12. The one-paragraph truth
LetBuyy is a genuinely good commerce **core** and a genuinely good set of **designs** (V1 freeze, auth north-star), wrapped in fabricated rails and dormant scaffolding the design itself told it not to build. The money logic is unsafe, the tenant boundary is by convention, identity trust hangs on one over-shared secret, and production is blind — but **none of these require a rewrite**, every fix is bounded, and the correct architecture already exists on paper. Commit the ₹10 cr **only** with the P0 money-and-tenancy work as a contractual, test-gated condition of the first tranche. Build the road, not the destination — in this order, and not before.

---
*Authority set (this folder): `DESIGN_SYSTEM_VERDICT`, `THEME_ARCHITECTURE_VERDICT`, `TARGET_AUTH_ARCHITECTURE`, `SSO_ARCHITECTURE`, `SESSION_MANAGEMENT`, `IDENTITY_MIGRATION_PLAN`, and this document. Evidence base: `FOUNDATION_FORENSICS_2026_06_09/`, `PHASE2_ARB_CHALLENGE_2026_06_09/`, `CODEX_FOUNDATION_REMEDIATION_MISSION.md`, `LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT.md`, `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`, `docs/auth/2026-06-08…/`.*
