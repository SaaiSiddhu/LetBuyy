# IDENTITY CODEBASE DEBT REPORT
### Phase 3 — Execution Recovery · 2026-06-09 · ANALYSIS-ONLY · architecture FROZEN
### Forensics of `apps/identity-platform` (9,806 LOC ts/tsx/css) + cross-app auth surface

> **Method.** Counts and line refs are from a fresh sweep of the current tree. Severity = blocking-impact on reaching the frozen target: **S0** remove/replace before target reachable · **S1** high drift/maintenance cost · **S2** medium · **S3** hygiene. Paths are repo-relative. **Scope note:** the dormant "v2 foundation" (`packages/*-core`, gateway `identity-foundation/*`, `oauth2/*` skeletons, migration 159) is **FROZEN TARGET, not debt** — it is explicitly excluded from deletion (see §6).

## Codebase shape (current)
| Area | Files | LOC | Note |
|---|--:|--:|---|
| `src/app/globals.css` (shadow CSS) | 1 | **1,986** | ~20% of the whole app in one stylesheet |
| Pages (`page.tsx`) | 10 | 4,056 | 41% of app; heavily duplicated |
| `api/auth` + `api/email` routes | 18 | 1,537 | real orchestration |
| `lib/**` | 17 | 1,610 | auth/session/cookie/csrf/turnstile |
| `oauth2/*` + `.well-known` + `jwks` | 9 | 45 | skeleton wrappers (frozen target) |
| Components | 4 | 280 | |
| `proxy.ts` + `layout.tsx` | 2 | 182 | middleware + root |

---

## S0 — must remove/replace before the frozen target is reachable

### CD-S0-1 · Shadow design system (1,986-LOC `globals.css`) blocks the frozen UI/DS target
- **Evidence:** `src/app/globals.css` = 1,986 lines; **426** raw `px`, **60** `rgb()/rgba()`, a parallel `--text-*/--bg-*` token namespace, `.auth-btn*`/`.auth-field`/`.auth-otp-input` re-implementing `@letbuyy/ui` primitives. **76** `unstyled` usages across `src/app/**` neuter DS components so this sheet can skin them.
- **Impact:** the frozen `IDENTITY_UI_ARCHITECTURE` requires DS-only surfaces; this is a second, competing design system. Cannot reach target while it exists.
- **Remediation:** convert shadow pages to DS components (Wave 2), delete classes as each converts; ban growth in CI. **Effort: L.**

### CD-S0-2 · `login` ≈ `lookup` near-clone (282 identical lines), both live
- **Evidence:** `src/app/login/page.tsx` (375) and `src/app/lookup/page.tsx` (645) share ~282 non-blank lines (email/password views, handlers, i18n); `proxy.ts:16-18` routes `/`→`/lookup`, and lookup links to `/login` — both reachable, already drifting (lookup validates `return_to`/handles rate-limit errors; login does not).
- **Impact:** every auth-UX change must be made twice; behavioral drift is a latent bug/security surface.
- **Remediation:** collapse into one screen + shared `AuthShell` (Wave 2). **Effort: M.**

### CD-S0-3 · Duplicate security primitives that can drift apart
- **Evidence:** **two Turnstile verifiers** — `src/lib/turnstile.ts:7-34` (strict, flag-gated bypass) vs gateway `services/api-gateway/src/middleware/security.ts:219-249` (loose, no-flag bypass); **six** "is-this-prod?" dev-bypass forks (`dev-auth-bypass.ts:13-23`, console `console-auth-server.ts:138-148`, gw `routes/auth.ts:92-108`, gw `security.ts:199-205`, 2 widgets).
- **Impact:** divergent bypass predicates = a bot/auth bypass live in one runtime but not another (this is also Security HIGH — `IDENTITY_SECURITY_REMEDIATION_PLAN`).
- **Remediation:** one shared auth-runtime module; one prod-detection helper (Wave 1). **Effort: M.**

---

## S1 — high drift / maintenance cost

| ID | Debt | Evidence | LOC | Remediation |
|---|---|---|--:|---|
| CD-S1-1 | **9× page boilerplate** — `cycleLang()`, `translations` en/hi/ta, top-bar JSX, `useAuthTheme` hookup duplicated across all 9 pages | every `src/app/*/page.tsx` (e.g. `login:114-119,206-214`) | ~360 | extract `AuthShell` + shared i18n (Wave 2) |
| CD-S1-2 | **Legacy Supabase auth backend** parallel to the custom stack | gw `services/api-gateway/src/routes/auth.ts:1214-1372` | ~160 | delete after IdP cutover (Wave 7) |
| CD-S1-3 | **CSRF logic in 3 places** with hard-coded name pair | `lib/auth/csrf.ts:11-25`, `lib/csrf-client.ts:9-24`, `proxy.ts:43-58` | ~70 | one CSRF module (Wave 1/4) |
| CD-S1-4 | **Hand-rolled crypto sprawl** — base64url ×10 files, `timingSafeEqual` ×28 files | `auth-core` + ~20 gw files | ~120 | shared crypto util (Wave 1) |
| CD-S1-5 | **Cookie-domain literal `.letbuyy.store` duplicated** | `src/lib/auth/cookies.ts:54`; `apps/merchant-control-plane/.../auth/logout/route.ts:33` | ~6 | single `COOKIE_DOMAIN` config (Wave 1, before `.com` cutover) |

---

## S2 — medium

| ID | Debt | Evidence | Remediation |
|---|---|---|---|
| CD-S2-1 | **In-memory auth fallback maps** in prod-shaped gateway code (users/hashes/sessions in process memory) | gw `routes/auth.ts:82-85,925,1058` | delete the local-Map path (Wave 4) |
| CD-S2-2 | **Dual CSRF cookie names** (`letbuyy_csrf` + `lb_csrf` both accepted) | `lib/auth/csrf.ts:22`; `lib/csrf-client.ts:12` | retire `lb_csrf` (Wave 1) |
| CD-S2-3 | **Undefined `--purple` token** consumed (renders broken both themes) + orphan `.auth-label`/`.auth-input` classes (never defined) | `globals.css:212,527` (2 refs); `onboarding/page.tsx:885,950` | define/remove (Wave 2) |
| CD-S2-4 | **`email/resend.ts` at 392 LOC** mixes template + transport; largest lib file | `src/lib/email/resend.ts` | split template/transport (Wave 1, low-pri) |
| CD-S2-5 | **42 inline `style={{…}}`** across 4 pages (onboarding-heavy) | `src/app/**` (onboarding 33, login/lookup/select 9) | tokenize → DS (Wave 2) |

---

## S3 — hygiene
| ID | Debt | Evidence |
|---|---|---|
| CD-S3-1 | Stale/aspirational comment claims a check that doesn't exist | `api/auth/switch/route.ts:12` ("must be in accounts cookie" — not enforced; see Security CRIT) |
| CD-S3-2 | Mixed token namespaces in one string (local `--text-hint` vs `--lb-*`) in Suspense fallbacks | `reset-password:270`, `check-email:216`, `login:369`, `lookup:630` |
| CD-S3-3 | `lb_device` cookie set (90d) with no revocation UI consumer | `lib/auth/cookies.ts:152-159` |

---

## §6. Explicitly NOT debt (frozen target — do not delete)
The recurring trap is treating the dormant rails as dead code. They are the **frozen target, built switched-off** (CODEX StepUp pass): `packages/{session,token,permission,identity,audit,organization}-core`; `services/api-gateway/src/identity-foundation/*` (1,663 LOC incl. `mock-key-service.ts`); `apps/identity-platform/src/app/oauth2/*` + `.well-known/*` + `jwks` (45 LOC of skeleton wrappers, `lib/identity-foundation/oidc-disabled.ts`); migration `159_identity_foundation_core.sql`; the 15 default-off flags (`lib/config/features.ts`). **These are KEEP-and-complete.** The `mock-key-service`/`MOCK_JWKS` is the one piece that must be *replaced* (not deleted) by a real key service (Wave 5) — tracked as Security HIGH, not codebase debt.

## Debt summary
**S0: 3** (shadow DS, login/lookup clone, duplicate security primitives) · **S1: 5** · **S2: 5** · **S3: 3**. Removable/consolidatable LOC ≈ **3,000–3,500** (≈1,986 shadow CSS + ~640 page dup + ~160 legacy + ~190 crypto/CSRF/misc). The debt is concentrated in **the front end (shadow CSS + page duplication = the bulk)** and **duplicated security primitives**; the backend orchestration (api/auth routes, 1,537 LOC) is largely clean and maps cleanly onto the frozen target.
