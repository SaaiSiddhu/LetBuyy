import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { buildSectionDataPlan } from '@/lib/theme-engine/data-binding-engine';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import { composeStorefrontRuntimeProjection } from '@letbuyy/runtime-composition/storefront-query-layer';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    searchParams?: Promise<{ theme_preview_token?: string; editor?: string }>;
}) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const path = `/store/${subdomain}`;
    const projection = await composeStorefrontRuntimeProjection({
        subdomain,
        path,
        previewToken: previewToken || undefined,
    }, {
        runtime: 'storefront-runtime',
        route: path,
        correlation: {
            requestId: `storefront:${subdomain}`,
            correlationId: `storefront:${subdomain}:${previewToken ? 'preview' : 'published'}`,
        },
    }, {
        loadStore: async () => {
            const previewStore = previewToken
                ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
                : null;
            return (previewStore || await StoreService.getStoreBySubdomain(subdomain)) as never;
        },
        loadTemplate: async (store) => (store as never as { templateConfig: never }).templateConfig,
    });
    const store = projection?.data.store as never as Awaited<ReturnType<typeof StoreService.getStoreBySubdomain>>;

    if (!store) return notFound();

    const renderPlan = resolveStorefrontTemplate(store, {
        type: 'index',
        path,
        subdomain,
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
