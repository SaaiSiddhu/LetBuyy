import type { Metadata } from 'next';
import type { ProductModel } from '@letbuyy/commerce-core';
import type { StoreModel } from '@letbuyy/tenant-core';

const PLATFORM_DOMAIN = 'letbuyy.store';
const DEFAULT_STAGING_STOREFRONT_URL = 'https://storefront.staging.letbuyy.store';

function cleanPath(path: string): string {
    if (!path || path === '/') return '';
    return path.startsWith('/') ? path : `/${path}`;
}

function safeUrl(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
        return new URL(value).toString();
    } catch {
        return undefined;
    }
}

function absoluteDomainUrl(domain: string | undefined): string | undefined {
    if (!domain) return undefined;
    if (domain.startsWith('/')) return undefined;
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
        return safeUrl(domain);
    }
    return safeUrl(`https://${domain}`);
}

export function resolveSubdomainFromHost(host: string | null): string | null {
    const hostname = host?.split(':')[0]?.toLowerCase();
    if (!hostname) return null;

    if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
        const subdomain = hostname.slice(0, -(`.${PLATFORM_DOMAIN}`.length)).split('.').pop();
        if (subdomain && !['www', 'accounts', 'admin', 'api', 'console', 'storefront'].includes(subdomain)) {
            return subdomain;
        }
    }

    return null;
}

export function getStorefrontBaseUrl(store: StoreModel): string {
    const customDomain = absoluteDomainUrl(store.storeUrl);
    if (customDomain) return customDomain.replace(/\/$/, '');

    if (process.env.NODE_ENV !== 'production') {
        const stagingBase = (process.env.NEXT_PUBLIC_STOREFRONT_URL || DEFAULT_STAGING_STOREFRONT_URL).replace(/\/$/, '');
        return `${stagingBase}/store/${encodeURIComponent(store.subdomain)}`;
    }

    return `https://${store.subdomain}.${PLATFORM_DOMAIN}`;
}

export function getStorefrontUrl(store: StoreModel, path = '/'): string {
    return `${getStorefrontBaseUrl(store)}${cleanPath(path)}`;
}

function absoluteAssetUrl(store: StoreModel, value: string | undefined): string | undefined {
    const absolute = safeUrl(value);
    if (absolute) return absolute;
    if (!value?.startsWith('/')) return undefined;

    try {
        const origin = new URL(getStorefrontBaseUrl(store)).origin;
        return `${origin}${value}`;
    } catch {
        return undefined;
    }
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1).trim()}...`;
}

function textFromSetting(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function getStoreOgImage(store: StoreModel): string | undefined {
    if (store.bannerUrl) return store.bannerUrl;
    if (store.logoUrl) return store.logoUrl;

    for (const section of store.templateConfig.sections || []) {
        const settings = section.settings || {};
        const directImage = textFromSetting(settings.image)
            || textFromSetting(settings.imageUrl)
            || textFromSetting(settings.backgroundImage);
        if (directImage) return directImage;

        const banners = settings.banners;
        if (Array.isArray(banners)) {
            for (const banner of banners) {
                if (banner && typeof banner === 'object') {
                    const bannerImage = textFromSetting((banner as Record<string, unknown>).imageUrl);
                    if (bannerImage) return bannerImage;
                }
            }
        }
    }

    return undefined;
}

export function buildStoreMetadata(
    store: StoreModel,
    options: {
        title?: string;
        description?: string;
        path?: string;
        image?: string;
        noIndex?: boolean;
    } = {},
): Metadata {
    const title = options.title || store.seoTitle || store.name;
    const description = truncate(
        options.description || store.seoDescription || store.tagline || `Shop ${store.name} on LetBuyy.`,
        160,
    );
    const canonical = getStorefrontUrl(store, options.path || '/');
    const image = absoluteAssetUrl(store, options.image || getStoreOgImage(store));

    return {
        title,
        description,
        alternates: {
            canonical,
        },
        openGraph: {
            type: 'website',
            title,
            description,
            url: canonical,
            siteName: store.name,
            images: image ? [{ url: image }] : undefined,
        },
        twitter: {
            card: image ? 'summary_large_image' : 'summary',
            title,
            description,
            images: image ? [image] : undefined,
        },
        robots: options.noIndex ? { index: false, follow: false } : undefined,
    };
}

export function buildProductJsonLd(store: StoreModel, product: ProductModel) {
    const productUrl = getStorefrontUrl(store, `/product/${product.id}`);
    const image = product.images
        .map((entry) => absoluteAssetUrl(store, entry))
        .filter((entry): entry is string => Boolean(entry));

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: image.length > 0 ? image : undefined,
        sku: product.id,
        brand: {
            '@type': 'Brand',
            name: store.name,
        },
        offers: {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: product.currency || 'INR',
            price: product.price,
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
        },
    };
}
