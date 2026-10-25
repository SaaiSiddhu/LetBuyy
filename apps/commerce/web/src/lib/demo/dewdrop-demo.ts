/** Public synthetic sample catalog. These facts and images never seed a merchant installation. */
import { BeautyFactsSchema, type ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';
const media = '/theme-assets/dewdrop/v2/';
const sample = 'Fictional demonstration product; not for sale. Sample care text is illustrative.';
export const DEWDROP_DEMO_PRODUCTS: ProductModel[] = [
    { id: '7b669c70-8100-4000-8000-000000000001', name: 'Cloud Rinse', description: `A gel cleanser for the cleanse step. ${sample}`, price: 640, currency: 'INR', stock: 12, isActive: true, category: 'Cleanse', images: [media + 'cloud-rinse.webp'], beauty: BeautyFactsSchema.parse({ routineStage: 'cleanse', format: 'Gel cleanser', netQuantity: { value: 150, unit: 'ml' }, ingredients: 'Sample ingredient text: Aqua, Glycerin, Decyl Glucoside.', directions: 'Sample directions: massage a small amount onto damp skin and rinse.', warnings: 'Sample warning: avoid contact with eyes. Discontinue use if irritation occurs.' }), variantOptions: [], variants: [] },
    { id: '7b669c70-8100-4000-8000-000000000002', name: 'Daily Veil', description: `A face cream for the care step. ${sample}`, price: 880, currency: 'INR', stock: 12, isActive: true, category: 'Care', images: [media + 'daily-veil.webp'], beauty: BeautyFactsSchema.parse({ routineStage: 'care', format: 'Face cream', netQuantity: { value: 50, unit: 'g' }, ingredients: 'Sample ingredient text: Aqua, Glycerin, Squalane.', directions: 'Sample directions: apply a small amount to clean skin.', warnings: 'Sample warning: for external use only. Discontinue use if irritation occurs.' }), variantOptions: [], variants: [] },
    // eslint-disable-next-line @letbuyy/ui/no-hardcoded-hex -- Fictional product shade facts preserve named physical colours.
    { id: '7b669c70-8100-4000-8000-000000000003', name: 'Soft Colour', description: `A named-shade lip tint for the colour step. ${sample}`, price: 520, currency: 'INR', stock: 8, isActive: true, category: 'Colour', images: [media + 'lip-tint.webp'], beauty: BeautyFactsSchema.parse({ routineStage: 'colour', format: 'Lip tint', netQuantity: { value: 6, unit: 'ml' }, ingredients: 'Sample ingredient text: Ricinus Communis Seed Oil, Cera Alba, Tocopherol. Colour ingredients vary by shade.', directions: 'Sample directions: apply a small amount to lips and build to your preferred colour.', warnings: 'Sample warning: for external use only. Discontinue use if irritation occurs.', shadeOptionName: 'Shade', shades: [{ value: 'Rosewater', code: 'RW01', color: '#a36a65', ingredients: 'Sample Rosewater ingredient text: Ricinus Communis Seed Oil, Cera Alba, CI 77491.' }, { value: 'Pink Clay', code: 'PC02', color: '#a36a65', ingredients: 'Sample Pink Clay ingredient text: Ricinus Communis Seed Oil, Cera Alba, CI 77492.' }, { value: 'Terracotta', code: 'TC03', color: '#89534a', ingredients: '' }] }), variantOptions: [{ name: 'Shade', values: ['Rosewater', 'Pink Clay', 'Terracotta'] }], variants: [
            { id: '7b669c70-8200-4000-8000-000000000001', name: 'Rosewater', price: 520, stock: 4, options: { Shade: 'Rosewater' } },
            { id: '7b669c70-8200-4000-8000-000000000002', name: 'Pink Clay', price: 520, stock: 4, options: { Shade: 'Pink Clay' } },
            { id: '7b669c70-8200-4000-8000-000000000003', name: 'Terracotta', price: 520, stock: 0, options: { Shade: 'Terracotta' } },
        ] },
    { id: '7b669c70-8100-4000-8000-000000000004', name: 'Palm Wash', description: `A deliberately incomplete care record demonstrating missing imagery and ingredients. ${sample}`, price: 460, currency: 'INR', stock: 8, isActive: true, category: 'Cleanse', images: [], beauty: BeautyFactsSchema.parse({ routineStage: 'cleanse', format: 'Hand wash', netQuantity: { value: 250, unit: 'ml' }, ingredients: null, directions: null, warnings: null }), variantOptions: [], variants: [] },
];
export const DEWDROP_DEMO_COLLECTIONS = ['Cleanse', 'Care', 'Colour'].map((title, index) => ({ id: `7b669c70-8300-4000-8000-${String(index + 1).padStart(12, '0')}`, title, handle: title.toLowerCase(), description: `${title} step · Fictional sample collection`, image_url: DEWDROP_DEMO_PRODUCTS[index].images[0], product_count: index === 0 ? 2 : 1 }));
/** Explicit synthetic shelf membership. A missing key never means every product. */
export const DEWDROP_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
    [DEWDROP_DEMO_COLLECTIONS[0].id]: [DEWDROP_DEMO_PRODUCTS[0].id, DEWDROP_DEMO_PRODUCTS[3].id],
    [DEWDROP_DEMO_COLLECTIONS[1].id]: [DEWDROP_DEMO_PRODUCTS[1].id],
    [DEWDROP_DEMO_COLLECTIONS[2].id]: [DEWDROP_DEMO_PRODUCTS[2].id],
};
export const DEWDROP_DEMO_NAVIGATION: StoreNavigation = {
    main: [
        { id: 'dewdrop-demo-routine', label: 'Your routine', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true },
        { id: 'dewdrop-demo-colour', label: 'Named shades', href: `/store/urban-kicks-demo/product/${DEWDROP_DEMO_PRODUCTS[2].id}`, isDefault: false, isVisible: true },
        { id: 'dewdrop-demo-facts', label: 'Ingredients & directions', href: `/store/urban-kicks-demo/product/${DEWDROP_DEMO_PRODUCTS[0].id}#dd-facts-aura-care-product`, isDefault: false, isVisible: true },
    ], footer: [{ id: 'dewdrop-demo-products', label: 'Explore the care shelf', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true }], policies: [],
};
/** Amend only the public sample package; reuse the same canonical schemas, renderer and islands. */
export function withDewdropDemoContent(input: Record<string, unknown>): Record<string, unknown> {
    const bundle = LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
    for (const template of Object.values(bundle.templates))
        for (const instance of Object.values(template.sections)) {
            if (instance.type === 'hero-banner')
                Object.assign(instance.settings, { image: media + 'care-still-life.webp', imageAlt: 'Original unbranded care still life with a sage glass bottle, cream jar and rose tube', imageFocus: 'center' });
            if (instance.type === 'category-grid')
                Object.assign(instance.settings, { collection1: DEWDROP_DEMO_COLLECTIONS[0].id, collection2: DEWDROP_DEMO_COLLECTIONS[1].id, collection3: DEWDROP_DEMO_COLLECTIONS[2].id });
            if (instance.type === 'featured-products')
                Object.assign(instance.settings, { product1: DEWDROP_DEMO_PRODUCTS[0].id, product2: DEWDROP_DEMO_PRODUCTS[1].id });
            if (instance.type === 'about-section')
                Object.assign(instance.settings, { image: media + 'daily-veil.webp', imageAlt: 'Original illustration of an unbranded cream jar', content: 'Read the supplied ingredients and directions before choosing. Named shade options remain distinct even when their colour references look similar. This is a fictional sample catalog.', linkLabel: 'Read the sample product facts', linkUrl: `/product/${DEWDROP_DEMO_PRODUCTS[2].id}#dd-facts-aura-care-product` });
        }
    return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
