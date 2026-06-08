import type { MetadataRoute } from 'next';
import type { ThemeCategory } from '@letbuyy/theme-engine';
import { appendOriginPath, getPlatformRequestOrigin } from '@/lib/platform-request-origin';
import { getThemeMarketplaceUrl } from '@/lib/site-url';
import { ThemeService } from '@/lib/theme-service';

// Regenerate hourly. Dynamic theme entries are best-effort: if the Commerce API
// is unavailable, the sitemap still ships with the static routes.
export const revalidate = 3600;

const CATEGORY_ROUTES: ThemeCategory[] = ['store', 'portfolio', 'resume', 'landing', 'saas'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const origin = await getPlatformRequestOrigin(getThemeMarketplaceUrl());
    const url = (path = '') => appendOriginPath(origin, path);

    const entries: MetadataRoute.Sitemap = [
        { url: url('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: url('/themes'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
        { url: url('/pricing'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
        ...CATEGORY_ROUTES.map((category) => ({
            url: url(`/themes/category/${category}`),
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.75,
        })),
    ];

    try {
        const result = await ThemeService.listThemes({ limit: 200, sort: 'popular' });
        if (result.ok) {
            for (const theme of result.value.themes) {
                const slug = (theme as { slug?: string }).slug;
                if (!slug) continue;
                entries.push({
                    url: url(`/themes/${slug}`),
                    lastModified: now,
                    changeFrequency: 'weekly',
                    priority: 0.8,
                });
            }
        }
    } catch {
        // Commerce API unavailable — ship static entries only.
    }

    return entries;
}
