# App ↔ Theme Integration Audit (Phase 4)

Scope: how Apps interact with Theme Runtime, Theme Editor, Theme Marketplace, LiquidJS Runtime. Evidence from `packages/theme-engine`, `packages/app-engine`, `apps/storefront-runtime/src/lib/theme-engine/*`, `apps/theme-marketplace`, gateway `routes/themes.ts` (858 lines).

---

## 1. Current Communication Map

```
app_installations.config / app_extensions (DB)
        │  (snapshotted into store.templateConfig.appBlocks at store fetch)
        ▼
StoreService.getStoreBySubdomain()  ──  storefront-runtime/src/lib/store-service.ts
        │ injectAppBlocksIntoSections()        (:220-288)
        │ normalizeAppBlockInstances()         (app-engine ~:1556)
        ▼
appBlockSlot SectionModel(s)  ──  theme-engine/src/theme-registry.ts
        │
        ├─ JSON-contract path → RenderSectionList → renderer 'apps.app-block' (React)
        └─ Liquid path → buildLiquidAppBlocks() map → resolveLiquidAppBlockHtml()
                           → block HTML inserted into section scope → engine.parseAndRender
```

There is **one** integration mechanism (slot sections fed by DB rows) and it is unidirectional (apps push pre-shaped content; themes expose named slots).

## 2. Where Communication Breaks

| # | Break | Evidence | Effect |
|---|---|---|---|
| B1 | Apps cannot contribute Liquid, JS, or CSS to a theme | No app-bundle ingestion anywhere; theme bundle validator forbids `{% render %}`/`{% include %}` (`theme-bundle.ts` forbidden fragments) so even snippet-style composition is closed | All dynamic app UX must be iframe → style mismatch, perf, no SSR |
| B2 | `theme.app_block` renderer `liquid_app_block` declared but unimplemented | app-engine:231 declares it; no code path consumes it (grep: only type refs) | Manifest promises a capability the runtime lacks |
| B3 | Slots only exist where a theme explicitly placed `appBlockSlot` | injectAppBlocksIntoSections creates missing slot sections dynamically — but appended, not merchant-positioned | Merchant can't position app content like Shopify `@app` blocks |
| B4 | Theme editor has no app-block picker | Editor schemas (drafts/publish/preview, theme-engine:886-909) carry no extension-registry query; no editor UI reads `app_extensions` | Merchants manage app blocks outside the visual editor (or not at all) |
| B5 | No app data binding | `SectionRenderData` supports only `products?/product?` (data-binding-engine.ts:58-61); apps can't declare data deps | App blocks are static or must client-fetch through iframe |
| B6 | `StoreTemplateConfig.appBlocks?: unknown` | theme-engine/src/index.ts:99-128 | Untyped boundary between platform and theme runtime; silent coercion downstream |
| B7 | Theme marketplace install path ignores installed apps | `ThemeService.installTheme()` (theme-marketplace/src/lib/theme-service.ts:112-122) → gateway `themes.ts`; no reconciliation of existing AppBlockInstances to new theme's slots | Theme switch orphans/drops app placements (Shopify migrates app embeds + prompts for blocks) |
| B8 | Preview sessions don't carry app-block drafts | `theme_preview_sessions` + PreviewTokenSchema (:900-903) scope theme config only | Can't preview an app block before publishing |

## 3. Ownership Boundary Review (vs `docs/governance/runtime-boundaries.md`)

| Boundary | Status | Notes |
|---|---|---|
| theme-engine (package) must not know app specifics | **Violated softly** | `theme-registry.ts` hardcodes `appBlockSlot` + renderer key `apps.app-block`; app concepts leak into theme core instead of a registry-driven extension point |
| storefront-runtime owns composition | OK | injection lives in store-service (app layer of storefront) |
| app-engine must not import apps/services | OK | pure types/normalizers |
| Gateway owns persistence of app placements | **Unclear** | Write-path for `AppBlockInstance` rows not found in admin surfaces; appears only via install `config` — i.e., merchants currently cannot add/move/remove app blocks post-install (no PATCH endpoint for placements; `PATCH /installations/:id/extensions/:registrationId` toggles registry status only, app-store.ts:987) |
| Theme marketplace ↔ app marketplace | No contract | Two marketplaces share no slot-compatibility metadata |

## 4. Coupling / Dependency / Rendering / Schema Issues
- **Coupling:** composition-engine imports app-engine normalizers directly; a future extension-registry service should mediate (storefront should read a *resolved placement snapshot*, not normalize raw installation config at request time).
- **Dependency:** `extension-host` package is depended on by merchant-control-plane but not by storefront-runtime — the host that should sandbox admin extensions is absent from the surface that renders app content for shoppers (iframes are hand-rolled in composition-engine instead).
- **Rendering:** inline mode escapes everything (safe but inert: no markup beyond heading/body/CTA); iframe mode allows `allow-same-origin` + `allow-scripts` together — that combination lets the framed document remove its own sandbox if same-origin; app iframes should be cross-origin (dedicated app CDN domain) or drop `allow-same-origin`.
- **Schema:** `AppBlockInstance.settings: Record<string, unknown>` has no per-extension settings schema enforcement at write time (extension manifest `settings` exists in app-engine schema but no validator runs on placement writes).
- **Versioning:** placements reference `extension_id` with no version pin; an extension behavior change retroactively mutates all storefronts (Shopify pins extension versions per release).

## 5. Theme Marketplace Specifics
- Catalog/install real (`GET /api/themes`, `/api/themes/[slug]`, `POST /api/themes/install`; gateway `themes.ts` 858 lines).
- Same silent-fallback defect as app marketplace (`theme-service.ts:18-23` returns null/empty on failure).
- No theme-side declaration of app-block capability (Shopify themes advertise OS2.0/`@app` support implicitly via JSON templates; LetBuyy themes should declare supported slots / `@app` acceptance in bundle metadata — absent).
- Review/approval for themes: `theme.submitted/approved/rejected` events typed (event-core) but no reviewer workflow surfaces found in platform-console scan.

## 6. Integration Verdict
The slot system is a sound v0 (typed, tenant-scoped, dual-renderer aware, escaped/sandboxed), but it is a **content-injection** system, not an **extension** system. Everything Shopify-like about TAE — app-shipped Liquid blocks, app embeds, merchant positioning in the editor, version-pinned deployments, conditional asset loading — is absent. Remediation is designed in docs 11 (Extensions/Blocks/Embeds blueprint) and 12 (LiquidJS integration blueprint).
