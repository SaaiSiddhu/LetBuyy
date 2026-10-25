// ============================================================================
// Phase O — Per-Experience Per-Template Section Compositions
// ----------------------------------------------------------------------------
// Each Experience defines a COMPLETE STORE DESIGN: three explicit templates
// (index/home, product, collection) each with an ordered list of SectionSpec
// objects that describe the section type + placeholder settings for that
// experience's industry and editorial intent.
//
// Distinctness contract (verified by tests):
//   - Every Experience's index template has a UNIQUE section composition
//     (different types, count, or order — never just token-differentiated).
//   - Nova adds ctaSection to its index composition to be structurally
//     distinct from Summit (the only two that share COMMERCE_BASE_SECTIONS).
//
// Constraints:
//   - SectionSpec.type uses camelCase BUILT_IN_SECTION_TYPES; the apply
//     engine resolves to kebab via resolveLiquidSectionType().
//   - No block.children (Phase T deferred). SectionSpec has no blocks field;
//     the apply engine creates sections with blocks:[].
//   - Settings use schema defaults / minimal experience-specific overrides.
//     No Date.now()/Math.random() — all values are static.
//   - Section ids follow '{experienceId}-{camelType}-{templateKey}' pattern
//     for stable, unique-per-experience ids.
//   - collectionFilter and faqAccordion are included in compositions that match
//     their industry intent. Every referenced type has a canonical kebab mapping
//     (collectExperienceCompositionIssues), but whether it RENDERS depends on the
//     bundle: a bundle missing the Liquid section file makes that one section
//     'incompatible' at apply time and the rest still apply. Point
//     collectExperienceCompositionBundleIssues() at a bundle's
//     section_definitions to prove — deterministically — that all 30
//     compositions resolve end to end.
// ============================================================================

import { BUILT_IN_SECTION_TYPES } from './built-in-section-schemas';
import { BUILT_IN_TO_LIQUID_SECTION_TYPE, resolveLiquidSectionType } from './section-type-map';
import { EXPERIENCE_REGISTRY, getExperience } from './theme-presets';

/** A single section in a composition template. */
export interface SectionSpec {
  /** Stable id: '{experienceId}-{camelType}-{templateKey}' */
  id: string;
  /** camelCase BUILT_IN_SECTION_TYPE (resolved to kebab by apply engine) */
  type: string;
  /** Placeholder settings — static values, no Date.now/Math.random */
  settings: Record<string, unknown>;
}

/** Complete store design for one Experience — three template compositions. */
export interface ExperienceComposition {
  /** Home / landing page (template key: 'index') */
  index: SectionSpec[];
  /** Product detail page (template key: 'product') */
  product: SectionSpec[];
  /** Collection / category page (template key: 'collection') */
  collection: SectionSpec[];
}

/**
 * The only templates an Experience composes. Every other template (cart, search,
 * customers/*, blog, …) is out of scope for the apply engine and is never touched.
 */
export const EXPERIENCE_TEMPLATE_KEYS = ['index', 'product', 'collection'] as const;

export type ExperienceTemplateKey = typeof EXPERIENCE_TEMPLATE_KEYS[number];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a SectionSpec with a stable id for the given experience / template. */
function spec(experienceId: string, camelType: string, templateKey: string, settings: Record<string, unknown> = {}): SectionSpec {
  return {
    id: `${experienceId}-${camelType}-${templateKey}`,
    type: camelType,
    settings,
  };
}

// ── FORGE (electronics) ─────────────────────────────────────────────────────
// Spec-trust placement: trustBadges at position 3 (after categoryGrid, before
// featured browsing). The research-grounded "verify before you buy" UX.
// Product: spec verification badge beside product detail.
// Collection: filter-first (collectionFilter incompatible in current bundle → degrades).

const FORGE_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('forge', 'announcementBar', 'index', { text: 'Free shipping on orders above ₹999.' }),
    spec('forge', 'heroBanner', 'index', { heading: 'Precision-engineered tech', subheading: 'Spec-verified electronics for the discerning buyer.', ctaText: 'Shop Now', ctaLink: '/products' }),
    spec('forge', 'categoryGrid', 'index', { title: 'Shop by category', columns: 3 }),
    spec('forge', 'trustBadges', 'index', {}),
    spec('forge', 'featuredProducts', 'index', { title: 'New arrivals', collectionHandle: 'new-arrivals' }),
    spec('forge', 'productGrid', 'index', { title: 'Best sellers', columns: 4 }),
    spec('forge', 'newsletter', 'index', { title: 'Stay informed', subtitle: 'Get early access to new product launches and spec drops.' }),
  ],
  product: [
    spec('forge', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('forge', 'trustBadges', 'product', {}),
  ],
  collection: [
    spec('forge', 'categoryGrid', 'collection', { title: 'Browse categories', columns: 3 }),
    spec('forge', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'sidebar' }),
    spec('forge', 'productGrid', 'collection', { title: 'Products', columns: 4 }),
  ],
};

// Threadline: editorial discovery -> real apparel -> independently priced outfits -> supplied facts.
const SENSE_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('sense', 'heroBanner', 'index', { eyebrow: 'THE EVERYDAY EDIT', heading: 'Made to move with you.', subheading: 'Considered clothing for your everyday.', ctaText: 'Explore new arrivals', ctaLink: '/products', secondaryText: 'Find your fit', secondaryLink: '/products' }),
    spec('sense', 'categoryGrid', 'index', { title: 'Find your silhouette' }),
    spec('sense', 'productGrid', 'index', { title: 'New arrivals', columns: 3, productLimit: 3 }),
    spec('sense', 'featuredProducts', 'index', { requireSelection: true, title: 'Wear it your way.', subtitle: 'Every piece, individually chosen.', productLimit: 2 }),
    spec('sense', 'aboutSection', 'index', { title: 'Good things take a little care.', content: '' }),
    spec('sense', 'trustBadges', 'index', { fitText: '', serviceText: '', supportText: '' }),
  ],
  product: [
    spec('sense', 'productDetail', 'product', { showGallery: true, showDescription: true, showBuyNow: false, showReviews: false }),
    spec('sense', 'featuredProducts', 'product', { requireSelection: true, title: 'Complete the look', productLimit: 2 }),
  ],
  collection: [
    spec('sense', 'collectionFilter', 'collection', {}),
    spec('sense', 'productGrid', 'collection', { title: 'Clothing', columns: 3, productLimit: 24 }),
  ],
};

// ── AURA (beauty) ───────────────────────────────────────────────────────────
// Trust mid-flow (after featured, before testimonials). Social proof at end.
// Both trustBadges AND testimonials — beauty shoppers need product safety trust
// AND community validation before converting.
// Product: social proof then trust — reverse order from home.
// Collection: heroBanner + filter + grid + newsletter capture.

const AURA_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('aura', 'announcementBar', 'index', { text: 'Free samples with every order above ₹1499.' }),
    spec('aura', 'heroBanner', 'index', { heading: 'Beauty, elevated', subheading: 'Skincare and cosmetics for every skin tone and ritual.', ctaText: 'Discover', ctaLink: '/collections/new', height: 'full', textAlign: 'center' }),
    spec('aura', 'categoryGrid', 'index', { title: 'Shop by ritual', columns: 3 }),
    spec('aura', 'featuredProducts', 'index', { title: 'Bestselling formulas', collectionHandle: 'bestsellers' }),
    spec('aura', 'trustBadges', 'index', {}),
    spec('aura', 'testimonials', 'index', { title: 'Customer stories', layout: 'grid', showRating: true, showImage: true }),
    spec('aura', 'newsletter', 'index', { title: 'Your beauty ritual starts here', subtitle: 'Skincare guides, new launches, and members-only offers.' }),
  ],
  product: [
    spec('aura', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('aura', 'testimonials', 'product', { title: 'What customers say', layout: 'carousel', showRating: true }),
    spec('aura', 'trustBadges', 'product', {}),
  ],
  collection: [
    spec('aura', 'heroBanner', 'collection', { heading: 'Discover the range', height: 'medium', textAlign: 'center' }),
    spec('aura', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'sidebar' }),
    spec('aura', 'productGrid', 'collection', { columns: 3, cardStyle: 'standard' }),
    spec('aura', 'newsletter', 'collection', { title: 'Get beauty tips', subtitle: 'Subscribe for skincare guides and exclusive offers.' }),
  ],
};

// ── CRAFT (furniture) ───────────────────────────────────────────────────────
// MOST STRUCTURALLY DISTINCT experience: 9 sections on home.
// aboutSection + testimonials + faqAccordion — maker story, community trust,
// delivery/care FAQ. faqAccordion will be 'incompatible' in the current bundle
// (faq-accordion absent from section_definitions); the diff reports this and
// the remaining 8 sections still apply.
// Product: maker story + delivery FAQ alongside the product.
// Collection: heroBanner + filter + grid + maker story.

const CRAFT_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('craft', 'announcementBar', 'index', { text: 'Handcrafted. Delivered to your door.' }),
    spec('craft', 'heroBanner', 'index', { heading: 'Made to last', subheading: 'Furniture and home decor crafted by independent artisans.', ctaText: 'Explore', ctaLink: '/collections', height: 'full', textAlign: 'left' }),
    spec('craft', 'categoryGrid', 'index', { title: 'Shop by room', columns: 3 }),
    spec('craft', 'trustBadges', 'index', {}),
    spec('craft', 'featuredProducts', 'index', { title: 'Featured pieces', collectionHandle: 'featured' }),
    spec('craft', 'aboutSection', 'index', { title: 'Our story', layout: 'right' }),
    spec('craft', 'testimonials', 'index', { title: 'What our customers say', layout: 'grid', showRating: true }),
    spec('craft', 'faqAccordion', 'index', { title: 'Frequently asked questions', allowMultipleOpen: false }),
    spec('craft', 'newsletter', 'index', { title: 'Join the craft community', subtitle: 'New pieces, maker stories, and care guides in your inbox.' }),
  ],
  product: [
    spec('craft', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('craft', 'aboutSection', 'product', { title: 'About the maker', layout: 'left' }),
    spec('craft', 'faqAccordion', 'product', { title: 'Delivery & care', allowMultipleOpen: false }),
  ],
  collection: [
    spec('craft', 'heroBanner', 'collection', { heading: 'Handcrafted goods', height: 'medium', textAlign: 'left' }),
    spec('craft', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'sidebar' }),
    spec('craft', 'productGrid', 'collection', { columns: 3, cardStyle: 'standard' }),
    spec('craft', 'aboutSection', 'collection', { title: 'Why handcrafted?', layout: 'center' }),
  ],
};

// ── REFRESH (food) ──────────────────────────────────────────────────────────
// UNIQUE: trustBadges at position 3 — immediately after heroBanner, BEFORE
// categoryGrid. Only experience where trust leads the browse journey.
// Freshness guarantee ("Free returns on perishables") before any products.
// Product: freshness guarantee then related fresh products.
// Collection: trust first, then filter + grid.

const REFRESH_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('refresh', 'announcementBar', 'index', { text: 'Same-day delivery on fresh grocery orders.' }),
    spec('refresh', 'heroBanner', 'index', { heading: 'Fresh from farm to table', subheading: 'Organic grocery, daily essentials, and more.', ctaText: 'Shop now', ctaLink: '/products', height: 'large', textAlign: 'center' }),
    spec('refresh', 'trustBadges', 'index', {}),
    spec('refresh', 'categoryGrid', 'index', { title: 'Shop by category', columns: 4 }),
    spec('refresh', 'featuredProducts', 'index', { title: 'Daily essentials', collectionHandle: 'daily-essentials' }),
    spec('refresh', 'productGrid', 'index', { title: 'Browse all products', columns: 4 }),
    spec('refresh', 'newsletter', 'index', { title: 'Weekly fresh deals', subtitle: 'Get seasonal offers, new stock alerts, and fresh recipes.' }),
  ],
  product: [
    spec('refresh', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('refresh', 'trustBadges', 'product', {}),
    spec('refresh', 'featuredProducts', 'product', { title: 'You might also need', collectionHandle: 'daily-essentials' }),
  ],
  collection: [
    spec('refresh', 'trustBadges', 'collection', {}),
    spec('refresh', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'topbar' }),
    spec('refresh', 'productGrid', 'collection', { columns: 4, cardStyle: 'minimal' }),
  ],
};

// ── RIDE (sports) ───────────────────────────────────────────────────────────
// trustBadges AFTER productGrid (position 6) — performance guarantee after
// browsing, before checkout. "We stand behind our gear."
// Product: gear cross-sell ("Complete your kit").
// Collection: action hero + filter + grid.

const RIDE_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('ride', 'announcementBar', 'index', { text: 'Free express shipping on all orders above ₹2499.' }),
    spec('ride', 'heroBanner', 'index', { heading: 'Built for performance', subheading: 'Sports equipment and fitness gear for every athlete.', ctaText: 'Shop gear', ctaLink: '/collections', height: 'full', textAlign: 'left' }),
    spec('ride', 'categoryGrid', 'index', { title: 'Shop by sport', columns: 3 }),
    spec('ride', 'featuredProducts', 'index', { title: 'Top performers', collectionHandle: 'top-performers' }),
    spec('ride', 'productGrid', 'index', { title: 'Full gear range', columns: 4 }),
    spec('ride', 'trustBadges', 'index', {}),
    spec('ride', 'newsletter', 'index', { title: 'Level up', subtitle: 'Training tips, gear drops, and athlete stories in your inbox.' }),
  ],
  product: [
    spec('ride', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('ride', 'featuredProducts', 'product', { title: 'Complete your kit', collectionHandle: 'related-gear' }),
  ],
  collection: [
    spec('ride', 'heroBanner', 'collection', { heading: 'Gear up', height: 'medium', textAlign: 'left' }),
    spec('ride', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'sidebar' }),
    spec('ride', 'productGrid', 'collection', { columns: 4, cardStyle: 'detailed' }),
  ],
};

// ── DAWN (books) ────────────────────────────────────────────────────────────
// Quiet editorial tone. aboutSection at end of home — curation story.
// No trustBadges (books are low-risk). No testimonials (books are personal).
// Product: curation story then "you might also like".
// Collection: editorial hero + filter + grid.

const DAWN_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('dawn', 'announcementBar', 'index', { text: 'Free bookmarks with every order.' }),
    spec('dawn', 'heroBanner', 'index', { heading: 'A world of stories', subheading: 'Independent bookshop with curated titles for curious readers.', ctaText: 'Browse books', ctaLink: '/collections', height: 'large', textAlign: 'center' }),
    spec('dawn', 'categoryGrid', 'index', { title: 'Browse by genre', columns: 4 }),
    spec('dawn', 'featuredProducts', 'index', { title: 'Editor\'s picks', collectionHandle: 'editors-picks' }),
    spec('dawn', 'productGrid', 'index', { title: 'New arrivals', columns: 4 }),
    spec('dawn', 'aboutSection', 'index', { title: 'Why we curate', layout: 'right' }),
    spec('dawn', 'newsletter', 'index', { title: 'The reading list', subtitle: 'Curated picks, author notes, and reading guides each month.' }),
  ],
  product: [
    spec('dawn', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: false, showQuantity: true, showBuyNow: true }),
    spec('dawn', 'aboutSection', 'product', { title: 'About this title', layout: 'left' }),
    spec('dawn', 'featuredProducts', 'product', { title: 'You might also like', collectionHandle: 'recommended' }),
  ],
  collection: [
    spec('dawn', 'heroBanner', 'collection', { heading: 'The collection', height: 'medium', textAlign: 'center' }),
    spec('dawn', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: false, layout: 'topbar' }),
    spec('dawn', 'productGrid', 'collection', { columns: 4, cardStyle: 'minimal' }),
  ],
};

// ── BLOOM (pet) ─────────────────────────────────────────────────────────────
// Safety trust in MID-BROWSE (between featuredProducts and productGrid).
// Pet owners want safety reassurance after seeing featured products but before
// committing to browse. Unique placement signals care.
// Product: safety first then cross-sell "Pets also love".
// Collection: playful hero + filter + grid.

const BLOOM_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('bloom', 'announcementBar', 'index', { text: 'Free treats with every order over ₹799.' }),
    spec('bloom', 'heroBanner', 'index', { heading: 'Happy pets. Happy home.', subheading: 'Premium food, toys, and accessories for your furry family.', ctaText: 'Shop now', ctaLink: '/products', height: 'large', textAlign: 'center' }),
    spec('bloom', 'categoryGrid', 'index', { title: 'Shop by pet', columns: 4 }),
    spec('bloom', 'featuredProducts', 'index', { title: 'Pet favourites', collectionHandle: 'bestsellers' }),
    spec('bloom', 'trustBadges', 'index', {}),
    spec('bloom', 'productGrid', 'index', { title: 'Browse all products', columns: 4 }),
    spec('bloom', 'newsletter', 'index', { title: 'Pet care tips', subtitle: 'Vet-approved advice, new arrivals, and subscriber deals.' }),
  ],
  product: [
    spec('bloom', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('bloom', 'trustBadges', 'product', {}),
    spec('bloom', 'featuredProducts', 'product', { title: 'Pets also love', collectionHandle: 'frequently-bought' }),
  ],
  collection: [
    spec('bloom', 'heroBanner', 'collection', { heading: 'For your pet', height: 'medium', textAlign: 'center' }),
    spec('bloom', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'sidebar' }),
    spec('bloom', 'productGrid', 'collection', { columns: 4, cardStyle: 'standard' }),
  ],
};

// ── NOVA (D2C, no fixed industry) ───────────────────────────────────────────
// Structurally DISTINCT from Summit via ctaSection (7 vs 6 sections).
// ctaSection carries style:'gradient' — the brand-forward D2C call-to-action.
// Product: brand-forward upsell with ctaSection after featured products.
// Collection: editorial hero + filter + grid + brand CTA.

const NOVA_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('nova', 'announcementBar', 'index', { text: 'Direct-to-consumer. No middlemen.' }),
    spec('nova', 'heroBanner', 'index', { heading: 'The brand speaks for itself', subheading: 'Premium D2C products, direct from maker to you.', ctaText: 'Shop the collection', ctaLink: '/collections', height: 'full', textAlign: 'center' }),
    spec('nova', 'categoryGrid', 'index', { title: 'Shop by collection', columns: 3 }),
    spec('nova', 'featuredProducts', 'index', { title: 'Best of Nova', collectionHandle: 'featured' }),
    spec('nova', 'productGrid', 'index', { title: 'Full range', columns: 4 }),
    spec('nova', 'ctaSection', 'index', { heading: 'Shop the collection', subheading: 'Direct from us to you — no markups.', ctaText: 'Shop now', ctaLink: '/collections', style: 'gradient' }),
    spec('nova', 'newsletter', 'index', { title: 'Join the Nova community', subtitle: 'Early access, launch drops, and subscriber-only offers.' }),
  ],
  product: [
    spec('nova', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('nova', 'featuredProducts', 'product', { title: 'Also from Nova', collectionHandle: 'featured' }),
    spec('nova', 'ctaSection', 'product', { heading: 'The full range', ctaText: 'Browse all', ctaLink: '/collections', style: 'gradient' }),
  ],
  collection: [
    spec('nova', 'heroBanner', 'collection', { heading: 'Nova collection', height: 'medium', textAlign: 'left' }),
    spec('nova', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'sidebar' }),
    spec('nova', 'productGrid', 'collection', { columns: 4, cardStyle: 'minimal' }),
    spec('nova', 'ctaSection', 'collection', { heading: 'Discover the full Nova range', ctaText: 'All collections', ctaLink: '/collections', style: 'primary' }),
  ],
};

// ── SUMMIT (general, FALLBACK) ───────────────────────────────────────────────
// Clean 6-section baseline. Intentionally minimal — no trust, no testimonials,
// no CTA bands. Token baseline matches DEFAULT_THEME_SETTINGS (zero regression).
// Product: clean baseline with related products.
// Collection: simplest — filter + grid.

const SUMMIT_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('summit', 'announcementBar', 'index', { text: 'Welcome to our store.' }),
    spec('summit', 'heroBanner', 'index', { heading: 'Welcome to our store', subheading: 'Browse our full range of products.', ctaText: 'Shop now', ctaLink: '/products', height: 'full', textAlign: 'center' }),
    spec('summit', 'categoryGrid', 'index', { title: 'Shop by category', columns: 3 }),
    spec('summit', 'featuredProducts', 'index', { title: 'Featured products', collectionHandle: 'featured' }),
    spec('summit', 'productGrid', 'index', { title: 'All products', columns: 4 }),
    spec('summit', 'newsletter', 'index', { title: 'Stay updated', subtitle: 'Subscribe for new arrivals and special offers.' }),
  ],
  product: [
    spec('summit', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('summit', 'featuredProducts', 'product', { title: 'Related products', collectionHandle: 'featured' }),
  ],
  collection: [
    spec('summit', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'sidebar' }),
    spec('summit', 'productGrid', 'collection', { columns: 4, cardStyle: 'standard' }),
  ],
};

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Per-experience per-template section compositions.
 * Keys match EXPERIENCE_REGISTRY keys (theme-presets.ts).
 */
export const EXPERIENCE_COMPOSITIONS: Readonly<Record<string, ExperienceComposition>> = Object.freeze({
  forge: FORGE_COMPOSITIONS,
  sense: SENSE_COMPOSITIONS,
  aura: AURA_COMPOSITIONS,
  craft: CRAFT_COMPOSITIONS,
  refresh: REFRESH_COMPOSITIONS,
  ride: RIDE_COMPOSITIONS,
  dawn: DAWN_COMPOSITIONS,
  bloom: BLOOM_COMPOSITIONS,
  nova: NOVA_COMPOSITIONS,
  summit: SUMMIT_COMPOSITIONS,
});

/**
 * Retrieve the composition for a specific experience id.
 * Returns undefined when the id is not in the registry (own-property lookup, so an
 * inherited key such as 'constructor' never resolves to a non-composition object).
 */
export function getExperienceComposition(id: string): ExperienceComposition | undefined {
  if (!Object.prototype.hasOwnProperty.call(EXPERIENCE_COMPOSITIONS, id)) return undefined;
  return EXPERIENCE_COMPOSITIONS[id];
}

// ── Integrity checks ─────────────────────────────────────────────────────────
// Same contract as collectExperienceRegistryIssues / collectIndustryMapIssues /
// collectSectionTypeMapIssues: return [] when clean, one human-readable string per
// problem otherwise. These are the deterministic guards for the class of defect
// where a composition references a section the platform cannot actually render.

/** ThemeDocumentIdSchema charset — a spec id that violates it fails parseThemeDocument at apply time. */
const SECTION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SECTION_ID_MAX_LENGTH = 64;

function isStaticSettingValue(value: unknown): boolean {
  return (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  );
}

/**
 * BUNDLE-INDEPENDENT integrity check of all 30 compositions (10 experiences × 3 templates).
 *
 * Verifies, for every SectionSpec of every composition, that:
 *   - the composition registry and EXPERIENCE_REGISTRY cover each other exactly;
 *   - the referenced type is a real BUILT_IN_SECTION_TYPE and has a canonical kebab
 *     mapping in BUILT_IN_TO_LIQUID_SECTION_TYPE (without one, the apply engine can
 *     only ever report the section as incompatible — a permanently dead composition entry);
 *   - ids are unique per template, follow the '{experienceId}-…' pattern and satisfy
 *     ThemeDocumentIdSchema (charset + 64-char limit), so a composed section can never
 *     fail document validation;
 *   - a template never lists the same type twice (the apply engine matches old sections
 *     by type — a duplicate type would make the match ambiguous);
 *   - settings values are static scalars (determinism: same input → same document);
 *   - `experience.defaultSections` mirrors the index composition, because
 *     `preview.sectionCount` is derived from defaultSections and is shown to the merchant
 *     as the size of the design they are about to apply.
 *
 * Returns [] when clean.
 */
export function collectExperienceCompositionIssues(): string[] {
  const issues: string[] = [];
  const builtIns = new Set<string>(BUILT_IN_SECTION_TYPES);

  for (const id of Object.keys(EXPERIENCE_REGISTRY)) {
    if (!Object.prototype.hasOwnProperty.call(EXPERIENCE_COMPOSITIONS, id)) {
      issues.push(`experience '${id}' has no entry in EXPERIENCE_COMPOSITIONS`);
    }
  }

  for (const [experienceId, composition] of Object.entries(EXPERIENCE_COMPOSITIONS)) {
    const experience = getExperience(experienceId);
    if (!experience) {
      issues.push(`composition key '${experienceId}' is not a registered experience`);
      continue;
    }

    for (const templateKey of EXPERIENCE_TEMPLATE_KEYS) {
      const specs = composition[templateKey];
      const where = `${experienceId}/${templateKey}`;

      if (specs.length === 0) {
        issues.push(`${where}: composition has zero sections`);
      }

      const seenIds = new Set<string>();
      const seenTypes = new Set<string>();

      for (const spec of specs) {
        if (!builtIns.has(spec.type)) {
          issues.push(`${where}: section '${spec.id}' references unknown built-in section type '${spec.type}'`);
        }
        if (!Object.prototype.hasOwnProperty.call(BUILT_IN_TO_LIQUID_SECTION_TYPE, spec.type)) {
          issues.push(`${where}: section type '${spec.type}' has no mapping in BUILT_IN_TO_LIQUID_SECTION_TYPE`);
        }
        if (seenTypes.has(spec.type)) {
          issues.push(`${where}: section type '${spec.type}' appears more than once`);
        }
        seenTypes.add(spec.type);

        if (seenIds.has(spec.id)) {
          issues.push(`${where}: duplicate section id '${spec.id}'`);
        }
        seenIds.add(spec.id);

        if (!spec.id.startsWith(`${experienceId}-`)) {
          issues.push(`${where}: section id '${spec.id}' does not start with '${experienceId}-'`);
        }
        if (!SECTION_ID_PATTERN.test(spec.id)) {
          issues.push(`${where}: section id '${spec.id}' contains characters ThemeDocumentIdSchema rejects`);
        }
        if (spec.id.length > SECTION_ID_MAX_LENGTH) {
          issues.push(`${where}: section id '${spec.id}' exceeds ${SECTION_ID_MAX_LENGTH} characters`);
        }

        for (const [key, value] of Object.entries(spec.settings)) {
          if (!isStaticSettingValue(value)) {
            issues.push(`${where}: section '${spec.id}' setting '${key}' is not a static scalar`);
          }
        }
      }
    }

    const indexTypes = composition.index.map((s) => s.type);
    if (indexTypes.join('|') !== experience.defaultSections.join('|')) {
      issues.push(
        `${experienceId}: defaultSections [${experience.defaultSections.join(', ')}] does not mirror the index `
        + `composition [${indexTypes.join(', ')}] — preview.sectionCount would over- or under-promise`,
      );
    }
  }

  return issues;
}

/**
 * BUNDLE-DEPENDENT integrity check: every section referenced by every composition must
 * resolve against the supplied `section_definitions` (a ThemeDocument's, or a bundle's
 * `sections` map). This is the guard that catches "the composition references a section
 * the theme does not ship" — the failure mode that silently degrades a template.
 *
 * Returns [] when every one of the 30 compositions resolves end to end.
 *
 * @param sectionDefinitions section_definitions of the target document/bundle.
 */
export function collectExperienceCompositionBundleIssues(
  sectionDefinitions: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  for (const [experienceId, composition] of Object.entries(EXPERIENCE_COMPOSITIONS)) {
    for (const templateKey of EXPERIENCE_TEMPLATE_KEYS) {
      for (const spec of composition[templateKey]) {
        if (resolveLiquidSectionType(spec.type, sectionDefinitions) !== null) continue;
        const kebab = BUILT_IN_TO_LIQUID_SECTION_TYPE[spec.type];
        issues.push(
          kebab
            ? `${experienceId}/${templateKey}: '${spec.type}' → '${kebab}' is absent from section_definitions`
            : `${experienceId}/${templateKey}: '${spec.type}' has no mapping in BUILT_IN_TO_LIQUID_SECTION_TYPE`,
        );
      }
    }
  }
  return issues;
}
