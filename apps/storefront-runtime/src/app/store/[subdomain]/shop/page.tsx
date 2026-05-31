import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { buildSectionDataPlan } from '@/lib/theme-engine/data-binding-engine';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { createProductListingFallbackSection } from '@/lib/theme-engine/product-route';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return { title: 'Collection Not Found' };

    return buildStoreMetadata(store, {
        title: `All Products | ${store.name}`,
        description: `Browse all products from ${store.name}.`,
        path: '/shop',
    });
}

export default async function ShopPage({
    params,
    searchParams,
}: {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ theme_preview_token?: string }>;
}) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    const renderPlan = resolveStorefrontTemplate(store, {
        type: 'collection',
        path: `/store/${subdomain}/shop`,
        subdomain,
        resourceSlug: 'all-products',
        fallbackSections: [createProductListingFallbackSection('All Products')],
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
