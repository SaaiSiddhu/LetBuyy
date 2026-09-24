import Link from 'next/link';
import { Heart } from '@letbuyy/ui';
import type { Metadata } from 'next';
import ThemeFavoritesList from '@/components/theme-favorites-list';
import { normalizeThemeRecord } from '@/lib/theme-catalog';
import { ThemeService } from '@/lib/theme-service';

export const metadata: Metadata = { title: 'Saved Themes' };

export default async function FavoritesPage() {
    const result = await ThemeService.listThemes({ limit: 100, sort: 'popular' });
    const themes = result.ok ? result.value.themes.map(normalizeThemeRecord) : [];

    return (
        <div>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Saved Themes</h1>
                    <p className="text-sm text-text-muted">
                        Private device-local favorites for shortlisting marketplace themes.
                    </p>
                </div>
                <Link href="/themes" className="btn-primary flex items-center gap-2 self-start px-4 py-2 text-sm sm:self-auto">
                    <Heart className="h-4 w-4" aria-hidden="true" />
                    Browse themes
                </Link>
            </div>

            <ThemeFavoritesList themes={themes} />
        </div>
    );
}
