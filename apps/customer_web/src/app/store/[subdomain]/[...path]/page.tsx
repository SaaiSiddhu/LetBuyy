import { notFound } from 'next/navigation';
import ContentResourceRenderer from '@/components/content/content-resource-renderer';
import { ContentService } from '@/lib/content-service';
import { StoreService } from '@/lib/store-service';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 60;

type Props = {
    params: Promise<{ subdomain: string; path: string[] }>;
    searchParams?: Promise<{ theme_preview_token?: string }>;
};

function seoText(seo: Record<string, unknown>, key: string): string | undefined {
    const value = seo[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain, path } = await params;
    if (!path || path.length !== 1) return { title: 'Page Not Found' };

    const slug = path[0];
    const [store, page] = await Promise.all([
        StoreService.getStoreBySubdomain(subdomain),
        ContentService.getPageBySlug(subdomain, slug),
    ]);

    if (!store || !page) return { title: 'Page Not Found' };

    return buildStoreMetadata(store, {
        title: seoText(page.seo, 'title') || page.title,
        description: seoText(page.seo, 'description') || store.tagline || `${page.title} from ${store.name}.`,
        path: `/${slug}`,
        image: seoText(page.seo, 'ogImage'),
    });
}

export default async function StorefrontDynamicPage({ params, searchParams }: Props) {
    const { subdomain, path } = await params;
    const query = await searchParams;
    if (!path || path.length !== 1) return notFound();

    const slug = path[0];
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const [previewStore, liveStore, page] = await Promise.all([
        previewToken ? StoreService.getPreviewStoreBySubdomain(subdomain, previewToken) : Promise.resolve(null),
        StoreService.getStoreBySubdomain(subdomain),
        ContentService.getPageBySlug(subdomain, slug),
    ]);
    const store = previewStore || liveStore;

    if (!store || !page) return notFound();

    return (
        <ContentResourceRenderer
            store={store}
            resource={page}
            routeType="page"
            path={`/store/${subdomain}/${slug}`}
            subdomain={subdomain}
        />
    );
}
