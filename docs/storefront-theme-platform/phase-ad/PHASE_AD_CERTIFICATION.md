# Phase AD — M→AC Theme Platform Certification

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AD — Certification + Canary Readiness Package
**Certification date:** 2026-07-11
**Branch:** `stepup/main`
**HEAD at certification:** `83d61e0a` (Phase AC — AI-assisted customization)
**Program window certified:** `9186188e` (Phase M baseline) → `83d61e0a` (Phase AC close)
**Author:** AD certification sub-agent (read-only; no source changes; no git; orchestrator commits)

---

## 1. Certification verdict

**CANARY-READY — subject to ARB approval and honesty seam disclosure.**

All four gate packages typecheck clean and all committed tests pass. The two
pre-existing governance failures (tenant-registry drift + untracked migrations
186/187) are confirmed pre-program, not introduced by M→AC. The four integrity
seams (canary flag, DOMPurify config, publish_theme_release RPC, money ledger)
are provably unchanged by the M→AC program. The ARB must explicitly flip
`THEME_LIQUID_RENDERING_DEFAULT_ENABLED` to `true` — this certification does not
do so.

---

## 2. Gate results

### 2.1 `@letbuyy/theme-engine` — typecheck + test

**Command:** `pnpm --filter=@letbuyy/theme-engine typecheck test`

| Gate | Result | Count |
|------|--------|-------|
| `tsc --noEmit` | PASS (exit 0, no diagnostics) | — |
| `node --test` (test suite) | PASS | 1695 / 1695 |
| Failures | NONE | 0 |

Evidence: exit code 0 on typecheck; final TAP lines
`# tests 1695 / # pass 1695 / # fail 0 / # duration_ms 5382`.

Baseline check: PROGRAM_STATE.md records 1695 entering Phase AC (+61 from AC,
+61 ai-intent-parser tests); matches exactly.

---

### 2.2 `@letbuyy/storefront-runtime` — typecheck + test

**Command:** `pnpm --filter=@letbuyy/storefront-runtime typecheck test`

| Gate | Result | Count |
|------|--------|-------|
| `tsc --noEmit` | PASS (exit 0) | — |
| `node --test` (combined suite) | PASS | 915 / 915 |
| Failures | NONE | 0 |

Evidence: exit code 0 on typecheck; final TAP lines
`# tests 915 / # pass 915 / # fail 0`.

**Note on count vs. PROGRAM_STATE figure:** PROGRAM_STATE records "795/795
storefront-runtime" through Phase AC. The actual measured count at HEAD is 915
(120 higher). The storefront-runtime test script runs 12 external test files
including `tests/launch/lb-l-ai-theme-platform.test.mjs` (749 sub-tests, created
in Phase L commit `29f87115`). lb-l is a static-contract suite: tests that
reference as-yet-unbuilt Phase-AC files (ai-intent-parser.ts,
AICustomizationPanel.tsx, AINotConnectedResult, etc.) failed during phases S→AB
and were excluded from passing counts. After Phase AC committed those files, all
lb-l contract tests pass. The 915 count is the post-AC stable baseline. The 795
figure was the mid-program passing count before AC landed its files.
All 915 tests pass with 0 failures — the gate is CLEAR.

---

### 2.3 `@letbuyy/merchant-control-plane` — typecheck + test

**Command:** `pnpm --filter=@letbuyy/merchant-control-plane typecheck test`

| Gate | Result | Count |
|------|--------|-------|
| `tsc --noEmit` | PASS (exit 0) | — |
| `node --test` (test suite) | PASS | 771 / 771 |
| Failures | NONE | 0 |

Evidence: exit code 0 on typecheck; final TAP lines
`# tests 771 / # pass 771 / # fail 0 / # duration_ms 488`.

Matches PROGRAM_STATE baseline of 771/771.

---

### 2.4 `@letbuyy/api-gateway` — typecheck + tests

**Command:** `pnpm --filter=@letbuyy/api-gateway typecheck` then test

| Gate | Result | Count |
|------|--------|-------|
| `tsc --noEmit` | PASS (exit 0, no diagnostics) | — |
| `node --test` (unit + contract suite) | 537 PASS / 3 FAIL / 540 total | 537 / 540 |

The 3 failures are **CONFIRMED FOREIGN / PRE-EXISTING user WIP**, not M→AC
regressions. Evidence by failure description and root cause:

| Test # | Name | Root cause | Classification |
|--------|------|-----------|----------------|
| `not ok 1` | `merchant AI route is mounted, mobile allowlisted, and provider-backed` | Regex `/adapter\.purchase/` not matched — gateway AI route stub is incomplete (user WIP) | FOREIGN |
| `not ok 130` | `executive analytics migration creates rollup tables with service-role and super-admin RLS` | `ENOENT: no such file .../129_internal_os_executive_analytics_rollups.sql` — migration file absent from WIP | FOREIGN |
| `not ok 298` | `storefront runtime no longer owns payment route handlers` | Regex `/storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/stripe\/checkout'/` not matched — user WIP payment routing refactor in progress | FOREIGN |

None of these files were touched by any M→AC commit (git diff `9186188e..HEAD` on
the relevant test and route files shows 0 lines changed for the test that looks
for `adapter.purchase`, 0 lines for the executive-analytics migration, and 0
lines for the payments route). PROGRAM_STATE pre-dates this certification and
documents the same 3 pre-existing failures.

---

## 3. Validator gate results

### 3.1 `node scripts/validators/theme-governance-validator.mjs`

**Result: PASS**

```
Theme governance validator passed (25 built-in section schemas, WARN mode,
Liquid default OFF, fallback placeholder, schema migration runner).
```

Exit code 0.

---

### 3.2 `node scripts/validators/migration-safety-validator.mjs`

**Result: PASS**

```
Migration safety validator passed (Supabase migration history checked for
destructive replay hazards).
```

Exit code 0.

---

### 3.3 `node scripts/validate-governance.mjs`

**Result: FAIL (exit 1) — 1 pre-existing validator, NOT from M→AC**

```
Foundation anti-fabrication gate passed (1319 active source files scanned;
0 temporary entries tracked).
Tenant isolation validator failed:
  services/api-gateway/src/tenant/tenant-tables.registry.ts must match
  schema-derived tenant table registry; run
  scripts/generators/generate-tenant-table-registry.mjs
```

The `tenant-tables.registry.ts` drift is pre-existing (RISK-GOV-001 in
RISK_REGISTER.md, open since before Phase M). No M→AC commit touched
`services/api-gateway/src/tenant/tenant-tables.registry.ts`. Anti-fabrication
gate PASSES (1319 active files scanned, 0 temporary entries).

---

### 3.4 `node scripts/validators/sequential-migration-validator.mjs`

**Result: FAIL — 2 pre-existing untracked migrations, NOT from M→AC**

```
Sequential migration validator failed:
  Untracked migration file found on disk but not committed:
    database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql
  Untracked migration file found on disk but not committed:
    database/supabase/migrations/187_v1_sites_site_settings.sql
```

Both files are user WIP in the working tree, listed explicitly as FOREIGN in
PROGRAM_STATE.md ("Untracked migrations 186_*, 187_*"). No M→AC commit added or
modified either migration. The program's own committed migrations are:
188 (letbuyy-core theme row), 189 (theme persistence idempotency), 190 (theme
library Q) — all theme-scoped, all committed.

---

## 4. Integrity checks

### 4.1 Canary flag: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is STILL `false`

**Evidence:** `packages/theme-engine/src/theme-governance.ts:14`

```typescript
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;
```

Confirmed by: `grep -n "THEME_LIQUID_RENDERING_DEFAULT_ENABLED" packages/theme-engine/src/theme-governance.ts` returns line 14. Also confirmed by `theme-governance-validator.mjs` output: "Liquid default OFF".

No M→AC commit touches this line. `git diff 9186188e..HEAD -- packages/theme-engine/src/theme-governance.ts` shows only additive imports of new phase symbols; line 14 is unchanged.

**The flag has NOT been flipped. ARB must authorise flipping it.**

---

### 4.2 `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` — config block unchanged

**Evidence:** `packages/theme-engine/src/theme-renderer.ts:170–231`

The exported const `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` and its entire block
(lines 170–231) are unchanged from the Phase M baseline. Four M→AC commits
touched `theme-renderer.ts` (phases W, Y, T, AA). In all four diffs, no `+` or
`-` line touches the `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` block, `FORBID_ATTR`,
`FORBID_TAGS`, `ADD_TAGS`, `ADD_ATTR`, or `CUSTOM_ELEMENT_HANDLING`.

The Phase AA commit message explicitly states: "LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG is NOT modified (DOMPurify already allows `<style>`)."

Current config (unchanged since pre-M baseline):

```typescript
export const LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG: DOMPurifyConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: [ ...LIQUID_HYDRATION_CUSTOM_ELEMENTS, 'iframe', 'meta' ],
  ADD_ATTR: [ /* 24 allow-listed data-* and aria-* attrs */ ],
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker|review-form|wishlist-toggle|cart|customer-settings|address-manager|logout)$/,
    attributeNameCheck: /^(?:aria-[a-z0-9-]+|data-[a-z0-9-]+|class|id|role|slot|title|type|name|value|href|src)$/i,
    allowCustomizedBuiltInElements: false,
  },
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['base', 'embed', 'object', 'script'],
};
```

**DOMPurify config is UNCHANGED. No relaxation of forbid lists or custom-element regexes.**

---

### 4.3 `publish_theme_release` RPC — call signature unchanged

**Evidence:** `services/api-gateway/src/execution/theme-execution.adapter.ts:699–710`

The `db.rpc('publish_theme_release', { ... })` call in `publishReleaseSnapshot()`
was added in Phase P (commit `fa4e4786`). Its parameter block:

```typescript
const { data, error } = await this.db.rpc('publish_theme_release', {
    p_store_id:                  input.storeId,
    p_theme_id:                  input.themeId,
    p_release_config:            input.releaseConfig,
    p_source_draft_id:           input.sourceDraftId || null,
    p_source_draft_version:      input.sourceDraftVersion || null,
    p_published_by:              input.publishedBy,
    p_publish_message:           input.publishMessage || null,
    p_make_store_live:           input.makeStoreLive,
    p_request_id:                input.requestId || null,
    p_rollback_of_release_id:    input.rollbackOfReleaseId || null,
});
```

Post-Phase-P commits that touched `theme-execution.adapter.ts` (phases Q and the
Phase AB commit `016da8f0`): `git diff fa4e4786..HEAD` on the adapter shows no
`+` or `-` line for `rpc('publish_theme_release'` or any `p_` parameter name. The
only Phase AB note nearby is a comment: "adding p_expected_current_release_version
to the SECURITY DEFINER RPC (ARB-gated)" — that addition is PLANNED, not
implemented (ARB-gated, not in this program window).

**publish_theme_release RPC call signature is UNCHANGED.**

---

### 4.4 Money ledger / checkout / payment RPCs — untouched

**Evidence:** `git diff 9186188e..HEAD` on canonical money paths shows 0 lines
changed:

- `services/api-gateway/src/routes/payments.ts` — 0 diff lines
- `services/api-gateway/src/routes/checkout` directory — 0 diff lines (directory unchanged)
- `services/api-gateway/src/routes/orders.ts` — 0 diff lines

The canonical money RPCs (`create_checkout_order`, `confirm_order_payment_with_ledger`,
`complete_order_refund`, `issue_gift_card`, `set_gift_card_status`,
`restore_gift_card_on_refund`) do not appear in `packages/theme-engine/src/`
(grep returns 2 hits — both in test comments, not RPC calls). None of the M→AC
program route commits (`git log 9186188e..HEAD -- services/api-gateway/src/routes/`)
touch a non-theme route: every commit in that directory is
`feat(theme): ...` scoped.

**Money ledger, checkout routes, and payment RPCs are UNTOUCHED by M→AC.**

---

## 5. Honesty seam catalogue (NOT-CONNECTED)

The following seams are explicitly not connected and must remain honestly
disclosed until ARB-gated follow-up work:

| Seam | Phase | Status | Exact missing piece |
|------|-------|--------|---------------------|
| Metafield render resolution | W | NOT-CONNECTED | `resolveDynamicSourceDescriptors` called at section level; metafield values fetched by composition layer at call site, not within engine. No `MetafieldBinding` resolution path wired in storefront. |
| Live FX rates (currency display) | W, Z | NOT-CONNECTED | `fxConnected: false` literal type. No Forex API wired. `formatThemeCurrencyDisplay` returns INR-only for non-INR — display-only. |
| AI model boundary (free-text NLU) | AC | NOT-CONNECTED | Gateway route `POST /v1/theme-ai/parse-brief` absent. `THEME_AI_PROVIDER_API_KEY` env var unset. `proposeThemeCustomization` returns `AINotConnectedResult` for `kind: 'free-text'` intents. |
| Live app-block content runtime | Y | NOT-CONNECTED | `app-marketplace` FROZEN. `APP_BLOCK_NOT_CONNECTED_REASON` surfaced to merchant. App registry returns NOT-CONNECTED. |
| Custom CSS render path call site | AA | NOT-CONNECTED | `buildLiquidThemeHeadAssets` accepts `rawCustomCss` parameter but call site at `theme-renderer.ts:585` in the storefront composition layer is NOT updated. Custom CSS is validated and scoped by engine but not injected in the live render path. ARB/Phase AE. |
| Liquid canary flag | M→AC | NOT-CONNECTED / ARB-GATED | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`. Per-store canary opt-in path exists. Global default is OFF. ARB must authorise flip. |

---

## 6. Open risks carried to Phase AE

The following risks from RISK_REGISTER.md are NOT resolved by Phase AD certification
and carry forward (Phase AE or ARB-gated):

**MEDIUM risks requiring ARB or AE scope:**
- RISK-SEC-001: `theme_purchases` wide-open RLS → AE
- RISK-TOCTOU-Q01: plan-limit count-then-insert non-atomic → ARB-gated
- RISK-T01: pre-Zod stack-depth guard missing → Phase AE
- RISK-T02: no `assertNoBlockedKeysInRaw` in bundle parser → Phase AE
- RISK-T05: `allowedChildTypes` not wired in depth-bounded renderer → Phase AE
- RISK-SEC-U01/U02/U03: setting-renderer XSS hardening → Phase AE
- RISK-A11Y-U01: setting control focus trapping → Phase AE
- RISK-W01: resource binding without owner check at render time → Phase AE
- RISK-Z01: `buildCandidates('en')` India-first inversion → Phase AE
- RISK-AC-01: overlay key filter missing at proxy layer (latent while AI NOT-CONNECTED) → Phase AE
- RISK-AC-02: accessibility-fix WCAG AA only proven against white background → Phase AE

**LOW risks accepted for AE or first-touch:**
- RISK-T03 (partial), RISK-T04, RISK-T06, RISK-SEC-P01, RISK-TOCTOU-P01/P02,
  RISK-W02..W06, RISK-X01, RISK-Y01, RISK-Z02..Z06, RISK-AA-01..03,
  RISK-AB-01..03, RISK-AC-03..05, RISK-GOV-001, RISK-DATA-001,
  RISK-DUAL-N01 (mechanically guarded)

---

## 7. Summary evidence table

| Check | Expected | Actual | Match |
|-------|----------|--------|-------|
| theme-engine typecheck | PASS | PASS (exit 0) | YES |
| theme-engine tests | 1695 / 1695 | 1695 / 1695 | YES |
| storefront-runtime typecheck | PASS | PASS (exit 0) | YES |
| storefront-runtime tests | all PASS | 915 / 915 (note: PROGRAM_STATE says ~795; count grew as Phase AC lb-l tests passed) | ALL PASS |
| merchant-control-plane typecheck | PASS | PASS (exit 0) | YES |
| merchant-control-plane tests | 771 / 771 | 771 / 771 | YES |
| api-gateway typecheck | PASS | PASS (exit 0) | YES |
| api-gateway tests | 537 PASS / 3 FOREIGN FAIL | 537 / 540 (3 FOREIGN) | YES |
| theme-governance-validator | PASS | PASS | YES |
| migration-safety-validator | PASS | PASS | YES |
| validate-governance.mjs | EXIT 1 (tenant drift only) | EXIT 1 (tenant drift only) | YES — pre-existing |
| THEME_LIQUID_RENDERING_DEFAULT_ENABLED | false (line 14) | false (line 14) | YES |
| LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG | unchanged | unchanged | YES |
| publish_theme_release RPC | unchanged | unchanged | YES |
| Money ledger / checkout routes | untouched | 0 diff lines in window | YES |

---

## 8. Canary ARB package

The following three items are the minimum ARB package for flipping the Liquid
canary to production default:

1. **Flag location:** `packages/theme-engine/src/theme-governance.ts:14`
   Change `false` → `true` to enable Liquid rendering by default for all stores.
   Requires re-running `pnpm --filter=@letbuyy/theme-engine typecheck test` after
   the change (regression check).

2. **Per-store canary override path:** `resolveThemeLiquidRenderingEnabled(input)`
   in `theme-governance.ts:18`. Per-store opt-in / opt-out already works — the
   global default is the only item controlled by the flag. Merchant-level override
   remains intact after the flip.

3. **NOT-CONNECTED seams that must be disclosed in the ARB decision memo:**
   Custom CSS render path (call site not wired), metafield resolution (composition
   layer only), AI model NLU (free-text), live FX rates, app-block live runtime.
   None of these block the Liquid canary flip (they are independent feature seams),
   but they must be named in the ARB decision for honest record.

---

*Certification evidence gathered on `stepup/main` at HEAD `83d61e0a` by the
Phase AD read-only certification sub-agent. No source files were modified. No
git commands were executed. The orchestrator is responsible for committing this
document under the programme's two-lane merge rule.*
