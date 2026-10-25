// /store/[subdomain]/search — Storefront search results. The Liquid `lb-search` hydration
// island (search-box.liquid) submits a full-page GET to this exact path with a `search` query
// param (see liquid-hydration-islands.tsx LbSearchElement), so the path and param name here are
// load-bearing, not incidental.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { buildSectionDataPlan } from '@/lib/theme-engine/data-binding-engine';
import { discoveryRouteQuery, scalarDiscoveryQuery } from '@/lib/theme-engine/discovery-route-query';
import { buildStoreMetadata } from '@/lib/seo';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { createProductListingFallbackSection } from '@/lib/theme-engine/product-route';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const store = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Search' };

    const term = discoveryRouteQuery(query).search;
    return buildStoreMetadata(store, {
        title: term ? `Search results for "${term}" | ${store.name}` : `Search | ${store.name}`,
        description: `Search products at ${store.name}.`,
        path: term ? `/search?search=${encodeURIComponent(term)}` : '/search',
        noIndex: true,
    });
}

export default async function SearchPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = await searchParams;
    const discoveryQuery = discoveryRouteQuery(query);
    const term = discoveryQuery.search || '';

    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const store = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const plan = resolveStorefrontTemplate(store, {
        type: 'search',
        path: `/store/${subdomain}/search${term ? `?search=${encodeURIComponent(term)}` : ''}`,
        subdomain,
        discoveryQuery,
        searchParams: scalarDiscoveryQuery(discoveryQuery),
        fallbackSections: [createProductListingFallbackSection(
            term ? `Results for "${term}"` : 'Search',
        )],
    });
    if (plan.liquidTemplateMiss) return notFound();

    const sectionData = await buildSectionDataPlan({ store, sections: plan.template.sections, route: plan.route, previewToken });
    return <StorefrontCompositionEngine store={store} plan={plan} sectionData={sectionData} discoveryPreviewToken={previewToken || undefined} />;
}
