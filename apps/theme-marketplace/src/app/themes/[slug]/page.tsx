import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { Theme, ThemeCategory, ThemePricingType } from '@letbuyy/theme-engine';
import {
    Card,
    Check,
    Download,
    EmptyState,
    ExternalLink,
    Eye,
    Heart,
    Page,
    PageContent,
    PageHeader,
    Package,
    Section,
    ShoppingCart,
    Star,
} from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import { ThemeService } from '@/lib/theme-service';
import { CATEGORY_LABELS, formatCount, formatPrice } from '@/lib/utils';

interface Props {
    params: Promise<{ slug: string }>;
}

const CATEGORY_PREVIEW_FALLBACK: Record<ThemeCategory, string> = {
    store: '/previews/store.png',
    portfolio: '/previews/portfolio.png',
    resume: '/previews/resume.png',
    landing: '/previews/landing.png',
    saas: '/previews/landing.png',
};

const THEME_CATEGORIES: ThemeCategory[] = ['store', 'portfolio', 'resume', 'landing', 'saas'];
const THEME_PRICING_TYPES: ThemePricingType[] = ['free', 'one_time', 'subscription'];

function isThemeCategory(value: unknown): value is ThemeCategory {
    return typeof value === 'string' && THEME_CATEGORIES.includes(value as ThemeCategory);
}

function isThemePricingType(value: unknown): value is ThemePricingType {
    return typeof value === 'string' && THEME_PRICING_TYPES.includes(value as ThemePricingType);
}

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
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function recordValue(record: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = record[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function colorPresetValue(record: Record<string, unknown>): Theme['color_presets'] {
    const value = record.color_presets;
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const preset = item as Record<string, unknown>;
        const name = stringValue(preset, 'name');
        const colors = preset.colors && typeof preset.colors === 'object' && !Array.isArray(preset.colors)
            ? Object.fromEntries(
                Object.entries(preset.colors as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
            )
            : {};

        return name ? [{ name, colors }] : [];
    });
}

function normalizeThemeRecord(record: Record<string, unknown>): Theme {
    const category: ThemeCategory = isThemeCategory(record.category) ? record.category : 'store';
    const slug = stringValue(record, 'slug', stringValue(record, 'id', 'theme'));
    const pricingType: ThemePricingType = isThemePricingType(record.letbuyy_pricing_type)
        ? record.letbuyy_pricing_type
        : 'free';
    const thumbnail = stringValue(record, 'thumbnail_url', CATEGORY_PREVIEW_FALLBACK[category]);
    const description = stringValue(record, 'description', 'Theme catalog details are not available yet.');

    return {
        id: stringValue(record, 'id', slug),
        slug,
        name: stringValue(record, 'name', 'Untitled theme'),
        description,
        long_description: stringValue(record, 'long_description', description),
        category,
        industry: stringArrayValue(record, 'industry'),
        theme_preset_id: stringValue(record, 'theme_preset_id'),
        version: stringValue(record, 'version', '1.0.0'),
        is_active: record.is_active === undefined ? true : Boolean(record.is_active),
        letbuyy_pricing_type: pricingType,
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
        customizable_sections: recordValue(record, 'customizable_sections'),
        color_presets: colorPresetValue(record),
        font_options: stringArrayValue(record, 'font_options'),
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

function uniqueGalleryImages(theme: Theme): string[] {
    const images = [theme.preview_url, theme.thumbnail_url, ...theme.screenshots].filter((item): item is string => Boolean(item));
    return Array.from(new Set(images));
}

function publicationLabel(value: string | null): string {
    if (!value) return 'Not listed';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not listed';
    return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date);
}

function platformLabel(theme: Theme): string {
    return theme.supported_platforms.length > 0 ? theme.supported_platforms.join(', ') : 'LetBuyy';
}

function standaloneRows(theme: Theme) {
    return [
        { label: 'WordPress', value: theme.wordpress_price_usd },
        { label: 'Shopify', value: theme.shopify_price_usd },
        { label: 'HTML / CSS', value: theme.html_price_usd },
        { label: 'React', value: theme.react_price_usd },
    ].filter((row) => row.value > 0);
}

function WarningPanel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div
            className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-component-banner-warning-border)] bg-[var(--lb-component-banner-warning-bg)] p-[var(--lb-density-card-padding)]"
            role="status"
        >
            <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-banner-warning-text)]">
                {title}
            </p>
            <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                {children}
            </p>
        </div>
    );
}

function InfoList({ items }: { items: Array<{ term: string; description: ReactNode }> }) {
    return (
        <dl className="grid gap-x-[var(--lb-density-card-gap)] gap-y-[var(--lb-space-3)]">
            {items.map((item) => (
                <div key={item.term} className="grid gap-[var(--lb-space-1)]">
                    <dt className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {item.term}
                    </dt>
                    <dd className="m-0 min-w-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        {item.description}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const record = await ThemeService.getThemeBySlug(slug);
    if (!record) return { title: 'Theme not found' };

    const name = stringValue(record, 'name', 'Theme');
    const description = stringValue(record, 'description', 'LetBuyy theme marketplace detail.');
    const thumbnail = stringValue(record, 'thumbnail_url');

    return {
        title: name,
        description,
        openGraph: {
            title: name,
            description,
            images: thumbnail ? [thumbnail] : undefined,
        },
    };
}

export default async function ThemeDetailPage({ params }: Props) {
    const { slug } = await params;
    const record = await ThemeService.getThemeBySlug(slug);
    if (!record) {
        return (
            <Page className="theme-marketplace-page">
                <PageHeader
                    title="Theme not found"
                    eyebrow="Theme marketplace"
                    description="This theme is not available in the current catalog data."
                    identity="themes"
                    showBreadcrumbs
                    showDescription
                    showEyebrow
                    breadcrumbs={[
                        { label: 'Themes', href: '/themes' },
                        { label: 'Theme not found' },
                    ]}
                    primaryAction={{
                        label: 'Browse themes',
                        href: '/themes',
                        icon: <Package aria-hidden="true" />,
                    }}
                />

                <PageContent>
                    <Card className="flex min-h-[360px] items-center justify-center p-[var(--lb-density-card-padding)]">
                        <EmptyState
                            kind="themes"
                            title="Theme catalog data is not available yet"
                            body="The marketplace can render this detail page once the existing theme catalog API returns a matching theme slug. Seed or connect theme data before opening a theme detail."
                            primaryAction={(
                                <Link
                                    href="/themes"
                                    className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)] transition-colors hover:bg-[var(--lb-component-button-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    Browse themes
                                </Link>
                            )}
                            secondaryAction={(
                                <Link
                                    href="/pricing"
                                    className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    View pricing
                                </Link>
                            )}
                        />
                    </Card>
                </PageContent>
            </Page>
        );
    }

    const theme = normalizeThemeRecord(record);
    const isFree = theme.letbuyy_pricing_type === 'free';
    const addHref = isFree ? `/install?theme=${encodeURIComponent(theme.slug)}` : `/checkout?theme=${encodeURIComponent(theme.slug)}`;
    const addLabel = isFree ? 'Add to library' : 'Buy and add';
    const galleryImages = uniqueGalleryImages(theme);
    const priceLabel = formatPrice(theme.letbuyy_price_usd);
    const ratingLabel = Number.isFinite(theme.rating) ? theme.rating.toFixed(1) : '0.0';
    const categoryLabel = CATEGORY_LABELS[theme.category]?.label ?? theme.category;
    const standaloneDownloads = standaloneRows(theme);

    const { themes: similarRecords } = await ThemeService.listThemes({
        category: theme.category,
        limit: 4,
    });
    const similarThemes = similarRecords
        .map(normalizeThemeRecord)
        .filter((item) => item.id !== theme.id)
        .slice(0, 3);

    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title={theme.name}
                eyebrow="Theme marketplace"
                description={theme.description}
                identity="themes"
                showBreadcrumbs
                showDescription
                showEyebrow
                breadcrumbs={[
                    { label: 'Themes', href: '/themes' },
                    { label: categoryLabel, href: `/themes?category=${theme.category}` },
                    { label: theme.name },
                ]}
                primaryAction={{
                    label: addLabel,
                    href: addHref,
                    icon: isFree ? <Download aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />,
                }}
                secondaryActions={theme.demo_url ? [
                    {
                        label: 'Live demo',
                        href: theme.demo_url,
                        icon: <ExternalLink aria-hidden="true" />,
                    },
                ] : []}
            />

            <PageContent>
                <Card className="overflow-hidden">
                    <div className="relative aspect-video min-h-[260px] bg-[var(--lb-color-surface-subdued)]">
                        <Image
                            src={galleryImages[0] ?? CATEGORY_PREVIEW_FALLBACK[theme.category]}
                            alt={`${theme.name} full-width preview`}
                            fill
                            className="object-cover"
                            sizes="100vw"
                            priority
                        />
                        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-[var(--lb-space-3)] bg-gradient-to-t from-black/80 via-black/20 to-transparent p-[var(--lb-density-card-padding)] text-white">
                            <div className="min-w-0 flex-1">
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-white/70">
                                    {categoryLabel} theme
                                </p>
                                <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-white">
                                    {theme.name}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <span className="inline-flex min-h-[var(--lb-density-pill-height)] items-center rounded-[var(--lb-radius-full)] border border-white/20 bg-white/15 px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-white backdrop-blur-md">
                                    {priceLabel}
                                </span>
                                <span className="inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border border-white/20 bg-white/15 px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-white backdrop-blur-md">
                                    <Star className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] fill-[var(--lb-color-warning)] text-[color:var(--lb-color-warning)]" aria-hidden="true" />
                                    {ratingLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {galleryImages.length > 1 && (
                        <div className="flex gap-[var(--lb-space-3)] overflow-x-auto border-t border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)]" aria-label="Theme screenshots">
                            {galleryImages.slice(1, 7).map((image, index) => (
                                <div
                                    key={image}
                                    className="relative h-20 w-32 shrink-0 overflow-hidden rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)]"
                                >
                                    <Image
                                        src={image}
                                        alt={`${theme.name} screenshot ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        sizes="128px"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <div className="grid gap-[var(--lb-density-section-gap)] lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="flex min-w-0 flex-col gap-[var(--lb-density-section-gap)]">
                        <Section
                            title="Overview"
                            description={`Built by ${theme.author_name}. Version ${theme.version}.`}
                            className="px-0 py-0"
                        >
                            <Card className="p-[var(--lb-density-card-padding)]">
                                <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                    {theme.long_description || theme.description}
                                </p>
                            </Card>
                        </Section>

                        <Section title="Features" className="px-0 py-0">
                            {theme.features.length > 0 ? (
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    {theme.features.map((feature) => (
                                        <Card key={feature} className="flex min-h-[76px] items-start gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                                            <span className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-component-banner-success-bg)] text-[color:var(--lb-component-banner-success-text)]">
                                                <Check className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </span>
                                            <span className="text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                                {feature}
                                            </span>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <WarningPanel title="Feature metadata unavailable">
                                    Feature bullets need seeded marketplace theme metadata before this section can show theme-specific capabilities.
                                </WarningPanel>
                            )}
                        </Section>

                        {theme.tags.length > 0 && (
                            <Section title="Tags" className="px-0 py-0">
                                <Card className="flex flex-wrap gap-[var(--lb-space-2)] p-[var(--lb-density-card-padding)]">
                                    {theme.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex min-h-[var(--lb-density-pill-height)] items-center rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </Card>
                            </Section>
                        )}

                        {theme.color_presets.length > 0 && (
                            <Section title="Color presets" className="px-0 py-0">
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    {theme.color_presets.map((preset) => (
                                        <Card key={preset.name} className="flex items-center justify-between gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                                            <span className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                                {preset.name}
                                            </span>
                                            <span className="flex shrink-0 items-center gap-[var(--lb-space-1)]">
                                                {Object.entries(preset.colors).slice(0, 5).map(([name, color]) => (
                                                    <span
                                                        key={name}
                                                        className="rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]"
                                                    >
                                                        {name}: {color}
                                                    </span>
                                                ))}
                                            </span>
                                        </Card>
                                    ))}
                                </div>
                            </Section>
                        )}
                    </div>

                    <aside className="flex min-w-0 flex-col gap-[var(--lb-density-section-gap)]" aria-label="Theme actions and details">
                        <Card layout="stack" className="gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                            <div className="space-y-[var(--lb-space-1)] text-center">
                                <p className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                    {priceLabel}
                                </p>
                                {theme.letbuyy_price_inr > 0 && (
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        INR reference: Rs {theme.letbuyy_price_inr.toLocaleString('en-IN')}
                                    </p>
                                )}
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {isFree ? 'Free to add to a LetBuyy store library.' : 'Purchase flow adds access before installation.'}
                                </p>
                            </div>

                            <a
                                href={addHref}
                                className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)] transition-colors hover:bg-[var(--lb-component-button-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            >
                                {isFree ? <Download className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" /> : <ShoppingCart className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                {addLabel}
                            </a>

                            <button
                                type="button"
                                disabled
                                className="inline-flex min-h-[var(--lb-density-button-height)] cursor-not-allowed items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)] opacity-70"
                            >
                                <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Preview in your store
                            </button>

                            <div className="grid grid-cols-2 gap-[var(--lb-space-2)]">
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex min-h-[var(--lb-density-button-height)] cursor-not-allowed items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)] opacity-70"
                                >
                                    <Heart className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Save
                                </button>
                                {theme.demo_url ? (
                                    <a
                                        href={theme.demo_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    >
                                        <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Demo
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        className="inline-flex min-h-[var(--lb-density-button-height)] cursor-not-allowed items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)] opacity-70"
                                    >
                                        <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Demo
                                    </button>
                                )}
                            </div>

                            <WarningPanel title="Store preview needs backend support">
                                Store-scoped preview sessions and a direct save-to-library endpoint are not exposed by the theme marketplace API yet.
                            </WarningPanel>
                        </Card>

                        <Card layout="stack" className="gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                            <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    Marketplace proof
                                </span>
                                <span className="inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                    <Star className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] fill-[var(--lb-color-warning)] text-[color:var(--lb-color-warning)]" aria-hidden="true" />
                                    {ratingLabel}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-[var(--lb-space-3)]">
                                <div>
                                    <p className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                        {theme.review_count}
                                    </p>
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Reviews
                                    </p>
                                </div>
                                <div>
                                    <p className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                        {formatCount(theme.install_count)}
                                    </p>
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Installs
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card layout="stack" className="gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                            <div className="flex items-center gap-[var(--lb-space-2)]">
                                <Package className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                                <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                    Theme info
                                </h2>
                            </div>
                            <InfoList
                                items={[
                                    { term: 'Category', description: categoryLabel },
                                    { term: 'Version', description: `v${theme.version}` },
                                    { term: 'Author', description: theme.author_name },
                                    { term: 'Published', description: publicationLabel(theme.published_at) },
                                    { term: 'Platforms', description: platformLabel(theme) },
                                ]}
                            />
                        </Card>

                        {standaloneDownloads.length > 0 && (
                            <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                                <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                    Standalone downloads
                                </h2>
                                <InfoList
                                    items={standaloneDownloads.map((row) => ({
                                        term: row.label,
                                        description: formatPrice(row.value),
                                    }))}
                                />
                            </Card>
                        )}
                    </aside>
                </div>

                {similarThemes.length > 0 && (
                    <Section
                        title="Similar themes"
                        description={`More ${categoryLabel.toLowerCase()} themes from the LetBuyy marketplace.`}
                        className="px-0 py-0"
                    >
                        <div className="grid grid-cols-1 gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-3">
                            {similarThemes.map((similarTheme) => (
                                <ThemeCard key={similarTheme.id} theme={similarTheme} />
                            ))}
                        </div>
                    </Section>
                )}
            </PageContent>
        </Page>
    );
}
