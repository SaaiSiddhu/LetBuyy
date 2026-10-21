import { loadCollectionDiscovery } from '@/lib/theme-engine/collection-discovery';
import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import { resolveStorefrontTemplate, resolveDevEngineOverride } from '@/lib/theme-engine/template-resolver';
import { buildSectionDataPlan } from '@/lib/theme-engine/data-binding-engine';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomainAnyStatus(subdomain);

    if (!store) return { title: 'Store Not Found' };

    return buildStoreMetadata(store, {
        title: store.seoTitle || store.name,
        description: store.seoDescription || store.tagline || `Shop ${store.name} on LetBuyy.`,
        path: '/',
        noIndex: store.status !== 'published',
    });
}

export default async function StorePage({
    params,
    searchParams,
}: {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ theme_preview_token?: string; editor?: string; engine?: string }>;
}) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const path = `/store/${subdomain}`;
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomainAnyStatus(subdomain);
    const isEditorPreview = query?.editor === '1';

    if (!store) return notFound();

    const renderPlan = resolveStorefrontTemplate(store, {
        type: 'index',
        path,
        subdomain,
    }, resolveDevEngineOverride(query?.engine));
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
            editorMode={isEditorPreview}
            collectionSummaries={previewStore ? await loadCollectionDiscovery(subdomain, previewToken) : undefined}
        />
    );
}
