# Stream E — Experience Preview — Report

**Status:** ✅ Card preview + live preview wired; per-experience storefront screenshots need the stack

## Preview before applying (the picker cards)
Each Experience card in the picker is a real preview descriptor (from `experience.preview`): color swatches (primary/accent/surface), heading font name, section count, industry badge, and a merchant-facing description. The merchant can compare all 10 Experiences side by side before choosing — no fabricated screenshots, just the deterministic design spec rendered.

## Preview after applying (the live iframe)
Applying an Experience updates the draft and the editor's existing **live preview iframe** re-renders with the new tokens (via `syncPreviewDraft` — no page refresh). So the merchant sees the actual storefront with the experience applied, on the editor's desktop/tablet/mobile device toggle.

## Honest boundary
Static per-experience "Electronics Store / Fashion Store / …" marketing screenshots are NOT generated here — producing real ones requires rendering each experience on the running storefront stack (Stream G). The visual gallery in the Phase-2.5 response renders the 10 palettes + typography from the deterministic specs as an honest stand-in until the stack can produce live captures.

## Evidence
Picker renders `exp.preview.swatches` + `exp.typography.headingFont` + `exp.preview.sectionCount` (contract-tested). The preview-session/iframe path is the editor's existing, unchanged mechanism.
