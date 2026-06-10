# LETBUYY CONSTITUTION

> **Document type:** Supreme governing law of the LetBuyy platform. The single highest-authority document in the company.
> **Document ID:** DOC 01 (the apex of the governance rewrite of 2026-06-10).
> **Date ratified:** 2026-06-10.
> **Authored by:** The Architecture Review Board (ARB), sitting as the constitutional convention; CTO co-signing.
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store`. Evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty.
> **Status:** **RATIFIED. SUPREME. NOTHING OVERRIDES IT.**

---

## Preamble

### P.1 — What this document is

This is the **Constitution of LetBuyy**. It is the supreme law of the platform. It is the single authoritative statement of **what LetBuyy is, what it must never become, and the order of precedence by which every other rule, document, validator, agent, and human is bound.** Every future decision — by an AI agent, an engineer, or the ARB itself — is subordinate to this document. Where anything conflicts with this Constitution, this Constitution governs and the other thing is void to the extent of the conflict.

It is written to be read **standalone**: a new agent or engineer with zero prior context can follow this document and be correct about what LetBuyy is and what it is permitted to build. The detailed operating rules live one level below, in `LETBUYY_AGENTS_V2.md` (the manual); this document is the law the manual must conform to.

### P.2 — Supersession header (what this Constitution replaces)

This Constitution **absorbs, ratifies, and retires** the prior architecture authorities. Their decisions are not discarded — they are **promoted into constitutional Articles** (Article register, §9) and the source documents are demoted to historical record.

- **`LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`** (the executable constitution) and **`LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`** (the freeze) — **ABSORBED.** Their substance becomes Articles ART-01 … ART-24 below. As standalone authorities they are **RETIRED to `docs/archive/`** as historical record. They no longer govern; this Constitution governs in their place. *(Resolution: Article ART-01; evidence: FADR §0.3, ADR-001; spine S2.)*
- **The generated `AGENTS.md`** (the auto-produced 9-app / CQRS / multi-region "Canonical Active Runtimes" map) — its **constitutional claims are REVOKED.** `AGENTS.md` is demoted from law to a **generated artifact** that must be regenerated from this Constitution (via `LETBUYY_AGENTS_V2.md` and the canonical-systems registry) and may never again declare topology or architecture as law. *(Resolution: Article ART-21, ART-22; evidence: spine S1, S5; FADR §3, ADR-001/002.)*
- **The maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md`** (the 1,000,000-merchant / 22-service / Wasm-runtime / CQRS-saga-multi-region vision) — **FORMALLY REJECTED as active topology and ARCHIVED.** It is not LetBuyy's destination. Its individual capabilities are each separately forbidden by the Never-Build List (§10). *(Resolution: Article ART-23; evidence: spine S6; FADR ADR-021.)*

This Constitution does **not** modify code or any other document by its own act; the migrations of `V1`/`FREEZE` and the maximalist plan into `docs/archive/` are constitutional consequences to be executed under §14, recorded here as binding.

### P.3 — The authority hierarchy (constitutional order of precedence)

On **any** conflict, the higher authority wins. This single chain replaces the prior "two/three/four-constitution" ambiguity (V1 vs Freeze vs the generated AGENTS.md vs the maximalist plan) that the forensic audit found certifying the wrong architecture. *(Spine S2; FADR §3.1 "four realities".)*

1. **`LETBUYY_CONSTITUTION.md`** — **this document. Supreme.** Nothing overrides it. Changes require a constitutional amendment under §14.
2. **`LETBUYY_AGENTS_V2.md`** — the operating rules every agent and engineer follows. **Must conform to this Constitution.**
3. **`LETBUYY_CANONICAL_SYSTEMS.md`** — the winner registry: the one true system per domain. Subordinate to 1–2.
4. **`LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` + `LETBUYY_FOUNDATION_ROADMAP.md`** — how and when convergence happens. Subordinate to 1–3.
5. **`LETBUYY_UI_UX_GOVERNANCE.md` + the surviving retargeted `docs/governance/*`** — domain governance. Subordinate to 1–4.
6. **The evidence base** — `FORENSIC_MASTER_2026_06_10/` (the audit) and `STRATEGIC_CANONICALIZATION_2026_06_10/` (the winner program). This is the **"why," not authority**: it justifies the Constitution; it does not outrank it. Where the Constitution and the evidence disagree on a *fact*, the Constitution is wrong on that fact and must be amended; where they disagree on *what is canonical*, the Constitution governs.

The retired `V1` and `FREEZE` and the rejected maximalist plan hold **no** position in this chain. They are archived history.

---

## 1. Mission

LetBuyy is building a **governed, Shopify-class, India-first, multi-tenant commerce operating system for micro and small merchants** — a platform on which a solo or small Indian seller runs their entire business: storefront, checkout, orders, payments-settlement, inventory, customers, themes, and WhatsApp-native commerce.

It is **Shopify-class in capability and load-bearing pattern, not in scale machinery.** It copies Shopify's correct foundations — a modular monolith, server-authoritative commerce, an Online-Store-2.0 Liquid theme model, a double-entry money ledger — and **rejects** Shopify's end-state infrastructure (a service fleet, Wasm extensibility, CQRS, multi-region), which exist to serve millions of merchants LetBuyy does not have and is not designing for.

The mission is bounded by a single regulatory truth that shapes the whole platform: **LetBuyy never custodies money.** Merchants are merchant-of-record on their own payment provider; a licensed payment aggregator moves all funds. This makes LetBuyy a software platform, not a payments company, and it is the foundation of the permanent **0% transaction fee** that is LetBuyy's competitive wedge.

*(Mission anchored in: V1 §1; FREEZE §0; FADR §1; forensic master "What LetBuyy SHOULD be".)*

---

## 2. Vision

The five-year vision is **founder-protecting**: it optimizes for survival, trust, and correctness over impressiveness.

In five years LetBuyy is **the default commerce OS for India's long tail of micro and small merchants** — the place a WhatsApp-first, UPI-first, COD-heavy Indian seller goes to run a real business at 0% transaction fee, with their money settled to their own account by a licensed aggregator and their customers updated over WhatsApp by default. It earns its revenue from **subscriptions and adjacencies** (WhatsApp credits, shipping spread, AI credits, later a curated theme/app catalog) — **never from the merchant's sale.**

The vision is reached by **finishing the correct core LetBuyy already built and deleting the parallel systems** — not by building the maximalist platform. The platform grows into a Shopify-class ecosystem (third-party themes and apps, passkeys, OIDC) **only when real merchant and developer demand exists** (the named trigger is approximately 5,000 merchants with inbound developer demand), and every such expansion is a deliberate, human-approved constitutional act — never default-driven scope creep. The founder is protected because the platform's surface stays bounded to what the envelope needs, its attack surface stays small, its money stays out of custody, and its governance tells the truth.

---

## 3. Architecture Philosophy

The following are the load-bearing architectural convictions. They are constitutional values; the Permanent Decisions (§9) and Constitutional Rules (§13) operationalize them.

1. **Modular monolith, not a service mesh.** One `api-gateway` modular monolith holds the commerce contexts as enforced-boundary modules; four satellites surround it. A module is extracted into a service **only** when a measured hot-path or team boundary forces it, with ARB sign-off — never preemptively. A distributed system for a small team is the coupling of a monolith with the operational pain of microservices. *(V1 Principle 1; FREEZE §1.4; FADR ADR-004.)*
2. **Rent the rails; never custody.** LetBuyy rents money movement (a licensed PA), KYC, shipping, and messaging. It instructs and mirrors; it does not own the regulated machinery. This deletes an entire quarter of "payout engine" work and removes unlicensed-aggregator risk. *(V1 Principle 2; FREEZE §0; FADR ADR-011.)*
3. **Mock-by-default, honest-always.** Every external dependency is one adapter interface + a real adapter + a mock adapter (default). A **provider-mode honesty badge** (mock/sandbox/live) is mandatory on every money and fulfillment surface. **A stub must never read as `success`.** *(V1 Principle 4; FREEZE TD-1/R-2; FADR ADR-020.)*
4. **Reliable events via a transactional outbox, not an event bus.** A domain write and its event row commit in the **same transaction**; a worker relays. No standalone event-bus, no event sourcing, no CQRS, no saga engine, no schema registry. *(V1 Principle 5; FADR ADR-019.)*
5. **Fail-closed tenancy.** Tenant isolation is layered and defaults to **deny**. An unset or wrong tenant context yields **zero rows**, not all rows. The database is the load-bearing backstop, not the application alone. *(V1 Principle 6; FADR ADR-008/009.)*
6. **Single source of truth over coexistence.** For every domain there is **exactly one** canonical system. "Two of everything" — two ledgers, two renderers, two auth stacks, two tenant keys — is a constitutional defect to be eliminated, never a feature. *(Spine S5; FADR ADR-024; forensic "two parallel systems".)*
7. **Clean replacement over backward compatibility.** LetBuyy has **zero production merchants and zero legacy burden.** It therefore moves directly to the intended architecture and **preserves nothing for its own sake.** There are no real merchants whose data must be kept on a losing system; the losing system is frozen, proven equivalent, then deleted. *(Program decision rule; FADR §0.2.)*
8. **Correctness over elegance.** Build the parts that must be *correct and safe* to production grade (server cart, the ledger, signed checkout handoff, PA-split, RLS, the outbox). Defer or reject the parts that are merely *elegant* (extensions, Wasm, vault). *(V1 Principle 3; FREEZE checkout one-liner.)*

---

## 4. Commerce Philosophy

1. **Server-authoritative throughout.** Price, discount, inventory, tax, and order creation are decided on the **server**. The client cart is a view, never an authority. Orders are created **only** through the canonical checkout flow / order RPC. *(V1 §9; FADR ADR-014/015.)*
2. **Merchant is merchant-of-record on their own PSP.** Buyers pay into the **merchant's own** Razorpay account. LetBuyy never custodies money-in. *(FREEZE §1.3 "load-bearing"; V1 §8; FADR ADR-011.)*
3. **Never custody money-out.** Money-out is a thin split-instruction + statement-mirror + reconciliation over a **licensed PA** (Razorpay Route / Cashfree). There is no self-custody disbursement rail. *(V1 Principle 2; FADR ADR-011.)*
4. **0% transaction fee, permanent.** LetBuyy never monetizes the sale on any paid tier. Monetization is subscription + adjacencies. *(V1 Principle 9; FREEZE §7.3; FADR ADR-012.)*
5. **WhatsApp / UPI / COD first.** The India wedge is WhatsApp order-lifecycle + COD confirmation, UPI-first money-in, and COD-aware fulfillment — scoped, not a full in-WhatsApp commerce platform. *(V1 §11; FREEZE §5; FADR ADR-016.)*
6. **`channel` is first-class.** `channel ∈ {web, whatsapp, instagram, pos, api}` is a first-class dimension on cart, checkout, and order. *(V1 Principle 8.)*
7. **Liquid-first themes.** The canonical renderer is a Liquid / Online-Store-2.0-shaped theme platform — the only model that supports portable themes, third-party authors, and an ecosystem. The theme editors are the differentiator and are protected. *(FADR ADR-017; spine S5.)*

---

## 5. Governance Philosophy

1. **One constitution.** There is exactly one supreme law — this document. The era of four mutually-contradictory self-definitions is over. *(FADR §3; spine S1/S2.)*
2. **Enforceable contracts over tribal knowledge.** Architecture is enforced by **machine-checkable validators and tests**, not by convention, memory, or hope. A rule that is not testable is not yet governance. *(Spine S9; V1 Principle 12.)*
3. **Validators must enforce *this* Constitution, never the rejected end-state.** The CI gate exists to block real regressions against the canonical architecture. It may **not** certify capabilities the Constitution forbids (multi-region survivability, partition recovery, CQRS, chaos for a distributed system that does not exist). A green gate must mean "conforms to the Constitution." *(FADR ADR-002; forensic Q2 "governance theater".)*
4. **Generated documents may never become law.** Any document produced by a repository scan or generator (notably `AGENTS.md`) is a **map of reality**, never a source of authority. A generator may not promote whatever sprawl exists into canonical law. *(Spine S1; FADR ADR-001.)*
5. **Governance-theater is forbidden.** Certifying an architecture the platform does not have, fabricating production topology, or passing a green gate while known S0 vulnerabilities ship live is the single most dangerous failure mode in the repository and is **constitutionally prohibited.** *(Forensic master §"What LetBuyy thinks it is"; FADR §3.3/§6.)*

---

## 6. The Scale Envelope (constitutional constant)

The scale envelope is a **constitutional constant**, restated here from spine S3 and binding on every artifact.

> **India-only. Design for 100 → 1,000 → 10,000 merchants. NEVER optimize for 100,000+ or 1,000,000+.**

At the top of the envelope, throughput is approximately **30,000 orders per month** — trivial for one PostgreSQL on one region. *(FREEZE §8.1; V1 §7.)*

**The constitutional consequence:** **everything is sized to this envelope.** No sharding, no partitioning-now, no read replica-now, no multi-region, no CQRS, no event sourcing, no service mesh, no Wasm extension runtime is in scope. Any artifact — code, schema, validator, document, or topology manifest — that **designs for 100,000+ or 1,000,000+ merchants is out of scope by constitutional rule, not by opinion**, and is void to the extent it does so. **Designing past this envelope requires a constitutional amendment** under §14, justified by named, measured demand — never an agent's or default's anticipation. *(Spine S3; FADR ADR-021/023; FREEZE Phase 2.)*

---

## 7. Non-Goals (explicit)

LetBuyy is explicitly **NOT**, within this envelope:

1. **Not a money custodian.** It never holds merchant or buyer funds. *(ART-11.)*
2. **Not a 22-service / microservice-per-domain distributed system.** *(ART-04.)*
3. **Not a multi-region, sharded, CQRS / event-sourced / saga-orchestrated platform.** *(ART-19/23.)*
4. **Not a third-party app / extension platform now** — no live app marketplace, checkout extensions, or Wasm extensibility runtime. *(ART-16/22.)*
5. **Not a dual-runtime headless storefront** — no Hydrogen/Oxygen tier. *(ART-18.)*
6. **Not a fee-extracting marketplace** — no GMV rake, no transaction fee. *(ART-12.)*
7. **Not a fraud-ML platform** — the India fraud lever is COD-confirm-over-WhatsApp, a heuristic. *(Never-Build List.)*
8. **Not a full in-WhatsApp commerce stack** (catalog → cart → in-thread checkout → broadcasts → inbox) at beta. *(ART-16.)*
9. **Not a reseller network / marketplace** — reseller *links* only, deferred. *(V1 R-12.)*
10. **Not a platform that fills its six reserved services** to "match the architecture." *(ART-19.)*

---

## 8. Permanent Decisions — overview

Section 9 states the irreversible constitutional Articles. Each is a crystallization of the absorbed `V1`/`FREEZE` decisions and the 24 ADRs of the Strategic Canonicalization program (`FINAL_ARCHITECTURE_DECISION_RECORD.md`, ADR-001 … ADR-024), responding to the evidence in `FORENSIC_MASTER_2026_06_10/`. Each Article states: **the decision**, **why it is permanent**, and **what it forbids**. "Permanent" means **reversible only by constitutional amendment (§14) at the Article's named trigger** — never by an agent, a default, or ordinary engineering judgment.

The winner registry (spine S5) that these Articles enforce is **final and not re-litigated** by this Constitution or by anything below it.

---

## 9. Permanent Decisions — the Constitutional Articles (ART-01 … ART-24)

### Governance

**ART-01 — One Constitution; the prior constitutions are absorbed.**
- **Decision.** This document is the sole constitution. `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` are absorbed into it (their decisions are these Articles) and retired to `docs/archive/`. `CLAUDE.md` and all tooling are re-ranked to put this Constitution first.
- **Why permanent.** Multiple self-definitions are the root cause the forensic audit named "the four realities" — every agent could cite a different "canonical." One supreme law ends that permanently.
- **Forbids.** Citing `V1`, `FREEZE`, `AGENTS.md`, or the maximalist plan as a competing authority. Creating a new top-level "constitution," "north-star," or "master architecture" document that claims authority over this one.
- *Evidence: spine S1/S2; FADR ADR-001; forensic Q2.*

**ART-02 — One validator suite that enforces the Constitution; governance-theater ends.**
- **Decision.** The CI validator suite is retargeted to enforce **this Constitution**. The rejected-architecture "theater" validators (replay, projection, saga, CRDT, failover, WAL, lease, multi-region, chaos, convergence-math) are **deleted** (after / just-before deleting the dead packages they assert, to avoid the validator-liveness deadlock). The real-invariant validators (tenant-isolation, session-security, single-writer, anti-fabrication, crypto/currency single-source) are **kept**. The missing gates are **added**: migration↔rollback pairing, deploy-manifest↔topology contract, the `letbuyy.store` literal ban, the `commission_bps = 0` ratchet, and topology-JSON anti-fabrication.
- **Why permanent.** A green gate that certifies a non-existent distributed system while 9 S0s ship live is an active falsehood that hides the platform's true state. Retargeting the gate is the act that makes this Constitution's words enforceable for the first time.
- **Forbids.** Any validator that certifies a capability this Constitution forbids. A green build that coexists with a known, un-waived S0. Adding "alongside" V1 validators while leaving the fiction validators in place.
- *Evidence: spine S1/S9; FADR ADR-002; forensic Q2/§6.*

### Platform / topology

**ART-03 — The deploy meta-blocker is the keystone; nothing ships until it is fixed.**
- **Decision.** Before any other remediation: commit and deploy the working-tree `/api/auth/switch` fix and its test; merge the deploy branch forward (`main` was ~30 commits behind) so the entire remediation backlog becomes deployable; collapse the duplicate staging workflows to one; add a branch-lag CI guard so the lag can never silently re-accumulate.
- **Why permanent (as a sequencing law).** Every other Article's implementation is theory until the pipeline can deploy. The live estate runs pre-remediation code; "the fix exists" and "the fix is live" are different facts, and only this unblocks the gap between them.
- **Forbids.** Treating any "complete" wave as live before it is deployed from the canonical branch. Hotfixing S0s to a forked branch and stranding the integration history. Letting the deploy branch silently fall behind again.
- *Evidence: FADR ADR-003; forensic ISSUE-002; deploy-meta-blocker.*

**ART-04 — One topology: the modular monolith + four satellites.**
- **Decision.** The canonical estate is `api-gateway` (the modular monolith) + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service`, plus the Next.js read/admin apps (`storefront-runtime`, `merchant-control-plane`, `marketing-site`) and **one** thin ops console, over one PostgreSQL on Cloudflare (ap-south) + Vercel. All commerce capabilities live **in the monolith**; async work lives in `queue-workers`; `mobile-bff` is a real composite/fan-in BFF; `webhook-service` owns outbound webhooks. No domain is extracted to a service without a measured trigger and ARB sign-off.
- **Why permanent.** The envelope does not need a service fleet; extraction multiplies attack surface and operational burden for zero merchant-visible benefit. Shopify itself is a modular monolith sharded only after years at scale.
- **Forbids.** A 22-/13-service decomposition. Microservice-by-domain extraction without a measured trigger + ARB sign-off. Over-deploying non-core apps as active topology (see ART-22). Fabricating reserved services as deployed (see ART-19).
- *Evidence: V1 §6; FREEZE §9; FADR ADR-004; spine S4/S5.*

### Identity

**ART-05 — `identity-platform` is the sole asymmetric token issuer.**
- **Decision.** `identity-platform` is the **sole issuer** of all identity for all three realms (merchant/staff, buyer/customer, platform-operator). The token kernel is **asymmetric sole-signing** (EdDSA/Ed25519, ES256 fallback) via a real KMS; **every other service is verify-only** with the published public key, on per-audience claims. The four parallel auth implementations (gateway `routes/auth.ts`, the identity-foundation shadow stack, legacy Supabase `/auth/*`, and the identity micro-packages) collapse into this one. The shared-`AUTH_SECRET` HS256 design is dead.
- **Why permanent.** Under the shared symmetric secret, the verification key **is** the forgery key across seven trust domains. Asymmetric sole-signing makes a leaked verification key harmless and makes the claims→tenant-context bridge trustworthy — the precondition for real tenancy (ART-08).
- **Forbids.** Any second token issuer. Any service minting tokens other than `identity-platform`. A shared symmetric signing secret across services. Verifier and issuer roles co-mingled in a service other than the issuer.
- *Evidence: V1 §8; FADR ADR-005; forensic ISSUE-027.*

**ART-06 — The live identity S0s die in the first wave.**
- **Decision.** The unauthenticated `/api/auth/switch` account-takeover fix is committed and deployed immediately (gated on ART-03's merge). The anon-writable `super_admin_allowlist` is re-scoped to `service_role` with an audited write path and an INSERT audit trigger. Both land before merchant #1.
- **Why permanent (as a floor).** These are live, continuously-exploitable account-takeover and privilege-escalation paths with the highest catastrophe-to-effort ratio in the program. No claim of a sound identity model is defensible while they ship.
- **Forbids.** Deferring a live identity S0 to a later convergence wave. Any anon-writable privilege-granting policy. Shipping a build that leaves a known account-takeover path open.
- *Evidence: FADR ADR-006; forensic ISSUE-001/003.*

**ART-07 — A DPDP consent ledger is canonical; OIDC and passkeys are canonical-but-deferred.**
- **Decision.** An append-only **DPDP consent ledger** + DSR export/erasure is built in `identity-platform`, **fail-closed** (a missing consent record hard-stops the matching send, never opens it); WhatsApp/marketing/analytics sends gate on it. The OIDC provider and WebAuthn passkeys are **canonical but deferred** — built only when SSO/headless/partner demand exists; until then OIDC serves a real `404`, **never a placeholder JWKS**.
- **Why permanent.** DPDP is an Indian legal requirement and the WhatsApp wedge is unshippable without consent. Advertising an IdP the platform cannot back (a `MOCK_JWKS` skeleton) is a governance-theater violation (ART-02).
- **Forbids.** Sending any consent-gated message without a consent record. A consent gate that fails open. Serving a placeholder/mock JWKS. Building OIDC/passkeys ahead of the named demand trigger.
- *Evidence: V1 §3/§11; FADR ADR-007; forensic IDN-021/024/027.*

### Tenancy

**ART-08 — Tenancy is layered and fail-closed: RLS `ENABLE`+`FORCE` + per-transaction GUC is the load-bearing backstop; the gateway runs off blanket `service_role`.**
- **Decision.** Three layers, defaulting to deny: (L1) the app-layer query-lint guard; (L2) ownership resolution; (L3) **PostgreSQL RLS `ENABLE`+`FORCE` + a per-transaction tenant GUC** set from validated JWT claims on **every** tenant table — unset/wrong GUC ⇒ zero rows. The decisive change: the gateway **stops connecting as blanket `service_role`**; tenant data runs under a non-`BYPASSRLS` `app_tenant` role via a per-transaction wrapper, and `service_role` becomes a narrow, audited, break-glass hatch. L1 and L2 remain **permanently** as defense-in-depth. The GUC value comes from a validated asymmetric claim (couples to ART-05).
- **Why permanent.** Under `service_role` the database bypasses RLS, so `FORCE`-RLS and the tenant policies are decorative and a single application-layer miss leaks cross-tenant data with no backstop. Only a non-bypass role over a per-transaction GUC makes the Constitution's tenancy words true.
- **Forbids.** Running tenant queries under a `BYPASSRLS` / blanket `service_role` connection. Tenant tables without `ENABLE`+`FORCE` + a GUC policy. Setting the tenant GUC from an unvalidated parameter. Treating the app guard as the sole control.
- *Evidence: V1 §7/§17 (DB); FREEZE §1.7/TD-4/R-4; FADR ADR-008; forensic ISSUE-009.*

**ART-09 — The anon RLS-to-PUBLIC table leaks die in the first wave.**
- **Decision.** The baseline policies that grant **anon** read/write of orders, customers (PII), billing, products, sites, and subscriptions (`USING(true)` to PUBLIC), plus anon write to `sites.user_id` (store takeover), are dropped and recreated as `TO service_role` + correct owner/active policies, with `REVOKE INSERT/UPDATE/DELETE FROM anon, authenticated`. A CI policy-lint forbids `USING(true)` without a `TO`-clause and predicate.
- **Why permanent (as a floor).** This is a continuously-exploitable cross-tenant data and PII leak at the database GRANT layer, beneath the application; only a database-layer fix closes it, and it cannot wait for the breadth migration.
- **Forbids.** Any `USING(true)` policy granted to PUBLIC/anon/authenticated. Relying on the app guard to mask a database-layer grant. Shipping with anon write access to tenant or ownership columns.
- *Evidence: FREEZE TD-4/R-4; FADR ADR-009; forensic ISSUE-003…008. (Live-grant state is UNVERIFIED per §14.4 and must be probed before final S0 sign-off.)*

### Money

**ART-10 — The canonical append-only double-entry ledger is the single money source of truth; balance is always derived.**
- **Decision.** The canonical 8-account append-only double-entry ledger is the **only** money truth. **Balance is always derived**, never a mutable column. **Every** capture/refund/COD/tender posts through it idempotently. Money is **`bigint` minor units (paise) everywhere**. There is **one writer** (the settlement module). Append-only is enforced by **trigger AND `REVOKE UPDATE/DELETE`** + RESTRICT FKs. Reconciliation is to **zero-break-or-explained-suspense**. The legacy un-ledgered capture/refund/COD RPCs become adapters that post to canonical, then legacy; the compat ledgers and mutable balances become read-only projections / tenders.
- **Why permanent.** Mutable-balance-as-truth is the root-cause class of the money P0s. A derived balance over an append-only, balanced, single-writer ledger is the only design that is provably correct, reconcilable, and able to model COD cash-in-transit, reserves, and reversing entries.
- **Forbids.** Treating any mutable balance column as money truth. A money path that does not post to the canonical ledger. More than one ledger writer. `UPDATE`/`DELETE` of a posted ledger entry (corrections are reversing entries). Deleting any money system before a reconciliation harness proves zero drift on the path it replaces.
- *Evidence: V1 §7/§8; FREEZE §3.1; FADR ADR-010; forensic ISSUE-010/011/018/019.*

**ART-11 — Money moves only via PA-split; LetBuyy never custodies.**
- **Decision.** Money-in flows to the **merchant's own** Razorpay (merchant = merchant-of-record). Money-out is a thin **split-instruction + statement-mirror + reconciliation** through a licensed PA (Razorpay Route / Cashfree); the rail asserts a split product and derives `no_custody` from the rail, not from a hardcoded flag. The self-custody `razorpayx` rail is **dead**. The second factor on refund/payout is **real cryptography** (HMAC / stored challenge), not a string-length check.
- **Why permanent.** A self-custody disbursement rail makes LetBuyy a money custodian, breaching the never-custody rule and inviting RBI / PA-licensing exposure. Never-custody is the regulatory foundation of the entire platform and of the 0% fee.
- **Forbids.** Any self-custody / from-own-account disbursement rail. Custodying buyer or merchant funds. Metadata that claims `no_custody` while custodying. A forgeable (non-cryptographic) step-up on money movement. A payout path that can strand on uncertainty without reconciliation.
- *Evidence: V1 §8/Principle 2; FREEZE §1.3/R-1; FADR ADR-011; forensic ISSUE-012/014.*

**ART-12 — 0% transaction fee, permanent; subscription is the monetization spine.**
- **Decision.** `commission_bps = 0`, permanent; the 3% GMV rake default and the GST-on-fee are dead. **Subscription billing + adjacencies** (WhatsApp/AI credits, shipping spread) are the monetization spine; LetBuyy never monetizes the sale. A `commission_bps = 0` ratchet validator (ART-02) prevents regression.
- **Why permanent.** The 0% promise is the single competitive wedge the whole strategy rests on; on UPI there is almost no margin to harvest, so a fee buys little and costs the brand. It is a strategic commitment, not a tunable.
- **Forbids.** Any GMV or per-transaction fee on any paid tier. A non-zero `commission_bps` default. Making the platform fee per-merchant-configurable as a revenue lever. (Reversal is a business re-ratification outside ordinary engineering, under §14.)
- *Evidence: V1 Principle 9; FREEZE §7.3/§9.4; FADR ADR-012; forensic ISSUE-015.*

**ART-13 — One money representation: `bigint` paise everywhere.**
- **Decision.** `bigint` minor units (paise) on every money path. The int32-paise (overflow at ₹2.14cr) and numeric-rupee columns are legacy → an expand/contract cutover with a verified zero-loss historical backfill; amounts are derived from minor units.
- **Why permanent.** Mixed representations overflow (int32) or drift (numeric rounding) within the envelope's GMV. One integer minor-unit arithmetic for all money is the only safe representation.
- **Forbids.** int32 money columns. Floating-point money, ever. Mixed money representations across paths. Dropping a legacy money column before the backfill is verified zero-loss.
- *Evidence: V1 §7; FADR ADR-013; forensic ISSUE-025.*

### Checkout / commerce

**ART-14 — Checkout is server-authoritative end-to-end: a hosted origin + a cart-bound signed handoff.**
- **Decision.** A hosted **`checkout.letbuyy.com`** origin (contact → delivery → payment → confirm) is built and deployed, consuming a **cart-bound signed handoff** (a hash of sorted line items + coupons + subtotal inside the HMAC). The public order-create is gated behind the signed handoff. Inventory uses **reserve-with-TTL, not pre-payment hard-decrement**. The checkout-session state machine stays canonical in the monolith; the client React cart is a thin view.
- **Why permanent.** A signed URL that does not bind cart contents can be replayed against a mutated cart; an unsigned public order-create bypasses the handoff entirely; pre-payment hard-decrement is a denial-of-inventory vector. Server-authority must hold in production, not only in principle.
- **Forbids.** An unsigned public order-create path. A checkout handoff that does not bind the cart. Decrementing stock before payment for pre-pay/COD. Treating the client cart as the pricing authority.
- *Evidence: V1 §9; FREEZE §3; FADR ADR-014; forensic CHK-001/012/015.*

**ART-15 — One commerce path: server cart + reserve→commit inventory + typed discount engine + GST + Shiprocket-real shipping.**
- **Decision.** One **reserve→commit** inventory lifecycle (optimistic concurrency) with the stale-reservation sweeper **wired** in `queue-workers`; the direct-decrement side doors unify onto it. The typed 3-class `combines_with` discount engine is the live engine (the scalar single-code RPC is demoted). **GST place-of-supply** (CGST/SGST vs IGST + HSN + inclusive/exclusive) + **immutable GST invoice** (IRN/QR via mock IRP) + TCS are built. **Shipping** (zones/profiles/rates + pincode + COD serviceability) ships with **one real carrier (Shiprocket)**, others mocked behind the adapter. **Customers** are tenant-isolated (behind ART-08) with light CRM.
- **Why permanent.** Multiple inventory side doors reopen oversell; GST is legally required for Indian invoicing; Shiprocket is the P0 carrier. One correct path per concern is the single-source-of-truth value (Philosophy §3.6) applied to commerce.
- **Forbids.** Multiple inventory decrement paths. An unscheduled reservation sweeper. Shipping with only scaffold/fake carriers at beta. Invoicing without correct place-of-supply GST.
- *Evidence: V1 §3/§16; FREEZE §3; FADR ADR-015; forensic CHK-002…005.*

**ART-16 — No checkout extensibility in the live path; the Wasm functions runtime is a seam, not a build; WhatsApp is scoped.**
- **Decision.** The Wasm-style checkout-functions / app-functions runtime and the extension host are **removed from the live order/storefront path** and downgraded to a documented **seam** (`checkout-core` stays a library). Notifications are a **WhatsApp-first router** (→ SMS → email → push) in the monolith with multi-ESP failover + preferences/suppression/**consent (fail-closed, ART-07)**. Scoped WhatsApp commerce is **order-lifecycle utility messages + COD-confirm only**; the full in-WhatsApp stack (catalog → cart → in-thread checkout → broadcasts → inbox) is frozen.
- **Why permanent.** Third-party code in a live commerce monolith is an attack surface the envelope has neither the merchants nor the apps to justify; it is cargo-culting Shopify's end-state. Full in-WhatsApp commerce is years premature.
- **Forbids.** Executing third-party/extension/Wasm code in the live checkout or storefront path. Building full in-WhatsApp commerce at beta. A consent-gated WhatsApp send without a consent record.
- *Evidence: V1 §11/R-11; FREEZE §2/§5; FADR ADR-016; spine S6.*

### Theme / storefront

**ART-17 — Theme is Liquid-first (the ecosystem winner over the more-complete React renderer).**
- **Decision.** **Liquid / portable-theme (Online-Store-2.0-shaped) is the canonical renderer** — the only architecture that supports a theme marketplace, third-party authors, portable themes, and app-blocks. React is kept as a **first-party compatibility fast-path**, frozen at parity, and **deleted-or-frozen by data** at the hardening wave — explicitly **not deleted now for completeness**. `theme-engine` is canonical for contracts/schema/validation/bundle. Both editors (web + Flutter) are the differentiator and are protected. The Liquid default-flip is per-theme + canary, gated on a sanitizer + section ports + a parity/security/perf harness.
- **Why permanent.** This is the explicit test of the decision rule: crowning the *more-complete* React renderer would lock LetBuyy into a first-party-only dead-end with no ecosystem path. The less-complete Liquid renderer is the one that scales the ecosystem, so it wins — and deleting React now would be the same error inverted.
- **Forbids.** Crowning React as the canonical renderer. Adding new React-per-section capability after the freeze. Flipping the Liquid default platform-wide without the parity/security/perf gate. Deleting React before the data decision at the hardening wave.
- *Evidence: FADR ADR-017; spine S5; forensic THEME-001/002.*

**ART-18 — One storefront runtime hosting Liquid; no headless Hydrogen/Oxygen split.**
- **Decision.** **One runtime** = `storefront-runtime` (Next.js/Vercel) SSR/ISR + Worker cache, hosting the Liquid renderer at target state. The 3-tier KV-versioned cache stays canonical. The dormant `runtime-composition` package is **unwired from the production read path first, then deleted.** Headless is a written-down deferred seam, not built.
- **Why permanent.** A headless React-storefront tier serves a developer population that does not exist; building it is the same class of error as activating the reserved services.
- **Forbids.** A second storefront runtime / headless Hydrogen-Oxygen tier. Leaving a rejected/dormant package wired into the live read path.
- *Evidence: V1 §6; FADR ADR-018; forensic TOPO-005.*

### Reserved services

**ART-19 — Reserved services stay empty; capabilities live in the monolith + workers; the events backbone is a transactional outbox.**
- **Decision.** The six reserved services (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`) stay **manifest-only / empty**. Their fabricated `environment:"production"` topology entries are deleted (topology is regenerated from the real deploy matrix and marked `reserved`). Their capabilities live in the monolith + `queue-workers`. The events backbone is a **transactional outbox + typed catalog**, with the dual-write made a **same-transaction write** (the reserved `event-bus` stays empty).
- **Why permanent.** Activating a reserved service invents topology no beta merchant would notice; fabricating it as `production` is governance-theater (ART-02). A transactional outbox delivers reliable events without an event bus.
- **Forbids.** Deploying any reserved service. Declaring a reserved service as `production` in any manifest. A non-atomic (post-commit) outbox dual-write. Standing up a real event bus / event store.
- *Evidence: V1 Principle 10/§6; FREEZE §2; FADR ADR-019; forensic LEG-013…017/ARCH-004.*

### Design system

**ART-20 — One design-system token source + one app shell + a systemic provider-mode honesty badge.**
- **Decision.** **One token source** (`packages/typescript/ui/src/tokens.ts`, DTCG) for web; the Dart `ui_kit` consumes a **generated bridge** from it (the third bypassed bridge and the competing mobile color classes die). **One app shell** (`AppNavigation`) across all surfaces. A systemic **`ProviderModeBadge`** (web + Flutter) renders `mock/sandbox/live` truthfully on **every** money/fulfillment surface. The drift ratchet is retargeted to **BLOCK** new drift (it must not baseline existing drift as "passing"); stylelint is wired into CI.
- **Why permanent.** Three token sources and eight hand-rolled shells fork the brand and the tokens; a stub that reads as `success` on a money surface is a trust violation (Philosophy §3.3). One token source + one shell + a truthful badge is the only coherent, honest design language.
- **Forbids.** More than one token source. A second app shell pattern. A money/fulfillment surface without a truthful provider-mode badge. A CI ratchet that baselines existing drift as passing. Any migration that regresses accessibility.
- *Evidence: FREEZE §4/TD-1; FADR ADR-020; spine S5/S8; forensic UIUX-001…004.*

### Constitutional envelope rulings

**ART-21 — The generated `AGENTS.md` is a map, not law; it is regenerated from the Constitution.**
- **Decision.** `AGENTS.md` is a **generated artifact** — a map of the canonical topology/state derived from this Constitution and the canonical-systems registry — never a competing authority. It is regenerated; its generator is retargeted (or retired) so it can never again promote repository sprawl into canonical law. Promoting a corrected `AGENTS.md` to the operative `AGENTS.md` is a **constitutional act** reserved to the ARB (§12).
- **Why permanent.** A document produced by a repository scan encodes whatever sprawl exists as canonical law; the stale, generated `AGENTS.md` is exactly how the rejected 9-app/CQRS topology became the machine-enforced "truth."
- **Forbids.** `AGENTS.md` (or any generated document) declaring topology, architecture, or scale as law. A generator that emits a rejected-architecture topology. Hand-maintaining a parallel `AGENTS.md` that drifts from the Constitution.
- *Evidence: spine S1/S2; FADR ADR-001; forensic Q2.*

**ART-22 — The app-marketplace and developer-portal are frozen (de-deployed; the OAuth2/PKCE seam is kept).**
- **Decision.** `apps/app-marketplace` and `apps/developer-portal` are **frozen** — **de-deployed** from active topology — with the OAuth2/PKCE install-flow **seam kept** (reused for consumer-OAuth in ART-05). They are reconsidered only at **≈5,000 merchants + real developer demand** (a first-party curated catalog may precede a third-party mall).
- **Why permanent (until trigger).** A third-party app marketplace with zero merchants and zero developers is "an empty mall with no supply" — the program's #1 premature-mimicry finding. Engineering must redirect to the P0 work.
- **Forbids.** Deploying the app-marketplace or developer-portal as active topology before the named trigger. Reopening them by agent or default decision rather than human-approved constitutional act.
- *Evidence: V1 R-11; FREEZE §2; FADR ADR-022; spine S6.*

**ART-23 — Never-build (for this envelope): the Shopify-scale machinery is a seam, not a build.**
- **Decision.** The full Shopify-scale machinery is **never built for the 100→10k India envelope** — frozen as seams, or deleted where it is pure dead weight: the Wasm checkout-functions runtime (seam, ART-16); the CQRS / event-store / saga / replay / projection package cluster (deleted, gated on the ART-02 validator retarget); multi-region / failover / chaos governance (deleted validators, ART-02); headless Hydrogen (deferred seam, ART-18); the partition-shadow seam (kept, mirror disabled); full in-WhatsApp commerce (frozen, ART-16). The maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` is **formally rejected and archived.** Reopening any of these requires a **named business trigger and human approval** — never agent- or default-driven scope creep.
- **Why permanent.** Building ahead of demand is the exact error the decision rule prevents: it starves the P0 work and enlarges the attack surface for zero merchant-visible benefit. The seam — not the package — is what is worth keeping.
- **Forbids.** Building or activating any Shopify-scale capability (service fleet, CQRS/event-sourcing/saga, multi-region, sharding-now, service mesh, Wasm runtime, headless tier, cross-merchant wallet/vault, fraud-ML, full in-WhatsApp commerce) within this envelope. Keeping dead packages "just in case." Carrying a second contradictory blueprint as a "north-star."
- *Evidence: V1 §4 (R-1…R-15); FREEZE §2; FADR ADR-021/023; spine S6.*

**ART-24 — Legacy is frozen, then deleted only after the winner serves + a zero-drift proof; one thin ops console survives.**
- **Decision.** The **SAFE_DELETION taxonomy is constitutional deletion law.** Nothing is deleted until its validation gate passes: zero-importer (`SAFE_DELETE`) items go first and cheap (import → build → test → governance → rollback gates); migration-dependent (`DELETE_AFTER_MIGRATION`) items delete **only once the canonical winner is live and serving and the legacy importer count returns to zero** — no money system is deleted until the reconciliation harness proves zero drift on the path it replaces; no renderer is deleted until parity + security + perf are green per-section. Deletion happens on a branch behind the deploy meta-blocker fix (ART-03). **One thin internal ops console survives** (refund, maker-checker payout, dispute log, KYC queue); the other is folded — **which one survives is an ARB decision (UNVERIFIED, tentatively `platform-console`).**
- **Why permanent.** "Two of everything" is the maintenance tax this program exists to end; but blindly dropping load-bearing things is itself a risk (some "dead" tables have RPC/ops-script writers invisible in code). Gated, reversible deletion is the only safe path.
- **Forbids.** Deleting any system before its winner is live and a zero-drift / zero-importer proof passes. Deleting a money system without a reconciliation proof. Aggressive "clean-up now" drops. Keeping legacy indefinitely once the gate is satisfied.
- *Evidence: FADR ADR-024; spine S5; forensic LEG/DEL registers.*

---

## 10. The Never-Build List (constitutional prohibition)

The following are **constitutionally forbidden to build, activate, or design for** within the scale envelope (§6). This list is reproduced from spine S6 and is binding. Each item is a **frozen seam** (where a seam is worth keeping) or **deleted dead weight** (where it is not), reopened **only** at its named trigger under human approval — never by an agent or a default.

1. **A 22-service / microservice-per-domain fleet.** *(Reopen: a measured hot-path or team boundary forces extraction of a specific module, with ARB sign-off — never a wholesale fleet.)*
2. **CQRS / event-sourcing / saga / replay / projection engine.** *(Reopen: not in this envelope.)*
3. **Multi-region.** *(Reopen: a data-residency mandate, or 10,000+ with genuinely global merchants.)*
4. **Sharding / partitioning now.** *(Reopen: sustained table growth makes vacuum/query latency bite near ~1k–10k merchants; the partition helper seam exists, disabled.)*
5. **Service mesh.** *(Reopen: not in this envelope — there are ~5 processes, not 30.)*
6. **A self-custody payout / disbursement engine.** *(Reopen: never in this envelope — moving money in India requires a PA/PG licence; rent the split.)*
7. **A cross-merchant wallet / Shop-Pay-style vault.** *(Reopen: millions of buyers.)*
8. **A third-party app marketplace + checkout extensions + Wasm runtime.** *(Reopen: ≈5,000 merchants + inbound developer demand; keep the OAuth2/PKCE seam.)*
9. **A headless Hydrogen/Oxygen storefront tier.** *(Reopen: a revenue-bearing headless-merchant need.)*
10. **Fraud ML.** *(Reopen: 10,000+ with order history; until then use the COD-confirm heuristic + RTO gate.)*
11. **Full in-WhatsApp checkout / commerce stack.** *(Reopen: order-lifecycle + COD-confirm shipped, adopted, and the consent ledger proven.)*
12. **Any GMV / transaction fee.** *(Reopen: a business re-ratification under §14 — 0% is a strategic commitment, not a tunable.)*
13. **Filling the six reserved services** (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`). *(Reopen: a proven hot-path forces extraction of that specific capability, with ARB sign-off.)*

> **The one-line constitutional rule (spine S6 / FREEZE §2 / V1 §4):** *if a thing imitates Shopify's end-state and no beta merchant would notice its absence, it is forbidden until a named trigger fires.*

---

## 11. Decision Escalation Process

This section governs **how a decision gets made or changed**, and **who** may make it.

### 11.1 — Decision classes

- **Class A — Constitutional.** Anything that alters an Article (§9), the authority hierarchy (P.3), the scale envelope (§6), the Never-Build List (§10), a Constitutional Rule (§13), or the canonical winner of a domain. **Requires a constitutional amendment under §14 and ARB ratification (§12).** No agent, and no engineer acting alone, may decide a Class-A matter.
- **Class B — Operative.** Anything governed by `LETBUYY_AGENTS_V2.md` or the canonical-systems registry that does **not** alter §9/§10/§13 — e.g. how a canonical system is implemented, a validator's internal logic, a roadmap sequencing choice, a UNVERIFIED item's resolution. **Requires ARB review** where it touches a canonical system's contract or a go-live gate; otherwise it follows the manual's normal review.
- **Class C — Implementation.** Routine engineering inside an already-canonical system that conforms to the Constitution and the manual — e.g. writing the code for a canonical module, adding a test, fixing a bug. **An agent or engineer may decide this alone**, provided it (a) conforms to every Article and Rule, (b) does not build anything on the Never-Build List, (c) does not design past the scale envelope, and (d) passes the retargeted validator suite.

### 11.2 — What an agent MUST escalate (never decide alone)

An AI agent or an engineer acting alone **MUST NOT**, and MUST escalate to the ARB:
1. Build, activate, or design for anything on the Never-Build List (§10) or past the scale envelope (§6).
2. Introduce a second canonical system for any domain (a second ledger, renderer, auth issuer, tenant key, token signer, storefront runtime, token source, or ops console).
3. Change a permanent decision (§9) or a Constitutional Rule (§13).
4. Promote a generated document (e.g. `AGENTS.md`) to operative authority (ART-21; §12.3).
5. Reopen a frozen capability (ART-22/23) or fill a reserved service (ART-19).
6. Resolve an `UNVERIFIED` item (§14.4) by silently upgrading it to "fact" — verification is required first.
7. Deploy, delete a load-bearing system, or relax a go-live gate in violation of ART-03/ART-24.

### 11.3 — The default rule

When in doubt about the class, **treat it as the higher class and escalate.** The cost of an unnecessary escalation is a review; the cost of an agent silently making a constitutional decision is the exact failure (drift promoted to law) this Constitution exists to prevent.

---

## 12. ARB Authority

### 12.1 — What the ARB is

The **Architecture Review Board (ARB)** is the standing body that holds and exercises the constitutional power of the platform. It is the author and amender of this Constitution, the arbiter of Class-A decisions, and the only body that may declare a winner, freeze a capability, or ratify a constitutional act. The CTO sits on the ARB.

### 12.2 — ARB powers

The ARB MAY, and only the ARB may:
1. **Amend this Constitution** (§14) — add, alter, or retire an Article; change the authority hierarchy, scale envelope, Never-Build List, or Constitutional Rules.
2. **Declare or change a canonical winner** for a domain (recorded in `LETBUYY_CANONICAL_SYSTEMS.md`, subordinate to this Constitution).
3. **Freeze or reopen a capability** at its named trigger (ART-22/23) and **authorize filling a reserved service** (ART-19).
4. **Ratify the constitutional acts** of §14 — the promotion of `AGENTS_V2` to the operative `AGENTS.md`, the archival of `V1`/`FREEZE`/the maximalist plan, and the retargeting of the validator baseline.
5. **Resolve `UNVERIFIED` items** (§14.4) once verification evidence exists.
6. **Grant a time-boxed, recorded waiver** of an operative rule (never of a Constitutional Rule §13 or a Never-Build prohibition §10) where an emergency requires it, with a remediation deadline.

### 12.3 — Promotion of `AGENTS_V2` to the operative `AGENTS.md` is a constitutional act

Because the generated `AGENTS.md` is how rejected architecture became machine-enforced law, **only the ARB may promote `LETBUYY_AGENTS_V2.md` to become the operative `AGENTS.md`**, and only after confirming it conforms to this Constitution and that its generator can never again emit a rejected-architecture topology. This promotion, the retargeting of the validator baseline (ART-02), and the archival of the retired constitutions (P.2) are the constitutional acts that, together with §14.2, make this Constitution **live**.

### 12.4 — Limits on the ARB

The ARB is bound by this Constitution until it amends it under §14. The ARB MAY NOT:
- Make a Class-A change without following the amendment procedure (§14).
- Waive a Constitutional Rule (§13) or a Never-Build prohibition (§10) by fiat; those change only by amendment.
- Reopen a frozen capability or expand the scale envelope without a **named, evidenced trigger** — anticipation is not a trigger.

---

## 13. Constitutional Rules (numbered invariants)

These are the non-negotiable invariants. They are **MUST / MUST-NOT** and are **testable**; the validator suite (ART-02) enforces them. They restate, as hard rules, the load-bearing guarantees of the Articles.

**Tenancy**
- **R-1 (MUST).** Every tenant table MUST have RLS `ENABLE`+`FORCE` and a per-transaction tenant-GUC policy; an unset or wrong GUC MUST yield zero rows. *(ART-08.)*
- **R-2 (MUST-NOT).** No tenant query MUST run under a `BYPASSRLS` / blanket `service_role` connection; `service_role` is a narrow audited break-glass hatch only. *(ART-08.)*
- **R-3 (MUST-NOT).** No policy MUST be `USING(true)` to PUBLIC/anon/authenticated, and no anon write to tenant or ownership columns is permitted. *(ART-09.)*
- **R-4 (MUST).** The tenant GUC MUST be set only from a validated asymmetric claim, never from an unvalidated parameter. *(ART-05/ART-08.)*

**Money**
- **R-5 (MUST).** Money MUST be append-only double-entry with a **derived** balance; every capture/refund/COD/tender MUST post to the canonical ledger idempotently. *(ART-10.)*
- **R-6 (MUST-NOT).** No mutable balance column MUST be treated as money truth; no `UPDATE`/`DELETE` of a posted ledger entry (corrections are reversing entries); there is exactly one ledger writer. *(ART-10.)*
- **R-7 (MUST-NOT).** LetBuyy MUST NOT custody funds; money moves only via licensed PA-split; no self-custody rail. *(ART-11.)*
- **R-8 (MUST).** Money MUST be represented as `bigint` minor units (paise) on every path; never int32 money, never float money. *(ART-13.)*
- **R-9 (MUST).** `commission_bps` MUST be `0`; no GMV/transaction fee on any paid tier. *(ART-12.)*
- **R-10 (MUST).** The second factor on refund/payout MUST be real cryptography, not a forgeable check. *(ART-11.)*

**Commerce**
- **R-11 (MUST).** Orders MUST be created only via the server-authoritative checkout flow, behind a cart-bound signed handoff; inventory uses reserve-with-TTL, not pre-payment hard-decrement. *(ART-14.)*
- **R-12 (MUST-NOT).** No third-party / extension / Wasm code MUST execute in the live checkout or storefront path. *(ART-16.)*
- **R-13 (MUST-NOT).** No consent-gated message MUST be sent without a consent record; the consent gate fails closed. *(ART-07/ART-16.)*

**Identity**
- **R-14 (MUST).** `identity-platform` MUST be the sole token issuer, asymmetric sole-signer; every other service is verify-only. No shared symmetric signing secret. *(ART-05.)*

**Architecture / single source of truth**
- **R-15 (MUST).** There MUST be exactly one canonical system per domain (one ledger, one renderer-canonical, one auth issuer, one storefront runtime, one token source, one app shell, one ops console). *(ART-04/10/17/18/20/24; Philosophy §3.6.)*
- **R-16 (MUST-NOT).** No reserved service MUST be deployed or declared `production`; capabilities live in the monolith + workers; events flow through a same-transaction outbox, not an event bus. *(ART-19.)*
- **R-17 (MUST-NOT).** Nothing on the Never-Build List (§10) MUST be built, activated, or designed for; nothing MUST be designed for 100,000+/1,000,000+ merchants. *(§6, §10, ART-23.)*

**Governance / operations**
- **R-18 (MUST).** The validator suite MUST enforce this Constitution; a green gate MUST mean "conforms to the Constitution." No validator MUST certify a forbidden capability; no green build MUST coexist with a known, un-waived S0. *(ART-02.)*
- **R-19 (MUST-NOT).** No generated document MUST declare topology, architecture, or scale as law. *(ART-21.)*
- **R-20 (MUST).** Deployment MUST be from the canonical branch (the deploy meta-blocker stays fixed; the branch-lag guard stays green). *(ART-03.)*
- **R-21 (MUST-NOT).** No secret MUST be committed to the repository; live paths are gated `[HUMAN-REQUIRED]` and every external provider defaults to mock. *(V1 Principle 4; FREEZE §9.5.)*
- **R-22 (MUST).** Every money/fulfillment surface MUST carry a truthful provider-mode honesty badge; a stub MUST NEVER read as `success`. *(ART-20.)*
- **R-23 (MUST).** Every migration MUST ship a paired rollback; no load-bearing system MUST be deleted before its winner is live and a zero-drift / zero-importer proof passes; no migration MUST regress accessibility. *(ART-24/ART-20.)*

---

## 14. Amendment & Ratification

### 14.1 — How this Constitution changes

This Constitution changes **only** by **ARB amendment**:
1. A proposed amendment is written as a change to a specific Article (§9), Rule (§13), the authority hierarchy (P.3), the scale envelope (§6), or the Never-Build List (§10).
2. It MUST cite a **named, evidenced trigger** (for an envelope expansion or a frozen-capability reopen) or a **named defect** in the evidence base (for a correction). Anticipation, elegance, or "to be ready" are not valid triggers.
3. The ARB ratifies it (§12). On ratification, the amendment is recorded here with its date and rationale, and the subordinate documents (AGENTS_V2, canonical-systems, roadmaps, validators) are updated to conform.
4. Where the amendment and the evidence base disagree on a **fact**, the evidence governs the fact (P.3 item 6) and the amendment is corrected; where they disagree on **what is canonical**, the amended Constitution governs.

### 14.2 — The ratification act (what makes this Constitution live)

This Constitution becomes **live and operative** upon the ARB's ratification, which simultaneously:
1. **Promotes** this document to the apex of the authority hierarchy (P.3), above all else.
2. **Demotes and archives** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` and `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` to `docs/archive/` as historical record (their decisions now live as Articles ART-01…ART-24).
3. **Demotes** the generated `AGENTS.md` from law to a generated artifact, to be regenerated from this Constitution; and reserves the promotion of `AGENTS_V2` to the operative `AGENTS.md` to the ARB as a constitutional act (§12.3).
4. **Archives** the maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` as a rejected blueprint.
5. **Directs** the validator baseline to be retargeted to enforce this Constitution (ART-02) — the act that makes these words enforceable for the first time.

Until the ARB executes §14.2, humans and agents follow this Constitution **by directive** (P.3 already ranks it first); the archival and validator-retarget steps are the constitutional acts that complete its operativeness and are tracked as ARB ratification deliverables.

### 14.3 — Severability

If any clause of this Constitution is found void or unenforceable, the remainder stays in full force. The Articles, Rules, the Never-Build List, and the scale envelope are independently binding.

### 14.4 — `UNVERIFIED` items (preserved, never silently upgraded)

The following are carried forward from the evidence base as **UNVERIFIED**. They MUST NOT be treated as settled fact and MUST be resolved by the ARB (§12.2.5) with verification evidence before any irreversible action relies on them. *(Forensic master §"Verification note"; FADR §6; program index "Provenance & caveats".)*
- **The six anon RLS-to-PUBLIC table GRANTs** are set by Supabase's managed bootstrap, not repo SQL — confirm live state with an anon-key probe / `\dp public.orders` before final S0 sign-off (migration 107's header is strong evidence they are live).
- **Which ops console survives** (`platform-console` vs `platform-operations-portal`) is an ARB decision, not a code fact — tentatively `platform-console`.
- **Full RLS/FORCE coverage per tenant table** and the live writers of the product-dead tables need live database introspection before any DROP.
- **Live deployment state** of every "complete" wave is ~0% until the deploy meta-blocker clears — completion-% measures the working tree, not production.

---

## 15. Sign-off

> **The Architecture Review Board, sitting as the constitutional convention, ratifies the LetBuyy Constitution as SUPREME and effective 2026-06-10.**
>
> LetBuyy is **one India-only modular-monolith commerce OS** — `api-gateway` + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` over one RLS+GUC PostgreSQL on Cloudflare (ap-south) + Vercel — with **a canonical append-only double-entry ledger as the only money truth** (balance derived, bigint paise, never-custody PA-split, **0% fee permanent**, reconcile-to-zero), **`identity-platform` as the sole asymmetric token issuer** for all three realms, **layered fail-closed RLS+GUC tenancy** (the gateway off blanket `service_role`), **server-authoritative Liquid-first commerce** with a hosted checkout origin, **one storefront runtime**, **one design-system token source + app shell + honesty badge**, and **every Shopify-scale capability frozen as an empty seam** until a named trigger and human approval fire — governed by **one constitution (this document) and one validator suite that enforces it.**
>
> This Constitution **absorbs and supersedes** `V1` + `FREEZE` (now Articles ART-01…ART-24), **revokes the constitutional claims of the generated `AGENTS.md`** (a map, not law), and **rejects the maximalist 1M-merchant plan** (archived). It is the single authoritative statement of **what LetBuyy is.** Nothing overrides it. It changes only by ARB amendment at a named, evidenced trigger.

*End of the LetBuyy Constitution. Status: RATIFIED, SUPREME, 2026-06-10. Authority hierarchy position: 1 (apex). Evidence pinned at `stepup/main` @ `5cf9e64e`.*
