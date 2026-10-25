/** Trusted, read-only catalog adapters. No tenant, session, provider or gateway access. */
import { STOREFRONT_DISCOVERY_FILTER_KEYS } from '@letbuyy/commerce-core';
import { discoveryRouteQuery } from './discovery-route-query';
import { StorefrontDiscoveryUnsupportedError } from './storefront-discovery';
import { loadThemeServerDom } from '@letbuyy/theme-engine/server-dom';
import { catalogDemoNavigationTarget } from '../demo/catalog-demo-route';
import { isTrustedCatalogDemoContent, resolveCatalogDemoCollection, type CatalogDemoContent } from '../demo/catalog-demo-dispatch';
import type { StorefrontRouteContext } from './types';

export function assertCatalogDemoContext(content: CatalogDemoContent): void {
    if (!isTrustedCatalogDemoContent(content)) throw new Error('Catalog sample context must come from the validated server dispatcher.');
}
export function catalogDemoStoreId(content: CatalogDemoContent) { assertCatalogDemoContext(content); return `catalog-demo:${content.slug}:${content.version}`; }
export function catalogDemoSubdomain(content: CatalogDemoContent) { assertCatalogDemoContext(content); return `catalog-demo-${content.slug}`; }
export function catalogDemoRoute(content: CatalogDemoContent): StorefrontRouteContext {
    assertCatalogDemoContext(content);
    const route = { ...content.route, subdomain: catalogDemoSubdomain(content) };
    if (route.type === 'product' && !content.products.some(product => product.id === route.resourceId)) return { ...route, type: 'not_found' };
    if (route.type === 'collection' && route.resourceSlug !== 'all' && !content.collections.some(collection => collection.id === route.resourceSlug || ('handle' in collection && collection.handle === route.resourceSlug))) return { ...route, type: 'not_found' };
    if (['page','policy','article'].includes(route.type) && !catalogDemoPage(content, route)) return { ...route, type: 'not_found' };
    return route;
}
export function assertCatalogDemoScope(content: CatalogDemoContent, storeId: string, route: StorefrontRouteContext): void {
    assertCatalogDemoContext(content);
    const expected = catalogDemoRoute(content);
    if (storeId !== catalogDemoStoreId(content) || route.subdomain !== expected.subdomain || route.type !== expected.type || route.path !== expected.path || route.resourceId !== expected.resourceId || route.resourceSlug !== expected.resourceSlug || JSON.stringify(route.searchParams || {}) !== JSON.stringify(expected.searchParams || {}) || JSON.stringify(route.discoveryQuery || null) !== JSON.stringify(expected.discoveryQuery || null)) throw new Error('Catalog sample context does not match this render scope.');
}
export function selectCatalogDemoProducts(content: CatalogDemoContent, route = catalogDemoRoute(content)) {
    assertCatalogDemoContext(content);
    const query = discoveryRouteQuery(route.discoveryQuery ?? route.searchParams);
    // This read-only fixture adapter supports its existing local operations only. It never
    // impersonates the Gateway's niche matcher or silently ignores an unsupported selection.
    const supported = new Set(['category','collection_id','size','color','min_price','max_price']);
    if (STOREFRONT_DISCOVERY_FILTER_KEYS.some(key => query[key] !== undefined && !supported.has(key))) throw new StorefrontDiscoveryUnsupportedError();
    const parsed = { data: query };
    let products = content.products;
    let collection: CatalogDemoContent['collections'][number] | undefined;
    if (route.type === 'collection' && route.resourceSlug !== 'all') {
        collection = content.collections.find(item => item.id === route.resourceSlug || ('handle' in item && item.handle === route.resourceSlug));
        const members = resolveCatalogDemoCollection(content, route.resourceSlug || '');
        if (!members) throw new Error('This sample collection is not ready. Explore all sample products instead.');
        products = members;
    }
    if (query.collection_id) {
        const members = resolveCatalogDemoCollection(content, query.collection_id);
        if (!members) throw new Error('This sample collection is not ready. Explore all sample products instead.');
        const ids = new Set(members.map(item => item.id)); products = products.filter(item => ids.has(item.id));
    }
    const search = (query.search || '').trim().toLocaleLowerCase('en');
    products = products.filter(product => (!search || `${product.name} ${product.description} ${product.category || ''}`.toLocaleLowerCase('en').includes(search))
        && (!query.category || product.category?.toLocaleLowerCase('en') === query.category.toLocaleLowerCase('en'))
        && (parsed.data.min_price === undefined || product.price >= parsed.data.min_price)
        && (parsed.data.max_price === undefined || product.price <= parsed.data.max_price)
        && (!parsed.data.color || product.variantOptions?.some(option => option.name.toLowerCase() === 'color' && option.values.includes(parsed.data.color!)))
        && (!parsed.data.size || product.variantOptions?.some(option => option.name.toLowerCase() === 'size' && option.values.includes(parsed.data.size!))));
    const sort = parsed.data.sort;
    products = [...products];
    if (sort === 'price-asc') products.sort((a,b) => a.price-b.price);
    if (sort === 'price-desc') products.sort((a,b) => b.price-a.price);
    if (sort === 'name') products.sort((a,b) => a.name.localeCompare(b.name));
    // No invented timestamps: 'newest' retains the explicit fixture order.
    const total = products.length, page = parsed.data.page, limit = Math.min(parsed.data.limit, 100);
    return { products: products.slice((page-1)*limit,page*limit), collection, pagination: { total, page, limit, has_more: page*limit < total } };
}
export function catalogDemoPage(content: CatalogDemoContent, route = catalogDemoRoute(content)): Record<string, unknown> | null {
    assertCatalogDemoContext(content);
    const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    const name = escape(content.name);
    const policies: Record<string, {title:string;body:string}> = {
        privacy: { title: 'Sample privacy policy', body: 'This is a fictional sample store. Forms and account actions are disabled. No customer account, message or order is created by this preview.' },
        shipping: { title: 'Sample shipping information', body: 'These demonstration products are not for sale. Shipping rates and delivery dates are unavailable in this sample store. Real merchants supply their own shipping terms.' },
        returns: { title: 'Sample returns information', body: 'These products are demonstration records. No purchase, return or refund can be requested here. A real store must publish its own applicable return terms.' },
        terms: { title: 'Sample store terms', body: 'This storefront demonstrates a theme using fictional merchandise. Browsing does not place an order or reserve a product. Review the merchant’s terms in a real store.' },
    };
    const slug = route.resourceSlug || '';
    const policyKey = slug.replace(/-policy$/, '').replace('refund','returns').replace('terms-of-service','terms');
    if (route.type === 'policy' && policies[policyKey]) return { title: policies[policyKey].title, body_html: `<p>${policies[policyKey].body}</p>`, slug, policy_type: policyKey };
    if (route.type === 'page' && ['about','about-us'].includes(slug)) return { title: `About ${content.name}`, body_html: `<p>${name} is a fictional shop created to demonstrate this theme. Explore the sample products and their supplied details.</p><p>Your own products, photography and story make the design yours. Adding the theme does not import this merchandise or this sample content.</p>`, slug };
    if (route.type === 'blog') return { _blog: { title: `${content.name} sample journal`, articles: [{ id: 'sample-product-details', title: 'A closer look at the details', slug: 'product-details', excerpt: 'Explore the information supplied with these fictional products.', url: '/blog/product-details' }], current_page: 1, pages_count: 1 } };
    if (route.type === 'article' && slug === 'product-details') return { title: 'A closer look at the details', slug, body_html: `<p>The products in ${name} are fictional. Their photographs, options and descriptions illustrate how a merchant can present useful information.</p><p>Compare the supplied details on each product page. Missing facts remain unavailable. No size, compatibility, safety or delivery promise is inferred by this sample store.</p><p><a href="/products">Explore the sample products</a></p>` };
    return null;
}
export const CATALOG_DEMO_POLICIES = ['privacy','shipping','returns','terms'];

/** Strip automatic custom-element activation, disable mutations and scope links before hydration. */
export async function catalogDemoReadOnlyHtml(html: string, content: CatalogDemoContent): Promise<string> {
    assertCatalogDemoContext(content);
    const { JSDOM } = await loadThemeServerDom();
    const dom = new JSDOM(`<body>${html}</body>`);
    const { document } = dom.window;
    for (const element of document.querySelectorAll('*')) if (element.tagName.toLowerCase().startsWith('lb-')) {
        const inert = document.createElement('div');
        for (const attribute of element.attributes) inert.setAttribute(attribute.name,attribute.value);
        inert.setAttribute('data-catalog-demo-inert',element.tagName.toLowerCase());
        inert.append(...element.childNodes); element.replaceWith(inert);
    }
    for (const control of document.querySelectorAll('button,input,select,textarea')) { control.setAttribute('disabled',''); control.setAttribute('aria-disabled','true'); control.setAttribute('title','Sample shopping and form controls are unavailable in this preview.'); }
    for (const form of document.querySelectorAll('form')) { form.removeAttribute('action'); form.setAttribute('inert',''); }
    for (const anchor of document.querySelectorAll('a[href]')) {
        const href = anchor.getAttribute('href') || '';
        if (href.startsWith('#')) continue;
        const target = catalogDemoNavigationTarget(href,'https://catalog-demo.invalid',content.slug,content.version);
        if (target) anchor.setAttribute('href',target);
        else { anchor.setAttribute('href','#demo-link-unavailable'); anchor.setAttribute('data-catalog-blocked-href',href); }
    }
    const output = document.body.innerHTML; (dom.window as unknown as { close(): void }).close(); return output;
}
