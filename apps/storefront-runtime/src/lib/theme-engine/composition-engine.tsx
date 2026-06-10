import {
    normalizeAppBlockInstances,
    type AppBlockInstance,
} from '@letbuyy/shared-types';
import type { StoreModel } from '@letbuyy/tenant-core';
import {
    createThemeRenderer,
    type LiquidAppBlockRenderSource,
    type LiquidAppEmbeds,
    type LiquidCommerceDrops,
} from '@letbuyy/theme-engine';
import type { SectionRenderData, StorefrontRenderPlan } from './types';
import EditorPreviewSectionFrame from './editor-preview-section-frame';
import LiquidHydrationIslands from './liquid-hydration-islands';
import { renderRegisteredSection } from './renderer-registry';

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

function buildLiquidCommerceContext({
    store,
    plan,
    sectionData,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
}): LiquidCommerceDrops {
    const products = collectLiquidProducts(sectionData);
    const product = products[0] || null;
    const collection = plan.route.type === 'collection' || products.length > 0
        ? {
            id: plan.route.resourceId || plan.route.resourceSlug || 'all-products',
            handle: plan.route.resourceSlug || 'all-products',
            title: plan.route.resourceSlug === 'all-products' || !plan.route.resourceSlug ? 'All Products' : plan.route.resourceSlug,
            products,
        }
        : null;

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
        cart: {
            item_count: 0,
            items: [],
            total_price: 0,
            currency: 'INR',
        },
        customer: null,
    };
}

async function renderLiquidPlan({
    store,
    plan,
    sectionData,
    editorMode,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    editorMode: boolean;
}): Promise<string | null> {
    if (plan.rendererEngine !== 'liquid' || !plan.liquidBundle) return null;

    const renderer = createThemeRenderer('liquid');
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
        liquidContext: buildLiquidCommerceContext({ store, plan, sectionData }),
    });

    if (result.status !== 'rendered' || !result.liquid) return null;

    return result.liquid.contentForLayout;
}

export default async function StorefrontCompositionEngine({
    store,
    plan,
    sectionData,
    editorMode = false,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
    editorMode?: boolean;
}) {
    const liquidHtml = await renderLiquidPlan({ store, plan, sectionData, editorMode });
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
