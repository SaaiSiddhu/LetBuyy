# Differentiation root cause and unresolved branches

## Established cause in the current source path

**RC-01 / DOCUMENTED + MEASURED:** `createFirstPartyCatalogBundle` starts with the Core fixture, changes package identity, and overlays listing settings (`first-party-theme-catalog.ts:34–46`). It does not apply `EXPERIENCE_COMPOSITIONS`. The same-catalog 30-render experiment confirms identical primary template/main markup across all ten identities. This reproduces the reported structure-level sameness without relying on comments, thumbnails or cache speculation.

**RC-02 / DOCUMENTED:** `scripts/liquid-parity/build-first-party-catalog.mjs:22–28` constructs each catalog document from `base.default_template`, changes identity and settings, then retains its bundle/templates. Its SQL generation feeds migration 372. `ON CONFLICT(slug) DO NOTHING` also means re-running this historical catalog insert is not a valid update strategy for existing rows. Do not run or rewrite that migration as a research repair.

**RC-03 / DOCUMENTED:** `ThemeExecutionAdapter.installTheme` verifies the site, gets the selected theme's default template, merges identity, validates it and passes that document to `install_owned_theme_v1`. It correctly starts from the selected design rather than merging the outgoing store. If the selected catalog document contains Core composition, installation preserves it. Fix the selected artifact and assert the pipeline, rather than adding a second renderer in the installer.

**RC-04 / DOCUMENTED:** onboarding calls `applyExperienceToTemplateConfig` (`stores.ts` current onboarding path; helper at `theme-presets.ts:510–538`). The helper overlays `experienceId`, `themeSettings` and config current settings, not templates. It is a settings path, distinct from the richer pure document-application API.

**RC-05 / BOUNDED SEARCH:** searching `apps` and `services` for `applyExperienceToDocument`, `applyExperienceToSections` and `computeExperienceApplyDiff` returned two explanatory comments in the AI customization panel/proxy, not a runtime invocation. This strongly supports missing production composition wiring within the searched roots; it is not proof about external deployed systems or untracked code elsewhere.

## Why a source change alone will not update an installed storefront

The release builder stores `template_snapshot`, `settings_snapshot` and a release manifest including the Liquid bundle (`theme-execution.adapter.ts:570–615`). The storefront resolver selects the bundle from the supplied store configuration/release manifest. Merchant instances/drafts and published snapshots are separate state. Updating a default catalog definition must not rewrite an existing saved release. Preview/publish/readback must be tested end to end on an explicitly selected test site during implementation.

Old snapshots are therefore a plausible additional cause of unchanged deployed output, but **not verified** in this research. Do not label the entire problem caching. No cache invalidation, republish or SQL update was performed.

## Representation gaps that remain after composition wiring

1. A section array may differ only by announcement, trust and newsletter placement. That is weak niche differentiation.
2. Product-card anatomy and PDP selection remain common unless the canonical schema/sections consume different layout/fact settings.
3. Product DTO metadata is not automatically present in `productToLiquidDrop`. Typed niche facts need an explicit validated hydration contract.
4. Sort/price/vendor controls in `collection-filter` are conditional on server-supplied payloads. Those facet payloads are absent in the inspected drop construction, so flags alone cannot activate functioning filters.
5. A composition that includes generic assurances can invent free shipping or certification unless merchant content/policy controls it. Do not ship the example composition promises as universal merchant facts.
6. Shared thumbnail geometry promises style changes, not the ten actual journeys the owner requested.

## Corrections to older explanations

| Earlier lead | Current finding | Implication |
|---|---|---|
| Non-system fonts never load | Font registry and storefront head integration now exist | Verify network/paint later; do not rebuild a font system. |
| Missing filter/FAQ/video composition types cause collapse | Current pure resolution returns zero missing types | Test consumption/layout behavior, not registry presence alone. |
| Unique array means unique experience | Separate arrays exist, shipped bundle templates remain equal | Assert rendered artifact and buying mission. |
| Thumbnail proves installed design | Thumbnail generator uses one geometry | Generate previews from the exact versioned artifact. |
| Publishing is equivalent to changing defaults | Releases freeze snapshot/bundle | Preserve merchant ownership and explicit publication. |

## Confidence and next decisive test

High confidence: current source catalog construction, experiment equality, helper semantics, generated catalog SQL and release-snapshot architecture. Inference: these paths explain the owner's particular installed store. Blocked/unverified: actual catalog row payload, instance draft, active release ID/snapshot, deployed font requests, and preview/published DOM parity.

First implementation test: select two distinguishable representative designs on a disposable tenant-isolated test fixture; install, save/read back, preview, publish through the existing service, read back the release and render the published route. Assert exact document identity and meaningful home/collection/PDP structural differences at each boundary. No production merchant mutation is needed to prove the design.

## Source trace

- [scripts/liquid-parity/build-first-party-catalog.mjs](../../../../scripts/liquid-parity/build-first-party-catalog.mjs)
- [database/supabase/migrations/372_first_party_theme_catalog.sql](../../../../database/supabase/migrations/372_first_party_theme_catalog.sql)
- [services/api-gateway/src/execution/theme-execution.adapter.ts](../../../../services/api-gateway/src/execution/theme-execution.adapter.ts)
- [services/api-gateway/src/routes/themes.ts](../../../../services/api-gateway/src/routes/themes.ts)
- [services/api-gateway/src/routes/stores.ts](../../../../services/api-gateway/src/routes/stores.ts)
- [packages/theme-engine/src/theme-presets.ts](../../../../packages/theme-engine/src/theme-presets.ts)
- [packages/theme-engine/src/experience-apply.ts](../../../../packages/theme-engine/src/experience-apply.ts)
- [apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx](../../../../apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx)
- [apps/commerce/web/src/lib/theme-engine/template-resolver.ts](../../../../apps/commerce/web/src/lib/theme-engine/template-resolver.ts)
- [apps/commerce/web/src/lib/theme-engine/composition-engine.tsx](../../../../apps/commerce/web/src/lib/theme-engine/composition-engine.tsx)
