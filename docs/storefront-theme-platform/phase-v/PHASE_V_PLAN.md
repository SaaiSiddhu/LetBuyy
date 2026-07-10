# Phase V Plan — Template System

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** V — Template System
**Date:** 2026-07-11

---

## Objective

Deliver a first-class template type registry and alternate-template resolution layer (Lane A, `packages/theme-engine`) plus a standalone `TemplateSwitcherPanel` editor component (Lane B, `apps/merchant-control-plane`). Close the template-key validation gap in `ThemeDocumentTemplateSchema`. Document the intended Liquid context-drop allowlist per template type (additive only; no `buildLiquidScope` behavior change).

---

## Constraints

1. **`theme-registry.ts` is FROZEN.** Must not be modified.
2. **`theme-renderer.ts` sanitiser is locked.** Phase V must not touch it (RISK-T03/T04 carry forward).
3. **`editor/page.tsx` is FOREIGN WIP.** Phase V must not touch it. `TemplateSwitcherPanel` is standalone; editor wiring rides as WIP (same pattern as Phase R).
4. **`apps/merchant-control-plane/src/app/globals.css` is FOREIGN WIP.** No direct edit needed for Phase V.
5. **RISK-DUAL-N01 preserved.** `TemplateSwitcherPanel.onChange` emits a key string only. `onCreateAlternate` emits a base-type string only (intent signal). No `section_definitions` or `block_definitions` mutation.
6. **`--lb-*` tokens only** in all new CSS. No `rounded-[Npx]` Tailwind classes. No raw hex or px values in new files.
7. **No API calls in `TemplateSwitcherPanel`.** It is a pure presentational component driven by caller-supplied props.
8. **`buildLiquidScope` behavior unchanged.** `getAllowedDropsForTemplate` is additive documentation + future-enforcement surface only.
9. **All imports in `template-registry.ts` are cycle-free.** `BLOCKED_TEMPLATE_KEYS` is duplicated locally (not imported from `theme-document.ts`) to prevent circular dependency.

---

## Lane A — `packages/theme-engine`

### New file: `src/template-registry.ts`

Exports:
- `TemplateTypeEntry` interface: `{ allowedDrops, alternatesAllowed, sectionGroupRoles, requiresLayout }`.
- `TEMPLATE_TYPE_REGISTRY: Readonly<Record<string, TemplateTypeEntry>>` — Object.freeze'd map covering all 23 canonical base keys (13 non-customer + 10 customer slash-keys). Entries marked `NOT YET IN BUNDLE` for `list-collections`, `gift_card`, `customers/reset`, `customers/activate`.
- `REGISTRY_BASE_TYPE_COUNT` — length of the registry for test assertions.
- `MAX_TEMPLATE_VARIANTS_PER_TYPE = 20` — cap on alternate variants per base type.
- `MAX_TEMPLATE_KEY_LENGTH = 120` — must match `ThemeDocumentTemplateSchema.key.max(120)`.
- `ParsedTemplateKey` interface: `{ baseType: string, suffix: string | null }`.
- `parseTemplateKey(key: string): ParsedTemplateKey` — splits on the first `.` (dot only); `'customers/login'` → `{ baseType: 'customers/login', suffix: null }`.
- `InvalidTemplateKeyError` — `Error` subclass with `key` and `reason` properties.
- `validateTemplateKey(key: string): void` — throws `InvalidTemplateKeyError` on the first failed constraint. Six constraints in order: (1) length (non-empty, max 120), (2) prototype-pollution guard (`__proto__`, `constructor`, `prototype`), (3) no leading `/`, (4) no `..`, (4b) no `//` (consecutive-slash guard), (5) charset `[a-z0-9_\-/.]` starting with `[a-z0-9]`, (6) suffix charset `[a-z0-9_\-]` if suffix present.
- `resolveAlternateTemplate(bundleTemplates, baseType, suffix): string | undefined` — pure lookup: tries `baseType.suffix`, falls back to `baseType`, then `undefined`. Uses `Object.prototype.hasOwnProperty` (not `in`) for pollution safety.
- `getAllowedDropsForTemplate(key: string): readonly string[]` — parses to `baseType`, looks up registry entry, returns `allowedDrops`. Falls back to universal minimal set `['shop', 'request', 'settings', 'routes']` for unknown base types.
- `findExcessiveVariantCounts(bundleTemplates): Record<string, number>` — counts alternate variants per base type; returns only base types that exceed `MAX_TEMPLATE_VARIANTS_PER_TYPE`. Used by `ThemeDocumentSchema.superRefine`.

### Modified file: `src/theme-document.ts`

- Import `validateTemplateKey`, `findExcessiveVariantCounts`, `InvalidTemplateKeyError` from `'./template-registry'`.
- `ThemeDocumentTemplateSchema.superRefine`: call `validateTemplateKey(template.key)`; catch `InvalidTemplateKeyError`; emit a `ZodIssue` at path `['key']` with the error reason.
- `ThemeDocumentSchema.superRefine` (check #6): call `findExcessiveVariantCounts` on a synthetic `Record<key, true>` built from `doc.templates`; emit a `ZodIssue` for each base type in the excess map.
- `toThemeDocumentV2`: add a pre-conversion sanity pass that calls `validateTemplateKey` on each `parsed.templates` key before the main conversion; throw with a clear message on failure rather than emitting a `ZodError` mid-parse.

### Modified file: `src/index.ts`

Add `export * from './template-registry'` with a Phase V comment block.

### New file: `test/template-registry.test.ts`

Tests grouped as:
- Constants: `MAX_TEMPLATE_VARIANTS_PER_TYPE`, `MAX_TEMPLATE_KEY_LENGTH`, registry is frozen.
- Registry coverage: all 23 expected base keys present; `REGISTRY_BASE_TYPE_COUNT` matches actual key count; every entry has required fields with correct types.
- Registry semantics: `product`/`page`/`collection` have `alternatesAllowed: true`; `index`/`blog`/`cart`/`search` have `alternatesAllowed: false`; `password` has empty `sectionGroupRoles` and `requiresLayout: false`; `gift_card` has `sectionGroupRoles: ['header']` only.
- `parseTemplateKey`: `'product.custom'` → `{baseType:'product', suffix:'custom'}`; `'index'` → `{baseType:'index', suffix:null}`; `'customers/login'` → `{baseType:'customers/login', suffix:null}`; trailing dot → `suffix:null`.
- `validateTemplateKey` accepts: valid base keys, `'customers/login'`, `'product.alternate'`, `'not_found'`, `'list-collections'`.
- `validateTemplateKey` rejects: `'../etc'`, `'__proto__'`, `'constructor'`, keys >120 chars, leading `/`, `'customers//login'`, `'PRODUCT'` (uppercase), `'product.Custom'` (uppercase in suffix), `'product.has.dots'` (double dot in suffix).
- `resolveAlternateTemplate`: returns suffix key when present, falls back to base key, returns `undefined` when neither exists.
- `getAllowedDropsForTemplate`: `'product'` includes `'product'`, excludes `'article'`; `'article'` includes `'article'`, excludes `'product'`; `'product.custom'` returns same as `'product'`; unknown key returns minimal safe set.
- `findExcessiveVariantCounts`: empty map when all counts ≤ 20; returns excess entries when a type has > 20 alternates.
- Round-trip: all 3 fixture bundles (Urban Kicks, LetBuyy Core, minimal) pass `toThemeDocumentV2` → `fromThemeDocumentV2` with structural identity after Phase V superRefine additions.
- Schema integration: `parseThemeDocument` rejects a doc with 21 `product.*` alternates; accepts exactly 20.
- Hardening (5 tests): `'customers//login'` rejected with reason check; `'a//b'` rejected; `'customers/login'` accepted; 21-variant rejection; 20-variant acceptance (at cap).

---

## Lane B — `apps/merchant-control-plane`

### New file: `src/components/theme-editor/TemplateSwitcherPanel.tsx`

`'use client'`. Props (`TemplateSwitcherPanelProps`):
- `templateOptions: TemplateSwitcherOption[]` — `{ key, label, type }` for each available template.
- `selectedKey: string` — currently selected template key.
- `onChange: (key: string) => void` — emits key string only (RISK-DUAL-N01).
- `disabled?: boolean` — guards all interactions.
- `alternateVariants?: TemplateSwitcherVariant[]` — `{ key, label }` for existing named alternates of the current base type.
- `onCreateAlternate?: (baseType: string) => void` — intent signal only; never creates a `ThemeDocumentTemplate` directly.
- `isLoading?: boolean` — shows skeleton state.
- `error?: string` — shows error state.

Key contracts:
- `useTemplateSwitcher` (exported): pure string-parsing function (not a React hook); splits on `.` to extract `baseType` and `suffix`. Note annotation in JSDoc clarifies the `use*` naming is conventional only — the function has no hook semantics.
- `alternateVariants` list uses `role="listbox"` + `role="option"` + `aria-selected` + `tabIndex` + `Enter`/`Space` keyboard handler.
- Slash-containing keys (e.g. `'customers/login'`) are passed through as raw `<option value>` strings without encoding.
- Loading state: `aria-busy="true"` + animate-pulse skeleton.
- Empty state: `'No templates available'` message.
- `--lb-*` tokens only; no raw px/hex/`rounded-[...px]`; mobile-first 360px.
- No import from `page.tsx`, `globals.css`, Supabase, or `@letbuyy/api-client`.

### Modified file: `package.json` (merchant-control-plane)

Append `theme-editor-v.test.mjs` to test script. This file is FOREIGN WIP (carries prior user modifications); the hunk appends one entry and does not conflict.

### New file: `tests/theme-editor-v.test.mjs`

Static-contract tests (35 tests):
- File existence and `'use client'` directive for `TemplateSwitcherPanel.tsx`.
- `@letbuyy/ui` and `lucide-react` are the only imports (no Supabase, no api-client, no page.tsx).
- `--lb-*` tokens used; no raw px/hex/`rounded-[...px]`.
- Props interface shape: all required and optional props present; types correct.
- `onChange` emits string only (RISK-DUAL-N01: no `section_definitions` mutation).
- `onCreateAlternate` emits base-type string only.
- `disabled` guards `onChange` and variant click.
- `alternateVariants` renders `role="listbox"` + `role="option"` items.
- Slash-containing keys passed through without encoding.
- Loading state: `aria-busy`.
- Empty state message present.
- `useTemplateSwitcher` exported and is a function.
- No `section_definitions` or `block_definitions` mutation in the file.

---

## Hardening

Six findings from the code-review pass require resolution before Phase V closes:

1. **CRITICAL** — Lane A files unstaged: stage and commit `template-registry.ts`, `template-registry.test.ts`, `index.ts` export, and `theme-document.ts` superRefine addition as a single atomic commit.
2. **MEDIUM** — `findExcessiveVariantCounts` not wired into `ThemeDocumentSchema.superRefine`: wire it.
3. **MEDIUM** — `toThemeDocumentV2` narrowing undocumented and unguarded: add pre-conversion sanity pass + docblock.
4. **LOW** — Consecutive-slash keys not rejected: add `key.includes('//')` guard to `validateTemplateKey`.
5. **LOW** — `useTemplateSwitcher` named as hook but has no hook semantics: add `@note` annotation.
6. **LOW** (duplicate of #2) — `findExcessiveVariantCounts` JSDoc/ThemeDocumentTemplateSchema unannotated: same fix as #2 covers this.

---

## Out of Scope

- Per-resource `template_suffix` storage on products/pages (DB-side Shopify parity).
- `enabled_on.templates` / `disabled_on.templates` enforcement at render time.
- `section_groups` field on `ThemeBundleTemplateSchema`.
- `buildLiquidScope` enforcement of the allowlist from `getAllowedDropsForTemplate`.
- Wiring `TemplateSwitcherPanel` into `page.tsx` (rides as foreign WIP).
- Closing RISK-T03/T04/T05/T06 and RISK-SEC-U01/U02/U03 and RISK-A11Y-U01/U02 (retargeted to Phase W).
