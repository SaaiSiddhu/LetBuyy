import { loadCollectionDiscovery } from '@/lib/theme-engine/collection-discovery';
// /store/[subdomain]/collections — All-collections index. Renders the Liquid `list-collections`
// template with bounded, current collection summaries. Distinct from collections/[slug], a single
// collection's product listing.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import type { SectionRenderData } from '@/lib/theme-engine/types';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ theme_preview_token?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Collections Not Found' };

    return buildStoreMetadata(store, {
        title: `Collections | ${store.name}`,
        description: `Browse collections at ${store.name}.`,
        path: '/collections',
    });
}

export default async function CollectionsIndexPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const plan = resolveStorefrontTemplate(store, {
        type: 'list_collections',
        templateKey: 'list-collections',
        path: `/store/${subdomain}/collections`,
        subdomain,
    });
    if (plan.liquidTemplateMiss) return notFound();

    return (
        <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} previewCollections={previewStore ? await loadCollectionDiscovery(subdomain, previewToken) : undefined} />
    );
}
