# LetBuyy Theme Marketplace — Partner Readiness: Third-Party Submission Safety Contract

**Document type:** Partner readiness reference
**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AE — Marketplace + Partner Readiness
**Date:** 2026-07-11
**Audience:** Third-party theme developers, LetBuyy platform team, ARB reviewers
**Status:** AUTHORITATIVE CONTRACT (gate is implemented; live submission pipeline is ARB/human-gated, not yet active)

---

## 1. Overview

Before a third-party theme can be listed in the LetBuyy Theme Marketplace, the theme bundle must pass the `validateThemeForMarketplace` gate — a single, deterministic, fail-closed validation function implemented in `packages/theme-engine/src/theme-marketplace-contract.ts`.

This document describes exactly what partners must satisfy to pass the gate, what each failure means, and what the gate does and does not check.

---

## 2. What Is a Theme Bundle?

A LetBuyy theme bundle (`LiquidThemePackageBundle`) is a structured JSON payload containing:

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | `string` | Must be a known schema version (e.g., `'2.0'`) |
| `compatibility_range` | `string` | Semver range matched against the theme engine version |
| `metadata` | `ThemeMetadata` | Name, author, description, industry, tags, preview image |
| `config.settings_schema` | `SettingsSchemaEntry[]` | Global theme settings definitions |
| `config.settings_data` | `{ current: object, presets: object }` | Default settings values |
| `templates` | `Record<string, TemplateDef>` | Page templates; each contains sections and blocks |
| `section_definitions` | `Record<string, SectionDefinition>` | Section type schemas |
| `layout` | `LayoutDef` | Layout shell definition |
| `locales` | `Record<string, TranslationMap>` | Translation strings |

---

## 3. The Gate: `validateThemeForMarketplace`

```typescript
import { validateThemeForMarketplace } from '@letbuyy/theme-engine';

const result = validateThemeForMarketplace(rawBundleJson);
// result.ok === true → bundle passes all stages
// result.ok === false → one or more blocking violations exist
// result.violations → full list (blocking + advisory)
```

### 3.1 Properties guaranteed by the gate

| Property | Guarantee |
|----------|-----------|
| **Pure** | No database writes, no network calls, no side effects |
| **Deterministic** | Same input always produces the same result |
| **Fail-closed** | Unknown / malformed / error input always produces `ok: false` |
| **Never throws** | All failures are captured as `violations[]` |

---

## 4. Gate Stages — What Must Pass

The gate runs four stages in order. All stages run (unless Stage K produces a hard structural failure, in which case AA/Y/N are skipped to avoid noise).

### Stage K — Structural Validity, Lint, Compatibility, Parity

**Validator:** `validateThemeInstall` (which composes G4 + H + compat-range + parity)

**What it checks:**

| Sub-check | Check | Hard blocker? |
|-----------|-------|---------------|
| G4 — Schema | `schema_version` is a known version; bundle matches `LiquidThemePackageBundleSchema` | YES — `K:schema-invalid` |
| Compat range | `compatibility_range` is satisfied by the current engine version | YES — `K:compat-range` |
| H — Lint errors | Forbidden HTML tags/attributes in Liquid code; schema-block references | YES — `K:lint-error` |
| H — Lint warnings | Deprecated patterns, non-critical warnings | NO (advisory) |
| Parity gaps | Section types in the bundle with no built-in Liquid parity file | NO (advisory, `K:parity-gap`) |

**Hard structural failure early exit:** If Stage K produces `K:schema-invalid` or `K:compat-range`, Stages AA/Y/N are skipped and `ok: false` is returned immediately.

**Advisory violations** (`advisory: true`): parity-gap and lint-warn violations are surfaced but do NOT cause `ok: false`. Partners should resolve them before listing, but they are not hard blockers at submission time.

**Common Stage K failures:**

| Error | Cause | Fix |
|-------|-------|-----|
| `K:schema-invalid` | Missing required field; wrong type; unknown `schema_version` | Validate against `LiquidThemePackageBundleSchema` before submission |
| `K:compat-range` | `compatibility_range` does not include the current engine version | Use `>=2.0.0` or check the engine's advertised version |
| `K:lint-error` | `<script>`, `<iframe>`, `onclick=`, or other forbidden patterns in Liquid template files | Remove all forbidden patterns; see the lint-error message for the specific rule |

---

### Stage AA — CSS Safety in Bundled Default Settings

**Validator:** `validateCustomCss` applied to every string leaf in `config.settings_data.current`

**What it checks:**

Theme bundles may ship default values in `settings_data.current` (e.g., background gradients, font declarations, colour names). Stage AA passes every string leaf through the CSS safety validator to detect injection vectors.

**Blocked patterns (any match → `AA:css-injection`):**

| Pattern | Risk |
|---------|------|
| `@import` | External stylesheet injection |
| `url(javascript:...)` | JavaScript execution via CSS |
| `expression(...)` | IE CSS expression execution |
| `</style>` | HTML breakout from style context |
| `behavior:` | IE proprietary execution |
| Unicode-escaped variants of the above | Bypass via encoding |
| Additional patterns | See `custom-css-sanitizer.ts` for the full 22-class list |

**What is safe:** plain colour names (`red`, `#fff`), hex values (`#00B3B3`), numeric strings, safe `url()` references to image assets, standard CSS property values.

**Depth limitation:** The validator checks string leaves up to 4 levels deep in `settings_data.current`. Partners should not use deeply nested (5+ levels) settings objects; such structures may not be fully validated in the current gate implementation.

---

### Stage Y — @app Block Credential Safety

**Validator:** `BLOCKED_APP_BLOCK_SETTING_KEYS` checked against settings of every `@app`-typed template block

**What it checks:**

If the theme bundle contains `@app`-typed blocks in its templates (to integrate third-party app extensions), those blocks must not include credential-adjacent keys in their default `settings`. These keys would be silently stripped by the runtime's `filterAppBlockSettings` — their presence indicates either an accidental credential leak or an attempt to probe the filtering mechanism.

**Blocked setting keys (any match → `Y:blocked-setting-key`):**

Examples include (but are not limited to): `api_key`, `webhook_secret`, `access_token`, `client_secret`, `private_key`, `password`, `auth_token`, `bearer_token`. See `BLOCKED_APP_BLOCK_SETTING_KEYS` in `app-block-model.ts` for the complete set.

**What is safe:** Standard block settings like `background_color`, `text`, `title`, `max_products`, `alignment` — any key not in `BLOCKED_APP_BLOCK_SETTING_KEYS`.

**Scope:** Only `@app` and `app:`-prefixed block types are checked. Regular section blocks are not checked by Stage Y.

---

### Stage N — ThemeDocument Structure

**Validator:** `toThemeDocumentV2(bundle)` + `parseThemeDocument(doc)`

**What it checks:**

Stage N converts the bundle to the editor's stable-ID ThemeDocument format and re-validates it. This catches issues not caught by the Zod bundle schema:

| Issue | Example |
|-------|---------|
| Template key charset | Template key `my template!` (contains non-alphanumeric characters) |
| Block nesting depth | Blocks nested beyond the maximum depth bound |
| ThemeDocument schema violations | Structural inconsistencies exposed during conversion |

**Common Stage N failures:**

| Error | Cause | Fix |
|-------|-------|-----|
| `N:document-parse-failed` | Template key contains characters outside `[a-z0-9_-]` | Rename template keys to use only lowercase alphanumerics, underscores, and hyphens |
| `N:document-parse-failed` | Block nesting depth exceeds maximum | Reduce nesting depth in block tree |

---

## 5. Violation Shape Reference

```typescript
interface ThemeMarketplaceViolation {
  stage: 'K' | 'AA' | 'Y' | 'N';
  code: string;
  message: string;
  advisory?: boolean; // true = informational only; does not affect ok
}
```

**Code examples:**

| Code | Stage | Blocking? |
|------|-------|-----------|
| `K:schema-invalid` | K | YES |
| `K:compat-range` | K | YES |
| `K:lint-error` | K | YES |
| `K:lint-warn` | K | NO (advisory) |
| `K:parity-gap` | K | NO (advisory) |
| `AA:css-injection` | AA | YES |
| `Y:blocked-setting-key` | Y | YES |
| `N:document-parse-failed` | N | YES |

Violation ordering in the result:
1. Stage K errors (blocking, in detection order)
2. Stage AA errors (blocking)
3. Stage Y errors (blocking)
4. Stage N errors (blocking)
5. Advisory warnings (non-blocking; `advisory: true`)

---

## 6. What the Gate Does NOT Check

Partners should be aware of these explicit gaps:

| Gap | Reason |
|-----|--------|
| ~~CSS injection in `settings_data.current` at depth ≥ 5~~ **(CLOSED)** | Was a `walkStringLeaves` depth-cap gap; fixed in-phase — the walker now covers all legitimate depths and rejects over-deep bundles fail-closed (`AA:settings-too-deep`). See PHASE_AE_SECURITY_REVIEW.md §4. |
| Live `@app` block runtime behaviour | Requires a live app runtime; NOT-CONNECTED at submission time |
| Theme performance (page load time, render budget) | No live render environment at submission time |
| Accessible colour contrast in Liquid templates | No rendered output to evaluate |
| Business logic / pricing / checkout code | Not present in theme bundles |
| Legal / IP / copyright compliance of theme assets | Human review required |
| Merchant-specific compatibility | Requires runtime installation against a specific store |
| Shopify parity completeness | Stage K parity-gap is advisory only; missing parity sections are surfaced but do not block |

---

## 7. Submission Readiness Checklist for Partners

Before submitting a theme bundle, verify each item:

**Schema and compatibility:**
- [ ] `schema_version` is a known version (e.g. `'2.0'`).
- [ ] `compatibility_range` is set and satisfied by the current engine version.
- [ ] All required bundle fields are present and correctly typed.

**Lint safety:**
- [ ] No forbidden HTML tags or attributes in any Liquid template (`<script>`, `<iframe>`, `onclick=`, etc.).
- [ ] All `schema-block` references are valid.

**CSS safety (settings_data.current):**
- [ ] No `@import` statements in any `settings_data.current` string value.
- [ ] No `url(javascript:...)` references.
- [ ] No `expression()` calls.
- [ ] No `</style>` breakout sequences.
- [ ] Settings nesting is ≤ 4 levels deep.

**@app block safety:**
- [ ] No `@app` or `app:`-prefixed block in any template has `api_key`, `webhook_secret`, `access_token`, or other credential-adjacent keys in its `settings`.

**ThemeDocument structure:**
- [ ] All template keys contain only lowercase alphanumerics, underscores, and hyphens (`[a-z0-9_-]`).
- [ ] Block nesting does not exceed the maximum depth.

**Advisory items (not blocking; fix before listing):**
- [ ] All section types referenced in templates have corresponding Liquid parity files.
- [ ] No lint warnings from `lintThemeBundle`.

---

## 8. What Happens After the Gate Passes

Passing `validateThemeForMarketplace` is a necessary but not sufficient condition for marketplace listing. The following additional steps require human + ARB approval:

1. **Partner identity verification** — not automated.
2. **Legal / IP / copyright review** — not automated.
3. **Marketplace listing approval** — human-operated review queue (not yet live).
4. **Production pipeline wiring** — frozen marketplace apps must be unfrozen via ARB process.
5. **Migration 191 applied to production** — ARB sign-off required.

---

## 9. Technical Reference

| Symbol | Package | File |
|--------|---------|------|
| `validateThemeForMarketplace` | `@letbuyy/theme-engine` | `src/theme-marketplace-contract.ts` |
| `ThemeMarketplaceValidationResult` | `@letbuyy/theme-engine` | `src/theme-marketplace-contract.ts` |
| `ThemeMarketplaceViolation` | `@letbuyy/theme-engine` | `src/theme-marketplace-contract.ts` |
| `ThemeMarketplaceStage` | `@letbuyy/theme-engine` | `src/theme-marketplace-contract.ts` |
| `validateThemeInstall` (Stage K) | `@letbuyy/theme-engine` | `src/theme-install.ts` |
| `validateCustomCss` (Stage AA) | `@letbuyy/theme-engine` | `src/custom-css-sanitizer.ts` |
| `BLOCKED_APP_BLOCK_SETTING_KEYS` (Stage Y) | `@letbuyy/theme-engine` | `src/app-block-model.ts` |
| `parseThemeDocument` / `toThemeDocumentV2` (Stage N) | `@letbuyy/theme-engine` | `src/theme-document.ts` |
| `LiquidThemePackageBundle` / `LiquidThemePackageBundleSchema` | `@letbuyy/theme-engine` | `src/theme-bundle.ts` |
