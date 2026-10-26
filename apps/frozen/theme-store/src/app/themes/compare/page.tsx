import MarketplacePageHeader from '@/components/marketplace-page-header';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, EmptyState, LayoutGrid, Page, PageContent, Section, Star, Table } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import ThemeCompareSelection from '@/components/theme-compare-selection';
import ThemePreferenceActions from '@/components/theme-preference-actions';
import { normalizeThemeRecord } from '@/lib/theme-catalog';
import { ThemeService } from '@/lib/theme-service';
import { CATEGORY_LABELS, formatCount, formatReviewSummary, formatThemePrice } from '@/lib/utils';

export const metadata: Metadata = {
    title: 'Compare Themes',
    description: 'Compare LetBuyy marketplace themes side by side.',
};

type CompareSearchParams = {
    themes?: string | string[];
};

function firstParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? value[0] || '' : value || '';
}

function parseThemeSlugs(value: string): string[] {
    return Array.from(new Set(
        value
            .split(',')
            .map((slug) => slug.trim().toLowerCase())
            .filter((slug) => /^[a-z0-9-]{2,80}$/.test(slug)),
    )).slice(0, 4);
}

function compareRows(themes: Theme[]) {
    return [
        {
            label: 'Price',
            values: themes.map((theme) => formatThemePrice(theme)),
        },
        {
            label: 'Category',
            values: themes.map((theme) => CATEGORY_LABELS[theme.category]?.label ?? theme.category),
        },
        {
            label: 'Rating',
            values: themes.map((theme) => formatReviewSummary(theme.review_count, theme.rating)),
        },
        {
            label: 'Installs',
            values: themes.map((theme) => theme.install_count > 0 ? formatCount(theme.install_count) : 'No install data yet'),
        },
        {
            label: 'Platforms',
            values: themes.map((theme) => theme.supported_platforms.length > 0 ? theme.supported_platforms.join(', ') : 'LetBuyy'),
        },
        {
            label: 'Industries',
            values: themes.map((theme) => theme.industry.length > 0 ? theme.industry.join(', ') : 'General'),
        },
        {
            label: 'Top features',
            values: themes.map((theme) => theme.features.length > 0 ? theme.features.slice(0, 4).join(', ') : 'Feature metadata unavailable'),
        },
        {
            label: 'Version',
            values: themes.map((theme) => `v${theme.version}`),
        },
    ];
}

export default async function ThemeComparePage({
    searchParams,
}: {
    searchParams?: Promise<CompareSearchParams>;
}) {
    const params = await searchParams;
    const slugs = parseThemeSlugs(firstParam(params?.themes));
    const records = await Promise.all(slugs.map((slug) => ThemeService.getThemeBySlug(slug)));
    const themes = records.filter((record): record is Record<string, unknown> => Boolean(record)).map(normalizeThemeRecord);
    const rows = compareRows(themes);

    return (
        <Page className="theme-marketplace-page">
            <MarketplacePageHeader artwork="discover"
                title="Compare Themes"
                eyebrow="Theme marketplace"
                description="Compare pricing, platform support, metadata, proof, and features before installing or buying."
                identity="themes"
                showEyebrow
                showDescription
                showBreadcrumbs
                breadcrumbs={[
                    { label: 'Themes', href: '/themes' },
                    { label: 'Compare' },
                ]}
                primaryAction={{ label: 'Browse themes', href: '/themes' }}
                secondaryActions={[{ label: 'Saved themes', href: '/dashboard/favorites' }]}
            />

            <PageContent>
                {slugs.length === 0 ? (
                    <ThemeCompareSelection />
                ) : themes.length < 2 ? (
                    <Card className="flex min-h-[360px] items-center justify-center p-[var(--lb-density-card-padding)]">
                        <EmptyState
                            kind="themes"
                            title="Choose at least two themes"
                            body="Add another theme from the catalog or detail pages to compare them side by side."
                            primaryAction={(
                                <Link href="/themes" className="btn-primary text-sm">
                                    Browse themes
                                </Link>
                            )}
                            secondaryAction={<ThemeCompareSelection />}
                        />
                    </Card>
                ) : (
                    <div className="grid gap-[var(--lb-density-section-gap)]">
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-4">
                            {themes.map((theme) => (
                                <Card key={theme.id} layout="stack" className="overflow-hidden p-0">
                                    <div className="relative aspect-video bg-[var(--lb-color-surface-subdued)]">
                                        <Image
                                            src={theme.thumbnail_url}
                                            alt={`${theme.name} preview`}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 100vw, 25vw"
                                        />
                                    </div>
                                    <div className="grid gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                                        <div>
                                            <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                                <Link href={`/themes/${theme.slug}`}>{theme.name}</Link>
                                            </h2>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                {theme.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                            <span className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                                {formatThemePrice(theme)}
                                            </span>
                                            <span className="inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                                <Star className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] fill-[var(--lb-color-warning)] text-[color:var(--lb-color-warning)]" aria-hidden="true" />
                                                {theme.review_count > 0 ? theme.rating.toFixed(1) : 'New'}
                                            </span>
                                        </div>
                                        <ThemePreferenceActions theme={theme} compact />
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <Section title="Side-by-side details" className="px-0 py-0">
                            <Table tableClassName="min-w-full text-left">
                                <thead>
                                    <tr className="border-b border-[var(--lb-color-border)]">
                                        <th className="min-w-40 px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase text-[color:var(--lb-color-text-subdued)]">
                                            Field
                                        </th>
                                        {themes.map((theme) => (
                                            <th key={theme.id} className="min-w-56 px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase text-[color:var(--lb-color-text-subdued)]">
                                                {theme.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.label} className="border-b border-[var(--lb-color-border)] last:border-0">
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                                {row.label}
                                            </th>
                                            {row.values.map((value, index) => (
                                                <td key={`${row.label}-${themes[index]?.slug}`} className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                                    {value}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Section>

                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button asChild>
                                <Link href="/themes">
                                    <LayoutGrid className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Add another theme
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}
            </PageContent>
        </Page>
    );
}
