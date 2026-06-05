import type { StoreModel } from '@letbuyy/tenant-core';
import { createThemeRenderer } from '@letbuyy/theme-engine';
import type { SectionRenderData, StorefrontRenderPlan } from './types';
import EditorPreviewSectionFrame from './editor-preview-section-frame';
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
}: {
    html: string;
    editorMode: boolean;
}) {
    return (
        <div
            data-theme-renderer="liquid"
            data-editor-mode={editorMode ? 'true' : 'false'}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
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
        return <LiquidRenderedHtml html={liquidHtml} editorMode={editorMode} />;
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
