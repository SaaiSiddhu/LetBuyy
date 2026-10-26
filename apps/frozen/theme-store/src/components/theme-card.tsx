'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Eye, LayoutGrid, Modal, Star } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { CATEGORY_LABELS, formatRelativeUpdatedAt, formatReviewSummary, formatThemePrice, getThemeFreshnessBadge, themeCompareSingleHref, themeFacetHref, themeSandboxPreviewHref } from '@/lib/utils';
import ThemePreferenceActions from '@/components/theme-preference-actions';

interface ThemeCardProps {
    theme: Theme;
    featured?: boolean;
    initialQuickLookOpen?: boolean;
    renderPreviewImages?: boolean;
}

export default function ThemeCard({ theme, featured = false, initialQuickLookOpen = false, renderPreviewImages = true }: ThemeCardProps) {
    const [quickLookOpen, setQuickLookOpen] = useState(initialQuickLookOpen);
    const priceLabel = formatThemePrice(theme);
    const categoryLabel = CATEGORY_LABELS[theme.category]?.label ?? theme.category;
    const freshness = getThemeFreshnessBadge(theme);
    const updated = formatRelativeUpdatedAt(theme.updated_at);
    const previewHref = themeSandboxPreviewHref(theme.slug, theme.version);
    const compareHref = themeCompareSingleHref(theme.slug);
    const detailsHref = `/themes/${encodeURIComponent(theme.slug)}`;

    return <>
        <article className={`marketplace-theme-card${featured ? ' marketplace-theme-spotlight' : ''}`}>
            <Link href={detailsHref} aria-label={`Open ${theme.name} theme details`} className="marketplace-card-art">
                {renderPreviewImages ? <Image src={theme.thumbnail_url} alt={`${theme.name} theme screenshot`} fill sizes={featured ? '(max-width: 1024px) 100vw, 50vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'} /> : <div role="img" aria-label={theme.name} data-testid="theme-card-preview-fallback" />}
                {freshness && <span className="marketplace-card-freshness" data-testid="theme-card-freshness">{freshness}</span>}
            </Link>
            <div className="marketplace-card-content">
            <div className="marketplace-card-heading"><h3><Link href={detailsHref}>{theme.name}</Link></h3><span className="marketplace-card-price">{priceLabel}</span></div>
            <div className="marketplace-card-meta">
                <span>{theme.author_name}</span><span aria-hidden="true">·</span><span>{categoryLabel}</span>
                {theme.review_count > 0 && <span className="marketplace-rating" aria-label={formatReviewSummary(theme.review_count, theme.rating)}><Star aria-hidden="true" /> {theme.rating.toFixed(1)} ({theme.review_count})</span>}
            </div>
            <p className="marketplace-card-description">{theme.description}</p>
            <div className="marketplace-card-facets" aria-label={`${theme.name} facets`}>
                {theme.tags.slice(0, 2).map(tag => <Link key={`tag-${tag}`} href={themeFacetHref('tag', tag)}>{tag}</Link>)}
                {theme.features.slice(0, 1).map(feature => <Link key={`feature-${feature}`} href={themeFacetHref('feature', feature)}>{feature}</Link>)}
            </div>
            <p className="marketplace-card-meta" data-testid="theme-card-updated">{updated}</p>
            <div className="marketplace-card-footer">
                <Link href={previewHref} className="marketplace-card-control"><Eye aria-hidden="true" /> Preview</Link>
                <Button unstyled className="marketplace-card-control" type="button" aria-haspopup="dialog" onClick={() => setQuickLookOpen(true)}>Quick look</Button>
                <Link href={compareHref} className="sr-only" data-testid="theme-card-compare-link">Compare {theme.name}</Link>
            </div>
            <ThemePreferenceActions theme={theme} compact className="marketplace-card-preferences" />
            </div>
        </article>
        <Modal open={quickLookOpen} onClose={() => setQuickLookOpen(false)} title={`${theme.name} quick look`} description={theme.description}>
            <div className="marketplace-quick-look">
                <div className="marketplace-quick-look-art">{renderPreviewImages ? <Image src={theme.thumbnail_url} alt={`${theme.name} quick look preview`} fill sizes="(max-width: 640px) 100vw, 640px" /> : <div role="img" aria-label={`${theme.name} quick look preview`} data-testid="theme-card-quick-look-preview-fallback" />}</div>
                <div className="marketplace-card-heading"><strong>{priceLabel}</strong><span>{theme.letbuyy_pricing_type === 'free' ? 'No purchase required' : theme.letbuyy_pricing_type === 'subscription' ? 'Subscription theme' : 'One-time purchase'}</span></div>
                <p className="marketplace-card-meta">Version {theme.version} · {updated}</p>
                <div className="marketplace-hero-actions">
                    <Link href={detailsHref} className="marketplace-action">View details</Link>
                    <Link href={previewHref} className="marketplace-action marketplace-action-secondary"><Eye aria-hidden="true" /> Open sandbox preview</Link>
                    <Link href={compareHref} className="marketplace-text-link"><LayoutGrid size={16} aria-hidden="true" /> Compare this theme</Link>
                </div>
            </div>
        </Modal>
    </>;
}
