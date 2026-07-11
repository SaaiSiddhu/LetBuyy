# Phase AE — Security Review: Marketplace + Partner Readiness

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AE — Marketplace + Partner Readiness
**Date:** 2026-07-11
**Reviewer:** Phase AE documentation pass (ground-truth verified)
**Status:** REVIEW COMPLETE — 1 MEDIUM finding FIXED in-phase (fail-closed depth guard); 2 LOW findings open (deferred)

---

## 1. RISK-SEC-001 Disposition: FIXED

### 1.1 Evidence of the defect (baseline)

`database/supabase/migrations/000_baseline.sql` contains two wide-open RLS policies on `public.theme_purchases`:

```sql
-- line 24159
CREATE POLICY "Users create theme purchases"
  ON public.theme_purchases FOR INSERT
  WITH CHECK (true);

-- line 24201
CREATE POLICY "Users view own theme purchases"
  ON public.theme_purchases FOR SELECT
  USING (true);
```

Both omit a `TO` clause. In PostgreSQL, a policy with no `TO` clause is effective for `PUBLIC` — meaning anon, authenticated, and service_role all match it. This allows any Supabase-auth-session client to:
- `SELECT` all `theme_purchases` rows regardless of ownership.
- `INSERT` a purchase record with any `user_id`.

No subsequent migration (073–190) narrows either policy. RISK-SEC-001 was registered as HIGH at Phase M, carried through Phases N–AD, and targeted at Phase AE.

### 1.2 Remediation: Migration 191

`database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` (93 lines, NEW) implements the following:

```sql
-- Step 1: Remove both wide-open baseline policies
DROP POLICY IF EXISTS "Users create theme purchases" ON public.theme_purchases;
DROP POLICY IF EXISTS "Users view own theme purchases" ON public.theme_purchases;

-- Step 2: Gateway pass-through (explicit; matches migration 163 D2 pattern)
CREATE POLICY tp_service_role
  ON public.theme_purchases FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Step 3: Authenticated SELECT — own records only
CREATE POLICY tp_authenticated_select
  ON public.theme_purchases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Step 4: Authenticated INSERT — own user_id only
CREATE POLICY tp_authenticated_insert
  ON public.theme_purchases FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

**Idempotency:** `DROP POLICY IF EXISTS` before each `CREATE POLICY` — safe to replay without error.

**Migration safety validator:** PASS — no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `RENAME` patterns.

**Production apply:** ARB-gated. Migration 191 is committed but must not be applied to production without explicit ARB sign-off, consistent with the treatment of migrations 188/189/190.

### 1.3 Architecture note: user_id FK vs auth.uid()

`theme_purchases.user_id` is a foreign key to `users_custom(id)`, not to `auth.users(id)`. These are two separate UUID namespaces:

- `users_custom.id` — the platform's custom auth table UUID.
- `auth.uid()` — the Supabase auth UUID for the current session.

Effective behaviour of the new authenticated policies:
- **Gateway (service_role):** RLS bypassed entirely — no change from before, since service_role bypasses all RLS regardless.
- **Direct authenticated client:** `user_id = auth.uid()` will match only if `users_custom.id` and the Supabase auth UUID coincide for the same session. In the current architecture, the gateway is the canonical path; direct authenticated client access to `theme_purchases` is not the intended flow. The effective result is that any direct authenticated client sees only the rows (if any) where the UUID values coincide — not cross-tenant rows. This is the correct defensive posture.

**Residual risk:** If a `users_custom.id` value ever coincidentally matches a different user's `auth.uid()`, that user would gain access to the other's purchase rows. This is addressed in the LOW-severity finding RISK-AE-SEC-003 below.

**Long-term remediation** (not in Phase AE scope): add `auth_id uuid REFERENCES auth.users(id)` column to `users_custom` and rewrite the policies as `auth_id = auth.uid()`. This closes the UUID-space gap structurally. Requires a new migration and ARB sign-off.

---

## 2. Marketplace Gate Fail-Closed Proof

### 2.1 Never throws

`validateThemeForMarketplace(rawBundle: unknown)` wraps all validator calls in try/catch. The paranoid path (Stage K passes but `parseLiquidThemePackageBundle` re-parse fails) also returns `ok: false` with a K-stage violation rather than propagating an exception.

Evidence: the function signature returns `ThemeMarketplaceValidationResult`, not `ThemeMarketplaceValidationResult | never`. Tests `AE-FC-01` through `AE-FC-04` verify fail-closed behaviour for `undefined`, `'string'`, `[]`, and `42` inputs — all return `ok: false`.

### 2.2 Any error state produces ok: false

The result's `ok` field is set as `blockingViolations.length === 0`. Advisory violations (Stage K parity-gap, lint-warn, `advisory: true`) are never counted in `blockingViolations`. There is no code path that produces `ok: true` when blocking violations exist.

### 2.3 Stage K hard failure skips noisy downstream stages

When Stage K produces `schema-invalid` or `compat-range` (meaning the bundle cannot be parsed), stages AA/Y/N are skipped. This avoids producing misleading Stage AA/Y/N violations against an unparseable bundle. The result is still `ok: false`.

### 2.4 Stage AA covers all settings_data.current string leaves

For a bundle that passes Stage K, `walkStringLeaves(bundle.config?.settings_data?.current ?? {}, 'settings_data.current', 0)` is iterated. Every string leaf at depth ≤ 4 is passed through `validateCustomCss(rawCss)`. If the CSS validator returns `ok: false`, each violation is pushed to `blockingViolations` with code `'AA:css-injection'`.

Tests `AE-AA-01` through `AE-AA-06` verify rejection of `@import`, `url(javascript:)`, `</style>` breakout, `expression()`, multiple infected keys, and unicode-escaped `@import`.

**Gap (now FIXED):** in the original implementation strings at depth ≥ 5 were silently skipped. Hardened in-phase — the walker now covers all legitimate depths and fails closed beyond the cap. See §4.

### 2.5 Stage Y catches credential-adjacent @app block settings

For every `isLiquidAppBlockType(block.type)` block in every template section, the block's `settings` keys are filtered against `BLOCKED_APP_BLOCK_SETTING_KEYS`. A match produces a blocking `'Y:blocked-setting-key'` violation. Non-@app blocks are not checked, which prevents false positives on legitimate section settings that happen to have a key like `title` or `id`.

Tests `AE-Y-01` (api_key rejection), `AE-Y-02` (webhook_secret rejection), `AE-Y-03` (safe settings pass), `AE-Y-04` (non-@app blocks not checked) verify this.

### 2.6 Stage N catches structural issues not caught by the Zod bundle schema

`toThemeDocumentV2(bundle)` re-parses the bundle and validates template key charset (via `validateTemplateKey`) and builds the block tree. `parseThemeDocument(doc)` enforces the `ThemeDocumentSchema` Zod schema. Issues not caught by `LiquidThemePackageBundleSchema` (e.g., non-alphanumeric template keys, block nesting depth violations) are caught here.

Tests `AE-N-01` (Urban Kicks passes Stage N) and `AE-N-02` (Letbuyy Core passes Stage N) verify clean first-party bundles pass.

### 2.7 Determinism verified by tests

`AE-DET-01` through `AE-DET-03` verify:
- Same valid bundle input → identical result on repeated calls.
- Same invalid bundle input → identical result on repeated calls.
- Violations array always ordered (blocking first, advisory last).

---

## 3. Frozen Marketplace Respected

### 3.1 Frozen apps not referenced

`packages/theme-engine/src/theme-marketplace-contract.ts` does not import from or reference:
- `apps/app-marketplace`
- `apps/developer-portal`
- `apps/theme-marketplace`

No new routes are added to `services/api-gateway/src/routes/`. No new merchant-control-plane pages are added. The gate is a pure library function only.

### 3.2 theme-registry.ts not modified

`packages/theme-engine/src/theme-registry.ts` is **not modified** in Phase AE. No new theme entries are added. The frozen contract is preserved.

### 3.3 No live pipeline exists

`validateThemeForMarketplace` is not called from any route, worker, queue job, or webhook handler. It exists as a ready-to-wire contract. The marketplace launch — including the upload pipeline, partner review queue, and listing pages — requires separate ARB-gated work with the frozen apps unfrozen and production-grade entitlement/payment logic added.

### 3.4 ART-17 preserved

No new React-per-section code is introduced. Phase AE touches only `packages/theme-engine/src/` and `database/supabase/migrations/`. The ART-17 freeze on `apps/theme-marketplace` is not violated.

---

## 4. Findings

### FIND-AE-SEC-001 (MEDIUM) — walkStringLeaves depth cap allows CSS injection bypass at depth ≥ 5

**File:** `packages/theme-engine/src/theme-marketplace-contract.ts`, line 125 (`if (depth > 4) return;`)

**Description:** `walkStringLeaves` stops traversal at `depth > 4`. The `ThemeBundleJsonObjectSchema` (via `z.lazy()`) for `settings_data.current` has no depth bound. A bundle containing `settings_data.current.a.b.c.d.e = '@import url(evil);'` will:
1. Pass Stage K (the Zod schema accepts arbitrary depth).
2. Have the CSS injection string silently skipped by Stage AA (depth 5 > 4 cap).
3. Return `ok: true` — incorrectly.

The documented contract states "validate every string leaf in settings_data.current" but the implementation does not deliver that for depth ≥ 5. No test covers the depth-bypass case.

**Remediation options (considered):**
- Option A: Enforce a maximum nesting depth of 4 on `ThemeBundleSettingsDataSchema` itself via a `.superRefine` depth guard. Bundles with depth ≥ 5 are rejected by Stage K before Stage AA runs.
- Option B: Change the `walkStringLeaves` cap and add a depth-5 test fixture.

**Status:** ✅ **FIXED in Phase AE hardening (2026-07-11).** Applied a hardened variant of Option B that is fail-closed rather than merely raising the ceiling:
1. The cap was raised to `MAX_SETTINGS_WALK_DEPTH = 12`, well above the deepest legitimate theme setting (nested blocks are bounded at `MAX_BLOCK_DEPTH = 3`), so no clean bundle is ever truncated.
2. Truncation is **fail-closed**: if `walkStringLeaves` reaches the cap with content still below it, it records the truncation on a `state` object and `validateThemeForMarketplace` pushes a blocking `AA:settings-too-deep` violation. An over-deep bundle is therefore **rejected**, never admitted with an un-scanned blind spot — closing the bypass even for adversarially ultra-deep inputs that Option B's raised-ceiling alone would not.
3. Locked by two new tests: `AE-AA-07` (depth-5 `@import` now rejected) and `AE-AA-08` (settings nested beyond the cap rejected fail-closed with `AA:settings-too-deep`).

theme-engine gate **1726/1726**, typecheck clean. No residual.

---

### FIND-AE-TEST-002 (LOW) — AE-K-05 inner assertion uses redundant OR condition

**File:** `packages/theme-engine/test/theme-marketplace-contract.test.ts`, test `AE-K-05`

**Description:** The inner for-loop assertion uses `v.code === \`K:${v.code.slice(2)}\` || v.stage === 'K'`. For any Stage K violation both disjuncts are true simultaneously. Only `v.stage === 'K'` is meaningful; the code-prefix check adds no discriminating power.

**Remediation:** Replace with `assert.equal(v.stage, 'K', ...)`.

**Status:** OPEN, LOW. Cosmetic. Deferred.

---

### FIND-AE-SEC-003 (LOW) — user_id = auth.uid() cross-UUID-space risk in migration 191

**File:** `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql`

**Description:** `theme_purchases.user_id` FK → `users_custom(id)`, a separate UUID space from `auth.users.id` (`auth.uid()`). Cross-tenant denial depends on UUID-space non-overlap. If a `users_custom.id` value coincidentally matches a different user's `auth.uid()`, that user would gain read/insert access to the other's purchase rows.

**Current posture:** The migration is a clear improvement over the baseline `USING (true)`. In the current architecture, UUID collision is effectively impossible and the gateway always uses service_role, so direct authenticated-role access to `theme_purchases` is already constrained by the product architecture. The SQL comment documents this clearly.

**Remediation (long-term):** Add `auth_id uuid REFERENCES auth.users(id)` to `users_custom` and rewrite the policies as `auth_id = auth.uid()`. This requires a new migration and ARB sign-off.

**Status:** OPEN, LOW. Deferred to first schema migration on `users_custom`.

---

## 5. Integrity Attestation

| Invariant | Evidence |
|-----------|----------|
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` | `packages/theme-engine/src/theme-governance.ts:14` — not modified in Phase AE |
| DOMPurify FORBID config intact | `packages/theme-engine/src/theme-renderer.ts:229-230` — not modified in Phase AE |
| `publish_theme_release` SECURITY DEFINER RPC | Not touched in Phase AE |
| Money ledger / checkout / payment RPCs | Not touched in Phase AE |
| Frozen apps (`app-marketplace`, `developer-portal`, `theme-marketplace`) | Not touched in Phase AE |
| `theme-registry.ts` | Not touched in Phase AE |
| ART-17 (no new React-per-section) | No such code added in Phase AE |
| validate-governance.mjs | EXIT=1 — pre-existing tenant-registry drift only (unchanged from Phase AD baseline) |
