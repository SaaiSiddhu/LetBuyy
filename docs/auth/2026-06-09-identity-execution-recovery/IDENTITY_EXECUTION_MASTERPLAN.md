# IDENTITY EXECUTION MASTERPLAN
### Phase 3 — Execution Recovery · 2026-06-09 · ANALYSIS-ONLY · architecture FROZEN
### The single execution document. Bridges the current codebase to the frozen target.

> **Purpose.** Architecture is frozen (realms, OIDC, org, permissions, sessions, governance — `docs/auth/2026-06-08-identity-platform-transformation/` + `IDENTITY_RECOVERY_ENHANCEMENT/`). This document is the execution source of truth: what to build/fix/delete, in what order, with what gates. Companion docs: `IDENTITY_CODEBASE_DEBT_REPORT`, `IDENTITY_SECURITY_REMEDIATION_PLAN`, `IDENTITY_UI_RECOVERY_PLAN`, `IDENTITY_DESIGN_SYSTEM_ENFORCEMENT`, `IDENTITY_TECHNICAL_DEBT_REGISTER`, `IDENTITY_IMPLEMENTATION_WAVES`.

---

## 1. Current state (measured, 2026-06-09)
`apps/identity-platform` = **9,806 LOC**. It is a **login-flow orchestrator** that proxies all stateful auth to `services/api-gateway`. Real and working: password/OTP/magic/reset flows, password-set-intent, clean buyer↔merchant cookie split, ops RBAC engine, Next-16 middleware setting security headers + CSRF. **Not built:** OIDC provider (501 skeleton + mock JWKS), refresh rotation, merchant MFA/passkeys, consent, session/device/org/team UI. **Live defects:** 3 security S0s (account-takeover, console dev-secret, mock-KMS) + a 1,986-LOC shadow design system + ~640 LOC of page duplication. The **frozen target is ~70–80% scaffolded dormant** (six `*-core` packages, gateway `identity-foundation/*`, migration 159, 15 default-off flags) — switched **off**.

## 2. Target state (frozen)
One issuer (`id.letbuyy.com`), three realms (merchant/customer/admin), OIDC/OAuth2 with PKCE for 15 clients, per-realm ES256 keys + rotating JWKS, server-side revocable sessions with refresh rotation + reuse detection, ReBAC→RBAC→ABAC authorization, org/brand/team graph, hashed tokens, tamper-evident audit, passkeys + step-up MFA, consent registry, gateway as a stateless PEP that verifies Identity-signed JWTs. Identity becomes the ecosystem's single authentication authority; no app asserts identity.

## 3. Gap analysis (current → target)
| Layer | Gap | Bridge |
|---|---|---|
| Issuer/OIDC | provider absent (mock) | Wave 5 (real key service + endpoints) |
| Sessions | opaque, no rotation/idle/reuse | Wave 3 (one session service) |
| AuthZ | app-layer predicates over BYPASSRLS; dead RLS | Wave 1 guard → Wave 8 RLS layer |
| MFA/passkey/consent/recovery | absent | Waves 4/5 |
| Front end | shadow DS, 6/10 pages non-DS, 8 surfaces missing | Wave 2 + build-as-you-go |
| Keys | single-region, mock | Wave 5 (real) → Wave 8 (multi-region) |
| Secrets | shared `AUTH_SECRET`/HMAC | Wave 5 (per-realm) → Wave 8 (mTLS) |
| Governance | no CI gates | Waves 1/2 (gate stack) |

## 4. Debt summary (from the register)
- **Security debt:** 3 S0 (live), 7 S1, 8 S2, 5 S3.
- **Code debt:** 3 S0, 5 S1, 5 S2, 3 S3 — concentrated in the front end (~1,986 shadow CSS + ~640 dup) + duplicated security primitives.
- **UI debt:** 6/10 pages non-DS; 8 target surfaces missing; systemic a11y gaps.
- **Architecture debt:** OIDC/session/tenant/MFA/keys — the frozen target, scaffolded but off.
- **Removable/consolidatable LOC ≈ 3,000–3,500.** **Binding constraint = operational maturity (58/100), not code.**

## 5. Foundation strength — can Identity become the single auth authority? (Part 6)

Evaluated for: Merchant App · Storefront · Checkout · Marketplace · Theme Marketplace · Future Mobile · Future CLI.

| Axis | Score (today) | Ceiling (design) | Why the gap |
|---|:--:|:--:|---|
| **Architecture** | 80 | 90 | design is strong + standards-aligned; A-1 boundary unratified; customer-realm authz only added in enhancement |
| **Security** | **52** | 85 | 3 live S0s + BYPASSRLS + shared HMAC drag the *as-built* score far below the design |
| **Scalability** | 60 | 85 | ReBAC caching/agency-fanout/audit-volume/multi-region keys designed in enhancement but unbuilt |
| **Governance** | 46 | 85 | gates designed, none enforced yet; "172 validators" is breadth |
| **Developer Experience** | **40** | 80 | no safe OIDC local `dev-auth-bypass`/RP-SDK dev mode (readiness G-9); shared HMAC headers; duplicated primitives confuse contributors |
| **Maintainability** | 40 | 85 | ~18–20% duplication, 1,986-LOC shadow CSS, base64url ×10/timingSafeEqual ×28 |
| **FOUNDATION COMPOSITE** | **≈ 45 / 100** | **≈ 85 / 100** | *good blueprint, immature platform, 3 live criticals* |

**Verdict:** Identity **can** become the single authority — the design is sound and 70–80% scaffolded — but **today it cannot** (composite 45/100): it has live takeover paths, no real OIDC, and a half-built front end. The path to ~85 is the wave plan; the gating risk is operational, not architectural.

**Biggest weaknesses, ranked:** (1) live `/switch` account-takeover; (2) 0% of the issuer/key/session authority is live (mock only); (3) no DB tenant safety net under BYPASSRLS; (4) DX has no safe local OIDC dev path (slows the entire build); (5) the shadow design system blocks the "reference UX" mandate; (6) operational readiness 58 gates the OIDC wave regardless of code.

## 6. Execution waves (summary — detail in `IDENTITY_IMPLEMENTATION_WAVES`)
0 Emergency Security (S) · 1 Foundation Cleanup (M) · 2 Design System Recovery (M–L, parallel) · 3 Session Consolidation (M) · 4 Security Hardening (L) · 5 OIDC Foundation (L) · 6 SSO Foundation (L) · 7 Client Migration (L) · 8 Production Rollout (L).

## 7. Critical path
`Wave 0 → 1 → 3 → 4 → 5 → 6 → 7 → 8`, with Wave 2 in parallel. **Two early unblocks must start now, off the critical path:** ratify **A-1** (gates Wave 6) and provision **KMS + Hydra** (gates Wave 5). Wave 5 has a hard entry gate: Operational readiness ≥75. Realistic critical path ≈ **2–3 quarters**.

## 8. Risk register (execution)
| Risk | Sev | Mitigation |
|---|:--:|---|
| `/switch` takeover exploited before Wave 0 ships | 🔴 | ship Wave 0 first, alone; regression-gate it |
| OIDC flags enabled before real keys → unusable issuer | 🔴 | flags prod-forbidden until non-mock JWKS test passes (Wave 5 gate) |
| Cross-tenant IDOR before RLS net | 🔴 | Wave 1 query-guard; pull RLS forward |
| `.store`→`.com` + cookie cutover desync | 🟠 | jointly designed Wave 7; reconcile duplicated literal first (Wave 1) |
| Operational maturity blocks Wave 5 | 🟠 | provision Hydra/KMS/DLT/residency in parallel from day 0 |
| Shadow design system regrows | 🟠 | CI line-count + `unstyled` gates (Wave 2) |
| A-1 not ratified → Wave 6 stalls | 🟠 | force the ADR decision early |
| MFA enforced before recovery flow → lockouts | 🟠 | recovery lands Wave 4 before any MFA enforcement |

## 9. Success metrics
- **Security:** 0 S0/S1 open; every S0 has a failing-if-reintroduced CI gate; auth error rate < baseline.
- **OIDC:** 1 issuer host, 3 realms, real JWKS (0 `mock:true`); pilot client verifying tokens via JWKS with no hot-path introspection.
- **Sessions:** 100% server-revocable; remote logout ≤ one access-token TTL; refresh reuse detected + chain-revoked.
- **Authz:** check-API p99 ≤ 15ms cached, ≥95% hit-rate (`PERMISSION_ARCHITECTURE §4`).
- **Design system:** compliance ≥95%; `globals.css` ≤ ~300 LOC; 0 `unstyled` on DS components; WCAG 2.1 AA on all surfaces.
- **Tenant:** RLS second layer live; 0 `service_role` for tenant-scoped reads; 0 cross-tenant alerts in canary.
- **Operational:** readiness ≥75 before Wave 5; key-failover + audit chain-verification drilled.

## 10. Definition of Done (the frozen target, restated as acceptance)
One issuer host with three realms, each with real per-realm JWKS + discovery (no mock). Gateway has **zero** code paths trusting app-asserted identity headers; no raw access/refresh tokens in any JSON body. Every session is server-revocable; refresh rotates with reuse detection. Merchant MFA + passkeys + account-recovery + consent shipped. `users`/`users_custom` collapsed to one `principals` directory; legacy Supabase path deleted; single CSRF mechanism; per-realm asymmetric keys (shared HMAC retired). Identity UI is 100% DS-native (shadow stylesheet deleted) and is the published reference UX. Every audit finding has a CI gate preventing its return. Foundation composite ≥ 85/100.

---
*Analysis-only. No source code modified, no migrations generated, no implementation performed. Every claim references current source or a frozen design doc.*
