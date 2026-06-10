# SSO READINESS REPORT
### Phase 12 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY
### Question: can Identity safely provide SSO across the ecosystem's clients?

## 0. Verdict

Identity already provides **one narrow form of SSO that works today**: a **shared parent-domain session cookie** (`lb_session` scoped to `.letbuyy.store`) lets a single login at `accounts.*` be honoured by the other first-party platform web apps on the *same apex* (`admin/apps/themes/developer`). That is genuine SSO for one client class. It is **not** the federated, token-based root-of-trust the mission describes: there is **no OIDC provider** (Phase 2), so any client that isn't a same-apex cookie-sharing web app — CLIs, native/partner apps acting as relying parties, anything on a different domain — **cannot be served at all**. Federating today would also propagate the `/api/auth/switch` account-takeover (Phase 6 C-1) to every client. **Cookie-SSO: shippable now (with caveats). OIDC-SSO: not buildable on the current authority layer without constructing it.**

---

## 1. Client-by-client readiness

| Future client | Mechanism it needs | Available today? | Blocker |
|---|---|:--:|---|
| **First-party platform web apps** (admin, app-marketplace, theme-marketplace, developer-portal) | parent-domain cookie share | ✅ **Yes** | works via `lb_session` `.letbuyy.store` (`cookies.ts:33-54`); caveat: cutover domain drift (Phase 4 D2) |
| **Platform console (ops)** | step-up session + MFA | ⚠️ **Partial** | uses a *separate* realm `lb_console_session` (8h, MFA) — `console-session.ts` — not plain `lb_session` SSO; this is appropriate for ops but contradicts the "one cookie across all platform apps" comment |
| **Merchant mobile app** | token/cookie via accounts host | ⚠️ **Operationally** | real HTTP flow to `accounts.*` works (`store_auth_service.dart:160-197`) but fails closed without a real Turnstile key (Phase 5 §6) |
| **Storefront runtime / customers** | separate realm (by design) | ✅ **Correctly excluded** | buyers use host-only `lb_customer_session`; intentionally NOT in platform SSO (Phase 4 §2) — this is a strength |
| **Checkout runtime** (reserved) | same-apex cookie OR OIDC | ⚠️ **Depends** | same apex → cookie works; cross-domain → needs OIDC (absent) |
| **Mobile BFF** | internal HMAC proxy | ✅ **Yes** | signs session into internal headers (`services/mobile-bff/src/index.ts:151-173`) |
| **Future CLI** | device-code / OIDC | ❌ **No** | needs `urn:…:device_code` (advertised in mock discovery, 501 in reality) |
| **Future partner apps (external RPs)** | OIDC authorization-code + PKCE | ❌ **No** | no provider, no client registry, mock JWKS (Phase 2) |

---

## 2. What blocks federated SSO (ranked)

1. **No OIDC provider** — authorize/token/userinfo/consent/logout all 501; JWKS is a literal string; no client registration, introspection, or revocation (Phase 2). External and cross-domain clients are unservable.
2. **C-1 account takeover** — federating an identity with an unauthenticated session-mint bug (`switch/route.ts`) hands every downstream client a takeover primitive (Phase 6).
3. **No central session service** — refresh rotation / reuse detection / revocation exist only as interfaces (`session-core`); SSO needs a single revocable session authority, not 5 parallel realms (Phase 3).
4. **No default-deny enforcement** — no identity-app middleware; tenant scoping rides on `service_role`/BYPASSRLS with a dead RLS net (Phase 7). SSO multiplies the number of services that can forget the per-route check.
5. **Secret/realm fragmentation** — `AUTH_SECRET` signs console + accounts + internal HMAC; 7 token formats (Phase 1 §2). No single issuer/key to anchor trust.
6. **Cookie-domain drift** — `.letbuyy.store` literal vs `letbuyy.com` canonical breaks even the cookie-SSO that works today, at cutover (Phase 4 D2).
7. **Mock OIDC one flag from real RPs** — `FEATURE_IDENTITY_PROVIDER`/`FEATURE_NEW_KEY_SERVICE` would publish an unusable issuer (Phase 6 H-5).

---

## 3. What must change before SSO-as-SSOT

- Build the real OIDC provider (key service + JWKS rotation, client registry, authorize/token/userinfo with PKCE/state/nonce/consent, refresh rotation+reuse detection, revocation+introspection, back/front-channel logout). This is Phase 2 §5 — net-new construction, not a flag flip.
- Fix C-1 and remove the three checked-in secret literals (Phase 6 C-1/C-2/C-3).
- Stand up one session service owning all realms; add default-deny middleware + a tenant safety net.
- De-fork the auth-runtime duplicates (Turnstile/dev-bypass/CSRF/cookie-domain) into one shared module (Phase 10).

---

## 4. Honest framing

The cookie-SSO that exists is a **legitimate, working capability** for first-party same-apex web apps and should not be dismissed. But the mission's wording — *"single authority for SSO/OIDC/OAuth across mobile, marketplace, merchant, customer, admin"* — requires a **federated token issuer that does not exist**. Identity can be that authority, but it must be *built to it*; it is not *one configuration change* away. Cross-ref the verdict and timeline in Phase 14.
