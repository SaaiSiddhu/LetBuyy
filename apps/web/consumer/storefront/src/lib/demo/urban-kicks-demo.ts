import { getDefaultStorefrontThemeTemplate } from '@letbuyy/api-types';
import {
    DEFAULT_THEME_SETTINGS,
    ProductModel,
    SectionModel,
    StoreModel,
    StoreNavigation,
    StoreTemplateConfig,
    ThemeSettings,
} from '@/types/store';

export const URBAN_KICKS_DEMO_SUBDOMAIN = 'urban-kicks-demo';
const DEMO_STORE_ID = 'demo-urban-kicks-store';
const DEMO_RELEASE_ID = 'demo-urban-kicks-release';
const DEMO_TIMESTAMP = '2026-05-24T00:00:00.000Z';

export function isUrbanKicksDemoSubdomain(subdomain?: string | null) {
    return subdomain === URBAN_KICKS_DEMO_SUBDOMAIN;
}

export const URBAN_KICKS_DEMO_PRODUCTS: ProductModel[] = [
    {
        id: 'demo-air-runner-90',
        storeId: DEMO_STORE_ID,
        name: 'Aero Runner 90',
        description: 'Lightweight everyday sneakers with a sculpted streetwear profile.',
        price: 8999,
        compareAtPrice: 10999,
        currency: 'INR',
        images: ['/images/banners/new-arrivals-1.png'],
        category: 'Sneakers',
        stock: 18,
        isActive: true,
        isFeatured: true,
        isNew: true,
        rating: 4.8,
        reviewCount: 124,
        tags: ['sneakers', 'streetwear', 'new-arrivals'],
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
    },
    {
        id: 'demo-retro-high-og',
        storeId: DEMO_STORE_ID,
        name: 'Retro High OG',
        description: 'High-top court-inspired pair with a bold contrast sole.',
        price: 12499,
        compareAtPrice: 14999,
        currency: 'INR',
        images: ['/images/banners/new-arrivals-2.png'],
        category: 'Sneakers',
        stock: 11,
        isActive: true,
        isFeatured: true,
        isTrending: true,
        rating: 4.9,
        reviewCount: 89,
        tags: ['high-top', 'limited-run', 'sneakers'],
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
    },
    {
        id: 'demo-court-classic',
        storeId: DEMO_STORE_ID,
        name: 'Court Classic',
        description: 'Clean low-top sneakers made for daily rotations.',
        price: 6499,
        currency: 'INR',
        images: ['/images/banners/new-arrivals-3.png'],
        category: 'Sneakers',
        stock: 26,
        isActive: true,
        isFeatured: true,
        rating: 4.6,
        reviewCount: 57,
        tags: ['minimal', 'daily-wear', 'sneakers'],
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
    },
    {
        id: 'demo-oversized-hoodie',
        storeId: DEMO_STORE_ID,
        name: 'Oversized Drop Hoodie',
        description: 'Heavyweight fleece hoodie with a relaxed oversized fit.',
        price: 3999,
        compareAtPrice: 4999,
        currency: 'INR',
        images: ['/images/banners/new-arrivals-1.png'],
        category: 'Apparel',
        stock: 34,
        isActive: true,
        isFeatured: true,
        isTrending: true,
        rating: 4.7,
        reviewCount: 76,
        tags: ['hoodie', 'apparel', 'streetwear'],
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
    },
    {
        id: 'demo-cargo-joggers',
        storeId: DEMO_STORE_ID,
        name: 'Utility Cargo Joggers',
        description: 'Tapered cargos with utility pockets and stretch waist comfort.',
        price: 2999,
        currency: 'INR',
        images: ['/images/banners/new-arrivals-2.png'],
        category: 'Apparel',
        stock: 21,
        isActive: true,
        isFeatured: true,
        rating: 4.5,
        reviewCount: 42,
        tags: ['joggers', 'cargo', 'apparel'],
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
    },
    {
        id: 'demo-crossbody-pack',
        storeId: DEMO_STORE_ID,
        name: 'Crossbody Utility Pack',
        description: 'Compact sling bag for city carry and travel essentials.',
        price: 1799,
        currency: 'INR',
        images: ['/images/banners/new-arrivals-3.png'],
        category: 'Accessories',
        stock: 40,
        isActive: true,
        isFeatured: true,
        isNew: true,
        rating: 4.4,
        reviewCount: 31,
        tags: ['bag', 'accessories', 'utility'],
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
    },
];

const demoNavigation: StoreNavigation = {
    main: [
        { id: 'home', label: 'Home', href: '/', isDefault: true, isVisible: true },
        { id: 'shop', label: 'Shop', href: '/shop', isDefault: true, isVisible: true },
        { id: 'new-arrivals', label: 'New Arrivals', href: '/shop?sort=newest', isDefault: false, isVisible: true },
        { id: 'sneakers', label: 'Sneakers', href: '/shop?category=Sneakers', isDefault: false, isVisible: true },
    ],
    footer: [
        { id: 'shop', label: 'Shop', href: '/shop', isDefault: true, isVisible: true },
        { id: 'sneakers', label: 'Sneakers', href: '/shop?category=Sneakers', isDefault: false, isVisible: true },
        { id: 'apparel', label: 'Apparel', href: '/shop?category=Apparel', isDefault: false, isVisible: true },
    ],
    policies: [
        { id: 'shipping', label: 'Shipping', href: '/shipping', isDefault: true, isVisible: true },
        { id: 'returns', label: 'Returns', href: '/returns', isDefault: true, isVisible: true },
        { id: 'privacy', label: 'Privacy', href: '/privacy', isDefault: true, isVisible: true },
    ],
};

function toSection(section: {
    id: string;
    type: string;
    order: number;
    visible?: boolean;
    isVisible?: boolean;
    settings?: Record<string, unknown>;
    blocks?: Array<{
        id: string;
        type: string;
        order: number;
        visible?: boolean;
        isVisible?: boolean;
        settings?: Record<string, unknown>;
    }>;
}): SectionModel {
    return {
        id: section.id,
        type: section.type,
        order: section.order,
        settings: section.settings || {},
        blocks: section.blocks?.map((block) => ({
            id: block.id,
            type: block.type,
            order: block.order,
            settings: block.settings || {},
            isVisible: block.visible !== false && block.isVisible !== false,
        })),
        isVisible: section.visible !== false && section.isVisible !== false,
    };
}

export function getUrbanKicksDemoProducts(productIds?: string[]) {
    const productSet = productIds?.length ? new Set(productIds) : null;
    return URBAN_KICKS_DEMO_PRODUCTS
        .filter((product) => !productSet || productSet.has(product.id))
        .map((product) => ({
            ...product,
            images: [...product.images],
            tags: product.tags ? [...product.tags] : [],
        }));
}

export function getUrbanKicksDemoProduct(productId: string) {
    return getUrbanKicksDemoProducts([productId])[0] || null;
}

export function getUrbanKicksDemoStore(): StoreModel {
    const template = getDefaultStorefrontThemeTemplate('urban-kicks', {
        colors: {
            primary: '#8B5CF6',
            secondary: '#3B82F6',
            accent: '#F59E0B',
            background: '#FFFFFF',
            text: '#1F2937',
        },
        fonts: {
            body: 'Inter',
            heading: 'Inter',
        },
    });
    const header = toSection(template.sections.header);
    const footer = toSection(template.sections.footer);
    const templateSections = template.sections.template.map(toSection);
    const themeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        ...template.themeSettings,
    } as ThemeSettings;
    const templateConfig: StoreTemplateConfig = {
        storeId: DEMO_STORE_ID,
        themeId: 'urban-kicks',
        releaseId: DEMO_RELEASE_ID,
        releaseVersion: 1,
        releasePublishedAt: DEMO_TIMESTAMP,
        engineVersion: 'demo',
        themeSettings,
        sections: [header, ...templateSections, footer],
        sectionGroups: {
            header: {
                id: 'header',
                role: 'header',
                sections: [header],
            },
            footer: {
                id: 'footer',
                role: 'footer',
                sections: [footer],
            },
        },
        templates: {
            index: {
                id: 'index',
                type: 'index',
                layoutKey: 'theme',
                sections: templateSections,
            },
        },
    };

    return {
        id: DEMO_STORE_ID,
        sellerId: 'demo',
        name: 'Urban Kicks',
        tagline: 'Streetwear, sneakers, and everyday essentials.',
        subdomain: URBAN_KICKS_DEMO_SUBDOMAIN,
        storeUrl: `/store/${URBAN_KICKS_DEMO_SUBDOMAIN}`,
        themeId: 'urban-kicks',
        currentThemeReleaseId: DEMO_RELEASE_ID,
        storefrontReleaseVersion: 1,
        siteType: 'store',
        selectedProductIds: URBAN_KICKS_DEMO_PRODUCTS.map((product) => product.id),
        templateConfig,
        status: 'published',
        plan: 'free',
        seoTitle: 'Urban Kicks Demo',
        seoDescription: 'Preview the Urban Kicks storefront theme on LetBuyy.',
        codEnabled: true,
        onlinePaymentEnabled: true,
        paymentGateways: ['razorpay'],
        navigation: demoNavigation,
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
        publishedAt: DEMO_TIMESTAMP,
    };
}
