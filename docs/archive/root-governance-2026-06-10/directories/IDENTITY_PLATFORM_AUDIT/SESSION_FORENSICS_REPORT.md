# SESSION FORENSICS REPORT
### Phase 3 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY

## 0. Verdict

The ecosystem runs **five live session implementations** under **three cookie realms**, plus a **dead "v2" session service**. The merchant session — the one the SSO mission cares most about — is the **weakest**: a bare `randomHex(32)` opaque token, 30-day fixed lifetime, **no rotation, no idle timeout, no reuse detection, no integrity binding**, logout = row delete. There is no orphaned-session reaper and no session-fixation defense beyond minting a fresh token on each auth. The advertised rotation/revocation service exists only as TypeScript interfaces.

---

## 1. Session inventory

| Realm | Store | Token | Cookie | Lifetime | Idle timeout | Rotation | Mint / validate |
|---|---|---|---|---|---|---|---|
| **Merchant/staff** | `sessions` table (Postgres) | opaque `randomHex(32)` | `lb_session` | **30 d** fixed | **none** | **none** | mint gw `routes/auth.ts:1047`; validate gw `routes/auth.ts:266-348`; client wrappers `apps/identity-platform/src/lib/auth/session.ts:7-87` |
| **Customer/buyer** | stateless JWT | HS256 JWT | `lb_customer_session` (host-only) | 7 d | n/a | none | `packages/auth-core/src/index.ts:693-764` |
| **Platform/ops** | stateless signed token | 2-part `payload.hmac` | `lb_console_session` | 8 h | via `exp` | none | `apps/platform-console/src/lib/console-session.ts` |
| **Mobile (merchant)** | reuses #1 | opaque `lb_session` | secure-storage + cookie | mirrors #1 | none | none | `apps/mobile/merchant-app/lib/services/store_auth_service.dart:160-197, 334-357` |
| **Supabase legacy** | Supabase GoTrue | JWT access+refresh | Supabase-managed | Supabase | Supabase | Supabase | gw `routes/auth.ts:1244-1268` |
| **"v2" session service** | in-memory `Map` | — | — | — | — | declared | **DEAD** — gw `identity-foundation/session-services.ts:29-114`; iface `packages/session-core/src/index.ts:35-49` |

---

## 2. Merchant session — detailed weaknesses (the SSO-critical path)

1. **Bare opaque token, no integrity binding.** `token = randomHex(32)` (`routes/auth.ts:1047`) stored and looked up; the token carries no signature, no device binding, no IP/UA binding in the token itself.
2. **30-day fixed lifetime, no idle timeout.** Cookie `maxAge: 30 * 24 * 60 * 60` (`apps/identity-platform/src/lib/auth/cookies.ts:81`); validation only checks absolute `expires_at` and bumps `last_active` (`routes/auth.ts` validate path) — `last_active` is recorded but **never enforced as an idle cutoff**.
3. **No rotation / no reuse detection.** There is no re-mint on privilege change or periodic interval; the only "rotation-like" behaviour is reset-password destroying all sessions then minting one (`reset-password/route.ts:86-92`). The reuse-detection interface (`session-core/src/index.ts:17-23` `RefreshChain.reuseDetectedAt`) is unimplemented.
4. **Logout = delete.** `destroySession` posts to `/auth/custom/sessions/destroy` → row delete (`session.ts:72-77`; gw `routes/auth.ts:1080-1092`). `destroy-all` exists (`:1094-1106`). No revocation list, so a copied token is valid until it is individually deleted or expires.
5. **No session-fixation pre-auth token, but low exposure.** A new token is minted *after* successful auth on every path, so a pre-set `lb_session` is overwritten — fixation risk is low, but there is no explicit "regenerate on auth" guard documented as such.

---

## 3. Competing ownership & duplication

- **Session creation logic is duplicated** between the gateway (authoritative mint) and three client wrappers (identity-platform `session.ts`, mobile `store_auth_service.dart`, and the dead `session-services.ts`). The dead one implements rotation the live ones lack — a trap for a future engineer who wires the wrong one.
- **`/api/auth/switch` mints a session for an arbitrary email** (`switch/route.ts:61-64`) with no possession proof — this is both a session-governance defect (sessions can be created for users who did not authenticate) and the Phase 6 C-1 account-takeover.
- **Three cookie realms, three secrets, three lifetimes** (`lb_session` 30d, `lb_customer_session` 7d, `lb_console_session` 8h) with no shared session service to reason about them centrally.

---

## 4. Orphans, fixation, replay, logout/refresh consistency

| Concern | Finding | Evidence |
|---|---|---|
| Orphaned sessions | No reaper/TTL sweep observed; rows persist until `expires_at` or explicit delete | gw `routes/auth.ts` (no cron/cleanup) |
| Session fixation | Low — fresh token minted post-auth; but no explicit regenerate guard | mint sites mint unconditionally |
| Replay | Opaque token replay possible until delete/expire; no reuse detection | `session-core` reuse iface unimplemented |
| Logout consistency | Single-device delete + cookie clear; `destroy-all` exists but **not invoked on password change in `switch`** | `logout/route.ts:34-53`; `reset-password` does call destroy-all (`:86`) |
| Refresh consistency | **No refresh on merchant path at all**; mobile "refresh" just re-validates the same opaque token | `store_auth_service.dart:334-357` |
| Idle timeout | `last_active` written, never enforced | validate path bumps it only |

---

## 5. Recommendations (analysis-only)

Bind the merchant session (sign it, or store device/UA hash and verify on use); add idle + absolute timeouts; add rotation on privilege change and a revocation list; either implement `session-core` (rotation/reuse/revocation) or delete it so it cannot be mis-wired; and fix `/api/auth/switch` so sessions can only be minted for an authenticated, possession-proven principal (Phase 6). Before SSO, a **single session service** must own all three realms.
