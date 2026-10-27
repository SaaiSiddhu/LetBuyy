import ShopPage, { generateMetadata as generateShopMetadata } from '../../shop/page';
import { discoveryRouteQuery, scalarDiscoveryQuery } from '@/lib/theme-engine/discovery-route-query';
import { loadNamedCollectionProductPage } from '@/lib/theme-engine/collection-discovery';
import { buildSectionDataPlan } from '@/lib/theme-engine/data-binding-engine';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { buildBreadcrumbJsonLd, buildStoreJsonLd, buildStoreMetadata } from '@/lib/seo';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { createProductListingFallbackSection } from '@/lib/theme-engine/product-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
    { params, searchParams }: {
        params: Promise<{ subdomain: string; slug: string }>;
        searchParams?: Promise<Record<string, string | string[] | undefined>>;
    },
): Promise<Metadata> {
    const { subdomain, slug } = await params;
    if (slug === 'all') return generateShopMetadata({ params: Promise.resolve({ subdomain }), searchParams });
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const discoveryQuery = discoveryRouteQuery(query);
    const [payload, store] = await Promise.all([
        loadNamedCollectionProductPage(subdomain, slug, discoveryQuery, previewToken || undefined),
        previewToken ? StoreService.getPreviewStoreBySubdomain(subdomain, previewToken) : StoreService.getStoreBySubdomain(subdomain),
    ]);

    if (!payload || !store) return { title: 'Collection Not Found' };

    const { collection } = payload;
    return buildStoreMetadata(store, {
        title: `${collection.title} | ${store.name}`,
        description: collection.description || `Shop the ${collection.title} collection at ${store.name}.`,
        path: `/collections/${slug}`,
        image: collection.image_url ?? undefined,
    });
}

export default async function CollectionPage(
    { params, searchParams }: {
        params: Promise<{ subdomain: string; slug: string }>;
        searchParams?: Promise<Record<string, string | string[] | undefined>>;
    },
) {
    const { subdomain, slug } = await params;
    if (slug === 'all') return ShopPage({ params: Promise.resolve({ subdomain }), searchParams });
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const discoveryQuery = discoveryRouteQuery(query);
    const [payload, store] = await Promise.all([
        loadNamedCollectionProductPage(subdomain, slug, discoveryQuery, previewToken || undefined),
        previewToken ? StoreService.getPreviewStoreBySubdomain(subdomain, previewToken) : StoreService.getStoreBySubdomain(subdomain),
    ]);
    if (!payload || !store) return notFound();
    const { collection, page } = payload;
    const plan = resolveStorefrontTemplate(store, {
        type: 'collection', path: `/store/${subdomain}/collections/${slug}`, subdomain,
        resourceId: collection.id, resourceSlug: slug,
        discoveryQuery: page.discovery?.query ?? { ...discoveryQuery, collection_id: collection.id },
        searchParams: scalarDiscoveryQuery(discoveryQuery),
        fallbackSections: [createProductListingFallbackSection(collection.title)],
    });
    const sectionData = await buildSectionDataPlan({
        store, sections: plan.template.sections, route: plan.route,
        preloadedDiscoveryPage: page, collection, previewToken,
    });

    const jsonLdNodes = [
        buildBreadcrumbJsonLd(store, [
            { name: 'Home', path: '/' },
            { name: 'Shop', path: '/shop' },
            { name: collection.title, path: `/collections/${slug}` },
        ]),
        buildStoreJsonLd(store),
    ];

    return (
        <>
            {jsonLdNodes.map((node, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, '\\u003c') }}
                />
            ))}
            <StorefrontCompositionEngine store={store} plan={plan} sectionData={sectionData} discoveryPreviewToken={previewToken || undefined} />
        </>
    );
}
