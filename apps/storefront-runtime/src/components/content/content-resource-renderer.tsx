import type { StorefrontContentResource } from '@/lib/content-service';
import type { StoreModel } from '@letbuyy/tenant-core';
import { buildSectionDataPlan } from '@/lib/theme-engine/data-binding-engine';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { createContentFallbackSection } from '@/lib/theme-engine/content-route';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import type { StorefrontRouteType } from '@/lib/theme-engine/types';

export default async function ContentResourceRenderer({
    store,
    resource,
    routeType,
    path,
    subdomain,
}: {
    store: StoreModel;
    resource: StorefrontContentResource;
    routeType: StorefrontRouteType;
    path: string;
    subdomain: string;
}) {
    const renderPlan = resolveStorefrontTemplate(store, {
        type: routeType,
        path,
        subdomain,
        resourceId: resource.id,
        resourceSlug: resource.slug,
        templateKey: resource.assignedTemplateKey || undefined,
        fallbackSections: [createContentFallbackSection(resource)],
    });
    const sectionData = await buildSectionDataPlan({
        store,
        sections: renderPlan.template.sections,
        route: renderPlan.route,
    });

    return (
        <StorefrontCompositionEngine
            store={store}
            plan={renderPlan}
            sectionData={sectionData}
        />
    );
}
