# TEST COVERAGE REPORT
### Wave 7 — Testing · 2026-06-09 · IMPLEMENTATION (applied) · architecture FROZEN

> Harness: the app uses `node:test` + `tsx` (`apps/identity-platform/package.json` test script → `pnpm exec tsx --test src/__tests__/*.test.ts`). **`pnpm` is unavailable in this sandbox, so `pnpm test` was NOT run here.** The standalone gate script (below) **was executed** (exit 0). Added tests are written to match the existing `node:test`/`assert` style and will run under the workspace harness.

## APPLIED
| Test artifact | Protects | Runnable | Executed here? |
|---|---|:--:|:--:|
| `scripts/governance/identity-security-gate.mjs` | All Wave 0 fixes (structural regression of SEC-C1/C2/C3/H3) | `node` (zero-dep) | **YES — exit 0** |
| `apps/identity-platform/src/__tests__/auth-switch-guard.test.ts` (new) | SEC-H7 (switch rate-limit config) + invariant that switch is ≤ login | `node:test`/`tsx` | No (needs `pnpm test`) — matches existing `rate-limit.test.ts` style |

## SPEC — route-level integration test for SEC-C1 (belongs in the route suite)
The full contract test requires mocking `next/headers` cookies + `identityApiRequest`/`fetch`. Skeleton (to add under the app's route test setup):
```ts
// /api/auth/switch contract (SEC-C1)
test('switch → 401 when no current session', …)            // getSessionCookie()=undefined ⇒ 401
test('switch → 403 when target not in lb_accounts', …)     // session valid, getAccounts()=[] ⇒ 403 + redirect /login
test('switch → 200 only for a proven, verified saved account', …) // session valid + target in accounts + email_verified ⇒ session minted
test('switch → 429 when rate-limited', …)                  // checkRateLimit('switch') denies
```

## SPEC — pure-function unit tests (low effort, high value)
- `getConsoleSessionSecret` (SEC-C2): with `APP_ENV=production` + short secret ⇒ returns `null` (never a literal); dev ⇒ non-null. (platform-console harness.)
- `resolveKmsProviderFromEnv` (SEC-C3): `NODE_ENV=production` + no live key + no `LETBUYY_ALLOW_MOCK_KMS` ⇒ throws `KmsHumanRequiredError`; dev ⇒ mock provider. (gateway harness.)

## Coverage status
- **Wave 0 security: structurally covered now** (runnable gate, verified) + 1 runnable unit test added; full route/integration + pure-fn unit tests specified for the human to add under the test harness.
- **Other waves:** existing suites (`auth-flow.test.ts`, `rate-limit.test.ts`, gateway `security.test.ts`, the 12 workspace test scripts) remain; design-system/theme conversions (Wave 2) need component/visual tests added as those land.

## Human-required blockers
Running the full suite (`pnpm install` + `pnpm test`) requires the workspace toolchain — `[SKIPPED FOR FUTURE]` here (no pnpm/app deps in sandbox). The added tests are written to pass under that harness; a human run is required to confirm green.
