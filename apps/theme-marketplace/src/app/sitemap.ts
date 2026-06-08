import type { MetadataRoute } from 'next';
import type { ThemeCategory } from '@letbuyy/theme-engine';
import { getThemeMarketplaceUrl } from '@/lib/site-url';
import { ThemeService } from '@/lib/theme-service';

// Regenerate hourly. Dynamic theme entries are best-effort: if the Commerce API
// is unavailable, the sitemap still ships with the static routes.
export const revalidate = 3600;

const CATEGORY_ROUTES: ThemeCategory[] = ['store', 'portfolio', 'resume', 'landing', 'saas'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const entries: MetadataRoute.Sitemap = [
        { url: getThemeMarketplaceUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: getThemeMarketplaceUrl('/themes'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
        { url: getThemeMarketplaceUrl('/pricing'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
        ...CATEGORY_ROUTES.map((category) => ({
            url: getThemeMarketplaceUrl(`/themes/category/${category}`),
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
                    url: getThemeMarketplaceUrl(`/themes/${slug}`),
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
