# Stream A — Font Runtime — Report

**Status:** 🟡 Registry complete + tested; distinct-typography activation is a **product decision + visual gate** (not unilaterally flipped here).

## What was traced
- **Font registry (engine):** `packages/theme-engine/src/experience-fonts.ts` — complete, tested (6/6), barrel-exported. Maps every experience font (Inter, Playfair Display, Cormorant Garamond, Libre Baskerville, Source Sans Pro, Lato) → Google Fonts spec + fallback; `buildExperienceFontLinkHref()` builds the `<link>` href.
- **React storefront runtime** (`apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx`): emits `--font-main`/`--font-heading` from a `FONT_MAP` that resolves names → `var(--font-*)`.
- **`globals.css`:** `--font-inter`, `--font-playfair`, … are **all aliased to two LetBuyy local brand fonts** (`var(--font-letbuyy-sans)` / `var(--font-letbuyy-display)`, loaded via `next/font/local`).
- **Liquid runtime** (`theme-renderer.ts` `buildLiquidThemeHeadAssets`): injects a **sanitizer-safe `<style>` only** — by deliberate design it emits **no `<link>`/asset routes**.

## The finding (honest)
The storefront **intentionally renders every theme with the LetBuyy local brand fonts** and aliases all named fonts to them. So today, experiences render brand-consistent typography — **not** their declared distinct fonts (Sense's Playfair, Aura's Cormorant, etc. currently resolve to the local display font).

Making experiences render their **distinct** typography is therefore not a missing wire — it is a **product decision** (brand-font consistency vs per-experience typographic identity) plus a **visual-verification** step. Per the mission's "do not redesign" rule and because the result cannot be visually verified in this environment, it was **not flipped unilaterally**.

## Ready-to-apply activation (when the product decision is made)
React path (`[subdomain]/layout.tsx`): for fonts in the experience-fonts registry, emit `<link rel="stylesheet" href={buildExperienceFontLinkHref(store)}>` in the head and set `--font-main`/`--font-heading` via `fontFamilyWithFallback(name)` (real family). Keep `Inter`/unknown on the local brand font to preserve brand defaults; activate the **distinct** display fonts (Playfair, Cormorant, Libre Baskerville, Source Sans Pro, Lato) for Sense/Aura/Craft/Dawn.
Liquid path (canary, OFF in prod): inject the same `<link>` at the **layout level** (not the sanitized `content_for_header`), riding with the deferred Liquid rollout.

## Certification impact
Colors / spacing / radius / layout apply fully per experience today. **Typography fidelity is brand-uniform, not per-experience** — a known limitation gating a true 95–97% on the typography axis. Registry + builder are tested and ready; activation + visual check remain.
