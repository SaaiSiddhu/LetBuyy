'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star, Download, Eye, Heart } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { CATEGORY_LABELS, formatPrice, formatCount, cn } from '@/lib/utils';

interface ThemeCardProps {
    theme: Theme;
    featured?: boolean;
}

export default function ThemeCard({ theme, featured = false }: ThemeCardProps) {
    const isFree = theme.letbuyy_pricing_type === 'free';
    const priceLabel = formatPrice(theme.letbuyy_price_usd);
    const pricingContext = isFree
        ? 'No purchase required'
        : theme.letbuyy_pricing_type === 'subscription'
            ? 'Subscription theme'
            : 'One-time purchase';
    const ratingLabel = Number.isFinite(theme.rating) ? theme.rating.toFixed(1) : '0.0';
    const categoryLabel = CATEGORY_LABELS[theme.category]?.label ?? theme.category;
    const visibleTags = theme.tags.slice(0, 3);

    return (
        <Link
            href={`/themes/${theme.slug}`}
            aria-label={`Open ${theme.name} theme details`}
            className={cn(
                'group glass-card flex min-h-full flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                featured && 'ring-1 ring-primary/20'
            )}
        >
            <div className="relative aspect-video overflow-hidden bg-surface">
                <Image
                    src={theme.thumbnail_url}
                    alt={theme.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105 group-focus-visible:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />

                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <div className="flex w-full items-center gap-2">
                        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-primary-cta)] px-3 text-xs font-semibold text-[color:var(--lb-color-primary-cta-text)] shadow-[var(--lb-shadow-md)]">
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Preview theme
                        </span>
                        <span className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-[var(--lb-radius-md)] border border-white/20 bg-white/15 text-white backdrop-blur-md">
                            <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">Save theme</span>
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

                <div className="absolute top-3 left-3">
                    <span className="rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase text-white/80 backdrop-blur-md">
                        {categoryLabel}
                    </span>
                </div>
            </div>

            <div className="flex flex-grow flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-text-heading transition-colors group-hover:text-primary-light group-focus-visible:text-primary-light">
                        {theme.name}
                    </h3>
                    <span className="whitespace-nowrap text-[10px] text-text-subtle">
                        v{theme.version}
                    </span>
                </div>

                <p className="line-clamp-2 text-xs leading-relaxed text-text-muted">
                    {theme.description}
                </p>

                {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {visibleTags.map(tag => (
                            <span
                                key={tag}
                                className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-text-muted"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className="mt-auto grid gap-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="m-0 text-sm font-semibold text-text-heading">{priceLabel}</p>
                            <p className="m-0 text-[10px] text-text-subtle">{pricingContext}</p>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-surface px-2 py-1" aria-label={`${ratingLabel} out of 5 from ${theme.review_count} reviews`}>
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />
                            <span className="text-xs font-medium text-text-heading">{ratingLabel}</span>
                            <span className="text-[10px] text-text-subtle">({theme.review_count})</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[10px] text-text-subtle">
                        <span
                            className="inline-flex items-center gap-1"
                            aria-label={`${formatCount(theme.install_count)} installs`}
                        >
                            <Download className="h-3 w-3" aria-hidden="true" />
                            {formatCount(theme.install_count)} installs
                        </span>
                        <span className="truncate">{theme.author_name}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
