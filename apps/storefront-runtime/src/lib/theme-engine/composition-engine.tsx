import {
    normalizeAppBlockInstances,
    type AppBlockInstance,
} from '@letbuyy/app-engine';
import type { StoreModel } from '@letbuyy/tenant-core';
import { createThemeRenderer, type LiquidAppBlockRenderSource } from '@letbuyy/theme-engine';
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

async function renderLiquidPlan({
    store,
    plan,
    editorMode,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
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
    const liquidHtml = await renderLiquidPlan({ store, plan, editorMode });
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
