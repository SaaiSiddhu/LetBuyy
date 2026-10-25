import 'server-only';
import { LetbuyyApiError, type StorefrontCollectionCursorQuery } from '@letbuyy/api-client';
import { StorefrontDiscoveryQuerySchema } from '@letbuyy/commerce-core';
import { createStorefrontApiClient } from '@/lib/api/client';
import { ProductService, mapStorefrontProduct } from '@/lib/product-service';
import { discoveryRouteQuery, StorefrontDiscoveryQueryError } from './discovery-route-query';
import { validateDiscoveryProductPage, StorefrontDiscoveryUnsupportedError } from './storefront-discovery';

/** Current public summaries or the existing store-bound draft capability; never shared-cache private reads. */
export async function loadCollectionDiscovery(subdomain: string, previewToken?: string) {
    try {
        const client = createStorefrontApiClient({ cache: 'no-store' });
        const collections = previewToken
            ? await client.storefront.themePreviewCollections(subdomain, previewToken)
            : await client.storefront.listCollections(subdomain);
        if (!Array.isArray(collections)) throw new Error('Invalid collection discovery response');
        return collections;
    } catch {
        // A private SDK error can contain a capability URL. Emit only a safe replacement.
        throw new Error('Collections are temporarily unavailable. Please try again.');
    }
}

export async function loadCollectionPage(subdomain: string, cursor: StorefrontCollectionCursorQuery, previewToken?: string) {
    try {
        const client = createStorefrontApiClient({ cache: 'no-store' });
        const page = previewToken
            ? await client.storefront.browsePreviewCollections(subdomain, previewToken, cursor)
            : await client.storefront.browseCollections(subdomain, cursor);
        if (!page || !Array.isArray(page.items) || page.items.length > 24
            || (page.nextCursor !== null && typeof page.nextCursor !== 'string')
            || (page.previousCursor !== null && typeof page.previousCursor !== 'string')) throw new Error('Invalid collection page');
        return page;
    } catch {
        throw new Error('Collections are temporarily unavailable. Please try again.');
    }
}

/** Exact collection membership and one matching paginated discovery response. No all-catalog fallback. */
export async function loadNamedCollectionProductPage(subdomain: string, identity: string, input: Parameters<typeof discoveryRouteQuery>[0], previewToken?: string) {
    const query = discoveryRouteQuery(input);
    const expectedId = StorefrontDiscoveryQuerySchema.shape.collection_id.safeParse(identity);
    const validateIdentity = (id: string | undefined) => {
        if (!id || expectedId.success && expectedId.data !== id
            || query.collection_id !== undefined && query.collection_id !== id) throw new StorefrontDiscoveryQueryError();
    };
    try {
        const client = createStorefrontApiClient({ cache: 'no-store' });
        if (previewToken) {
            const collection = await client.storefront.themePreviewCollection(subdomain, previewToken, identity);
            const id = StorefrontDiscoveryQuerySchema.shape.collection_id.parse(collection.id);
            validateIdentity(id);
            const page = await ProductService.getProductPage(subdomain, { ...query, collection_id: id }, previewToken);
            return { collection, page };
        }
        const payload = await client.storefront.getCollectionWithProducts(subdomain, identity, { query });
        const id = StorefrontDiscoveryQuerySchema.shape.collection_id.parse(payload.collection.id);
        validateIdentity(id);
        if (!id) throw new StorefrontDiscoveryQueryError();
        const requested = { ...query, collection_id: id };
        const page = validateDiscoveryProductPage({
            data: payload.products.map(mapStorefrontProduct), total: payload.total, page: query.page, limit: query.limit,
            has_more: query.page * query.limit < payload.total,
            ...(payload.discovery ? { discovery: payload.discovery } : {}),
        }, requested);
        return { collection: payload.collection, page };
    } catch (error) {
        if (error instanceof LetbuyyApiError && error.status === 404) return null;
        if (error instanceof StorefrontDiscoveryQueryError || error instanceof StorefrontDiscoveryUnsupportedError) throw error;
        // Never retain a signed capability URL as the error cause or try a public substitute.
        throw new Error('Collection products are temporarily unavailable. Please try again.');
    }
}
