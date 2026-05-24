import { notFound } from 'next/navigation';
import ContentResourceRenderer from '@/components/content/content-resource-renderer';
import { ContentService } from '@/lib/content-service';
import { StoreService } from '@/lib/store-service';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ theme_preview_token?: string }>;
};

export default async function ReturnsPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomain(subdomain);
    const resource = await ContentService.getPolicy(subdomain, 'refund')
        || await ContentService.getPolicy(subdomain, 'returns')
        || await ContentService.getPageBySlug(subdomain, 'returns');

    if (!store || !resource) return notFound();

    return (
        <ContentResourceRenderer
            store={store}
            resource={resource}
            routeType="policy"
            path={`/store/${subdomain}/returns`}
            subdomain={subdomain}
        />
    );
}
