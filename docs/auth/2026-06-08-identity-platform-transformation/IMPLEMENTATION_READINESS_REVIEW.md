# IMPLEMENTATION_READINESS_REVIEW

**Phase 16 — Final Architecture Gate**
Status date: 2026-06-08
Role: independent Staff+/Principal review across the entire Identity Platform document set (Phases 1–16). This is the gate before a multi-year implementation begins.

> **Scope reviewed.** The authoritative audit pair (`AUTH_AUDIT_REPORT.md`, `CURRENT_AUTH_ARCHITECTURE.md`) and the target set: `AUTH_SYSTEM_MAP`, `AUTHORITY_MATRIX`, `TARGET_AUTH_ARCHITECTURE`, `REALM_ARCHITECTURE`, `OIDC_DECISION_RECORD`, `OIDC_CLIENT_INVENTORY`, `SSO_ARCHITECTURE`, `SESSION_MANAGEMENT`, `TOKEN_STRATEGY`, `AUTHENTICATOR_STRATEGY`, `THREAT_MODEL`, `ZERO_TRUST_ARCHITECTURE`, `MIGRATION_PLAN`, `FOUNDATION_REFACTOR_PLAN`, and the four Phase-16 documents (`ORGANIZATION_ARCHITECTURE`, `PERMISSION_MODEL`, `IDENTITY_DATA_MODEL`, `AUDIT_LOG_ARCHITECTURE`).

> **Verdict up front.** The architecture is **strong, standards-based, and internally coherent** — design-complete enough to start the foundation (Wave 0) and additive work. But it is **not yet safe to begin the migration waves**, for four reasons that are *operational and regulatory*, not architectural: (1) the Identity Platform becomes a **platform-wide availability single point of failure** with no HA/degradation design; (2) **operational readiness** (Hydra + KMS + audit pipeline + alerting/runbooks) far outruns current ops maturity; (3) **customer-credential migration at millions-scale** is undesigned; (4) **India SMS-OTP (DLT) + DPDP data-residency** are undesigned yet sit on the customer realm's primary auth path. These are the gate-blockers.

---

## 1. Cross-document consistency analysis

### 1.1 Contradictions found

| ID | Contradiction | Where | Resolution |
|----|---------------|-------|-----------|
| **A-1** | **Authorization boundary moved.** `TARGET_AUTH_ARCHITECTURE` §4 and `AUTHORITY_MATRIX` #18 say store-membership *data* and authorization "stay in Commerce." `ORGANIZATION_ARCHITECTURE`/`PERMISSION_MODEL` move the **membership/relationship graph to Identity** (ReBAC). | Phase 3/4 vs Phase 16 | **Restate the principle:** *Identity owns connection/relationship authorization (ReBAC: who is related to what). Commerce owns capability/entitlement authorization (RBAC role→permission + plan/ABAC).* This is a deliberate, signed-off evolution — not "commerce owns all authz." Update the mental model org-wide. **Requires explicit human sign-off.** |
| **P-1** | **Dual staff role model.** `employees.role` (enum) **and** `employees.role_id` (FK) **and** `employees.permissions` (jsonb) all exist. | schema vs `PERMISSION_MODEL` §5.4 | Retire `employees.role` as an authz source; `employee_roles`/`employee_permissions` become the single staff catalog; `role` becomes a display label. |
| **A-2** | **ID naming duality** `site_id` (canonical) vs `store_id` (public alias) persists, now under `org_id`. | audit vs Org Arch | Accepted: keep both, introduce `org_id` above. Document the three-level identifier model to prevent confusion; do **not** rename `site_id` (XL risk, no benefit). |
| **D-1** | **Three MFA stores.** `merchant_2fa_factors`, `super_admin_allowlist.two_factor_secret`, console-env TOTP. | schema vs `IDENTITY_DATA_MODEL` §3 | Consolidate into one `authenticators` table; migrate all three; high lockout risk → dual-run + verify. |

### 1.2 Consistency confirmed (no contradiction)
- Realm isolation (Phase 4) is consistently applied across SSO, session, token, permission, and audit docs (cookie names, audiences, `acr` levels all align).
- Token claims (`TOKEN_STRATEGY`) ↔ permission claims (`PERMISSION_MODEL` §10) ↔ org claims (`ORGANIZATION_ARCHITECTURE` §11) are mutually consistent on `sub/realm/org/roles/sites/amr/acr/sid` and the **bounded-claims** rule.
- Impersonation is consistent across `REALM_ARCHITECTURE` §6, `PERMISSION_MODEL` §9, and `AUDIT_LOG_ARCHITECTURE` (on_behalf_of/acting_via).
- The "claims are a cache, commerce re-checks on sensitive ops" rule is uniform (Phase 3/8/9/16).

---

## 2. Missing concepts (designed nowhere yet)

| ID | Missing concept | Why it matters | Severity |
|----|-----------------|----------------|:--------:|
| **G-1** | **IdP high-availability + graceful degradation + DR.** The Identity Platform becomes the hard dependency of *every* login and (via JWKS) every request. No HA topology, failover, JWKS-cache offline window, or "IdP down" degradation is designed. | A single IdP outage = total platform auth outage. | Critical |
| **G-2** | **Customer credential migration at millions-scale.** No hash-format compatibility / rehash-on-login / bulk-import plan for `customer_credentials` + `users_custom`. | Blocks customer-realm cutover (W5); risk of mass lockout. | Critical |
| **G-3** | **India regulatory: SMS-OTP DLT + DPDP data residency.** OTP/magic-link is the customer realm's primary auth; India mandates DLT-registered SMS templates and the DPDP Act 2023 constrains residency. Undesigned. | Customer auth can't legally/operationally ship in-region without it. | Critical |
| **G-4** | **Key management operations.** `TOKEN_STRATEGY` names per-realm asymmetric keys + JWKS + rotation, but no KMS/HSM choice, rotation runbook, compromise procedure, or audit-anchor signing key ops. | Keys are the new trust root; weak ops = systemic risk. | High |
| **G-5** | **ReBAC check-API scale + cache/invalidation.** The hot-path relationship check (Org Arch §11) lacks a concrete caching/invalidation/QPS design; Zanzibar-style materialization is "deferred" without a trigger threshold. | Latency/DoS on hot path, or stale-permission security gap. | High |
| **G-6** | **Account recovery flows.** Merchant-without-email recovery, admin recovery (operationally controlled), and lockout policy are named but not designed. | Recovery is the #1 account-takeover vector and support-cost driver. | High |
| **G-7** | **Bot/credential-stuffing defense at customer scale.** Beyond Turnstile, no rate-limit/lockout/velocity design for millions of shopper logins. | Customer realm is the highest-volume attack surface. | Medium |
| **G-8** | **Consent UX + legal record** for 3rd-party apps (modeled in data, not designed as a flow). | Required before marketplace OAuth cutover (W4). | Medium |
| **G-9** | **Local dev / `dev-auth-bypass` under OIDC.** The audit shows an identity/console dev-auth-bypass; OIDC local dev is harder and must preserve a *safe* bypass. | DX regression slows the whole program. | Medium |
| **G-10** | **IdP observability/SLOs.** No SLO/error-budget/alerting design for the component now on every critical path. | Can't operate what you can't see. | Medium |
| **G-11** | **Audit volume budget + sampling.** Emitting session/token/auth events for every request into one ledger could be enormous; sampling is mentioned, not budgeted. | Audit pipeline becomes its own scaling problem. | Medium |
| **G-12** | **SCIM / enterprise provisioning** (deferred per OIDC decision). | Needed for enterprise-merchant model eventually. | Low |

---

## 3. Risk findings (Critical / High / Medium / Low)

### CRITICAL
- **C-1 (G-1) IdP single point of failure.** *Before* migration waves, design: provider-HA Hydra + identity service in the approved India region, replicated session/key stores within that residency boundary, JWKS caching with a defined offline-validation window (so the gateway tolerates a brief IdP outage by trusting cached JWKS + not-yet-expired tokens), and a documented degradation mode (read-only/limited auth). Without this, the transformation *increases* availability risk versus today's distributed cookie model.
- **C-2 Operational readiness vs. ambition.** The target stands up ORY Hydra, KMS/HSM, an async audit pipeline, a search index, WORM storage, and production alerting/runbooks. Project memory and the audit describe current maturity as low ("governance theater," ~2/5). **Gate condition:** an explicit Ops plan (on-call, runbooks, DR drills, key-rotation drills, capacity) must exist before Wave 1, or the program ships fragile.
- **C-3 (G-2) Customer credential migration.** Design hash-compatibility (verify legacy hash on login, transparently rehash to Argon2id), bulk import, and a dual-run before W5. Mass lockout of shoppers is an existential, conversion-killing event.
- **C-4 (G-3) India SMS-OTP DLT + DPDP residency.** Design DLT-registered template flows, an SMS/email provider strategy with deliverability, and in-region data residency for customer identity *before* any OTP/magic-link-dependent customer flow ships.

### HIGH
- **H-1 (A-1) Authorization-boundary sign-off.** The membership-graph-to-Identity move must be explicitly ratified and the principle restated; otherwise teams will build to two contradictory mental models.
- **H-2 (G-5) ReBAC scale.** Define cache + invalidation (membership-change events), a check-API latency SLO, and a concrete threshold at which a materialized reverse-index (Zanzibar-style) is built.
- **H-3 (G-4) Key ops.** Choose KMS/HSM; write rotation + compromise runbooks; define the audit-anchor signing key and its custody.
- **H-4 (A-3) Org backfill correctness.** Resolve the `users`/`users_custom` dual-store ambiguity and null/legacy store owners *before* org backfill, with a reconciliation + dry-run, or orphan/incorrect orgs result.
- **H-5 (G-6) Recovery flows.** Design merchant/admin recovery + lockout before MFA enforcement (W3/W8), or MFA enforcement creates a lockout/support crisis.

### MEDIUM
- **M-1 (D-1/P-1) Consolidation lockout risk.** Three-MFA-store and staff-role consolidations must dual-run with verification.
- **M-2 (D-2) `last_active` write hotspot.** Replace per-request session-row updates with write-behind/throttled updates before scale.
- **M-3 (G-9) Dev experience.** Preserve a safe OIDC local-dev bypass; ship an RP-SDK dev mode early (Foundation Wave 0) so app teams aren't blocked.
- **M-4 Permission-catalog governance.** Define who may register permissions/roles to prevent scope sprawl; version the catalog.
- **M-5 (G-8) Consent flow.** Design the consent screen + grant lifecycle before W4.
- **M-6 (G-11) Audit volume budget.** Set fidelity tiers (full for sensitive/failures, sampled for high-volume successes) with a storage budget.

### LOW
- **L-1 Enum drift.** Reconcile `app_installations` (active/paused/uninstalled) vs `site_api_clients` (active/paused/revoked) → canonical set.
- **L-2 ID duality** (`site_id`/`store_id`) — accepted; document to reduce confusion.
- **L-3 SCIM** deferred — acceptable.
- **L-4 Remote JWKS latency** — minor with caching; note in ops.

---

## 4. Maturity scores (0–100)

| Dimension | Score | Rationale |
|-----------|:-----:|-----------|
| **Architecture Maturity** | **88** | Comprehensive, standards-based, internally coherent; one reconciled boundary change (A-1). The four named gaps (org/permission/data/audit) are now filled to implementation depth. Loses points for A-1 needing ratification and a few undesigned flows (recovery, consent UX). |
| **Security Maturity** | **82** | Design closes the audit's worst risks (domain-wide cookie, app-asserted identity, plaintext tokens) and adds tamper-evident audit, realm isolation, step-up, zero-trust. Held back by IdP-SPOF (a security/availability risk), key-ops gaps, undesigned recovery (takeover vector), and residual legacy during dual-run. |
| **Scalability Maturity** | **74** | Bounded claims, partitioning, ULID sharding, and async audit are sound. Unproven: ReBAC check QPS, audit volume, `last_active` hotspot, and large-org/agency fan-out. Designed for scale but not yet validated for it. |
| **Operational Readiness** | **58** | The binding constraint. New runtime surface (Hydra, KMS/HSM, audit pipeline, WORM, search, mesh) vs. low current ops maturity; HA/DR, on-call, runbooks, and key-rotation drills undesigned. This is where the program is least ready. |
| **Implementation Readiness** | **72** | Most "design before coding" items are now defined; foundation + additive work can start. Blocked from the *migration waves* by C-1…C-4 and H-1…H-5. |

```mermaid
flowchart LR
  A["Architecture 88"]:::g --- S["Security 82"]:::g --- SC["Scalability 74"]:::y --- O["Operational 58"]:::r --- I["Implementation 72"]:::y
  classDef g fill:#d7f5d7,stroke:#3a3;
  classDef y fill:#fdf6c8,stroke:#cc3;
  classDef r fill:#fad7d7,stroke:#c33;
```

**Composite gate read:** the *design* is ~A-/B+; the *readiness to migrate* is gated by operations and four critical pre-designs. Operational Readiness (58) is the number to move.

---

## 5. What must be designed before coding begins

These are hard gate items — do not start the migration waves without them:

1. **IdP HA / DR / graceful-degradation design** (C-1) — topology, JWKS offline-validation window, "IdP down" mode, RTO/RPO.
2. **Operations plan** (C-2) — Hydra + KMS + audit-pipeline runbooks, on-call, capacity, rotation/break-glass drills, staging identity env.
3. **Customer credential migration design** (C-3) — verify-legacy-then-rehash, bulk import, dual-run, rollback.
4. **India SMS-OTP DLT + DPDP residency design** (C-4) — provider, DLT templates, deliverability, in-region storage.
5. **Authorization-boundary ratification + restated principle** (H-1) — Identity = relationship authz, Commerce = capability/entitlement authz.
6. **Key-management lifecycle** (H-3) — KMS/HSM, rotation, compromise, audit-anchor key.
7. **ReBAC scale design** (H-2) — cache/invalidation, SLO, materialization threshold.
8. **Org backfill reconciliation** (H-4) — resolve `users`/`users_custom` + null owners with a dry-run.
9. **Account recovery + lockout flows** (H-5) — before MFA enforcement.

## 6. What can be implemented immediately (low-risk, high-leverage, no migration dependency)

These are the Foundation/Wave-0 quick wins; they de-risk everything and don't touch the critical path:

1. **Hash `verification_tokens` at rest** + stop returning raw tokens in JSON (closes the worst data-at-rest finding; backward-compatible).
2. **Remove legacy `lb_csrf`** acceptance + unify `letbuyy_csrf` attributes.
3. **`@auth-core` decomposition** (RP-SDK, CookiePolicy, KeyService, SessionService interfaces) + `@auth-core/legacy` quarantine — pure refactor, zero behavior change (Foundation Wave 0).
4. **Gateway verifier-registry refactor** (same branches, new shape) — enables additive IdP-token branch later.
5. **`@audit-core` SDK + canonical `audit_events` schema** + dual-write shim over `audit_logs`/`audit_activity_events` (consolidation can begin immediately; it's additive).
6. **Permission catalog registry + naming convention + legacy alias table** (additive vocabulary work).
7. **Stand up ORY Hydra in staging** + per-realm key/JWKS skeleton (no production traffic).
8. **Parity harness + legacy-path counters** (prerequisite for every later cutover).

## 7. What should be deferred to later phases

1. **Service mesh / mTLS workload identity** (Zero-Trust L3) — large infra program; deferred to Wave 8 after token-based identity is proven.
2. **Merchant org model rollout** — design now, but *enable* after the merchant realm (W2) is stable; `org` claim stays null until then.
3. **ReBAC materialized reverse-index** (Zanzibar-style) — build only when check QPS crosses the defined threshold; cache-first until then.
4. **SCIM / enterprise B2B SSO (WorkOS)** — defer to first real enterprise-merchant demand.
5. **Marketplace vendor sub-orgs + franchise parent-org hierarchy** — additive; ship after core org model.
6. **Passwordless-first / advanced risk-adaptive auth** — after baseline MFA + step-up are enforced.
7. **External notarization of the audit chain** (transparency log) — after the internal hash-chain + WORM baseline is live.

---

## 8. Gate decision

**CONDITIONAL PASS.** The architecture is approved to proceed into **Foundation (Wave 0) and additive/quick-win work immediately** (§6). The **migration waves (W1+) are gated** on completing the nine "design before coding" items (§5), with **Operational Readiness (the 58) as the binding constraint** — specifically the IdP HA/DR design (C-1) and the Ops plan (C-2). Re-review at the close of Wave 0, scoring Operational Readiness ≥ 75 and Implementation Readiness ≥ 85 as the bar to begin Wave 1.

> **One-line gate summary:** *Excellent architecture; the risk is no longer "what to build" but "can this team operate it reliably and migrate millions of users in-region without lockout." Design the four operational/regulatory blockers, then go.*

Cross-references: every finding ties to a source doc cited inline; boundary change A-1 ↔ `ORGANIZATION_ARCHITECTURE` §intro + `PERMISSION_MODEL` §1; migration guardrails ↔ `MIGRATION_PLAN`; foundation items ↔ `FOUNDATION_REFACTOR_PLAN`.
