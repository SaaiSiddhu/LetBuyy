import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { ContentService } from '@/lib/content-service';
import { ProductService } from '@/lib/product-service';
import { StoreService } from '@/lib/store-service';
import { getStorefrontUrl, isStorefrontIndexable, resolveSubdomainFromHost } from '@/lib/seo';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
    const accessContext = host ? await resolveStorefrontAccessContext(host).catch(() => null) : null;
    const subdomain = accessContext?.subdomain || resolveSubdomainFromHost(host);

    if (!subdomain) return [];

    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (
        !store
        || !isStorefrontIndexable(store)
        || accessContext?.access_mode !== 'public'
        || accessContext?.published === false
    ) return [];

    const [products, pages, blogPosts] = await Promise.all([
        ProductService.getProductsByStoreSubdomain(subdomain).catch(() => []),
        ContentService.listPages(subdomain).catch(() => []),
        ContentService.listBlogPosts(subdomain).catch(() => []),
    ]);

    const now = new Date();
    const entries: MetadataRoute.Sitemap = [
        {
            url: getStorefrontUrl(store, '/'),
            lastModified: store.updatedAt || store.publishedAt || now,
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: getStorefrontUrl(store, '/shop'),
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: getStorefrontUrl(store, '/products'),
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.9,
        },
    ];

    for (const product of products) {
        entries.push({
            url: getStorefrontUrl(store, `/product/${product.id}`),
            lastModified: product.updatedAt || product.createdAt || now,
            changeFrequency: 'weekly',
            priority: 0.8,
        });
    }

    for (const page of pages) {
        if (!page.slug) continue;
        entries.push({
            url: getStorefrontUrl(store, `/${page.slug}`),
            lastModified: page.updatedAt || page.publishedAt || now,
            changeFrequency: 'monthly',
            priority: 0.6,
        });
    }

    for (const post of blogPosts) {
        if (!post.slug) continue;
        entries.push({
            url: getStorefrontUrl(store, `/blog/${post.slug}`),
            lastModified: post.updatedAt || post.publishedAt || now,
            changeFrequency: 'monthly',
            priority: 0.7,
        });
    }

    return entries;
}
