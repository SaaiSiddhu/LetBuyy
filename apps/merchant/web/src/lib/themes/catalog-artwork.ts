import type { ThemeCatalogItem } from '@letbuyy/api-client';

// Presentation assets captured from the public, read-only 2.0 sample stores.
// Catalog identity, versions, availability and installation remain server-owned.
const artwork: Readonly<Record<string, string>> = {
    'letbuyy-sense': 'threadline',
    'letbuyy-forge': 'circuit',
    'letbuyy-bloom': 'playfield',
    'letbuyy-refresh': 'pantry',
    'letbuyy-craft': 'habitat',
    'letbuyy-summit': 'kindred',
    'letbuyy-nova': 'madeyours',
    'letbuyy-aura': 'dewdrop',
    'letbuyy-ride': 'trailmark',
    'letbuyy-dawn': 'marginalia',
};

/** Replace only the known first-party placeholder for its exact captured version. */
export function catalogArtworkUrl(theme: Pick<ThemeCatalogItem, 'slug' | 'version' | 'thumbnail_url'>): string | null | undefined {
    const name = Object.hasOwn(artwork, theme.slug) ? artwork[theme.slug] : undefined;
    const placeholder = `/theme-previews/${theme.slug.replace(/^letbuyy-/, '')}.svg`;
    const original = theme.thumbnail_url;
    if (name && theme.version === '2.0.0' && (!original || original === placeholder
        || (theme.slug === 'letbuyy-sense' && original === '/theme-previews/threadline-2.0.0.webp'))) {
        return `/theme-previews/catalog-v2/${name}.webp`;
    }
    return original;
}
