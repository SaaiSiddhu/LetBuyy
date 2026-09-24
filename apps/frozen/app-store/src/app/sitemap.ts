import type { MetadataRoute } from 'next';
import { appendOriginPath, getPlatformRequestOrigin } from '@/lib/platform-request-origin';
import { getAppMarketplaceUrl } from '@/lib/site-url';
import { AppService } from '@/lib/app-service';

// Regenerate hourly. Dynamic entries are best-effort: if the Commerce API is
// unavailable at build/runtime, the sitemap still ships with the static routes.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const origin = await getPlatformRequestOrigin(getAppMarketplaceUrl());
    const url = (path = '') => appendOriginPath(origin, path);

    const entries: MetadataRoute.Sitemap = [
        { url: url('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: url('/categories'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        { url: url('/collections'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: url('/stories'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: url('/search'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
        { url: url('/developers'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
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
                    url: url(`/apps/${app.slug}`),
                    lastModified: now,
                    changeFrequency: 'weekly',
                    priority: 0.7,
                });
            }
        }

        for (const category of categories) {
            if (!category.slug) continue;
            entries.push({
                url: url(`/categories/${category.slug}`),
                lastModified: now,
                changeFrequency: 'weekly',
                priority: 0.6,
            });
            entries.push({
                url: url(`/categories/${category.slug}/all`),
                lastModified: now,
                changeFrequency: 'weekly',
                priority: 0.55,
            });
        }

        for (const collection of collections) {
            if (!collection.slug) continue;
            entries.push({
                url: url(`/collections/${collection.slug}`),
                lastModified: now,
                changeFrequency: 'weekly',
                priority: 0.55,
            });

            const type = (collection.curation_type || '').toLowerCase();
            if (collection.status === 'published' && (type.includes('story') || type.includes('editorial') || type.includes('guide'))) {
                entries.push({
                    url: url(`/stories/${collection.slug}`),
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
