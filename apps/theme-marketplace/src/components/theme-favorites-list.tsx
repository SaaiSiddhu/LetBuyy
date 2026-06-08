'use client';

import Link from 'next/link';
import { EmptyState } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import ThemeCard from '@/components/theme-card';
import { useThemePreferenceSlugs } from '@/components/theme-preference-actions';

export default function ThemeFavoritesList({ themes }: { themes: Theme[] }) {
    const { favorites, ready } = useThemePreferenceSlugs();
    const favoriteThemes = themes.filter((theme) => favorites.includes(theme.slug));

    if (!ready) {
        return (
            <div className="glass-card p-8 text-sm text-text-muted" role="status">
                Loading saved themes...
            </div>
        );
    }

    if (favoriteThemes.length === 0) {
        return (
            <div className="glass-card flex min-h-[360px] items-center justify-center p-8">
                <EmptyState
                    kind="themes"
                    title="No saved themes yet"
                    body="Use Save favorite on theme cards or detail pages to build a private shortlist on this device."
                    primaryAction={(
                        <Link href="/themes" className="btn-primary text-sm">
                            Browse themes
                        </Link>
                    )}
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {favoriteThemes.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
            ))}
        </div>
    );
}
