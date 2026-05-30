import { notFound } from 'next/navigation';
import ContentResourceRenderer from '@/components/content/content-resource-renderer';
import { ContentService } from '@/lib/content-service';
import { StoreService } from '@/lib/store-service';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ theme_preview_token?: string }>;
};

function seoText(seo: Record<string, unknown>, key: string): string | undefined {
    const value = seo[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const [store, resource] = await Promise.all([
        StoreService.getStoreBySubdomain(subdomain),
        ContentService.getPolicy(subdomain, 'terms').then((policy) => policy || ContentService.getPageBySlug(subdomain, 'terms')),
    ]);

    if (!store) return { title: 'Terms of Service' };

    return buildStoreMetadata(store, {
        title: resource ? seoText(resource.seo, 'title') || resource.title : `Terms of Service | ${store.name}`,
        description: resource ? seoText(resource.seo, 'description') || `${store.name} terms of service.` : `${store.name} terms of service.`,
        path: '/terms',
    });
}

export default async function TermsPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomain(subdomain);
    const resource = await ContentService.getPolicy(subdomain, 'terms')
        || await ContentService.getPageBySlug(subdomain, 'terms');

    if (!store || !resource) return notFound();

    return (
        <ContentResourceRenderer
            store={store}
            resource={resource}
            routeType="policy"
            path={`/store/${subdomain}/terms`}
            subdomain={subdomain}
        />
    );
}
