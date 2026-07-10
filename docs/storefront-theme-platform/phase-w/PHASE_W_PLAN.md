# Phase W Plan — Dynamic Sources + Custom Data

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** W — Dynamic Sources + Custom Data
**Date:** 2026-07-11

---

## Objective

Deliver (1) a tenant-safe unified resource-search gateway route and Next.js proxy, (2) a typed dynamic-source descriptor model in `packages/theme-engine` with section-level resolution integrated into `theme-renderer.ts`, and (3) a live WAI-ARIA 1.2 combobox in `ResourcePickerControl` replacing the Phase U text-input placeholder. Close the most critical Phase T/U deferred risks that touch `theme-renderer.ts` and `controls/`.

---

## Constraints

1. **RISK-DUAL-N01 preserved.** Binding descriptors are stored in section instance `settings` values only — never in `section_definitions` or `block_definitions`. `ResourcePickerControl.onChange` emits only the resource id string.
2. **Cross-tenant isolation.** `resolveDynamicSourceDescriptors` must look up ids exclusively against the caller-supplied, already-site-scoped `siteDrops` map. No independent DB query with an arbitrary id is permitted inside the pure function.
3. **Customer HS256 rejection.** The gateway resource-search route must call `resolveCustomUser` before any table query. A null result (customer token, no `users_custom` row) → 403 FORBIDDEN.
4. **Metafield source is NOT-CONNECTED.** `source: 'metafield'` descriptors resolve to `null` with an honest documented gap. No metafield hydration is added to the storefront render path in Phase W.
5. **`services/api-gateway/src/index.ts` is FOREIGN WIP.** The new resource-search route is mounted inside `routes/themes.ts` via `router.route('/resource-search', resourceSearchRouter)` — no `index.ts` touch.
6. **`packages/typescript/api-client/src/index.ts` is FOREIGN WIP.** No api-client edit. The merchant proxy uses raw `merchantApiFetch` instead of the typed api-client.
7. **`apps/merchant-control-plane/src/app/globals.css` is FOREIGN WIP.** All new ResourcePickerControl CSS lives in `controls.module.css` only.
8. **`--lb-*` tokens only** in all new CSS. No `rounded-[Npx]`. No raw hex or px values in new classes.
9. **`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` is FOREIGN WIP.** `SchemaFormRenderer.tsx` wiring for `storeName` rides in the clean file (it already receives `storeName` from the page's context).

---

## Three-Lane Delivery

### Lane A — Gateway

**New file:** `services/api-gateway/src/routes/resource-search.ts`
- Hono sub-router. Mounted in `routes/themes.ts` as `router.route('/resource-search', resourceSearchRouter)`.
- `GET /` → `GET /v1/themes/resource-search?store_id=uuid&type=product|collection|page|blog|menu&q=text&limit=1-50`.
- Auth: `c.get('auth')` from global `authMiddleware` (registered in `themes.ts` before slug routes) + `resolveCustomUser` (rejects customer HS256 → 403) + `verifySiteOwnership` (rejects cross-site → 403).
- Per-type ilike queries: `products.name`, `collections.title`, `storefront_pages.title` (fallback: `pages.title`), `blog_posts.title`, `navigation_menus.name`.
- Slim response: `{ id, title, handle?, slug? }[]` — no PII, no money fields, no tokens.
- Menu queries `navigation_menus` directly (list all menus matching the store) — not the per-location `GET /pages/navigation`.
- Page search falls back to the legacy `pages` table when `storefront_pages` is absent.

**New file:** `services/api-gateway/src/__tests__/resource-search-w.test.ts`
- 15 cross-tenant negative and auth tests (W-T01–W-T15). See PHASE_W_TEST_REPORT.md for the full list.

**Modified file:** `services/api-gateway/src/routes/themes.ts`
- `authMiddleware` registered for `/resource-search` path.
- `router.route('/resource-search', resourceSearchRouter)` mount before `/:slug/*` catch-all routes.

### Lane B — Theme Engine

**New file:** `packages/theme-engine/src/dynamic-source-binding.ts`

Exports:
- `DynamicSourceDescriptor` — tagged union (`ResourceBinding | MetafieldBinding | StaticBinding`); discriminant `__lb_binding: true`.
- `ResourceBinding`: `{ __lb_binding: true, source: 'resource', resourceType: 'product'|'collection'|'page'|'blog'|'menu', id: string }`.
- `MetafieldBinding`: `{ __lb_binding: true, source: 'metafield', namespace: string, key: string, owner_type: string, owner_id: string }`.
- `StaticBinding`: `{ __lb_binding: true, source: 'static', value: unknown }` — wraps any plain scalar as an explicit binding for tooling convenience.
- `isDynamicSourceDescriptor(v: unknown): v is DynamicSourceDescriptor` — type guard; returns `false` for plain scalars, arrays, objects without `__lb_binding: true`, and objects with unknown `source`.
- `SiteDrops` — interface for the caller-supplied lookup maps: `productsById`, `collectionsById`, `pagesById`, `blogsById`, `menusById` (all optional; absent map → `null` for that resource type).
- `resolveDynamicSourceDescriptors(settings: Record<string, unknown>, siteDrops: SiteDrops): Record<string, unknown>` — pure function; replaces descriptor values with resolved drops or `null`; non-descriptor values pass through byte-identical; never throws; does not mutate the input.
- `BINDING_BLOCKED_KEYS` — credential-adjacent key blocklist applied to resolved drop objects before they enter Liquid scope (`filterDropKeys`).

**New file:** `packages/theme-engine/test/dynamic-source-binding.test.ts`
- 56 tests covering: `isDynamicSourceDescriptor` (15), plain scalar passthrough (6), static binding (4), resource binding (12+), metafield NOT-CONNECTED (4), credential sanitization (5), determinism (3), mixed/edge (7+).

**Modified files:**
- `packages/theme-engine/src/index.ts` — one additive `export *` line.
- `packages/theme-engine/src/theme-renderer.ts` — import `resolveDynamicSourceDescriptors` + `SiteDrops`; add optional `siteDrops?: SiteDrops` to `LiquidCommerceDrops`; call `resolveDynamicSourceDescriptors(templateSection.settings, siteDrops ?? {})` in `renderLiquidTemplateSections` BEFORE settings reach `buildLiquidScope`; backward-compat: plain literal settings unchanged.

### Lane C — Merchant UI

**New file:** `apps/merchant-control-plane/src/app/api/stores/[store]/resource-search/route.ts`
- GET handler; resolves store via `resolveOwnedStoreId`; validates type enum + clamps limit + slices q.
- Proxies to gateway `/themes/resource-search?store_id=<id>&type=...&q=...&limit=20` via `merchantApiFetch`.
- Returns `{ data: [], meta: {} }` shape.
- NOT-CONNECTED documented: depends on gateway lane.

**New file:** `apps/merchant-control-plane/tests/theme-editor-w.test.mjs`
- 55 Phase W static-contract tests.

**Modified files:**
- `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx` — Replace Phase U text-input with WAI-ARIA 1.2 combobox. `storeName` prop gates live branch vs Phase U fallback branch (backward-compat). 300 ms debounce; raw fetch to same-origin proxy; states: idle, loading, results, no-results, error. Selected chip with clear button. `onChange` emits resource id string only (RISK-DUAL-N01).
- `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css` — New Phase W classes using `--lb-*` tokens.
- `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` — Add `storeName={storeName}` to `ResourcePickerControl` in the product/collection/blog/page/menu switch cases.
- `apps/merchant-control-plane/package.json` — Append `theme-editor-w.test.mjs` to test script.

---

## Risks Addressed

| Risk | Status | Resolution |
|---|---|---|
| RISK-T03 (block settings bypass filterBlockedSettingsKeys) | Partially addressed | `BINDING_BLOCKED_KEYS` applied to resolved resource drops at section level; block-level bindings still unresolved (RISK-W06 registered) |
| RISK-T04 (`RENDERER_MAX_BLOCK_DEPTH` private) | Not addressed in Phase W | Carried to Phase X (theme-renderer.ts touch in Phase W does not export the const) |
| RISK-T05 (`allowedChildTypes` not wired) | Not addressed in Phase W | SectionTreePanel.tsx not touched; carried to Phase X |
| RISK-T06 (`UnsupportedThemeDocumentFeatureError` dead export) | Not addressed in Phase W | theme-document.ts not touched; carried to Phase X |
| RISK-SEC-U01/U02/U03 | Not addressed in Phase W | schema-field-extensions.ts not touched; carried to Phase X |
| RISK-A11Y-U01/U02 | Not addressed in Phase W | SchemaFormRenderer.tsx touched (storeName prop only); a11y gap not fixed; carried to Phase X |
| RISK-STYLE-U01/U02 | Partially addressed | Phase W new controls.module.css classes use `--lb-*` tokens; pre-Phase-W raw px values unchanged; RISK-STYLE-U02 updated |

## New Risks Introduced

Six new risks registered from the Phase W security review and code-review findings (see RISK_REGISTER.md):
- **RISK-W01** (MEDIUM): `BINDING_BLOCKED_KEYS` is a manually-maintained copy of `BLOCKED_DROP_KEYS`; no compile-time or test parity enforcement.
- **RISK-W02** (LOW): `auth.user.storeId` is optional; fast-fail in `verifySiteOwnership` is bypassed when storeId is absent from the token.
- **RISK-W03** (LOW): `resolveDynamicSourceDescriptors` trust boundary — block-level settings not resolved; siteDrops tenant-scoping not assertion-tested.
- **RISK-W04** (LOW): `ArrowUp` key handler in `ResourcePickerControl` computes `Math.max(-2, 0) = 0` when `activeIndex` starts at -1 — violates WAI-ARIA 1.2 combobox pattern.
- **RISK-W05** (LOW): Loading indicator is inside the `{isOpen ? …}` conditional; not visible during the 300 ms debounce window on the first keystroke.
- **RISK-W06** (LOW): Block-level settings are not passed through `resolveDynamicSourceDescriptors` — resource binding descriptors in block settings reach Liquid as raw objects.
