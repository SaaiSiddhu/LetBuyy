# Phase V Report — Template System

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** V — Template System
**Date authored:** 2026-07-11
**Branch:** `stepup/main`
**Author scope:** Phase V delivers a first-class template type registry, alternate-template key parsing and resolution, path-safety validation for template keys (wired into `ThemeDocumentTemplateSchema`), variant-cap enforcement, and a standalone `TemplateSwitcherPanel` editor component. No gateway routes, database migrations, SECURITY DEFINER RPCs, authentication tokens, or the frozen `theme-renderer.ts` / `theme-registry.ts` were modified. No frozen apps were touched.

---

## HUMAN REVIEW GATE — Read Before Deploying

Phase V touches `apps/merchant-control-plane/package.json` (test script addition — `theme-editor-v.test.mjs` appended). This file carries prior user modifications; the hunk appends one entry and does not conflict. **This change MUST NOT be committed without review of the hunk against the surrounding foreign WIP.**

No new database migrations. No gateway changes. No production deployment is implied by this phase completion. Rollback = revert commits `36d6f342` and `e9462067`.

---

## 1. What Shipped

### 1.1 New Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/theme-engine/src/template-registry.ts` | 600 | `TEMPLATE_TYPE_REGISTRY` (23 base keys), `parseTemplateKey`, `validateTemplateKey` (6 constraints), `resolveAlternateTemplate`, `getAllowedDropsForTemplate`, `findExcessiveVariantCounts`, `InvalidTemplateKeyError`, caps + charset patterns |
| `packages/theme-engine/test/template-registry.test.ts` | 725 | 244 Phase V tests — registry, parse, validate, resolve, drop-allowlist, findExcessiveVariantCounts, round-trip, context isolation, hardening |
| `apps/merchant-control-plane/src/components/theme-editor/TemplateSwitcherPanel.tsx` | 333 | `TemplateSwitcherPanel` (props-driven; RISK-DUAL-N01), `useTemplateSwitcher` hook (pure string parser), `TemplateSwitcherOption`, `TemplateSwitcherVariant`, `TemplateSwitcherPanelProps` |
| `apps/merchant-control-plane/tests/theme-editor-v.test.mjs` | 276 | 35 static-contract tests — import compliance, design ratchet, RISK-DUAL-N01, ARIA, slash-key handling, state handling |

### 1.2 Modified Files

| File | Change | WIP? |
|------|--------|------|
| `packages/theme-engine/src/theme-document.ts` | Import `validateTemplateKey`, `findExcessiveVariantCounts`, `InvalidTemplateKeyError`; `ThemeDocumentTemplateSchema.superRefine` key-safety check; `ThemeDocumentSchema.superRefine` check #6 (variant cap); `toThemeDocumentV2` pre-conversion sanity pass + docblock | Clean |
| `packages/theme-engine/src/index.ts` | `export * from './template-registry'` added (Phase V comment block) | Clean |
| `apps/merchant-control-plane/package.json` | `theme-editor-v.test.mjs` appended to test script | WIP (foreign) |

### 1.3 FROZEN / Untouched Files

| File | Reason |
|------|--------|
| `packages/theme-engine/src/theme-registry.ts` | FROZEN — `SchemaField` union not modified |
| `packages/theme-engine/src/theme-renderer.ts` | Sanitiser locked; RISK-T03/T04 carried forward |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` | FOREIGN WIP — `TemplateSwitcherPanel` wiring rides as foreign WIP (Phase R pattern) |
| `apps/merchant-control-plane/src/app/globals.css` | FOREIGN WIP — no CSS change required for Phase V |

---

## 2. Template Registry

### 2.1 Registry Design

`TEMPLATE_TYPE_REGISTRY` is an `Object.freeze`-d `Record<string, TemplateTypeEntry>` covering all 23 canonical Shopify-parity template base keys. It is pure + deterministic: no I/O, no mutable state, no imports with side effects.

**Entry shape:**
```typescript
interface TemplateTypeEntry {
  allowedDrops:      readonly string[]            // Liquid drop names permitted for this template
  alternatesAllowed: boolean                      // named suffixes (product.custom) permitted
  sectionGroupRoles: readonly ('header'|'footer')[] // section groups rendered on this template
  requiresLayout:    boolean                      // wrapped in layout/theme.liquid
}
```

### 2.2 All 23 Base Keys

| Base Key | alternatesAllowed | sectionGroupRoles | requiresLayout | Notes |
|----------|-------------------|------------------|----------------|-------|
| `index` | false | header, footer | true | |
| `product` | **true** | header, footer | true | |
| `collection` | **true** | header, footer | true | |
| `list-collections` | false | header, footer | true | NOT YET IN BUNDLE |
| `page` | **true** | header, footer | true | |
| `policy` | false | header, footer | true | |
| `blog` | false | header, footer | true | |
| `article` | false | header, footer | true | |
| `cart` | false | header, footer | true | |
| `search` | false | header, footer | true | |
| `not_found` | false | header, footer | true | |
| `password` | false | _(none)_ | **false** | Standalone; no layout |
| `gift_card` | false | **header only** | **false** | NOT YET IN BUNDLE; Shopify parity: no footer |
| `customers/login` | false | header, footer | true | |
| `customers/register` | false | header, footer | true | |
| `customers/account` | false | header, footer | true | |
| `customers/orders` | false | header, footer | true | |
| `customers/order` | false | header, footer | true | Allows `customer` + `order` drops |
| `customers/addresses` | false | header, footer | true | |
| `customers/settings` | false | header, footer | true | |
| `customers/wishlist` | false | header, footer | true | |
| `customers/reset` | false | header, footer | true | NOT YET IN BUNDLE; pre-auth (no `customer` drop) |
| `customers/activate` | false | header, footer | true | NOT YET IN BUNDLE; pre-auth (no `customer` drop) |

Keys marked **NOT YET IN BUNDLE** have registry definitions for forward compatibility; their Liquid section sources and bundle entries are out of Phase V scope.

### 2.3 Customer Route Key Mismatch (existing bug, NOT fixed in Phase V)

`StorefrontRouteType` uses underscore form (`customer_account`, `customer_orders`, etc.) while the canonical bundle keys use slash form (`customers/account`, `customers/orders`, etc.). `resolveTemplateKey` in `template-resolver.ts` returns the route type unchanged, so all customer Liquid templates currently fall back to `index` at runtime. This is a pre-existing tracked bug. The registry documents the canonical slash keys and makes the mismatch explicit in code comments.

---

## 3. Key Parsing and Validation

### 3.1 `parseTemplateKey`

Splits on the **first** `.` (dot only — slash is not a suffix separator):

```
'product'           → { baseType: 'product',         suffix: null    }
'product.custom'    → { baseType: 'product',          suffix: 'custom' }
'page.contact'      → { baseType: 'page',             suffix: 'contact' }
'customers/login'   → { baseType: 'customers/login',  suffix: null    }
```

### 3.2 `validateTemplateKey` — six constraints (in order)

1. Length: non-empty; max 120 chars (matches `ThemeDocumentTemplateSchema.key.max(120)`).
2. Prototype-pollution guard: rejects `'__proto__'`, `'constructor'`, `'prototype'`.
3. No leading `/`.
4. No `..` (path-traversal guard).
4b. No `//` (consecutive-slash guard — added in hardening).
5. Full-key charset: `[a-z0-9_\-/.]` starting with `[a-z0-9]`.
6. Suffix charset (if suffix present): `[a-z0-9_\-]` starting with `[a-z0-9]` — no slashes or dots in suffix (one level only).

All 23 registry base keys pass cleanly. All 3 existing fixtures (Urban Kicks, LetBuyy Core, minimal) pass cleanly.

### 3.3 `ThemeDocumentTemplateSchema.superRefine` (Phase V addition)

Calls `validateTemplateKey(template.key)` and emits a `ZodIssue` at path `['key']` on failure. Backward-compatible: no existing fixture key is rejected.

### 3.4 Variant cap enforcement (Phase V addition in `ThemeDocumentSchema.superRefine`)

`findExcessiveVariantCounts` is called on a synthetic key record built from `doc.templates`. A `ZodIssue` is emitted for each base type exceeding the 20-variant cap. A document with 21 `product.*` alternates is rejected; exactly 20 is accepted.

### 3.5 `toThemeDocumentV2` pre-conversion sanity pass (hardening)

Before the main conversion, `validateTemplateKey` is called on each `parsed.templates` key. Callers receive a clear `InvalidTemplateKeyError` rather than a `ZodError` mid-parse for bundles with non-standard keys.

---

## 4. Alternate Template Resolution

```typescript
resolveAlternateTemplate(
  bundleTemplates: Record<string, unknown>,  // bundle's templates record
  baseType: string,                          // e.g. 'product'
  suffix: string | null | undefined,         // e.g. 'custom' or null
): string | undefined
```

Resolution order:
1. If `suffix` non-null/non-empty AND `'${baseType}.${suffix}'` exists in `bundleTemplates` → return it.
2. If `baseType` exists in `bundleTemplates` → return `baseType` (base-key fallback).
3. Neither → return `undefined`.

Uses `Object.prototype.hasOwnProperty.call` (not `in`) for prototype pollution safety.

---

## 5. Context Isolation (additive only)

`getAllowedDropsForTemplate(key)` returns the intended Liquid drop allowlist for a given template key. **Phase V does NOT enforce this in `buildLiquidScope`** — additive documentation and future-enforcement surface only. No behavior change to the storefront renderer or the composition engine.

The function falls back to the minimal universal set `['shop', 'request', 'settings', 'routes']` for unknown base types — never the full commerce drop set.

This design preserves backward compat with all existing fixtures and all currently-rendered storefronts. Future enforcement (post Phase V) can gate each drop in `buildLiquidCommerceContext` against `getAllowedDropsForTemplate(resolvedKey)` after verifying that all production templates comply.

---

## 6. TemplateSwitcherPanel (Lane B)

### 6.1 Component Contract

`TemplateSwitcherPanel` is a standalone `'use client'` component. It is driven entirely by props — no internal API calls, no Supabase access, no `page.tsx` import.

**RISK-DUAL-N01 enforcement:**
- `onChange(key: string)` emits the template key string only — never a `ThemeDocumentTemplate` object.
- `onCreateAlternate(baseType: string)` emits the base-type string only — it is a signal of intent. The actual `ThemeDocumentTemplate` creation is handled by the editor's existing draft path.
- `section_definitions` and `block_definitions` are never accessed or mutated.

### 6.2 `useTemplateSwitcher` (exported helper)

A pure string-parsing function (named with `use*` prefix for conventional consistency with the broader pattern; carries `@note` annotation clarifying it has no hook semantics):

```typescript
useTemplateSwitcher('product')        → { baseType: 'product',         suffix: null }
useTemplateSwitcher('product.custom') → { baseType: 'product',          suffix: 'custom' }
useTemplateSwitcher('customers/login')→ { baseType: 'customers/login',  suffix: null }
```

### 6.3 Alternate Variant List

When `alternateVariants` is provided, a `role="listbox"` container renders `role="option"` items with `aria-selected` and `tabIndex`. `Enter`/`Space` keyboard handler fires `onChange`. Items use slash-containing keys without encoding.

### 6.4 Editor Wiring Note

Wiring into `page.tsx` rides as WIP alongside the foreign `page.tsx` edits, identical to the Phase R pattern (ConflictDialog, SectionTreePanel). The component is standalone and testable without `page.tsx`. No functional regression to the editor occurs from mounting or not mounting this component.

---

## 7. Hardening

Six findings from the code-review pass were resolved in a single atomic commit (`36d6f342`):

| Finding | Severity | Resolution |
|---------|----------|------------|
| Lane A files unstaged (template-registry.ts, test, index.ts export, theme-document.ts) | CRITICAL | Staged and committed atomically as `36d6f342` |
| `findExcessiveVariantCounts` not wired into `ThemeDocumentSchema.superRefine` | MEDIUM | Wired into superRefine check #6; new test rejects 21-variant doc |
| `toThemeDocumentV2` narrowing undocumented / unguarded | MEDIUM | Pre-conversion sanity pass added; docblock updated |
| Consecutive-slash keys not rejected by `validateTemplateKey` | LOW | `key.includes('//')` guard added as constraint 4b; test added |
| `useTemplateSwitcher` named as hook but has no hook semantics | LOW | `@note` annotation added to JSDoc |
| `findExcessiveVariantCounts` JSDoc unannotated (duplicate of MEDIUM) | LOW | Same fix as MEDIUM — JSDoc updated |

---

## 8. Backward Compatibility

All existing behavior is preserved:

- **Round-trip:** All 3 fixtures (Urban Kicks, LetBuyy Core, minimal) round-trip through `toThemeDocumentV2` → `fromThemeDocumentV2` with structural identity. Verified by 3 round-trip tests (key-insertion-order-agnostic deep equal).
- **Theme-document tests:** All 1141 pre-Phase-V theme-engine tests continue to pass.
- **`buildLiquidScope`:** Not modified. Context isolation is additive documentation only.
- **Storefront renderer:** Not modified.
- **Customer route key mismatch:** Not changed. The mismatch is documented, not fixed.
- **`TemplateSwitcherPanel`:** Net-new component. A store with no alternate templates behaves exactly as before; the component only activates when the editor mounts it with a non-empty `templateOptions` prop.

---

## 9. Rollback

Rollback = revert commits in order:
1. `git revert 36d6f342` — reverts Lane A + hardening (template-registry.ts, test, index.ts export, theme-document.ts superRefine additions, hardening fixes).
2. `git revert e9462067` — reverts Lane B (TemplateSwitcherPanel.tsx, theme-editor-v.test.mjs, package.json test entry).

After revert, theme-engine returns to 1141 tests, merchant to 196 tests, and `ThemeDocumentTemplateSchema.key` loses the path-safety guard.
