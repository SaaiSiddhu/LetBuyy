import type { StoreModel } from '@letbuyy/tenant-core';
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

export default function StorefrontCompositionEngine({
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
