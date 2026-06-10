# FOUNDATION VALIDATION REPORT
### Phase 0 — Reality Validation · 2026-06-09 · code re-audited as source of truth (documents not trusted blindly)

> Re-verified every binding finding against the **current** tree before any change. Classification: **CONFIRMED** (reproduced in code now) · **PARTIALLY CONFIRMED** (true but narrower/with caveats) · **NOT REPRODUCIBLE** (could not reproduce / already false). Two prior-audit items are explicitly **CORRECTED** below.

## A. Security findings

| ID | Finding | Status | Current evidence |
|---|---|:--:|---|
| SEC-C1 | `/api/auth/switch` account takeover | **CONFIRMED** | `apps/identity-platform/src/app/api/auth/switch/route.ts`: reads `email` from body, mints session for any `email_verified` user; **grep confirms NO `checkRateLimit`/`verifyTurnstile`/`getAccounts` imports**; comment (`:10-12`) still claims an accounts-cookie check that does not exist |
| SEC-C2 | Forgeable console super-admin (dev secret) | **CONFIRMED** | `apps/platform-console/src/lib/console-session.ts:30` returns `'dev-only-console-session-secret'`; gate is `NODE_ENV`-only (`:26`) |
| SEC-C3 | Default mock KMS literal | **CONFIRMED** | `services/api-gateway/src/lib/crypto.ts:146` literal secret; `:180` default `'mock'` |
| SEC-H1 | service_role/BYPASSRLS + **dead** RLS path | **CONFIRMED** | `supabase-adapter/index.ts:35` (service_role); `services/api-gateway/src/lib/supabase.ts:10` ("bypasses RLS"); **`getSupabaseUser` caller count = 0** (verified) |
| SEC-H2 | Static shared-token super-admin | **CONFIRMED** | `services/api-gateway/src/middleware/auth.ts:224-226` (`role:'super_admin'`) |
| SEC-H3 | Forgeable `lb_accounts` dev key (`NODE_ENV`-only) | **CONFIRMED** | `apps/identity-platform/src/lib/auth/cookies.ts:11-19` |
| SEC-H6 | Gateway Turnstile bypass needs no flag | **CONFIRMED** | `services/api-gateway/src/middleware/security.ts:199-205,222-224` |
| SEC-H7 | `/switch` + `/lookup` unthrottled; `/lookup` enumerates | **CONFIRMED** | `switch/route.ts` (CSRF-only); `lookup/route.ts:56-60` returns `{exists,hasPassword,emailVerified}` |
| Clickjacking (old audit M-10) | "no frame headers" | **NOT REPRODUCIBLE — CORRECTED** | `apps/identity-platform/src/proxy.ts:59-61` sets `X-Frame-Options: DENY` + `X-Content-Type-Options` + `Referrer-Policy`. Retracted. |

## B. Codebase / duplication findings

| ID | Finding | Status | Current evidence |
|---|---|:--:|---|
| CD-S0-1 | Shadow design system | **CONFIRMED** | `globals.css` = **1,986 LOC**; **76** `unstyled`; **426** raw px; **60** rgb() |
| CD-S0-2 | `login`≈`lookup` clone | **CONFIRMED** | `login/page.tsx` (375) ‖ `lookup/page.tsx` (645); both routed live |
| CD-S0-3 | Duplicate Turnstile (×2) + dev-bypass forks | **CONFIRMED** | `turnstile.ts` ‖ `security.ts:219`; forks in `dev-auth-bypass.ts`, `console-auth-server.ts`, gw `routes/auth.ts`, gw `security.ts` |
| CD-S1-3 | Dual CSRF cookie names | **CONFIRMED** | `csrf.ts:22` + `csrf-client.ts:12` both read `lb_csrf` |
| "v2 foundation is dead" (old framing) | delete candidate | **NOT REPRODUCIBLE — CORRECTED** | migration `159_identity_foundation_core.sql` present; `services/api-gateway/src/identity-foundation/` present; **19 default-off `FEATURE_` flags**. It is **dormant target, not dead code** — KEEP. |

## C. UI / design / theme findings

| Finding | Status | Current evidence |
|---|:--:|---|
| 6/10 pages non-DS (shadow CSS) | **CONFIRMED** | DS-native: forgot/reset/set/check-email; shadow: login/lookup/signup/onboarding/select |
| Design-system compliance ~45% | **CONFIRMED** | 76 `unstyled`, 42 inline styles, 0 hex in TSX (lint works), 33 `var(--lb-` in TSX |
| Undefined `--purple` (broken theme) | **CONFIRMED** | `globals.css:212,527` (2 refs) |
| a11y: silent errors / no focus-visible / unlabelled OTP / dead links | **CONFIRMED** | `signup:513,546,568-582`; `globals.css:371,432,1011,1498` |

## D. Operational / environment reality (decision-critical)
- **This sandbox cannot build the app:** `pnpm` unavailable; `apps/identity-platform/node_modules` absent. `node v22` + root `node_modules` + `scripts/validate-governance.mjs` are present, so the governance validator *may* run, but a full typecheck/Next build/test of the identity app **cannot be performed here.**
- **Consequence:** any code edits I make in this environment **cannot be verified by me** to leave the repo "buildable, testable." Per the mission's own "no fake completion" rule, sweeping unverified edits to production authentication code would be irresponsible to claim as done.
- **Mission rule alignment:** the brief classifies "security review", "KMS provisioning", "production secrets", "OAuth provider registration", "DNS/certs" as **[HUMAN REQUIRED]**. The S0 fixes touch exactly this class (KMS for SEC-C3; security review for auth changes), so they are partially human-gated by the mission's own definition.

## E. Validation verdict
**Every binding S0/S1 finding is CONFIRMED in current code; nothing was "not reproducible" except the two items I proactively correct (clickjacking — already mitigated; the dormant foundation — target, not debt).** The plan is sound and grounded. The gating reality for *execution* is not the findings (they're real) but **verification**: this environment cannot compile/test the monorepo, so the safe path is surgical, individually-reviewable changes — not an unverified non-stop repo-wide rewrite.

→ Proceeds to the execution-mode decision (Phase 0 → Phase 1 gate).
