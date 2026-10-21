import { listExperiences, buildExperienceSettingsOverlay } from './theme-presets';
import { createLetbuyyCoreLiquidThemeBundleFixture } from './theme-bundle-core';
import { LiquidThemePackageBundleSchema } from './theme-bundle';
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
export function firstPartyThemeListings() {
    return listExperiences().map(experience => {
        const id = IDENTITIES[experience.id];
        if (!id)
            throw new Error(`Missing stable theme identity: ${experience.id}`);
        return {
            id, slug: `letbuyy-${experience.id}`, name: experience.name,
            presetId: experience.id, description: experience.description,
            category: experience.industry || 'General',
            thumbnail: `/theme-previews/${experience.id}.svg`,
            settings: buildExperienceSettingsOverlay(experience),
            preview: experience.preview,
        };
    });
}
export function createFirstPartyCatalogBundle(slug: string) {
    const listing = firstPartyThemeListings().find(theme => theme.slug === slug);
    if (!listing)
        throw new Error('Unknown first-party catalog theme');
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    bundle.package.slug = slug;
    bundle.package.name = listing.name;
    return LiquidThemePackageBundleSchema.parse({ ...bundle, config: { ...bundle.config,
            settings_data: { ...bundle.config.settings_data, current: {
                    ...bundle.config.settings_data.current, ...listing.settings,
                } },
        } });
}
