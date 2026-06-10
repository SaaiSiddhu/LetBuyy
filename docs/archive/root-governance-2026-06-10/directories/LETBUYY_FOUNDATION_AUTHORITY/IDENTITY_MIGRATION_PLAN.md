# IDENTITY_MIGRATION_PLAN (final authority)

> **Status:** FINAL. Supersedes `docs/auth/2026-06-08-…/MIGRATION_PLAN.md`. Phased Wave 0–8 to reach `TARGET_AUTH_ARCHITECTURE.md`. **Each wave dual-runs old+new, cuts over per app, removes legacy last.**

## GATE 0 — precondition (NOT part of identity migration)
**The money-truth and tenant-isolation P0s (`LETBUYY_FOUNDATION_EXECUTION_MASTER_PLAN` WS-1, WS-2) must be done before Wave 1.** Identity work does not move the acquisition needle while money can be double-released and tenants can leak. The **only** identity items pulled *ahead* of that gate are in Wave 0 (secret isolation + perimeter lock), because the shared secret is also a money-authorization secret.

## Wave 0 — Preparation *(P0 security subset — do now, alongside the money/tenancy gate)*
- **Objectives:** inventory OIDC clients + every cookie/secret consumer (`OIDC_CLIENT_INVENTORY` exists); stand up a dual-read/verify harness; **isolate + rotate the internal trust secret** so `INTERNAL_API_SECRET` is distinct from `AUTH_SECRET`/cookie/OAuth/TOTP and from money-header signing (`auth-core:447`); **lock the gateway perimeter** (mTLS or CF-Access/IP-allowlist) so `X-LetBuyy-Internal-*` headers cannot be injected externally (`wrangler.toml:212-215`); add nonce/jti replay protection to internal headers.
- **Risks:** rotating the secret can break internal calls if a consumer is missed → inventory first, rotate behind dual-accept (old+new) window.
- **Rollback:** keep both secrets valid during the window; revert to single secret if breakage.
- **Success:** internal secret no longer equals the cookie/OAuth/TOTP/money secret (grep=0 reuse); a forged internal header from outside the perimeter is rejected; replay window closed.
- **Human deps:** KMS for the new secret; perimeter decision (mTLS vs CF-Access). **Codex deps:** secret-source refactor, perimeter middleware, replay nonce store.

## Wave 1 — Identity Platform (stand up the authority) *(P2)*
- **Objectives:** deploy the IdP service skeleton; per-realm Ed25519 keys + JWKS at `/realms/{realm}/jwks`; server-side `sessions` + rotating-refresh store; token issuance (authorize/token/userinfo) for the **merchant realm** first; gateway begins verifying IdP-signed tokens as a PEP (alongside legacy).
- **Risks:** a second auth path during dual-run; key-management errors. **Rollback:** gateway ignores IdP tokens, falls back to legacy verify (flag).
- **Success:** a merchant can obtain a real IdP-signed access token verified by the gateway via JWKS in staging; legacy path untouched.
- **Human deps:** KMS/HSM, `id.letbuyy.com` DNS/cert, security review. **Codex deps:** IdP service, OIDC endpoints, JWKS, session/refresh store, PEP verify.

## Wave 2 — Merchant App (first RP + revocable sessions) *(P1 session subset + P2 SSO)*
- **Objectives:** control plane becomes an OIDC RP (Auth Code + PKCE, silent `prompt=none`); **pull-forward**: add idle timeout + refresh rotation + reuse-detection + real revocation to merchant sessions; collapse `users`+`users_custom` → one store; remove dual GoTrue/custom acceptance.
- **Risks:** merchant lockout on cutover; store-merge data errors. **Rollback:** legacy `lb_session` valid behind flag; per-route revert; reversible store-merge (dual-write window).
- **Success:** control-plane login via IdP; idle/rotation/revocation tests green; one merchant store; only one credential type accepted.
- **Human deps:** cutover window, comms. **Codex deps:** RP integration, session-hardening, store-merge migration.

## Wave 3 — Platform Console (admin realm) *(P1)*
- **Objectives:** stand up admin realm; **remove the static `super_admin` token** (`middleware/auth.ts:216-231`) → real per-principal admin identities; per-principal admin TOTP (retire shared `PLATFORM_CONSOLE_TOTP_SECRET`); console signed token → revocable admin session; Strict cookies; step-up for sensitive ops.
- **Risks:** admin lockout (highest blast radius). **Rollback:** break-glass procedure + legacy console token behind a time-boxed flag.
- **Success:** no static god-token authenticates; two admins cannot share a TOTP; admin sessions revocable + short.
- **Human deps:** admin roster, break-glass policy, security sign-off. **Codex deps:** admin realm, per-principal MFA, RBAC claim consumption.

## Wave 4 — Marketplace Systems *(P2)*
- **Objectives:** app marketplace, theme marketplace, developer portal become OIDC RPs (silent SSO); the existing app-OAuth issuer (`iss=letbuyy-app-platform`) folds into the IdP’s OAuth2/OIDC provider + consent registry; 3rd-party app tokens verified via JWKS.
- **Risks:** breaking installed 3rd-party app auth. **Rollback:** legacy app-OAuth issuer valid during overlap.
- **Success:** marketplace apps SSO without re-login; app tokens IdP-issued; consent recorded.
- **Human deps:** developer comms. **Codex deps:** RP integration, OAuth2 provider, consent registry.

## Wave 5 — Mobile *(P1 for login, P2 for SSO)*
- **Objectives:** **fix prod login** (replace Turnstile placeholder — beta blocker); Mobile BFF as a confidential OIDC client (Auth Code + PKCE; tokens in BFF/secure storage; **no embedded secrets**); TLS cert-pinning; `lb_session` → realm session.
- **Risks:** store-review delay; device lockout. **Rollback:** phased store rollout + kill-switch; legacy BFF path behind flag.
- **Success:** login works on a real device in prod; bundle grep finds no secret; pinned TLS.
- **Human deps:** app-store release, Turnstile config. **Codex deps:** BFF OIDC client, login fix, pinning.

## Wave 6 — Customer Accounts (customer realm) *(P2)*
- **Objectives:** customer realm issuer; storefront account area → revocable customer sessions (replace stateless JWT); store-scoped customer identity with optional global linking; `__Host-lb_c_sess` host-only; customer CSRF tokens (close the storefront CSRF gap).
- **Risks:** customer session disruption at scale. **Rollback:** dual session validation window.
- **Success:** customer sessions revocable; storefront CSRF present; realm-isolated from merchant.
- **Human deps:** none material. **Codex deps:** customer realm, storefront session refactor, CSRF.

## Wave 7 — Passkeys + Consent *(P3)*
- **Objectives:** WebAuthn ceremony (register/authenticate) across realms; passkey as a first-class factor + step-up; finalize consent screens/registry.
- **Risks:** account-recovery complexity. **Rollback:** passkey optional alongside existing factors.
- **Success:** a user can register + sign in with a passkey; consent recorded per client.
- **Human deps:** UX, recovery policy. **Codex deps:** WebAuthn server + ceremonies.

## Wave 8 — Hardening *(P2/P3)*
- **Objectives:** **retire the shared HMAC entirely** — service-to-service moves to mTLS/workload certs; decompose blanket service-role (ZT4/ZT8); remove all legacy stores/cookies (`users`, `lb_csrf`, parent-domain `lb_session`); enable refresh reuse-detection + risk engine globally; close `THREAT_MODEL` + `SOC2_CONTROL_MAP` items.
- **Risks:** removing legacy too early. **Rollback:** remove legacy only after each realm’s cutover is proven; keep certs rotation overlap.
- **Success:** grep for the shared internal secret = 0 runtime uses; no parent-domain cookie; mTLS between services; threat-model items closed.
- **Human deps:** workload-PKI, SOC2 evidence. **Codex deps:** mTLS plumbing, service-role decomposition, legacy removal.

## Cross-wave rules
- **Dual-run every wave** (old verify valid behind a flag) → cut over per app → remove legacy last. Never flip the cookie domain ahead of the canonical-domain (`.store→.com`) DNS move. Each wave is independently revertible. **No wave starts before GATE 0’s money/tenancy P0s.**
