/** Public synthetic preview content. Never an installation seed or live merchant catalog. */
import { PersonalizationFactsSchema, type PersonalizationFacts, type ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/madeyours/v2/';
export const MADEYOURS_DEMO_BLOCK_FACTS: PersonalizationFacts = PersonalizationFactsSchema.parse({ version: 1, revision: 1, methods: [{ id: 'engraving', label: 'Front engraving', min_graphemes: 1, max_graphemes: 18, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }], placements: [{ id: 'front-center', label: 'Centered on the front' }] }], production_note: 'Sample configuration. A dispatch estimate has not been supplied.' });
export const MADEYOURS_DEMO_NOTEBOOK_FACTS: PersonalizationFacts = PersonalizationFactsSchema.parse({ version: 1, revision: 1, methods: [{ id: 'cover-print', label: 'Cover print', min_graphemes: 1, max_graphemes: 12, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }], placements: [{ id: 'cover-center', label: 'Centered on the cover' }] }] });

// Both preview products require strict facts on the canonical ProductModel contract.
export const MADEYOURS_DEMO_PRODUCTS: Array<ProductModel & { personalization: PersonalizationFacts }> = [
  { id: '7b669c70-9000-4000-8000-000000000001', name: 'Desk name block', description: 'A blank walnut desk block, 20 × 5 × 3 cm. Demonstration product and material specification; not for sale.', price: 1290, currency: 'INR', stock: 4, isActive: true, category: 'Desk details', images: [media + 'block.webp'], personalization: MADEYOURS_DEMO_BLOCK_FACTS, variantOptions: [{ name: 'Wood', values: ['Walnut', 'Oak'] }], variants: [{ id: '7b669c70-9100-4000-8000-000000000001', name: 'Walnut', sku: 'MY-DB-WAL', price: 1290, stock: 4, options: { Wood: 'Walnut' } }, { id: '7b669c70-9100-4000-8000-000000000002', name: 'Oak', sku: 'MY-DB-OAK', price: 1290, stock: 0, options: { Wood: 'Oak' } }], specifications: { Dimensions: '20 × 5 × 3 cm', Material: 'Walnut · sample specification' } },
  { id: '7b669c70-9000-4000-8000-000000000002', name: 'Linen notebook', description: 'An ivory linen A5 notebook with an indigo spine and 160 unruled pages. Demonstration product; sold separately, not for sale.', price: 790, currency: 'INR', stock: 6, isActive: true, category: 'Paper and plans', images: [media + 'notebook.webp'], personalization: MADEYOURS_DEMO_NOTEBOOK_FACTS, variantOptions: [{ name: 'Cover', values: ['Ivory linen / Indigo spine'] }], variants: [{ id: '7b669c70-9100-4000-8000-000000000003', name: 'Ivory linen / Indigo spine', sku: 'MY-NB-IV-IN', price: 790, stock: 6, options: { Cover: 'Ivory linen / Indigo spine' } }], specifications: { Size: 'A5', Pages: '160 · unruled · sample specification' } },
];
export const MADEYOURS_DEMO_COLLECTIONS = [
  { id: '7b669c70-9200-4000-8000-000000000001', handle: 'desk-details', title: 'Desk details', description: 'A place for your name · Sample collection', image_url: media + 'block.webp', product_count: 1 },
  { id: '7b669c70-9200-4000-8000-000000000002', handle: 'paper-and-plans', title: 'Paper and plans', description: 'Words on a cover · Sample collection', image_url: media + 'notebook.webp', product_count: 1 },
];
/** Explicit sample membership; missing keys must never expand to the full catalog. */
export const MADEYOURS_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
  [MADEYOURS_DEMO_COLLECTIONS[0].id]: [MADEYOURS_DEMO_PRODUCTS[0].id],
  [MADEYOURS_DEMO_COLLECTIONS[1].id]: [MADEYOURS_DEMO_PRODUCTS[1].id],
};
export const MADEYOURS_DEMO_NAVIGATION: StoreNavigation = {
  main: [{ id: 'madeyours-demo-bases', label: 'Choose your base', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true }, { id: 'madeyours-demo-collections', label: 'Collections', href: '/store/urban-kicks-demo/collections', isDefault: false, isVisible: true }],
  footer: [{ id: 'madeyours-demo-catalog', label: 'Explore the sample bases', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true }], policies: [],
};

/** Same versioned package and settings controls; the preview owner selects the matching synthetic catalog. */
export function withMadeYoursDemoContent(input: Record<string, unknown>): Record<string, unknown> {
  const bundle = LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
  for (const template of Object.values(bundle.templates)) for (const instance of Object.values(template.sections)) {
    if (instance.type === 'hero-banner') Object.assign(instance.settings, { image: media + 'hero.webp' });
    if (instance.type === 'about-section') Object.assign(instance.settings, { image: media + 'notebook.webp', content: 'Choose an available base and method. Enter your words, then check the exact written summary before adding to cart. These sample products illustrate the process; previews are illustrative.' });
    if (instance.type === 'featured-products') Object.assign(instance.settings, { product1: MADEYOURS_DEMO_PRODUCTS[0].id, product2: MADEYOURS_DEMO_PRODUCTS[1].id, subtitle: 'Each product is sold separately.' });
  }
  return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
