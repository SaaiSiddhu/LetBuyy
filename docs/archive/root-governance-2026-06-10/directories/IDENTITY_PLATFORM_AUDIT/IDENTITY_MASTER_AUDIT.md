# IDENTITY MASTER AUDIT — EXECUTIVE VERDICT
### Phase 14 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY
### Scope: full ecosystem auth surface · Method: independent re-derivation from source · No code modified

---

## Executive summary

The LetBuyy Identity Platform is a **competent Next.js auth orchestrator wrapped around a gateway**, with several genuinely well-built parts — clean buyer/merchant cookie separation, a real ops RBAC engine, single-use email tokens, a strong password-set-intent flow, an enforced (if half-adopted) design system, and correct pre-paint theming. It is **not, today, capable of being the single source of truth** for the ecosystem, for three independent reasons:

1. **A critical, unauthenticated account-takeover bug** (`/api/auth/switch` mints a session for any verified email — Phase 6 C-1) means the current system cannot be trusted as a root of trust until fixed.
2. **The authority layer the mission depends on does not exist as running code** — OIDC is a 501 skeleton with a literal-string JWKS (Phase 2), refresh/rotation/revocation are interface-only stubs (Phase 3), and the "v2 identity foundation" is dead scaffolding with zero runtime callers.
3. **There is no single identity** — seven concurrent auth systems share `AUTH_SECRET`-derived secrets, tenant isolation rides on a `service_role`/BYPASSRLS connection with a dead RLS net, and there is no default-deny enforcement anywhere in the identity app.

The good news: this is **not a greenfield-rewrite situation**. The shell, the flows, the UI, and the design system are salvageable. What must be *built* (not merely fixed) is the **authority layer** — a real OIDC provider, key service, and unified session service — and what must be *fixed* is a short list of S0/S1 security defects and the seven-system fragmentation. That is a focused **~2–3 quarter rebuild of the core**, not a restart.

---

## Scorecard (0–100)

| Dimension | Score | One-line basis |
|---|:--:|---|
| **Architecture** | **28** | 7 fragmented auth systems, dead v2 foundation, no SSOT, no middleware (Phase 1) |
| **Security** | **22** | 3× S0 (switch ATO, console dev-secret, mock KMS) + BYPASSRLS + shared super-admin (Phase 6) |
| **OIDC Readiness** | **6** | 501 skeleton, mock JWKS, 0/16 capabilities (Phase 2) |
| **Session Governance** | **30** | opaque 30-day, no rotation/idle/reuse; 5 impls + dead v2 (Phase 3) |
| **Cookie Governance** | **46** | sane attributes + real realm split, undercut by dev-key/domain-drift/PII (Phase 4) |
| **Tenant Isolation** | **34** | works via app-layer only; dead RLS; one missing check = IDOR (Phase 7) |
| **UI/UX Governance** | **56** | mature DS half-adopted; a11y gaps on legacy pages (Phase 8) |
| **Design System Compliance** | **50** | infra ~80 / adoption ~45; `unstyled` bypass + shadow stylesheet (Phase 9) |
| **Theme Governance** | **62** | real theming, ~16 hand-maintained color escapes + 1 broken token (Phase 11) |
| **Code Quality** | **45** | ~18-20% duplication, crypto-primitive sprawl (Phase 10) |
| **Maintainability** | **40** | 7 systems, 6-way bypass fork, 9× page boilerplate (Phase 10) |
| **SSO Readiness** | **26** | cookie-SSO works for same-apex web; no OIDC for everything else (Phase 12) |
| **Composite (SSOT-weighted)** | **≈30** | weighted to security/identity/OIDC/session/tenant |

---

## Top issues (genuine, evidence-backed — not padded to a quota)

> Honesty note: there are **3 genuine CRITICALs**, not 25. Inflating the Critical band would violate the evidence-only mandate. High/Medium/Low are listed in ranked order; counts are stated.

### CRITICAL (3)
1. **Account takeover via `/api/auth/switch`** — session minted for any verified email, no possession proof, CSRF-only, no rate-limit/Turnstile. `switch/route.ts:22,52,61-64`. (Phase 6 C-1)
2. **Forgeable ops super-admin session** — `dev-only-console-session-secret` fallback under `NODE_ENV`-only gate. `platform-console/src/lib/console-session.ts:23-31`. (C-2)
3. **Default mock KMS** — data-at-rest wrapped with checked-in literal; live KMS unimplemented. `api-gateway/src/lib/crypto.ts:144-158,180`. (C-3)

### HIGH (16, ranked)
H1 BYPASSRLS default + dead RLS net (`supabase-adapter/index.ts:34-39`) · H2 static shared-token super-admin (`middleware/auth.ts:217-231`) · H3 forgeable `lb_accounts` dev-key (`cookies.ts:11-19`) · H4 `AUTH_SECRET` reuse across 3 domains · H5 mock OIDC/JWKS one flag from real RPs (`oidc-disabled.ts:4-16`) · H6 gateway Turnstile bypass needs no flag (`security.ts:199-205`) · H7 cookie-domain `.store` vs `.com` cutover break (`cookies.ts:53-54`) · H8 OIDC provider absent (0/16) · H9 no refresh/rotation/revocation (interface-only, `session-core`) · H10 no merchant MFA · H11 7 fragmented auth systems · H12 dead v2 identity foundation · H13 no default-deny middleware (`find` → none) · H14 opaque 30-day session, no idle timeout · H15 merchant RBAC owner-or-nothing (`permission.ts` is plan-gating) · H16 two Turnstile validators / 6-way dev-bypass fork (Phase 10 C1/C6).

### MEDIUM (≈18, ranked)
M1 user-enumeration `/lookup` · M2 `lb_accounts` signed-not-encrypted PII 365d · M3 non-constant-time CSRF compare · M4 magic-link token-in-URL (GET) · M5 `/switch` no rate-limit/Turnstile · M6 login rate-limit IP-only · M7 Supabase legacy auto-confirm + client role · M8 in-memory auth fallback maps · M9 1,490–1,600 dup LOC · M10 login≈lookup 282-line clone · M11 base64url×10 / timingSafeEqual×28 · M12 `unstyled` bypass + shadow stylesheet · M13 parallel token namespace (424 px, 77 font-sizes) · M14 9 silent error blocks (no aria-live) · M15 removed focus rings · M16 `--purple` undefined (broken color) · M17 org isolation undefined (org-core stub) · M18 clickjacking headers absent.

### LOW (≈10, ranked)
L1 dual CSRF cookie names · L2 no `__Host-`/`__Secure-` prefixes · L3 device cookie no revocation UI · L4 weak password policy (8/1/1) · L5 unlabelled OTP grid · L6 dead Terms/Privacy `href="#"` · L7 orphan `.auth-label`/`.auth-input` classes · L8 3 design lint rules only `warn` · L9 hand-coded `.dark` block + magic bg · L10 server-derived redirects (low open-redirect, dup validation).

---

## Risk horizon

**Immediate (now):** C-1 account takeover is live and trivially exploitable; the three checked-in secret literals (C-2/C-3/H3) are forgeable on any env misconfig; `/lookup` enables enumeration. **These are not "someday" risks.**

**6-month:** as routes proliferate over BYPASSRLS with no RLS net (H1), the probability of a cross-tenant IDOR approaches certainty; the `.letbuyy.store`→`.letbuyy.com` cutover (H7) will break SSO/logout unless the duplicated domain literals are reconciled; pressure to "turn on" the mock OIDC/JWKS (H5) for a partner integration risks publishing an unusable issuer.

**12-month:** the seven-system fragmentation + dead v2 foundation calcifies into a maintenance tax that makes the OIDC build progressively harder; secret-reuse (H4) means a single leak is an ecosystem-wide event; the duplication (M9–M11) guarantees security-primitive drift between the two Turnstile validators and six bypass gates.

---

## Verdict

**Rewrite required?** — **No full rewrite. Yes to a targeted rebuild of the authority layer.** The OIDC provider, key/JWKS service, unified session service, and consent ledger must be *built* (they are absent or dead). The shell, flows, UI, design system, and the gateway's RBAC/HMAC machinery are *salvageable*. Pair that build with the S0/S1 fixes and a collapse of the seven-system sprawl.

**Can Identity become LetBuyy's single source of truth?** — **Not today. Conditionally yes** — achievable in roughly **2–3 focused quarters** if, and only if: (1) C-1/C-2/C-3 are fixed and the three secret literals removed; (2) a real OIDC provider + rotating JWKS + client registry are built (Phase 2 §5); (3) one session service with refresh rotation/reuse/revocation replaces the five realms + dead stubs; (4) a default-deny middleware and a database-level tenant safety net are added; (5) the auth-runtime duplicates are de-forked into one shared module. Absent (1)–(2) it **cannot** be the root of trust.

**Confidence in this assessment:** **82 / 100.** Identity-platform findings are first-hand from source read during this audit; ecosystem findings (gateway/console/packages/mobile) are corroborated across an independent evidence sweep and the load-bearing S0/S1 claims were spot-verified against source. Residual uncertainty is runtime/deployment posture (env-var configuration, edge-set headers) that cannot be confirmed from code alone.

---

### Report index
`IDENTITY_ARCHITECTURE_FORENSICS.md` (P1) · `OIDC_READINESS_REPORT.md` (P2) · `SESSION_FORENSICS_REPORT.md` (P3) · `COOKIE_GOVERNANCE_REPORT.md` (P4) · `TURNSTILE_FORENSICS_REPORT.md` (P5) · `SECURITY_FORENSICS_REPORT.md` (P6) · `TENANT_ISOLATION_REPORT.md` (P7) · `UI_UX_GOVERNANCE_REPORT.md` (P8) · `DESIGN_SYSTEM_COMPLIANCE_REPORT.md` (P9) · `DUPLICATION_FORENSICS_REPORT.md` (P10) · `THEME_FORENSICS_REPORT.md` (P11) · `SSO_READINESS_REPORT.md` (P12) · `ARCHITECTURAL_DEBT_REGISTER.md` (P13) · this file (P14).
