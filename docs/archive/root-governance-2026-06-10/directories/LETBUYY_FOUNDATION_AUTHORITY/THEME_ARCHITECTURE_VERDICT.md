# THEME_ARCHITECTURE_VERDICT (final authority)

> **Status:** FINAL theme authority. Reviews the theme runtime/editor/registry/marketplace against **Shopify Online Store 2.0**. Evidence: code. No optimism.

## 1. What is real / fake / over- or under-built

| Layer | State | Evidence | Verdict |
|---|---|---|---|
| Section/block model | **REAL** | `packages/theme-engine/src/theme-registry.ts` — `SectionSchema` with 11 typed settings field-types, `blocks_schema`, presets | OS2.0-shaped, genuine |
| Draft → publish | **REAL** | `theme-execution.adapter.ts` (theme_editor_drafts) | works |
| Portable theme bundles | **REAL (but Liquid OFF in prod)** | `ThemePackageBundleSchema` / `LiquidThemePackageBundleSchema`; **`FEATURE_LIQUID="false"`** `wrangler.toml:241` | built, **not live** |
| Registry ↔ renderer contract | **BROKEN** | renderer dispatches on `rendererKey` string, never imports/validates the registry (`storefront-runtime/template-resolver`) | **a saved section can silently render nothing** |
| Built-in section coverage | **UNDER-BUILT** | 12 of 24 `BuiltInSectionType` have **no schema** (`theme-engine/src/index.ts` vs registry) | half the declared sections fail validation |
| App-block injection | **FAKE (stub)** | `theme-renderer.ts:505-526` returns a placeholder `<div data-letbuyy-app-block>`; **`FEATURE_EXTENSIONS="false"`** | not an extension surface |
| Per-theme schema | **FAKE** | `getSectionSchemas(_themeId)` ignores its arg, returns a constant | no per-theme customization |
| Marketplace tables | **REAL schema, deploy-UNKNOWN** | `theme_packages/_versions/_schema_manifests/_renderer_manifests` wrapped in `isMissingThemeEngineTable()` fallbacks | engine tables may not be deployed |
| Schema evolution / migration | **MISSING** | no migration runner for deployed template JSONB on schema change | existing stores carry stale settings silently |
| Dual draft system | **OVER-BUILT** | `theme_editor_drafts` + `theme_instance_drafts` written in parallel, independent error paths | complexity without reliability gain |
| Distributed theme runtime | **OVER-BUILT / DORMANT** | `InMemorySectionRegistryRuntime` never populated from DB at request time | seam nobody uses |

## 2. Shopify OS2.0 parity

| OS2.0 capability | Shopify | **LetBuyy** | Gap |
|---|:--:|:--:|---|
| JSON templates → ordered sections → blocks | ✓ | ✓ (model) | renderer doesn’t validate against registry |
| Section settings schema drives editor panel | ✓ | ✓ (12/24) | finish the 12 unschemaed |
| Theme app extensions (app blocks) | ✓ | **stub + disabled** | real injection + enable flag |
| Theme store / marketplace + versioning | ✓ | schema built, deploy-unknown | deploy + verify engine tables |
| Schema migration on update | ✓ | **none** | build a migration runner |
| Liquid (or equivalent) render | ✓ | **disabled in prod** | enable + harden, or commit to React-only |
| Visual drag-drop editor | ✓ | **INSUFFICIENT EVIDENCE** | unverified; likely settings-panel, not canvas |
| Online theme preview (draft) | ✓ | ✓ | ok |

## 3. Experience evaluation
- **Theme author XP:** moderate — a real schema model and portable bundle, but Liquid off in prod and no schema-migration path make authored themes fragile across updates.
- **Merchant XP:** acceptable for built-in sections; a section can be configured and saved yet **render nothing** if no React component matches its `rendererKey` — a silent failure that will erode trust.
- **Runtime performance:** SSR from `storefront-runtime/.../store/[subdomain]/page.tsx` via `runtime-composition`; KV stale-while-revalidate present. **INSUFFICIENT EVIDENCE** of per-request N+1 audit — flag for load test.
- **Developer XP:** app-block extension is a stub + flag-disabled — no real third-party theme-extension story today.
- **Marketplace readiness:** schema is ready; the engine tables’ deploy status is guarded-uncertain; without schema migration, a marketplace of evolving themes will silently corrupt existing stores.
- **Visual editing / mobile editing:** **INSUFFICIENT EVIDENCE** of a true visual canvas or mobile theme editor; treat as settings-panel editing until proven.

## 4. Can LetBuyy become Shopify-level?
**Architecturally yes, without a rewrite** — the section/block/bundle model is the right shape. The blockers are: (1) couple renderer↔registry so saved sections can’t silently fail; (2) decide Liquid (enable+harden) **or** commit to a React-section model and delete the Liquid bundle path; (3) make app-block injection real or stop shipping it; (4) build schema migration. None require re-architecting the engine.

## 5. Theme investments (priority)
- **P0 — Renderer↔registry contract:** validate section types against a live registry at render; never silently drop a saved section. (Correctness; merchant trust.)
- **P0 — Decide the rendering substrate:** enable+harden Liquid in prod, **or** delete the Liquid/bundle path and commit to React sections. Shipping a disabled half-feature is the worst state.
- **P1 — Schema coverage + migration:** finish the 12 unschemaed section types; build a JSONB settings migration runner for schema changes.
- **P1 — App blocks real or removed:** wire extension-host injection (gated on the identity/app-platform work) or remove the stub + `FEATURE_EXTENSIONS` until then.
- **P2 — Marketplace enablement:** confirm engine tables are deployed; theme packaging/versioning/review live; per-theme schemas (`getSectionSchemas` must honor `themeId`).
- **P2 — Collapse the dual-draft system** to one.
- **P3 — Visual canvas / mobile theme editing** (the merchant mobile app’s theme editor is its strongest surface per prior audit — invest after foundation).

## 6. Final theme scorecard
| Axis | Score |
|---|--:|
| Section/block architecture | 75/100 |
| Editor (draft/publish) | 65/100 |
| Renderer correctness (registry coupling) | 40/100 |
| Extensibility (app blocks) | 25/100 |
| Marketplace readiness | 45/100 |
| Schema evolution | 20/100 |
| Runtime (prod feature parity — Liquid/ext OFF) | 45/100 |
| **Theme architecture (overall)** | **58/100** |

**Verdict:** the most *Shopify-shaped* part of LetBuyy after the commerce schema — a real OS2.0-style engine that is **half-wired and half-disabled in production.** It is a P0-correctness fix (renderer↔registry) and a P0 product decision (Liquid in or out) away from being trustworthy, and a marketplace/migration build away from being a platform. **Do not invest in marketplace/visual-editor until the renderer contract and rendering-substrate decision land.**
