# SESSION_MANAGEMENT (final authority)

> **Status:** FINAL. Ratifies `docs/auth/2026-06-08-…/SESSION_MANAGEMENT.md` and reconciles with the verified code reality + Phase-2 findings. The **revocability + idle + rotation** subset is a foundation **P0/P1** (it does not require the full IdP); the rest lands with the IdP build (Waves 1–6).

## 1. Session authority & storage
- **Authority:** the **Identity Platform** owns sessions (server-side, per-realm partition). Today the **API Gateway** owns the merchant `sessions` table and is the de-facto authority — that authority migrates to the IdP, but the *server-side, revocable* property is pulled forward now.
- **Storage:** session records (`sid`) in the identity DB; referenced by the realm cookie and the `sid` access-token claim. Refresh tokens server-side (opaque, rotating). Access tokens never persisted (memory / app session only — never `localStorage`).

## 2. Three-layer model
| Layer | Form | Lifetime | Stored | Purpose |
|---|---|---|---|---|
| **Session (`sid`)** | server record (opaque ref) | idle + absolute (per realm) | identity DB `sessions` | revocation anchor; realm/principal/device/amr |
| **Access token** | EdDSA JWT, `aud`-pinned | **5–10 min** | memory / app session | the API credential (JWKS-verified at the PEP) |
| **Refresh token** | opaque ≥256-bit, rotating | hours–days (per realm) | httpOnly cookie / device secure storage / BFF | obtains new access tokens; reuse-detected |

Revoke `sid` → refresh chain dies → access expires within one short TTL → access ends platform-wide.

## 3. Per-realm timeouts
| Realm | Access TTL | Refresh TTL (rotating) | Idle | Absolute |
|---|---|---|---|---|
| Merchant | 10 min | 24 h | 8 h | 30 d |
| Customer | 10 min | 7–30 d (remember-me) | 30 d | 90 d |
| Admin | 5 min | 2 h | 15 min | 8 h |
| Platform (M2M) | 5–15 min | n/a (client-creds re-issue) | n/a | n/a |

## 4. Rotation, refresh, revocation
- **Refresh rotation:** every refresh issues a new refresh + invalidates the prior; **reuse detection** (a presented-but-already-rotated token) ⇒ kill the whole `sid` family + alert (token theft signal). *(Today: no rotation, no reuse detection for merchant/customer — `AUTHORITY_MATRIX #15`.)*
- **Idle/absolute:** enforced server-side on the `sid`; today only `last_active` is bumped with no enforcement.
- **Revocation:** real-time per-`sid` and per-family; logout, password change, risk events, and admin “sign out everywhere” all revoke. A revoked-`sid` cache at the PEP makes revocation effective within one access-TTL even with local JWT verification.

## 5. Device sessions & cross-app
- **Device registry** with per-device revoke; the `sid` is device-bound; “your sessions/devices” management surface. **Cross-app:** one IdP SSO session feeds many app sessions via silent OIDC (see `SSO_ARCHITECTURE.md`); apps do **not** share a cookie.

## 6. Cookie ownership matrix (target)
| Cookie | Realm/owner | Issuer | Validator | Domain | Flags | Lifetime |
|---|---|---|---|---|---|---|
| `__Host-lb_m_sess` | Merchant IdP SSO | IdP | IdP | host-only `id.letbuyy.com` | httpOnly, Secure, SameSite=Lax | idle/absolute |
| `__Host-lb_c_sess` | Customer IdP SSO | IdP | IdP | host-only storefront/IdP | httpOnly, Secure, Lax | idle/absolute |
| `__Host-lb_a_sess` | Admin IdP SSO | IdP | IdP | host-only console/IdP | httpOnly, Secure, **Strict** | idle/absolute |
| per-app session | each RP | RP | RP | host-only per app | httpOnly, Secure, Lax | short |
| CSRF (double-submit) | each RP | RP | RP | host-only | **not** httpOnly, SameSite=Strict | short |

**Retired:** the parent-domain `lb_session` on `.letbuyy.store`, the legacy `lb_csrf` second CSRF cookie, and the unencrypted-PII multi-account cookie pattern (re-issue as needed).

## 7. Realm isolation (structural)
Merchant / Customer / Admin sessions use separate issuers, keys, audiences, cookie hosts, and store partitions. **No shared cookie, session, refresh, or privilege.** A token minted in one realm is invalid in another.

## 8. Threat model & blast radius
| Threat | Today | Target |
|---|---|---|
| Stolen session cookie | parent-domain `lb_session` valid across **all** platform sub-apps (`cookies.ts:58-67`) | host-only `__Host-` cookie valid on **one** host; revocable |
| Stolen access token | n/a (opaque 30-day bearer, unrevocable) | 5–10 min, `aud`-pinned, revocable via `sid` |
| Compromised refresh | n/a (no refresh) | rotation + reuse-detection kills the family |
| Shared-secret leak | **forge any identity + authorize money headers** (`auth-core:447`) | per-realm asymmetric keys; mTLS workloads — no shared secret |
| Revocation latency | cannot revoke stateless customer/console JWT before expiry | ≤ one access-TTL via revoked-`sid` cache |
| Admin session theft | static synthetic super_admin; long-lived | short TTL, Strict cookie, step-up, no synthetic principal |

**Blast radius reduction is the headline win:** today one stolen cookie or one leaked secret is estate-wide; the target confines compromise to one host, one short-lived token, one revocable `sid`.

## 9. Current → Future → Migration
- **Current:** merchant = 30-day opaque, no rotation, parent-domain cookie; customer/console = stateless JWT, no server revocation; 3 systems; 2 CSRF cookies.
- **Future:** one server-side revocable session per realm; short access + rotating refresh + reuse detection; `__Host-` host-only cookies; device registry; real-time revocation.
- **Migration (sequenced in `IDENTITY_MIGRATION_PLAN.md`):** (P0/P1, now) add idle + rotation + reuse-detection + real revocation to the **existing** merchant session and remove the parent-domain blast radius where possible, behind dual-read; (P2+) move the session store to the IdP and unify customer/console under revocable sessions; flip cookies to `__Host-` at the domain cutover. **Dual-run** old+new validation during each app’s window; cut over per app; remove legacy last.
