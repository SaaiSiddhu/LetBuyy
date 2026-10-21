import 'server-only';
import { createStorefrontApiClient } from '@/lib/api/client';

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
