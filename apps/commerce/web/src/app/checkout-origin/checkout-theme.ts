import { firstPartyThemeListings } from '@letbuyy/theme-engine';

const styles = { forge: 'circuit', sense: 'threadline', refresh: 'pantry', craft: 'habitat', summit: 'kindred', nova: 'madeyours', aura: 'dewdrop', ride: 'trailmark', dawn: 'marginalia', bloom: 'playfield' } as const;
const catalog = firstPartyThemeListings({ designVersion: '2.0.0' });

/** Visual treatment only. Identity and palettes come from the published canonical catalog. */
export function checkoutThemeStyle(identity: string | null | undefined) {
    const theme = catalog.find(item => item.id === identity || item.slug === identity);
    const key = theme?.presetId as keyof typeof styles | undefined;
    return { slug: theme?.slug || 'default', style: key && styles[key] || 'standard' };
}
