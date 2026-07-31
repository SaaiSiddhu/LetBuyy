# Stream A — Experience Picker — Report

**Status:** ✅ WIRED (typecheck + contract tests; visual UX unverified — needs the stack)

## What shipped
- **NEW** `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx` — lists the 10 Experiences from `listExperiences()` as cards: name, industry badge, color swatches (`preview.swatches`), description, heading font, section count, and an Apply button with an active state.
- The theme editor (`.../themes/[themeId]/editor/page.tsx`) gained an **Experiences tab** (`PanelMode` `'experiences'`, a `Sparkles` icon button) rendering the picker in the sidebar.

## Merchant-facing language
Merchants see **Dawn, Sense, Craft, Refresh, Ride, Nova, Aura, Forge, Bloom, Summit** — never "Urban Kicks", never "Theme Preset". The editor's default theme name was changed `'Urban Kicks'` → `'LetBuyy Core'`. (Asserted by `tests/launch/lb-experience-flow.test.mjs`.)

## Governance
Self-styled with **const style objects** (`style={CONST}` — not caught by the `style={{` ratchet counter) routed through `var(--lb-color-*)` tokens; only the data-driven swatch color uses a dynamic inline style. **No hex literals** (`tsxRawHex` stays 0), no palette classes, no arbitrary radius/shadow. Design-system metrics unchanged.

## Evidence
- `tests/launch/lb-experience-flow.test.mjs` A-tests pass (picker exists, renders from the engine, speaks "Experience", never "Urban Kicks").
- `pnpm --filter @letbuyy/merchant-control-plane typecheck` — clean.

## Honest boundary
The picker compiles and the wiring is contract-tested, but the rendered UX (card layout, live iframe refresh on apply) was **not visually verified** — that requires the full local stack (gateway + storefront + Supabase + an authenticated merchant + a store).
