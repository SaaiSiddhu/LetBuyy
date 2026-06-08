import type { MetadataRoute } from 'next';
import { getAppMarketplaceUrl } from '@/lib/site-url';
import { AppService } from '@/lib/app-service';

// Regenerate hourly. Dynamic entries are best-effort: if the Commerce API is
// unavailable at build/runtime, the sitemap still ships with the static routes.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const entries: MetadataRoute.Sitemap = [
        { url: getAppMarketplaceUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: getAppMarketplaceUrl('/categories'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        { url: getAppMarketplaceUrl('/collections'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: getAppMarketplaceUrl('/stories'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: getAppMarketplaceUrl('/search'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
        { url: getAppMarketplaceUrl('/developers'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ];

    try {
        const [appsResult, categories, collections] = await Promise.all([
            AppService.listApps({ limit: 200, sort: 'popular' }),
            AppService.getCategories(),
            AppService.getCollections(),
        ]);

        if (appsResult.ok) {
            for (const app of appsResult.value.apps) {
                if (!app.slug) continue;
                entries.push({
                    url: getAppMarketplaceUrl(`/apps/${app.slug}`),
                    lastModified: now,
                    changeFrequency: 'weekly',
                    priority: 0.7,
                });
            }
        }

        for (const category of categories) {
            if (!category.slug) continue;
            entries.push({
                url: getAppMarketplaceUrl(`/categories/${category.slug}`),
                lastModified: now,
                changeFrequency: 'weekly',
                priority: 0.6,
            });
            entries.push({
                url: getAppMarketplaceUrl(`/categories/${category.slug}/all`),
                lastModified: now,
                changeFrequency: 'weekly',
                priority: 0.55,
            });
        }

        for (const collection of collections) {
            if (!collection.slug) continue;
            entries.push({
                url: getAppMarketplaceUrl(`/collections/${collection.slug}`),
                lastModified: now,
                changeFrequency: 'weekly',
                priority: 0.55,
            });

            const type = (collection.curation_type || '').toLowerCase();
            if (collection.status === 'published' && (type.includes('story') || type.includes('editorial') || type.includes('guide'))) {
                entries.push({
                    url: getAppMarketplaceUrl(`/stories/${collection.slug}`),
                    lastModified: now,
                    changeFrequency: 'weekly',
                    priority: 0.55,
                });
            }
        }
    } catch {
        // Commerce API unavailable — ship static entries only.
    }

    return entries;
}
