import MarketplacePageHeader from '@/components/marketplace-page-header';
import { hasRenderableThemeTemplate } from '@letbuyy/theme-engine';
import ThemeDetailHero from '@/components/theme-detail-hero';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { Theme, ThemeCategory, ThemePricingType } from '@letbuyy/theme-engine';
import {
    Card,
    Button,
    Check,
    Download,
    EmptyState,
    ExternalLink,
    Eye,
    Input,
    Page,
    PageContent,
    Package,
    Section,
    ShoppingCart,
    Star,
} from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import {
    ThemeChangelog,
    ThemeDetailSharePanel,
    ThemeLiveDemoEmbed,
    ThemeQualityFacts,
} from '@/components/theme-detail-experience';
import ThemePreferenceActions from '@/components/theme-preference-actions';
import { ThemeService } from '@/lib/theme-service';
import { buildStorefrontPreviewUrl } from '@/lib/public-urls';
import { CATEGORY_LABELS, formatCount, formatPrice, formatThemePrice, themeCompareSingleHref, themeSandboxPreviewHref } from '@/lib/utils';

interface Props {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ preview?: string; review?: string; report?: string }>;
}

const CATEGORY_PREVIEW_FALLBACK: Record<ThemeCategory, string> = {
    store: '/previews/store.png',
    portfolio: '/previews/portfolio.png',
    resume: '/previews/resume.png',
    landing: '/previews/landing.png',
    saas: '/previews/saas-console-card.png',
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

function optionalRecordValue(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const value = record[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function optionalStringArray(record: Record<string, unknown> | null, key: string): string[] {
    if (!record) return [];
    return stringArrayValue(record, key);
}

function changelogValue(record: Record<string, unknown>): Theme['changelog'] {
    const value = record.changelog;
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const entry = item as Record<string, unknown>;
        const version = stringValue(entry, 'version');
        const changes = stringArrayValue(entry, 'changes');
        return version && changes.length > 0 ? [{
            version,
            released_at: stringValue(entry, 'released_at') || stringValue(entry, 'date') || undefined,
            changes,
        }] : [];
    });
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
        performance_report: optionalRecordValue(record, 'performance_report'),
        accessibility_report: optionalRecordValue(record, 'accessibility_report'),
        compatibility: (() => {
            const compatibility = optionalRecordValue(record, 'compatibility');
            return compatibility ? {
                browsers: optionalStringArray(compatibility, 'browsers'),
                locales: optionalStringArray(compatibility, 'locales'),
                platforms: optionalStringArray(compatibility, 'platforms'),
                minimum_viewport: stringValue(compatibility, 'minimum_viewport') || undefined,
            } : null;
        })(),
        changelog: changelogValue(record),
    };
}

function uniqueGalleryImages(theme: Theme): string[] {
    const images = [theme.preview_url, theme.thumbnail_url, ...theme.screenshots].filter((item): item is string => Boolean(item));
    return Array.from(new Set(images));
}

function publicationLabel(value: string | null): string {
    if (!value) return 'Publication date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Publication date unavailable';
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

function formStringValue(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value : '';
}

function storeName(store: Record<string, unknown>): string {
    return stringValue(store, 'store_name') || stringValue(store, 'name') || stringValue(store, 'subdomain') || 'Untitled store';
}

async function createPreviewSessionAction(formData: FormData) {
    'use server';

    const slug = formStringValue(formData.get('theme'));
    const storeId = formStringValue(formData.get('store_id'));
    if (!slug || !storeId) {
        redirect(slug ? `/themes/${encodeURIComponent(slug)}?preview=missing-store` : '/themes');
    }

    let previewUrl = '';
    try {
        const preview = await ThemeService.createThemePreviewSession(slug, storeId);
        previewUrl = buildStorefrontPreviewUrl(preview.preview_token);
    } catch {
        redirect(`/themes/${encodeURIComponent(slug)}?preview=unavailable`);
    }

    redirect(previewUrl);
}

async function createThemeReviewAction(formData: FormData) {
    'use server';

    const slug = formStringValue(formData.get('theme'));
    const rating = Number(formStringValue(formData.get('rating')));
    const title = formStringValue(formData.get('title'));
    const content = formStringValue(formData.get('content'));

    if (!slug || !Number.isInteger(rating) || rating < 1 || rating > 5 || title.length < 3 || content.length < 10) {
        redirect(slug ? `/themes/${encodeURIComponent(slug)}?review=invalid` : '/themes');
    }

    try {
        await ThemeService.createThemeReview(slug, { rating, title, content });
    } catch {
        redirect(`/themes/${encodeURIComponent(slug)}?review=not-eligible`);
    }

    redirect(`/themes/${encodeURIComponent(slug)}?review=pending`);
}

async function reportThemeAction(formData: FormData) {
    'use server';

    const slug = formStringValue(formData.get('theme'));
    const reason = formStringValue(formData.get('reason'));
    const details = formStringValue(formData.get('details'));

    if (!slug || reason.length < 3) {
        redirect(slug ? `/themes/${encodeURIComponent(slug)}?report=invalid` : '/themes');
    }

    try {
        await ThemeService.reportTheme(slug, {
            reason,
            ...(details ? { details } : {}),
        });
    } catch {
        redirect(`/themes/${encodeURIComponent(slug)}?report=auth`);
    }

    redirect(`/themes/${encodeURIComponent(slug)}?report=created`);
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

export default async function ThemeDetailPage({ params, searchParams }: Props) {
    const { slug } = await params;
    const query = await searchParams;
    const record = await ThemeService.getThemeBySlug(slug);
    if (!record) {
        return (
            <Page className="theme-marketplace-page marketplace marketplace-theme-detail">
                <MarketplacePageHeader artwork="discover"
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
                            title="This theme is unavailable"
                            body="Browse the marketplace for active themes or check the theme link again."
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
    const addHref = isFree ? `/install?theme=${encodeURIComponent(theme.slug)}&version=${encodeURIComponent(theme.version)}` : `/checkout?theme=${encodeURIComponent(theme.slug)}`;
    const addLabel = isFree ? 'Add to library' : 'Buy and add';
    const sandboxPreviewHref = themeSandboxPreviewHref(theme.slug, theme.version);
    const compareHref = themeCompareSingleHref(theme.slug);
    const galleryImages = uniqueGalleryImages(theme);
    const priceLabel = formatThemePrice(theme);
    const ratingLabel = Number.isFinite(theme.rating) ? theme.rating.toFixed(1) : '0.0';
    const categoryLabel = CATEGORY_LABELS[theme.category]?.label ?? theme.category;
    const standaloneDownloads = standaloneRows(theme);
    const hasReviews = theme.review_count > 0;
    const hasInstalls = theme.install_count > 0;
    const authorHandle = stringValue(record, 'author_handle');

    const [similarResult, stores, reviewResult] = await Promise.all([
        ThemeService.listThemes({
            category: theme.category,
            limit: 4,
        }),
        ThemeService.getUserStores(),
        ThemeService.getThemeReviews(theme.slug),
    ]);
    const similarRecords = similarResult.ok ? similarResult.value.themes : [];
    const similarThemes = similarRecords
        .map(normalizeThemeRecord)
        .filter((item) => item.id !== theme.id)
        .slice(0, 3);
    const reviewSummary = reviewResult.summary;
    const publishedReviews = reviewResult.reviews;
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: theme.name,
        description: theme.description,
        image: galleryImages,
        brand: 'LetBuyy',
        category: categoryLabel,
        offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: theme.letbuyy_price_inr,
            availability: 'https://schema.org/InStock',
            url: `/themes/${theme.slug}`,
        },
        ...(reviewSummary.total > 0 ? {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: reviewSummary.average,
                reviewCount: reviewSummary.total,
            },
        } : {}),
    };
    const defaultPreviewStore = stores.length === 1 ? stores[0] : null;
    const defaultPreviewStoreId = defaultPreviewStore ? stringValue(defaultPreviewStore, 'id') : '';

    return (
        <Page className="theme-marketplace-page marketplace marketplace-theme-detail">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <ThemeDetailHero theme={theme} addHref={addHref} addLabel={addLabel} />

            <PageContent>
                <nav className="marketplace-detail-nav" aria-label="Theme details">
                    <a href="#demo">Preview</a><a href="#overview">Overview</a><a href="#features">Features</a><a href="#reviews">Reviews</a><a href="#theme-support">Support & details</a>
                </nav>
                <ThemeLiveDemoEmbed theme={theme} available={hasRenderableThemeTemplate(record.default_template)} />

                <div className="theme-detail-body-layout">
                    <div className="flex min-w-0 flex-col gap-[var(--lb-density-section-gap)]">
                        <Section
                            id="overview"
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

                        <ThemeQualityFacts theme={theme} />

                        <ThemeChangelog theme={theme} />

                        <Section id="features" title="Features" className="px-0 py-0">
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
                                        <Link
                                            key={tag}
                                            href={`/themes?tag=${encodeURIComponent(tag)}`}
                                            className="inline-flex min-h-[var(--lb-density-pill-height)] items-center rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]"
                                        >
                                            {tag}
                                        </Link>
                                    ))}
                                </Card>
                            </Section>
                        )}

                        <Section id="reviews" title="Reviews" className="px-0 py-0">
                            <Card className="grid gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-[220px_minmax(0,1fr)]">
                                    <div>
                                        <p className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                            {reviewSummary.average.toFixed(1)}
                                        </p>
                                        <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                            {reviewSummary.total === 1 ? '1 published review' : `${reviewSummary.total} published reviews`}
                                        </p>
                                    </div>
                                    <div className="grid gap-[var(--lb-space-2)]">
                                        {(['5', '4', '3', '2', '1'] as const).map((rating) => {
                                            const count = reviewSummary.distribution[rating] || 0;
                                            const percent = reviewSummary.total > 0 ? Math.round((count / reviewSummary.total) * 100) : 0;
                                            return (
                                                <div key={rating} className="grid grid-cols-[44px_minmax(0,1fr)_56px] items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                    <span>{rating} star</span>
                                                    <span className="h-2 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)]" aria-hidden="true" />
                                                    <span className="text-right">{count} · {percent}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {query?.review === 'pending' && (
                                    <WarningPanel title="Review sent for moderation">
                                        Your verified-purchase review was saved and will appear after moderation.
                                    </WarningPanel>
                                )}
                                {query?.review === 'not-eligible' && (
                                    <WarningPanel title="Verified purchase required">
                                        Reviews can be submitted after this theme has a completed purchase on your account.
                                    </WarningPanel>
                                )}
                                {query?.review === 'invalid' && (
                                    <WarningPanel title="Review needs more detail">
                                        Add a rating, a short title, and at least ten characters of review text.
                                    </WarningPanel>
                                )}

                                {publishedReviews.length > 0 ? (
                                    <div className="grid gap-[var(--lb-space-3)]">
                                        {publishedReviews.map((review) => (
                                            <article key={String(review.id)} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
                                                <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-2)]">
                                                    <h3 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                                        {typeof review.title === 'string' && review.title ? review.title : 'Verified review'}
                                                    </h3>
                                                    <span className="inline-flex items-center gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                        <Star className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] fill-[var(--lb-color-warning)] text-[color:var(--lb-color-warning)]" aria-hidden="true" />
                                                        {Number(review.rating || 0).toFixed(0)}
                                                    </span>
                                                </div>
                                                <p className="m-0 mt-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                                    {typeof review.content === 'string' ? review.content : ''}
                                                </p>
                                                {typeof review.developer_reply === 'string' && review.developer_reply && (
                                                    <p className="m-0 mt-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text)]">
                                                        Author reply: {review.developer_reply}
                                                    </p>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                        No published reviews yet.
                                    </p>
                                )}

                                <form action={createThemeReviewAction} className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                    <Input unstyled type="hidden" name="theme" value={theme.slug} />
                                    <div className="grid gap-[var(--lb-space-2)] sm:grid-cols-[140px_minmax(0,1fr)]">
                                        <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                            Rating
                                            <select
                                                name="rating"
                                                required
                                                defaultValue="5"
                                                className="h-[var(--lb-density-input-height)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                            >
                                                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                                            </select>
                                        </label>
                                        <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                            Title
                                            <Input unstyled
                                                name="title"
                                                required
                                                minLength={3}
                                                maxLength={140}
                                                className="h-[var(--lb-density-input-height)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                            />
                                        </label>
                                    </div>
                                    <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                        Review
                                        <textarea
                                            name="content"
                                            required
                                            minLength={10}
                                            maxLength={4000}
                                            rows={4}
                                            className="rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                        />
                                    </label>
                                    <Button unstyled type="submit" className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)]">
                                        Submit verified review
                                    </Button>
                                </form>
                            </Card>
                        </Section>

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

                    <aside id="theme-support" className="flex min-w-0 flex-col gap-[var(--lb-density-section-gap)]" aria-label="Theme actions and details">
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

                            <Link
                                href={compareHref}
                                className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            >
                                <Package className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Add to compare
                            </Link>

                            {stores.length > 0 ? (
                                <form action={createPreviewSessionAction} className="grid gap-[var(--lb-space-2)]">
                                    <Input unstyled type="hidden" name="theme" value={theme.slug} />
                                    <label htmlFor="preview-store" className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                        Preview store
                                    </label>
                                    <select
                                        id="preview-store"
                                        name="store_id"
                                        required
                                        className="h-[var(--lb-density-input-height)] w-full rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] outline-none focus:border-[var(--lb-component-input-focus-border)] focus:ring-2 focus:ring-[var(--lb-color-focus-ring)]"
                                        defaultValue={defaultPreviewStoreId}
                                    >
                                        <option value="" disabled>{stores.length === 1 ? 'Selected store' : 'Choose a store'}</option>
                                        {stores.map((store) => {
                                            const id = stringValue(store, 'id');
                                            if (!id) return null;
                                            return <option key={id} value={id}>{storeName(store)}</option>;
                                        })}
                                    </select>
                                    <Button unstyled
                                        type="submit"
                                        className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    >
                                        <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        {stores.length === 1 ? `Preview in ${storeName(defaultPreviewStore || {})}` : 'Preview in your store'}
                                    </Button>
                                </form>
                            ) : (
                                <Link
                                    href={sandboxPreviewHref}
                                    className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Open sandbox preview
                                </Link>
                            )}

                            {query?.preview === 'unavailable' && (
                                <WarningPanel title="Preview unavailable">
                                    The preview session could not be created for the selected store. Try again or contact support.
                                </WarningPanel>
                            )}
                            {query?.preview === 'missing-store' && (
                                <WarningPanel title="Choose a store">
                                    A store selection is required before the marketplace can create a theme preview session.
                                </WarningPanel>
                            )}
                        </Card>

                        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                            <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                Shortlist
                            </h2>
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                Save this theme privately on this device or add it to a side-by-side comparison.
                            </p>
                            <ThemePreferenceActions theme={theme} />
                        </Card>

                        <ThemeDetailSharePanel theme={theme} />

                        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                            <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                Report this theme
                            </h2>
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                Report quality, abuse, or listing accuracy concerns to the marketplace review queue.
                            </p>
                            {query?.report === 'created' && (
                                <WarningPanel title="Report submitted">
                                    Your report was saved for marketplace review.
                                </WarningPanel>
                            )}
                            {query?.report === 'auth' && (
                                <WarningPanel title="Sign in required">
                                    Sign in before reporting a marketplace listing.
                                </WarningPanel>
                            )}
                            {query?.report === 'invalid' && (
                                <WarningPanel title="Report reason required">
                                    Add a short reason before submitting a report.
                                </WarningPanel>
                            )}
                            <form action={reportThemeAction} className="grid gap-[var(--lb-space-2)]">
                                <Input unstyled type="hidden" name="theme" value={theme.slug} />
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                    Reason
                                    <Input unstyled
                                        name="reason"
                                        required
                                        minLength={3}
                                        maxLength={120}
                                        className="h-[var(--lb-density-input-height)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                    />
                                </label>
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                    Details
                                    <textarea
                                        name="details"
                                        rows={3}
                                        maxLength={2000}
                                        className="rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                    />
                                </label>
                                <Button unstyled type="submit" className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)]">
                                    Submit report
                                </Button>
                            </form>
                        </Card>

                        {(hasReviews || hasInstalls) ? (
                            <Card layout="stack" className="gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                            <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    Marketplace proof
                                </span>
                                {hasReviews && (
                                    <span className="inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                        <Star className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] fill-[var(--lb-color-warning)] text-[color:var(--lb-color-warning)]" aria-hidden="true" />
                                        {ratingLabel}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-[var(--lb-space-3)]">
                                {hasReviews && <div>
                                    <p className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                        {theme.review_count}
                                    </p>
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Reviews
                                    </p>
                                </div>}
                                {hasInstalls && <div>
                                    <p className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                        {formatCount(theme.install_count)}
                                    </p>
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Installs
                                    </p>
                                </div>}
                            </div>
                        </Card>
                        ) : (
                            <Card className="p-[var(--lb-density-card-padding)]">
                                <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                    Marketplace proof is not available for this listing yet.
                                </p>
                            </Card>
                        )}

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
                                    { term: 'Author', description: authorHandle ? <Link href={`/authors/${encodeURIComponent(authorHandle)}`}>{theme.author_name}</Link> : theme.author_name },
                                    { term: 'Published', description: publicationLabel(theme.published_at) },
                                    { term: 'Platforms', description: platformLabel(theme) },
                                ]}
                            />
                        </Card>

                        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                            <h2 className="m-0 text-[length:var(--lb-font-size-card-title)]">Before you choose</h2>
                            <p className="m-0 text-[color:var(--lb-color-text-subdued)]">Review the package’s price, usage information, and support route. Adding a design to your store library is separate from publishing it.</p>
                            <Link href="/guides/preview-a-theme" className="marketplace-text-link">What to check in a preview</Link>
                            <Link href="/legal/license" className="marketplace-text-link">Theme license information</Link>
                            <Link href="/legal/refund" className="marketplace-text-link">Refund and purchase information</Link>
                            <Link href="/support" className="marketplace-text-link">Get help with this theme</Link>
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
