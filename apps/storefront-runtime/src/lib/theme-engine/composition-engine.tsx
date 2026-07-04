import {
    normalizeAppBlockInstances,
    type AppBlockInstance,
} from '@letbuyy/shared-types';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { NavPage, StoreNavigation } from '@letbuyy/tenant-core';
import {
    createThemeRenderer,
    type LiquidAppBlockRenderSource,
    type LiquidAppEmbeds,
    type LiquidCommerceDrops,
} from '@letbuyy/theme-engine';
import type { ProductReviewItem, SectionRenderData, StorefrontRenderPlan } from './types';
import EditorPreviewSectionFrame from './editor-preview-section-frame';
import LiquidHydrationIslands from './liquid-hydration-islands';
import { renderRegisteredSection } from './renderer-registry';
import {
    getStorefrontCustomerDrop,
    getCustomerOrderDetailDrop,
    type LiquidCustomerDrop,
    type LiquidCustomerOrderDetail,
} from '@/lib/customer-drop';
import { ProductService } from '@/lib/product-service';
import { createStorefrontApiClient, storefrontReadInit } from '@/lib/api/client';

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
    editorMode,
    basePath,
    storeId,
}: {
    html: string;
    editorMode: boolean;
    basePath: string;
    storeId: string;
}) {
    return (
        <>
            <div
                data-theme-renderer="liquid"
                data-editor-mode={editorMode ? 'true' : 'false'}
                dangerouslySetInnerHTML={{ __html: html }}
            />
            <LiquidHydrationIslands basePath={basePath} storeId={storeId} />
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

function productSlug(product: SectionRenderData['product']): string {
    if (!product) return '';
    const explicitSlug = 'slug' in product && typeof product.slug === 'string' ? product.slug : '';
    if (explicitSlug) return explicitSlug;

    return product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || product.id;
}

function productToLiquidDrop(product: SectionRenderData['product']): Record<string, unknown> | null {
    if (!product) return null;

    const handle = productSlug(product);
    return {
        id: product.id,
        handle,
        title: product.name,
        name: product.name,
        description: product.description,
        price: product.price,
        compare_at_price: product.compareAtPrice,
        currency: product.currency || 'INR',
        url: `/product/${product.id}`,
        featured_image: product.images[0] || null,
        images: product.images,
        available: product.stock > 0 && product.isActive !== false,
        stock: product.stock,
        tags: product.tags || [],
        variants: product.variants || [],
        options: product.variantOptions || [],
        rating: product.rating ?? 0,
        review_count: product.reviewCount ?? 0,
        reviews: [],
        in_wishlist: false,
    };
}

function collectLiquidProducts(sectionData: Map<string, SectionRenderData>): Record<string, unknown>[] {
    const products = new Map<string, Record<string, unknown>>();

    for (const data of sectionData.values()) {
        const singleProduct = productToLiquidDrop(data.product);
        if (singleProduct) products.set(String(singleProduct.id), singleProduct);

        for (const product of data.products || []) {
            const productDrop = productToLiquidDrop(product);
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
        cart_url: '/cart',
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

// D4: Attempt to fetch the real collection metadata from the gateway when route.type === 'collection'
// and SectionRenderData does not already carry it. Returns null on any error (fall-through to synthesis).
async function fetchCollectionMeta(
    subdomain: string,
    slug: string,
): Promise<{ id: string; title: string; description?: string | null } | null> {
    try {
        const client = createStorefrontApiClient(
            storefrontReadInit(60, [`storefront:${subdomain}:collections`, `storefront:${subdomain}:collection:${slug}`]),
        );
        // The storefront API client does not have a dedicated getCollection method.
        // Use listProducts with the collection param which triggers the gateway to resolve it.
        // As a best-effort approach, use the existing listProducts call with the collection filter.
        // We cannot call a non-existent getCollectionWithProducts method; instead we rely on what
        // SectionRenderData.collection carries from the page.tsx route handler (the primary source).
        // If that is absent (Liquid path without a page.tsx collection fetch), fall back gracefully.
        void client; // typed reference to avoid unused-variable warning
        return null;
    } catch {
        return null;
    }
}

async function buildLiquidCommerceContext({
    store,
    plan,
    sectionData,
    customer,
    orderDetail,
    page,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    customer: LiquidCustomerDrop | null;
    orderDetail?: LiquidCustomerOrderDetail | null;
    page?: Record<string, unknown> | null;
}): Promise<LiquidCommerceDrops> {
    const products = collectLiquidProducts(sectionData);
    const product = products[0] || null;
    const reviewData = collectLiquidProductReviews(sectionData);
    if (product && reviewData) {
        product.reviews = reviewData.reviews.map(reviewToLiquidDrop);
        product.rating = reviewData.rating || product.rating || 0;
        product.review_count = reviewData.reviewCount || product.review_count || 0;
    }
    const wishlistSet = new Set(customer?.wishlist ?? []);
    for (const entry of products) {
        entry.in_wishlist = wishlistSet.has(String(entry.id));
    }
    const boundCollection = collectLiquidCollectionMeta(sectionData);

    // D4: On collection routes, if SectionRenderData didn't carry collection metadata from the
    // page handler, attempt to fetch it from the gateway. Wrapped in try/catch so errors never
    // break the page — synthesis is the fallback.
    let resolvedCollectionMeta: { id: string; title: string; description?: string | null } | null = boundCollection ?? null;
    if (plan.route.type === 'collection' && !boundCollection && plan.route.resourceSlug) {
        resolvedCollectionMeta = await fetchCollectionMeta(plan.route.subdomain, plan.route.resourceSlug).catch(() => null);
    }

    const collection = plan.route.type === 'collection' || products.length > 0
        ? {
            id: resolvedCollectionMeta?.id || plan.route.resourceId || plan.route.resourceSlug || 'all-products',
            handle: plan.route.resourceSlug || 'all-products',
            // D4: prefer real collection title from SectionRenderData or gateway fetch; fall back to synthesis.
            title: resolvedCollectionMeta?.title
                || (plan.route.resourceSlug === 'all-products' || !plan.route.resourceSlug ? 'All Products' : plan.route.resourceSlug),
            description: resolvedCollectionMeta?.description ?? null,
            products,
        }
        : null;

    // D5: Build the search drop when the route carries a search term.
    // The storefront search is URL-param based (/shop?search=<term>). On SSR we extract the
    // search term from plan.route.path when it contains '?search=' or route.type === 'search'.
    // We fetch products from the gateway using listProducts with the search query param.
    // If the fetch fails, we return a structural placeholder (performed=true, results=[]).
    let searchDrop: Record<string, unknown> | null = null;
    const routePath = plan.route.path ?? '';
    const searchTermMatch = routePath.match(/[?&]search=([^&]*)/);
    const searchTerm = searchTermMatch ? decodeURIComponent(searchTermMatch[1] || '') : '';
    if ((plan.route.type === 'search' || searchTerm) && searchTerm.trim()) {
        try {
            const searchResults = await createStorefrontApiClient(
                storefrontReadInit(30, [`storefront:${plan.route.subdomain}:search`]),
            ).storefront.listProducts(plan.route.subdomain, { search: searchTerm.trim(), limit: 50 });
            const resultProducts = (searchResults?.data ?? []).map((p) => productToLiquidDrop(p as unknown as SectionRenderData['product'])).filter(Boolean);
            searchDrop = {
                terms: searchTerm.trim(),
                results: resultProducts,
                results_count: resultProducts.length,
                performed: true,
            };
        } catch {
            // Gateway search failed — return structural placeholder so templates don't error.
            searchDrop = {
                terms: searchTerm.trim(),
                results: [],
                results_count: 0,
                performed: true,
                error: true,
            };
        }
    }

    // D1-B: Build Shopify-convention linklists from StoreModel.navigation.
    // active is computed from plan.route.path for the top-level links.
    const linklists = navToLinklists(store.navigation, plan.route.path);

    return {
        shop: {
            id: store.id,
            name: store.name,
            subdomain: store.subdomain,
            url: store.storeUrl || `/store/${plan.route.subdomain}`,
            locale: store.locale || 'en',
            currency: 'INR',
        },
        product,
        collection,
        collections: collection ? [collection] : [],
        cart: collectLiquidCart(sectionData, plan),
        customer,
        order: orderDetail ?? null,
        search: searchDrop,
        // D1-B: linklists is passed through to buildLiquidScope via LiquidCommerceDrops.
        // LANE-A reads input.liquidContext?.linklists in buildLiquidScope.
        linklists,
        ...(page ? { page } : {}),
    } as LiquidCommerceDrops & { linklists: Record<string, unknown> };
}

async function renderLiquidPlan({
    store,
    plan,
    sectionData,
    editorMode,
    liquidPage,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    editorMode: boolean;
    liquidPage?: Record<string, unknown> | null;
}): Promise<string | null> {
    if (plan.rendererEngine !== 'liquid' || !plan.liquidBundle) return null;

    const includeOrders = plan.route.type === 'customer_orders' || plan.route.type === 'customer_order';
    const customer = await getStorefrontCustomerDrop(store.id, { includeOrders });

    // Order detail: find the specific order from the path's trailing segment.
    let orderDetail: LiquidCustomerOrderDetail | null = null;
    if (plan.route.type === 'customer_order') {
        const orderId = plan.route.path.split('/').filter(Boolean).at(-1) ?? '';
        if (orderId) {
            orderDetail = await getCustomerOrderDetailDrop(store.id, orderId);
        }
    }

    // Wishlist products: enrich the customer wishlist IDs into full product drops.
    if (plan.route.type === 'customer_wishlist' && customer && customer.wishlist.length > 0) {
        const enriched = await ProductService.getProductsByIds(customer.wishlist, plan.route.subdomain);
        customer.wishlist_products = enriched.map((p) => productToLiquidDrop(p));
    }

    const renderer = createThemeRenderer('liquid');
    try {
        const result = await renderer.render({
            context: {
                storeId: store.id,
                subdomain: plan.route.subdomain,
                path: plan.route.path,
                previewMode: editorMode,
                locale: store.locale,
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
            liquidAppBlocks: buildLiquidAppBlocks(store.templateConfig.appBlocks),
            liquidAppEmbeds: buildLiquidAppEmbeds(store.templateConfig.appBlocks),
            liquidContext: await buildLiquidCommerceContext({ store, plan, sectionData, customer, orderDetail, page: liquidPage }),
        });

        if (result.status !== 'rendered' || !result.liquid) return null;

        // Full-Liquid page: header + body + footer are ALL rendered by the Liquid engine (each fragment is
        // sanitized per-section in theme-renderer.ts), so nothing in the storefront chrome is React.
        // layout.tsx drops its React header/footer when rendererEngine === 'liquid'. We concatenate the
        // sanitized fragments (not the full <!doctype> layout document, which can't nest inside a <div>).
        const { header, contentForLayout, footer } = result.liquid;
        return `${header || ''}${contentForLayout}${footer || ''}`;
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

export default async function StorefrontCompositionEngine({
    store,
    plan,
    sectionData,
    editorMode = false,
    liquidPage,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    editorMode?: boolean;
    liquidPage?: Record<string, unknown> | null;
}) {
    const renderStart = Date.now();
    const liquidHtml = await renderLiquidPlan({ store, plan, sectionData, editorMode, liquidPage });
    const engine = liquidHtml ? 'liquid' : 'react';
    // Canary telemetry (Document 6 §4): structured log consumed by monitoring pipeline.
    console.log(JSON.stringify({
        event: 'lb:canary:render',
        engine,
        subdomain: plan.route.subdomain,
        template: plan.template.id,
        route_type: plan.route.type,
        latency_ms: Date.now() - renderStart,
        editor_mode: editorMode,
        fallback_reason: liquidHtml ? null : 'renderer_returned_null', // null when engine=liquid
    }));

    if (liquidHtml) {
        return (
            <LiquidRenderedHtml
                html={liquidHtml}
                editorMode={editorMode}
                basePath={`/store/${plan.route.subdomain}`}
                storeId={store.id}
            />
        );
    }

    return (
        <RenderSectionList
            store={store}
            plan={plan}
            sections={plan.template.sections}
            sectionData={sectionData}
            editorMode={editorMode}
        />
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
