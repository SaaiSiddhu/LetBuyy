import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { hasRenderableThemeTemplate } from '@letbuyy/theme-engine';
import { createStorefrontApiClient } from '@/lib/api/client';
import PreviewContent from '../../preview/preview-content';
import CatalogPreviewFrame from '@/components/CatalogPreviewFrame';
import CatalogPreviewNavigation from '@/components/CatalogPreviewNavigation';
import { resolveCatalogDemoContent } from '@/lib/demo/catalog-demo-dispatch';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
/** Public sample content only. Merchant/private drafts require the existing signed preview session. */
export default async function CatalogThemePreview({ params, searchParams }: {
    params: Promise<{
        slug: string;
    }>;
    searchParams: Promise<{
        route_type?: string;
        embedded?: string;
        demo_path?: string;
        version?: string;
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
    const query = await searchParams;
    const version = typeof record.version === 'string' ? record.version : undefined;
    if (query.version && query.version !== version) return <main><h1>This demo version is no longer available</h1><p>The catalog changed since you selected it. Return to theme details to review the current version before adding it.</p><a href={`/theme-preview/${encodeURIComponent(slug)}`}>Review current sample store</a></main>;
    const content = version ? resolveCatalogDemoContent(slug, version, record.default_template as Record<string, unknown>, query.demo_path || (query.route_type === 'collection' ? '/products' : '/')) : null;
    if (!content) return <main><h1>This version’s sample store is not ready</h1><p>Theme details show the currently available catalog version. Return to the catalog to explore an available sample store.</p><Link href="/theme-preview">Browse themes</Link></main>;
    if (query.embedded !== '1') return <CatalogPreviewFrame key={`${slug}:${version}`} slug={slug} name={String(record.name)} version={version} initialPath={query.demo_path} initialRoute={query.route_type} />;
    return <>
        <aside className="catalog-preview-notice">{String(record.name)} theme · Read-only sample store. Purchases, accounts and messages are disabled. Your store is unchanged.</aside>
        <CatalogPreviewNavigation slug={slug} version={version}><PreviewContent catalogDemo={content}/></CatalogPreviewNavigation>
    </>;
}
