# IDENTITY FOUNDATION READINESS
### Phase 2 Recovery Mission · 2026-06-09 · ANALYSIS-ONLY · scored against CURRENT code

> Each score 0-100 = how close the **running code** is to serving that capability as the ecosystem authority. Evidence is current source. Composite is unweighted mean.

| Capability | Score | Evidence (current code) | What's missing for ≥80 |
|---|:--:|---|---|
| **OIDC Provider** | **6** | all `oauth2/*` routes are one-line wrappers → `oidc-disabled.ts:50-103` (404/501); JWKS is literal `mock-x-coordinate` (`:4-16`); gated off by `FEATURE_IDENTITY_PROVIDER` | real authorize/token/userinfo/consent + discovery, PKCE, real keys |
| **OAuth2** | **12** | a real PKCE authorization-code flow exists but only for **app-install** (`app-marketplace/.../install/route.ts:22-101`), not human auth; gateway issues app tokens (`auth-core:1013`) | human-auth OAuth2 grants, client registry, introspection/revocation |
| **SSO** | **25** | parent-domain cookie `lb_session` (`.letbuyy.store`) gives same-apex SSO across platform web apps (`cookies.ts:33-54`); console is a *separate* realm (`lb_console_session`); no token-based/cross-domain SSO | OIDC SSO, silent auth, cross-domain federation, RP SDK |
| **Federation** | **20** | single-use `createCustomerFederationToken` + replay store (`auth-core:806`) — customer cross-domain only; not generalized | generalized per-realm federation, redemption endpoints |
| **MFA** | **30** | ops TOTP is real (base32 HOTP, `console-auth-server.ts:98-171`); `merchant_2fa_factors` table exists as a seed; **merchant/customer MFA absent**; step-up unbuilt | merchant MFA enroll/verify + step-up + recovery flow |
| **Passkeys** | **5** | `FEATURE_PASSKEY` flag exists (`config/features.ts:14`) with **no implementation/consumers**; no WebAuthn code | WebAuthn register/authenticate, credential registry |
| **Device Trust** | **35** | `device.ts` fingerprint (UA+lang+IP-prefix SHA-256), `getOrCreateDevice`, `isDeviceTrusted`, new-device email (`login:99-104`); **weak fingerprint, no revocation UI, no trust lifecycle** | strong device binding, trust states, revocation surface |
| **Session Authority** | **30** | opaque 30-day `lb_session`, server-side row, revocable by delete (`session.ts`); **no rotation, no idle timeout, no reuse detection, no refresh**; 5 parallel session systems | one session service: rotation + reuse-detection + idle/absolute + refresh |

## Composite foundation readiness: **≈20 / 100**
Versus a world-class IdP (Auth0/Okta/WorkOS): the design is ratified and ~70-80% scaffolded **dormant**, but the *running* foundation is early. The single biggest lifts to readiness are **(1) a real key service + OIDC endpoints** (OIDC 6→), **(2) one session service with rotation/reuse** (Session 30→), and **(3) merchant MFA + passkeys + recovery** (MFA 30→, Passkeys 5→).

## Gate status vs the strict pre-OIDC rule
S0 = 0 *in code* (pending human build/security review) · design/theme compliance < 95% · foundation < 70 · operational readiness 58 (KMS/Hydra unprovisioned). → **The strict gate to begin OIDC/SSO/federation/passkeys is NOT satisfied.** Readiness work must precede those waves.
