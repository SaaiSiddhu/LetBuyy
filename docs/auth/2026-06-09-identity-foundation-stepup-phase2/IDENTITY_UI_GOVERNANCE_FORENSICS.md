# IDENTITY UI GOVERNANCE FORENSICS
### Phase 2 Recovery Mission · 2026-06-09 · ANALYSIS-ONLY · measured against CURRENT tree

## Route & shell hierarchy (verified)
- **Middleware/router:** `src/proxy.ts` (Next 16 middleware) — `/`→`/select` if session else `/lookup` (`:16-22`); accidental admin paths → admin app (`:24-27`); `/api/*`,`/_next/*` passthrough (`:28-30`); only `/set-password` is a `PROTECTED_ROUTES` entry (`:5,38-43`); mints CSRF + sets security headers (`:48-69`).
- **Routes (10 pages):** `page`(redirect), `login`, `lookup`, `signup`, `onboarding`, `select`, `check-email`, `forgot-password`, `reset-password`, `set-password`. Plus 18 `api/*` route handlers + 9 `oauth2/.well-known/jwks` skeletons.
- **Shell:** `layout.tsx` provides theme provider only. **There is no `AuthShell`/`AuthLayout` component** — the lang/theme top bar + brand + i18n are **hand-inlined in every page**.

## Duplication (the dominant UI-governance debt)
| Cluster | Evidence | Severity |
|---|---|:--:|
| **`login` ≈ `lookup` near-clone** | `login/page.tsx` (375) ‖ `lookup/page.tsx` (645) — shared email/password views + handlers; ~282 common lines; both routed live (`proxy.ts:21` → `/lookup`; lookup links `/login`). **Already drifted** (lookup validates `return_to` + handles rate-limit/bot errors; login does not) | **S0** |
| **9× page boilerplate** | `cycleLang()`, `translations` (en/hi/ta), top-bar JSX, `useAuthTheme` hookup duplicated across all 9 page files (`login:114-119,206-214` + 7 others) | **S1** |
| **Top bar inlined ×8** | `TopBar` is a local component only in `onboarding/page.tsx:1050`; hand-inlined everywhere else | **S1** |
| **Suspense fallbacks (one-off, inline-styled)** | `login:369`, `lookup:630`, `select:187`, `check-email:216`, `reset:270` | **S2** |
| **Hand-rolled user menu** | `showUserMenu`/`setShowUserMenu`/`onToggleUserMenu` (12+9+4 refs) — a bespoke dropdown instead of a DS primitive | **S2** |

## Flow / onboarding / navigation hierarchy
- **Auth flow:** lookup → (exists? password : signup) → login/verify-otp → set-password → (store-count) → onboarding | select | admin redirect. Coherent but the lookup→login split is the source of the clone.
- **Onboarding:** a single 1,090-LOC `onboarding/page.tsx` with 3 styling paradigms (DS steps 1-3, shadow+inline steps 4-6) — the largest, least-governed file.
- **Navigation:** redirect-driven (server `proxy.ts` + per-route `redirectTo` in API responses); no client router/nav component; cross-app handoff to `admin.*` via full URLs (`config/urls.ts`).

## Governance gaps
1. **No shared shell** → 8-9× duplication of chrome/i18n (extract `AuthShell` — the single highest-leverage UI consolidation).
2. **Two live routes for one screen** (`/login` + `/lookup`) → merge.
3. **No layout primitives** (card/page/section) → every page hand-builds structure via shadow CSS.
4. **i18n is per-page literal tables** (en/hi/ta) → centralize into one module.

## Recommendation (analysis-only)
Extract `AuthShell` + `AuthLayout` + one i18n module; merge `login`/`lookup`; convert onboarding's 3 paradigms to one. This is detailed in `docs/auth/2026-06-09-identity-execution-recovery/UI_GOVERNANCE_REPORT.md`. **Severity: S0 for the login/lookup clone (drift = latent bug/security surface), S1 for the missing shell.**
