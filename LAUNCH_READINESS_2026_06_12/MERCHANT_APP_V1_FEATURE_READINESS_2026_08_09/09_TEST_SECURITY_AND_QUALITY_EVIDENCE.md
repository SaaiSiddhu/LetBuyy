# 09 — TEST, SECURITY AND QUALITY EVIDENCE

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `ee371182` (`stepup/main`), working tree dirty and user-owned
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.
No generated artifact is treated as evidence here.

Every row below is **LOCAL RUNTIME** — a command actually executed on this machine on 2026-08-09,
with its real exit code. Raw output is retained under `/tmp/letbuyy-v1-run-2026-08-09/`.
Nothing in this document was executed against staging or production.

---

## 1. Headline

| | |
|---|---|
| Repository governance gate (`pnpm validate:governance`) | **RED** — fails; see §3 |
| Foundation waves 0–6 | **6 of 7 green** after this program's fixes; wave 5 red (§4) |
| Flutter merchant app | **GREEN** — `analyze` clean, **164/164** tests pass (§5) |
| API-gateway suite | **RED** — 544/551 pass, **7 fail**, all from the user's in-flight refactor (§6) |
| Real-Postgres behavioural proofs | **4 of 4 green** (§7) |
| CI on the active branch | **DOES NOT RUN** — `ci.yml` triggers only on `develop`/`main` (§8) |

## 2. Environment

```
Flutter 3.44.8 stable · Dart 3.12.2 · DevTools 2.57.0
Node: repo pins NODE_VERSION 20 (ci.yml), pnpm 10.6.2
Docker: available. Ephemeral Postgres fixture container `letbuyy-executable-pg`
        (postgres:16-alpine, no host port binding).
```

> The `letbuyy-executable-pg` container **pre-existed in a stopped state**; this program started it
> via `pnpm foundation:pg:start` and restored that state afterwards. The user's unrelated containers
> (`papaa-escola-local-db`, `pixlnova-postgres`) were never touched.

## 3. Repository validator gates

`pnpm validate:governance` (lane=gate) — **exit 1**.

**Structural finding: the gate runner is fail-fast** (`scripts/validate-governance.mjs:201-203`). It
aborts at validator **index 5 of 108** (`validate-design-system.mjs`), so **102 validators never
execute** — including `prompt-perimeter-validator` at index 106. A red gate here therefore hides
unknown further failures; "the gate is red for one reason" cannot be assumed.

Per-lane results, run individually:

| Command | Exit | Cause | Owner |
|---|---|---|---|
| `validate:architecture` | 1 | design-system only (below) | user's worktree |
| `validate:dependencies` | 1 | 3 undeclared imports | **pre-existing at HEAD** |
| `validate:runtime` | 0 | — | — |
| `validate:topology` | 0 | — | — |
| `validate:migrations` | 1 | retired root `supabase/config.toml` | **pre-existing at HEAD** |
| `validate:deployment` | 0 | — | — |
| `validate:tenant-isolation` | **0** | fixed by this program | was 1 |
| `validate:production-safety` | 0 | — | — |
| `validate:session-security` | 0 | — | — |
| `validate:reconciliation` | 0 | — | — |
| `validate:tests` | 0 | — | — |
| `validate:security` | 1 | `packages/lcis-adapters/*` provider-URL isolation | **pre-existing at HEAD** |
| `validate:mobile-tokens` | **0** | mobile tokens in sync with the DTCG source | — |

**Ownership was proven, not assumed.** `git diff --numstat` on every file implicated by the
`dependencies`, `migrations` and `security` failures returns **empty** — those files are
byte-identical to `ee371182`, so those three failures are **pre-existing at HEAD**, not caused by
the working tree and not caused by this program.

### 3.1 The design-system failure is the user's uncommitted work

```
HARD invariants: 2 violation(s)
  - marketing-site: dark mode must be reachable through the canonical provider toggle
  - developer-portal: dark mode must be reachable through the canonical provider toggle
RATCHET regressions: appCssRawHex 0->156, appCssNakedRgbHsl 572->822,
  appLocalLbTokenRedefs 112->339, rawPxFontSize 533->612, rawPxSpacing 1365->1584,
  tsxInlineStyles 635->673, tsxRawHex 0->5, tsxArbitraryRadius 327->388,
  tsxArbitraryShadow 8->9
(one improvement: tailwindPaletteClasses 588 -> 537)
```

Attribution, measured directly:

| File | raw hex at `ee371182` | raw hex in worktree |
|---|---|---|
| `apps/developer-portal/src/app/globals.css` | **0** | **55** |
| `apps/merchant-control-plane/src/app/globals.css` | 26 | 28 |

The drift is concentrated in `apps/developer-portal` — a **constitutionally frozen app** (ART-22) —
and `apps/marketing-site`. **Neither is in the merchant-app V1 scope**, and
`validate:mobile-tokens` passes, so the mobile app is not implicated.

> **This program did not run `validate-design-system.mjs --update`.** UI-R7 requires the ratchet to
> **block** new drift, never baseline it; running `--update` would convert a real regression into a
> green gate and is exactly the governance-theater ART-02 forbids. The drift belongs to the user's
> in-flight work and is theirs to resolve.

## 4. Foundation waves

| Wave | Command | Exit | Note |
|---|---|---|---|
| 0 | `pnpm test:foundation:wave0` | 0 | |
| 1 | `pnpm test:foundation:wave1` | **0** | was **1**; fixed by this program (§4.1) |
| 2 | `pnpm test:foundation:wave2` | 0 | tenant |
| 3 | `pnpm test:foundation:wave3` | **0** | was **1**; fixed by this program (§4.2) |
| 4 | `pnpm test:foundation:wave4` | 0 | session security |
| 5 | `pnpm test:foundation:wave5` | **1** | design-system ratchet — the §3.1 user drift |
| 6 | `pnpm test:foundation:wave6` | 0 | theme-engine + theme governance |

### 4.1 Wave 1 was deterministically broken (money gate)

```
ERROR:  relation "public.store_customers" does not exist
  at resetDatabase (tests/executable/foundation-wave1-money-postgres.test.mjs:139)
```

`resetDatabase()` drops the schema, creates fixture tables, then replays five migrations. One of
them — `142_executable_payment_sessions.sql:28` — declares
`customer_id uuid REFERENCES public.store_customers(id)`, but the fixture created only
`public.customers`. **The Wave 1 money gate could never pass.**

**Fix:** added the missing `public.store_customers` fixture table, matching how sibling suites
already fixture it (`tests/executable/tenant-redteam-postgres.test.mjs:139`,
`tests/executable/security-postgres.test.mjs:78`). After the fix the suite passes with real
behavioural assertions firing:

```
ERROR:  payout statement 33333333-...-333333333333 is not pending for release
ERROR:  insufficient merchant payable balance for payout 44444444-...,
        balance=19600, required=999999
✔ Wave 1 money ledger migration backfills, reconciles, claims payouts, and rolls back
```

i.e. the double-release guard and the **derived**-balance insufficiency check both work.

### 4.2 Wave 3 asserted a constitutionally forbidden value (governance theater)

`tests/governance/foundation-wave3-production-safety.test.ts` contained a test **named**
*"domain defaults stay on letbuyy.com until DNS cutover is approved"* whose assertion required the
opposite:

```js
assert.match(source, /const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy\.store'/, file);
```

DEPLOY-R3 states `letbuyy.com` is the one canonical domain and **bans `letbuyy.store` literals**.
All four asserted files already correctly declare `letbuyy.com`. The test was therefore failing the
build *for complying with the Constitution* — an ANTI-R3 governance-theater defect.

**Fix:** assertion corrected to `letbuyy.com`, matching both DEPLOY-R3 and the test's own name.
Wave 3 now passes **4/4**, including the two invariants worth naming:

```
✔ production rate limiting fails closed when no backend is ready
✔ sandbox registrar stays gated and no longer emits success-shaped fake payloads
```

## 5. Flutter merchant app

```
LOCAL RUNTIME  flutter analyze  -> exit 0  "No issues found! (ran in 3.9s)"
LOCAL RUNTIME  flutter test     -> exit 0  "00:04 +164: All tests passed!"
```

**Before this program: 159 tests with 5 failures.** All five shared one root cause — a Flutter
framework assertion:

> *ListTile background color or ink splashes may be invisible. The ListTile is wrapped in a
> DecoratedBox that has a background color... To fix this, wrap the ListTile in its own Material
> widget, or remove the background color from the intermediate DecoratedBox.*

Failing: `NotificationsScreen renders persisted toggles`, `PageEditorScreen renders create form
fields`, `PostEditorScreen renders create form fields`, `TaxesScreen renders inclusive setting and
tax rates`, `TaxesScreen saves inclusive pricing through StoreService`.

This is a **real affordance defect**, not a test artifact: a `SwitchListTile` inside a coloured
`Container` paints its ink splash on a hidden `Material`, so the tap feedback is invisible to the
merchant. **Fix:** each affected tile now has its own `Material(type: MaterialType.transparency)`
ancestor, in `taxes_screen.dart`, `notifications_screen.dart`, `page_editor_screen.dart`,
`post_editor_screen.dart` (the latter two via their shared `_switchRow`/`_toggle` helpers, which
fixes every call site).

> The five failures were surfaced by the **Flutter SDK version**, not by a repository change.
> CI resolves Flutter with `channel: stable` and no pin, so a Flutter release can turn the suite red
> with no commit. Recorded as STORE-06 in doc 13.

### 5.1 Skipped-test register (skipped tests contribute ZERO evidence)

| Test | Location | Skip condition | Consequence |
|---|---|---|---|
| `merchant_happy_path_test.dart` (the **only** integration test) | `apps/mobile/merchant-app/integration_test/merchant_happy_path_test.dart:123` | `skip: !AppConfig.hasTurnstileToken` | `TURNSTILE_TOKEN` is the sentinel `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN` in **both** dart-define files, so this test **never runs** in any checked-in configuration. |

**The merchant app therefore has zero executing end-to-end integration coverage.** Its 164 passing
tests are unit and widget tests against mocked services. Under the scoring model this caps every
mobile capability at **69** ("no automated happy-path integration test"), which is the single
largest reason the merchant app cannot be certified launch-proven.

## 6. API-gateway suite — 7 failures, none from this program

```
LOCAL RUNTIME  npx tsx --test services/api-gateway/src/__tests__/*.test.ts
               -> exit 1 · tests 551 · pass 544 · fail 7 · skipped 0
```

| Failing test | Assertion that failed |
|---|---|
| `store publish updates only owned sites to published with a timestamp` | `/\.or\(`custom_user_id\.eq\.\$\{customUser\.id\},...`\)/` |
| `store health computes mobile readiness from real owned store signals` | same |
| `store PATCH accepts business profile and invoice address fields` | same |
| `public storefront resolver only exposes published stores by handle` | `/\.or\(`subdomain\.eq\.\$\{normalized\},...`\)/` |
| `merchant AI route is mounted, mobile allowlisted, and provider-backed` | `/adapter\.purchase/` |
| `storefront runtime no longer owns payment route handlers` | `/storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/stripe\/checkout'/` |
| `executive analytics migration creates rollup tables with service-role and super-admin RLS` | (migration text assertion) |

**Cause: the user's uncommitted in-flight security hardening.** `services/api-gateway/src/routes/stores.ts`
now routes ownership predicates through a new `ownedByCustomUserFilter()` helper that double-quotes
the value so a comma or parenthesis cannot rewrite a PostgREST `.or()` predicate — a genuine
filter-injection hardening. Five of the seven tests are **source-regex assertions that pin the old
literal string**, so a correct security fix broke them.

**This program did not cause these and did not silently repair them**, because the refactor is
**incomplete**: `stores.ts` is fully converted (12 helper uses, 0 inline predicates left), but the
same unquoted pattern remains in at least ten other gateway files — `auth-user.ts:55,74`,
`order-ownership.ts:11`, `theme-execution.adapter.ts:296`,
`theme-marketplace-auxiliary-routes.ts:413`, `portfolio.ts:150`, `blog.ts:589`,
`inventory.ts:1243`, `metafields.ts:172`, `coupons.ts:303`. Updating the tests now would bless a
half-applied security change. Recorded as a blocker in doc 07, owned by the user.

> **Independent quality finding:** these are **source-regex tests**. They assert that a specific
> string appears in a source file, not that the endpoint behaves correctly. They are barely stronger
> than the file-presence checks TEST-R10 forbids, and they penalise correct refactors while
> providing no behavioural guarantee. They should be replaced with behavioural assertions.

## 7. Real-Postgres behavioural proofs (the strongest evidence in this package)

| Suite | Exit | What was actually proven |
|---|---|---|
| `tests/executable/money-ledger-postgres.test.mjs` | 0 | Append-only enforcement is real: `ERROR: ledger is append-only; use reversing entries` fired on **both** UPDATE and DELETE (PAY-R6 / R-6). |
| `tests/executable/tenant-redteam-postgres.test.mjs` | 0 | `✔ CAP-C11 RT-1 through RT-9 pass under app_tenant and raw-REST roles` — the cross-tenant red team passes under a **non-BYPASSRLS** role (TEST-R4, ART-08). |
| `tests/executable/foundation-wave4-session-postgres.test.mjs` | 0 | Merchant session migration rotates, **rejects reuse**, and rolls back. |
| `tests/executable/foundation-wave1-money-postgres.test.mjs` | 0 (after §4.1 fix) | Double-release guard + derived-balance insufficiency both enforced. |

These four are the only claims in this package proven against a live database engine. They are also
the reason the **money and tenancy kernels** score highest in doc 03: they are the parts of LetBuyy
with genuine behavioural proof.

## 8. CI does not run on the active branch

```
.github/workflows/ci.yml:3-11
on:
  pull_request:  branches: [develop, main]
  push:          branches: [develop, main]
```

The active integration branch is **`stepup/main`**. It matches neither trigger, so **no typecheck,
lint, unit test, governance gate, or Flutter merge gate runs on it at all.**

The `merge-safety-gate` job — which does run `flutter analyze` and `flutter test`
(`ci.yml:163-173`) plus a full-repo typecheck, gateway unit tests, behavioural and contract tests —
only applies to PRs targeting `develop`/`main`.

**Branch lag (DEPLOY-R1 requires 0):**

```
git rev-list --count main..stepup/main          106
git rev-list --count origin/main..stepup/main   291
```

The consequence for this package: **local green ≠ CI green ≠ deployed.** Every result in this
document is local-only, and no deployment has been observed or claimed.

## 9. Security verification performed

| Check | Result |
|---|---|
| Cross-tenant red team RT-1…RT-9 on real Postgres | **PASS** (§7) |
| Tenant-table registry completeness | **FIXED** — 4 tenant tables from already-merged migrations 176/185 (`site_domains`, `site_domain_verifications`, `founding_merchant_allocations`, `subscription_coupon_redemptions`) were unregistered, so the isolation validator was not checking them. Registry regenerated → "265 tenant tables registered; 0 direct service-role bypasses found". |
| Mobile token storage (SEC-R4) | **PASS** — auth tokens go to `FlutterSecureStorage` (Keychain/Keystore) in `lib/services/store_auth_service.dart:5,106,119`. `SharedPreferences` holds only `store_user_email` (`login_screen.dart:122,157,176`, `otp_screen.dart:61`) — a convenience value, not a credential. *(Minor: that email is PII stored unencrypted; a DPDP consideration, not a blocker.)* |
| Committed secrets | **NONE FOUND.** `services/api-gateway/.dev.vars` exists locally and is correctly ignored (`.gitignore:93`). No secret value is reproduced anywhere in this package. |
| `commission_bps = 0` (ART-12 / PAY-R3) | **ENFORCED** — `162_phase_a_commission_zero.sql:4,7` sets `DEFAULT 0`; `scripts/validators/commission-bps-zero-validator.mjs` is the ratchet. *Residual:* `routes/commission.ts:292` still computes `grossAmountMinor * commission_bps / 10000` and the CHECK permits 0–10000, so a non-zero row would produce a fee. The default and the ratchet are the control. |
| `letbuyy.store` domain literals (DEPLOY-R3) | **FIXED** — 5 live literals in the merchant onboarding path removed (§10). Remaining matches are `com.letbuyy.store/...` MethodChannel/app-group identifiers and `letbuyy.storeId`, all false positives. |
| Third-party code execution in a live path (ART-16 / NEVER-R3 / R-12) | **VIOLATION FOUND** — see doc 07 / doc 05. `FEATURE_EXTENSIONS` is correctly `"false"` in `[env.production.vars]`, but `extensionsFeatureGate` only covers the `/extensions` paths. `POST /app-store/installations/:id/embed-session` and `POST /app-store/bridge/fetch` are **not** behind it, and the Flutter `app_bridge_runtime_screen.dart` runs a WebView that injects a native bridge and executes remote JavaScript, passing an attacker-controllable `path` into a merchant-session-scoped data proxy. |

## 10. Complete list of changes this program made

Every change is uncommitted. Nothing was committed, pushed, or deployed.

| # | File(s) | Change | Verified by |
|---|---|---|---|
| 1 | `services/api-gateway/src/tenant/tenant-tables.registry.ts` | Regenerated (261 → 265 entries) via the generator the validator itself names | `validate:tenant-isolation` 1 → 0 |
| 2 | `tests/executable/foundation-wave1-money-postgres.test.mjs` | Added the missing `public.store_customers` fixture | wave1 1 → 0 |
| 3 | `tests/governance/foundation-wave3-production-safety.test.ts` | Corrected an assertion that required the forbidden `letbuyy.store` literal | wave3 1 → 0 (4/4) |
| 4 | `apps/identity-platform/src/lib/config/urls.ts` + `api/auth/create-store/route.ts` + `onboarding/page.tsx` + `select/page.tsx` | Added `getPlatformRootDomain()/getStorefrontHost()/getStorefrontUrl()`; replaced 5 live `letbuyy.store` literals that told every new merchant their store lived on a dead domain | `tsc --noEmit` exit 0; wave3 green; 0 real literals remain |
| 5 | `taxes_screen.dart`, `notifications_screen.dart`, `page_editor_screen.dart`, `post_editor_screen.dart` | Gave each `SwitchListTile` its own `Material` ancestor | `flutter test` 159/5-fail → **164/164**; `flutter analyze` clean |
| 6 | `services/api-gateway/src/routes/stores.ts` | Publish paths now write the `sites.published` boolean the storefront actually gates on, in lockstep with `status` | `tsc --noEmit` exit 0; `published` is not client-settable (not in the PATCH allowlist), so it stays server-authoritative |
| 7 | `apps/mobile/merchant-app/android/app/src/main/AndroidManifest.xml` | Declared `INTERNET` explicitly instead of inheriting it transitively from a plugin manifest | release manifest-merge diff + `flutter build apk --release` exit 0 |

Changes 5 and 7 were re-formatted with `dart format` at the repository's default width after an
initial pass used a non-matching `--line-length 100`; the committed diffs contain only the
semantic change.
