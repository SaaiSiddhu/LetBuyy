'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, Heart, LayoutGrid } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { cn } from '@/lib/utils';

const FAVORITES_KEY = 'letbuyy.themeMarketplace.favorites.v1';
const COMPARE_KEY = 'letbuyy.themeMarketplace.compare.v1';
const MAX_COMPARE_THEMES = 4;

function readStoredSlugs(key: string, maxItems = 100): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, maxItems);
    } catch {
        return [];
    }
}

function writeStoredSlugs(key: string, slugs: string[], maxItems = 100) {
    window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(slugs)).slice(0, maxItems)));
    window.dispatchEvent(new CustomEvent('letbuyy-theme-preferences-changed'));
}

export function themeCompareHref(slugs: string[]) {
    const selected = Array.from(new Set(slugs.filter(Boolean))).slice(0, MAX_COMPARE_THEMES);
    return selected.length > 0 ? `/themes/compare?themes=${selected.map(encodeURIComponent).join(',')}` : '/themes/compare';
}

export function useThemePreferenceSlugs() {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [compare, setCompare] = useState<string[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const load = () => {
            setFavorites(readStoredSlugs(FAVORITES_KEY));
            setCompare(readStoredSlugs(COMPARE_KEY, MAX_COMPARE_THEMES));
            setReady(true);
        };

        load();
        window.addEventListener('storage', load);
        window.addEventListener('letbuyy-theme-preferences-changed', load);
        return () => {
            window.removeEventListener('storage', load);
            window.removeEventListener('letbuyy-theme-preferences-changed', load);
        };
    }, []);

    return { favorites, compare, ready };
}

interface ThemePreferenceActionsProps {
    theme: Pick<Theme, 'slug' | 'name'>;
    compact?: boolean;
    className?: string;
}

export default function ThemePreferenceActions({ theme, compact = false, className }: ThemePreferenceActionsProps) {
    const { favorites, compare, ready } = useThemePreferenceSlugs();
    const [message, setMessage] = useState('');
    const isFavorite = favorites.includes(theme.slug);
    const isCompared = compare.includes(theme.slug);
    const compareHref = useMemo(() => themeCompareHref(compare), [compare]);

    function toggleFavorite() {
        const next = isFavorite
            ? favorites.filter((slug) => slug !== theme.slug)
            : [theme.slug, ...favorites];
        writeStoredSlugs(FAVORITES_KEY, next);
        setMessage(isFavorite ? `${theme.name} removed from favorites.` : `${theme.name} saved to favorites.`);
    }

    function toggleCompare() {
        if (isCompared) {
            writeStoredSlugs(COMPARE_KEY, compare.filter((slug) => slug !== theme.slug), MAX_COMPARE_THEMES);
            setMessage(`${theme.name} removed from compare.`);
            return;
        }

        if (compare.length >= MAX_COMPARE_THEMES) {
            setMessage(`Compare supports up to ${MAX_COMPARE_THEMES} themes. Remove one before adding another.`);
            return;
        }

        writeStoredSlugs(COMPARE_KEY, [...compare, theme.slug], MAX_COMPARE_THEMES);
        setMessage(`${theme.name} added to compare.`);
    }

    const buttonClass = compact
        ? 'inline-flex min-h-9 items-center justify-center gap-1 rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-2 text-[11px] font-medium text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]'
        : 'inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]';

    return (
        <div className={cn('grid gap-[var(--lb-space-2)]', className)}>
            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                <Button
                    unstyled
                    type="button"
                    className={cn(buttonClass, isFavorite && 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]')}
                    aria-pressed={isFavorite}
                    onClick={toggleFavorite}
                    disabled={!ready}
                >
                    <Heart className={cn('h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]', isFavorite && 'fill-[var(--lb-color-primary)] text-[color:var(--lb-color-primary)]')} aria-hidden="true" />
                    {compact ? (isFavorite ? 'Saved' : 'Save') : (isFavorite ? 'Saved favorite' : 'Save favorite')}
                </Button>
                <Button
                    unstyled
                    type="button"
                    className={cn(buttonClass, isCompared && 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]')}
                    aria-pressed={isCompared}
                    onClick={toggleCompare}
                    disabled={!ready}
                >
                    <LayoutGrid className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    {compact ? (isCompared ? 'Comparing' : 'Compare') : (isCompared ? 'In compare' : 'Add to compare')}
                </Button>
                {compare.length >= 2 && (
                    <Link
                        href={compareHref}
                        className={cn(buttonClass, 'border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] text-[color:var(--lb-component-button-secondary-text)]')}
                    >
                        Compare {compare.length}
                    </Link>
                )}
            </div>
            {message && (
                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]" role="status">
                    {message}
                </p>
            )}
        </div>
    );
}
