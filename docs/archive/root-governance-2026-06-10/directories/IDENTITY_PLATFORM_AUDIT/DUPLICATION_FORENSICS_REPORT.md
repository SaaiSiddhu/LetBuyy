# DUPLICATION FORENSICS REPORT
### Phase 10 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY

## 0. Verdict

Roughly **1,490–1,600 lines of redundant code across ~14 duplicate-concept clusters** sit on the identity/auth surface — about **18–20% of the identity-platform app is copy-paste**, concentrated in the page layer (~30% of the app's `.tsx`). Most are merely costly; **five are dangerous to drift** because the copies are security primitives (two Turnstile validators with *different* bypass predicates, a dev-bypass gate forked six ways, a cookie-domain literal in two apps, two hand-rolled JWT implementations, and a gateway that ships two parallel auth backends).

---

## 1. Duplicate-concept clusters

| # | Concept | Locations (file:line) | Dup LOC | Drift risk |
|---|---|---|---:|:--:|
| C1 | **Turnstile server verifier** (different bypass predicates) | `apps/identity-platform/src/lib/turnstile.ts:7-35` ‖ `services/api-gateway/src/middleware/security.ts:219-249` | 35 | **HIGH** |
| C2 | Turnstile client widget | `apps/identity-platform/src/components/TurnstileWidget.tsx` ‖ `apps/storefront-runtime/src/components/security/turnstile-widget.tsx` | 90 | MED |
| C3 | **Cookie-domain default `.letbuyy.store`** | `apps/identity-platform/src/lib/auth/cookies.ts:53-54` ‖ `apps/merchant-control-plane/src/app/api/auth/logout/route.ts:32-38` | 6 | **HIGH** |
| C4 | CSRF validate (3+ impls) | `apps/identity-platform/src/lib/auth/csrf.ts:11-25` ‖ gw `security.ts:251-286` ‖ `apps/identity-platform/src/proxy.ts:43-57` ‖ gw `identity-foundation/csrf-scaffold.ts:13-23` | 70 | **HIGH** |
| C5 | CSRF client reader | `apps/identity-platform/src/lib/csrf-client.ts:9-24` (+`auth-core/src/cookies.ts:32`) | 15 | MED |
| C6 | **Dev-bypass / prod-runtime gate (6 forks)** | id `dev-auth-bypass.ts:13-24` ‖ console `console-auth-server.ts:138-148` ‖ gw `routes/auth.ts:92-108` ‖ gw `security.ts:199-205` ‖ widget ×2 | 60 | **HIGH** |
| C7 | OIDC discovery + JWKS skeleton | id `oidc-disabled.ts:4-104` ‖ gw `identity-foundation/oauth-skeleton.ts:5-97` ‖ gw `mock-key-service.ts:46-68` | 110 | MED |
| C8 | **Hand-rolled JWT sign/verify** (HS256 + ES256) | `auth-core/src/customer-session.ts:143-187` ‖ gw `mock-key-service.ts:139-216`; base64url in 10 files | 110 | **HIGH** |
| C9 | Logout route | id `logout/route.ts:34-53` ‖ merchant-cp `logout/route.ts:14-59` ‖ console `console-auth/logout/route.ts:8-23` | 40 | MED |
| C10 | **Gateway dual auth backend** (custom vs Supabase) | gw `routes/auth.ts:266-1210` vs `:1214-1372` | 150 | **HIGH** |
| C11 | **Page boilerplate** (`Lang`, `translations`, `cycleLang`, top bar, `useAuthTheme`) ×9 | all 9 `…/page.tsx` | 360 | **HIGH** |
| C12 | **login ≈ lookup** clone | `login/page.tsx:1-373` ‖ `lookup/page.tsx:1-635` (282 common lines) | 200 | **HIGH** |
| C13 | reset ≈ set password UI | `reset-password/page.tsx:101-262` ‖ `set-password/page.tsx:125-269` | 110 | MED |
| C14 | misc handlers (`handleOAuth`,`handleTurnstileVerify`) | `login:195-202`,`lookup:394-401`,`forgot:75-77` | 20 | LOW |
| — | base64url ×10 / `timingSafeEqual` ×28 sprawl | auth-core + ~20 gw files | ~120 | MED |

**Total redundant LOC ≈ 1,490–1,600.**

---

## 2. Within-app (identity-platform) detail

- **9-way page boilerplate (C11):** `cycleLang()` (identical 5-line fn) ×9; `translations: Record<Lang,…>` en/hi/ta blocks ×9 (login block 59 lines, lookup 77); top-bar JSX byte-identical ×9; `useAuthTheme()` + `letbuyy_lang` init `useEffect` ×9. Confirmed by `grep -rln "const cycleLang"` returning all 9 page files.
- **login vs lookup (C12):** `comm -12` shows **282 identical non-blank lines** — shared `translations`, `cycleLang`, `handleEmailContinue`, `handleLogin`, `handleOAuth`, `handleTurnstileVerify`, and the entire email-view + password-view render. Both routes are live (`/` redirects to `/lookup` via `proxy.ts:20`; lookup links "use different account" → `/login`). **Already drifting:** `lookup` validates `return_to` and handles rate-limit/bot errors; `login` does neither.
- **reset vs set (C13):** identical password-strength engine and `Input`+`ProgressBar`+`Badge×3` block; diverge only in copy + endpoint.
- **Lib-level:** `csrf.ts` (validate) + `csrf-client.ts` (read) + `proxy.ts:43-56` (mint) are three faces of one CSRF scheme, each hard-coding `letbuyy_csrf`/`lb_csrf`.

---

## 3. Cross-app crypto-primitive sprawl

Hand-rolled **base64url** (`.replace(/\+/g,'-')…`) re-declared in **10 files**; **`timingSafeEqual` reimplemented in 28 files**. Any constant-time/padding fix must be applied in 10–28 places — a latent correctness/security drift surface.

---

## 4. The five drift-dangerous duplicates

1. **C1 — two Turnstile validators with different bypass predicates** (identity strict+flag vs gateway loose, no-flag). A real bot-bypass divergence if env vars differ between Next and Worker runtimes. (Phase 5 §3.)
2. **C6 — "is this prod?" forked six ways** (console checks 3 env vars, gateway-turnstile checks 3 with no flag, widgets check only `NODE_ENV`). One service reading a different variable = an auth bypass in prod.
3. **C3 — cookie-domain `.letbuyy.store` in two apps** while canonical is `letbuyy.com`; the merchant-control-plane copy will be missed at cutover → logout sets a wrong-domain cookie and fails to clear the session. (Phase 4 D2.)
4. **C8 — two JWT implementations + base64url in 10 files** — hand-rolled HS256 and ES256 with bespoke timing-safe compare.
5. **C10 — gateway ships two auth backends** — Supabase-native `/signin|/signup|/password/*` coexist with the opaque-session `/custom/*` stack the UI actually drives; two password-reset flows, two signups, only one wired live (a latent foot-gun, Phase 6 M-7).

---

## 5. Maintenance-cost assessment & method

**Method:** per cluster, redundant LOC = total cluster LOC − one canonical copy, measured via `wc -l` on cited ranges, `diff`/`comm -12` for clone pairs, and `grep -c × per-instance size` for N-way boilerplate. Conservative (shared `translations` keys counted once per extra file).

**Cost:** every auth-behavior change (a new bypass rule, a cookie-domain flip, a CSRF tweak, an i18n string) must be applied in 2–9 places, and the security-primitive clusters mean a *missed* copy is not just a bug but a **vulnerability**. The single highest-leverage cleanup is extracting one shared auth-runtime module (Turnstile + dev-bypass + CSRF + cookie-domain) consumed by identity, gateway, console, and mobile — collapsing C1+C3+C4+C5+C6 (~186 LOC and the five worst drift risks) at once.
