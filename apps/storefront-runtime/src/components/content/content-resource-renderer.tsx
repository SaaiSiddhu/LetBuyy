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

    const resourceContent = resource.content as Record<string, unknown> | null | undefined;
    const liquidPage: Record<string, unknown> = {
        title: resource.title,
        content: resource.content,
        body_html: typeof resource.content?.html === 'string' ? resource.content.html : null,
        slug: resource.slug,
        policy_type: resource.policyType ?? null,
        // The composition-engine article branch reads these for article.published_at / article.image;
        // without them the date stamp and hero image never render on live articles.
        publishedAt: resource.publishedAt ?? null,
        featured_image: typeof resourceContent?.image === 'string' ? resourceContent.image : null,
    };

    return (
        <StorefrontCompositionEngine
            store={store}
            plan={renderPlan}
            sectionData={sectionData}
            liquidPage={liquidPage}
        />
    );
}
