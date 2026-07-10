# Phase V Discovery — Template System

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** V — Template System
**Date:** 2026-07-11
**Scope:** Template key model, parity gaps against Shopify's template system, context-isolation state of buildLiquidScope, customer route key mismatch bug, editor template-switcher pre-state.

---

## 1. Pre-Phase-V Template Model

### 1.1 ThemeDocument V2 (source of truth: `packages/theme-engine/src/theme-document.ts`)

`templates` is a **sorted array** (max `MAX_TEMPLATES_PER_DOCUMENT = 100`) of `ThemeDocumentTemplate`:

```typescript
interface ThemeDocumentTemplate {
  key: string      // min 1, max 120 chars — no charset or path-safety constraint pre-V
  name?: string
  layout?: string
  sections: ThemeDocumentSection[]  // max 200 per template
}
```

Pre-Phase-V schema constraints on `key`:
- `z.string().min(1).max(120)` only.
- No charset guard: uppercase letters, spaces, and any character outside `[a-z0-9_\-/.]` would pass `parseThemeDocument`.
- No path-traversal guard: `../etc` or `__proto__` would parse without error.
- No prototype-pollution guard.

Duplicate keys and duplicate section ids per template are caught by a `superRefine`.

### 1.2 Bundle representation (`packages/theme-engine/src/theme-bundle.ts`)

Bundle stores templates as `Record<string, ThemeBundleTemplate>` where each entry has `{ name?, layout?, sections: Record<string, ThemeBundleTemplateSection>, order: string[] }`.

`ThemeLiquidSectionSchema` carries `enabled_on.templates` (default `['*']`) and `disabled_on.templates` (default `[]`) — modelled but **not enforced at render time** (pre-Phase-V gap).

### 1.3 Route→key resolution (`apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts`, line 67)

`resolveTemplateKey(routeType)` returns `'index'` for index, the `routeType` string unchanged for all others.

For Liquid: `resolveLiquidTemplateKey` tries `route.templateKey`, then `routeType` identity, then `'index'`, then the first bundle key.

### 1.4 Known production bug — customer route key mismatch

`StorefrontRouteType` (in `apps/storefront-runtime/src/lib/theme-engine/types.ts`) uses **underscore form** for customer routes:

```
customer_account, customer_orders, customer_wishlist,
customer_settings, customer_addresses, customer_order
```

The canonical bundle (and Shopify parity) stores these under **slash keys**:

```
customers/account, customers/orders, customers/wishlist,
customers/settings, customers/addresses, customers/order
```

Because `resolveTemplateKey` returns the route type unchanged, and because the bundle has no underscore-form customer keys, all customer Liquid templates currently fall back to the `index` template at runtime. Every customer account page renders the home template. This is a tracked pre-existing bug, not a Phase V regression.

---

## 2. Parity Gaps (pre-Phase-V)

### 2.1 No template-type registry

No first-class map from template key to:
- Allowed Liquid context drops (allowlist).
- Whether named alternates (e.g. `product.custom`) are permitted.
- Which section group roles (header/footer) render on this template.
- Whether the main layout wraps this template.

**Must be created:** `packages/theme-engine/src/template-registry.ts` (Lane A).

### 2.2 No alternate / named template naming or resolution

`product.custom`, `page.contact`, and any other `baseType.suffix` keys are:
- Absent from `LiquidThemePackageBundleSchema` (no parse support for dotted keys as first-class alternates).
- Absent from `ThemeDocument` (schema accepts them lexically since `.` passes the pre-V charset-free `z.string().max(120)`, but no resolution logic exists).
- Absent from `StoreTemplateConfig`.
- Absent from `template-resolver.ts`.

`parseTemplateKey` and `resolveAlternateTemplate` must be added (Lane A). Per-resource `template_suffix` storage on products/pages (the Shopify DB-side of alternate assignment) is out of Phase V scope, but resolution logic is needed for the editor.

### 2.3 Template-key validation gap

`ThemeDocumentTemplateSchema.key` is `z.string().min(1).max(120)` with no charset or path-traversal guard. A bundle with template keys containing `../`, `__proto__`, or uppercase letters would round-trip through `toThemeDocumentV2` / `fromThemeDocumentV2` without rejection.

Lane A adds `validateTemplateKey` and hooks it as a `superRefine` on `ThemeDocumentTemplateSchema`.

### 2.4 No per-type alternate variant cap

No enforcement of a maximum number of alternate variants per base type. A bundle with 99 `product.v*` variants would parse without error.

Lane A exports `MAX_TEMPLATE_VARIANTS_PER_TYPE = 20` and `findExcessiveVariantCounts`, and wires the cap into `ThemeDocumentSchema.superRefine`.

### 2.5 No per-template section-group composition

`ThemeBundleTemplateSchema` has no `section_groups` field. Groups are store-wide in the pre-V model. The registry's `sectionGroupRoles` field will model which groups each template type renders (e.g., `password`: no header/footer; `gift_card`: header only) but enforcement in the render plan is a follow-on.

### 2.6 Editor template switcher is inline, not a component

The existing template selector in the editor header (`page.tsx` line 1391) is a native `<select>` declared inline in a 1810-line foreign WIP file. No standalone, testable `TemplateSwitcherPanel` component exists.

Lane B creates `TemplateSwitcherPanel.tsx` as a new file without touching `page.tsx`.

---

## 3. Context Isolation State (pre-Phase-V)

`buildLiquidCommerceContext` (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`) builds a single `LiquidCommerceDrops` object with route-type guards for blog, article, page/policy, but **no per-template allowlist enforcement**:

- `product` drop: set from `collectLiquidProducts(sectionData)` with no route-type gate — any template whose section data carries a product also receives a product drop.
- `collection` drop: set when `route.type === 'collection' || products.length > 0`.

Phase V approach: the `getAllowedDropsForTemplate` function from Lane A defines the **intended** drops per template type for documentation and future enforcement. Phase V does **not** change `buildLiquidScope` behavior — additive only — to preserve backward compat with all existing fixtures.

---

## 4. Pre-existing Risks Targeted at Phase V

From the risk register (inherited from Phases T and U):

| ID | Severity | Description |
|----|----------|-------------|
| RISK-T03 | LOW | `block.settings` bypass `filterBlockedSettingsKeys` in `theme-renderer.ts` |
| RISK-T04 | LOW | `RENDERER_MAX_BLOCK_DEPTH` private/unexported |
| RISK-T05 | MEDIUM | `allowedChildTypes` not wired from `SectionTreePanel` to `BlockChildRow` — add-child dead |
| RISK-T06 | LOW | `UnsupportedThemeDocumentFeatureError` dead export |
| RISK-SEC-U01 | MEDIUM | `isUnsafeUrl` narrow blocklist |
| RISK-SEC-U02 | MEDIUM | `ColorBackgroundControl` gradient mode no `url()` content check |
| RISK-SEC-U03 | MEDIUM | `required: true` on `checkbox`/`toggle` is a validation no-op |
| RISK-A11Y-U01 | MEDIUM | `TextInput`/`TextareaInput` missing `aria-describedby` linkage |
| RISK-A11Y-U02 | LOW | Three controls drop `helpText` when error present |
| RISK-STYLE-U01 | LOW | `LiquidControl.tsx` raw `fontSize: 12` |
| RISK-STYLE-U02 | LOW | `controls.module.css` raw px spacing |

**Phase V scope decision:** The risks above are not addressed in Phase V. Phase V is narrowly scoped to the template registry (Lane A) and the template switcher component (Lane B). Risks targeting `theme-renderer.ts` (T03/T04), `SectionTreePanel.tsx` (T05), and `schema-field-extensions.ts` / controls (SEC-U01/U02/U03, A11Y-U01/U02, STYLE-U01/U02) remain open and are retargeted to Phase W or first touch.
