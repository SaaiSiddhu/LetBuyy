import { notFound } from 'next/navigation';
import ContentResourceRenderer from '@/components/content/content-resource-renderer';
import { ContentService } from '@/lib/content-service';
import { StoreService } from '@/lib/store-service';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
    params: Promise<{ subdomain: string; path: string[] }>;
    searchParams?: Promise<{ theme_preview_token?: string }>;
};

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
