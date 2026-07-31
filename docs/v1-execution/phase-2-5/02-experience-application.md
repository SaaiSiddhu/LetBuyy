# Stream B — Experience Application — Report

**Status:** ✅ WIRED (typecheck + contract tests)

## Flow
`Select Experience → Apply → draft themeSettings updated → live preview updates` — no page refresh, no new API.

## How it works
`applyExperience(experienceId)` in the editor:
1. `getExperience(id)` → `buildExperienceSettingsOverlay(experience)` (the colors/typography/radius overlay, emitting both `fontFamily` and `bodyFontFamily`).
2. `applyChange(current => ({ ...current, themeSettings: { ...current.themeSettings, ...overlay, experienceId } }))`.
3. `applyChange` flips `isDirty` → the existing 900ms debounce calls `syncPreviewDraft()` → upserts `theme_editor_drafts` **and** refreshes the preview-session token → the live iframe re-renders.
4. `buildDraftConfig` propagates `state.themeSettings` into **both** `templateConfig.themeSettings` (React path) and `config.settings_data.current` (Liquid path), so colors, typography, layout (border radius), and tokens all apply on every render path.
5. **Publish** is unchanged — the existing `publish_theme_release` RPC promotes the draft.

## Applies: colors · typography · layout · tokens · theme settings
The overlay covers `primaryColor / secondaryColor / accentColor / backgroundColor / textColor / surfaceColor / fontFamily / bodyFontFamily / headingFontFamily / borderRadius`. **Sections:** the experience's `defaultSections` order is carried on the experience (`layout.sectionOrder`); the editor's section tree remains the merchant's to arrange — applying an Experience sets the token/style layer (section re-ordering on apply is a documented optional enhancement).

## Works in: preview · draft · publish
- **Preview:** automatic via `syncPreviewDraft` (no refresh).
- **Draft:** persisted to `theme_editor_drafts` via the existing save path.
- **Publish:** existing publish flow, unchanged.

## Evidence
`lb-experience-flow.test.mjs` B-tests: the apply handler exists and merges the overlay into `themeSettings`; the editor wires `<ExperiencePicker onApply={applyExperience} />`. Full launch suite 163/163 (no regression). merchant-control-plane typecheck clean.
