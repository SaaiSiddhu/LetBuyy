# TOKEN_STRATEGY

**Phase 9 — Token Strategy**
Status date: 2026-06-08

> Defines every token: **issuer, audience, claims, signing algorithm, expiration**, plus storage/transport and rotation. Covers access tokens, refresh tokens, authorization codes, device codes, magic links, password-reset tokens, verification tokens, ID tokens, federation tokens, and M2M tokens.

> **Today's token reality (being replaced/standardized).** App-OAuth tokens already use `iss=letbuyy-app-platform`, `aud=letbuyy-commerce-api`, 1h access / 15m code (`auth-core/src/index.ts:307–310`). Customer/platform tokens are signed with a **shared symmetric secret** (HMAC) per `auth-core`. Verification tokens are stored **in plaintext** in `verification_tokens.token` (migration `000_baseline.sql`). The target standardizes issuers per realm, moves human-facing token signing to **asymmetric keys + JWKS**, and **hashes all single-use tokens at rest**.

---

## 1. Signing strategy

| Token class | Algorithm | Key type | Why |
|-------------|-----------|----------|-----|
| ID token, access token (JWT) | **EdDSA (Ed25519)** preferred, RS256 fallback | **Asymmetric**, per-realm, published via JWKS | Downstream services verify with public key, no shared secret; closes the "shared HMAC secret = identity forgery" gap (Phase 1 §5, Phase 12) |
| Refresh token | opaque random (≥256-bit) | n/a (server-side lookup) | Opaque + rotating; nothing to forge |
| Authorization code, device code | opaque random | n/a | Single-use, server-side |
| Magic-link / reset / email-verify | opaque random, **stored hashed (SHA-256)** | n/a | Single-use; DB leak ≠ usable token |
| Federation token | short JWT (EdDSA) + server replay store | asymmetric | Verifiable + single-use |
| M2M (client-credentials) access | JWT (EdDSA) | asymmetric | Same verification path as user AT |
| Internal service identity | mTLS cert / SPIFFE-style | asymmetric | Replaces internal HMAC headers (Phase 12) |

**Key management:** per-realm key pairs, `kid`-tagged, published at `/realms/{realm}/jwks`. Rotation: overlapping validity (publish new `kid`, sign with new, accept old until drained), scheduled (e.g. 90d) + emergency. Private keys in KMS/HSM; never in app env. This replaces `getLetbuyyInternalAuthSecret()` (`auth-core/src/index.ts:447`) as the trust root for cross-service identity.

---

## 2. Token catalog

### 2.1 ID token (OIDC)
| Field | Value |
|-------|-------|
| Issuer | `https://id.letbuyy.com/realms/{realm}` |
| Audience | the **client_id** that requested login |
| Claims | `sub, iss, aud, exp, iat, auth_time, nonce, amr, acr, realm, org?, email?, name?` |
| Algorithm | EdDSA (Ed25519) |
| Expiration | 5–10 min (consumed at login, not an API credential) |
| Transport | front-channel to the RP; never sent to resource APIs |

### 2.2 Access token (the API credential)
| Field | Value |
|-------|-------|
| Issuer | `https://id.letbuyy.com/realms/{realm}` |
| Audience | resource: `letbuyy-commerce-api` / `letbuyy-storefront-api` / `letbuyy-checkout` / `letbuyy-console` |
| Claims | `sub, iss, aud, exp, iat, scope, realm, act, org?, sites?, store_id?, amr, sid, client_id` |
| Algorithm | EdDSA |
| Expiration | merchant 8m / customer 10m / admin 5m (Phase 8) |
| Transport | `Authorization: Bearer`; never in URL, never in localStorage |
| Validation | gateway: signature via JWKS, `exp`, `aud` matches route, `realm` matches route, `sid` not in revoked cache |

### 2.3 Refresh token
| Field | Value |
|-------|-------|
| Issuer/validator | Identity Platform (server-side) |
| Audience | the issuing client + `sid` + token-aud |
| Form | opaque ≥256-bit random; **rotating** |
| Expiration | merchant 12h / customer 30d / admin ≤30m (Phase 8) |
| Transport | `__Host-lb_rt` httpOnly cookie (path `/token`) for web; secure storage / BFF for native |
| Rotation | new RT each use; **reuse ⇒ revoke entire `sid` chain** |

### 2.4 Authorization code
| Field | Value |
|-------|-------|
| Issuer | Identity (`/authorize`) |
| Audience | one client, one redirect URI |
| Form | opaque single-use; **PKCE-bound** (`code_challenge`) |
| Expiration | ≤ 60s (tighten from today's 15m `LETBUYY_APP_AUTHORIZATION_CODE_TTL_SECONDS`) |
| Transport | front-channel query param; exchanged immediately at `/token` |

### 2.5 Device code (RFC 8628 — CLI #14, TV/limited-input)
| Field | Value |
|-------|-------|
| Issuer | Identity (`/device_authorization`) |
| Form | `device_code` (opaque) + `user_code` (short human code) |
| Expiration | 10–15 min; polling interval enforced |
| Transport | device polls `/token`; user approves at `id.letbuyy.com/device` |

### 2.6 Magic-link token
| Field | Value |
|-------|-------|
| Issuer | Identity |
| Type | `magic_link` (today in `verification_tokens`, type-checked) |
| Form | opaque random, **stored hashed**, single-use (`used` flag → consume atomically) |
| Expiration | 15 min (today merchant magic uses `AUTH_TOKEN_EXPIRY_MS`; console magic = `LETBUYY_PLATFORM_MAGIC_LINK_TTL_SECONDS=15m`) |
| Transport | emailed URL; redeemed once → mints session |

### 2.7 Password-reset token
| Field | Value |
|-------|-------|
| Issuer | Identity |
| Type | `password_reset` |
| Form | opaque random, **hashed at rest**, single-use, invalidated after use |
| Expiration | 15–30 min |
| Side effect | on use ⇒ `destroyAllUserSessions` (today's reset already does this — keep) |

### 2.8 Email-verification token
| Field | Value |
|-------|-------|
| Issuer | Identity |
| Type | `email_verify` |
| Form | opaque random, **hashed at rest**, single-use |
| Expiration | 24h |
| Side effect | sets `email_verified` |

### 2.9 Federation token (cross-domain handoff)
| Field | Value |
|-------|-------|
| Issuer | Identity |
| Audience | target domain/client |
| Form | short JWT (EdDSA) + **server-side single-use replay store** (today: `redeemCustomerFederationToken` returns `replayed` status — keep) |
| Claims | `sub, realm, store_id?, exp, jti` |
| Expiration | ≤ 15 min (today `LETBUYY_CUSTOMER_FEDERATION_TTL_SECONDS=15m`) |

### 2.10 M2M access token (client-credentials)
| Field | Value |
|-------|-------|
| Issuer | Identity `/token` (grant=client_credentials) |
| Audience | resource API |
| Claims | `client_id, scope, org/site, aud, exp` (no `sub`) |
| Expiration | ≤ 1h |
| Source | `site_api_clients` / `oauth_clients` registry (`key_hash`, `scopes[]`) |

---

## 3. Token reference table (one-glance)

| Token | iss | aud | signing | exp | single-use | revocable |
|-------|-----|-----|---------|-----|:----------:|:---------:|
| ID token | realm | client_id | EdDSA | 5–10m | n/a | n/a |
| Access token | realm | resource | EdDSA | 5–10m | no | via sid cache |
| Refresh | IdP | client+sid | opaque | 12h–30d | rotates | yes |
| Auth code | IdP | client | opaque+PKCE | ≤60s | **yes** | n/a |
| Device code | IdP | client | opaque | 10–15m | **yes** | yes |
| Magic link | IdP | user | opaque, hashed | 15m | **yes** | yes |
| Password reset | IdP | user | opaque, hashed | 15–30m | **yes** | yes |
| Email verify | IdP | user | opaque, hashed | 24h | **yes** | yes |
| Federation | IdP | target | EdDSA + replay store | ≤15m | **yes** | yes |
| M2M | IdP | resource | EdDSA | ≤1h | no | via client revoke |

---

## 4. Claim governance

| Claim | Meaning | Authority | Notes |
|-------|---------|-----------|-------|
| `sub` | realm-scoped opaque principal id | Identity | stable, never reused across realms |
| `realm` | merchant/customer/admin | Identity | checked at gateway per route |
| `act` | ActorType | Identity | reuses `auth-core` `ActorType` vocabulary |
| `org` | merchant org id | Identity (sourced from Commerce Membership API) | **null until org model lands** |
| `sites` | bounded membership snapshot | Identity (snapshot) | **commerce is the authority**; gateway re-checks on sensitive ops |
| `store_id` | customer's store scope | Identity | customer realm only |
| `scope` | granted OAuth scopes | Identity (+ consent) | least-privilege; sensitive scopes need step-up |
| `amr` | auth methods used | Identity | drives step-up decisions |
| `acr` | auth context class | Identity | e.g. `aal2` for MFA |
| `sid` | server session id | Identity | revocation anchor |

**Rule:** tokens carry **claims for the common path**; for anything financially or security sensitive (payouts, staff/role changes, API-key issuance, cross-org actions) the gateway **re-validates against commerce data** rather than trusting a possibly-stale `sites`/`org` snapshot. Claims are a cache, not the source of truth, for authorization inputs.

---

## 5. Anti-patterns explicitly eliminated

| Anti-pattern (evidence) | Replacement |
|-------------------------|-------------|
| Raw Supabase `access_token`/`refresh_token` in JSON (Audit §Security Findings, `routes/auth.ts`, `routes/employee.ts`) | No raw tokens in bodies; tokens only via standard OAuth responses + httpOnly cookies; legacy routes deleted |
| Raw app `access_token`/`refresh_token` in JSON (`billing-oauth-routes.ts`) | One-time display at issuance only; store hashes (already partly done); rotation |
| Plaintext `verification_tokens.token` | Hash at rest (SHA-256), compare on redeem |
| Shared symmetric HMAC for cross-service identity (`getLetbuyyInternalAuthSecret`) | Asymmetric per-realm keys + JWKS; mTLS for service identity |
| 30-day opaque bearer, no rotation (merchant `lb_session`) | Short access + rotating refresh + revocable `sid` |
| Stateless customer/console JWT, no revoke | Server-side `sid`, revocable |

---

## 6. Acceptance criteria

- All human-facing JWTs signed with **asymmetric** per-realm keys, verifiable via JWKS, rotatable.
- All single-use tokens (magic/reset/verify/federation/code) are **hashed or opaque + server-side single-use**.
- No token type returns raw secrets in a JSON body beyond a single issuance display.
- Every token has explicit `iss`/`aud`/`exp`; audience pinning enforced at the gateway.
- The shared internal HMAC secret is removed from the cross-service identity path.

Phase 10 specifies the authenticators (TOTP, passkeys, recovery, device trust) referenced by `amr`/`acr`.
