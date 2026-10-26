import MarketplacePageHeader from '@/components/marketplace-page-header';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, EmptyState, Page, PageContent, Section } from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import { ThemeService } from '@/lib/theme-service';
import type { Theme, ThemeCategory, ThemePricingType } from '@letbuyy/theme-engine';

type Props = {
    params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
    title: 'Theme collection',
};

const CATEGORY_PREVIEW_FALLBACK: Record<ThemeCategory, string> = {
    store: '/previews/store.png',
    portfolio: '/previews/portfolio.png',
    resume: '/previews/resume.png',
    landing: '/previews/landing.png',
    saas: '/previews/saas-console-card.png',
};

function stringValue(record: Record<string, unknown>, key: string, fallback = ''): string {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(record: Record<string, unknown>, key: string, fallback = 0): number {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArrayValue(record: Record<string, unknown>, key: string): string[] {
    const value = record[key];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function normalizeThemeRecord(record: Record<string, unknown>): Theme {
    const category = stringValue(record, 'category', 'store') as ThemeCategory;
    const slug = stringValue(record, 'slug', stringValue(record, 'id', 'theme'));
    const thumbnail = stringValue(record, 'thumbnail_url', CATEGORY_PREVIEW_FALLBACK[category] || CATEGORY_PREVIEW_FALLBACK.store);

    return {
        id: stringValue(record, 'id', slug),
        slug,
        name: stringValue(record, 'name', 'Untitled theme'),
        description: stringValue(record, 'description', 'Theme details unavailable.'),
        long_description: stringValue(record, 'long_description', stringValue(record, 'description')),
        category,
        industry: stringArrayValue(record, 'industry'),
        theme_preset_id: stringValue(record, 'theme_preset_id'),
        version: stringValue(record, 'version', '1.0.0'),
        is_active: true,
        letbuyy_pricing_type: stringValue(record, 'letbuyy_pricing_type', 'free') as ThemePricingType,
        letbuyy_price_usd: numberValue(record, 'letbuyy_price_usd'),
        letbuyy_price_inr: numberValue(record, 'letbuyy_price_inr'),
        wordpress_price_usd: numberValue(record, 'wordpress_price_usd'),
        shopify_price_usd: numberValue(record, 'shopify_price_usd'),
        html_price_usd: numberValue(record, 'html_price_usd'),
        react_price_usd: numberValue(record, 'react_price_usd'),
        thumbnail_url: thumbnail,
        preview_url: stringValue(record, 'preview_url', thumbnail),
        screenshots: stringArrayValue(record, 'screenshots'),
        demo_url: stringValue(record, 'demo_url'),
        customizable_sections: {},
        color_presets: [],
        font_options: [],
        author_id: stringValue(record, 'author_id') || null,
        author_name: stringValue(record, 'author_name', 'LetBuyy'),
        tags: stringArrayValue(record, 'tags'),
        features: stringArrayValue(record, 'features'),
        supported_platforms: stringArrayValue(record, 'supported_platforms'),
        rating: numberValue(record, 'rating_avg', numberValue(record, 'rating')),
        review_count: numberValue(record, 'review_count'),
        install_count: numberValue(record, 'install_count'),
        download_count: numberValue(record, 'download_count'),
        purchase_count: numberValue(record, 'purchase_count'),
        published_at: stringValue(record, 'published_at') || null,
        created_at: stringValue(record, 'created_at'),
        updated_at: stringValue(record, 'updated_at'),
    };
}

export default async function ThemeCollectionPage({ params }: Props) {
    const { slug } = await params;
    const collection = await ThemeService.getCollection(slug);
    const themes = Array.isArray(collection?.themes)
        ? collection.themes.map((theme) => normalizeThemeRecord(theme as Record<string, unknown>))
        : [];

    return (
        <Page className="theme-marketplace-page">
            <MarketplacePageHeader artwork="discover"
                title={stringValue(collection || {}, 'title', 'Theme collection')}
                eyebrow="Theme collection"
                description={stringValue(collection || {}, 'description', 'Curated marketplace themes.')}
                identity="themes"
                showBreadcrumbs
                showDescription
                showEyebrow
                breadcrumbs={[{ label: 'Themes', href: '/themes' }, { label: stringValue(collection || {}, 'title', slug) }]}
            />
            <PageContent>
                <Section title="Themes" className="px-0 py-0">
                    {themes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-3">
                            {themes.map((theme) => <ThemeCard key={theme.id} theme={theme} />)}
                        </div>
                    ) : (
                        <Card className="flex min-h-[320px] items-center justify-center p-[var(--lb-density-card-padding)]">
                            <EmptyState
                                kind="themes"
                                title="No themes in this collection"
                                body="Browse the full gallery to find active marketplace themes."
                                primaryAction={<Link href="/themes">Browse themes</Link>}
                            />
                        </Card>
                    )}
                </Section>
            </PageContent>
        </Page>
    );
}
