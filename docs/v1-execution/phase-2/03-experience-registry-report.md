# Stream C — Experience Registry — Report

**Status:** ✅ DONE (tested) · **File:** `packages/theme-engine/src/theme-presets.ts`

Merchants never see "themes" — they see **Experiences**. Ten are registered, each fully defined (name, description, industry, tokens, color system, typography, layout, default sections, preview, metadata).

| Experience | Industry | Lead colors | Grounding |
|---|---|---|---|
| **Forge** | electronics | navy `#1E3A5F` + cyan `#00B4D8` | research |
| **Sense** | fashion | near-black `#1A1A2E` + crimson `#E63946` | research |
| **Aura** | beauty | rose `#C2798B` + champagne `#D4AF7A` | designed |
| **Craft** | furniture | walnut `#3E2723` + earth `#8D6E63` | research |
| **Refresh** | food | forest `#2D6A4F` + orange `#F4A261` | research |
| **Ride** | sports | orange `#FF4D00` + yellow `#FFD100` | designed |
| **Dawn** | books | slate `#3B4F6B` + amber `#C0832B` | designed |
| **Bloom** | pet | tangerine `#E07B39` + green `#4CAF73` | designed |
| **Nova** | (none — D2C override) | violet `#8B5CF6` + amber `#F59E0B` | designed |
| **Summit** | general (fallback) | teal `#00B3B3` + lime `#A4E500` | research |

## Integrity (enforced by tests + `collectExperienceRegistryIssues()`)
- Exactly 10 experiences; every `defaultSections` entry ∈ the 25 `BUILT_IN_SECTION_TYPES`; every experience passes `ThemeExperienceSchema`; each industry is claimed by at most one experience.
- **Summit's tokens equal `DEFAULT_THEME_SETTINGS`** → the General fallback produces zero visual regression vs the platform default.

## HONEST quality disclosure
- **5 are research-grounded** (Forge, Sense, Craft, Refresh, Summit) — palettes from `docs/theme-research`/`docs/theme-discovery`.
- **5 are designed** (Aura, Ride, Dawn, Bloom, Nova) — sensible on-brand variations; the research does not cover beauty/sports/books/pet verticals. Each carries `metadata.grounding: 'designed'` + a note. **These should get a designer pass before merchant-facing launch.**
- **Fonts:** non-system heading fonts (Playfair Display, Cormorant Garamond, Libre Baskerville) **do not render yet** — the Liquid head assets have no `@font-face`/`<link>` emission, so they fall back to system fonts. Colors/radius/layout apply fully. Font loading is a deferred prerequisite for full visual fidelity (see `09-phase-2-summary.md`).
- **Preview** is a descriptor (swatches + section count), not a screenshot — honest and renderable.
