'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button, Star, Download, Eye, ExternalLink, LayoutGrid, X } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import {
    CATEGORY_LABELS,
    cn,
    formatCount,
    formatRelativeUpdatedAt,
    formatReviewSummary,
    formatThemePrice,
    getThemeFreshnessBadge,
    themeCompareSingleHref,
    themeFacetHref,
    themeSandboxPreviewHref,
} from '@/lib/utils';
import ThemePreferenceActions from '@/components/theme-preference-actions';

interface ThemeCardProps {
    theme: Theme;
    featured?: boolean;
    initialQuickLookOpen?: boolean;
    renderPreviewImages?: boolean;
}

export default function ThemeCard({ theme, featured = false, initialQuickLookOpen = false, renderPreviewImages = true }: ThemeCardProps) {
    const [quickLookOpen, setQuickLookOpen] = useState(initialQuickLookOpen);
    const isFree = theme.letbuyy_pricing_type === 'free';
    const priceLabel = formatThemePrice(theme);
    const pricingContext = isFree
        ? 'No purchase required'
        : theme.letbuyy_pricing_type === 'subscription'
            ? 'Subscription theme'
            : 'One-time purchase';
    const ratingLabel = Number.isFinite(theme.rating) ? theme.rating.toFixed(1) : '0.0';
    const categoryLabel = CATEGORY_LABELS[theme.category]?.label ?? theme.category;
    const visibleTags = theme.tags.slice(0, 3);
    const visibleFeatures = theme.features.slice(0, 2);
    const hiddenTagCount = Math.max(theme.tags.length - visibleTags.length, 0);
    const hasReviews = theme.review_count > 0;
    const hasInstalls = theme.install_count > 0;
    const freshnessBadge = getThemeFreshnessBadge(theme);
    const relativeUpdated = formatRelativeUpdatedAt(theme.updated_at);
    const compareHref = themeCompareSingleHref(theme.slug);
    const previewHref = themeSandboxPreviewHref(theme.slug);

    return (
        <>
            <article
                className={cn(
                    'group glass-card flex min-h-full flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                    featured && 'ring-1 ring-primary/20'
                )}
            >
                <a
                    href={`/themes/${theme.slug}`}
                    aria-label={`Open ${theme.name} theme details`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                >
                    <div className="relative aspect-video overflow-hidden bg-surface">
                        {renderPreviewImages ? (
                            <Image
                                src={theme.thumbnail_url}
                                alt={theme.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105 group-focus-visible:scale-105"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                        ) : (
                            <div
                                role="img"
                                aria-label={theme.name}
                                className="absolute inset-0 bg-[var(--lb-color-surface-subdued)]"
                                data-testid="theme-card-preview-fallback"
                            />
                        )}

                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                            <div className="flex w-full items-center gap-2">
                                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-primary-cta)] px-3 text-xs font-semibold text-[color:var(--lb-color-primary-cta-text)] shadow-[var(--lb-shadow-md)]">
                                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                    View details
                                </span>
                            </div>
                        </div>

                        <div className="absolute top-3 right-3">
                            <span className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-bold backdrop-blur-md',
                                isFree
                                    ? 'bg-success/20 text-success border border-success/30'
                                    : 'bg-primary/20 text-primary-light border border-primary/30'
                            )}>
                                {priceLabel}
                            </span>
                        </div>

                        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                            <span className="rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase text-white/80 backdrop-blur-md">
                                {categoryLabel}
                            </span>
                            {freshnessBadge && (
                                <span className="rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-100 backdrop-blur-md" data-testid="theme-card-freshness">
                                    {freshnessBadge}
                                </span>
                            )}
                        </div>
                    </div>
                </a>

                <div className="flex flex-grow flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="line-clamp-2 text-sm font-semibold text-text-heading transition-colors group-hover:text-primary-light group-focus-visible:text-primary-light">
                            <a href={`/themes/${theme.slug}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                                {theme.name}
                            </a>
                        </h3>
                        <span className="whitespace-nowrap text-[10px] text-text-subtle">
                            v{theme.version}
                        </span>
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed text-text-muted">
                        {theme.description}
                    </p>

                    <p className="m-0 text-[10px] font-medium text-text-subtle" data-testid="theme-card-updated">
                        {relativeUpdated}
                    </p>

                    {(visibleTags.length > 0 || visibleFeatures.length > 0) && (
                        <div className="flex flex-wrap gap-1" aria-label={`${theme.name} facets`}>
                            {visibleTags.map(tag => (
                                <a
                                    key={`tag-${tag}`}
                                    href={themeFacetHref('tag', tag)}
                                    className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    {tag}
                                </a>
                            ))}
                            {visibleFeatures.map(feature => (
                                <a
                                    key={`feature-${feature}`}
                                    href={themeFacetHref('feature', feature)}
                                    className="rounded-full border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    {feature}
                                </a>
                            ))}
                            {hiddenTagCount > 0 && (
                                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-text-muted">
                                    +{hiddenTagCount} more
                                </span>
                            )}
                        </div>
                    )}

                    <div className="mt-auto grid gap-2 border-t border-border pt-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="m-0 text-sm font-semibold text-text-heading">{priceLabel}</p>
                                <p className="m-0 text-[10px] text-text-subtle">{pricingContext}</p>
                            </div>
                            <div className="flex items-center gap-1 rounded-full bg-surface px-2 py-1" aria-label={formatReviewSummary(theme.review_count, theme.rating)}>
                                <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />
                                {hasReviews ? (
                                    <>
                                        <span className="text-xs font-medium text-text-heading">{ratingLabel}</span>
                                        <span className="text-[10px] text-text-subtle">({theme.review_count})</span>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-text-subtle">0 reviews</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[10px] text-text-subtle">
                            {hasInstalls ? (
                                <span
                                    className="inline-flex items-center gap-1"
                                    aria-label={`${formatCount(theme.install_count)} installs`}
                                >
                                    <Download className="h-3 w-3" aria-hidden="true" />
                                    {formatCount(theme.install_count)} installs
                                </span>
                            ) : (
                                <span>Install data unavailable</span>
                            )}
                            <span className="truncate">{theme.author_name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <a
                                href={previewHref}
                                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-2 text-[11px] font-medium text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            >
                                <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Preview
                            </a>
                            <a
                                href={compareHref}
                                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-2 text-[11px] font-medium text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                data-testid="theme-card-compare-link"
                            >
                                <LayoutGrid className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Compare
                            </a>
                        </div>
                        <Button
                            unstyled
                            type="button"
                            onClick={() => setQuickLookOpen(true)}
                            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-2 text-[11px] font-medium text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            aria-haspopup="dialog"
                        >
                            <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Quick look
                        </Button>
                        <ThemePreferenceActions theme={theme} compact />
                    </div>
                </div>
            </article>

            {quickLookOpen && (
                <div className="fixed inset-0 z-[210] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
                    <div className="w-full max-w-2xl overflow-hidden rounded-[var(--lb-radius-xl)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)]" role="dialog" aria-modal="true" aria-label={`${theme.name} quick look`}>
                        <div className="relative aspect-video bg-[var(--lb-color-surface-subdued)]">
                            {renderPreviewImages ? (
                                <Image
                                    src={theme.preview_url || theme.thumbnail_url}
                                    alt={`${theme.name} quick look preview`}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, 640px"
                                />
                            ) : (
                                <div
                                    role="img"
                                    aria-label={`${theme.name} quick look preview`}
                                    className="absolute inset-0 bg-[var(--lb-color-surface-subdued)]"
                                    data-testid="theme-card-quick-look-preview-fallback"
                                />
                            )}
                            <Button
                                unstyled
                                type="button"
                                onClick={() => setQuickLookOpen(false)}
                                aria-label="Close quick look"
                                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-[var(--lb-radius-full)] border border-white/20 bg-black/50 text-white backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                        <div className="grid gap-4 p-5">
                            <div>
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase text-[color:var(--lb-color-text-subdued)]">
                                    Quick look
                                </p>
                                <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {theme.name}
                                </h2>
                                <p className="m-0 mt-1 text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                                    {theme.description}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-3 py-1 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {priceLabel}
                                </span>
                                <span className="rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-3 py-1 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {relativeUpdated}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <a
                                    href={`/themes/${theme.slug}`}
                                    className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-3 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)]"
                                >
                                    View details
                                </a>
                                <a
                                    href={compareHref}
                                    className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-3 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)]"
                                >
                                    Compare this theme
                                </a>
                                <a
                                    href={previewHref}
                                    className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-3 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)]"
                                >
                                    Open sandbox preview
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
