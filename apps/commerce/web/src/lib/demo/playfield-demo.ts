/** Explicit synthetic preview catalog. Never an install seed or a merchant product source. */
import { ToyFactsSchema, ToyVariantFactsSchema, type ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/playfield/v2/';
export const PLAYFIELD_DEMO_PRODUCTS: ProductModel[] = [
  {
    id: '7b669c70-8000-4000-8000-000000000001', name: 'Pattern Studio', description: 'Wooden mosaic kit. A fictional demonstration product, not for sale. All sample editions use the same listed contents and tray dimensions.',
    price: 1290, currency: 'INR', stock: 8, isActive: true, category: 'Art & making', images: [media + 'pattern-studio.webp', media + 'activity-hero.webp'],
    toys: ToyFactsSchema.parse({ ageBands: ['6-8'], ageStatement: '6–8 years', interests: ['art'], productType: 'mosaic-kit', contents: [{ quantity: 12, label: 'wooden mosaic tiles' }, { quantity: 2, label: 'idea cards' }, { quantity: 1, label: 'tray' }], contentsComplete: true, dimensions: { label: 'Tray', length: 24, width: 19, height: 1.5, unit: 'cm' }, additionalDimensions: [{ label: 'Each tile', length: 5, width: 5, height: 0.6, unit: 'cm' }], materials: 'Wooden tiles and tray; printed paper idea cards. Fictional sample materials.', finish: 'Painted finish on the tiles. This sample statement is not a certification.', care: 'Wipe with a dry cloth; store the pieces together.', warnings: [{ text: 'Small pieces. Read the product information and supervise use as appropriate. Fictional sample warning, not a certified safety statement.', sourceLabel: 'Fictional Playfield merchant', editionLabel: 'All sample editions' }] }),
    variantOptions: [{ name: 'Edition', values: ['Garden', 'Ocean', 'Sunrise'] }],
    // Fixed IDs identify synthetic read-only preview records; create commands never submit them.
    variants: ['Garden', 'Ocean', 'Sunrise'].map((edition, index) => ({ id: `7b669c70-8100-4000-8000-${String(index + 1).padStart(12, '0')}`, name: edition + ' · 12 tiles', title: edition + ' · 12 tiles', price: 1290, stock: edition === 'Sunrise' ? 0 : 4, options: { Edition: edition }, toys: ToyVariantFactsSchema.parse({ contents: [{ quantity: 12, label: 'wooden mosaic tiles' }, { quantity: 2, label: 'idea cards' }, { quantity: 1, label: 'tray' }], contentsComplete: true, dimensions: { label: 'Tray', length: 24, width: 19, height: 1.5, unit: 'cm' }, additionalDimensions: [{ label: 'Each tile', length: 5, width: 5, height: 0.6, unit: 'cm' }] }) })),
  },
  {
    id: '7b669c70-8000-4000-8000-000000000002', name: 'Paper Play', description: 'Colour and folding paper. 36 A5 sheets in six colours. Folded examples in the photograph are illustrative and are not additional included items. Fictional demonstration product, not for sale.',
    price: 490, currency: 'INR', stock: 12, isActive: true, category: 'Art & making', images: [media + 'paper-play.webp'],
    toys: ToyFactsSchema.parse({ ageBands: ['6-8'], ageStatement: '6–8 years', interests: ['art'], productType: 'paper-activity', contents: [{ quantity: 36, label: 'A5 paper sheets · six colours' }], contentsComplete: true, dimensions: { label: 'Each A5 sheet', length: 21, width: 14.8, unit: 'cm' }, materials: 'Coloured paper. Fictional sample material statement.', care: 'Keep dry and flat.' }),
  },
  {
    id: '7b669c70-8000-4000-8000-000000000003', name: 'Arch Paths', description: 'Wooden building arches. Six whole pieces; the largest arch measures 18 cm across. Fictional demonstration product, not for sale.',
    price: 990, currency: 'INR', stock: 6, isActive: true, category: 'Building', images: [media + 'arch-paths.webp'],
    toys: ToyFactsSchema.parse({ ageBands: ['3-5'], ageStatement: '3–5 years', interests: ['building'], productType: 'building-arches', contents: [{ quantity: 6, label: 'wooden arches' }], contentsComplete: true, dimensions: { label: 'Largest arch', width: 18, unit: 'cm' }, materials: 'Painted wood. Fictional sample material statement.', care: 'Wipe dry and store away from moisture.' }),
  },
  {
    id: '7b669c70-8000-4000-8000-000000000004', name: 'Make a Story', description: 'Printed pattern cards. Fictional demonstration product, not for sale. Image, age, contents and dimensions have intentionally not been supplied.',
    price: 290, currency: 'INR', stock: 8, isActive: true, category: 'Art & making', images: [], toys: ToyFactsSchema.parse({ interests: ['art'], productType: 'printed-cards' }),
  },
];

export const PLAYFIELD_DEMO_COLLECTIONS = [
  { id: '7b669c70-8200-4000-8000-000000000001', handle: 'art-making', title: 'Art & making', description: 'Fictional sample activities for curious afternoons.', image_url: media + 'paper-play.webp', product_count: 3 },
  { id: '7b669c70-8200-4000-8000-000000000002', handle: 'building', title: 'Building', description: 'Fictional sample objects to arrange and balance.', image_url: media + 'arch-paths.webp', product_count: 1 },
];
/** Explicit shelf membership; absent membership is unavailable, never all merchandise. */
export const PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
  [PLAYFIELD_DEMO_COLLECTIONS[0].id]: [PLAYFIELD_DEMO_PRODUCTS[0].id, PLAYFIELD_DEMO_PRODUCTS[1].id, PLAYFIELD_DEMO_PRODUCTS[3].id],
  [PLAYFIELD_DEMO_COLLECTIONS[1].id]: [PLAYFIELD_DEMO_PRODUCTS[2].id],
};
export const PLAYFIELD_DEMO_NAVIGATION: StoreNavigation = {
  main: [
    { id: 'playfield-demo-activities', label: 'All activities', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true },
    { id: 'playfield-demo-age', label: 'Shop by age', href: '/store/urban-kicks-demo/products?age_band=6-8', isDefault: false, isVisible: true },
    { id: 'playfield-demo-art', label: 'Art & making', href: '/store/urban-kicks-demo/collections/art-making', isDefault: false, isVisible: true },
    { id: 'playfield-demo-building', label: 'Building', href: '/store/urban-kicks-demo/collections/building', isDefault: false, isVisible: true },
  ],
  footer: [{ id: 'playfield-demo-details', label: 'Contents & product facts', href: `/store/urban-kicks-demo/product/${PLAYFIELD_DEMO_PRODUCTS[0].id}#playfield-product-facts`, isDefault: false, isVisible: true }], policies: [],
};

/** Only catalog-preview settings receive artwork; the installed package remains merchant-owned. */
export function withPlayfieldDemoContent(input: Record<string, unknown>): Record<string, unknown> {
  const bundle = LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
  for (const template of Object.values(bundle.templates)) for (const instance of Object.values(template.sections)) {
    if (instance.type === 'spotlight') Object.assign(instance.settings, { image: media + 'activity-hero.webp', imageAlt: 'Adult hand arranging the twelve Pattern Studio tiles in their tray', link: `/product/${PLAYFIELD_DEMO_PRODUCTS[0].id}`, firstImage: media + 'paper-play.webp', firstImageAlt: 'Coloured paper with illustrative folded examples', firstLink: '/collections/art-making', secondImage: media + 'arch-paths.webp', secondImageAlt: 'Six whole wooden arch blocks', secondLink: '/collections/building' });
    if (instance.type === 'product-grid') Object.assign(instance.settings, { title: 'For curious afternoons.', productLimit: 3 });
    if (instance.type === 'about-section') Object.assign(instance.settings, { image: media + 'activity-hero.webp', imageAlt: 'The sample mosaic kit in use', content: 'Arrange a garden. Invent a creature. Start again with the same twelve tiles. Sample play ideas for the fictional Pattern Studio kit.', linkLabel: 'Explore Pattern Studio', linkUrl: `/product/${PLAYFIELD_DEMO_PRODUCTS[0].id}` });
    if (instance.type === 'trust-badges') Object.assign(instance.settings, { contentsText: 'See the merchant’s contents list before you choose.', materialsText: 'Read supplied materials, dimensions and care information.', helpText: 'Check the store’s contact information and policies for product questions.' });
  }
  return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
