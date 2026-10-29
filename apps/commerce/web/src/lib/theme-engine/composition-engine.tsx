import { storefrontDiscoveryUrl } from '@letbuyy/commerce-core';
import type { CatalogDemoContent } from '../demo/catalog-demo-dispatch';
import { assertCatalogDemoScope, catalogDemoReadOnlyHtml, selectCatalogDemoProducts, CATALOG_DEMO_POLICIES } from './catalog-demo-data';
import { productToLiquidDrop } from './product-liquid-drop';
import { headers } from 'next/headers';
import type { StorefrontCollectionSummary } from '@letbuyy/api-client';
import { loadCollectionDiscovery } from './collection-discovery';
import { findDiscoveryPage, routeDiscoveryQuery, projectDiscoveryPage, productDiscoveryWitness, hasDiscoveryFilters } from './storefront-discovery';
import {
    normalizeAppBlockInstances,
    type AppBlockInstance,
} from '@letbuyy/shared-types';
import { resolveStorefrontHost, type StoreModel } from '@letbuyy/tenant-core';
import type { NavPage, StoreNavigation } from '@letbuyy/tenant-core';
import {
    createThemeRenderer,
    type LiquidAppBlockRenderSource,
    type LiquidAppEmbeds,
    type LiquidCommerceDrops,
} from '@letbuyy/theme-engine';
import { assembleLiquidPageFromRenderResult } from './liquid-page-assembly';
import { liquidRenderFailureDiagnostics } from './liquid-render-diagnostics';
import { productOriginFilterMarkup } from './platform-control-markup';
import type { ProductReviewItem, SectionRenderData, StorefrontRenderPlan } from './types';
import EditorPreviewSectionFrame from './editor-preview-section-frame';
import LiquidHydrationIslands from './liquid-hydration-islands';
import { renderRegisteredSection } from './renderer-registry';
import {
    getStorefrontCustomerDrop,
    type LiquidCustomerDrop,
    type LiquidCustomerOrderDetail,
} from '@/lib/customer-drop';
import { getStorefrontBuyerAccountDrop, getStorefrontBuyerOrderDrop, getStorefrontBuyerWishlistDrop, type LiquidBuyerDrop, type LiquidBuyerWishlistDrop } from '@/lib/buyer-order-drop';
import { ProductService } from '@/lib/product-service';
import { ContentService } from '@/lib/content-service';
import { StorefrontProductOriginFilter } from './product-origin-filter';

function RenderSectionList({
    store,
    plan,
    sections,
    sectionData,
    editorMode = false,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sections: StorefrontRenderPlan['template']['sections'];
    sectionData: Map<string, SectionRenderData>;
    editorMode?: boolean;
}) {
    const basePath = `/store/${plan.route.subdomain}`;

    return (
        <>
            {sections.map((section) => {
                const rendererKey = section.rendererKey || section.type;
                const renderedSection = renderRegisteredSection({
                    store,
                    section,
                    theme: plan.themeSettings,
                    data: sectionData.get(section.id) || {},
                    route: plan.route,
                    basePath,
                });

                if (editorMode) {
                    return (
                        <EditorPreviewSectionFrame
                            key={section.id}
                            sectionId={section.id}
                            sectionType={section.type}
                            rendererKey={rendererKey}
                        >
                            {renderedSection}
                        </EditorPreviewSectionFrame>
                    );
                }

                return (
                    <div key={section.id} data-section-id={section.id} data-renderer-key={rendererKey}>
                        {renderedSection}
                    </div>
                );
            })}
        </>
    );
}

function LiquidRenderedHtml({
    html,
    headStyleText,
    editorMode,
    basePath,
    storeId,
    variantProductIds,
    interactive = true,
}: {
    html: string;
    headStyleText?: string;
    editorMode: boolean;
    basePath: string;
    storeId: string;
    variantProductIds: string[];
    interactive?: boolean;
}) {
    return (
        <>
            {/* T2a-fix/W2/CAP-C19 — headStyleText is already sanitized CSS TEXT (theme-renderer.ts's
                sanitizeLiquidHeadStyleText), never raw/unsanitized input. Rendered as a real <style>
                element with a plain string child (not dangerouslySetInnerHTML) so React's own text
                escaping is the last line of defense, on top of the DOMPurify pass already applied.
                `precedence` is REQUIRED (not decorative) for React 19's <style> hoisting: without
                it, <style> renders as an ordinary in-place DOM node — verified empirically (a first
                attempt without `precedence` rendered two duplicate <style> tags inline in <body>,
                never hoisted). With `precedence` set, React treats it as a Resource, hoists it into
                <head>, and dedupes by content across the two renders this layout can trigger — this
                is what makes the theme's own :root tokens + base stylesheet reach the document head,
                which the previous header+contentForLayout+footer concatenation could never do. */}
            {headStyleText ? (
                <style data-theme-renderer="liquid" precedence="lb-liquid-theme" href="lb-liquid-theme-head-assets">
                    {headStyleText}
                </style>
            ) : null}
            <div
                data-theme-renderer="liquid"
                data-editor-mode={editorMode ? 'true' : 'false'}
                data-base-path={basePath}
                dangerouslySetInnerHTML={{ __html: html }}
            />
            {interactive && <LiquidHydrationIslands basePath={basePath} storeId={storeId} variantProductIds={variantProductIds} />}
        </>
    );
}

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderLiquidAppBlockHtml(block: AppBlockInstance): string {
    const appId = escapeHtml(block.app_id);
    const extensionId = escapeHtml(block.extension_id);
    const slot = escapeHtml(block.slot);
    const title = escapeHtml(block.title);

    if (block.render_mode === 'iframe' && block.iframe_url) {
        return [
            `<div data-app-block-slot="${slot}" data-app-block-app-id="${appId}" data-app-block-extension-id="${extensionId}" class="lb-app-block lb-app-block--iframe">`,
            `<iframe src="${escapeHtml(block.iframe_url)}" title="${title}" sandbox="allow-forms allow-popups allow-scripts allow-same-origin" loading="lazy"></iframe>`,
            '</div>',
        ].join('');
    }

    const heading = escapeHtml(block.content.heading || block.title);
    const body = escapeHtml(block.content.body || '');
    const ctaLabel = escapeHtml(block.content.cta_label || '');
    const ctaHref = escapeHtml(block.content.cta_href || '');

    return [
        `<article data-app-block-slot="${slot}" data-app-block-app-id="${appId}" data-app-block-extension-id="${extensionId}" class="lb-app-block lb-app-block--inline">`,
        `<p class="lb-app-block__eyebrow">${title}</p>`,
        `<h3 class="lb-app-block__heading">${heading}</h3>`,
        body ? `<p class="lb-app-block__body">${body}</p>` : '',
        ctaLabel && ctaHref ? `<a class="lb-app-block__cta" href="${ctaHref}">${ctaLabel}</a>` : '',
        '</article>',
    ].join('');
}

function buildLiquidAppBlocks(input: unknown): Record<string, LiquidAppBlockRenderSource> {
    const blocks = normalizeAppBlockInstances(input);
    const entries: Array<[string, LiquidAppBlockRenderSource]> = [];

    for (const block of blocks) {
        const source = {
            html: renderLiquidAppBlockHtml(block),
            settings: {
                id: block.id,
                app_id: block.app_id,
                extension_id: block.extension_id,
                slot: block.slot,
                render_mode: block.render_mode,
                ...block.settings,
            },
        };

        entries.push(
            [block.id, source],
            [block.extension_id, source],
            [block.slot, source],
            [`app:${block.extension_id}`, source],
        );
    }

    return Object.fromEntries(entries);
}

const LIQUID_HEADER_EMBED_SLOTS = new Set([
    'content_for_header',
    'theme.head',
    'theme.header',
    'storefront.head',
    'storefront_embed.header',
]);
const LIQUID_FOOTER_EMBED_SLOTS = new Set([
    'content_for_footer',
    'theme.footer',
    'storefront.footer',
    'storefront_embed.footer',
]);

function normalizeEmbedSlot(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function liquidEmbedPlacement(block: AppBlockInstance): 'header' | 'footer' | null {
    const candidates = [
        block.slot,
        block.settings.slot,
        block.settings.placement,
        block.settings.target,
        block.settings.inject_to,
        block.settings.injection_point,
    ].map(normalizeEmbedSlot);

    if (candidates.some((slot) => LIQUID_HEADER_EMBED_SLOTS.has(slot))) return 'header';
    if (candidates.some((slot) => LIQUID_FOOTER_EMBED_SLOTS.has(slot))) return 'footer';

    return null;
}

function buildLiquidAppEmbeds(input: unknown): LiquidAppEmbeds {
    const blocks = normalizeAppBlockInstances(input);
    const embeds: Required<LiquidAppEmbeds> = {
        header: [],
        footer: [],
    };

    for (const block of blocks) {
        const placement = liquidEmbedPlacement(block);
        if (!placement) continue;

        embeds[placement].push({
            html: renderLiquidAppBlockHtml(block),
            settings: {
                id: block.id,
                app_id: block.app_id,
                extension_id: block.extension_id,
                slot: block.slot,
                render_mode: block.render_mode,
                ...block.settings,
            },
        });
    }

    return embeds;
}

// Product URLs follow the public request origin; the proxy already owns tenant access.
// Other host modes and editor previews keep their existing /store/<subdomain> compatibility prefix.
async function resolveLiquidProductBasePath(subdomain: string): Promise<string> {
    const requestHeaders = await headers();
    const resolution = resolveStorefrontHost(
        requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'),
        process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
        process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES,
    );
    return resolution.kind === 'subdomain' && resolution.subdomain === subdomain
        ? '' : `/store/${subdomain}`;
}

function collectLiquidProducts(sectionData: Map<string, SectionRenderData>, basePath = ''): Record<string, unknown>[] {
    const products = new Map<string, Record<string, unknown>>();

    for (const data of sectionData.values()) {
        const singleProduct = productToLiquidDrop(data.product, basePath);
        if (singleProduct) products.set(String(singleProduct.id), singleProduct);

        for (const product of data.products || []) {
            const productDrop = productToLiquidDrop(product, basePath);
            if (productDrop) products.set(String(productDrop.id), productDrop);
        }
    }

    return Array.from(products.values());
}

function collectLiquidCart(
    sectionData: Map<string, SectionRenderData>,
    plan: StorefrontRenderPlan,
): Record<string, unknown> {
    for (const data of sectionData.values()) {
        if (data.cart && typeof data.cart === 'object' && !Array.isArray(data.cart)) {
            return data.cart;
        }
    }

    // Server-authoritative: at SSR there is no cart token (the token lives in the browser), so the
    // money totals are genuinely absent here. They are returned as null (never fabricated/estimated)
    // and hydrated client-side by the lb-cart-drawer island straight from the gateway cart response.
    return {
        item_count: null,
        items: [],
        subtotal: null,
        discount_total: null,
        shipping_total: null,
        tax_total: null,
        total: null,
        coupon_codes: [],
        currency: 'INR',
        source: 'browser_hydrated',
        cart_url: `/store/${plan.route.subdomain}/cart`,
        sync_url: `/api/storefront/${plan.route.subdomain}/cart`,
    };
}

function collectLiquidCollectionMeta(
    sectionData: Map<string, SectionRenderData>,
): SectionRenderData['collection'] | null {
    for (const data of sectionData.values()) {
        if (data.collection && typeof data.collection === 'object') return data.collection;
    }
    return null;
}

// D1-B: Build Shopify-convention linklists from StoreNavigation.
// Shopify linklists shape: { [handle]: { handle, title, links: [{ title, url, active, links }] } }
// active is always false at SSR — we don't have the request path at this layer without threading it through.
function navPageToLink(page: NavPage, currentPath?: string): Record<string, unknown> {
    return {
        title: page.label,
        url: page.href,
        // active=false at SSR is honest; computing it requires the current path which is threaded via plan.route.path.
        active: currentPath ? page.href === currentPath : false,
        links: Array.isArray(page.children)
            ? page.children.filter((c) => c.isVisible !== false).map((c) => navPageToLink(c))
            : [],
    };
}

function navToLinklists(
    nav?: StoreNavigation,
    currentPath?: string,
): Record<string, unknown> {
    if (!nav) return {};

    const result: Record<string, unknown> = {};

    // IMPORTANT: underscore keys are required. toLiquidDrop strips any key that does not match
    // /^[a-zA-Z][a-zA-Z0-9_]*$/ — hyphenated keys like 'main-menu' are silently dropped and
    // Liquid templates receive linklists = {}. Use underscore form so keys survive the sanitizer.
    const mainLinks = (nav.main ?? []).filter((p) => p.isVisible !== false).map((p) => navPageToLink(p, currentPath));
    result['main_menu'] = { handle: 'main_menu', title: 'Main Menu', links: mainLinks };

    const footerLinks = (nav.footer ?? []).filter((p) => p.isVisible !== false).map((p) => navPageToLink(p, currentPath));
    result['footer_menu'] = { handle: 'footer_menu', title: 'Footer Menu', links: footerLinks };

    const policyLinks = (nav.policies ?? []).filter((p) => p.isVisible !== false).map((p) => navPageToLink(p, currentPath));
    result['policy_menu'] = { handle: 'policy_menu', title: 'Policy Menu', links: policyLinks };

    return result;
}

function collectLiquidProductReviews(sectionData: Map<string, SectionRenderData>): SectionRenderData['reviews'] | null {
    for (const data of sectionData.values()) {
        if (data.reviews) return data.reviews;
    }
    return null;
}

function reviewToLiquidDrop(review: ProductReviewItem): Record<string, unknown> {
    return {
        id: review.id,
        author: review.author,
        rating: review.rating,
        title: review.title,
        body: review.body,
        images: review.images,
        is_verified: review.isVerified,
        helpful_count: review.helpfulCount,
        created_at: review.createdAt,
    };
}

function legacyDiscoveryPageUrl(plan: StorefrontRenderPlan, path: string, page: number): string {
    if (plan.route.discoveryQuery) return storefrontDiscoveryUrl(path, routeDiscoveryQuery(plan.route), { page });
    const query = new URLSearchParams(plan.route.searchParams);
    query.set('page', String(page));
    return `${path}?${query}`;
}

export async function buildLiquidCommerceContext({
    store,
    plan,
    sectionData,
    customer,
    buyer,
    buyerWishlist,
    buyerUnavailable,
    orderDetail,
    page,
    productBasePath,
    discoveredCollections,
    catalogDemo,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    customer: LiquidCustomerDrop | null;
    buyer?: LiquidBuyerDrop | null;
    buyerWishlist: LiquidBuyerWishlistDrop;
    buyerUnavailable?: boolean;
    orderDetail?: LiquidCustomerOrderDetail | null;
    page?: Record<string, unknown> | null;
    productBasePath?: string;
    discoveredCollections: StorefrontCollectionSummary[];
    catalogDemo?: CatalogDemoContent;
}): Promise<LiquidCommerceDrops> {
    const basePath = productBasePath ?? await resolveLiquidProductBasePath(plan.route.subdomain);
    const listing = plan.route.type === 'collection' || plan.route.type === 'search';
    const discoveryPage = catalogDemo ? undefined : findDiscoveryPage(sectionData);
    const products: Record<string, unknown>[] = catalogDemo && listing
        ? selectCatalogDemoProducts(catalogDemo, plan.route).products.map(product => productToLiquidDrop(product, basePath)).filter((product): product is Record<string, unknown> => Boolean(product))
        : discoveryPage && listing
            ? discoveryPage.data.map(product => ({ ...productToLiquidDrop(product, basePath), ...productDiscoveryWitness(discoveryPage, product.id) }))
            : collectLiquidProducts(sectionData, basePath);
    const product = products[0] || null;
    const reviewData = collectLiquidProductReviews(sectionData);
    if (product && reviewData) {
        product.reviews = reviewData.reviews.map(reviewToLiquidDrop);
        product.rating = reviewData.rating || product.rating || 0;
        product.review_count = reviewData.reviewCount || product.review_count || 0;
    }
    const wishlistSet = new Set(customer?.wishlist ?? (buyerWishlist.linked ? buyerWishlist.productIds : []));
    for (const entry of products) {
        entry.in_wishlist = wishlistSet.has(String(entry.id));
    }
    const boundCollection = collectLiquidCollectionMeta(sectionData);

    const resolvedCollectionMeta = boundCollection;
    const query = discoveryPage?.discovery?.query ?? (listing ? routeDiscoveryQuery(plan.route) : undefined);
    const routePath = plan.route.path.split('?')[0];
    const storePrefix = `/store/${plan.route.subdomain}`;
    const publicPath = basePath === '' && (routePath === storePrefix || routePath.startsWith(storePrefix + '/')) ? routePath.slice(storePrefix.length) || '/' : routePath;
    const projection = discoveryPage && query ? projectDiscoveryPage(discoveryPage, publicPath, query, Boolean(resolvedCollectionMeta)) : null;
    const pageState = Array.from(sectionData.values()).find(data => data.pagination)?.pagination;
    const demoSelection = catalogDemo && listing ? selectCatalogDemoProducts(catalogDemo, plan.route) : null;
    const collection = listing || products.length > 0
        ? {
            id: resolvedCollectionMeta?.id || plan.route.resourceId || plan.route.resourceSlug || 'all-products',
            handle: plan.route.resourceSlug || 'all-products',
            title: resolvedCollectionMeta?.title || (plan.route.type === 'search' ? 'Search products' : !plan.route.resourceSlug || ['all','all-products'].includes(plan.route.resourceSlug) ? 'All Products' : plan.route.resourceSlug),
            description: resolvedCollectionMeta?.description ?? null,
            products,
            ...(projection?.collection ?? {}),
            ...(!projection && pageState ? { total: pageState.total, pagination: {
                page: pageState.page, limit: pageState.limit,
                previous_url: pageState.page > 1 ? legacyDiscoveryPageUrl(plan, publicPath, pageState.page - 1) : null,
                next_url: pageState.has_more ? legacyDiscoveryPageUrl(plan, publicPath, pageState.page + 1) : null,
            } } : {}),
        }
        : null;
    // Search and collection are projections of the SAME loaded page, including real zero/past-end.
    const searchTerm = query?.search ?? plan.route.searchParams?.search ?? '';
    const searchDrop = plan.route.type === 'search' || searchTerm ? {
        terms: searchTerm, results: products,
        ...(discoveryPage ? { results_count: discoveryPage.total } : demoSelection ? { results_count: demoSelection.pagination.total } : pageState ? { results_count: pageState.total } : {}),
        performed: Boolean(searchTerm || query && hasDiscoveryFilters(query)),
    } : null;

    // D1-B: Build Shopify-convention linklists from StoreModel.navigation.
    // active is computed from plan.route.path for the top-level links.
    const linklists = navToLinklists(store.navigation, plan.route.path);

    // E9: Route-type-aware scope drops for blog/article/page templates.
    // - blog route: liquidPage carries _blog sentinel (set by blog/page.tsx) → scope.blog
    // - article route: liquidPage carries article fields from content-resource-renderer → scope.article
    // - page route: liquidPage carries page fields from content-resource-renderer → scope.page
    //   (policy route also uses page scope for policy-content section compat)
    // The 'page' key was already forwarded via ...(page ? { page } : {}). We add article and blog
    // alongside it. All are optional — absence means the template renders its own empty state.
    let blogDrop: Record<string, unknown> | undefined;
    let articleDrop: Record<string, unknown> | undefined;
    let pageDrop: Record<string, unknown> | undefined;

    if (plan.route.type === 'blog' && page?._blog && typeof page._blog === 'object') {
        // E9: blog listing — _blog sentinel from blog/page.tsx
        blogDrop = page._blog as Record<string, unknown>;
    }

    if (plan.route.type === 'article' && page) {
        // E9: article detail — liquidPage from content-resource-renderer carries title/body_html/slug/published_at
        articleDrop = {
            title: page.title ?? null,
            body_html: page.body_html ?? null,
            slug: page.slug ?? null,
            published_at: page.publishedAt ?? page.published_at ?? null,
            // image: not returned by public endpoint author — omit author_name per honesty contract
            image: page.featuredImage ?? page.featured_image ?? null,
        };
    }

    if ((plan.route.type === 'page' || plan.route.type === 'policy') && page) {
        // E9: CMS page/policy — liquidPage from content-resource-renderer
        pageDrop = {
            title: page.title ?? null,
            body_html: page.body_html ?? null,
            slug: page.slug ?? null,
            page_type: page.page_type ?? page.policy_type ?? null,
        };
    }

    // T3-fix W3 — the footer (and any other section) must never link to a policy page that
    // 404s. `storefront_policies` is the actual source `/privacy` /terms /shipping /returns
    // read from (ContentService.getPolicy), so it — not a hardcoded list — decides which links
    // are real. One list call, cached the same 60s window as pages/blog. A fetch failure must
    // not break every page's footer, so it degrades to "no published policies" rather than throwing.
    const publishedPolicyTypes = catalogDemo ? CATALOG_DEMO_POLICIES : await ContentService.listPolicies(plan.route.subdomain)
        .then((policies) => policies.map((policy) => policy.policyType).filter((type): type is string => Boolean(type)))
        .catch(() => []);

    return {
        shop: {
            id: store.id,
            name: store.name,
            subdomain: store.subdomain,
            url: store.storeUrl || `/store/${plan.route.subdomain}`,
            locale: store.locale || 'en',
            currency: 'INR',
            policies: publishedPolicyTypes,
            ...(projection?.shop ?? {}),
            // T5/W1 — store.logoUrl is already resolved (site_settings.logo_url overriding
            // sites.logo_url, see store-service.ts:718) but was never threaded through to Liquid.
            // null (not '') when absent, so `{% if shop.logo_url %}` degrades to the text lockup
            // rather than an empty <img>.
            logo_url: store.logoUrl || null,
        },
        product,
        ...(listing && query ? { request: { path: publicPath, query } } : {}),
        section_products: Object.fromEntries(Array.from(sectionData.entries()).map(([id, data]) => [id, (data.products ?? []).map(p => productToLiquidDrop(p, basePath)).filter((p): p is Record<string, unknown> => p !== null)])),
        collection,
        collections: discoveredCollections.map(item => ({
            id: item.id, handle: catalogDemo && 'handle' in item ? item.handle : item.id, title: item.title, description: item.description, image: item.image_url,
        })),
        cart: catalogDemo ? { items: [], item_count: null, total: null, subtotal: null, currency: 'INR', source: 'catalog_demo_unavailable' } : collectLiquidCart(sectionData, plan),
        customer,
        buyer,
        buyer_wishlist: buyerWishlist,
        buyer_unavailable: buyerUnavailable === true,
        order: orderDetail ?? null,
        search: searchDrop,
        // D1-B: linklists is passed through to buildLiquidScope via LiquidCommerceDrops.
        // LANE-A reads input.liquidContext?.linklists in buildLiquidScope.
        linklists,
        // Legacy: 'page' key was spread directly for policy/page templates before E9.
        // Keep for backwards compat with policy-content section which reads {{ page.title }}.
        ...(page && !pageDrop ? { page } : {}),
        // E9: typed scope drops — only set when route type matches (no fabrication for other routes).
        ...(blogDrop ? { blog: blogDrop } : {}),
        ...(articleDrop ? { article: articleDrop } : {}),
        ...(pageDrop ? { page: pageDrop } : {}),
    } as LiquidCommerceDrops & { linklists: Record<string, unknown> };
}

async function renderLiquidPlan({
    store,
    plan,
    sectionData,
    editorMode,
    liquidPage,
    collectionSummaries,
    afterContentHtml,
    catalogDemo,
    discoveryPreviewToken,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    editorMode: boolean;
    liquidPage?: Record<string, unknown> | null;
    collectionSummaries?: StorefrontCollectionSummary[];
    afterContentHtml?: string;
    catalogDemo?: CatalogDemoContent;
    discoveryPreviewToken?: string;
}): Promise<ReturnType<typeof assembleLiquidPageFromRenderResult> | null> {
    if (plan.rendererEngine !== 'liquid' || !plan.liquidBundle) return null;
    if (catalogDemo) assertCatalogDemoScope(catalogDemo, store.id, plan.route);
    const productBasePath = catalogDemo ? '' : await resolveLiquidProductBasePath(plan.route.subdomain);

    const orderRoute = plan.route.type === 'customer_orders' || plan.route.type === 'customer_order';
    const buyerAccountRoute = plan.route.type === 'customer_account'
        || plan.route.type === 'customer_addresses'
        || plan.route.type === 'customer_settings';
    const buyerWishlistRoute = plan.route.type === 'customer_wishlist'
        || plan.route.type === 'index'
        || plan.route.type === 'product'
        || plan.route.type === 'collection'
        || plan.route.type === 'search';
    // Store-customer identity and LetBuyy buyer identity are separate principals.
    // Canonical orders come only from the verified buyer_order_links surface.
    let customer = catalogDemo || orderRoute ? null : await getStorefrontCustomerDrop(store.id);
    const orderId = plan.route.type === 'customer_order' ? plan.route.path.split('/').filter(Boolean).at(-1) : undefined;
    const buyerOrderView = !catalogDemo && orderRoute ? await getStorefrontBuyerOrderDrop(store.id, orderId, plan.route.searchParams?.cursor) : null;
    const buyerAccountView = !catalogDemo && buyerAccountRoute ? await getStorefrontBuyerAccountDrop(store.id) : null;
    let buyerWishlist = !catalogDemo && buyerWishlistRoute
        ? await getStorefrontBuyerWishlistDrop(store.id)
        : { authenticated: false, buyerId: null, linked: false, unavailable: false, storeAccountUnavailable: false, productIds: [], products: [] };
    const buyer = buyerOrderView?.buyer ?? buyerAccountView?.buyer ?? null;
    if (buyer || buyerWishlist.authenticated) customer = null;
    const buyerUnavailable = buyerOrderView?.unavailable ?? buyerAccountView?.unavailable ?? false;
    const orderDetail = buyerOrderView?.order ?? null;

    // Wishlist products: enrich the customer wishlist IDs into full product drops.
    if (plan.route.type === 'customer_wishlist' && customer && customer.wishlist.length > 0) {
        const enriched = await ProductService.getProductsByIds(customer.wishlist, plan.route.subdomain);
        customer.wishlist_products = enriched.map((p) => productToLiquidDrop(p, productBasePath));
    }
    if (plan.route.type === 'customer_wishlist' && buyerWishlist.linked && buyerWishlist.productIds.length > 0) {
        const enriched = await ProductService.getProductsByIds(buyerWishlist.productIds, plan.route.subdomain);
        buyerWishlist = {
            ...buyerWishlist,
            products: enriched.flatMap((p) => {
                const drop = productToLiquidDrop(p, productBasePath);
                return drop ? [drop] : [];
            }),
        };
    }

    // Read failures are outside the renderer fallback: unavailable discovery must never
    // become a false empty collection grid (or an unrelated legacy React page).
    const needsCollectionDiscovery = plan.template.sections.some(section => section.type === 'category-grid' && section.isVisible !== false);
    const discoveredCollections = catalogDemo ? catalogDemo.collections : needsCollectionDiscovery
        ? collectionSummaries ?? await loadCollectionDiscovery(plan.route.subdomain, discoveryPreviewToken)
        : [];

    const commerceContext = await buildLiquidCommerceContext({ store, plan, sectionData, customer, buyer, buyerWishlist, buyerUnavailable, orderDetail, page: liquidPage, productBasePath, discoveredCollections, catalogDemo });
    const renderer = createThemeRenderer('liquid');
    try {
        const result = await renderer.render({
            context: {
                storeId: store.id,
                subdomain: plan.route.subdomain,
                path: plan.route.path,
                previewMode: editorMode,
                locale: store.locale,
                searchParams: plan.route.searchParams,
            },
            storeTemplate: {
                ...store.templateConfig,
                liquidBundle: plan.liquidBundle,
            },
            routeTemplate: {
                id: plan.liquidTemplateKey || plan.template.id,
                type: plan.template.type,
                layoutKey: plan.template.layoutKey,
                sections: plan.template.sections,
            },
            liquidBundle: plan.liquidBundle,
            liquidTemplateKey: plan.liquidTemplateKey || plan.template.id,
            liquidAppBlocks: catalogDemo ? {} : buildLiquidAppBlocks(store.templateConfig.appBlocks),
            liquidAppEmbeds: catalogDemo ? { header: [], footer: [] } : buildLiquidAppEmbeds(store.templateConfig.appBlocks),
            liquidContext: commerceContext,
        });

        if (result.status !== 'rendered' || !result.liquid) {
            console.warn(JSON.stringify({ event: 'lb:liquid:render-unavailable', ...liquidRenderFailureDiagnostics(result) }));
            return null;
        }

        const assembled = assembleLiquidPageFromRenderResult(result.liquid, { beforeContentHtml: catalogDemo ? '' : productOriginFilterMarkup(plan.route, editorMode), afterContentHtml });
        return catalogDemo ? { ...assembled, html: await catalogDemoReadOnlyHtml(assembled.html, catalogDemo) } : assembled;
    } catch (err: unknown) {
        // Defense-in-depth: renderer should not throw after C1, but guard any unexpected failure
        // (e.g. OOM in LiquidJS, JSDOM init failure). Fall back to React; the lb:canary:render
        // event below will record engine='react'.
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(JSON.stringify({
            event: 'lb:canary:render:fallback',
            reason: errorMessage.slice(0, 200), // truncate to avoid log bloat
            subdomain: plan.route.subdomain,
            template: plan.template.id,
        }));
        return null;
    }
}

// F5 — Chrome-Fallback Seam Fix.
//
// The seam is closed inside StorefrontCompositionEngine: when the plan calls for Liquid
// (rendererEngine==='liquid') but the render fails (liquidHtml===null), the fallback renders
// chrome sections (header/footer from plan.sectionGroups) around the React body sections.
// This ensures a Liquid→React fallback always has a complete page with header and footer.
// LiquidJS 10.27.0 re-entrancy is confirmed safe — see reentrancyVerdict in the Phase F plan.

export default async function StorefrontCompositionEngine({
    store,
    plan,
    sectionData,
    editorMode = false,
    liquidPage,
    collectionSummaries,
    afterContentHtml,
    catalogDemo,
    discoveryPreviewToken,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    editorMode?: boolean;
    liquidPage?: Record<string, unknown> | null;
    collectionSummaries?: StorefrontCollectionSummary[];
    afterContentHtml?: string;
    catalogDemo?: CatalogDemoContent;
    discoveryPreviewToken?: string;
}) {
    const renderStart = Date.now();
    const liquidResult = await renderLiquidPlan({ store, plan, sectionData, editorMode, liquidPage, collectionSummaries, afterContentHtml, catalogDemo, discoveryPreviewToken });
    const engine = liquidResult ? 'liquid' : catalogDemo ? 'unavailable' : 'react';
    // Canary telemetry (Document 6 §4): structured log consumed by monitoring pipeline.
    console.log(JSON.stringify({
        event: 'lb:canary:render',
        engine,
        subdomain: plan.route.subdomain,
        template: plan.template.id,
        route_type: plan.route.type,
        latency_ms: Date.now() - renderStart,
        editor_mode: editorMode,
        // F5 fix: only set fallback_reason when the plan intended Liquid and the renderer returned null.
        // A React plan (rendererEngine !== 'liquid') also yields liquidResult===null, but that is not a
        // fallback — it is the normal React path. Setting fallback_reason on React plans produced
        // misleading monitoring data where every non-Liquid page logged 'renderer_returned_null'.
        fallback_reason: (liquidResult === null && plan.rendererEngine === 'liquid') ? 'renderer_returned_null' : null,
        cache_hit: null, // field present; NOT CONNECTED until per-request render cache is wired
    }));

    if (liquidResult) {
        return (
            <>
                <LiquidRenderedHtml
                    html={liquidResult.html}
                    headStyleText={liquidResult.headStyleText}
                    editorMode={editorMode}
                    interactive={!catalogDemo}
                    basePath={`/store/${plan.route.subdomain}`}
                    storeId={store.id}
                    variantProductIds={Array.from(new Set(Array.from(sectionData.values()).flatMap(data => [...(data.products || []), ...(data.product ? [data.product] : [])]).filter(product => Boolean(product.variants?.length)).map(product => product.id)))}
                />
            </>
        );
    }

    // F5 — Chrome-Fallback Seam Fix.
    //
    // When the plan calls for Liquid (rendererEngine==='liquid') but the render failed (liquidHtml
    // is null), layout.tsx has already suppressed its React chrome because liquidPage was true.
    // To ensure the fallback React page still has a header and footer, composition-engine renders
    // chrome sections from plan.sectionGroups when falling back from a Liquid plan.
    //
    // This is correct because:
    // 1. plan.sectionGroups.header / plan.sectionGroups.footer carry the same sections that
    //    layout.tsx would have rendered for the React chrome path.
    // 2. sectionData here includes the products fetched by the page, which is a superset of what
    //    layout would have provided (layout provides only { products } per header/footer section).
    // 3. StorefrontSectionGroupRenderer already handles empty sectionGroups gracefully (returns null).
    // 4. This path is only reached when the Liquid renderer itself failed — a defense-in-depth path.
    //    Normal React plans (rendererEngine!=='liquid') go through layout's React chrome as before.
    if (catalogDemo) return <section role="status"><h1>The sample store could not render</h1><p>This version is unavailable. Return to the catalog and retry.</p></section>;
    const isLiquidFallback = plan.rendererEngine === 'liquid';

    if (isLiquidFallback) {
        return (
            <>
                <StorefrontSectionGroupRenderer
                    store={store}
                    plan={plan}
                    groupKey="header"
                    sectionData={sectionData}
                    editorMode={editorMode}
                />
                <main className="flex-grow">
                    <StorefrontProductOriginFilter route={plan.route} editorMode={editorMode} />
                    <RenderSectionList
                        store={store}
                        plan={plan}
                        sections={plan.template.sections}
                        sectionData={sectionData}
                        editorMode={editorMode}
                    />
                </main>
                <StorefrontSectionGroupRenderer
                    store={store}
                    plan={plan}
                    groupKey="footer"
                    sectionData={sectionData}
                    editorMode={editorMode}
                />
            </>
        );
    }

    return (
        <>
            <StorefrontProductOriginFilter route={plan.route} editorMode={editorMode} />
            <RenderSectionList
                store={store}
                plan={plan}
                sections={plan.template.sections}
                sectionData={sectionData}
                editorMode={editorMode}
            />
        </>
    );
}

export function StorefrontSectionGroupRenderer({
    store,
    plan,
    groupKey,
    sectionData,
    editorMode = false,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    groupKey: string;
    sectionData: Map<string, SectionRenderData>;
    editorMode?: boolean;
}) {
    const sections = plan.sectionGroups[groupKey] || [];
    if (sections.length === 0) return null;

    return (
        <RenderSectionList
            store={store}
            plan={plan}
            sections={sections}
            sectionData={sectionData}
            editorMode={editorMode}
        />
    );
}
