# Stream G — Visual Certification — Report

**Status:** ✅ Deterministic spec certification (all 10 experiences) + visual gallery; ❗ LIVE cross-device/draft/published certification requires the running stack

## What was certified (deterministic — fully verifiable here)
All 10 experiences pass `collectExperienceRegistryIssues() === []` and `collectExperienceFontIssues() === []` (enforced by tests). Per experience, the certified spec:

| Experience | Industry | Primary / Accent | Heading font | Sections | Grounding |
|---|---|---|---|---|---|
| Forge | electronics | `#1E3A5F` / `#00B4D8` | Inter | 7 | research |
| Sense | fashion | `#1A1A2E` / `#E63946` | Playfair Display | 6 | research |
| Aura | beauty | `#C2798B` / `#D4AF7A` | Cormorant Garamond | 7 | designed |
| Craft | furniture | `#3E2723` / `#8D6E63` | Libre Baskerville | 9 | research |
| Refresh | food | `#2D6A4F` / `#F4A261` | Inter | 7 | research |
| Ride | sports | `#FF4D00` / `#FFD100` | Inter | 7 | designed |
| Dawn | books | `#3B4F6B` / `#C0832B` | Libre Baskerville | 7 | designed |
| Bloom | pet | `#E07B39` / `#4CAF73` | Inter | 7 | designed |
| Nova | D2C (versatile) | `#8B5CF6` / `#F59E0B` | Inter | 6 | designed |
| Summit | general (fallback) | `#00B3B3` / `#A4E500` | Inter | 6 | research |

A visual gallery rendering these palettes + typography accompanies the Phase-2.5 response.

## ISSUES REGISTER (honest)
1. **Live visual certification not performed** — desktop/tablet/mobile × draft/published/preview rendering per experience needs the running storefront stack (gateway + storefront + Supabase + per-experience stores). Not available in this environment.
2. **Fonts not yet loaded in the head** — the font registry exists (Stream D) but the `<link>` is not yet emitted, so the 5 custom-font experiences currently render with system fallback. Heading-font fidelity is uncertified until the head-wiring lands.
3. **5 experiences are `designed`, not research-grounded** (Aura, Ride, Dawn, Bloom, Nova) — they should get a designer review before merchant-facing launch.
4. **Section application on apply** — applying an experience sets the token/style layer; it does not yet auto-reorder the section tree to `defaultSections` (optional enhancement).

## Verdict
Spec-level: certified (deterministic, tested). Pixel-level: **uncertified** — requires the stack + font wiring + designer review (items 1–3).
