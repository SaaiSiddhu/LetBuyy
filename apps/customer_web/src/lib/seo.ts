import type { Metadata } from 'next';
import type { ProductModel } from '@letbuyy/commerce-core';
import { normalizeStoreRootDomain, resolveStorefrontHost } from '@letbuyy/tenant-core';
import type { StoreModel } from '@letbuyy/tenant-core';

const DEFAULT_LOCAL_STOREFRONT_URL = 'http://localhost:3003';

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
    const resolved = resolveStorefrontHost(host, process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
    return resolved.kind === 'subdomain' ? resolved.subdomain : null;
}

export function getStorefrontBaseUrl(store: StoreModel): string {
    const customDomain = store.customDomainStatus === 'active'
        ? absoluteDomainUrl(store.storeUrl)
        : undefined;
    if (customDomain) return customDomain.replace(/\/$/, '');

    if (process.env.NODE_ENV !== 'production') {
        const localBase = (process.env.NEXT_PUBLIC_STOREFRONT_URL || DEFAULT_LOCAL_STOREFRONT_URL).replace(/\/$/, '');
        return `${localBase}/store/${encodeURIComponent(store.subdomain)}`;
    }

    const storeRootDomain = normalizeStoreRootDomain(process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
    return `https://${store.subdomain}.${storeRootDomain}`;
}

export function getStorefrontUrl(store: StoreModel, path = '/'): string {
    return `${getStorefrontBaseUrl(store)}${cleanPath(path)}`;
}

export function isStorefrontIndexable(store: StoreModel): boolean {
    return store.status === 'published'
        && store.published !== false
        && (store.accessMode || 'public') === 'public';
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
        robots: (options.noIndex || !isStorefrontIndexable(store)) ? { index: false, follow: false } : undefined,
    };
}

function priceValidUntil(monthsAhead = 12): string {
    const date = new Date();
    date.setMonth(date.getMonth() + monthsAhead);
    return date.toISOString().split('T')[0];
}

export function buildProductJsonLd(store: StoreModel, product: ProductModel) {
    const productUrl = getStorefrontUrl(store, `/product/${product.id}`);
    const storeUrl = getStorefrontBaseUrl(store);
    const image = product.images
        .map((entry) => absoluteAssetUrl(store, entry))
        .filter((entry): entry is string => Boolean(entry));

    const offer: Record<string, unknown> = {
        '@type': 'Offer',
        url: productUrl,
        priceCurrency: product.currency || 'INR',
        price: product.price,
        priceValidUntil: priceValidUntil(),
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
            '@type': 'Organization',
            name: store.name,
            url: storeUrl,
        },
    };

    const node: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: image.length > 0 ? image : undefined,
        sku: product.id,
        category: product.category,
        brand: {
            '@type': 'Brand',
            name: store.name,
        },
        offers: offer,
    };

    // Only emit ratings when the merchant actually has them — fabricated review
    // markup is a manual-action risk and gets the whole site demoted.
    if (typeof product.rating === 'number' && product.rating > 0 && typeof product.reviewCount === 'number' && product.reviewCount > 0) {
        node.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: Number(product.rating.toFixed(1)),
            reviewCount: product.reviewCount,
            bestRating: 5,
            worstRating: 1,
        };
    }

    return node;
}

/**
 * Store-level node that establishes each merchant storefront as its own brand
 * entity, distinct from the LetBuyy platform. `store` site type maps to
 * schema.org OnlineStore; other site types fall back to Organization.
 */
export function buildStoreJsonLd(store: StoreModel) {
    const url = getStorefrontBaseUrl(store);
    const logo = absoluteAssetUrl(store, store.logoUrl);

    const node: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': store.siteType === 'store' ? 'OnlineStore' : 'Organization',
        '@id': `${url}/#store`,
        name: store.name,
        url,
        description: store.seoDescription || store.tagline || `Shop ${store.name} on LetBuyy.`,
    };

    if (logo) {
        node.logo = logo;
        node.image = logo;
    }

    return node;
}

/** BreadcrumbList for a storefront path. Pass ordered crumbs from home -> leaf. */
export function buildBreadcrumbJsonLd(store: StoreModel, crumbs: Array<{ name: string; path: string }>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            item: getStorefrontUrl(store, crumb.path),
        })),
    };
}
