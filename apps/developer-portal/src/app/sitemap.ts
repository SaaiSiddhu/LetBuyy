import type { MetadataRoute } from 'next';
import { getDeveloperPortalUrl } from '@/lib/site-url';

const lastModified = new Date();

// Public documentation surfaces. Add nested doc slugs here as the portal grows
// (see the SEO master playbook for generating these from developer-surface.ts).
const PUBLIC_PATHS: Array<{ path: string; priority: number }> = [
    { path: '/', priority: 1 },
    { path: '/docs', priority: 0.9 },
    { path: '/api-reference', priority: 0.9 },
    { path: '/sdks', priority: 0.8 },
    { path: '/webhooks', priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
    return PUBLIC_PATHS.map(({ path, priority }) => ({
        url: getDeveloperPortalUrl(path),
        lastModified,
        changeFrequency: 'weekly',
        priority,
    }));
}
