# LetBuyy Identity Platform — Transformation Architecture

**A principal-level, evidence-anchored target architecture for the LetBuyy authentication ecosystem.**
Date: 2026-06-08 · Status: **Proposed (architecture only — no code changes)** · Posture: north-star end-state + bridged migration from today's actual implementation.

> **Authoritative inputs.** This set is derived strictly from the audit pair in
> `docs/auth/2026-06-08-auth-session-sso-cookie-architecture/` —
> `AUTH_AUDIT_REPORT.md` and `CURRENT_AUTH_ARCHITECTURE.md` — plus directly-read repository code
> (cited inline). No undocumented behavior is assumed; gaps are carried forward as explicit UNKNOWNs.

---

## The thesis in one line

> Today the component named **"Identity Platform" is a UI shell** while the **API Gateway is the real authority**, and apps **assert** user identity over one **shared HMAC secret**. The transformation **inverts ownership** into a single **Identity Platform service** that *issues* verifiable tokens, across **three isolated realms** (merchant / customer / admin), on **ORY Hydra** OIDC — consolidating existing primitives rather than rebuilding.

## The two risks this exists to kill

1. **Domain-wide `lb_session`** on `.letbuyy.store` (`SameSite=lax`, shared by every subdomain) — 🔴 20 → 🟢 3.
2. **App-asserted identity** (`X-LetBuyy-Internal-User-ID/...`) trusted via one shared secret — any secret-holder can impersonate anyone — 🔴 20 → 🟡 10.

---

## Read in this order

| # | Document | What it answers |
|---|----------|-----------------|
| — | **`LETBUYY_IDENTITY_TRANSFORMATION_BLUEPRINT.md`** | **Start here.** Master source of truth; everything below, condensed. |
| 1 | `AUTH_SYSTEM_MAP.md` | What exists today — surfaces, stores, trust boundaries, ownership |
| 2 | `AUTHORITY_MATRIX.md` | Who owns each capability now vs. target; difficulty & risk |
| 3 | `TARGET_AUTH_ARCHITECTURE.md` | The Identity Platform as the single authority |
| 4 | `REALM_ARCHITECTURE.md` | Merchant / customer / admin realm isolation |
| 5 | `OIDC_DECISION_RECORD.md` | Provider scoring → recommendation (ORY Hydra hybrid) |
| 6 | `OIDC_CLIENT_INVENTORY.md` | Every client: type, redirect URIs, scopes, claims, refresh |
| 7 | `SSO_ARCHITECTURE.md` | Log-in-once flows, token exchange, logout propagation |
| 8 | `SESSION_MANAGEMENT.md` | Sessions, rotation, revocation, cookie ownership matrix |
| 9 | `TOKEN_STRATEGY.md` | Every token: issuer / audience / claims / algorithm / expiry |
| 10 | `AUTHENTICATOR_STRATEGY.md` | TOTP, passkeys, recovery, device trust per realm |
| 11 | `THREAT_MODEL.md` | Scored threats + mitigations (current vs. target) |
| 12 | `ZERO_TRUST_ARCHITECTURE.md` | Trust assumptions → zero-trust redesign |
| 13 | `MIGRATION_PLAN.md` | Waves 0–8: goals, deps, risks, rollback, success |
| 14 | `FOUNDATION_REFACTOR_PLAN.md` | Seams to refactor *before* migration |
| 15 | `LETBUYY_IDENTITY_TRANSFORMATION_BLUEPRINT.md` | The master blueprint |

### Phase 16 — Domain modeling & implementation-readiness gate

| # | Document | What it answers |
|---|----------|-----------------|
| 16 | `ORGANIZATION_ARCHITECTURE.md` | Org / Store / Team / Membership hierarchy; lifecycle (transfer/merge/split/suspend/delete); 7 business models; `org_id`/`team_id`/`membership_id` as first-class |
| 17 | `PERMISSION_MODEL.md` | RBAC + ABAC + ReBAC split; permission/role/scope/resource catalogs; `resource.action` naming; delegation, temporary access, impersonation; step-up map |
| 18 | `IDENTITY_DATA_MODEL.md` | Canonical Identity DB: every entity, key, index, retention; soft/hard/GDPR (crypto-shred) delete; reuse/replace/deprecate mapping from existing tables |
| 19 | `AUDIT_LOG_ARCHITECTURE.md` | Event taxonomy + schema; hash-chained + WORM tamper resistance; ingestion/query; SOC2/ISO27001/GDPR; consolidates the fragmented `audit_logs`/`audit_activity_events` |
| 20 | **`IMPLEMENTATION_READINESS_REVIEW.md`** | **The gate.** Contradictions, gaps, risk findings (Critical→Low), 5 maturity scores, "design before coding / build now / defer." |

### Phase 17 — Pre-implementation operational, key, migration & compliance designs (closes the four critical gate-blockers)

| # | Document | What it answers |
|---|----------|-----------------|
| 21 | `IDENTITY_OPERATIONS_ARCHITECTURE.md` | HA, DR, degradation, SLOs, on-call. **Finding:** Hydra breaks the all-serverless (Vercel + Cloudflare Workers) estate → run it as a managed container in `ap-south-1`; verification path (cached JWKS) made independent of issuance so an IdP outage doesn't log users out. Closes C-1/C-2. |
| 22 | `KEY_MANAGEMENT_ARCHITECTURE.md` | Per-realm asymmetric keys in KMS/HSM, JWKS rotation, compromise runbook. **Correction:** HSM custody ⇒ **ES256** (KMS can't HSM-sign Ed25519). Retires the shared HMAC secret + shared admin TOTP. Closes G-4/H-3. |
| 23 | `CUSTOMER_MIGRATION_ARCHITECTURE.md` | Millions-scale **bcrypt(10/12)→Argon2id** via eager peppered layer-at-rest + lazy rehash-on-login; store-scoped customer backfill; zero lockout / zero mass-logout. Closes C-3/G-2. |
| 24 | `COMPLIANCE_ARCHITECTURE.md` | DPDP 2023 + GDPR + SOC 2; **WhatsApp+email OTP primary, DLT-SMS fallback** (India); residency `ap-south-1`; fiduciary/processor split; children's-data + Resend-US flags. Closes C-4/G-3. |
| 25 | **`IDENTITY_IMPLEMENTATION_MASTER_PLAN.md`** | **The execution source of truth.** Wave-by-wave (0–8) with entry/exit gates, rollback, owners, metrics; Wave 0 = the four critical pre-designs; dependency graph; readiness re-scoring targets; decision log. |

---

## Target at a glance

- **One issuer** `id.letbuyy.com`, **three realms**, each with its own JWKS + discovery + host-only cookie.
- **ORY Hydra** (certified OIDC/OAuth2 provider) fronted by LetBuyy's own login/consent app over **owned** stores; federate external IdPs for admin + enterprise-merchant SSO; WorkOS optional for the B2B-SSO slice only.
- **Verifiable, not asserted, identity:** downstream verifies IdP-signed (EdDSA) tokens via JWKS; the gateway becomes a stateless **policy enforcement point**; the shared HMAC secret is retired in favor of mTLS workload identity.
- **Sessions** are server-side and revocable: short access (5–10 min) + rotating refresh (reuse-detection) + revocable `sid`; **single logout** estate-wide within one TTL.
- **SSO** via OIDC `prompt=none` against a central IdP session — *no app shares a cookie with another*.
- **MFA enforced** (merchant sensitive ops; admin aal3) reusing the existing `merchant_2fa_factors` (TOTP + passkey) storage.
- **Migration** is wave-based, dual-run, flag-gated, reversible; *ownership of the decision moves before ownership of the data*.

## Gate status (Phase 16 → Phase 17)

**CONDITIONAL PASS — the four critical blockers are now designed (Phase 17).** The migration waves remain gated on **Wave 0**: provisioning + drilling those designs (Hydra in-region, KMS/JWKS, credential migration dry-run, OTP/DLT/residency) and the foundation seams, which must move **Operational Readiness 58 → ≥75** and Implementation Readiness 72 → ≥85 before Wave 1. Phase-16 maturity: Architecture 88 · Security 82 · Scalability 74 · **Operational 58 (binding constraint)** · Implementation 72 → Wave-0 targets in `IDENTITY_IMPLEMENTATION_MASTER_PLAN.md` §5. Still requires human sign-off on the decision log (master plan §6): Hydra A/B, ES256-vs-EdDSA, authz boundary (A-1), fiduciary/processor, children's data, OTP channels, Supabase region.

## Decisions awaiting human sign-off

ORY Kratos now vs. later · WorkOS now vs. defer · merchant-org timing · checkout login requirement · Hydra deployment target + KMS/India residency · access-token TTL vs. introspection-cost tuning · **authorization-boundary change (membership graph → Identity; Finding A-1)**. (Detail in the blueprint §14 and the readiness review §1/§5.)

---

*Diagrams are Mermaid; render in any Mermaid-aware Markdown viewer. Every non-UNKNOWN claim cites an audit section or a repository path.*
