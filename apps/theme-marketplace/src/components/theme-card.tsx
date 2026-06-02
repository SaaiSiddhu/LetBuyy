'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star, Download, Eye, Heart } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { formatPrice, formatCount, cn } from '@/lib/utils';

interface ThemeCardProps {
    theme: Theme;
    featured?: boolean;
}

export default function ThemeCard({ theme, featured = false }: ThemeCardProps) {
    const isFree = theme.letbuyy_pricing_type === 'free';

    return (
        <Link
            href={`/themes/${theme.slug}`}
            className={cn(
                'group glass-card overflow-hidden flex flex-col',
                featured && 'ring-1 ring-primary/20'
            )}
        >
            {/* Thumbnail */}
            <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                    src={theme.thumbnail_url}
                    alt={theme.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />

                {/* Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <div className="flex items-center gap-2 w-full">
                        <span className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                        </span>
                        <span className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto">
                            <Heart className="w-3.5 h-3.5" />
                        </span>
                    </div>
                </div>

                {/* Price Badge */}
                <div className="absolute top-3 right-3">
                    <span className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md',
                        isFree
                            ? 'bg-success/20 text-success border border-success/30'
                            : 'bg-primary/20 text-primary-light border border-primary/30'
                    )}>
                        {formatPrice(theme.letbuyy_price_usd)}
                    </span>
                </div>

                {/* Category Badge */}
                <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-black/50 text-white/80 backdrop-blur-md border border-white/10">
                        {theme.category}
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="p-4 flex flex-col flex-grow gap-2">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-heading group-hover:text-primary-light transition-colors line-clamp-1">
                        {theme.name}
                    </h3>
                    <span className="text-[10px] text-text-subtle whitespace-nowrap">
                        v{theme.version}
                    </span>
                </div>

                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                    {theme.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-1">
                    {theme.tags.slice(0, 3).map(tag => (
                        <span
                            key={tag}
                            className="px-2 py-0.5 text-[10px] rounded-full bg-surface text-text-muted"
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Bottom Stats */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                    <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                        <span className="text-xs font-medium text-text-heading">{theme.rating}</span>
                        <span className="text-[10px] text-text-subtle">({theme.review_count})</span>
                    </div>
                    <div className="flex items-center gap-1 text-text-subtle">
                        <Download className="w-3 h-3" />
                        <span className="text-[10px]">{formatCount(theme.install_count)}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
