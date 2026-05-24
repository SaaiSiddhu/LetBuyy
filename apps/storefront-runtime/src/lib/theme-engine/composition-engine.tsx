import type { StoreModel } from '@/types/store';
import type { SectionRenderData, StorefrontRenderPlan } from './types';
import { renderRegisteredSection } from './renderer-registry';

function RenderSectionList({
    store,
    plan,
    sections,
    sectionData,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sections: StorefrontRenderPlan['template']['sections'];
    sectionData: Map<string, SectionRenderData>;
}) {
    const basePath = `/store/${plan.route.subdomain}`;

    return (
        <>
            {sections.map((section) => (
                <div key={section.id} data-section-id={section.id} data-renderer-key={section.rendererKey || section.type}>
                    {renderRegisteredSection({
                        store,
                        section,
                        theme: plan.themeSettings,
                        data: sectionData.get(section.id) || {},
                        route: plan.route,
                        basePath,
                    })}
                </div>
            ))}
        </>
    );
}

export default function StorefrontCompositionEngine({
    store,
    plan,
    sectionData,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    sectionData: Map<string, SectionRenderData>;
}) {
    return (
        <RenderSectionList
            store={store}
            plan={plan}
            sections={plan.template.sections}
            sectionData={sectionData}
        />
    );
}

export function StorefrontSectionGroupRenderer({
    store,
    plan,
    groupKey,
    sectionData,
}: {
    store: StoreModel;
    plan: StorefrontRenderPlan;
    groupKey: string;
    sectionData: Map<string, SectionRenderData>;
}) {
    const sections = plan.sectionGroups[groupKey] || [];
    if (sections.length === 0) return null;

    return (
        <RenderSectionList
            store={store}
            plan={plan}
            sections={sections}
            sectionData={sectionData}
        />
    );
}
