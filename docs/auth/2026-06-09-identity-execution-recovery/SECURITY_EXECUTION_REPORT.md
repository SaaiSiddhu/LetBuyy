# SECURITY EXECUTION REPORT
### Wave 0 — Security Recovery · 2026-06-09 · IMPLEMENTATION (real edits applied)

> **Verification status (read first, honest).** This sandbox cannot run the monorepo's TypeScript build (`pnpm` unavailable, `apps/identity-platform/node_modules` absent) or a full `validate-governance.mjs` (it crashes on `EPERM unlink .next/BUILD_ID` — a mounted-FS permission limit, after passing the environment + generated-artifact + no-op-test validators over 4,419 files). Therefore every code change below is **verified type-correct by inspection** (exact signatures of all imported symbols confirmed present) but **NOT compiled/tested here**. All edits are surgical and were written to be build-safe. **A human build + security review is still required before merge** — the brief classifies "security review" as `[HUMAN REQUIRED]`.

## Summary
| ID | Severity | Status | Files changed |
|---|:--:|:--:|---|
| SEC-C1 | Critical | **FIXED (applied)** | `apps/identity-platform/src/app/api/auth/switch/route.ts`, `…/lib/rate-limit.ts` |
| SEC-C2 | Critical | **FIXED (applied)** | `apps/platform-console/src/lib/console-session.ts` |
| SEC-C3 | Critical | **FIXED (applied, staged)** + `[HUMAN REQUIRED]` KMS provisioning | `services/api-gateway/src/lib/crypto.ts` |
| SEC-H3 | High | **FIXED (applied)** | `apps/identity-platform/src/lib/auth/cookies.ts` |
| SEC-H7 | High | **FIXED (applied)** (switch throttled) | `…/switch/route.ts`, `…/rate-limit.ts` |
| SEC-H2 | High | **SPEC ONLY** + `[HUMAN REQUIRED]` | gateway integration — not safely editable blind (see below) |

---

## SEC-C1 — `/api/auth/switch` account takeover → FIXED
**Before:** route read `email` from the request body and minted a session for any `email_verified` user, guarded only by CSRF (defeatable same-origin via the JS-readable `letbuyy_csrf`). No session, rate-limit, or accounts-cookie check. The doc-comment claimed an accounts-cookie check that did not exist.
**After (applied):** the route now enforces, in order — `checkRateLimit('switch', ip)` → `validateCsrf` → **a valid current session** (`getSessionCookie` + `validateSession`; 401 if absent) → **target email must be present in the signed httpOnly `lb_accounts` cookie** (`getAccounts()`; 403 + redirect to `/login?email=` otherwise). Only then is a session minted. Evidence: `switch/route.ts:35,57-58,69-73`.
**Why this is correct & build-safe:** uses only existing exported helpers (`validateSession` `session.ts:38`, `getAccounts` `cookies.ts:198`, `checkRateLimit` `rate-limit.ts:89`). It removes the unauthenticated takeover: an attacker with no session and no prior login to the victim on this device cannot pass either new gate (the `lb_accounts` cookie is httpOnly + signed; forging it requires `AUTH_SECRET`, whose weak-key path is closed by SEC-H3).
**Residual / risk:** retains a device-trust property (an account previously authenticated on this device can be re-entered while signed into another) — acceptable for a "quick switch" and explicitly superseded by per-account sessions (`account_links`) in a later wave. **Risk of regression:** low; behavior change is a tightening. Legitimate switch from the saved-accounts list still works because those accounts are in `lb_accounts`.
**Test coverage:** route-level regression test specified in `TEST_COVERAGE_REPORT.md` (needs the app test harness to run); the contract is: no-session→401, session+unproven-target→403, session+proven-target→200.

## SEC-C2 — Forgeable console super-admin secret → FIXED
**Before:** `getConsoleSessionSecret()` returned the literal `'dev-only-console-session-secret'` whenever `NODE_ENV !== 'production'` — a `NODE_ENV`-only gate (`console-session.ts:26,30`).
**After (applied):** the production gate now checks `NODE_ENV` **and** `APP_ENV` **and** `VERCEL_ENV` (matching `console-auth-server.isProductionConsoleRuntime`); in any production-like runtime it returns the configured secret only if `isSafeSecret`, else **`null` (fail closed)** — never a literal. The dev literal is reachable only in true non-production. Evidence: `console-session.ts:23-39`.
**Risk:** low — strictly tightens; prod already returned null for unsafe secrets, this closes the `APP_ENV/VERCEL_ENV`-set-but-`NODE_ENV`-unset hole.
**Test:** pure-function unit test added (`TEST_COVERAGE_REPORT.md`) — deterministic over `process.env`.

## SEC-C3 — Default mock KMS → FIXED (staged) + [HUMAN REQUIRED]
**Before:** `resolveKmsProviderFromEnv` defaulted to the mock provider, which wraps field encryption with the in-repo literal `'letbuyy-local-mock-kms-envelope-secret'` (`crypto.ts:146,180`). Mock was the silent production default.
**After (applied):** in a production-like runtime (`NODE_ENV/APP_ENV/VERCEL_ENV`, read from the passed env with a `process.env` fallback that is Workers-safe via `typeof process` guard) the function now **throws `KmsHumanRequiredError`** unless an explicit migration escape hatch `LETBUYY_ALLOW_MOCK_KMS=true` is set. Secure-by-default, fail-closed. Evidence: `crypto.ts:175-193`.
**Why staged (not a hard throw):** flipping a hard fail-closed into a running production system without a provisioned KMS would cause an outage. The escape hatch lets ops stage the cutover, then remove it once live KMS exists.
**[HUMAN REQUIRED]:** provision a live KMS (`LETBUYY_KMS_MODE=live` + key id/policy, HR-KMS-LIVE) and remove the escape hatch. Rotate any data wrapped with the literal. `[SKIPPED FOR FUTURE]` here — cannot provision cloud KMS from this environment.

## SEC-H3 — Forgeable `lb_accounts` dev signing key → FIXED
**Before:** `getSigningKey()` fell back to `'dev-only-insecure-auth-secret-set-AUTH_SECRET-in-prod'` under a `NODE_ENV`-only gate (`cookies.ts:14`).
**After (applied):** now refuses the weak key in any production-like runtime via `isProductionIdentityRuntime(process.env)` (checks `NODE_ENV/APP_ENV/VERCEL_ENV/NEXT_PUBLIC_ENV`). Evidence: `cookies.ts:3,13-19`. Reuses the existing helper (no new logic, no cycle).
**Risk:** low — tightening.

## SEC-H7 — `/switch` unthrottled → FIXED
Added `switch: { limit: 5, window: '15 m', prefix: 'rl:switch' }` to `AUTH_RATE_LIMITS` (`rate-limit.ts:45`) and wired `checkRateLimit('switch', ip)` into the route. `/lookup` enumeration is **not** changed here (the login UX branches on its `exists/hasPassword` response); the non-enumerating redesign is a product-gated change deferred to the OIDC wave — recorded in the debt register.

## SEC-H2 — Static shared-token super-admin → SPEC ONLY + [HUMAN REQUIRED]
`services/api-gateway/src/middleware/auth.ts:224-226` mints a hardcoded `super_admin` principal for any caller bearing `PLATFORM_CONSOLE_API_TOKEN`. **Not edited:** changing this touches the live platform-console→gateway integration and cannot be build-verified here; a blind change risks breaking ops. **Remediation (for human):** scope the token to specific read-only operations, add per-principal attribution, and rotate. `[HUMAN REQUIRED]` security + integration review.

---

## Net Wave 0 result
**3 of 3 Criticals and 2 of 3 in-scope Highs fixed in code; 1 High (SEC-H2) spec'd for human review; KMS provisioning is the one external `[HUMAN REQUIRED]` blocker.** Files touched: 5 (`switch/route.ts`, `rate-limit.ts`, `cookies.ts`, `console-session.ts`, `crypto.ts`). LOC impact: ~+95 / −20. No architecture changed. **Merge blocked on: human build + security review** (per brief). Regression tests + the CI security gate that fails if these regress are in `TEST_COVERAGE_REPORT.md` / `GOVERNANCE_ENFORCEMENT_REPORT.md`.
