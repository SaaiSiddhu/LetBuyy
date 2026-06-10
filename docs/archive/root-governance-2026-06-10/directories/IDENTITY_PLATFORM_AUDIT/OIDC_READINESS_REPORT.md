# OIDC READINESS REPORT
### Phase 2 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY
### Question: can the Identity Platform act as an OIDC/OAuth2 Provider for the ecosystem today?

## OIDC READINESS SCORE: **6 / 100**

> A non-zero score reflects only that route *placeholders*, a discovery document shape, and PKCE knowledge (in a sibling app) exist. Nothing on the human-auth OIDC path issues, validates, or revokes a single real token.

---

## 0. Verdict

The "OIDC provider" is a **501 skeleton**. All six `oauth2/*` route files plus the two `.well-known` documents and `/jwks` are **one-line wrappers** around a single function, `oidcSkeletonResponse()`, that returns **404 when the feature flag is off (the default), a `mock:true` discovery doc and a literal-string JWKS when partially on, and HTTP 501 for every functional endpoint** (authorize, token, userinfo, consent, logout, callback). There is **no PKCE, no token issuance, no userinfo, no consent, no introspection, no revocation, no client registration, and no real signing key** on the human-auth path. Turning this on does not produce an OIDC provider; it produces a discovery document that points at endpoints which return 501.

---

## 1. Endpoint-by-endpoint evidence

Every route is literally this (authorize shown; token/userinfo/consent/logout/callback identical except verb/name):

```ts
// apps/identity-platform/src/app/oauth2/authorize/route.ts:1-5
import { oidcSkeletonResponse } from '@/lib/identity-foundation/oidc-disabled'
export function GET(request: Request) {
    return oidcSkeletonResponse('oauth2/authorize', request)
}
```

The single implementation they all call:

```ts
// apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts:50-103
export function oidcSkeletonResponse(endpoint, request) {
  if (!identityProviderEnabled()) return disabledIdentityProviderResponse()      // → 404, line 51
  if (endpoint === 'openid-configuration') { return NextResponse.json({ ...discovery, mock: true }) }  // 53-73
  if (endpoint === 'jwks' && FEATURE_NEW_KEY_SERVICE) { return NextResponse.json({ ...MOCK_JWKS, mock: true }) } // 76-88
  return NextResponse.json({ error: { code: 'IDENTITY_PROVIDER_NOT_CONFIGURED' } }, { status: 501 })  // 90-103
}
```

| Endpoint | Route file | Behaviour | Evidence |
|---|---|---|---|
| `GET /.well-known/openid-configuration` | `app/.well-known/openid-configuration/route.ts` | flag-off → 404; flag-on → `mock:true` discovery | `oidc-disabled.ts:53-73` |
| `GET /.well-known/jwks.json` & `GET /jwks` | `app/.well-known/jwks.json/route.ts`, `app/jwks/route.ts` | returns **literal** `x:'mock-x-coordinate'` JWKS (only if `FEATURE_NEW_KEY_SERVICE`), else 501 | `oidc-disabled.ts:4-16, 76-88` |
| `GET /oauth2/authorize` | `app/oauth2/authorize/route.ts` | **501** | `oidc-disabled.ts:90-103` |
| `POST /oauth2/token` | `app/oauth2/token/route.ts` | **501** | same |
| `GET /oauth2/userinfo` | `app/oauth2/userinfo/route.ts` | **501** | same |
| `GET /oauth2/consent` | `app/oauth2/consent/route.ts` | **501** | same |
| `GET /oauth2/logout` | `app/oauth2/logout/route.ts` | **501** | same |
| `GET /oauth2/callback` | `app/oauth2/callback/route.ts` | **501** | same |
| `/oauth2/introspection` | **does not exist** | no route file | `find app/oauth2` → 6 dirs only |
| `/oauth2/revocation` | **does not exist** | no route file | same |
| `/oauth2/register` (DCR) | **does not exist** | no route file | same |

**Gate:** `identityProviderEnabled()` = `features.identityFoundation.FEATURE_IDENTITY_PROVIDER` (`oidc-disabled.ts:18-20`), resolved by `resolveIdentityFoundationFeatureFlags` and **defaulting false** (`apps/identity-platform/src/lib/config/features.ts:22-23`). So in default production posture, the entire OIDC surface is **404**.

---

## 2. Compliance matrix (the audit checklist)

| Capability | Required for OIDC | Present? | Evidence |
|---|---|---|---|
| Authorization Code flow | ✅ | ❌ 501 | `authorize/route.ts` → 501 |
| Token endpoint (code→token) | ✅ | ❌ 501 | `token/route.ts` → 501 |
| UserInfo | ✅ | ❌ 501 | `userinfo/route.ts` → 501 |
| Discovery doc | ✅ | ⚠️ shape only, `mock:true` | `oidc-disabled.ts:56-67` |
| JWKS (real keys) | ✅ | ❌ literal `mock-x-coordinate` | `oidc-disabled.ts:11-13` |
| PKCE (S256) | ✅ | ❌ advertised, not implemented | discovery `code_challenge_methods_supported:['S256']` (`:65`) but no verifier anywhere on human path; `grep code_verifier\|code_challenge` in identity-platform = none |
| Refresh-token rotation | ✅ | ❌ interface only | `packages/session-core/src/index.ts:41-44` |
| Token revocation | ✅ | ❌ no endpoint | n/a |
| Token introspection | ✅ | ❌ no endpoint | n/a |
| Session sync / front/back-channel logout | ✅ | ❌ logout 501 | `logout/route.ts` |
| Client registration (static or DCR) | ✅ | ❌ none | no client store, no `/register` |
| Scopes / claims | ✅ | ❌ none issued | no token issuance |
| Audience validation | ✅ | ❌ n/a | no token issuance |
| Nonce validation | ✅ | ❌ n/a | no `id_token` |
| State validation | ✅ | ❌ n/a | authorize 501 |
| Replay protection | ✅ | ❌ n/a | no code/token store |

**0 of 16** OIDC-provider capabilities are functional on the human-auth path.

---

## 3. The one place PKCE is real — and why it doesn't count here

PKCE **is** implemented — but for **app-marketplace install**, a machine-to-machine OAuth between the marketplace app and the gateway, not human SSO:

```ts
// apps/app-marketplace/src/app/api/apps/[id]/install/route.ts:22-30, 91, 101
function createPkcePair() { /* 32-byte verifier, S256 challenge */ }
... code_challenge_method: 'S256' ... code_verifier ...
```

This proves the org *can* build OAuth correctly, but it is a separate authorization server (the gateway's `/v1/app-store/oauth/*`), not the identity-platform OIDC provider the SSO mission requires.

---

## 4. Why the score is 6, not 0

- +3: route topology and discovery-document *shape* exist and are correctly named (a real head start).
- +2: PKCE/S256 competence demonstrated elsewhere in the monorepo (`install/route.ts`).
- +1: feature-flag scaffolding (`FEATURE_IDENTITY_PROVIDER`, `FEATURE_NEW_KEY_SERVICE`) and a registry (`auth-verifier-registry.ts`) provide a wiring point.
- Everything else is absent or mock.

## 5. What must exist before this is even a 50

Real asymmetric key service with rotating JWKS (replacing `MOCK_JWKS`); a client registry; authorize endpoint with PKCE+state+nonce+consent; token endpoint with code exchange, `id_token`/`access_token` issuance, audience/scope; refresh rotation + reuse detection (build `session-core`); revocation + introspection endpoints; back-channel logout. None of these exist today.

> **Danger flag for operators:** enabling `FEATURE_IDENTITY_PROVIDER` + `FEATURE_NEW_KEY_SERVICE` would publish a discovery doc and a **literal-string mock JWKS** to real relying parties — clients could be configured against an issuer that cannot mint a verifiable token. Treat both flags as **production-forbidden** until §5 is built. See Phase 6 (security) and Phase 13 (debt).
