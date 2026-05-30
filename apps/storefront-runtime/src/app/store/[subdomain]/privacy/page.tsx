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
        ContentService.getPolicy(subdomain, 'privacy').then((policy) => policy || ContentService.getPageBySlug(subdomain, 'privacy')),
    ]);

    if (!store) return { title: 'Privacy Policy' };

    return buildStoreMetadata(store, {
        title: resource ? seoText(resource.seo, 'title') || resource.title : `Privacy Policy | ${store.name}`,
        description: resource ? seoText(resource.seo, 'description') || `${store.name} privacy policy.` : `${store.name} privacy policy.`,
        path: '/privacy',
    });
}

export default async function PrivacyPolicyPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomain(subdomain);
    const resource = await ContentService.getPolicy(subdomain, 'privacy')
        || await ContentService.getPageBySlug(subdomain, 'privacy');

    if (!store || !resource) return notFound();

    return (
        <ContentResourceRenderer
            store={store}
            resource={resource}
            routeType="policy"
            path={`/store/${subdomain}/privacy`}
            subdomain={subdomain}
        />
    );
}
