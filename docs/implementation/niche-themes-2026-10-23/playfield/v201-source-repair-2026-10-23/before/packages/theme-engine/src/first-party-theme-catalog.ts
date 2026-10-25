import { listExperiences, buildExperienceSettingsOverlay } from './theme-presets';
import { createLetbuyyCoreLiquidThemeBundleFixture } from './theme-bundle-core';
import { LiquidThemePackageBundleSchema } from './theme-bundle';
import { createThreadlineTheme } from './threadline-theme';
import { createPlayfieldTheme } from './playfield-theme';
import { createCircuitTheme } from './circuit-theme';
import { createPantryTheme } from './pantry-theme';
import { createHabitatTheme } from './habitat-theme';
import { createKindredTheme } from './kindred-theme';
import { createMadeYoursTheme } from './madeyours-theme';
import { createDewdropTheme } from './dewdrop-theme';
import { createTrailmarkTheme } from './trailmark-theme';
import { createMarginaliaTheme } from './marginalia-theme';
import { withNicheOrderPresentation } from './niche-order-presentation';

// Explicit distribution input only. Persisted version selection remains the catalog's authority.
const NICHE_V2 = {
    bloom: { name: 'Playfield', category: 'toys', factory: createPlayfieldTheme },
    forge: { name: 'Circuit', category: 'electronics', factory: createCircuitTheme },
    refresh: { name: 'Pantry', category: 'food', factory: createPantryTheme },
    craft: { name: 'Habitat', category: 'furniture', factory: createHabitatTheme },
    summit: { name: 'Kindred', category: 'gifts', factory: createKindredTheme },
    nova: { name: 'MadeYours', category: 'personalized', factory: createMadeYoursTheme },
    aura: { name: 'Dewdrop', category: 'beauty', factory: createDewdropTheme },
    ride: { name: 'Trailmark', category: 'sports', factory: createTrailmarkTheme },
    dawn: { name: 'Marginalia', category: 'books', factory: createMarginaliaTheme },
} as const;
type CatalogBuildOptions = { designVersion?: '2.0.0' };
// Identity is independent of catalog order and display copy. Existing Core/Urban
// Kicks stores and their saved experience selections are deliberately untouched.
const IDENTITIES: Readonly<Record<string, string>> = {
    forge: '7b669c70-0000-4000-8000-000000000001',
    sense: '7b669c70-0000-4000-8000-000000000002',
    aura: '7b669c70-0000-4000-8000-000000000003',
    craft: '7b669c70-0000-4000-8000-000000000004',
    refresh: '7b669c70-0000-4000-8000-000000000005',
    ride: '7b669c70-0000-4000-8000-000000000006',
    dawn: '7b669c70-0000-4000-8000-000000000007',
    bloom: '7b669c70-0000-4000-8000-000000000008',
    nova: '7b669c70-0000-4000-8000-000000000009',
    summit: '7b669c70-0000-4000-8000-000000000010',
};
/** Distribution input for the persisted themes catalog, not a second live catalog. */
export function firstPartyThemeListings(options: CatalogBuildOptions = {}) {
    return listExperiences().map(experience => {
        const id = IDENTITIES[experience.id];
        if (!id)
            throw new Error(`Missing stable theme identity: ${experience.id}`);
        const niche = options.designVersion === '2.0.0' && Object.hasOwn(NICHE_V2, experience.id)
            ? NICHE_V2[experience.id as keyof typeof NICHE_V2] : undefined;
        return {
            id, slug: `letbuyy-${experience.id}`, name: niche?.name ?? experience.name,
            presetId: experience.id, description: experience.description,
            category: niche?.category ?? (experience.industry || 'General'),
            thumbnail: experience.id === 'sense' ? '/theme-previews/threadline-2.0.0.webp' : `/theme-previews/${experience.id}.svg`,
            settings: buildExperienceSettingsOverlay(experience),
            preview: experience.preview,
        };
    });
}
export function createFirstPartyCatalogBundle(slug: string, options: CatalogBuildOptions = {}) {
    const listing = firstPartyThemeListings(options).find(theme => theme.slug === slug);
    if (!listing)
        throw new Error('Unknown first-party catalog theme');
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    bundle.package.slug = slug;
    bundle.package.name = listing.name;
    const configured = LiquidThemePackageBundleSchema.parse({ ...bundle, config: { ...bundle.config,
            settings_data: { ...bundle.config.settings_data, current: {
                    ...bundle.config.settings_data.current, ...listing.settings,
                } },
        } });
    if (listing.presetId === 'sense') return createThreadlineTheme(configured);
    if (options.designVersion === '2.0.0' && Object.hasOwn(NICHE_V2, listing.presetId)) {
        return withNicheOrderPresentation(NICHE_V2[listing.presetId as keyof typeof NICHE_V2].factory(configured));
    }
    return configured;
}
