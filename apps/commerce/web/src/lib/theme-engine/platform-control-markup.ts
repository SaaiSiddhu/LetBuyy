import type { StorefrontCollectionPage } from '@letbuyy/api-client';
import { clearStorefrontDiscoveryFilterUrl } from '@letbuyy/commerce-core';
import { routeDiscoveryQuery } from './storefront-discovery';
import type { StorefrontRouteContext } from './types';

// Only platform-owned controls enter these slots. Every dynamic attribute is escaped;
// destinations must remain on this origin. Theme fragments keep their existing sanitizer.
export function escapeControlAttribute(value: string): string {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}
function localPath(value: string): string {
    const path = value.split('?')[0];
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x20]/.test(path)) throw new Error('Platform control requires a local path');
    return path;
}
export function productOriginFilterMarkup(route: StorefrontRouteContext, editorMode = false): string {
    if (editorMode || (route.type !== 'collection' && route.type !== 'search')) return '';
    const pathname = localPath(route.path || '/');
    const query = routeDiscoveryQuery(route);
    const origin = query.country_of_origin ?? '';
    const clearHref = clearStorefrontDiscoveryFilterUrl(pathname, query, 'country_of_origin');
    const preserved = [...new URLSearchParams(clearHref.split('?')[1])];
    const escape = escapeControlAttribute;
    return `<section class="lb-collection-filter" aria-label="Filter products by country of origin"><form class="lb-collection-filter__form" method="get" action="${escape(pathname)}">${preserved.map(([name, value]) => `<input type="hidden" name="${name}" value="${escape(value)}"/>`).join('')}<label class="lb-collection-filter__label" for="lb-product-origin-filter">Country of origin</label><input id="lb-product-origin-filter" class="lb-collection-filter__input" name="country_of_origin" type="text" autocomplete="off" maxlength="100" value="${escape(origin)}" placeholder="Enter a country"/><button class="lb-collection-filter__submit" type="submit">Apply filter</button>${origin ? `<a class="lb-collection-filter__clear" href="${escape(clearHref)}">Clear origin filter</a>` : ''}</form></section>`;
}
export function collectionPaginationMarkup(page: StorefrontCollectionPage, basePath: string): string {
    if (!page.nextCursor && !page.previousCursor) return '';
    const path = localPath(basePath), escape = escapeControlAttribute;
    const link = (href: string, text: string) => `<a href="${escape(href)}">${text}</a>`;
    return `<nav class="lb-collection-pagination" aria-label="Collection pages">${page.previousCursor ? link(`${path}?before=${encodeURIComponent(page.previousCursor)}`, 'Previous collections') + link(path, 'First collections') : ''}${page.nextCursor ? link(`${path}?after=${encodeURIComponent(page.nextCursor)}`, 'Next collections') : ''}</nav>`;
}
