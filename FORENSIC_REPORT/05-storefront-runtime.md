# Storefront Runtime Investigation Report

## Rendering pipeline (traced end-to-end)

```
Request → src/proxy.ts (subdomain from x-store-subdomain / forwarded host / hostname)
        → rewrite /store/[subdomain]/…
→ app/store/[subdomain]/layout.tsx → StoreService.getStoreBySubdomainAnyStatus(subdomain)
   ├─ demo short-circuit: isUrbanKicksDemoSubdomain() → getUrbanKicksDemoStore()  [hardcoded]
   └─ otherwise: fetchWorkerStore(subdomain) + fetchWorkerNavigationBundle(subdomain)  → gateway routes/storefront.ts
→ store.templateConfig (themeId, releaseId, themeSettings, sections, sectionGroups, templates, liquidBundle)
→ lib/theme-engine/template-resolver.ts → resolve page template + header/footer groups (explicit groups, else filter by section.type)
→ lib/theme-engine/data-binding-engine.ts → collect product IDs across sections (Set-dedupe)
   → ONE batched getProductsByIds() call → Map for O(1) per-section lookups   [no N+1]
→ lib/theme-engine/composition-engine.tsx
   ├─ JSON-contract path: RenderSectionList → renderRegisteredSection() per section
   │     renderer chosen by section.rendererKey || section.type from renderer-registry.tsx
   └─ Liquid path: createThemeRenderer('liquid') for liquidBundle themes (line 163)
→ editorMode? wrap each section in EditorPreviewSectionFrame (data-letbuyy-editor-* attrs, postMessage bridge)
```

## Ownership answers (as demanded by the investigation brief)

| Question | Answer | Evidence |
|----------|--------|----------|
| Who owns rendering? | `apps/storefront-runtime` (composition-engine + registry), **not** `packages/theme-engine` (engine provides contracts + Liquid renderer only) | `src/lib/theme-engine/composition-engine.tsx` |
| Who owns layouts? | storefront app (`app/store/[subdomain]/layout.tsx` + section groups resolver) | `template-resolver.ts:39-62` |
| Who owns templates? | data: per-store `templateConfig.templates` in DB; resolution logic: storefront app | `template-resolver.ts` |
| Who owns sections? | **storefront app** — static React imports + `RUNTIME_SECTION_SCHEMAS` in `renderer-registry.tsx` | lines 1–100 |
| Who owns blocks? | theme-engine contracts; hydration in app (`app-block-slot.tsx` reads `section.blocks`) | both files |

## Shopify-alignment verdict on rendering

Shopify's model: theme code (Liquid sections) is merchant/theme-developer-owned data; the platform runtime executes arbitrary theme-defined sections. LetBuyy's JSON-contract path inverts this: the **platform app owns the section implementations**; themes only parameterize them. The Liquid path restores Shopify-style ownership but is secondary (preview doesn't use it; first-party themes use the JSON path). Consequences, with evidence:

1. New section type ⇒ storefront deploy (`renderer-registry.tsx` static imports) — no community section ecosystem possible on the primary path.
2. Editor preview fidelity: preview always React-path with editor frames (`preview/page.tsx:347-352`); Liquid themes preview ≠ production output.
3. Demo tenant bypass (`store-service.ts:54-57`) means the flagship demo never exercises the real pipeline — pipeline regressions invisible on the demo.

## Merchant & app integration points

- Merchant: editor drafts land in `theme_drafts`; preview-session tokens (15-min) gate `/preview`; publish snapshot → `theme_releases` then live (one step).
- Apps: `app-block-slot.tsx` renders `inline` or `iframe` modes via `normalizeAppBlockInstances()` (`@letbuyy/app-engine`), but blocks come from theme section data — no query of `app_extension_registrations` in storefront source (gap detailed in Apps Ecosystem report).

## Performance & scale characteristics observed

- Batched product hydration (above), hardcoded `limit: 100` list caps (`product-service.ts:45,62`), Next revalidation tags `storefront:${subdomain}:*`, aggressive static caching + AVIF/WebP in `next.config.ts`.
- All storefront data flows through one gateway route file (`routes/storefront.ts`, 4,320 lines) — per-request fan-out is 2 worker calls (store + navigation) plus per-page data; cache lives at the Next layer, no edge cache evidence at gateway layer.
- CSP `frame-ancestors` restricted to admin domains; HSTS; Permissions-Policy set.
