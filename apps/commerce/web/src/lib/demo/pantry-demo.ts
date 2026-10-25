/** Public synthetic catalog-preview content only. Never an install seed or live merchant data. */
import type { ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/pantry/v2/';
const lentils = {
  id: '7b669c70-1005-4000-8000-000000000001', name: 'Split red lentils', description: 'Shelf-stable red lentils. Fictional demonstration product; not for sale.', price: 180, currency: 'INR', stock: 12, isActive: true, category: 'Pulses & lentils', images: [media + 'red-lentils.webp'],
  food: { ingredients: 'Split red lentils (100%).', allergens: { status: 'not_supplied' as const }, storage: 'Store in a cool, dry place. Keep airtight after opening.', preparation: 'Rinse before cooking. Follow the supplied package instructions.', nutritionText: null, netQuantity: null },
  variantOptions: [{ name: 'Pack', values: ['250 g', '500 g'] }],
  variants: [
    { id: '7b669c70-2005-4000-8000-000000000001', name: '250 g', price: 180, stock: 12, options: { Pack: '250 g' }, food: { netQuantity: { value: 250, unit: 'g' as const } } },
    { id: '7b669c70-2005-4000-8000-000000000002', name: '500 g', price: 340, stock: 0, options: { Pack: '500 g' }, food: { netQuantity: { value: 500, unit: 'g' as const } } },
  ],
};
const rice = {
  id: '7b669c70-1005-4000-8000-000000000002', name: 'Basmati rice', description: 'Dry rice for everyday cooking. Fictional demonstration product; not for sale.', price: 220, currency: 'INR', stock: 12, isActive: true, category: 'Rice & grains', images: [media + 'basmati-rice.webp'],
  food: { ingredients: 'Basmati rice (100%).', allergens: { status: 'not_supplied' as const }, storage: 'Store in a cool, dry place. Keep airtight after opening.', preparation: 'Rinse before cooking. Follow the supplied package instructions.', nutritionText: null, netQuantity: { value: 1000, unit: 'g' as const } },
  variantOptions: [], variants: [],
};
// Canonical ProductModel carries the validated food facts; this preview adds no replacement DTO.
export const PANTRY_DEMO_PRODUCTS: ProductModel[] = [lentils, rice];
export const PANTRY_DEMO_COLLECTIONS = [
  { id: '7b669c70-3005-4000-8000-000000000001', title: 'Pulses & lentils', handle: 'pulses-lentils', description: 'Read the ingredients and choose a pack. Sample collection.', image_url: media + 'red-lentils.webp', product_count: 1 },
  { id: '7b669c70-3005-4000-8000-000000000002', title: 'Rice & grains', handle: 'rice-grains', description: 'Choose your pantry staple. Sample collection.', image_url: media + 'basmati-rice.webp', product_count: 1 },
];
/** Explicit synthetic shelf membership. Missing keys are unavailable, never all products. */
export const PANTRY_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
  '7b669c70-3005-4000-8000-000000000001': [lentils.id],
  '7b669c70-3005-4000-8000-000000000002': [rice.id],
};
export const PANTRY_DEMO_NAVIGATION: StoreNavigation = {
  main: [
    { id: 'pantry-demo-shelves', label: 'Pantry shelves', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true },
    { id: 'pantry-demo-facts', label: 'Ingredient guide', href: `/store/urban-kicks-demo/product/${lentils.id}#food-facts`, isDefault: false, isVisible: true },
  ],
  footer: [{ id: 'pantry-demo-staples', label: 'Everyday staples', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true }], policies: [],
};

/** Only explicit public demo presentation is amended. Live instances never call this function. */
export function withPantryDemoContent(input: Record<string, unknown>): Record<string, unknown> {
  const bundle = LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
  for (const template of Object.values(bundle.templates)) for (const instance of Object.values(template.sections)) {
    if (instance.type === 'hero-banner') Object.assign(instance.settings, { image: media + 'staples-still-life.webp', imageAlt: 'Uncooked red lentils and rice; original pantry inspiration', focalPoint: 'center' });
    if (instance.type === 'category-grid') Object.assign(instance.settings, { collection1: PANTRY_DEMO_COLLECTIONS[0].id, collection2: PANTRY_DEMO_COLLECTIONS[1].id });
    if (instance.type === 'featured-products') Object.assign(instance.settings, { product1: rice.id, product2: lentils.id });
    if (instance.type === 'about-section') Object.assign(instance.settings, { image: media + 'red-lentils.webp', imageAlt: 'Illustrative unprinted lentil pouch', content: 'Read supplied ingredients and storage notes before choosing a pack. Allergen information not supplied stays unknown.', linkLabel: 'Read the product facts', linkUrl: `/product/${lentils.id}#food-facts` });
  }
  return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
