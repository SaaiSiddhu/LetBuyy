import { notFound } from 'next/navigation';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { hasRenderableThemeTemplate, type StoreTemplateConfig } from '@letbuyy/theme-engine';
import { createStorefrontApiClient } from '@/lib/api/client';
import PreviewPage from '../../preview/page';
import CatalogPreviewNavigation from '@/components/CatalogPreviewNavigation';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Public sample content only. Merchant/private drafts require the existing signed preview session. */
export default async function CatalogThemePreview({ params, searchParams }: {
    params: Promise<{
        slug: string;
    }>;
    searchParams: Promise<{
        route_type?: string;
    }>;
}) {
    const { slug } = await params;
    if (!/^[a-z0-9-]{1,120}$/.test(slug))
        notFound();
    let record: Record<string, unknown>;
    try {
        record = await createStorefrontApiClient().themes.get(slug) as unknown as Record<string, unknown>;
    }
    catch (error) {
        if (error instanceof LetbuyyApiError && error.status === 404)
            notFound();
        throw error;
    }
    if (!hasRenderableThemeTemplate(record.default_template))
        notFound();
    return <>
        <aside className="catalog-preview-notice">{String(record.name)} theme · Interactive design preview with sample products. Your store is unchanged.</aside>
        <CatalogPreviewNavigation slug={slug}><PreviewPage searchParams={Promise.resolve({ demo: 'urban-kicks', route_type: (await searchParams).route_type })} catalogTemplate={record.default_template as StoreTemplateConfig} catalogName={String(record.name)}/></CatalogPreviewNavigation>
    </>;
}
