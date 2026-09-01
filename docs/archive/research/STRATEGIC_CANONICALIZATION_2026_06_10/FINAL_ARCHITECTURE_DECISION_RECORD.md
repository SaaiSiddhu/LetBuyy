# LETBUYY — FINAL ARCHITECTURE DECISION RECORD (the constitutional capstone)

> **Document type:** Architecture Decision Record (ADR set) — the constitutional capstone of the Strategic Canonicalization program. The single authoritative statement of **what LetBuyy IS**, ratified by the Architecture Review Board.
> **Date:** 2026-06-10
> **Author:** Architecture Review Board (ABR), chair.
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty.
> **Status:** **ACCEPTED.** This record **supersedes** the competing definitions of the platform: it ratifies `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (together, "V1+Freeze") as the **sole constitution**; it **formally rejects** the maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` (1M-merchant / 22-service / Wasm-runtime vision) and the `AGENTS.md` 9-app end-state as **active topology**; and it directs `AGENTS.md` and the validator suite to be **regenerated from / retargeted to V1**.
> **Authority over prior records:** this ADR sits above the nine domain deliverables and the two summary deliverables of the Strategic Canonicalization program (the 11 siblings listed in §0.3) and above `FORENSIC_MASTER_2026_06_10/` (the evidence base). Where any sibling and this record disagree on *what is canonical*, this record governs; where they disagree on *evidence*, the forensic master governs and this record is wrong and must be corrected. No code is modified by this document.

---

## 0. Preamble — what this record is, and the inputs it ratifies

### 0.1 Purpose

The Strategic Canonicalization program asked, across every domain, one question: **of the competing implementations in this tree, which one should still exist at 10,000 India merchants?** Nine domain deliverables answered it for their slice; two summary deliverables (the Strategic Winners Master Plan and the Canonical Architecture Matrix) aggregated those answers; a readiness report scored how far each winner is from production; a Shopify-alignment report tested the winners against the reference platform. This record is the **constitutional ratification** of that body of work: it states the canonical architecture as a single decisive position, records each load-bearing call as a numbered ADR with full fields, and answers the directive's closing executive questions (30 / 90 / 180 / 365 days; the five "what to delete / freeze / complete / never-build / make-canonical" questions) with specific component and ISSUE-ID lists.

It exists because the platform has, until now, had **no single authoritative statement of what it is** — it has had four (see §2). This record ends that.

### 0.2 The decision rule (inherited, applied literally)

> **The Strategic Winner is the implementation that should still exist at 10,000 India merchants — not the oldest, the most complete, or the easiest to keep.** LetBuyy has **zero production merchants and zero legacy burden**, so it moves directly to the intended architecture and preserves nothing for its own sake.

This rule is decisive precisely because it crowns the *less complete* thing wherever the less complete thing is the one that scales and supports the ecosystem: the canonical double-entry ledger over the busier legacy capture path; Liquid over the more-complete React renderer; `identity-platform` over the more-load-bearing gateway auth; RLS+GUC over the app-only tenant guard. Every ADR below is an application of this rule.

### 0.3 Ratified inputs (precedence order)

1. **`LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`** — the constitution (the destination). **CANONICAL.**
2. **`_ANCHOR_DECISIONS_SPINE.md`** (A0–A9) — the coherence backbone; every ADR traces to an anchor.
3. The nine domain deliverables + two summaries in `STRATEGIC_CANONICALIZATION_2026_06_10/`:
   - `STRATEGIC_WINNERS_MASTER_PLAN.md` — the 32-domain winner ledger + 9-cluster ABR blocks.
   - `CANONICAL_ARCHITECTURE_MATRIX.md` — the ~121-component classification matrix + target diagram + totals.
   - `IDENTITY_MIGRATION_MASTER_PLAN.md` (IDN / D-01…D-14) — the four-impl collapse + asymmetric re-key.
   - `MONEY_SYSTEM_CANONICALIZATION_PLAN.md` (MNY / PAY / DB) — the SSOT-ledger + adapter map + PA-split.
   - `TENANT_ISOLATION_CANONICALIZATION_PLAN.md` (TEN / FND / DB) — the three-layer fail-closed stack.
   - `THEME_MIGRATION_MASTER_PLAN.md` (THEME / DEC-1…10) — React→Liquid, gated.
   - `UI_UX_UNIFICATION_MASTER_PLAN.md` (UIUX / MOB) — one token source + one shell + honesty badge.
   - `LEGACY_ERADICATION_REGISTER.md` (LEG-001…078) — the loser ledger.
   - `SAFE_DELETION_PLAN.md` (DEL-0…078) — the gated removal plan + V-IMPORT/V-BUILD/V-TEST/V-GOV/V-SMOKE/V-ROLLBACK taxonomy.
   - `PLATFORM_SIMPLIFICATION_PLAN.md` (PLT / TOPO) — the four-realities collapse + governance retarget.
   - `PRODUCTION_READINESS_GAP_REPORT.md` (RDY / W-00…W-37) — completion% + eng-week effort + go-live gating.
   - `SHOPIFY_ALIGNMENT_REPORT.md` (SHOP-001…021) — ALIGN / DIVERGE / LEAPFROG verdicts + parity scorecard.
4. **`FORENSIC_MASTER_2026_06_10/`** — `000_MASTER_INDEX.md` (the four questions; 291 issues / 9 S0) + `TOP_250_PLATFORM_ISSUES.md` (ISSUE-001…291). The evidence base; every claim in this record traces here.

*(The directive references "14 sibling deliverables." This record cross-references the 11 strategic-program deliverables above plus the 3-document constitution/forensic spine — V1, Freeze, and the forensic master — as the body it ratifies.)*

### 0.4 Classification legend (verbatim from the spine; used in every ADR)

| Class | Meaning |
|---|---|
| **CANONICAL** | The winner — build/finish it. It is what exists at 10k merchants. |
| **TRANSITIONAL** | Real today, kept only until the winner lands. A managed bridge. |
| **LEGACY** | Superseded; freeze, then delete after migration proves zero drift. |
| **DEAD** | No value or actively dangerous; SAFE_DELETE / remove now. |
| **FROZEN** | Rejected-for-envelope but keep an empty seam; reconsider at a named trigger (≈5k merchants + developer/theme-author demand). |

### 0.5 The wave model (the sequencing law this record commits to)

No `IMPLEMENTATION_EXECUTION_ROADMAP.md` exists in the program folder; this record therefore commits the canonical 9-wave structure (the cross-cutting sequencing law of A0, mapped onto the master execution plan's Phases A–E):

| Wave | Theme | Maps to |
|---|---|---|
| **0** | **Architecture decisions + Emergency stabilization** — ratify this ADR; merge the 30-behind branch; close the 3 security S0 paths. | Phase A |
| **1** | **Foundations** — money correctness for live keys; the RLS+GUC tenancy backbone; outbox-atomic. | Phase A→B |
| **2** | **Completion (true-up)** — FORCE+GUC on all 261 tables; identity collapse + asymmetric re-key; governance retarget; topology de-deploys; domain cutover. | Phase B→C |
| **3** | **Traffic migration** — hosted checkout origin; GST; Shipping; notifications; scoped WhatsApp; honesty badge; mobile signing; ops consolidation. | Phase C→D |
| **4** | **Legacy freeze** — Liquid becomes the default renderer (per-theme + canary); consent ledger; MFA; storefront forks die. | Phase D |
| **5** | **Legacy removal** — bigint money cutover; `store_id`/`site_id` + `users`/`users_custom` normalization; dead-table drops; catalog seeding. | Phase E |
| **6** | **Hardening** — React-renderer delete-or-freeze decided by data; design-system drift burn-down; perf budgets. | Phase E |
| **7** | **Production readiness** — observability quartet; OIDC provider (demand-gated). | Phase E+ |
| **8** | **Shopify-class** — passkeys; 3rd-party theme/app authoring — all gated at ≈5k merchants. | Phase E+ |

---

## 1. Executive summary — the decision, in six sentences

1. **LetBuyy is, and will be, a single modular-monolith (`api-gateway`) plus four satellites (`queue-workers`, `mobile-bff`, `identity-platform`, `webhook-service`) over one RLS-isolated Postgres on Cloudflare (ap-south) + Vercel, governed by one constitution (V1+Freeze) and one validator suite that enforces it** — not the nine-app / CQRS / multi-region end-state the platform drifted into and still certifies green.
2. **Money is one append-only double-entry ledger as the sole source of truth** — balance always *derived*, every capture/refund/COD/tender posting through it in `bigint` paise, money-out via a licensed PA-split (Razorpay Route / Cashfree) where **LetBuyy never custodies funds**, a permanent **0% transaction fee**, and reconciliation to zero-break-or-explained-suspense.
3. **Identity is `identity-platform` as the sole asymmetric token issuer** for all three realms (merchant/staff, buyer/customer, platform-operator) — passwordless buyer OTP, OAuth2/PKCE, a DPDP consent ledger, and a deferred-but-honest OIDC provider — with every other service **verify-only**, collapsing the four parallel auth implementations into one.
4. **Tenancy is layered and fail-closed** — Postgres RLS `ENABLE`+`FORCE` plus a per-transaction tenant GUC set from validated JWT claims as the **load-bearing DB backstop**, the app-layer query-lint guard and ownership checks kept permanently as the outer defense-in-depth, and the gateway demoted off blanket `service_role`.
5. **Commerce is server-authoritative throughout** — one `create_checkout_order` RPC, server cart, reserve→commit inventory, the typed 3-class discount engine, GST place-of-supply with immutable invoices, Shiprocket-real shipping behind a carrier adapter, a WhatsApp-first notifications router — fronted by a **Liquid-first Online-Store-2.0 theme platform** (the ecosystem winner over the more-complete React renderer) and a **hosted `checkout.letbuyy.com` origin**, on **one storefront runtime** and **one design-system token source + app shell**.
6. **Everything Shopify-end-state is rejected-for-envelope and kept only as an empty seam** — the Wasm checkout-functions runtime, the 3rd-party app marketplace, CQRS/saga/multi-region governance, headless Hydrogen, and the six reserved services — deleted now where it is pure dead weight (the ~13.3k-LOC CQRS package cluster, the ~15.3k-LOC abandoned Firebase backend, ~37 product-dead tables, the ~36 fiction validators); the program is therefore **deletion and completion, not imitation**, and the hard core V1 asked for is largely built and one merge / one default-number / one connection-role / one feature-flip from being real.

---

## 2. The canonical architecture (decisive restatement)

### 2.1 The final position (one line)

> **LetBuyy is a single India-only modular-monolith commerce platform — `api-gateway` + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` over one RLS+GUC Postgres — with a canonical append-only double-entry ledger as the only money truth, `identity-platform` as the sole asymmetric token issuer, server-authoritative Liquid-first commerce with a hosted checkout origin, money moved only via never-custody PA-split at a permanent 0% fee, and every Shopify-scale capability frozen as an empty seam until merchant and developer demand exist.**

### 2.2 The eleven load-bearing positions (the restatement V1 ratifies, FREEZE locks, and this record makes constitutional)

| # | Layer | The canonical position (non-negotiable) |
|---|---|---|
| 1 | **Constitution / governance** | **One** constitution = V1+Freeze. **One** validator suite that enforces V1. `AGENTS.md` is the *generated map* of V1, never a competing authority. The maximalist CHECKOUT_PLATFORM vision is rejected and archived. |
| 2 | **Topology / monolith** | `api-gateway` (modular monolith) + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` + the Next.js read/admin apps (`storefront-runtime`, `merchant-control-plane`, `marketing-site`, one thin ops console) over one Postgres on Cloudflare (ap-south) + Vercel. **No service fleet. No microservice extraction by domain.** |
| 3 | **Identity** | `identity-platform` is the **sole issuer** of all identity for all three realms; **asymmetric (EdDSA/Ed25519, ES256 fallback) sole-signer**; every other runtime verify-only with the public key; per-audience claims. Buyer realm passwordless OTP, host-scoped cookies. OIDC + passkeys canonical-but-deferred. |
| 4 | **Tenancy** | **Layered fail-closed:** RLS `ENABLE`+`FORCE` + per-transaction tenant GUC from validated claims (the load-bearing DB backstop, on all 261 tenant tables) + app-layer query-lint guard + ownership checks (permanent outer layers). Gateway runs under an RLS-subject `app_tenant` role; `service_role` is a narrow audited break-glass hatch. |
| 5 | **Money / ledger** | The canonical append-only double-entry ledger (8 accounts, migrations 139–161) is the **single money source of truth**; balance always *derived*; `bigint` paise everywhere; one writer (settlement module); append-only enforced by **trigger AND `REVOKE`**; reconcile to zero-break-or-suspense; second factor is **real cryptography**. |
| 6 | **Money / movement** | **PA-split, never custody.** Money-in flows to the merchant's own Razorpay (merchant = MoR); money-out is a split-instruction + statement-mirror + reconciliation through a licensed PA (Razorpay Route / Cashfree). **There is no `razorpayx` self-custody rail.** **0% transaction fee, permanent.** Monetization is subscription + adjacencies, never the sale. |
| 7 | **Checkout** | **Server-authoritative end-to-end.** One `create_checkout_order` RPC; server cart; a hosted **`checkout.letbuyy.com`** origin consuming a **cart-bound signed handoff**; reserve-with-TTL not pre-payment hard-decrement. **No checkout extensibility** (seam only — the Wasm functions runtime is removed from the live route). |
| 8 | **Theme** | **Liquid-first, Online-Store-2.0-shaped** (sections/blocks/JSON templates/section-groups/settings schema/data-only sandbox). Liquid is the canonical renderer; React is a first-party fast-path frozen at parity and deleted-or-frozen by data at Wave 6. `theme-engine` is canonical for contracts/schema/validation/bundle. Both editors (web + Flutter) are the differentiator — protect them. |
| 9 | **Storefront** | **One runtime** = `storefront-runtime` (Next.js/Vercel) SSR/ISR + Worker Cache, hosting the Liquid renderer at target state. **No headless Hydrogen/Oxygen split.** The 3-tier KV-versioned cache stays canonical. |
| 10 | **Design system** | **One token source** (`@letbuyy/ui` / `packages/typescript/ui/src/tokens.ts`, DTCG); the Dart `ui_kit` consumes a **generated bridge** from it. **One app shell** (`AppNavigation`) across all surfaces. A systemic **provider-mode honesty badge** on every money/fulfillment surface. The drift ratchet **blocks** new drift. |
| 11 | **Reserved services / 0%-fee / legacy-deletion** | The six reserved services (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`) stay **manifest-only / empty**. The 0% fee is permanent. Legacy is **frozen, then deleted only after the winner serves + a zero-drift proof** (the SAFE_DELETION taxonomy). |

### 2.3 What the canonical architecture is NOT (the rejected envelope)

- **Not** a nine-app, 22-service, multi-region, CQRS/event-store/saga/replay/projection distributed system. That is the maximalist vision the platform drifted into; it is rejected for the 100→10k India envelope.
- **Not** a money custodian. LetBuyy never holds funds; the `razorpayx` self-custody rail is dead.
- **Not** a 3rd-party app/extension platform now. The app-marketplace, developer-portal, Wasm checkout-functions runtime, and theme app-blocks for third parties are frozen seams, reopened only at ≈5k merchants + developer demand.
- **Not** a dual-runtime headless storefront. One Liquid-SSR runtime; no Hydrogen/Oxygen.
- **Not** a fee-extracting marketplace. 0% transaction fee, permanent; the 3% GMV rake is dead.

---

## 3. Competing-constitutions resolution

### 3.1 The four realities (what the program found)

The platform ran **four mutually-contradictory definitions of itself, and the only machine-enforced one was the rejected architecture** (PLATFORM_SIMPLIFICATION_PLAN §"Four-Realities", ARCH-005/006, TOPO-024):

- **(a) Deployed reality** — a 13-runtime estate (4 Workers + 9 Vercel apps, including `app-marketplace` + `developer-portal` + two redundant ops consoles), with `main` 30 commits behind the fix branch.
- **(b) Governance reality** — the **181-validator gate** (`scripts/validators/*.mjs`; 187 files on disk, the documented CI figure is 181) + `AGENTS.md` *requires* the 9 apps and certifies provider-failover, partition-recovery, multi-region survivability, and 9 chaos experiments; `production-topology.json` fabricates the empty reserved services as `environment:"production"` behind a Helm chart no pipeline applies. **Zero validators reference V1.**
- **(c) Documented reality** — V1 §6 + the Freeze diagram specify the **8-runtime** target with six reserved services manifest-only.
- **(d) Strategic reality** — the anchor spine (A0–A9) ratifies exactly (c).

### 3.2 The resolution — V1+Freeze win; AGENTS.md and the validator gate are retargeted; the maximalist plan is rejected

| Competing authority | Status | Action |
|---|---|---|
| **`LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`** | **CANONICAL — ratified as the sole constitution.** | None — it is the destination. Re-rank `CLAUDE.md` to put V1 first. |
| **`AGENTS.md`** (9-app canon; stale — "19 migrations" vs 91) | **TRANSITIONAL → REGENERATE.** It must become the **generated map of V1 §6**, not a competing authority. | Regenerate from V1 §6 (Wave 2; LEG-076, TOPO-003/021). |
| **The 181-validator gate** | **TRANSITIONAL → RETARGET.** It must enforce **V1 conformance**, not the rejected end-state. | Delete the ~36 rejected-architecture validators (replay/projection/saga/CRDT/failover/WAL/lease/multi-region); KEEP the real-invariant validators (tenant-isolation, session-security, single-writer, antifabrication, crypto/currency single-source); ADD the gaps (migration-rollback pairing ≥138, deploy↔V1 contract, `letbuyy.store` ban, `commission_bps=0`, topology anti-fabrication). The retarget must land **before** the dead-package deletions, or deleting them fails CI (the validator-liveness loop). (Wave 1–2; LEG-063, TOPO-024.) |
| **`LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md`** (1M-merchant / 22-service / Wasm maximalist) | **DEAD → ARCHIVE.** Formally **rejected** as active topology. | `git mv` → `docs/archive/` (Wave 2; LEG-075). |

### 3.3 The governance-theater finding (the reason this resolution is constitutional, not cosmetic)

This is the program's central finding and the reason the ADR is necessary: **the green governance gate certifies the rejected architecture while nine S0 vulnerabilities ship live.** `node scripts/validate-governance.mjs` passes 181 validators — including multi-region survivability and chaos certifications for a distributed system **that does not exist** — and references V1 **zero times**, while an unauthenticated `/api/auth/switch` account takeover (ISSUE-001), six anon RLS-to-PUBLIC table leaks (ISSUE-004…008), and an anon-writable super-admin allowlist (ISSUE-003) sit live. **That is governance theater, not governance.** Until the suite is retargeted to V1, "the build is green" is an active falsehood that hides the platform's real state. Retargeting the gate is therefore not cleanup — it is the act that makes the constitution's words enforceable for the first time.

### 3.4 Why V1 wins (the rationale, not merely the ruling)

V1 wins because it is the only one of the four realities that is *correct for the envelope*: the platform has zero merchants, zero legacy burden, and an India-only 100→10k roadmap. The maximalist plan and the AGENTS 9-app canon optimize for a 1M-merchant, thousands-of-developers, multi-region world that does not exist and will not exist for years; building toward it now is the exact error the decision rule was written to prevent — it enlarges the attack surface (third-party code in a live commerce monolith), starves the P0 work (hosted checkout, ledger wiring, RLS), and contradicts the no-custody / 0%-fee constitution the platform claims to follow. V1's "correctness over elegance / rent rails / no premature scale infra / Liquid-first / themes are the differentiator" principles are precisely Shopify's *load-bearing* patterns minus Shopify's *scale machinery* — which is the right thing to copy (SHOPIFY_ALIGNMENT_REPORT §1).

---

## 4. The ADR set (ADR-001 … ADR-024)

> Every ADR carries: **Context · Decision · Status (ACCEPTED) · Consequences · Alternatives rejected · Reversibility.** Anchors (A0–A9), sibling-doc decision IDs, and forensic ISSUE-IDs are cited inline. Status is **ACCEPTED** for all; reversibility states the named trigger or rollback mechanism. ADRs are grouped: governance (001–002), platform/topology (003–004), identity (005–007), tenancy (008–009), money (010–013), checkout/commerce (014–016), theme/storefront (017–019), design system (020), and the four constitutional envelope rulings (021–024).

---

### ADR-001 — One constitution: V1+Freeze is canonical; AGENTS.md is regenerated from it

- **Context.** The repository carries two constitutions. `AGENTS.md` is top-ranked in `CLAUDE.md` and encodes a 9-app / CQRS / multi-region end-state; V1+Freeze encode the 8-runtime India monolith. The 181-validator CI gate enforces AGENTS, not V1, and references V1 zero times (ARCH-005/006, TOPO-003/021/024). Two constitutions means every agent and engineer can cite a different "canonical."
- **Decision.** **V1+Freeze is the sole constitution.** `AGENTS.md` is demoted to a **generated artifact** — the map of V1 §6 — and regenerated from V1; `CLAUDE.md` is re-ranked to put V1 first. The maximalist CHECKOUT_PLATFORM doc is archived (ADR-021).
- **Status.** **ACCEPTED** (A0; LEG-075/076; RDY W-01).
- **Consequences.** A single source of architectural truth; agents and CI stop contradicting each other; the ~60+ superseded root governance/mission/ledger docs collapse to one constitution + one current STATUS (LEG-075, TOPO-020/037). Regeneration is Wave 2; until then, humans follow V1 first by directive.
- **Alternatives rejected.** *Keep both and reconcile case-by-case* — rejected: it is the status quo that produced the four realities. *Make AGENTS canonical* — rejected: it encodes the rejected architecture. *Hand-maintain AGENTS in parallel with V1* — rejected: drift is guaranteed; generation is the only durable fix.
- **Reversibility.** High and cheap — regenerating a document is reversible by re-running the generator against a future ratified constitution. The constitutional *choice* (V1 over the maximalist plan) reverses only at the named trigger that would justify the maximalist envelope: ≈5k+ merchants **and** a real third-party developer population (ADR-022/023's trigger).

---

### ADR-002 — One validator suite that enforces V1 (end the governance theater)

- **Context.** `node scripts/validate-governance.mjs` passes 181 validators (187 `*.mjs` on disk) and certifies provider-failover, partition-recovery, multi-region survivability, and 9 chaos experiments — for a distributed system that does not exist — while 9 S0s ship live. The gate is green; the platform is not. This is the program's central finding (FORENSIC_MASTER question 2).
- **Decision.** **Retarget the suite to enforce V1.** (1) **DELETE** the ~36 rejected-architecture validators (replay/projection/saga/CRDT/failover/WAL/lease/multi-region) — but only **after / just-before** deleting the dead packages they assert, to avoid the validator-liveness deadlock (deleting the packages first fails CI). (2) **KEEP** the real-invariant validators (tenant-isolation, session-security, single-writer, antifabrication, crypto/currency single-source). (3) **ADD** the missing V1 gates: migration-rollback pairing (≥138), deploy-manifest↔V1-topology contract, `letbuyy.store` literal ban, `commission_bps=0` ratchet, topology-JSON anti-fabrication.
- **Status.** **ACCEPTED** (A0; LEG-063; TOPO-024; RDY W-01).
- **Consequences.** "Green" starts meaning "conforms to V1." CI begins blocking the real regressions (cross-tenant leaks, non-zero commission, `.store` literals) instead of certifying fictional resilience. The retarget gates the W-37 dead-package deletions and the topology de-deploys.
- **Alternatives rejected.** *Delete the whole suite* — rejected: it contains genuinely load-bearing invariant gates worth keeping. *Leave it and add V1 validators alongside* — rejected: the fiction validators would still certify the rejected architecture green and still require the dead packages to exist.
- **Reversibility.** Additive-then-subtractive and fully reversible by `git revert`; the V-GOV gate is run **after** each validator edit, never before, so the suite never enters an unbuildable state.

---

### ADR-003 — The deploy meta-blocker is fixed first (the keystone; nothing ships until it is)

- **Context.** `production-deploy.yml` triggers only on `main`; `main` is **30 commits behind** `stepup/main` (confirmed: `git rev-list --count main..stepup/main` = 30), so **every** completed remediation wave — including the uncommitted `/api/auth/switch` S0 fix and its untracked test — is **undeployable**. The live estate runs pre-wave code. Two staging workflows race on `develop` (TOPO-001/002/016; ISSUE-002).
- **Decision.** **Wave 0, before anything else:** commit the S0 fix + its test; execute the merge runbook (`stepup/main`→`develop`→`main`) under per-agent worktrees + a clean-tree gate; collapse the two staging workflows to one; add a branch-lag CI guard so the lag can never silently re-accumulate.
- **Status.** **ACCEPTED** (A0; TOPO-001/002; ISSUE-002; RDY W-00).
- **Consequences.** This is the universal precondition — every other ADR's implementation is theory until the pipeline can deploy the integration branch. It is also the cheapest high-leverage action in the program (S-effort, ~1–2 eng-weeks) for the highest payoff (it ships the entire backlog of fixes).
- **Alternatives rejected.** *Hotfix S0s directly to `main`* — rejected: it forks history and leaves 30 commits of real fixes stranded. *Rewrite the pipeline first* — rejected: the merge is the blocker, not the pipeline shape.
- **Reversibility.** Standard deploy rollback (Cloudflare/Vercel previous deployment). The merge is reversible by revert; the branch-lag guard is a CI check that can be relaxed.

---

### ADR-004 — One topology: the modular monolith + four satellites (reject the service fleet)

- **Context.** V1 §6 specifies `api-gateway` (modular monolith) + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` over one Postgres on Cloudflare + Vercel, with six reserved services manifest-only. The deployed estate over-deploys (`app-marketplace`, `developer-portal`, two ops consoles); governance fabricates the reserved services as `production`. The monolith is genuinely built (~83k LOC) and ~80% topology-compliant (ARCH §3.1 APPROVED; RDY W-02).
- **Decision.** **Ratify the 8-runtime topology.** Capabilities (auth, products, cart/checkout, orders, payments, inventory, discounts, GST, shipping, settlement, customers, themes, WhatsApp, notifications, billing, analytics-read) live **in the monolith**; async work (outbox relay, WhatsApp/email send, settlement/recon, abandoned-cart, rollups, the stale-reservation sweeper) lives in `queue-workers`; `mobile-bff` becomes a **real composite/fan-in BFF** (today a 305-line pass-through); `webhook-service` owns outbound webhooks (HMAC + dedupe). De-deploy `app-marketplace` + `developer-portal` (ADR-022); fold the two ops consoles into one (ADR-024). Regenerate `production-topology.json` from the real deploy matrix; archive the k8s/Helm fantasy and the `legacy/firebase` backend.
- **Status.** **ACCEPTED** (A0/A9; TOPO; PLT; RDY W-02; SHOP §3/§6).
- **Consequences.** One coherent estate; the reserved services are honestly `reserved`; the BFF kills the live mobile dashboard N+1 (PERF-001/002). No domain is extracted to a microservice until a named scale trigger.
- **Alternatives rejected.** *Extract payments/checkout/identity into services* (the maximalist plan) — rejected: the envelope does not need it; it multiplies the attack surface and operational burden for zero merchant-visible benefit. *Activate the reserved services* — rejected: it invents topology no beta merchant would notice (R-2).
- **Reversibility.** Modular boundaries inside the monolith preserve the *option* to extract a module later; the reserved-service seams remain. Extraction reverses the decision only at a measured scale trigger (V1 defers this explicitly).

---

### ADR-005 — `identity-platform` is the sole asymmetric token issuer (collapse four auth implementations into one)

- **Context.** Identity is smeared across **four parallel implementations** — `identity-platform` lib + gateway `routes/auth.ts` (1,441 LOC) + the gateway "identity-foundation" shadow stack (18 files, 1,655 LOC) + legacy Supabase `/auth/*` — all under a **single shared `AUTH_SECRET` HS256**, so the verification key is the forgery key across seven trust domains; the OIDC provider is a 501 skeleton serving a literal `MOCK_JWKS` (AUTH-001…025; IDN-001…029; ISSUE-027). The individual flows are competently built (bcrypt-12, CSPRNG OTP, rotating reuse-detecting sessions, real app-OAuth2-S256-PKCE).
- **Decision.** **`identity-platform` is the SOLE issuer** of all identity for all three realms (merchant/staff, buyer/customer, platform-operator) — OTP, login, sessions, cookies, refresh rotation, the DPDP consent ledger (ADR-007), MFA, passkeys, and the OIDC provider. The token kernel moves **off shared-`AUTH_SECRET` HS256 to asymmetric sole-signing** (EdDSA/Ed25519; ES256 fallback) via a real KMS; **every other service is verify-only** with the published public key, per-audience claims (the dual-verify D0–D4 cutover, IDN D-03/§5). The four implementations collapse into one: gateway `routes/auth.ts` → verify-only (LEGACY); identity-foundation shadow stack → SAFE_DELETE; legacy Supabase `/auth/*` + the second reset pipeline → LEGACY; the six identity micro-packages → fold into `auth-core`. A default-deny `middleware.ts` is added.
- **Status.** **ACCEPTED** (A1; IDN-005/006; D-01…D-06; AUTH-002/011; ISSUE-027; RDY W-04/W-05; SHOP §5).
- **Consequences.** A leaked verification key becomes harmless (it cannot sign); the claims→GUC bridge becomes *trustworthy*, which is the precondition for real tenancy (ADR-008); the real OIDC provider is unblocked. Buyer realm is passwordless-native (a leapfrog: no password/Multipass legacy to migrate, SHOP §5).
- **Alternatives rejected.** *Keep HS256 but split per-domain secrets only* — rejected: it reduces blast radius but keeps the verification-key=forgery-key property; asymmetric is the actual fix. *Crown the gateway auth path (most load-bearing)* — rejected by the decision rule: the consolidated `identity-platform` design is the winner even though it carries less traffic today.
- **Reversibility.** The token cutover is **dual-verify**: D0–D2 revert is a config change with no token invalidation; D3 rollback is to re-widen the verifier to accept HS256 (revert the pin), never to revert the issuer — verifier-pin and issuer-alg deploy as independently-revertible changes, with a rollback drill mandatory before D3. Key compromise → rotate `kid` (strictly better than the symmetric world).

---

### ADR-006 — The `/api/auth/switch` takeover and the anon super-admin allowlist die in Wave 0 (S0)

- **Context.** `/api/auth/switch` is an **unauthenticated account-takeover** live on every deployable branch; its fix exists only as an **uncommitted working-tree edit** with an **untracked test** (ISSUE-001; AUTH-001; D-01). The `super_admin_allowlist` RLS policy is **anon-writable** (self-grant platform super-admin) (ISSUE-003; AUTH-003/FND-005; D-02).
- **Decision.** **Commit + deploy the switch fix immediately** (it gates on ADR-003's merge). **Re-scope the allowlist policy** to `TO service_role` + an audited migration-write path + an INSERT audit trigger. Both land in Wave 0.
- **Status.** **ACCEPTED** (A1; ISSUE-001/003; AUTH-001/003; D-01/D-02; RDY W-04 (S0 part)/W-11).
- **Consequences.** The two live identity S0s close. No "we match Shopify's identity model" claim is defensible until they ship (SHOP §5).
- **Alternatives rejected.** *Defer to the broader identity collapse (Wave 2–3)* — rejected: these are live, continuously-exploitable, and the catastrophe-to-effort ratio is extreme (S-effort).
- **Reversibility.** The switch fix is a guard addition (revertible); the allowlist re-scope is a paired migration with a DOWN that restores the prior policy. The live-grant state for the allowlist is **UNVERIFIED** (see §6) and must be confirmed by an anon-key probe before final S0 sign-off.

---

### ADR-007 — A DPDP consent ledger is canonical; OIDC and passkeys are canonical-but-deferred

- **Context.** **Nobody owns consent** — the OIDC consent route 501s; there is no consent ledger and no DSR (export/erasure) path; the WhatsApp `wa_optins` ledger is the same primitive done once (IDN-021; D-10; V1 §3). DPDP (India) is a legal requirement. OIDC is a 501 skeleton; passkeys are a flag with zero consumers (IDN-024/027; D-12/D-13; AUTH-020).
- **Decision.** **Build the append-only DPDP consent ledger + DSR export/erasure in `identity-platform`, fail-closed** (a missing consent record hard-stops the matching send, never opens it); gate WhatsApp/marketing/analytics on it (ADR-016). **OIDC provider and WebAuthn passkeys are CANONICAL but DEFERRED** — built only when SSO/headless/partner demand exists; until then OIDC serves **404, never a placeholder JWKS** (`MOCK_JWKS` is removed in the token-cutover D0).
- **Status.** **ACCEPTED** (A1; IDN-021/024/027; D-10/D-12/D-13; AUTH-020; RDY W-06/W-07).
- **Consequences.** The WhatsApp wedge becomes legally shippable; the platform stops advertising an IdP it cannot back. OIDC/passkeys land at Waves 7–8 (demand-gated at ≈5k merchants).
- **Alternatives rejected.** *Ship OIDC now* — rejected: ~8–10 eng-weeks for a capability no current consumer needs; correctly deferred. *Skip the consent ledger for beta* — rejected: DPDP exposure + the WhatsApp wedge both require it.
- **Reversibility.** The consent ledger is append-only (corrections are new records, never mutations); the deferral of OIDC/passkeys reverses on the named demand trigger. A rollback that disables the consent gate must **hard-stop sends, never open them** (fail-closed by design).

---

### ADR-008 — Tenancy is layered fail-closed: RLS+FORCE + per-transaction GUC is the load-bearing backstop (gateway off blanket `service_role`)

- **Context.** Production runs **single-layer** — the app-layer query-lint guard is the de-facto sole control; the gateway connects as blanket Supabase `service_role`, which **bypasses RLS** (migration 107's own header admits it); the tenant GUC is **never set** on any live path, so `FORCE`-RLS + `current_site_id()` policies are **decorative**; only ~41/261 tenant tables carry FORCE+GUC (FND-001…027; DB-004; TEN; RDY W-08). The DDL is excellent and **proven fail-closed under a non-bypass role in tests** — it is simply not the live path.
- **Decision.** **Three-layer fail-closed.** L1 = the app-layer query-lint guard (catches "forgot to scope"); L2 = ownership resolution (proves the `site_id` *value*); **L3 = Postgres RLS `ENABLE`+`FORCE` + a per-transaction tenant GUC** set via `SET LOCAL app.site_id` from validated JWT claims on **every** tenant table (unset/wrong GUC ⇒ zero rows). The decisive change: the gateway **stops connecting as blanket `service_role`** — tenant data runs over a Hyperdrive-pooled transactional connection under a non-`BYPASSRLS` `app_tenant` role (`withTenantTx(siteId, fn)`); `service_role` is demoted to a narrow, audited, break-glass hatch (`withServiceRole(reason, fn)`). L1 and L2 stay **permanently** as defense-in-depth. The GUC value comes from a **validated asymmetric claim** (couples to ADR-005).
- **Status.** **ACCEPTED** (A2; FND-008/016; DB-004; TEN §3/§4; RDY W-08/W-09; ISSUE-009).
- **Consequences.** RLS becomes load-bearing for the first time; the constitution's tenancy words become true. This is the **structural long-pole** of the program (~12–16 eng-weeks, the single largest line) and a go-live gate that also gates the claims→GUC half of identity and the load-bearing half of every per-table policy.
- **Alternatives rejected.** *Keep the app-guard as the sole control* — rejected: a single application-layer miss leaks cross-tenant data with no DB backstop. *Per-tenant databases/schemas* — rejected: operationally heavy and unnecessary at the envelope; RLS+GUC over one Postgres is the V1 design.
- **Reversibility.** The `service_role`→GUC cutover is staged (S-1 → S0 shadow → S1 reads → S2 writes → S3 narrow-hatch) with a per-route fallback during the window; FORCE is added table-by-table behind the connection, so a misconfigured table fails **closed** (surfaces immediately, never leaks). DOWN migrations restore dropped objects.

---

### ADR-009 — The six anon RLS-to-PUBLIC table leaks die in Wave 0 (S0)

- **Context.** Six baseline policies are `USING(true)` to **PUBLIC**, granting **anon** read/write of orders, customers (PII), billing, products, sites, and subscriptions, plus anon `PATCH sites.user_id` (store takeover); no `REVOKE` exists anywhere in the corpus (ISSUE-004…008; FND-001…006; TEN-001; DB §6). Migration 107's header is first-party evidence the anon grants are live.
- **Decision.** **Wave 0, before merchant #1:** migration `162` drops and recreates each policy as `TO service_role` + correct owner/public-active policies; `REVOKE INSERT/UPDATE/DELETE FROM anon, authenticated`; a CI policy-lint forbids `USING(true)` without a `TO`-clause + predicate. Re-scoping to `TO service_role` cannot break gateway paths (it connects as `service_role` today, and moves to `app_tenant` under ADR-008).
- **Status.** **ACCEPTED** (A2; ISSUE-004…008; FND-001…006; TEN-001; RDY W-11).
- **Consequences.** The continuously-exploitable cross-tenant data + PII leak closes. This is the highest catastrophe-to-effort item in the program (S-effort; ~1–2 eng-weeks).
- **Alternatives rejected.** *Rely on the app-guard to mask the leak* — rejected: the leak is at the DB GRANT layer, beneath the app; only a DB-layer fix closes it. *Fold into the Wave-2 FORCE+GUC backfill* — rejected: the leak is live now and cannot wait for the breadth migration.
- **Reversibility.** Migration `162` ships with a paired rollback (DOWN restores the prior policies). **Live-grant state is UNVERIFIED** (the grants are set by Supabase's managed bootstrap, not repo SQL) — a one-shot anon-key probe (`\dp public.orders`) confirms closure before final S0 sign-off.

---

### ADR-010 — The canonical append-only double-entry ledger is the single money source of truth

- **Context.** A genuinely Stripe-grade double-entry kernel exists (migrations 139/151/160: 8 named accounts, `Σdebit=Σcredit` trigger, append-only trigger, `writer_module='settlement'` CHECK, idempotent balance-checked `post_ledger_transaction`, `FOR UPDATE`-gated `claim_payout_statement_release`, `recon_breaks` with no auto-plug) — but it is **un-fed**: the legacy `confirm_order_payment_with_ledger` captures money and posts **zero** ledger entries despite its name; refunds and COD are likewise un-ledgered; money lives in **four representations**; **four compat "ledger" tables** + mutable balances persist beside it (PAY-001…032; DB-002…034; MNY; ISSUE-010/011/018/019).
- **Decision.** **The canonical double-entry ledger is the single money source of truth.** Balance is **always derived** (`ledger_account_balance_minor`), never a mutable column. **Every** capture/refund/COD/tender posts through it, idempotently (capture → debit `pa_clearing` / credit `merchant_payable`; refund → debit `merchant_payable` / credit `refund_clearing`; COD → `cod_receivable` at confirm, relieved at remittance with signed breaks). Representation is **`bigint` minor units (paise) everywhere** (the int32-paise + numeric-rupee + numeric(16,4) columns are LEGACY → cutover, ADR-013). One writer (settlement). Append-only enforced by **trigger AND `REVOKE UPDATE/DELETE`** + RESTRICT FKs (today trigger-only). The legacy un-ledgered RPCs become **adapters** that post to canonical, then LEGACY; the four compat ledgers and mutable balances become read-only projections / ledger tenders.
- **Status.** **ACCEPTED** (A3; MNY §2/§3; PAY-001/002/003/009/027; DB-002/003/010; ISSUE-010/011/018/019; RDY W-12/W-13).
- **Consequences.** The book becomes complete and reconcilable; payouts stop gating to zero on un-ledgered volume; the platform can prove its money position. Ledgering the capture is the **#1 money-wiring blocker** (without it the ledger is blind to ~100% of live volume).
- **Alternatives rejected.** *Crown the busy legacy capture path* — rejected by the decision rule: only the ledger models COD cash-in-transit, reserves, reversing entries, and a balanced settlement. *Mutable-balance-as-truth* — rejected: it is the root-cause class of the money P0s; balance must be derived.
- **Reversibility.** Ledger postings are **additive and append-only** — a wrong adapter is corrected by a reversing entry, never a mutation; expand/contract migrations for the representation cutover are reversible (DOWN restores the old column). **No money system is deleted until the reconciliation harness proves zero drift on the path it replaces.**

---

### ADR-011 — Money moves only via PA-split; LetBuyy never custodies (kill the `razorpayx` self-custody rail)

- **Context.** Money-out is hardcoded to the **self-custody `razorpayx` rail** (a from-own-account disbursement product — an R-6 / V1 constitutional breach) while metadata falsely stamps `no_custody:true`; the split-instruction client is unimplemented (DDL-only) (PAY-013/014; MNY §3; ARCH-002; ISSUE-014; RDY W-14). Status-mirroring + provider-gated fail-closed release + the double-release fix are real and correct.
- **Decision.** **PA-split mirror, never custody.** Money-in flows to the **merchant's own Razorpay** (merchant = merchant-of-record). Money-out is a thin **split-instruction + statement-mirror + reconciliation** through a licensed PA (Razorpay Route / Cashfree); the rail returns `razorpay_route`/`cashfree`, asserts a split product, and derives `no_custody` from the rail. The `razorpayx` self-custody branch is **DEAD**. Settlement is the single writer; it ingests the PA/COD statement, posts canonical, and reconciles to **zero-break-or-explained-suspense** with a real money-out reconcile-on-uncertainty (no payout strands). The second factor on refund/payout is **real cryptography** (HMAC/stored-challenge), replacing the forgeable string-length check (PAY-018; ISSUE-012).
- **Status.** **ACCEPTED** (A3; MNY §2/§3; PAY-013/014/018; ISSUE-012/014; RDY W-14/W-15/W-17).
- **Consequences.** LetBuyy stays out of money custody (regulatory-critical); the metadata stops lying; payouts become trustworthy. Latent today because live PA/Route keys are `[HUMAN-REQUIRED]`-gated — but a hard go-live blocker.
- **Alternatives rejected.** *Keep `razorpayx` self-custody* — rejected: it makes LetBuyy a money custodian, breaching V1's never-custody rule and inviting RBI/PA-licensing exposure. *Forgeable step-up* — rejected: a string-length check is not a second factor.
- **Reversibility.** The rail switch is feature-gated until live keys are present; expand/contract migrations are reversible; the reconciliation is additive. A rollback cannot re-enable self-custody (the branch is deleted, not flagged).

---

### ADR-012 — 0% transaction fee, permanent; subscription billing is the monetization spine (kill the 3% GMV rake)

- **Context.** A live **3% GMV rake** (`commission_bps DEFAULT 300`) + 18% GST-on-fee contradicts V1's permanent 0%-fee promise (ARCH-001; LEG-042; ISSUE-015; RDY W-17). The subscription/AutoPay-mock/dunning/plan-gating spine (migration 152) is built and correct — the right Shopify-analog monetization.
- **Decision.** **Set `commission_bps = 0`, permanent.** The 3% rake default + the GST-on-fee are **DEAD**. **Subscription billing is the monetization spine** (plans + adjacencies — WhatsApp/AI credits, shipping spread); LetBuyy never monetizes the sale. A `commission_bps=0` ratchet validator (ADR-002) prevents regression.
- **Status.** **ACCEPTED** (A3; SHOP-004; ARCH-001; LEG-042; ISSUE-015; RDY W-17).
- **Consequences.** The platform honors its stated 0%-fee differentiator (the wedge against Razorpay/Shiprocket-adjacent fee models for India merchants); revenue comes from subscriptions, not GMV.
- **Alternatives rejected.** *Keep a small GMV rake for revenue* — rejected: it contradicts the constitution and the competitive wedge; the 0% fee is the positioning. *Make the fee configurable per-merchant* — rejected: the default is the live behavior, and the default is the promise.
- **Reversibility.** A single default change (reversible), but the **0% position is a strategic commitment**, not a tunable — reversing it is a business decision outside this ADR's scope and would require re-ratification.

---

### ADR-013 — One money representation: `bigint` paise everywhere (cut over the four representations)

- **Context.** Money lives in four representations — `bigint`-paise (canonical), int32-paise (overflow at ₹2.14cr), numeric-rupee, and numeric(16,4) usage meters (DB-002/003; LEG-043; ISSUE-025; RDY W-16). The int32 columns are a latent overflow; the numeric columns invite rounding drift.
- **Decision.** **`bigint` minor units (paise) on every money path.** The int32/numeric money columns are LEGACY → an expand/contract cutover with a **zero-loss historical backfill**; order/usage amounts gain `*_minor bigint`; amounts are derived from minor units. This is **Wave 5** (pre-scale, not a beta blocker), after the Wave-1 correctness wiring.
- **Status.** **ACCEPTED** (A3; DB-002/003; LEG-043; ISSUE-025; RDY W-16/W-18).
- **Consequences.** No overflow, no representation drift; one arithmetic for all money. Correctly deferred to Wave 5 — the Wave-1 ledger wiring (ADR-010) does not require the full cutover first.
- **Alternatives rejected.** *Keep mixed representations* — rejected: int32 overflows within the envelope's GMV; numeric rounds. *Float* — rejected: never for money.
- **Reversibility.** Expand/contract is reversible (DOWN restores the old column); the backfill is verified zero-loss before the old columns are dropped.

---

### ADR-014 — Checkout is server-authoritative end-to-end: a hosted origin + cart-bound signed handoff

- **Context.** The money-core is materially stronger than the governance suggests — cart **is** server-authoritative; orders are created **only** via the `create_checkout_order` RPC (server-priced, oversell-safe under `FOR UPDATE`, idempotent at three layers); branding is data-only (no SSTI) (CHK §1; CHECKOUT_FORENSIC_AUDIT). **But** the hosted **`checkout.letbuyy.com` origin does not exist** (signed URLs are dead links; the live path is a public `POST /:subdomain/orders`); the signed URL **does not bind cart contents**; the public order-create **decrements stock before payment** (CHK-001/012/015; ISSUE side-doors; RDY W-19/W-20).
- **Decision.** **Build and deploy the hosted `checkout.letbuyy.com` origin** (contact → delivery → payment → confirm) consuming a **cart-bound signed handoff** (hash of sorted line items + coupons + subtotal in the HMAC). **Gate the public order-create behind the signed handoff**; use **reserve-with-TTL, not hard-decrement**, for COD/pre-payment. The checkout-session state machine (`planCheckoutStateTransition`) stays canonical in the monolith. The client React cart is demoted to a thin view; the server cart is the authority.
- **Status.** **ACCEPTED** (A4; SHOP-003; CHK-001/012/015; RDY W-19/W-20).
- **Consequences.** Checkout becomes server-authoritative *in production*, not just in principle; the signed-URL → dead-link gap closes; denial-of-inventory closes. This is V1 P0 and the audit's named "point of the exercise."
- **Alternatives rejected.** *Keep the public `POST /:subdomain/orders` path as the checkout* — rejected: it bypasses the signed handoff entirely. *Sign the URL without binding the cart* — rejected: the cart can be mutated post-signature within the window.
- **Reversibility.** The hosted origin is greenfield (deploy/undeploy, no migration to roll); the cart-bind is additive (the old unsigned path stays during the window, then is gated off).

---

### ADR-015 — One commerce path: server cart + reserve→commit inventory + typed discount engine + GST + Shiprocket-real shipping

- **Context.** Around the strong order core sit side doors and gaps: a **stale-reservation sweeper exists as DDL but is never scheduled**; **direct-`available`-decrement side doors** + order-edit add-item-without-reservation bypass the one inventory path; the **typed 3-class `combines_with` discount engine is dormant** (the scalar single-code RPC is live); **shipping has no real carrier**; **GST place-of-supply is partial** (CHK-002…005; V1 §3/§16; RDY W-21). Shipping/GST/Customers are V1 monolith modules to build to P1.
- **Decision.** **One reserve→commit inventory lifecycle** (`version` optimistic concurrency) with the **stale-reservation sweeper wired** in `queue-workers`; the direct-decrement side doors unify onto it. **Activate the typed 3-class discount engine**; demote the scalar RPC. Build **GST place-of-supply** (CGST/SGST vs IGST + HSN rates + inclusive/exclusive) + **immutable GST invoice** (IRN/QR via mock IRP) + marketplace TCS. Build **zones/profiles/rates + pincode + COD serviceability** with **one real carrier (Shiprocket)** for AWB/label/tracking, others mocked behind the adapter. Build **tenant-isolated customers** (behind RLS+GUC, ADR-008) + light CRM (LTV/RFM + dynamic segments).
- **Status.** **ACCEPTED** (A4; CHK-002/003/004/005; V1 §3/§16; RDY W-21; SHOP §4).
- **Consequences.** One inventory path with a live sweeper; one discount engine; India-correct GST + serviceability; real shipping. The `store_customers` PII leak (ADR-009) closes first.
- **Alternatives rejected.** *Keep multiple inventory side doors* — rejected: they reopen oversell. *Defer GST/shipping past beta* — rejected: GST is legally required for invoicing and Shiprocket is the P0 carrier (V1 §16).
- **Reversibility.** GST/Shipping land behind feature flags with the mock adapter as the fallback; the sweeper is a job that can be paused; the discount-engine activation is reversible to the scalar RPC during the window.

---

### ADR-016 — No checkout extensibility in the live path; the Wasm functions runtime is removed to a seam

- **Context.** A **Wasm-ish checkout-extensions/app-functions runtime executes inside the live payment route** (`evaluateCheckoutAppFunctions` before `createOrder`, gated `FEATURE_EXTENSIONS`) — the *shape* of Shopify checkout extensions, which V1 §4 R-11 **rejects** for this envelope (CHK §12; ISSUE side-doors; SHOP §4/§6). Blast radius is tightly bounded today, but it is third-party code in a live commerce monolith.
- **Decision.** **Remove the live Wasm checkout-functions runtime and the `CheckoutExtensionHost`** from the order/storefront path; **downgrade to a documented seam** (`checkout-core` stays a library; the interface remains for a future Functions-equivalent). Re-open extensibility only at Shopify-like demand (≈5k merchants + inbound developers; ADR-023). Notifications are a **WhatsApp-first router** (→ SMS → email → push) in the monolith with multi-ESP failover + preferences/suppression/**consent (fail-closed, ADR-007)**; scoped WhatsApp commerce is **order-lifecycle utility messages + COD-confirm only** — the full in-WhatsApp stack (catalog→cart→in-thread checkout, broadcasts, inbox) is FROZEN (R-7).
- **Status.** **ACCEPTED** (A4/A9; SHOP §4/§6; V1 §11; R-7/R-11; CHK §12).
- **Consequences.** The live-checkout attack surface drops to zero third-party code; the constitution's R-11 is honored. WhatsApp ships as a scoped wedge (two S-sized features), not a premature platform.
- **Alternatives rejected.** *Keep the Wasm runtime "because it's sandboxed"* — rejected: it is cargo-culting Shopify's end-state; the envelope has neither the merchants nor the apps to justify it. *Build full in-WhatsApp commerce now* — rejected: years premature (R-7).
- **Reversibility.** The seam is preserved, so a future Functions-equivalent can plug in at the demand trigger; removing the executor is a code change (revertible). The WhatsApp consent gate is fail-closed (a rollback hard-stops sends, never opens them).

---

### ADR-017 — Theme is Liquid-first (the ecosystem winner over the more-complete React renderer)

- **Context.** This is the directive's explicit test of the decision rule. The **live** renderer is React-component-per-section (~24 sections, ~62% OS-2.0 parity — the only renderer that runs); the **Liquid / portable-theme renderer is shipped but feature-flagged OFF** (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) (THEME-001/002; DEC-1; SHOP §2). There are three schema sources and two draft systems written in the same call.
- **Decision.** **Liquid / portable-theme (Online-Store-2.0-shaped) is the canonical renderer** — the only architecture that supports a theme marketplace, third-party authors, portable themes, and app-blocks (the Shopify ecosystem model and LetBuyy's stated differentiator). **React is kept as a first-party compatibility fast-path** through Wave 5 and **deleted-or-frozen by data at Wave 6** — explicitly **not deleted now for completeness** (the directive's test cuts both ways). Sequencing: **Wave 1** freeze the duplication (one seam; CI-ban new React sections + new Liquid capability; rename the mislabeled "AI hooks" → "Smart defaults"); **Wave 2** unify foundations (3 schema sources → 1 generated; 2 drafts → 1 instance/patch spine; 2 compose paths → 1 engine); **Wave 4** flip Liquid default **per-theme + canary** behind a `renderer.engine` switch (entry-gate: DOMPurify sanitizer + ~20 Liquid section ports + Security suite green + a screenshot/DOM-diff parity harness) + add dynamic sources + theme-blocks; **Wave 5** seed 5–10 first-party themes. `theme-engine` is **CANONICAL for contracts/schema/validation/bundle**, with its orphaned renderer classes un-orphaned to become the live Liquid renderer.
- **Status.** **ACCEPTED** (A5; DEC-1/3/9; THEME-001/002/003/005; SHOP-014/015; RDY W-22/W-23).
- **Consequences.** The platform gains the ecosystem-capable renderer with a clean leapfrog (no `checkout.liquid`/sections-v1 legacy corpus to migrate — the transition Shopify spent 2023–2026 on). The flip is deferred behind S0/money/tenancy.
- **Alternatives rejected.** *Crown React because it is more complete* — **rejected: this is the exact trap the decision rule names** — React-per-section is a first-party-only dead-end for an ecosystem. *Delete React now* — rejected: it is the live read path; freezing, not deleting, is correct.
- **Reversibility.** The **per-theme `renderer.engine` switch IS the rollback** — flip any theme back to React instantly; the canary contains blast radius to one internal store first. The React→Liquid delete-or-freeze fork at Wave 6 is **decided by perf data**, not assumed.

---

### ADR-018 — One storefront runtime hosting Liquid (no headless Hydrogen/Oxygen split)

- **Context.** The live storefront is server-rendered RSC reading themes via the React registry; the **3-tier KV-versioned cache is the audited strong point**; there is **no headless tier** (correct); `runtime-composition` (a rejected/dormant package) is **wired into the storefront page** (TOPO-005; A6; SHOP §3; LEG-008).
- **Decision.** **One runtime** = `storefront-runtime` (Next.js/Vercel) SSR/ISR + Worker Cache, hosting the Liquid renderer at target state (ADR-017). **Intentional divergence from Shopify:** no Hydrogen/Oxygen React-storefront split (the envelope has no headless-developer population — building it is the same class of error as activating the reserved services). The 3-tier cache stays canonical. `runtime-composition` is **unwired (it is on the production read path — unwire FIRST) then SAFE_DELETE** (Wave 2).
- **Status.** **ACCEPTED** (A6; SHOP §3; TOPO-005; LEG-008; RDY W-26).
- **Consequences.** One render authority; the strong cache is preserved; the dormant package leaves the production path. Headless is a written-down deferred seam, not built.
- **Alternatives rejected.** *Build Hydrogen/Oxygen now* — rejected: premature scale infra for a population that does not exist. *Leave `runtime-composition` wired* — rejected: it is a rejected artifact on the live read path.
- **Reversibility.** Unwiring `runtime-composition` is a revertible code change; the Liquid hosting rides the per-theme renderer switch (instant revert to React). The headless seam reopens only on a revenue-bearing headless-merchant need.

---

### ADR-019 — Reserved services stay empty; capabilities live in the monolith + workers

- **Context.** The six reserved services (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`) are manifest-only but **falsely declared `environment:"production"`** in `production-topology.json` (with a Helm chart no pipeline applies); the outbox dual-write is non-atomic (REST upsert after commit) (A9; LEG-013…017; ARCH-004; PAY-007).
- **Decision.** **The six reserved services stay FROZEN-empty (manifest-only).** Their fabricated `production` topology entries are SAFE_DELETE (regenerate `production-topology.json` from the real deploy matrix; mark them `reserved`). The capabilities they nominally own live in the monolith (checkout, notifications, analytics-read, media, search) + `queue-workers` (rollups, sends, sweepers). The events backbone is a **transactional outbox + typed catalog (NOT an event bus)**; the outbox dual-write becomes a **same-transaction write** (the reserved `event-bus` stays empty).
- **Status.** **ACCEPTED** (A9; LEG-013…017; ARCH-004; PAY-007; RDY W-32).
- **Consequences.** The estate stops lying about its topology; the outbox becomes atomic (no lost/duplicated events). Activating any reserved service requires a named scale trigger and human approval.
- **Alternatives rejected.** *Activate the reserved services to "match the architecture"* — rejected: it invents topology no beta merchant would notice (R-2). *A real event bus* — rejected: the transactional outbox is the right pattern at the envelope.
- **Reversibility.** The seams remain — a reserved service can be implemented later at its trigger; the topology.json regeneration is reversible. The outbox same-transaction write is a code change (revertible).

---

### ADR-020 — One design-system token source + one app shell + a systemic provider-mode honesty badge

- **Context.** The design system is fractured into **three token sources, eight hand-rolled navigations (2/9 on the canonical shell), four mobile color classes**; the mobile `ThemeData` bypasses the generated token bridge (mobile is a de-facto separate design system); the **provider-mode honesty badge does not exist** as a component; the CI ratchet **baselines** existing drift as "passing" (UIUX-001…033; MOB-001…022; A7/A8; RDY W-30/W-31).
- **Decision.** **One token source** = `@letbuyy/ui` / `packages/typescript/ui/src/tokens.ts` (DTCG) for web; the Dart `ui_kit` consumes a **generated bridge** from it (kill the 3rd bypassed bridge + the 4 competing mobile color classes). **One app shell** (`AppNavigation`) rolled 2/9 → 9/9 (merchant first). A new systemic **`ProviderModeBadge`** (web + Flutter) renders `mock/sandbox/live` truthfully on **every money/fulfillment surface** (a V1-specific trust control — a stub must never read as `success`). The drift ratchet is retargeted to **BLOCK** new drift (today it baselines it); stylelint wired into CI; drift burned down 10%/release. The honesty badge + mobile release signing + the `mobile-bff` composites are go-live-relevant (Waves 2–3); the design-unification bulk is Phase E / Waves 4–6 (explicitly **not** a go-live blocker).
- **Status.** **ACCEPTED** (A7/A8; UIUX-001/002/003/004/009; MOB-004; RDY W-27/W-28/W-29/W-30/W-31).
- **Consequences.** One coherent design language across web + mobile; trust surfaces stop lying about provider mode; new drift is blocked at CI. The TD-5 parity catalog (974 LOC) and the `packages/dart/services` phantom die.
- **Alternatives rejected.** *Let mobile keep its own design system* — rejected: it forks the brand and the tokens three ways. *Defer the honesty badge* — rejected: it is the one go-live-relevant DS item (money-surface truth).
- **Reversibility.** Shell adoption is per-app (revert one app's layout); the token-bridge re-point is reversible (`ThemeData` reverts to `AppColors`); the honesty badge is additive; **no migration may regress accessibility** (the floor).

---

### ADR-021 — The maximalist CHECKOUT_PLATFORM vision is formally rejected and archived

- **Context.** `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` describes a 1M-merchant / 22-service / Wasm-runtime / CQRS-saga-multi-region platform. It is one of the four realities and the vision the platform drifted into (A0; LEG-075; the maximalist plan).
- **Decision.** **Formally REJECTED as active topology.** It is **DEAD → archived** to `docs/archive/`. Its capabilities (service fleet, Wasm functions, 3rd-party marketplace, multi-region/CQRS) are individually rejected by ADR-004/016/022/023 and the governance retarget (ADR-002). Historical reference is permitted only under `docs/archive/`.
- **Status.** **ACCEPTED** (A0; LEG-075).
- **Consequences.** The platform stops carrying a second, contradictory blueprint. The CQRS/saga package cluster it implies (~13.3k LOC) is SAFE_DELETE (ADR-002 gates the validator retarget first).
- **Alternatives rejected.** *Keep it as the "north star"* — rejected: it is not the envelope's north star; V1 is. *Partially adopt it* — rejected: each part is individually rejected for the envelope.
- **Reversibility.** Archived, not destroyed — it remains a reference if a future, validated 1M-merchant envelope ever materializes. Reopening it as active topology requires re-ratification against a then-current reality, not this ADR.

---

### ADR-022 — The app-marketplace and developer-portal are frozen (de-deployed; OAuth2/PKCE seam kept)

- **Context.** `apps/app-marketplace` (19,557 LOC) + `apps/developer-portal` (4,903 LOC) ship as canonical deployable tiers with ~20 marketplace migrations and a partner-payout ledger; V1 §4 R-11 **rejects** a 3rd-party app marketplace for this envelope; the audit calls it "an empty mall with no supply" (A9; LEG-020/021; SHOP-006; RDY W-02). The app **OAuth2-S256-PKCE install flow is genuinely good** and is also the consumer-OAuth pattern identity needs.
- **Decision.** **FROZEN.** **De-deploy** both from active topology; **keep the OAuth2/PKCE seam** (reuse it for consumer-OAuth in ADR-005). Reconsider at **≈5k merchants + real developer demand** (a first-party-only curated catalog may precede a 3rd-party mall).
- **Status.** **ACCEPTED** (A9; LEG-020/021; SHOP-006; R-11; RDY W-02).
- **Consequences.** Engineering effort redirects from an empty mall to the P0 work (hosted checkout, ledger, RLS); the attack surface shrinks. The clean OAuth2/PKCE asset is preserved.
- **Alternatives rejected.** *Keep them live to "have an ecosystem"* — rejected: zero third-party developers, zero merchants; it is premature mimicry (the #1 premature-mimicry finding). *Delete them entirely* — rejected: the OAuth2/PKCE seam is worth keeping.
- **Reversibility.** De-deploy is reversible (re-add the deploy entries); the code remains as a frozen scaffold; the named trigger (≈5k merchants + developer demand) reopens them.

---

### ADR-023 — Never-build (for this envelope): the Shopify-scale machinery is a seam, not a build

- **Context.** Beyond the marketplace, the platform shipped or scaffolded the full Shopify-scale machinery — Wasm checkout-functions, CQRS/event-store/saga/replay/projection packages (~13.3k LOC, zero importers), multi-region/failover/chaos governance, headless Hydrogen, partition-shadow tables, full in-WhatsApp commerce — all of which V1 explicitly rejects for the envelope (R-2/R-4/R-5/R-7/R-11/R-13/R-14; A0/A4/A5/A6/A9).
- **Decision.** **These are NEVER BUILT for the 100→10k India envelope** — they are frozen seams (or deleted where pure dead weight): the Wasm functions runtime → seam (ADR-016); the CQRS/saga package cluster → SAFE_DELETE (ADR-002/021); multi-region/CQRS governance → deleted validators (ADR-002); headless Hydrogen → deferred seam (ADR-018); the partition-shadow seam → kept, mirror disabled; full in-WhatsApp commerce → FROZEN (ADR-016). Reopening any of them requires a **named business trigger** (≈5k merchants + developer/theme-author demand) **and human approval**, never agent or default-driven scope creep.
- **Status.** **ACCEPTED** (A0–A9; R-2/R-4/R-5/R-7/R-11/R-13/R-14; LEG-001…006; SHOP §6).
- **Consequences.** The platform's surface stays bounded to what the envelope needs; ~28.7k LOC of pure dead weight (CQRS cluster + Firebase) leaves the tree; the governance gate stops certifying fictional resilience.
- **Alternatives rejected.** *Build ahead of demand "to be ready"* — rejected: it is the exact error the decision rule prevents; it starves the P0 work and enlarges the attack surface. *Keep the dead packages "just in case"* — rejected: zero importers, no value; the seam (not the package) is what's worth keeping.
- **Reversibility.** Seams remain for everything frozen; deleted dead weight is archived, not destroyed. Each capability reopens only at its named trigger under human approval.

---

### ADR-024 — Legacy is frozen then deleted only after the winner serves + a zero-drift proof; one thin ops console survives

- **Context.** The tree carries "two of nearly everything" — two constitutions, four identity impls, two theme renderers, two ledger paradigms, two tenant keys on `orders`, two user tables, two ops consoles, ~37 product-dead tables, the fiction validators, 92 competing root docs (LEG-001…078; DEL-0…078). Deleting load-bearing things blindly is itself a risk.
- **Decision.** **Adopt the SAFE_DELETION taxonomy as constitutional deletion law.** Nothing is deleted until its validation gate passes: **SAFE_DELETE** (zero-importer) items go first and cheap (V-IMPORT → V-BUILD → V-TEST → V-GOV → V-ROLLBACK); **DELETE_AFTER_MIGRATION** items delete **only once the Strategic Winner is live and serving (V-SMOKE) and the legacy importer count returns to zero** (no money system is deleted until the reconciliation harness proves zero drift on the path it replaces; no renderer is deleted until parity+security+perf are green per-section). Deletion happens on a branch, behind the deploy meta-blocker fix (ADR-003). **One thin internal ops console survives** (refund, maker-checker payout, dispute log, KYC queue); the other is LEGACY (folded in) — **which one survives is an ARB decision, tentatively `platform-console`, marked UNVERIFIED**.
- **Status.** **ACCEPTED** (A0–A9; LEG-001…078; DEL-0…078; A9 ops-sliver).
- **Consequences.** Deletion is safe, reversible, and gated; the "two of everything" collapses to one of everything across Waves 1–6 without a self-inflicted outage. ~28.7k LOC of dead weight + the live S0 paths leave the tree.
- **Alternatives rejected.** *Delete aggressively now* — rejected: some "dead" tables have RPC/ops-script writers not visible in code; the gates exist to prevent a blind drop. *Keep legacy indefinitely* — rejected: two-of-everything is the maintenance tax the program exists to end.
- **Reversibility.** Every deletion is reversible until proven safe — `git revert` restores a building tree; paired DOWN migrations restore dropped DB objects; archived DDL restores tables. The ops-console survivor choice is reversible (the other is folded, not destroyed, until the survivor is confirmed).

---

## 5. THE FINAL EXECUTIVE SECTION (read this first)

> This is the directive's explicit ask, answered crisply and decision-grade. Every action ties to a component and a forensic ISSUE-ID. Effort figures are from the Production Readiness Gap Report (RDY W-xx); the planning total to **beta-ready is ~80 eng-weeks** (~4–6 months wall-clock with 2–3 parallel squads), bounded by the serial critical path *deploy → engage-RLS → ledger-the-capture → close-reconciliation → safe-PA-split-payout → hosted-origin handoff*.

### 5.1 — 30 days: the highest-ROI actions (emergency stabilization — deploy-unblock + the 9 S0s + kill the rake)

**The single rule: nothing that follows matters until the pipeline can deploy and the data stops leaking.** All Wave 0, all S- or XS-effort, catastrophe-to-effort ratio at its maximum.

| # | Action | Component | ISSUE-ID / RDY |
|---|---|---|---|
| 1 | **Fix the deploy meta-blocker** — commit the S0 fix + test; merge `stepup/main`→`develop`→`main` (30 behind); collapse 2 staging workflows → 1; add a branch-lag guard. **(Keystone — do this literally first.)** | deploy pipeline | ISSUE-002; RDY W-00 |
| 2 | **Commit + deploy the `/api/auth/switch` takeover fix** (exists, uncommitted). | `identity-platform` | ISSUE-001; RDY W-04 |
| 3 | **Drop/re-scope the 6 anon RLS-to-PUBLIC policies** (orders/customers/billing/products/sites/subscriptions) — migration `162`, `TO service_role` + `REVOKE` + CI policy-lint. | Postgres RLS | ISSUE-004…008; RDY W-11 |
| 4 | **Re-scope the anon-writable `super_admin_allowlist`** to `service_role` + audit trigger. | RLS / RBAC | ISSUE-003; RDY W-11 |
| 5 | **Take the gateway off blanket `service_role`** for tenant data (engage the GUC) — begin the staged cutover (the S0 that makes RLS real). | tenancy connection | ISSUE-009; RDY W-08 |
| 6 | **Close the buyer-facing S0s** — storefront stored-XSS pair + webhook SSRF. | storefront / webhook-service | ISSUE-016/017/020 |
| 7 | **Kill the 3% GMV rake** — set `commission_bps=0` (honor the 0% promise; one default-number). | billing | ISSUE-015; RDY W-17 |

*Outcome at day 30:* the 9 S0s are closed, the rake is gone, and the entire backlog of completed fixes is finally deployable. *This is the difference between "0% live" and "the fixes are real."*

### 5.2 — 90 days: the highest-ROI actions (foundations — identity issuer + asymmetric tokens, RLS+GUC, ledger-the-capture, PA-split)

**Wave 1 + the start of Wave 2.** Money-correctness for live keys + the tenancy backbone. These are the go-live gates beyond the S0s.

| # | Action | Component | ISSUE-ID / RDY |
|---|---|---|---|
| 1 | **Ledger every capture/refund/COD** (the #1 money-wiring blocker) — post canonical idempotently; credit `pa_clearing`/`merchant_payable`. | canonical ledger | ISSUE-010/011/018/019; RDY W-13 |
| 2 | **Switch money-out to PA-split** (kill `razorpayx` self-custody); assert split product; derive `no_custody` from the rail. | settlement / payouts | ISSUE-014; RDY W-14 |
| 3 | **Close reconciliation** — wire the wallet→canonical reconciler + money-out reconcile-on-uncertainty + signed `recon_breaks`. | reconciliation | RDY W-15 (PAY-013) |
| 4 | **Real cryptographic step-up** (replace the forgeable string check) on refund/payout. | step-up | ISSUE-012; RDY W-17 |
| 5 | **Stand up the RLS+GUC tenancy backbone** — `app_tenant` role + `withTenantTx`; staged reads→writes cutover (the structural long-pole). | tenancy | RDY W-08 (FND-008/016) |
| 6 | **Start the asymmetric token re-key** — per-domain secrets (fail-closed) → EdDSA/ES256 sole-signer dual-verify; `identity-platform` sole issuer; remove the `AUTH_SECRET` fallbacks. | identity tokens | ISSUE-027; RDY W-04/W-05 |
| 7 | **Make the outbox a same-transaction write** + build the scoped compensation executor (captured-but-failed ⇒ auto-refund). | events | RDY W-32/W-33 (ARCH-004/PAY-007) |

*Outcome at day 90:* the money book is complete and reconcilable, money moves without custody, RLS is load-bearing, and identity is one asymmetric issuer. **Live keys become connectable** (PA/Razorpay onboarding is the remaining `[HUMAN-REQUIRED]` gate).

### 5.3 — 180 days: the highest-ROI actions (completion + traffic migration — hosted checkout, FORCE-all-tables, honesty badge, domain cutover, legacy freeze)

**Waves 2–3 + entry to Wave 4.** Product-completeness for beta + the traffic/topology migration.

| # | Action | Component | ISSUE-ID / RDY |
|---|---|---|---|
| 1 | **Build + deploy `checkout.letbuyy.com`** with a cart-bound signed handoff; gate the public order-create; reserve-with-TTL. | hosted checkout | ISSUE side-doors; RDY W-20 |
| 2 | **FORCE+GUC on all 261 tenant tables** (template backfill) + guard the workers + AST-based isolation validator. | tenancy breadth | RDY W-10 (FND-009) |
| 3 | **Build GST place-of-supply + immutable invoice + TCS** and **Shiprocket-real shipping** (AWB/label/tracking + serviceability). | GST / shipping | V1 §16; RDY W-21 |
| 4 | **Wire the stale-reservation sweeper** + activate the typed discount engine + unify inventory side doors. | inventory / discounts | CHK-002…005; RDY W-21 |
| 5 | **Build the WhatsApp-first notifications router** + scoped WhatsApp (order-lifecycle + COD-confirm, **consent fail-closed**). | notifications / WhatsApp | V1 §11; RDY W-07 |
| 6 | **Ship the provider-mode honesty badge** (web + Flutter) on every money/fulfillment surface; fix mobile release signing; build `mobile-bff` composites (kill the dashboard N+1). | design system / mobile | RDY W-31/W-28/W-29 (PERF-001/002) |
| 7 | **Retarget governance to V1 + regenerate AGENTS.md**; de-deploy app-marketplace + developer-portal; fold one ops console; **cut the domain over to `letbuyy.com`**; SAFE_DELETE the CQRS cluster + Firebase + fiction validators; begin **freezing the React renderer** (one seam, CI-ban new sections). | platform / governance / theme | LEG-063/075/076; TOPO-006; RDY W-01/W-02/W-03 |

*Outcome at day 180:* a server-authoritative hosted checkout, India-correct commerce (GST + shipping + serviceability), RLS load-bearing across the whole schema, one honest constitution + governance gate, one canonical domain, and the legacy mass frozen. **This is beta-ready.**

### 5.4 — 12 months (365 days): what MUST exist (beta-ready + early Shopify-class canonical platform)

By month 12 the platform **must be** the canonical V1 architecture, beta-proven, with the early Shopify-class layer landing. Non-negotiable existence list:

1. **One deployable estate on `letbuyy.com`:** monolith + 4 satellites + the Next read/admin apps + one thin ops console; reserved services honestly empty; one staging pipeline; a branch-lag guard. *(ADR-003/004/019/024.)*
2. **One money truth, live:** the canonical ledger fed by every capture/refund/COD in `bigint` paise; PA-split never-custody money-out; 0% fee; reconciliation to zero-break; real-crypto step-up; the compensation executor running. *(ADR-010/011/012/013.)*
3. **One identity issuer, asymmetric:** `identity-platform` sole EdDSA/ES256 signer; all services verify-only; passwordless buyer OTP; the four impls collapsed; the DPDP consent ledger live and gating WhatsApp. *(ADR-005/006/007.)*
4. **RLS load-bearing everywhere:** FORCE+GUC on all 261 tables; gateway off blanket `service_role`; the app-guard + ownership permanent outer layers; the isolation validator in CI. *(ADR-008/009.)*
5. **Server-authoritative commerce:** the hosted checkout origin live with cart-bound signatures; one inventory path with a live sweeper; the typed discount engine; GST place-of-supply + immutable invoices; Shiprocket-real shipping; tenant-isolated customers + light CRM; zero third-party code in the live checkout. *(ADR-014/015/016.)*
6. **Liquid as the default renderer:** flipped per-theme + canary, parity+security+perf green; dynamic sources + theme-blocks; both editors intact; 5–10 first-party themes seeded; the React renderer frozen-or-deleted by data. *(ADR-017/018.)*
7. **One design language:** one token source + the generated Dart bridge; `AppNavigation` at 9/9; the honesty badge systemic; the drift ratchet blocking new drift. *(ADR-020.)*
8. **One honest governance:** the validator suite enforces V1; AGENTS.md is the generated map of V1; the maximalist plan archived; the dead weight removed. *(ADR-001/002/021/023.)*
9. **The production-readiness quartet:** structured logs + redaction, audit relay, alerting, and **backups + a tested restore drill** — the least-built kernel today, mandatory before scale. *(RDY W-35.)*
10. **The early Shopify-class layer (demand-gated, beginning):** OIDC provider and passkeys built when SSO/headless demand appears; the theme/app 3rd-party seams opened only at ≈5k merchants. *(ADR-007/022/023; Waves 7–8.)*

*The 10k-end-state extras beyond this (full theme/app marketplaces, gift-card-as-tender, partitioning) remain correctly deferred and excluded from the 12-month bar.*

### 5.5 — The five closing questions, answered decisively

**Q1 — What should be DELETED immediately?**
The three security-S0 code paths and the money-honesty violations: the `/api/auth/switch` takeover path (commit the fix — ISSUE-001); the 6 `USING(true)`→PUBLIC RLS policies + the anon-writable `super_admin_allowlist` (ISSUE-003…008); the `razorpayx` self-custody rail, the forgeable step-up, the 3% GMV rake default + GST-on-fee, the `gift_cards.balance` duplicate, the GUC-from-param ledger behavior, and the `AUTH_SECRET` internal-secret fallback (ISSUE-012/014/015); the duplicate staging workflow; and (gated on the validator retarget) the ~13.3k-LOC CQRS/saga package cluster, the ~36 fiction validators, the k8s/Helm fantasy, and the ~15.3k-LOC `legacy/firebase` backend (→ archive). *(ADR-002/006/009/011/012/021/023.)*

**Q2 — What should be FROZEN immediately?**
`app-marketplace` + `developer-portal` (de-deploy; keep the OAuth2/PKCE seam); the six reserved services (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`) as manifest-only; `apps/mobile/shopper-app` + `apps/mobile/operator-app`; the Wasm checkout-functions runtime → seam; headless Hydrogen/Oxygen → deferred seam; the theme app-blocks / 3rd-party authoring seam; full in-WhatsApp commerce; the partition-shadow seam (mirror disabled); and — critically — **the React theme renderer is FROZEN, not deleted** (the live read path; delete-or-freeze decided by data at Wave 6). *(ADR-016/017/018/019/022/023.)*

**Q3 — What should be COMPLETED immediately?**
Ledger the capture/refund/COD (ISSUE-010/011/018/019); the RLS+GUC tenancy backbone + FORCE on all 261 tables (ISSUE-009; FND-009); the asymmetric token re-key + `identity-platform` sole issuer (ISSUE-027); PA-split money-out + reconciliation closure (ISSUE-014; PAY-013); the hosted `checkout.letbuyy.com` origin + cart-bound signature (RDY W-20); the stale-reservation sweeper + typed discount engine; GST place-of-supply + immutable invoice + Shiprocket-real shipping; the notifications router + scoped WhatsApp + consent ledger; the provider-mode honesty badge + mobile release signing + `mobile-bff` composites; the same-transaction outbox + compensation executor; and the observability quartet (logs/redaction/alerting/backups+restore-drill). *(ADR-005/007/008/010/011/014/015/016/020; RDY W-32/W-33/W-35.)*

**Q4 — What should NEVER be built (for this envelope)?**
A 22-service / microservice-per-domain fleet; CQRS/event-store/saga/replay/projection infrastructure; multi-region/failover/chaos resilience machinery; a 3rd-party app marketplace + Wasm checkout-functions runtime + checkout-extension host as live capability; a headless Hydrogen/Oxygen storefront tier; full in-WhatsApp commerce (catalog→cart→in-thread checkout, broadcasts, inbox); a money-custody rail (LetBuyy never holds funds); and any GMV/transaction fee (0% is permanent). Each is a frozen seam reopened only at a named business trigger (≈5k merchants + developer/theme-author demand) under **human approval**, never agent- or default-driven. *(ADR-011/012/016/018/021/022/023.)*

**Q5 — What should become the FINAL canonical architecture?**
**A single India-only modular-monolith commerce platform** — `api-gateway` + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` over one RLS+GUC Postgres on Cloudflare (ap-south) + Vercel — with **a canonical append-only double-entry ledger as the only money truth (balance derived, bigint paise, never-custody PA-split, 0% fee, reconcile-to-zero), `identity-platform` as the sole asymmetric token issuer for all three realms, layered fail-closed RLS+GUC tenancy, server-authoritative Liquid-first commerce with a hosted checkout origin, one storefront runtime, one design-system token source + app shell + honesty badge, and every Shopify-scale capability frozen as an empty seam** — governed by **one constitution (V1+Freeze) and one validator suite that enforces it.** *(ADR-001 through ADR-024.)*

---

## 6. Brutal closing verdict

**What LetBuyy actually is (today):** a genuinely-built modular monolith (~83k LOC) with a *real, rigorous* Stripe-grade double-entry money kernel, a server-authoritative cart, a competent four-flow auth surface, a Polaris-grade token engine, a Shopify-OS-2.0-shaped theme platform with two renderers, and a genuinely strong cached storefront — **welded onto an unreconciled ~237-table legacy mass** whose tenancy is enforced only in application code (the gateway is `service_role`, so RLS is decorative), whose money paths the buyer actually hits post **zero** ledger entries, whose money-out rail self-custodies in breach of its own constitution, and **whose entire remediation is built but undeployed** because `main` is 30 commits behind the fix branch. Net engineering reality: **~2.4–2.5 / 5**; "DDL-real, wiring-dead" in four load-bearing places and "two parallel systems" in four more; **~55% complete in tree, ~0% live.**

**What LetBuyy thinks it is:** a **production-ready, enterprise-grade, 9-app platform** — because the governance gate is green. 181 validators pass, certifying provider-failover, partition-recovery, multi-region survivability, and 9 chaos experiments. **But those validators enforce the rejected constitution and reference V1 zero times, while 9 S0 vulnerabilities ship live.** The platform certifies itself ready for a scale and an architecture it does not have, and is blind to the cross-tenant leaks, the account takeover, and the money layer that contradicts its own 0%-fee, no-custody promise. **That is governance theater, and it is the most dangerous thing in the repository** — not because the code is bad (the core is good), but because the green light hides the gap.

**What LetBuyy should be (per V1, ratified here):** exactly the canonical architecture of §2 — one monolith + four satellites, one ledger, one issuer, layered RLS, server-authoritative Liquid-first commerce, never-custody PA-split, 0% fee, reserved services empty, the Shopify-scale machinery frozen. The hard, correct core V1 asked for is **largely already built.**

**The gap — and this is the whole point:** the distance between what LetBuyy *is* and what it *should be* is **not new construction — it is deletion and completion.** The fixes mostly exist; they are **unmerged** (the 30-commit lag), **unwired** (the ledger, the GUC, the sweeper, the reconciler, the compensation executor), **one default-number away** (the 3% rake), **one connection-role away** (off `service_role`), **one feature-flip away** (Liquid), or **one commit away** (the S0 switch fix). The platform built the cathedral and then hid it behind a green gate while leaving the front door unlocked and the ledger blind. **The program's job is to merge the branch, engage the RLS, feed the ledger, switch the rail, set the fee to zero, ship the hosted checkout, retarget the governance to the truth, and delete the two-of-everything — and the platform LetBuyy already built becomes the platform LetBuyy thinks it is.** That is a ~80-eng-week, ~4–6-month effort bounded by a single serial critical path — **achievable, and overwhelmingly worth doing,** because the opportunity (a 0%-fee, never-custody, Liquid-first, WhatsApp/UPI/COD India commerce platform) is real and the core that serves it is real. The only thing standing between LetBuyy and that platform is the honesty to stop certifying the wrong architecture and the discipline to finish the right one.

---

## 7. Sign-off

**The Architecture Review Board ratifies this Final Architecture Decision Record as ACCEPTED, effective 2026-06-10.**

- **V1+Freeze is the sole constitution.** `AGENTS.md` is regenerated from it; the validator suite is retargeted to it; the maximalist CHECKOUT_PLATFORM vision is rejected and archived.
- **ADR-001 through ADR-024 are ACCEPTED** as the load-bearing architecture decisions, each reversible only at its named trigger or rollback mechanism.
- **The canonical architecture is the §2 position:** one monolith + four satellites; canonical double-entry ledger SSOT (never-custody PA-split, 0% fee); `identity-platform` sole asymmetric issuer; layered fail-closed RLS+GUC; server cart + hosted checkout; Liquid-first themes; one storefront runtime; one design-system source; reserved services empty.
- **The sequencing is law:** S0/deploy first (Wave 0), money + tenancy next (Wave 1), true-up + governance retarget (Wave 2), traffic migration (Wave 3), legacy freeze→removal→hardening→production-readiness→Shopify-class (Waves 4–8). Every wave item ties to a forensic ISSUE-ID.
- **The deletion law is constitutional:** nothing load-bearing is deleted until the winner serves + a zero-drift proof; the deploy meta-blocker is the keystone for all of it.

This record is the platform's single authoritative statement of what LetBuyy IS. It governs the program's 11 sibling deliverables and is itself subordinate only to V1+Freeze (the constitution) and to the forensic evidence base. Where this record and a sibling disagree on what is canonical, this record governs; where it disagrees with the forensic master on evidence, this record is wrong and must be corrected.

**Cross-references (the program body this record ratifies):** `_ANCHOR_DECISIONS_SPINE.md` · `STRATEGIC_WINNERS_MASTER_PLAN.md` · `CANONICAL_ARCHITECTURE_MATRIX.md` · `IDENTITY_MIGRATION_MASTER_PLAN.md` · `MONEY_SYSTEM_CANONICALIZATION_PLAN.md` · `TENANT_ISOLATION_CANONICALIZATION_PLAN.md` · `THEME_MIGRATION_MASTER_PLAN.md` · `UI_UX_UNIFICATION_MASTER_PLAN.md` · `LEGACY_ERADICATION_REGISTER.md` · `SAFE_DELETION_PLAN.md` · `PLATFORM_SIMPLIFICATION_PLAN.md` · `PRODUCTION_READINESS_GAP_REPORT.md` · `SHOPIFY_ALIGNMENT_REPORT.md` · `FORENSIC_MASTER_2026_06_10/` (000_MASTER_INDEX + TOP_250_PLATFORM_ISSUES) · `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (the constitution).

### UNVERIFIED (preserved, never silently upgraded)
- **The 6 anon RLS-to-PUBLIC table GRANTs** are set by Supabase's managed bootstrap, not repo SQL — confirm live state with an anon-key probe / `\dp public.orders` before final S0 sign-off (migration 107's header is strong evidence they are live).
- **Which ops console survives** (`platform-console` vs `platform-operations-portal`) is an **ARB decision, not a code fact** — tentatively `platform-console`; not hard-coded.
- **`legacy/` git-tracked file count** (37 reported by topology vs empty from the Linux mount) — on-disk LOC (~15.3k) confirmed; classification unchanged; proof = `git ls-files legacy/` from the macOS repo root.
- **Full RLS/FORCE coverage per tenant table** (≈41–76/261 confirmed in migrations) needs live `pg_policies` introspection; live writers for the ~37 product-dead tables need `pg_stat_user_tables` before any DROP.
- **`pnpm turbo build` green baseline** across workspaces (assumed by the dead-package deletions; not executed in-audit).
- **Live deployment state** of every "complete" wave is ~0% (the 30-commit lag) — completion% measures the working tree, not production.

*End of Final Architecture Decision Record. Status: ACCEPTED, 2026-06-10. Supersedes the competing constitutions; ratifies V1+Freeze. Evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty.*
