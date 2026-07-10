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
//   - collectionFilter and faqAccordion are included in compositions that
//     match their industry intent; they will produce 'incompatible' diff
//     entries on any standard Urban Kicks/LetBuyy Core bundle (those types
//     are absent from section_definitions). The remaining compatible sections
//     still apply.
// ============================================================================

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

// ── SENSE (fashion) ─────────────────────────────────────────────────────────
// Most editorial of the 10. No productGrid on home (editorial over browse).
// testimonials before newsletter — social proof as parting impression.
// No trustBadges (fashion is aspirational, not trust-heavy).
// Product: editorial cross-sell "Complete the look".
// Collection: heroBanner + filter + grid (aspirational browse).

const SENSE_COMPOSITIONS: ExperienceComposition = {
  index: [
    spec('sense', 'announcementBar', 'index', { text: 'New season. New looks. Shop the edit.' }),
    spec('sense', 'heroBanner', 'index', { heading: 'The new season', subheading: 'Curated looks for the discerning wardrobe.', ctaText: 'Explore', ctaLink: '/collections/new', height: 'full', textAlign: 'center' }),
    spec('sense', 'categoryGrid', 'index', { title: 'Shop by style', columns: 3 }),
    spec('sense', 'featuredProducts', 'index', { title: 'This season\'s edit', collectionHandle: 'featured' }),
    spec('sense', 'testimonials', 'index', { title: 'What our customers say', layout: 'carousel', autoplay: true, showRating: true }),
    spec('sense', 'newsletter', 'index', { title: 'Get the edit', subtitle: 'Lookbooks, style guides, and early access to new collections.' }),
  ],
  product: [
    spec('sense', 'productDetail', 'product', { showGallery: true, showDescription: true, showVariantSelector: true, showQuantity: true, showBuyNow: true }),
    spec('sense', 'featuredProducts', 'product', { title: 'Complete the look', collectionHandle: 'complete-the-look' }),
  ],
  collection: [
    spec('sense', 'heroBanner', 'collection', { heading: 'The collection', height: 'medium', textAlign: 'left' }),
    spec('sense', 'collectionFilter', 'collection', { showSearch: true, showSort: true, showPriceFilter: true, layout: 'topbar' }),
    spec('sense', 'productGrid', 'collection', { columns: 3, cardStyle: 'minimal' }),
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
 * Returns undefined when the id is not in the registry.
 */
export function getExperienceComposition(id: string): ExperienceComposition | undefined {
  return EXPERIENCE_COMPOSITIONS[id];
}
