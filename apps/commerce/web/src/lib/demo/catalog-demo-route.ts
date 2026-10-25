import type { StorefrontRouteContext } from '../theme-engine/types';
import { STOREFRONT_DISCOVERY_QUERY_KEYS, StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, type StorefrontDiscoveryQuery } from '@letbuyy/commerce-core';

export type CatalogDemoRoute = Pick<StorefrontRouteContext, 'type' | 'resourceId' | 'resourceSlug' | 'searchParams'> & {
    path: string;
    simulation?: 'checkout' | 'account';
    /** Canonical typed query retains list filters without widening the live route contract. */
    discoveryQuery?: StorefrontDiscoveryQuery;
};
// Authority from an observed storefront URL never selects a private demo scope.
const privateAuthorityKeys = ['subdomain', 'site_id', 'store_id', 'theme_preview_token', 'preview_token', 'token',
    'theme_instance_id', 'theme_package_id', 'theme_package_version_id', 'theme_preview_session_id'];
const queryAliases: Record<string, string> = { q: 'search', sort_by: 'sort', price_min: 'min_price', price_max: 'max_price' };
const sortAliases: Record<string, string> = { 'price-ascending': 'price-asc', 'price-descending': 'price-desc',
    'created-descending': 'newest', 'title-ascending': 'name', manual: 'display_order' };
const safeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeResource = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;
const invalid = (): CatalogDemoRoute => ({ type: 'not_found', path: '/404', searchParams: {} });

/** Presentation-only route resolution. It cannot select a tenant, session or private draft. */
export function resolveCatalogDemoRoute(input = '/'): CatalogDemoRoute {
    if (!input.startsWith('/') || input.startsWith('//') || input.length > 2400 || /[\\\u0000-\u001f\u007f]/.test(input)) return invalid();
    let url: URL;
    try { url = new URL(input, 'https://catalog-demo.invalid'); } catch { return invalid(); }
    if (url.origin !== 'https://catalog-demo.invalid') return invalid();
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const entries: Array<[string, string]> = [];
    for (const [key, value] of url.searchParams) {
        if (privateAuthorityKeys.includes(key) || key === 'variant') continue;
        const canonical = Object.hasOwn(queryAliases, key) ? queryAliases[key] : key;
        entries.push([canonical, canonical === 'sort' && Object.hasOwn(sortAliases, value) ? sortAliases[value] : value]);
    }
    const raw = storefrontDiscoveryQueryFromEntries(entries);
    const discovery = StorefrontDiscoveryQuerySchema.safeParse(raw);
    if (!discovery.success) return invalid();
    const params = new URLSearchParams(), searchParams: Record<string, string> = {};
    for (const key of STOREFRONT_DISCOVERY_QUERY_KEYS) {
        const value = discovery.data[key];
        if (!Object.hasOwn(raw, key) || value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
        // Compatibility view is scalar only; list filters are never flattened.
        if (!Array.isArray(value)) searchParams[key] = String(value);
    }
    const variants = url.searchParams.getAll('variant');
    if (variants.length > 1 || variants.some(value => !safeResource.test(value))) return invalid();
    if (variants.length) { params.set('variant', variants[0]); searchParams.variant = variants[0]; }
    let parts: string[];
    try { parts = path.split('/').filter(Boolean).map(decodeURIComponent); } catch { return invalid(); }
    if (parts.some(part => !safeResource.test(part))) return invalid();
    const context = { path: path + (params.size ? `?${params}` : '') + url.hash, searchParams, discoveryQuery: discovery.data };
    if (!parts.length) return { ...context, type: 'index' };
    if (['product', 'products'].includes(parts[0]) && parts.length === 2) return { ...context, type: 'product', resourceId: parts[1] };
    if (['products', 'shop'].includes(parts[0]) && parts.length === 1) return { ...context, type: searchParams.search ? 'search' : 'collection', resourceSlug: 'all' };
    if (parts[0] === 'collections' && parts.length === 1) return { ...context, type: 'list_collections' };
    if (parts[0] === 'collections' && parts.length === 2) return { ...context, type: 'collection', resourceSlug: parts[1] };
    if (['pages', 'policies'].includes(parts[0]) && parts.length === 2) return { ...context, type: parts[0] === 'policies' ? 'policy' : 'page', resourceSlug: parts[1] };
    if (parts[0] === 'blog' && parts.length <= 2) return { ...context, type: parts.length === 1 ? 'blog' : 'article', ...(parts[1] ? { resourceSlug: parts[1] } : {}) };
    if (parts[0] === 'blogs' && parts.length >= 2 && parts.length <= 3) return { ...context, type: parts.length === 2 ? 'blog' : 'article', resourceSlug: parts.at(-1) };
    if (parts[0] === 'search' && parts.length === 1) return { ...context, type: 'search' };
    if (parts[0] === 'cart' && parts.length === 1) return { ...context, type: 'cart' };
    if (['privacy','shipping','returns','terms'].includes(parts[0]) && parts.length === 1) return { ...context, type: 'policy', resourceSlug: parts[0] };
    if (parts[0] === 'about' && parts.length === 1) return { ...context, type: 'page', resourceSlug: 'about' };
    if (parts[0] === 'contact' && parts.length === 1) return { ...context, type: 'contact' };
    if (parts[0] === 'checkout') return { ...context, type: 'cart', simulation: 'checkout' };
    if (['account', 'customers', 'login', 'register', 'wishlist'].includes(parts[0])) return { ...context, type: 'customer_account', simulation: 'account' };
    return invalid();
}

export function catalogDemoHref(slug: string, path: string, version?: string) {
    if (!safeSlug.test(slug) || slug.length > 120) throw new Error('Invalid catalog theme');
    const route = resolveCatalogDemoRoute(path);
    const query = new URLSearchParams({ embedded: '1', demo_path: route.path });
    if (version) query.set('version', version);
    return `/theme-preview/${encodeURIComponent(slug)}?${query}`;
}

/** Only routes from the observed same-origin storefront are translated into this demo. */
export function catalogDemoNavigationTarget(href: string, currentOrigin: string, slug: string, version?: string): string | null {
    if (!href || href.startsWith('#') || href.length > 2400 || /[\\\u0000-\u001f\u007f]/.test(href)) return null;
    let url: URL;
    try { url = new URL(href, currentOrigin); } catch { return null; }
    if (url.origin !== currentOrigin || url.username || url.password) return null;
    const prefix = url.pathname.match(/^\/store\/[^/]+(?=\/|$)/)?.[0] || '';
    if (url.pathname.startsWith('/theme-preview/')) {
        if (url.pathname !== `/theme-preview/${slug}`) return null;
        return catalogDemoHref(slug, url.searchParams.get('demo_path') || '/', version);
    }
    return catalogDemoHref(slug, (url.pathname.slice(prefix.length) || '/') + url.search + url.hash, version);
}

export const CATALOG_DEMO_ROUTE_MESSAGE = 'letbuyy:catalog-demo:route';
export function isCatalogDemoRouteMessage(value: unknown, slug: string): value is { type: typeof CATALOG_DEMO_ROUTE_MESSAGE; slug: string; path: string } {
    if (!value || typeof value !== 'object') return false;
    const data = value as Record<string, unknown>;
    return data.type === CATALOG_DEMO_ROUTE_MESSAGE && data.slug === slug && typeof data.path === 'string'
        && data.path.length <= 2400 && resolveCatalogDemoRoute(data.path).path === data.path;
}
