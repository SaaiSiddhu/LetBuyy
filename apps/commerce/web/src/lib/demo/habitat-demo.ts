/** Fictional public catalog-preview content only. Never an install seed or merchant catalog. */
import { FurnitureFactsSchema, FurnitureVariantFactsSchema, type ProductModel, type ProductVariant } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/habitat/v2/';
const chairId = '7b669c70-4100-4000-8000-000000000001';
const tableId = '7b669c70-4100-4000-8000-000000000002';
const naturalId = '7b669c70-4200-4000-8000-000000000001';
const smokedId = '7b669c70-4200-4000-8000-000000000002';
const tableVariantId = '7b669c70-4200-4000-8000-000000000003';
const livingId = '7b669c70-4300-4000-8000-000000000001';
const readingId = '7b669c70-4300-4000-8000-000000000002';

const chair: ProductModel = {
  id: chairId, name: 'Aara lounge chair', description: 'A low teak chair with an oatmeal cushion. Fictional demonstration product; not for sale.',
  price: 18900, currency: 'INR', stock: 6, isActive: true, category: 'Living', tags: ['seating', 'teak'],
  images: [media + 'chair.webp', media + 'room.webp'], variantOptions: [{ name: 'Finish', values: ['Natural teak', 'Smoked teak'] }],
  variants: [
    Object.assign({ id: naturalId, product_id: chairId, name: 'Natural teak', title: 'Natural teak', price: 18900, stock: 3, options: { Finish: 'Natural teak' }, image: media + 'chair.webp' } satisfies ProductVariant, { furniture: FurnitureVariantFactsSchema.parse({ finish: 'Natural teak', package: { unit: 'cm', width: 72, depth: 82, height: 78 }, weight: { value: 13.8, unit: 'kg' } }) }),
    Object.assign({ id: smokedId, product_id: chairId, name: 'Smoked teak', title: 'Smoked teak', price: 19900, stock: 3, options: { Finish: 'Smoked teak' }, image: media + 'chair-smoked.webp' } satisfies ProductVariant, { furniture: FurnitureVariantFactsSchema.parse({ finish: 'Smoked teak', package: { unit: 'cm', width: 74, depth: 84, height: 78 }, weight: { value: 14.2, unit: 'kg' } }) }),
  ],
};
const table: ProductModel = {
  id: tableId, name: 'Nila side table', description: 'A small round table in natural teak. Fictional demonstration product; not for sale.',
  price: 6400, currency: 'INR', stock: 4, isActive: true, category: 'Living', tags: ['side table', 'teak'], images: [media + 'table.webp'],
  variantOptions: [{ name: 'Finish', values: ['Natural teak'] }],
  variants: [Object.assign({ id: tableVariantId, product_id: tableId, name: 'Natural teak', title: 'Natural teak', price: 6400, stock: 4, options: { Finish: 'Natural teak' }, image: media + 'table.webp' } satisfies ProductVariant, { furniture: FurnitureVariantFactsSchema.parse({ finish: 'Natural teak', package: { unit: 'cm', width: 56, depth: 56, height: 48 } }) })],
};

// Object.assign extends the canonical model with its validated leaf while root owns ProductModel's
// public export/hydration integration. It is not an app-local replacement Product interface.
export const HABITAT_DEMO_PRODUCTS = [
  Object.assign(chair, { furniture: FurnitureFactsSchema.parse({ assembled: { unit: 'cm', width: 68, depth: 78, height: 74 }, seat_height: { unit: 'cm', value: 38 }, materials: ['Solid teak frame', 'Removable linen-covered cushion', 'Foam filling'], assembly: { status: 'assembled', tools: 'None' }, care: 'Keep the frame dry; dust with a soft cloth. Follow the supplied cushion care label.' }) }),
  Object.assign(table, { furniture: FurnitureFactsSchema.parse({ assembled: { unit: 'cm', diameter: 50, height: 42 }, materials: ['Solid teak'], assembly: { status: 'assembled', tools: 'None' }, care: 'Dust with a soft dry cloth. Blot spills promptly.' }) }),
];

export const HABITAT_DEMO_COLLECTIONS = [
  { id: livingId, handle: 'living-room', title: 'Living room', description: 'A chair and a table, each sold separately. Sample collection.', image_url: media + 'room.webp', product_count: 2 },
  { id: readingId, handle: 'reading-corner', title: 'Reading corner', description: 'A place to pause. Sample collection.', image_url: media + 'chair.webp', product_count: 1 },
];
/** Explicit preview membership. Missing collection keys never imply the whole catalog. */
export const HABITAT_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
  [livingId]: [chairId, tableId],
  [readingId]: [chairId],
};
export const HABITAT_DEMO_NAVIGATION: StoreNavigation = {
  main: [
    { id: 'habitat-demo-rooms', label: 'Rooms', href: '/store/urban-kicks-demo/collections', isDefault: false, isVisible: true },
    { id: 'habitat-demo-furniture', label: 'Furniture', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true },
    { id: 'habitat-demo-measure', label: 'Measure your space', href: `/store/urban-kicks-demo/product/${chairId}#habitat-dimensions-habitat-product-selection`, isDefault: false, isVisible: true },
  ],
  footer: [{ id: 'habitat-demo-living', label: 'Explore the living room', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true }],
  policies: [],
};

/** Apply approved sample media/copy/resources to a clone of this selected preview document only. */
export function withHabitatDemoContent(input: Record<string, unknown>): Record<string, unknown> {
  const bundle = LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
  if (bundle.package.slug !== 'letbuyy-craft' || bundle.package.version !== '2.0.0') throw new Error('Habitat preview requires its selected versioned artifact');
  for (const template of Object.values(bundle.templates)) for (const instance of Object.values(template.sections)) {
    if (instance.type === 'hero-banner') Object.assign(instance.settings, { image: media + 'room.webp', imageAlt: 'Aara chair and Nila table in a sunlit sample living room', caption: 'The living edit · Natural teak, soft linen', collection1: livingId, collection2: readingId, guideText: 'Read the measuring guide', guideLink: `/product/${chairId}#habitat-dimensions-habitat-product-selection` });
    if (instance.type === 'product-detail') Object.assign(instance.settings, { showRoomContext: true, contextMediaIndex: 2 });
    if (instance.type === 'product-grid' && template === bundle.templates.index) Object.assign(instance.settings, { collectionId: livingId, productLimit: 2 });
    if (instance.type === 'featured-products') Object.assign(instance.settings, { product1: tableId, productLimit: 1, subtitle: 'Separately priced. Independently purchased. No automatic bundle.' });
    if (instance.type === 'about-section') Object.assign(instance.settings, { image: media + 'chair.webp', imageAlt: 'Teak frame and oatmeal cushion on the fictional Aara chair', title: 'The grain is part of the character.', content: 'Our sample chair pairs a solid teak frame with a removable linen-covered cushion. These are fictional supplied facts, not claims about a real merchant product.', linkLabel: 'Materials, finish & care', linkUrl: `/product/${chairId}#habitat-dimensions-habitat-product-selection` });
    if (instance.type === 'trust-badges') Object.assign(instance.settings, { dimensionsText: 'Assembled and package measurements have separate labels.', assemblyText: 'Review the supplied assembly information before choosing a piece.', deliveryText: 'Options and charges depend on an actual checkout quote. No delivery date is promised.' });
  }
  return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
