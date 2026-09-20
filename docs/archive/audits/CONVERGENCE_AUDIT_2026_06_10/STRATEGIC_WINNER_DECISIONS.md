# STRATEGIC WINNER DECISIONS — Convergence Audit Phase 4

**Phase:** 4 — Strategic Winner Decisions (DISCOVERY/DECISION ONLY)
**Date:** 2026-06-10 · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `c4fc3cd6` · `main` @ `4bcae19a` (30 commits behind, the only deploy branch) · working tree dirty (512 D / 410 M / 78 ??)
**Inputs:** `_PREMISES_SEED.md` (winner spine) + the 13 prior REPOSITORY_TRUTH_AUDIT reports; every score is grounded in those reports' `path:line` citations, spot-re-verified against live code where load-bearing (verification log §Appendix).
**Mode:** Read-only. The only file written is this report. No code, no architecture, no codex prompts. Hard calls, per the user's aggressive-deletion / no-prod-constraints mandate.

---

## Executive Summary

For all 13 competing systems the strategic winner is the working-tree (Reality C) hardened end-state, and it **aligns with the ratified spine in `_PREMISES_SEED.md` on every decision** — the spine's winners survive rigorous 7-dimension scoring. The decisions are therefore not *undecided conflicts*; they are **decided conflicts whose losers are still alive**, because (a) the winning code is uncommitted with zero git history, (b) several winners are undeployed/unproven, and (c) in two cases the new governance law structurally mandates its own loser.

The single most important nuance this phase surfaces — and the reason the spine is right to gate deletions rather than green-light them — is that **completeness-today and strategic-target diverge on three decisions**:

1. **Themes (React vs Liquid).** Liquid is the correct strategic target and scores higher on architecture/future-fit, but React beats it on completeness today by a wide margin (React serves 100% of stores with header/footer/data-binding/editor; Liquid has no header/footer, no data binding, a single `index` template, and no merchant install path). **React is NOT deletion-ready** and deleting it today blanks every storefront. This is the flagship honest-tension case.
2. **Storefront capture (ledgered vs `confirm_order_payment_with_ledger`).** The strategic target is the ledgered path, but the *complete, working, every-shopper-hits-it* path is the no-ledger one — and it writes zero canonical ledger lines in **all three** realities. The winner here is a target, not a working system; neither is fully wired.
3. **Mobile theme-editor survival.** The strategically valuable surface (the 1,200-line section editor + 631-line theme screen) is the most *complete* mobile feature but is **dead code** (zero construction sites) — so the "winner" by capability is a screen no user can reach. Completeness of implementation ≠ completeness of the product.

A second-order theme of the phase: **score gaps narrow dramatically when you separate "is it built" from "is it live."** Most winners would score 7–8 as committed+deployed end-states but score 2–4 as *currently deployable* because they live only in an uncommitted tree. Every verdict below therefore carries a reality-plane note and, for each loser, the explicit **blocking condition before the loser can be removed**.

**Net recommendation:** ratify the spine's winners as written. The convergence sequence is gated, not free: Phase 0 must `git add -A` + commit the working tree (avoiding the tracked-deletion/untracked-archive commit trap) and ratify governance *before* any loser is touched; then losers fall in dependency order, with three of them (React renderer, storefront no-ledger capture, multi-region contract) blocked on genuine capability work that no commit alone resolves.

---

## Scoring Method

Each side of each pair is scored **0–10 on 7 dimensions**, then averaged to a composite. Dimensions:

| Dim | Meaning |
|---|---|
| **AQ** Architecture quality | Soundness of the design (append-only vs mutable, asymmetric vs shared-secret, single-writer, fail-closed). |
| **CT** Completeness today | How much of the capability actually exists and works *right now*, independent of where it's committed. |
| **PR** Production readiness | Could this serve real users today (committed-and-deployable, fail-safe, observable)? |
| **MV** Merchant value | Value delivered to a merchant/shopper if this side wins. |
| **MA** Maintainability | One-system-per-domain, low duplication, clear ownership, testability. |
| **DX** Developer experience | Ease of building on it, schema/editor/contract ergonomics. |
| **FS** Future scalability | 100 → 1k → 10k India merchants (the constitutional envelope; **not** 100k+). |

Scoring is **capability-honest**: a side is not penalized on CT for being uncommitted (that is captured under PR), and not rewarded on PR for being well-architected if it cannot deploy. 0 = absent/dangerous · 3 = skeleton · 5 = supervised-beta-capable · 7 = production-credible with known gaps · 9+ = hardened. Composites are mean of the 7, one decimal.

**Reality planes:** A = `main` (deploy branch, condemned) · B = HEAD `stepup/main` (+30, interim) · C = working tree (uncommitted hardened end-state). "Winner lives on C" is the recurring fact.

---

## Decision 1 — React Renderer vs Liquid Renderer (themes)

| Dim | React renderer | Liquid renderer |
|---|---|---|
| AQ | 6 — section-registry + data-binding engine, mature but framework-coupled, head via Next | 8 — server-authoritative, sandboxed (DOMPurify+jsdom, auto-escape), Shopify-shaped, portable bundle |
| CT | **9** — 20 frozen sections + header/footer chrome, live catalog binding, multi-template routing, full schema editor | **2** — 22 type-mapped sections but skeletal; no header/footer; hard-coded product strings; `index`-only template; cart/customer drops stubbed |
| PR | 7 — serves 100% of stores in all 3 realities, ISR caching | 2 — canary default-OFF, no write path, only bundle is a test fixture, head/SEO output discarded at runtime |
| MV | 7 — every storefront renders today via React | 3 — a canaried store loses all chrome (empty header/footer groups) and renders home for product/cart |
| MA | 4 — duplicate schema sources + compose fork (`RUNTIME_SECTION_SCHEMAS`, `template-resolver` re-impl) | 7 — single bundle source, but the Liquid plan currently lives *inside* the React-side loser file |
| DX | 7 — schema-driven editor, undo/redo, per-section preview frames | 3 — no editor (web/Flutter), single opaque HTML blob preview, no partials/snippets, no asset pipeline |
| FS | 6 — fine to 10k; React SSR cost + theme-author lock-in | 8 — server-rendered, merchant-authorable, the Shopify-parity path |
| **Composite** | **6.6** | **4.7** |

**Verdict: WINNER = Liquid (strategic target) · LOSER = React (FROZEN, explicitly NOT deletable).** Liquid wins on architecture and future-fit and is the ratified target (`THEME-R1`/`WIN-R3`; `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status='deferred'`, theme-governance.ts:16-21). But React wins **completeness today 9 vs 2** and is the runtime default for every store (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`, theme-governance.ts:14). The number that matters: **20/22 registered React surfaces have a Liquid type-map but header/footer have none**, and the Liquid render plan hard-codes empty header/footer groups (template-resolver.ts:213-216) — so deleting React today blanks every storefront. Parity is proven at the type-mapping level only (THEME_PARITY §4.1, §10).

**Why the loser loses (eventually):** React forks the theme schema (`RUNTIME_SECTION_SCHEMAS`, renderer-registry.tsx:66) and the compose path (`template-resolver.ts`), is framework-locked, and is not merchant-authorable; Liquid is the server-authoritative, sandboxed, Shopify-shaped model the platform's own canon ratifies.

**Deletion-readiness gate (React is NOT deletable yet — required, per mandate):** before React can be removed, ALL must be true: (1) Liquid header/footer sections + section-group routing exist; (2) first-party Liquid product-grid/featured-products/product-detail bind the live catalog (commerce drops, not hard-coded strings); (3) full template set (product/collection/cart/page), not `index`-only; (4) real cart/customer drops (today stubs at composition-engine.tsx:300-307); (5) a canary **write path** (API/UI/SQL — none exists today); (6) a merchant install/edit/preview surface; (7) per-section Liquid parity harness green; (8) the deferred platform-wide flip is ratified by ARB. Until then `no-new-react-sections-validator.mjs` (freeze) and the React renderer **must stay**.

**Reality plane:** React on A/B/C (runtime default everywhere). Liquid hardening (DOMPurify, auto-escape, parity table, freeze validator) exists **only on C** — uncommitted; A/B still ship the 3-regex sanitizer with no auto-escape.

---

## Decision 2 — Legacy Gateway Sessions (randomHex + AUTH_SECRET HS256) vs Identity-Platform Asymmetric Sole Issuer

| Dim | Legacy gateway sessions (randomHex + AUTH_SECRET HS256 family) | Identity-platform asymmetric sole issuer (ES256/EdDSA) |
|---|---|---|
| AQ | 2 — opaque `randomHex(32)` mint in the gateway; one shared symmetric secret signs `lb_accounts` PII, console, customer, media/checkout/export | 8 — private JWK scoped to identity-platform in CI, gateway verifies env-injected public JWKS before any DB write; clean realm separation |
| CT | 8 — fully implemented and the only thing that exists at HEAD/`main` | 6 — implemented for the **merchant** token only; shopper/console/app/magic-link/`lb_accounts` still HS256 |
| PR | 6 — deployable today but ships the `/api/auth/switch` account-takeover (mints a session for any `email_verified` user) | 2 — entire topology + switch fix + CI key wiring are uncommitted (`identity-issued-session.ts`/`identity-session-verifier.ts` absent at HEAD/`main`) |
| MV | 3 — "works" but is an unauthenticated takeover surface for every merchant | 7 — real session integrity, revocable via DB RPC, takeover closed |
| MA | 2 — ≥4 auth planes, 2 Turnstile verifiers, per-app session libs, shadow identity-foundation stack | 7 — single issuer, single revocation authority (target); shadow stack is SAFE_DELETE after verify-only |
| DX | 4 — many secrets, many mint paths | 6 — one mint API; JWKS verification helper; OAuth/OIDC still skeletons |
| FS | 3 — shared-secret monoculture does not scale across trust domains | 8 — per-audience asymmetric keys scale cleanly to 10k |
| **Composite** | **4.0** | **6.3** |

**Verdict: WINNER = identity-platform asymmetric sole issuer · LOSER = gateway randomHex + AUTH_SECRET HS256 family.** The number that matters: **the asymmetric property covers exactly ONE token type (merchant session)** — shopper, console, app-OAuth, magic-link, and the PII-bearing `lb_accounts` cookie all remain HS256 over a shared `AUTH_SECRET` (IDENTITY_TRUTH §1 table; verified `identity-issued-session.ts` untracked). The legacy plane wins completeness-today (8 vs 6) only because the winner is uncommitted — and the legacy plane is what `main` deploys, carrying the live SEC-C1 takeover (IDENTITY_TRUTH §2, quoted from `git show main:`).

**Why the loser loses:** opaque tokens give no cryptographic provenance; a single shared symmetric secret across identity, money-signing, and webhook dispatch is a forgery monoculture (`SEC-R7` names it DEAD); the `/switch` route mints sessions without proof of ownership.

**Blocking condition before the loser can be removed:** commit + deploy the asymmetric topology; pass the `IDN-R2` dual-verify drain gate (telemetry showing **zero legacy-HS256 verifications**); then move shopper/console/app/`lb_accounts` issuance into identity-platform (each HS256 surface needs an asymmetric or dedicated-secret replacement) before `AUTH_SECRET` and the gateway mint path are retired. The `identity-foundation/` shadow stack (18 files) is SAFE_DELETE only after identity-platform serves verify-only in production (`IDN-R3`).

**Reality plane:** Loser on A/B (live). Winner on C only — undeployed; live identity plane is therefore presumed insecure until a deploy from C lands.

---

## Decision 3 — Legacy Mutable Wallet/Commission/Payout Model vs Canonical Append-Only Ledger

| Dim | Mutable wallet/commission/payout model (mig 119) | Canonical append-only ledger (mig 139/160/165) |
|---|---|---|
| AQ | 2 — mutable balances, `wallet_ledger_entries`/`payout_statements`/`commission_*` as truth | 9 — double-entry, append-only triggers, deferred balance constraint, idempotent posting, FORCE RLS, UPDATE/DELETE revoked from every role incl. service_role |
| CT | 7 — the historical model, broadly wired | 6 — kernel + V1 payments/COD(worktree)/settlement/payout-fee postings real; storefront capture + 2/3 refunds NOT posted |
| PR | 4 — deployable but mutable-as-truth is unsafe; 3% rake; razorpayx defaults | 3 — authority migrations (160) + commission-zero (162) + COD RPC (165) untracked; reconciliation refreshers have **zero runtime callers** |
| MV | 3 — pays merchants but via fragile mutable state and a 3% rake | 6 — auditable money truth, 0% rake (target), payout double-release interlock |
| MA | 2 — 3+1 `merchant_payable` writers, no cross-source dedup, mutable balances | 8 — single-writer-module CHECK, one account model (wallet demoted to compatibility projection) |
| DX | 4 — direct balance writes are easy but unsafe | 7 — RPC posting plans, builder math, idempotency keys |
| FS | 3 — mutable-balance contention + reconciliation drift at scale | 8 — append-only ledger scales to 10k with clean reconciliation |
| **Composite** | **3.6** | **6.7** |

**Verdict: WINNER = canonical append-only ledger · LOSER = mutable wallet/commission/payout model (→ compatibility projection only).** The kernel is genuinely well-built (MONEY_TRUTH §3). The number that matters: **the wallet read fails closed at 409 (`LEDGER_RECONCILIATION_REQUIRED`, wallet.ts:172) forever until an operator manually runs a backfill** — and the reconciliation refreshers that would clear it have zero runtime callers (MONEY_TRUTH §4.4). So even the winner is not yet operationally live.

**Why the loser loses:** mutable-balance-as-truth was the root of the historical payout/refund defects; `PAY-R1` makes the canonical ledger the sole money truth and demotes the four compat tables.

**Blocking condition before the loser can be removed:** `DEL-R2` DELETE_AFTER_MIGRATION — commit migrations 160/162/165; wire the reconciliation refreshers to a scheduler; produce a zero-drift reconciliation proof on live data (`SKIP-D5-LIVE-MONEY-RECONCILIATION`); backfill `wallet_ledger_entries` → canonical. Until the wallet read derives cleanly from the ledger without manual ops, the compat projection must remain.

**Reality plane:** Loser on A/B/C (still present as compat). Winner kernel on B/C; full authority (160) + zeroing (162) + atomic COD (165) on **C only**.

---

## Decision 4 — Ownership via Raw Service-Role/REST vs RLS+FORCE+GUC (`withTenantTx`)

| Dim | Raw service-role / REST (664 admin sites + supabaseServiceHeaders) | RLS+FORCE+GUC (`withTenantTx`, mig 164) |
|---|---|---|
| AQ | 3 — app-level Proxy guard (pattern-based) + raw-REST bypass that skips the Proxy entirely | 8 — `SET LOCAL ROLE app_tenant` (NOBYPASSRLS) + `app.site_id` GUC + FORCE RLS; refuses to fake `SET LOCAL` over REST |
| CT | 8 — 664 `getSupabaseAdmin` sites are the operative norm everywhere | 5 — real where used, but per-route adoption unproven; raw-REST + anon paths still bypass it |
| PR | 4 — deployable but `main` ships open anon `USING(true)` leaks; service_role is the default | 3 — migration 164 untracked; `rls-force-coverage-validator` would **error** in a clean checkout (reads the untracked file) |
| MV | 2 — cross-tenant leakage risk on a multi-tenant commerce platform | 7 — DB-enforced tenant isolation, defense-in-depth |
| MA | 2 — 4 coexisting access planes, validator polices ~none of the 664 uses | 7 — one load-bearing isolation layer; service-role demoted to audited break-glass |
| DX | 5 — service-role "just works" (which is the problem) | 6 — pooled-tx requirement; throws if no pooled conn |
| FS | 3 — blanket service-role does not scale safely across 10k tenants | 8 — RLS+GUC is the canonical isolation primitive at scale |
| **Composite** | **3.9** | **6.3** |

**Verdict: WINNER = RLS+FORCE+GUC (`withTenantTx`) · LOSER = raw service-role/REST as the operative plane.** The number that matters: **25 PUBLIC/anon `USING(true)`/`WITH CHECK(true)` policies survive in the final state** outside the validator allowlist (incl. `service_role_*`-named-but-PUBLIC policies on gift_cards/pages/collections/onboarding_attempts/ai_usage/auth_password_set_intents) (DATABASE_TRUTH §5), and the raw-REST helpers (`supabaseServiceHeaders`, supabase-adapter index.ts:65-150) bypass the Proxy guard entirely.

**Why the loser loses:** `SEC-R9`/`WIN-R3` make RLS+GUC the load-bearing layer; blanket `service_role` is a *substitute* for tenancy, not a defense-in-depth layer; the raw-REST bypass is an active hole the validator does not see.

**Blocking condition before the loser can be removed:** commit migration 164; prove per-route `withTenantTx` adoption with the RT-1…9 suite (`TEST-R4`); give the raw-REST helpers tenant-guard parity or remove their callers; close the 25 surviving permissive policies; fail-closed the queue tenant envelope (today returns unsigned when `siteId`/secret missing). Service-role then survives only as an audited `withServiceRole(reason, fn)` break-glass.

**Reality plane:** Loser on A/B/C (664 sites remain). Winner policies (163/164) on **C only**, untracked.

---

## Decision 5 — Scan-Generated AGENTS.md Regime vs Constitution/AGENTS_V2 Governance

| Dim | Scan-generated AGENTS.md regime (HEAD/main) | Constitution + AGENTS_V2 + Canonical Systems (worktree) |
|---|---|---|
| AQ | 2 — drift-promoted-to-law (generated 2026-06-08), 124 governance docs, 181-validator theater incl. CRDT/replay/failover | 8 — clean authority chain (Constitution → AGENTS_V2 → Canonical Systems), one-system-per-domain, 90-validator gate |
| CT | 7 — fully present and committed (it is the law at HEAD/`main`) | 7 — complete 7-doc stack, gate passes 90/90 on the working tree |
| PR | 3 — "in force" but encodes the rejected regime; GATE-1 self-block | 2 — entirely uncommitted, human-unratified; Constitution self-declares a ratification that never happened |
| MV | 2 — misleads every agent/human about the real architecture | 7 — accurate canon, real supersession headers, honest winner registry |
| MA | 2 — generated, regenerable-was-the-point, 38 nested scan files | 6 — hand-authored but: dual DOC-02 text divergence, recreated multi-region self-block, ≥10 contradicting survivor docs |
| DX | 3 — agents follow drifted law | 7 — single clear entry point (CLAUDE.md → AGENTS.md) |
| FS | 2 — law that grows by scanning drift | 8 — fixed envelope, ratchet validators, theater purge |
| **Composite** | **3.0** | **6.4** |

**Verdict: WINNER = Constitution/AGENTS_V2 · LOSER = scan-generated AGENTS.md regime.** The number that matters: **gate validators 181 → 90 and governance docs 124 → 86**, with the generator hard-retired (exits 1) and the GATE-1 self-block inverted at the root (GOVERNANCE_TRUTH §7.1). The winner wins decisively on every dimension except production-readiness, where it scores *lower* than the loser (2 vs 3) — because it has **zero git history** and is human-unratified, while the loser is the committed law.

**Why the loser loses:** `DOC-R1`/`ANTI-R8` — drift must not be promoted to law; Constitution P.2 revokes the generated AGENTS.md's constitutional claims; the generated regime asserts a 9-app topology and CQRS/distributed packages the canon rejects.

**Blocking condition before the loser can be removed:** `git add -A` + commit the constitutional stack (Phase 0), **avoiding the commit trap** (60 tracked root docs are staged-deleted while their archive copies are untracked — a tracked-only commit orphans the archive); human ARB ratification of GATE-1 (`SKIP-GATE1-ARB-RATIFICATION`); extend the anti-scan validator below root to the 38 nested scan files; resolve the dual DOC-02 CODE-R1 divergence. Also fix the recreated self-block (Decision 9) — the new end-state validator mandates the very multi-region artifacts the Constitution forbids.

**Reality plane:** Loser on A/B (committed law). Winner on C only — one `git clean -fd` from non-existence.

---

## Decision 6 — Old Mission/Blueprint Docs (Codex Waves, CQRS/Distributed) vs Executable Architecture/Constitution

| Dim | Old mission/blueprint docs (Codex waves, CQRS, billion-$ OS, reserved-fleet+Wasm) | Executable Architecture / Constitution (monolith + empty seams) |
|---|---|---|
| AQ | 2 — distributed/CQRS/multi-region/Wasm-extension topology on the Never-Build list | 8 — modular monolith + 4 satellites + reserved manifest-only seams; absorbs V1+Freeze as ART-01..24 |
| CT | 6 — fully written, tracked, living in `docs/` | 7 — complete canon + ratifying ABRs |
| PR | 1 — actively dangerous if followed (would reintroduce rejected topology) | 2 — canon uncommitted; some evidence paths dangle (`_GOVERNANCE_SPINE.md` cited 26× but missing) |
| MV | 1 — value-negative; misdirects build effort to never-build systems | 6 — correct buildable target for the 10k envelope |
| MA | 2 — ~25 contradicting docs + 9 config JSON + 2 validators + 3 workflows | 7 — one chain, clean supersession headers |
| DX | 2 — a future agent ingesting `13-final-architecture-blueprint.md` builds the wrong platform | 7 — clear, scoped, executable |
| FS | 1 — optimizes for 100k+/1M+ (constitutionally forbidden) | 8 — 100 → 1k → 10k, every Shopify-scale capability frozen as a seam |
| **Composite** | **2.1** | **6.4** |

**Verdict: WINNER = Executable Architecture/Constitution · LOSER = old mission/blueprint docs.** The widest composite gap in the audit (6.4 vs 2.1). The number that matters: **the loser corpus is ~25 docs + 9 config JSON + 2 validators + 3 workflows still living outside `docs/archive/`**, several present-tense and dangerous (`docs/audit/13-final-architecture-blueprint.md:23-24` activates all 6 reserved services + a Wasm extension runtime; `docs/commerce-os-audit/10_BILLION_DOLLAR_..._ROADMAP.md:14` targets "multi-region read scale").

**Why the loser loses:** `ARCH-R3/R4`/`NEVER-R6`, ADR-019/ADR-021 — the maximalist plans are formally rejected and archived; the Codex-waves master plans self-describe as superseded inputs.

**Blocking condition before the loser can be removed:** mostly none-technical — these are doc archive moves (`DOC-R4`). The blocked subset is the *machine-enforced* distributed layer (Decision 9): the survivability/end-state validators require those configs/docs to exist, so retarget the validators first. Also author the missing `_GOVERNANCE_SPINE.md` or strip its 26 dangling citations.

**Reality plane:** Both live in the tree on A/B/C; the canon's archival of the maximalist trilogy is a C-only working-tree move.

---

## Decision 7 — `stepup/main` Working-Tree Reality vs `main` Reality (the branch decision)

| Dim | `main` reality (deploy branch) | `stepup/main` working-tree reality (Reality C) |
|---|---|---|
| AQ | 2 — pre-hardening platform (takeover, anon leaks, mutable money, 3% rake, regex sanitizer, debug-signed mobile) | 8 — the hardened end-state across all domains |
| CT | 7 — complete and committed (migrations end at 158) | 8 — the most complete reality (migrations 162–166, asymmetric identity, RLS GUC, DOMPurify) |
| PR | 2 — deployable but a "breach-and-insolvency generator" (PRODUCTION_READINESS §1) | 2 — best content, **worst version-control posture**: uncommitted, zero git history |
| MV | 1 — harms first real users | 6 — supervised-beta-capable after seams resolved |
| MA | 3 — encodes four contradictory self-definitions | 7 — one coherent canon |
| DX | 3 — old regime | 7 — clean canon + passing gate |
| FS | 2 — old topology | 8 — correct envelope |
| **Composite** | **2.9** | **6.6** |

**Verdict: WINNER = `stepup/main` working tree (Reality C) · LOSER = `main` as the operative/deployable state.** The defining duplication of the whole repo is **temporal, not spatial** (DUPLICATE_REALITY §2). The number that matters: **`main` is 30 commits behind `stepup/main` and is the only branch production CI deploys from** (`production-deploy.yml:3-7`) — so "live production" is, by config, the *oldest and most dangerous* of the three realities. Reality C wins everything except PR, where both score 2 (C because uncommitted, A because dangerous).

**Why the loser loses:** `DEPLOY-R1` (branch lag must be 0); `ANTI-R11` (working-tree completion is not production state, and `main` must not stay the deploy source of a condemned platform).

**Blocking condition before the loser can be removed:** Phase 0 — `git add -A` + commit on `stepup/main` (avoid the commit trap), ARB-ratify GATE-1, fast-forward `main` (branch-lag guard → 0), then deploy and run the live-seam probes (SKIP-D2/D3/D4/D5/D6). **Hard warning:** the triplication must NOT be "resolved" by `git checkout .` / `git clean -fd` — that resurrects A/B and **permanently destroys** Reality C (Constitution, AGENTS_V2, 15 ABRs, both archives, migrations 162–166, 23 validators — all `??` with zero history).

**Reality plane:** this decision *is* the plane decision. C is the intended truth; A is condemned-deployable; B (HEAD) is interim.

---

## Decision 8 — api-gateway Monolith vs merchant-control-plane Second Backend

| Dim | api-gateway monolith | merchant-control-plane second backend (62 `/api` routes) |
|---|---|---|
| AQ | 7 — single commerce backend, RLS+GUC, ledger, webhook boundary, sole money/identity authority | 3 — a parallel write surface duplicating gateway-owned domains; an app acting as a backend |
| CT | 8 — owns products/orders/inventory/themes/billing/payments end-to-end | 6 — 62 routes covering the same domains (products/orders/themes/billing/staff/…) |
| PR | 6 — deployable; the canonical backend in all realities | 4 — deployable but per-page call-graph (which UI calls which) is UNVERIFIED |
| MV | 7 — one backend = one contract for merchants | 3 — two writers per domain = drift and double-maintenance risk |
| MA | 6 — large but single-owner; clear mounts (`index.ts:673-771`) | 2 — violates `ARCH-R17` (apps = routing/rendering/adapters only), three logout/auth surfaces total |
| DX | 6 — one router to learn | 3 — duplicate Next API routes to keep aligned by hand |
| FS | 7 — monolith scales to 10k per canon | 3 — a second backend doubles the surface to scale |
| **Composite** | **6.7** | **3.4** |

**Verdict: WINNER = api-gateway monolith · LOSER = merchant-control-plane second backend.** The number that matters: **62 merchant-control-plane `/api` `route.ts` files duplicate gateway-owned commerce domains** (verified count; DUPLICATE_REALITY §7.1), and the platform has **three logout/auth surfaces** (MCP `/auth/logout` + gateway `/auth` + identity `/api/auth/*`). `ARCH-R1` gives the gateway the commerce backend; `ARCH-R17` restricts apps to "routing, rendering, presentation, runtime adapters, transport, hooks only"; CANONICAL_SYSTEMS #27 makes merchant-control-plane a *control plane*, not a backend.

**Why the loser loses:** two writers per domain is the "two parallel systems" anti-pattern at the API layer — drift, double-maintenance, and ambiguous source-of-truth for every merchant mutation.

**Blocking condition before the loser can be removed:** per-page call-graph tracing (UNVERIFIED — CODEBASE_REALITY §13.4) to learn which UI page actually calls each MCP route; then a proxy-or-port cutover with contract tests per route before removal. Note `gift-cards` is single-writer but in the *wrong* runtime (no gateway mount) — it must be ported, not just proxied. Storefront-runtime carries a third partial surface (`/api/customer/*` ×10, etc.) under the same winner/loser logic.

**Reality plane:** Both backends exist on A/B/C; this is a *spatial* duplicate, independent of the commit gap.

---

## Decision 9 — One-Region Monolith Topology vs Multi-Region/Distributed/Survivability Topology

| Dim | One-region monolith (`.com`, monolith + 4 satellites) | Multi-region / distributed / survivability topology |
|---|---|---|
| AQ | 8 — matches the constitutional constant (one region, India-first, 10k envelope) | 3 — 4-region failover, CQRS/event-store/replay-runtime contracts — the Never-Build list |
| CT | 7 — the implemented, deployed topology | 4 — a *contract layer* (7 config JSON + validators) with no live multi-region infrastructure (`mode: governance-contract-not-live-evidence`) |
| PR | 6 — real and deployable | 2 — fabricated regions/queue namespaces that exist nowhere in Terraform/wrangler |
| MV | 7 — correct cost/latency for India merchants | 2 — value-negative pre-build for a scale the platform will never target |
| MA | 7 — one topology, honest reserved seams | 2 — machine-enforced into CI *against* the Constitution (the GATE-1 self-block reborn) |
| DX | 7 — simple mental model | 2 — distributed-era manifests + survivability suite to maintain |
| FS | 8 — scales to 10k as designed | 3 — optimizes for 100k+/1M+ (forbidden); complexity tax with no payoff |
| **Composite** | **7.1** | **2.6** |

**Verdict: WINNER = one-region monolith topology · LOSER = multi-region/distributed/survivability topology.** The number that matters: **`whole-repo-end-state-validator.mjs:172-193` + `survivability-governance-validator.mjs:10-30,93-108` REQUIRE `globalRegions:[india,apac,eu,us]` + survivability CI in 3 workflows — directly violating the Constitution they claim to enforce** (`:98` validators may not certify multi-region; `:112` one region). This is the program's own self-inflicted contradiction (ARCHITECTURE_TRUTH §1.2, §7.1).

**Why the loser loses:** `ENV-R2`/`ARCH-R8`/`NEVER-R1`; the Constitution explicitly forbids multi-region survivability and partitioning-now; `config/runtime/multi-region-runtime.json` declares apac/eu/us queue namespaces that exist in no infrastructure config (fabricated capacity).

**Blocking condition before the loser can be removed (the loser is mandated by the new gate — the hard case):** an **ARB decision** to repeal the survivability contract (no `SKIP` row covers keeping it — ARCHITECTURE_TRUTH §10.1), then a **paired** retarget that must land in one change: `survivability-governance-validator.mjs` + the `whole-repo-end-state-validator.mjs` multi-region/`validate:survivability` assertions + the `production-topology.json` `globalRegions` block + the 3 workflows. Only *then* do the configs and ≥10 surviving distributed-governance docs become archivable. Deleting them first fails CI.

**Reality plane:** Monolith topology on A/B/C. The multi-region *contract* is tracked (lives on A/B/C); the end-state validator that locks it is untracked (C only) — so committing C without fixing this *worsens* the contradiction by making it gate-enforced.

---

## Decision 10 — Mobile: Navigator+BFF-Composite vs Dead GoRouter; ui_kit Tokens vs App-Local; Which Theme Editor Survives

This decision bundles three mobile sub-calls. Scored together (winner side = the canonical survivor in each).

**10a — Navigation: classic Navigator + composite BFF dashboard vs dead GoRouter deep-link system**

| Dim | Navigator + composite BFF dashboard | Dead GoRouter `deep_link_router` |
|---|---|---|
| AQ | 6 — `MaterialApp` + `onGenerateRoute` + 5-tab IndexedStack; composite `/v1/mobile/dashboard` (1 call vs 5) | 4 — a declared GoRouter never mounted (`.router` not used); no intent filters |
| CT | 6 — 30 reachable screens, composite dashboard real and consumed | 1 — `AppDeepLinkRouter` referenced only by tests; `resolve()` has no production caller |
| PR | 4 — works, but login is broken (Turnstile double-spend) | 0 — dead code; `go_router ^17.0.0` is a dependency feeding nothing |
| MV | 5 — core merchant flows reachable | 0 — delivers nothing to users |
| MA | 5 — one nav system if the dead one is removed | 1 — a second never-mounted nav system is pure debt |
| DX | 5 — conventional Flutter nav | 2 — typed `AppRouteId`/`routeForId()` with zero callers |
| FS | 6 — fine for the app's scope | 1 — n/a |
| **Composite** | **5.3** | **1.3** |

**10b — Tokens: ui_kit generated (DTCG) tokens vs app-local token forks**

| Dim | ui_kit generated tokens (DTCG bridge) | App-local token/color files |
|---|---|---|
| AQ | 7 — generated from `tokens.json`, `--check` exits 0 (in sync) | 3 — three forks of the token core (the design-system memory's known 3× fork) |
| CT | 7 — 77/154 lib files consume kit tokens (473 color + 101 spacing refs) | 4 — deleted in worktree (4 app-local files removed) |
| PR | 6 — bridge verified in sync | 3 — divergence risk; deleted on C |
| MV | 5 — consistent theming | 2 — drift between web and mobile |
| MA | 7 — single token source | 2 — multiple authorities |
| DX | 6 — generated, do-not-edit | 3 — hand-maintained forks |
| FS | 7 — scales as one source | 3 — n/a |
| **Composite** | **6.4** | **2.9** |

**10c — Theme editor: which (if any) survives**

| Dim | `ThemeScreen`(631L)+`SectionEditorScreen`(1,200L)+12 editor widgets | Read-only `LivePreviewScreen` (what the dashboard actually opens) |
|---|---|---|
| AQ | 7 — the app's historically strongest surface (device frames, layers, AI homepage gen) | 4 — a WebView preview, no editing |
| CT | **7** — fully implemented | 5 — implemented but read-only |
| PR | **0** — DEAD: zero construction sites; "Customize Design" opens LivePreview instead (home_screen.dart:423-426); editor tab lands on Settings | 5 — reachable and works |
| MV | 0 — unreachable = zero delivered value despite the code | 4 — merchant can preview, not edit, on mobile |
| MA | 2 — 1,800+ lines of dead editor + 63 hardcoded colors inside it | 5 — small, reachable |
| DX | 4 — rich but orphaned | 5 — simple |
| FS | 3 — n/a while dead | 5 — fine |
| **Composite** | **3.3** | **4.7** |

**Verdict:**
- **10a WINNER = Navigator + composite BFF · LOSER = dead GoRouter** (remove `deep_link_router.dart` + `go_router` dep). Number that matters: **34 of 64 screens are unreachable** and all 36 `/features/*` routes have zero inbound navigation (they exist only to satisfy validators — MOBILE_TRUTH §1, §4).
- **10b WINNER = ui_kit generated tokens · LOSER = app-local forks** (already deleted on C; `--check` exit 0). Residue: 190 `Color(0x…)` literals remain (~63 inside the dead editor).
- **10c — the honest-tension sub-call: by *capability* the section editor is the strongest mobile feature, but it is DEAD (PR=0), so the operative survivor is the read-only LivePreview.** The section/theme editor must EITHER be re-wired (given a construction site / route) OR deleted — it cannot stay as 1,800 lines of unreachable code. Strategic recommendation: re-wire it (it is the most valuable mobile surface and re-wiring is a navigation fix, not a rebuild); if not re-wired this convergence cycle, delete it. This is the mobile mirror of Decision 1's "completeness ≠ deletability."

**Blocking conditions:** (10a) confirm no external system targets `/features/*` or deep links (none found in-repo) → then delete the dead nav. (10c) Fix the **login Turnstile double-spend first** (BFF consumes the single-use token, identity re-verifies → `timeout-or-duplicate`) — this is a *bug*, not a seam, and blocks any mobile launch regardless of the editor decision; then either route the editor or delete it.

**Reality plane:** All mobile hardening (composite BFF, token bridge, fail-closed signing, parity-catalog deletion) is on **C only**; A/B ship debug-signed builds and the parity catalog. The dead editor and double-spend exist on A/B/C.

---

## Decision 11 — Commission 0 bps vs 300 bps Economics

| Dim | Commission 0 bps (worktree) | Commission 300 bps / 3% rake (main/HEAD) |
|---|---|---|
| AQ | 7 — `?? 0` fallbacks + mig 162 zeroing defaults + `commission-bps-zero-validator` ratchet | 4 — `?? 300` fallbacks + DB default 300 (119:81,108) |
| CT | 6 — implemented in code; mig 162 untracked | 8 — fully present and committed in every shipped state |
| PR | 3 — commission-zero exists only on C; clean checkout still defaults 3% | 6 — deployable (it is what `main` runs) |
| MV | 9 — 0% fee is the platform's strategic wedge for India merchants | 2 — a 3% GMV rake is the thing the business plan says to kill |
| MA | 6 — one rate, validator-enforced; but mig 162 rewrites historical rows in-place with no ledger entry | 5 — entrenched but simple |
| DX | 6 — no fee math to reason about | 5 — fee+GST math everywhere |
| FS | 8 — 0% scales as a durable promise | 3 — a rake is a competitive liability at scale |
| **Composite** | **6.4** | **4.7** |

**Verdict: WINNER = 0 bps · LOSER = 300 bps.** The number that matters: **every committed state of the repo (`main` AND HEAD) still defaults to a 3% rake** — `?? 300` fallbacks and DB default 300; the zero is `?? 0` (payouts.ts:345, verified) + untracked migration 162 only (MONEY_TRUTH §6). `PAY-R3`/`NEVER-R5` make 0% permanent; the app-marketplace 15% partner-app fee is intentionally out of scope.

**Why the loser loses:** the 3% GMV rake is the business-model liability the canon and the business verdict explicitly kill; 0% is the India-merchant wedge.

**Blocking condition before the loser can be removed:** commit migration 162 + the validator; verify live-DB row state (UNVERIFIED). **ARB call required** on migration 162's in-place historical-row rewrite (it edits past commission rows with no ledger correction entry — an audit contradiction *inside* the fix; DATABASE_TRUTH §7.1): decide ledgered-correction vs accepted-backfill.

**Reality plane:** Loser on A/B (committed defaults). Winner on C only.

---

## Decision 12 — Payout: Provider-Split Rails vs RazorpayX Self-Custody

| Dim | Provider-aggregator split (Razorpay Route / Cashfree) | RazorpayX self-custody |
|---|---|---|
| AQ | 7 — never-custody PA-split is the canonical rail; `no-self-custody-rail-validator` forbids razorpayx defaults | 3 — self-custody holds merchant funds (regulatory + insolvency risk) |
| CT | 4 — default is `razorpay_route` (worktree) but **no provider client exists** — `initiateTransfer` throws | 4 — also non-functional (razorpayx default at HEAD; transfer throws too) |
| PR | 2 — release is fail-closed dead code; env-gated 503 | 2 — same dead path; legal enum residue in ~8 sites + a DB CHECK |
| MV | 6 — correct rail model; merchants paid via PA-split (when wired) | 2 — self-custody is the model the canon forbids |
| MA | 6 — one rail family (target); razorpayx residue to purge | 3 — self-custody enum scattered across types/schemas |
| DX | 5 — adapter shape exists | 4 — simpler but wrong |
| FS | 7 — PA-split scales without LetBuyy becoming a money transmitter | 2 — self-custody does not scale (compliance) |
| **Composite** | **5.3** | **2.9** |

**Verdict: WINNER = provider-split rails (never-custody) · LOSER = RazorpayX self-custody.** The number that matters: **`initiateTransfer` unconditionally throws `PayoutProviderUnavailable` — no payout can move money in ANY reality** (verified payout-transfer-adapter/index.ts:85-86,104; MONEY_TRUTH §4.4). So this is a decision between a correct-but-unbuilt rail and a forbidden-and-unbuilt rail — the winner is the *target*, neither pays a merchant today. `PAY-R4`/`NEVER-R2` make never-custody PA-split canonical.

**Why the loser loses:** self-custody makes LetBuyy hold merchant funds (the exact regulatory/insolvency posture the constitution forbids); razorpayx survives only as a legal enum member and a `partner_payout_ledger_entries.rail` CHECK.

**Blocking condition before the loser can be removed:** commit the worktree (removes the razorpayx *defaults*); a migration to purge razorpayx from enums/CHECKs; **a real payout provider client must be built** (genuine capability gap — survives any merge); live Route credentials are a human seam (`HR-PA-SPLIT-LIVE`, 503 in live mode).

**Reality plane:** razorpayx defaults on A/B; razorpay_route default + validator on C. Both rails are dead code on all planes.

---

## Decision 13 — Storefront Capture: Ledgered Path vs `confirm_order_payment_with_ledger` (no-ledger)

| Dim | Ledgered capture (target) | `confirm_order_payment_with_ledger` (no-ledger, baseline:1590) |
|---|---|---|
| AQ | 8 — `post_settlement_ledger_transaction`; pa_clearing debit / merchant_payable credit; idempotent; the V1 `/payments` surface does this correctly | 3 — flips `orders.payment_status='paid'` + `payment_transactions` captured; **zero canonical ledger lines** despite the name (naming theater) |
| CT | 4 — exists only on the V1 payments-session surface; the storefront route does NOT use it | **9** — the complete, working path every shopper actually hits (verify route + all 4 provider webhooks) |
| PR | 3 — not wired to the storefront/webhook confirm chain in any reality | 6 — deployable and functional (it moves order state correctly) |
| MV | 6 — auditable capture (if wired) | 4 — orders get paid, but money truth is missing → wallet/payout interlock fails |
| MA | 7 — single canonical poster | 3 — invisible to `canonical-ledger-only-validator` (SQL-side; `orders` not in the ratchet list) |
| DX | 6 — RPC posting plan | 5 — simple but un-ledgered |
| FS | 8 — ledgered capture scales with clean reconciliation | 4 — un-ledgered capture accumulates silent money drift |
| **Composite** | **6.0** | **4.6** |

**Verdict: WINNER = ledgered capture (strategic target) · LOSER = `confirm_order_payment_with_ledger` no-ledger chain — BUT both are "owned" by the gateway and NEITHER is the wired winner.** The number that matters: **the storefront capture path posts ZERO canonical ledger entries in all three realities** (verified: the function calls no `post_ledger_transaction`; baseline has 68 canonical-table references but none inside this function — MONEY_TRUTH §1.2, §2a). The `_with_ledger` suffix refers to `payment_transactions` at best. The loser wins completeness-today **9 vs 4** because it *is* the path every buyer hits; the winner exists only on the lower-traffic V1 `/payments` surface.

**Why the loser loses (as the target):** `PAY-R2` names this exact function; un-ledgered capture means paid orders contribute to payout-statement gross but not to `merchant_payable`, so the payout claim guard (correctly) refuses to release — money cannot flow end-to-end. This is the single largest unfinished winner in the repo.

**Blocking condition before the loser can be removed:** the storefront/webhook confirm chain must post canonical ledger entries (or route through the canonical capture adapter) **— a genuine capability gap that survives any commit/merge**; plus reconciliation harness green; plus the same for the two un-ledgered refund paths (`complete_order_refund`, webhook `refund.created`). The `canonical-ledger-only-validator` must also be extended to see SQL writers and add `orders` to its table list (today it is structurally blind here).

**Reality plane:** the no-ledger path is the buyer-facing reality on A/B/C; the ledgered V1 path exists on B/C (capture/refund postings absent at `main`). This is the one major money pair where **even Reality C has not made the winner live.**

---

## Winner Registry

| # | Domain | WINNER | Composite | One-number headline |
|---|---|---|---|---|
| 1 | Themes — renderer | **Liquid (strategic target)** | 4.7 vs 6.6 React | React wins CT 9 vs 2; React NOT deletable (header/footer have no Liquid map) |
| 2 | Identity — issuance | **identity-platform asymmetric sole issuer** | 6.3 vs 4.0 | asymmetric covers exactly 1 of ~5 token types |
| 3 | Money — model | **canonical append-only ledger** | 6.7 vs 3.6 | wallet read 409s forever until manual backfill |
| 4 | Tenancy | **RLS+FORCE+GUC (`withTenantTx`)** | 6.3 vs 3.9 | 25 PUBLIC `USING(true)` policies survive final state |
| 5 | Governance | **Constitution/AGENTS_V2** | 6.4 vs 3.0 | gate 181 → 90; entirely uncommitted |
| 6 | Architecture docs | **Executable Architecture/Constitution** | 6.4 vs 2.1 | ~25 dangerous docs still live outside archive |
| 7 | Branch reality | **`stepup/main` working tree (C)** | 6.6 vs 2.9 | `main` (deploy branch) is 30 commits behind |
| 8 | Storefront backend | **api-gateway monolith** | 6.7 vs 3.4 | 62 merchant-control-plane routes duplicate it |
| 9 | Topology | **one-region monolith** | 7.1 vs 2.6 | new end-state validator MANDATES 4 forbidden regions |
| 10a | Mobile nav | **Navigator + composite BFF** | 5.3 vs 1.3 | 34/64 screens unreachable |
| 10b | Mobile tokens | **ui_kit generated tokens** | 6.4 vs 2.9 | bridge `--check` exit 0; forks deleted on C |
| 10c | Mobile theme editor | **(re-wire) section editor, else LivePreview** | 3.3 dead vs 4.7 live | the richest mobile surface is DEAD (PR=0) |
| 11 | Commission | **0 bps** | 6.4 vs 4.7 | every committed state still defaults to 3% |
| 12 | Payout rail | **provider-split (never-custody)** | 5.3 vs 2.9 | `initiateTransfer` throws — no rail pays anyone |
| 13 | Storefront capture | **ledgered capture (target)** | 6.0 vs 4.6 | every-shopper path posts 0 ledger lines |

All 14 winner rows **match the `_PREMISES_SEED.md` spine** — no winner is overturned by the scoring. (See the honest-tension section for where completeness contradicts the winner.)

---

## Loser Registry (with removal-blocking conditions)

| Loser | Removal-blocking condition (must ALL hold) | Genuine capability gap? |
|---|---|---|
| React renderer | 8-item deletion gate (Liquid header/footer + section routing + commerce data binding + full templates + real cart/customer drops + canary write path + merchant install/edit surface + ARB flip ratification) | YES — Liquid is unbuilt for a real store |
| Gateway randomHex + AUTH_SECRET HS256 | commit+deploy asymmetric; `IDN-R2` zero-legacy-HS256 telemetry; move shopper/console/app/`lb_accounts` to identity-platform; identity-foundation shadow stack verify-only first | Partial — non-merchant realms still HS256 |
| Mutable wallet/commission/payout model | commit mig 160/162/165; wire reconciliation refreshers to a scheduler; live zero-drift proof (`SKIP-D5`); backfill to canonical | YES — refreshers have 0 callers; wallet 409s |
| Raw service-role/REST plane | commit mig 164; RT-1…9 per-route adoption proof; raw-REST helpers get tenant-guard parity or callers removed; close 25 permissive policies; fail-close queue envelope | Partial — 25 policies + raw-REST bypass real |
| Scan-generated AGENTS.md regime | Phase-0 commit (avoid commit trap); ARB GATE-1 ratification; extend anti-scan validator to 38 nested files; resolve DOC-02 divergence | NO — pure governance/commit gap |
| Old mission/blueprint docs | archive moves (`DOC-R4`); BUT the machine-enforced distributed subset blocked on Decision 9's validator retarget | NO (docs) |
| `main` as operative state | Phase-0 commit + ratify + fast-forward `main` (lag→0) + deploy + live probes; never `git clean -fd` | NO — version-control gap |
| merchant-control-plane second backend | per-page call-graph trace; proxy-or-port cutover with contract tests per route; port `gift-cards` (no gateway mount) | NO — but tracing UNVERIFIED |
| Multi-region/distributed/survivability topology | **ARB repeal** + paired retarget of 2 validators + `production-topology.json` regions + 3 workflows IN ONE CHANGE, then archive configs/docs | NO — but self-mandated by the new gate |
| Dead GoRouter / app-local tokens | confirm no external `/features/*`/deep-link consumers (none in-repo); then delete + drop `go_router` dep | NO |
| Mobile section/theme editor (if not re-wired) | decision: re-wire (navigation fix) OR delete; fix login Turnstile double-spend regardless | The double-spend is a bug, not a seam |
| 300 bps commission | commit mig 162 + validator; verify live-DB rows; ARB call on in-place history rewrite | NO |
| RazorpayX self-custody | commit (removes defaults); migration to purge enum/CHECK residue; **build a payout provider client**; live Route creds (`HR-PA-SPLIT-LIVE`) | YES — no provider client exists |
| `confirm_order_payment_with_ledger` no-ledger chain | storefront/webhook confirm must post canonical ledger (or route via canonical adapter); same for 2 refund paths; extend validator to SQL + `orders` | **YES — the largest unfinished winner** |

---

## Decisions Where Completeness Contradicts the Strategic Winner (the honest-tension section)

Three decisions have a **completeness-vs-strategy inversion** large enough that the *complete* side is the loser. Naming these is the core value of a scored phase over a spine restatement.

1. **Decision 1 — React (CT 9) loses to Liquid (CT 2).** The strategic winner has ~2/10 of the capability of the loser. React serves 100% of stores with header/footer, live data binding, multi-template routing, and a full editor; Liquid has no header/footer (the canary plan *empties* those groups), hard-coded product strings, a single `index` template, stubbed cart/customer drops, and no merchant install path. **Deleting the loser today blanks every storefront.** This is the textbook "ratified winner is the right strategic call, but completeness forbids acting on it now" — the spine is correct to mark React NOT-deletable. Tension magnitude: **highest** (CT gap of 7).

2. **Decision 13 — the no-ledger capture path (CT 9) beats the ledgered target (CT 4), and the winner isn't even wired.** The complete, working, every-shopper-hits-it path writes zero ledger lines; the ledgered "winner" exists only on a low-traffic surface and is connected to nothing the buyer touches. Unique among all 13: **even Reality C (the hardened end-state) has not made this winner live.** Tension magnitude: **highest, and worst-consequence** (it is why money cannot flow end-to-end — un-ledgered captures are unpayable by the payout guard).

3. **Decision 10c — the section/theme editor (CT 7) is the richest mobile surface but is DEAD (PR 0).** 1,800+ lines of the strongest mobile feature with zero construction sites; the operative survivor is a read-only WebView preview that does less but is reachable. **Completeness of *implementation* (7) is meaningless against completeness of the *product* (0 reachability).** The honest call: re-wire it (a navigation fix unlocks the most valuable mobile capability) or delete it — it cannot persist as dead weight. Tension magnitude: **high** (the inversion is implementation-complete vs user-reachable).

Secondary (lower-magnitude) inversions worth flagging: **Decision 2** (legacy sessions CT 8 > asymmetric CT 6 — but only because the winner is uncommitted), **Decision 11** (3% rake CT 8 > 0% CT 6 — winner uncommitted), and **Decision 12/13's shared trait** that several "winners" (payout rail, storefront ledger) are *targets with no working implementation today* — the spine's winner is strategically right but operationally absent.

**The unifying pattern:** in every inversion, the loser is "complete" because it is the *old, committed, deployed* thing, and the winner is "incomplete" because it is *new and uncommitted* OR *correct-but-unbuilt*. Convergence cannot be a delete-the-losers sweep; it is a **gated sequence**: commit + ratify (Phase 0) flips PR for most winners overnight, but Decisions 1, 12, and 13 (and the mobile double-spend) require genuine capability work that no `git add` resolves.

---

## Unknowns / UNVERIFIED

1. **Live deployed state** of every domain — the repo cannot prove what production runs; CI builds from `main` (old topology). Live identity plane, live DB migration level, live RLS/grant state, live Vercel projects, live commission rows: all UNVERIFIED.
2. **merchant-control-plane per-page call-graph** (Decision 8) — which UI page calls which of the 62 MCP routes vs the gateway is UNVERIFIED (CODEBASE_REALITY §13.4); blocks safe cutover sequencing.
3. **`production-topology.json` `globalRegions` semantics** (Decision 9) — whether it encodes Cloudflare *edge* presence (compatible with one-region doctrine) or a *data-region* contract (incompatible). Self-labeled `mode: governance-contract-not-live-evidence`.
4. **Mobile login live behavior** (Decision 10) — the Turnstile double-spend is code-derived; if Cloudflare keys were "always-pass" test keys, duplicates would succeed (site keys in dart-defines are real `0x4…` keys, suggesting they would fail). No network access to confirm.
5. **Behavioral test execution** — theme-engine and money D5 RPC tests could not run in-sandbox (esbuild platform mismatch; no DB for mig 165's RPCs). Many "tests" cited are source-string assertions, not behavior.
6. **ARB intent on multi-region** (Decision 9) — whether keeping the survivability contract was directed or program improvisation is UNVERIFIED; no `SKIP` row covers the decision, only the act.
7. **Migration 162 in-place history rewrite** (Decision 11) — whether the ARB will accept an un-ledgered backfill of past commission rows or require a ledgered correction is an open human decision.
8. **Composite scores are judgment calls** anchored to cited evidence; the *winner/loser direction* is robust (no inversion changes which side wins on architecture+future-fit), but exact decimals are defensible estimates, not measurements.

---

*End of report. Discovery/decision only — the only file written is this report. No code, architecture, or git state was modified.*
