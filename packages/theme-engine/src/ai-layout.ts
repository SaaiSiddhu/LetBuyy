// ============================================================================
// PHASE L5 — AI Layout Generator: deterministic section-order generation
// ----------------------------------------------------------------------------
// HONESTY CONTRACT:
//   All functions are deterministic — same input → same output.
//   Every section type emitted is a member of BUILT_IN_SECTION_TYPES (the 25
//   camelCase types). No invented or unknown section type is ever returned.
//   Industry variations select from the same known set.
// ============================================================================

import { BUILT_IN_SECTION_TYPES } from './built-in-section-schemas';

// ── Types ────────────────────────────────────────────────────────────────────

/** The four page archetypes the layout generator covers. */
export type PageType = 'home' | 'product' | 'collection' | 'page';

// Build a constant set for O(1) membership checks — shared across all callers.
const KNOWN_SECTION_TYPE_SET: ReadonlySet<string> = new Set(BUILT_IN_SECTION_TYPES);

// ── Catalog ──────────────────────────────────────────────────────────────────

// Base section sequences per page type.
// 'header' and 'footer' are always first/last anchors.
// Every type here is in BUILT_IN_SECTION_TYPES (enforced by the module-load guard below).

const BASE_HOME_SECTIONS: ReadonlyArray<string> = Object.freeze([
  'header',
  'announcementBar',
  'heroBanner',
  'categoryGrid',
  'featuredProducts',
  'productGrid',
  'newsletter',
  'footer',
]);

const BASE_PRODUCT_SECTIONS: ReadonlyArray<string> = Object.freeze([
  'header',
  'productDetail',
  'testimonials',
  'newsletter',
  'footer',
]);

const BASE_COLLECTION_SECTIONS: ReadonlyArray<string> = Object.freeze([
  'header',
  'categoryGrid',
  'collectionFilter',
  'productGrid',
  'newsletter',
  'footer',
]);

const BASE_PAGE_SECTIONS: ReadonlyArray<string> = Object.freeze([
  'header',
  'contentPage',
  'ctaSection',
  'newsletter',
  'footer',
]);

// Industry-specific insertions for the 'home' page type.
// Each entry lists additional section types (in insertion order) and the insertion position
// relative to 'footer'. All types must be in BUILT_IN_SECTION_TYPES.
const HOME_INDUSTRY_ADDITIONS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  electronics: ['trustBadges'],
  fashion: ['brandMarquee', 'testimonials'],
  beauty: ['testimonials'],
  furniture: ['aboutSection', 'testimonials'],
  food: ['trustBadges'],
  sports: ['trustBadges'],
  books: ['aboutSection'],
  pet: ['trustBadges'],
  general: [],
});

// ── Module-load integrity guard ───────────────────────────────────────────────
// Fail loudly at startup if any catalog type leaves the known set.

const ALL_CATALOG_TYPES = [
  ...BASE_HOME_SECTIONS,
  ...BASE_PRODUCT_SECTIONS,
  ...BASE_COLLECTION_SECTIONS,
  ...BASE_PAGE_SECTIONS,
  ...Object.values(HOME_INDUSTRY_ADDITIONS).flat(),
];

for (const type of ALL_CATALOG_TYPES) {
  if (!KNOWN_SECTION_TYPE_SET.has(type)) {
    throw new Error(
      `ai-layout: section type "${type}" in catalog is not in BUILT_IN_SECTION_TYPES`,
    );
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Generate an ordered list of section types valid for the given page archetype.
 *
 * - Every returned type is a member of BUILT_IN_SECTION_TYPES.
 * - 'header' is always first; 'footer' is always last.
 * - Industry variations add industry-appropriate sections (testimonials, trustBadges, etc.)
 *   before the footer anchor.
 * - The result is deterministic: same (pageType, industry) → same output.
 *
 * Callers: the L1 theme generator passes this list to compilePortableToLiquidBundle.
 * The compiler skips section types it cannot map to a Liquid file (e.g. 'collectionFilter')
 * with a warning — that is expected behaviour and not an error.
 */
export function generateSectionLayout(
  pageType: PageType,
  industry?: string | null,
): string[] {
  const base = resolveBase(pageType);

  if (pageType !== 'home' || !industry) return [...base];

  // Inject industry-specific sections before the footer anchor.
  const normalizedIndustry = industry.toLowerCase().trim();
  const additions = HOME_INDUSTRY_ADDITIONS[normalizedIndustry] ?? [];

  if (additions.length === 0) return [...base];

  // Deduplicate: don't add a type that's already in the base sequence
  const baseSet = new Set(base);
  const newSections = additions.filter((t) => !baseSet.has(t));

  if (newSections.length === 0) return [...base];

  // Insert before 'footer' (the last element)
  const body = base.slice(0, -1);  // everything except footer
  return [...body, ...newSections, 'footer'];
}

function resolveBase(pageType: PageType): ReadonlyArray<string> {
  switch (pageType) {
    case 'home':       return BASE_HOME_SECTIONS;
    case 'product':    return BASE_PRODUCT_SECTIONS;
    case 'collection': return BASE_COLLECTION_SECTIONS;
    case 'page':       return BASE_PAGE_SECTIONS;
  }
}

/**
 * Return the known set of section types for membership checks.
 * Exported for tests and consumers that want to validate generated layouts.
 */
export function knownSectionTypeSet(): ReadonlySet<string> {
  return KNOWN_SECTION_TYPE_SET;
}
