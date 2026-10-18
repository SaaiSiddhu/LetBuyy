import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { createStorefrontApiClient, storefrontReadInit, StorefrontApiRequestError } from '@/lib/api/client';
import { buildBreadcrumbJsonLd, buildStoreJsonLd, buildStoreMetadata } from '@/lib/seo';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { createProductListingFallbackSection } from '@/lib/theme-engine/product-route';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import type { ProductModel } from '@letbuyy/commerce-core';

export const revalidate = 30;

const COLLECTION_REVALIDATE_SECONDS = 30;

async function loadCollectionWithProducts(
    subdomain: string,
    slug: string,
    query: { country_of_origin?: string; category?: string; search?: string; page?: string } = {},
) {
    try {
        const result = await createStorefrontApiClient(
            storefrontReadInit(COLLECTION_REVALIDATE_SECONDS, [
                `storefront:${subdomain}:collections`,
                `storefront:${subdomain}:collection:${slug}`,
            ]),
        ).storefront.getCollectionWithProducts(subdomain, slug, { query });
        return result;
    } catch (err) {
        if (err instanceof StorefrontApiRequestError && err.status === 404) return null;
        console.error('[CollectionPage] Failed to load collection:', err);
        return null;
    }
}

export async function generateMetadata(
    { params }: { params: Promise<{ subdomain: string; slug: string }> },
): Promise<Metadata> {
    const { subdomain, slug } = await params;
    const [payload, store] = await Promise.all([
        loadCollectionWithProducts(subdomain, slug),
        StoreService.getStoreBySubdomain(subdomain),
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
        searchParams?: Promise<{ country_of_origin?: string; category?: string; search?: string; page?: string }>;
    },
) {
    const { subdomain, slug } = await params;
    const query = await searchParams;
    const filters = {
        ...(query?.country_of_origin?.trim() ? { country_of_origin: query.country_of_origin.trim().slice(0, 100) } : {}),
        ...(query?.category?.trim() ? { category: query.category.trim().slice(0, 100) } : {}),
        ...(query?.search?.trim() ? { search: query.search.trim().slice(0, 100) } : {}),
        ...(query?.page?.trim() ? { page: String(Math.max(1, Number(query.page) || 1)) } : {}),
    };

    const [payload, store] = await Promise.all([
        loadCollectionWithProducts(subdomain, slug, filters),
        StoreService.getStoreBySubdomain(subdomain),
    ]);

    if (!payload || !store) return notFound();

    const { collection, products } = payload;

    // Map public product rows to ProductModel shape used by the product-grid renderer
    const productModels: ProductModel[] = (products || []).map((p) => {
        const r = p as Record<string, unknown>;
        const images: string[] = Array.isArray(r.images)
            ? (r.images as unknown[]).map((img) => (typeof img === 'string' ? img : String((img as Record<string, unknown>)?.url ?? ''))).filter(Boolean)
            : [];
        return {
            id: String(r.id ?? ''),
            storeId: String(r.store_id ?? ''),
            name: String(r.name ?? 'Unnamed Product'),
            description: String(r.description ?? ''),
            price: Number(r.price ?? 0),
            compareAtPrice: r.compare_price ? Number(r.compare_price) : r.compare_at_price ? Number(r.compare_at_price) : undefined,
            currency: String(r.currency ?? 'INR'),
            images,
            category: r.category as string | undefined,
            tags: (r.tags as string[]) ?? [],
            variants: ((r.variants as ProductModel['variants']) ?? []),
            countryOfOrigin: r.country_of_origin as string | undefined,
            stock: r.stock !== undefined && r.stock !== null ? Number(r.stock) : 999,
            seoTitle: r.seo_title as string | undefined,
            seoDescription: r.seo_description as string | undefined,
            isActive: (r.is_active as boolean) ?? true,
            isFeatured: (r.is_featured as boolean) ?? false,
            createdAt: r.created_at as string | undefined,
            updatedAt: r.updated_at as string | undefined,
        } as ProductModel;
    });

    const plan = resolveStorefrontTemplate(store, {
        type: 'collection',
        path: `/store/${subdomain}/collections/${slug}`,
        subdomain,
        resourceId: slug,
        searchParams: {
            ...filters,
            ...(query?.page?.trim() ? { page: query.page.trim().slice(0, 6) } : {}),
        },
        fallbackSections: [createProductListingFallbackSection(collection.title)],
    });

    const sectionData = new Map<string, SectionRenderData>();
    for (const section of plan.template.sections) {
        sectionData.set(section.id, {
            products: productModels,
            collection: { id: collection.id, title: collection.title, description: collection.description },
        });
    }

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
            <StorefrontCompositionEngine store={store} plan={plan} sectionData={sectionData} />
        </>
    );
}
