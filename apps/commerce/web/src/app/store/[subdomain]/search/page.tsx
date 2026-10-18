// /store/[subdomain]/search — Storefront search results. The Liquid `lb-search` hydration
// island (search-box.liquid) submits a full-page GET to this exact path with a `search` query
// param (see liquid-hydration-islands.tsx LbSearchElement), so the path and param name here are
// load-bearing, not incidental.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { buildStoreMetadata } from '@/lib/seo';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { createProductListingFallbackSection } from '@/lib/theme-engine/product-route';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import type { SectionRenderData } from '@/lib/theme-engine/types';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ search?: string; theme_preview_token?: string; country_of_origin?: string; category?: string; page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const query = await searchParams;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Search' };

    const term = query?.search?.trim();
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
    const term = query?.search?.trim() || '';

    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    let products: Awaited<ReturnType<typeof ProductService.searchProducts>> = [];
    let searchFailed = false;
    if (term) {
        try {
            products = await ProductService.searchProducts(subdomain, term, {
                ...(query?.country_of_origin?.trim() ? { country_of_origin: query.country_of_origin.trim().slice(0, 100) } : {}),
                ...(query?.category?.trim() ? { category: query.category.trim().slice(0, 100) } : {}),
                ...(query?.page?.trim() ? { page: Number(query.page) || 1 } : {}),
            });
        } catch {
            // A failed search degrades to an empty result with its own message — it is not the
            // same fact as a catalogue outage and must not throw the whole storefront error boundary.
            searchFailed = true;
        }
    }

    const plan = resolveStorefrontTemplate(store, {
        type: 'search',
        path: `/store/${subdomain}/search${term ? `?search=${encodeURIComponent(term)}` : ''}`,
        subdomain,
        searchParams: {
            ...(term ? { search: term } : {}),
            ...(query?.country_of_origin?.trim() ? { country_of_origin: query.country_of_origin.trim().slice(0, 100) } : {}),
            ...(query?.category?.trim() ? { category: query.category.trim().slice(0, 100) } : {}),
            ...(query?.page?.trim() ? { page: query.page.trim().slice(0, 6) } : {}),
        },
        fallbackSections: [createProductListingFallbackSection(
            term ? `Results for "${term}"` : 'Search',
        )],
    });
    if (plan.liquidTemplateMiss) return notFound();

    const sectionData = new Map<string, SectionRenderData>();
    for (const section of plan.template.sections) {
        sectionData.set(section.id, { products });
    }

    return (
        <>
            {term && searchFailed && (
                <p role="alert" className="lb-search-error" style={{ padding: '16px', color: 'var(--text-secondary, rgb(107 114 128))' }}>
                    We could not complete that search just now. Please try again.
                </p>
            )}
            <StorefrontCompositionEngine store={store} plan={plan} sectionData={sectionData} />
        </>
    );
}
