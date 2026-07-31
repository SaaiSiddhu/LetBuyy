# Stream B — Theme Preset Engine — Report

**Status:** ✅ DONE (tested, gate-safe) · **File:** `packages/theme-engine/src/theme-presets.ts`

## Architecture
LetBuyy ships ONE Core theme. An **Experience** is a validated preset that overlays the Core theme's design tokens and section layout. The engine composes on top of the existing `settings_data.current → :root` CSS-variable flow (no renderer change, no frozen-file edit).

## Components delivered
| Requirement | Implementation |
|---|---|
| ThemePresetSchema | `ThemeExperienceSchema` (Zod, `.strict()`) + `ExperienceTokensSchema`, `ExperienceColorSystemSchema`, `ExperienceTypographySchema`, `ExperienceLayoutSchema`, `ExperiencePreviewSchema`, `ExperienceMetadataSchema` |
| Preset Registry | `EXPERIENCE_REGISTRY` (frozen) + `EXPERIENCE_IDS` |
| Preset Loader | `getExperience(id)`, `listExperiences()` |
| Preset Resolver | `resolveExperienceForIndustry()` (Stream D) + `getExperience` |
| Preset Validation | `validateExperience()` / `safeValidateExperience()` + `collectExperienceRegistryIssues()` |
| Preset Metadata | `metadata.grounding` ('research' \| 'designed') + `notes` |
| Preset Preview | `ExperiencePreviewSchema` descriptor (label, swatches, headingFont, sectionCount) — a real renderable mini-preview spec, **not** a fabricated screenshot |
| Preset Export | `exportExperience()` → validated JSON |
| Preset Import | `importExperience()` → parse + validate |
| Apply (single Core, many experiences) | `buildExperienceSettingsOverlay()`, `applyExperienceToSettingsData()`, `applyExperienceToTemplateConfig()` — pure merges; write to draft/template_config, never auto-publish |

## Key design choices
- **Apply emits both `fontFamily` (React JSON-contract path) and `bodyFontFamily` (Liquid token map)** so the experience font reaches every render path.
- `applyExperienceToTemplateConfig` writes the overlay into BOTH `templateConfig.themeSettings` and `config.settings_data.current`, sets `experienceId`, and **does not mutate its input** (verified by test).
- No new file under `components/sections/`; no React component; pure data + logic → **passes** `no-new-react-sections` and `theme-governance` (25 built-in types / 20 parity unchanged).

## Tests (`packages/theme-engine/test/theme-presets.test.ts`, run via `tsx --test`)
14 behavioral tests: registry integrity (`collectExperienceRegistryIssues() === []`), schema accept/reject, overlay dual-font emit, merge/replace semantics, template-config dual-path + no-mutation, export/import round-trip, plus Stream D cases. **Part of the 76/76 theme-engine suite.**

## Honest gaps (deferred)
- **Apply at the API layer:** the editor applies an experience purely client-side (merge tokens → existing draft-save endpoint), so no new gateway route is required for the MVP. A dedicated `POST /themes/:slug/presets/apply` is optional polish (spec in recon).
- **Export/import persistence** (a `theme_preset_library` table) is Phase-3.
