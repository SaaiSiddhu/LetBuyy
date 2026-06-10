# TARGET_AUTH_ARCHITECTURE (final authority)

> **Status:** FINAL. **Ratifies** the north-star already designed in `docs/auth/2026-06-08-identity-platform-transformation/` (TARGET_AUTH, REALM, TOKEN_STRATEGY, ZERO_TRUST, KEY_MANAGEMENT, PERMISSION_MODEL, OIDC_DECISION_RECORD) and **reconciles** it with (a) the verified code reality, (b) the Phase-2 ARB challenge, and (c) `LETBUYY_EXECUTABLE_ARCHITECTURE_V1` (the superseding freeze). Where the 2026-06-08 design and the freeze conflict, this document resolves it. No implementation here.

## 0. The decision that governs everything below
**The north-star (a central Identity Platform that is the sole issuer) is RATIFIED but SEQUENCED.** V1 defers OIDC/passkeys/marketplace to post-foundation; the money and tenancy work are the existential P0s. Therefore:
- **Pulled forward to P0/P1 (security-critical subset):** retire/replace the shared `AUTH_SECRET` trust root; lock the gateway perimeter; make sessions server-revocable with idle+rotation; collapse the two identity stores and dual-accept.
- **Deferred to P2/P3 (the full build):** the central OIDC IdP, per-realm JWKS, passkeys, consent registry, federation — delivered via the migration waves.
- **Why the secret retirement is P0, not P2:** the same `getLetbuyyInternalAuthSecret() = INTERNAL_API_SECRET || AUTH_SECRET` (`auth-core:447`) that lets any holder **forge any identity** (ZERO_TRUST ZT1/ZT2) **also signs the internal headers that authorize money operations.** Its compromise is simultaneously an identity-takeover and a money-movement authorization. This couples identity security to money integrity and makes it a foundation P0.

## 1. Ownership — who owns what (target)
Per the brief, **the Identity Platform owns every identity capability**, with one deliberate exception preserved from `AUTHORITY_MATRIX`: *resource* authorization over commerce objects stays in the commerce core, which consumes Identity-verified subject + org/role claims.

| Capability | Target owner |
|---|---|
| Authentication (all realms) | **Identity Platform** (authn engine) |
| Authorization — *who you are / org & roles* | **Identity Platform** (claims) |
| Authorization — *what you may do to a commerce resource* | **Commerce core (PEP at gateway)**, consuming Identity claims |
| MFA / step-up | **Identity Platform** (risk + step-up engine) |
| Passkeys (WebAuthn) | **Identity Platform** |
| Consent | **Identity Platform** (consent registry) |
| Refresh tokens + rotation | **Identity Platform** |
| Logout (global + per-client, back-channel) | **Identity Platform** |
| Sessions (server-side, revocable) | **Identity Platform** |
| User identities (all realms) | **Identity Platform** |
| Service/workload identity, M2M | **Identity Platform — Platform realm** (mTLS/SPIFFE + client-credentials) |

## 2. Realms (four)
Ratifies REALM_ARCHITECTURE’s three human realms and adds the **Platform realm** for non-human identity (the brief’s 4th). Each realm = its own OIDC issuer instance, keys, audience, cookie host, principal + session store partition. **A token in one realm is cryptographically invalid in another** (distinct `iss`/keys/`aud`).

| Realm | Issuer | Principals | Cookie (host-only) | Keys |
|---|---|---|---|---|
| **Merchant** | `id.letbuyy.com/realms/merchant` | sellers, store staff, org members | `__Host-lb_m_sess` | merchant JWKS |
| **Customer** | `…/realms/customer` | shoppers (store-scoped, optional global link) | `__Host-lb_c_sess` | customer JWKS |
| **Admin** | `…/realms/admin` | LetBuyy staff/operators/super-admins | `__Host-lb_a_sess` | admin JWKS |
| **Platform** | `…/realms/platform` | services, workers, 3rd-party apps, M2M | none (mTLS/client-creds) | platform JWKS |

## 3. Token & key model (ratifies TOKEN_STRATEGY)
- **ID token** (EdDSA, 5–10 min, front-channel only), **access token** (EdDSA JWT, 5–10 min, `aud`-pinned, JWKS-verifiable, carries `sub,realm,aud,org,sites,amr,sid,exp`), **refresh token** (opaque ≥256-bit, rotating, bound to client+sid+aud, reuse-detection), single-use tokens (code/device/magic/reset/verify) **opaque + hashed at rest** (closes the plaintext `verification_tokens` gap).
- **Keys:** per-realm Ed25519 pairs, `kid`-tagged, published at `/realms/{realm}/jwks`; 90-day rotation with overlap + emergency; private keys in KMS, never in app env. **This replaces the shared HMAC as the cross-service trust root.**
- **Service-to-service:** mTLS / workload certs replace `X-LetBuyy-Internal-*` HMAC headers.

## 4. Sessions / refresh / rotation / revocation
- Three layers (sid record → rotating refresh → short access); the **`sid` is the revocation anchor** (revoke session ⇒ refresh chain dead ⇒ access dies within one short TTL). Per-realm idle + absolute timeouts. Detail in `SESSION_MANAGEMENT.md`.

## 5. Authorization model
- **RBAC stays in commerce/ops core** (`rbac.ts`, `tenant-context.ts`, `site_memberships/site_roles/site_role_permissions`), but is fed a **verified** subject + org/role claims, not an app-asserted header. The gateway is a **Policy Enforcement Point** that verifies token + `aud` + realm + `sid`-not-revoked + resource RBAC on **every** call. Edge cookie-shape checks are UX only, never security.

## 6. Consent, passkeys, risk, step-up
- **Consent registry** (per-client granted scopes + screen) — greenfield, P2. **Passkeys/WebAuthn** — greenfield ceremony, P2/P3. **Risk engine + step-up** — policy-driven (new device / sensitive action / payout / admin) forces AAL2/AAL3; break-glass only for admin, time-boxed + audited. **No standing synthetic super-identity** (removes the static `super_admin` token).

## 7. Zero-trust alignment (ratifies ZERO_TRUST)
Closes ZT1–ZT8: identity asserted only by the IdP and verified by everyone; workloads carry their own crypto identity; every request authorized at the resource; least-privilege short-TTL scoped tokens; continuous revocability; no standing super-identity; assume-breach internally. **Service-role decomposition** (ZT4/ZT8) is the bridge item that also serves the tenancy P0.

## 8. Current vs future
| Dimension | Current (code) | Future (target) |
|---|---|---|
| Issuer | none; gateway is de-facto authority; apps assert HMAC headers | one IdP per realm; verifiable signed tokens |
| Trust root | one shared symmetric secret (also signs money headers) | per-realm asymmetric keys (JWKS) + mTLS workloads |
| Sessions | 30-day opaque, no idle/rotation; 3 systems; partly stateless-unrevocable | one server-side revocable session, short access + rotating refresh |
| Stores | 2 (`users` + `users_custom`) | one per realm |
| Realms | implicit (cookie-name only); parent-domain `.letbuyy.store` shared | structural; `__Host-` host-only; 4 realms |
| MFA | enrolled-not-enforced; shared admin TOTP | policy-enforced step-up; per-principal |
| OIDC | 501 skeleton + mock JWKS | real OIDC provider (deferred build) |
| Consent/passkeys | none | registry + WebAuthn (deferred) |
| Admin identity | static shared bearer → synthetic super_admin | real per-principal admin realm |

## 9. What this means for sequencing (binding)
1. **Now (P0/P1, before/with the money+tenancy work):** isolate+rotate the internal secret away from cookie/OAuth/TOTP/money headers; lock the gateway (mTLS/CF-Access/allowlist) so headers can’t be injected externally; make merchant sessions revocable + idle + rotating; collapse the two stores + dual-accept; enforce MFA; remove the static super_admin token. *(These are also `IDENTITY_MIGRATION_PLAN` Waves 0–3.)*
2. **Later (P2/P3):** stand up the central IdP, per-realm OIDC + JWKS, SSO (`SSO_ARCHITECTURE.md`), consent, passkeys, federation. *(Waves 4–8.)*
**Do not build the central OIDC IdP before the money and tenancy P0s land.** The north-star is correct; the order is non-negotiable.
