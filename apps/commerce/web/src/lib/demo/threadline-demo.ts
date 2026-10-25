/** Public synthetic catalog-preview content. Never an installation seed or live merchant catalog. */
import type { ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/threadline/v2/';
export const THREADLINE_DEMO_PRODUCTS: ProductModel[] = [
    { id: '7b669c70-1000-4000-8000-000000000001', name: 'The Everyday Linen Shirt', description: 'A relaxed silhouette in naturally textured linen. Demonstration product; not for sale.', price: 2490, currency: 'INR', stock: 12, isActive: true, category: 'Clothing', images: [media + 'linen-shirt.webp', media + 'linen-detail.webp'], apparel: { fit: 'Relaxed fit, with a little extra room through the body and sleeves.', fabric: '100% linen. Sample composition for this fictional garment.', care: 'Gentle cold wash. Line dry in shade. Warm iron if needed.', unit: 'cm' as const, measurements: [{ size: 'XS', chest: 94, shoulder: 38, length: 67 }, { size: 'S', chest: 98, shoulder: 39, length: 68 }, { size: 'M', chest: 102, shoulder: 40, length: 69 }, { size: 'L', chest: 106, shoulder: 41, length: 70 }, { size: 'XL', chest: 110, shoulder: 42, length: 71 }] }, variantOptions: [{ name: 'Color', values: ['Oat'] }, { name: 'Size', values: ['XS', 'S', 'M', 'L', 'XL'] }] },
    { id: '7b669c70-1000-4000-8000-000000000002', name: 'Tailored Straight Trouser', description: 'An easy straight silhouette. Demonstration product; not for sale.', price: 3290, currency: 'INR', stock: 12, isActive: true, category: 'Clothing', images: [media + 'trousers.webp'], variantOptions: [{ name: 'Color', values: ['Ink'] }, { name: 'Size', values: ['S', 'M', 'L'] }] },
    { id: '7b669c70-1000-4000-8000-000000000003', name: 'The Everyday Cotton Dress', description: 'A simple everyday dress. Demonstration product; not for sale.', price: 3990, currency: 'INR', stock: 12, isActive: true, category: 'Clothing', images: [media + 'cotton-dress.webp'], variantOptions: [{ name: 'Color', values: ['Rust'] }, { name: 'Size', values: ['S', 'M', 'L'] }] },
].map((product, index) => ({ ...product, variants: product.variantOptions[1].values.map((size, i) => ({ id: `7b669c70-200${index}-4000-8000-${String(i + 1).padStart(12, '0')}`, name: `${product.variantOptions[0].values[0]} / ${size}`, price: product.price, stock: size === 'XL' ? 0 : 4, options: { Color: product.variantOptions[0].values[0], Size: size } })) }));

export const THREADLINE_DEMO_COLLECTIONS = ['Relaxed', 'Straight', 'Easy'].map((title, i) => ({ id: `7b669c70-3000-4000-8000-${String(i + 1).padStart(12, '0')}`, title, description: `${title} silhouettes · Sample collection`, image_url: THREADLINE_DEMO_PRODUCTS[i].images[0], product_count: 1 }));
export const THREADLINE_DEMO_NAVIGATION: StoreNavigation = {
    main: ['New', 'Clothing', 'Collections', 'Fit guide'].map((label, i) => ({ id: `threadline-demo-nav-${i}`, label, href: i === 3 ? `/store/urban-kicks-demo/product/${THREADLINE_DEMO_PRODUCTS[0].id}#fit-guide` : '/store/urban-kicks-demo/products', isDefault: false, isVisible: true })),
    footer: [{ id: 'threadline-demo-clothing', label: 'Explore clothing', href: '/store/urban-kicks-demo/products', isDefault: false, isVisible: true }], policies: [],
};

/** Same package/code/schema; explicitly labelled sample settings and merchandise. */
export function withThreadlineDemoContent(input: Record<string, unknown>): Record<string, unknown> {
    const bundle = LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
    for (const template of Object.values(bundle.templates)) for (const instance of Object.values(template.sections)) {
        if (instance.type === 'hero-banner') Object.assign(instance.settings, { image: media + 'hero.webp', secondImage: media + 'linen-shirt.webp', secondaryLink: `/product/${THREADLINE_DEMO_PRODUCTS[0].id}#fit-guide` });
        if (instance.type === 'featured-products') Object.assign(instance.settings, { image: media + 'hero.webp', product1: THREADLINE_DEMO_PRODUCTS[0].id, product2: THREADLINE_DEMO_PRODUCTS[1].id });
        if (instance.type === 'about-section') Object.assign(instance.settings, { image: media + 'linen-detail.webp', content: 'Know the fabric. Understand the fit. Find the small details that make a piece feel like yours.' });
        if (instance.type === 'trust-badges') Object.assign(instance.settings, { fitText: 'Garment measurements, clearly explained.', serviceText: 'Fabric and care information, before you buy.', supportText: 'Your store’s contact and policies, in one place.' });
    }
    return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
