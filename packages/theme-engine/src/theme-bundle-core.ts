// ============================================================================
// LETBUYY CORE THEME — canonical name + backwards-compatible alias  (Phase-2 Stream A)
// ----------------------------------------------------------------------------
// LetBuyy ships ONE first-party Core theme. Internally it was authored as
// "Urban Kicks". This module introduces the canonical `letbuyy-core` identity
// and a neutral-branded bundle fixture, WITHOUT renaming or removing the Urban
// Kicks fixture (which existing stores, the persisted `themes` row with
// slug='urban-kicks', and the first-party-liquid-portability governance test all
// still depend on). It is purely ADDITIVE:
//
//   - createLetbuyyCoreLiquidThemeBundleFixture(): the Core bundle with all
//     merchant-visible "Urban Kicks" branding neutralized to "LetBuyy Core".
//   - resolveCanonicalThemeSlug() / isLetbuyyCoreThemeSlug(): an alias layer so
//     `urban-kicks` and `letbuyy-core` resolve to the same Core theme.
//
// SAFETY: this does NOT touch the frozen theme-registry.ts, does NOT modify the
// Urban Kicks fixture, and does NOT rename any persisted DB slug. Switching the
// live compile/store-creation paths to the Core fixture and adding a `letbuyy-core`
// DB alias row are the documented, deferred follow-ups (see
// docs/v1-execution/phase-2/01-letbuyy-core-report.md) — kept out of this change
// to guarantee zero store breakage.
// ============================================================================

import {
  LiquidThemePackageBundleSchema,
  createUrbanKicksLiquidThemeBundleFixture,
  type LiquidThemePackageBundle,
} from './theme-bundle';

/** Canonical first-party theme catalog slug (merchant-never-sees-this; "Experience" is the UX term). */
export const LETBUYY_CORE_THEME_SLUG = 'letbuyy-core';
/** Canonical Liquid bundle slug for the Core theme (parallels 'urban-kicks-liquid'). */
export const LETBUYY_CORE_BUNDLE_SLUG = 'letbuyy-core-liquid';
/** Retained legacy alias — existing stores persist sites.theme_id='urban-kicks'; never break them. */
export const URBAN_KICKS_THEME_SLUG = 'urban-kicks';
export const URBAN_KICKS_BUNDLE_SLUG = 'urban-kicks-liquid';

const THEME_SLUG_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  [URBAN_KICKS_THEME_SLUG]: LETBUYY_CORE_THEME_SLUG,
  [URBAN_KICKS_BUNDLE_SLUG]: LETBUYY_CORE_BUNDLE_SLUG,
});

/** Map any first-party Core slug (legacy or canonical) to its canonical form. Pure; leaves
 *  unknown slugs untouched. NOTE: callers must keep accepting the legacy `urban-kicks` slug in
 *  DB lookups until a `letbuyy-core` catalog row exists (deferred migration). */
export function resolveCanonicalThemeSlug(slug: string): string {
  return THEME_SLUG_ALIASES[slug] ?? slug;
}

/** True for any slug that refers to the first-party Core theme (legacy or canonical). */
export function isLetbuyyCoreThemeSlug(slug: string): boolean {
  return (
    slug === LETBUYY_CORE_THEME_SLUG ||
    slug === LETBUYY_CORE_BUNDLE_SLUG ||
    slug === URBAN_KICKS_THEME_SLUG ||
    slug === URBAN_KICKS_BUNDLE_SLUG
  );
}

/**
 * The Core theme bundle with merchant-visible "Urban Kicks" branding neutralized.
 * Built by transforming the canonical Urban Kicks fixture (so the two never structurally
 * drift) and re-validating against the bundle schema. New stores should be compiled from
 * this fixture so they carry LetBuyy Core branding — not Urban Kicks.
 */
export function createLetbuyyCoreLiquidThemeBundleFixture(): LiquidThemePackageBundle {
  const base = createUrbanKicksLiquidThemeBundleFixture();
  // Branding-only token replacement on a structural clone. Order matters: the more specific
  // 'urban-kicks-liquid' first, then 'urban-kicks', then the display name. These tokens only
  // appear in branding strings (slug, package name, <title> suffix, body class, storeName
  // defaults), never in structural keys or Liquid control flow.
  const cloned = JSON.parse(
    JSON.stringify(base)
      .split('urban-kicks-liquid').join(LETBUYY_CORE_BUNDLE_SLUG)
      .split('urban-kicks').join(LETBUYY_CORE_THEME_SLUG)
      .split('Urban Kicks').join('LetBuyy Core'),
  ) as LiquidThemePackageBundle;
  cloned.package.slug = LETBUYY_CORE_BUNDLE_SLUG;
  cloned.package.name = 'LetBuyy Core';
  // Re-validate: a branding-only transform must still produce a schema-valid bundle.
  return LiquidThemePackageBundleSchema.parse(cloned);
}
