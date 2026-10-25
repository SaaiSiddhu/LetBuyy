// ============================================================================
// Phase O — camelCase BUILT_IN_SECTION_TYPES ↔ Liquid kebab-case type bridge
// ----------------------------------------------------------------------------
// ThemeDocument stores section.type as the Liquid kebab-case type (matching
// section_definitions keys). EXPERIENCE_COMPOSITIONS uses camelCase (matching
// BUILT_IN_SECTION_TYPES). This module is the canonical bridge.
//
// Mapping derivation:
//   - 20 entries are derived from THEME_LIQUID_PORTABLE_SECTION_PARITY
//     (where the parity set provides the authoritative reactFile → liquidSectionType).
//   - 5 non-parity BUILT_IN_SECTION_TYPES receive explicit mappings:
//       header / footer (bundle-level section groups),
//       instagramFeed / videoHero / faqAccordion / collectionFilter
//       (BUILT_IN types without a Liquid parity React file — the mapping is
//        still canonical; whether it resolves depends on the bundle).
//
// IMPORTANT: the mapping is STATIC (camelCase → kebab) but resolution is
// BUNDLE-DEPENDENT: resolveLiquidSectionType() returns null for a type whose
// kebab equivalent is absent from the section_definitions passed in at call
// time. A composition that references such a type produces an 'incompatible'
// diff entry rather than an invalid section. Use
// collectExperienceCompositionBundleIssues() (experience-compositions.ts) to
// assert, deterministically, that a given bundle can render every composition.
// ============================================================================

import { BUILT_IN_SECTION_TYPES } from './built-in-section-schemas';

/**
 * Canonical mapping from camelCase BUILT_IN_SECTION_TYPES to the Liquid
 * section-definition key used in ThemeDocument.section_definitions.
 *
 * Derived from THEME_LIQUID_PORTABLE_SECTION_PARITY + explicit entries
 * for section types that have no parity React file.
 */
export const BUILT_IN_TO_LIQUID_SECTION_TYPE: Readonly<Record<string, string>> = Object.freeze({
  // ── Header / footer (layout-level section groups, special-cased in bundle) ──
  header: 'header',
  footer: 'footer',

  // ── Parity-set entries (THEME_LIQUID_PORTABLE_SECTION_PARITY) ──────────────
  announcementBar: 'announcement-bar',
  heroBanner: 'hero-banner',       // reactFile: 'hero.tsx' → liquidSectionType: 'hero-banner'
  productDetail: 'product-detail', // reactFile: 'product-detail-section.tsx' → 'product-detail'
  productGrid: 'product-grid',
  featuredProducts: 'featured-products',
  testimonials: 'testimonials',
  aboutSection: 'about-section',
  newsletter: 'newsletter-signup', // reactFile: 'newsletter.tsx' → 'newsletter-signup'
  contentPage: 'rich-content',     // reactFile: 'rich-content-section.tsx' → 'rich-content'
  trustBadges: 'trust-badges',
  appBlockSlot: 'app-block-slot',
  categoryGrid: 'category-grid',
  brandMarquee: 'brand-marquee',
  portfolioGrid: 'portfolio-grid',
  servicesGrid: 'services-grid',
  skillsSection: 'skills-section',
  experienceTimeline: 'experience-timeline',
  contactForm: 'contact-form',
  ctaSection: 'cta-section',

  // ── Non-parity BUILT_IN types — canonical kebab names, resolved per bundle ──
  // A bundle that ships the matching Liquid section file resolves these like any
  // other type; a bundle that does not makes them 'incompatible' at apply time.
  collectionFilter: 'collection-filter',
  instagramFeed: 'instagram-feed',
  faqAccordion: 'faq-accordion',
  videoHero: 'video-hero',
});

/**
 * Resolves a camelCase built-in section type to its Liquid kebab-case type
 * string, checking that the resolved type is present in the document's
 * section_definitions at call time.
 *
 * Returns:
 *  - The kebab-case type string if (a) the camelCase type has a mapping AND
 *    (b) the kebab type is a key in sectionDefinitions.
 *  - null if either condition is not met.
 *
 * Examples against a document whose bundle ships hero-banner but not faq-accordion:
 *   resolveLiquidSectionType('heroBanner', doc.section_definitions)   → 'hero-banner'
 *   resolveLiquidSectionType('faqAccordion', doc.section_definitions) → null (absent from the bundle)
 *   resolveLiquidSectionType('unknownType', doc.section_definitions)  → null (no mapping)
 *
 * Both lookups are own-property only: an inherited key ('constructor',
 * 'toString', …) must never be mistaken for a section type.
 */
export function resolveLiquidSectionType(
  camelType: string,
  sectionDefinitions: Record<string, unknown>,
): string | null {
  if (!Object.prototype.hasOwnProperty.call(BUILT_IN_TO_LIQUID_SECTION_TYPE, camelType)) return null;
  const kebab = BUILT_IN_TO_LIQUID_SECTION_TYPE[camelType];
  if (!Object.prototype.hasOwnProperty.call(sectionDefinitions, kebab)) return null;
  return kebab;
}

/**
 * Integrity check: every BUILT_IN_SECTION_TYPES entry must have a mapping in
 * BUILT_IN_TO_LIQUID_SECTION_TYPE. Returns an empty array when clean.
 *
 * Called by the governance gate to detect mapping drift.
 */
export function collectSectionTypeMapIssues(): string[] {
  return BUILT_IN_SECTION_TYPES
    .filter((type) => !Object.prototype.hasOwnProperty.call(BUILT_IN_TO_LIQUID_SECTION_TYPE, type))
    .map(
      (type) =>
        `BUILT_IN_SECTION_TYPES entry '${type}' has no mapping in BUILT_IN_TO_LIQUID_SECTION_TYPE`,
    );
}
