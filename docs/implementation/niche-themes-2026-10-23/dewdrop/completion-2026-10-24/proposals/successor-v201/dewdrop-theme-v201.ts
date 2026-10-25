import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle';
import { createDewdropTheme } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/dewdrop-theme';
import { withConfiguredOrderHeading, withNicheOrderPresentation, CONFIGURED_ORDER_HEADING_SOURCE } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/niche-order-presentation';

const originalHeading = '{{ collection.title | default: section.settings.title }}';
const configuredHeading = "{{ section.settings.title | strip | default: collection.title | default: 'Find your everyday.' }}";
const orderFactsMarker = '<!-- lb:niche-order-presentation:v1 -->';

/** Explicit successor only. Saved merchant settings never re-enter a defaults factory. */
export function createDewdropThemeV201(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    const saved = base.package.slug === 'letbuyy-aura' && ['2.0.0', '2.0.1'].includes(base.package.version);
    const fresh = base.package.version === '1.0.0'
        && ['letbuyy-core-liquid', 'urban-kicks-liquid', 'letbuyy-aura'].includes(base.package.slug);
    if (!saved && !fresh) throw new Error('Dewdrop 2.0.1 requires canonical Core or saved Dewdrop input.');

    if (saved && base.package.version === '2.0.1') {
        const section = base.sections['collection-filter'];
        const title = section?.schema.settings.find(field => field.id === 'title');
        if (base.package.version_number !== 3 || title?.type !== 'text' || title.default !== ''
            || section.source.split(configuredHeading).length !== 2 || section.source.includes(originalHeading)
            || base.sections['customer-order-detail']?.source.split(CONFIGURED_ORDER_HEADING_SOURCE).length !== 2
            || base.sections['customer-order-detail'].source.split(orderFactsMarker).length !== 2) {
            throw new Error('Dewdrop 2.0.1 requires its exact configured heading and saved-facts contracts.');
        }
        return withConfiguredOrderHeading(base);
    }

    const bundle = saved ? structuredClone(base) : createDewdropTheme(base);
    const section = bundle.sections['collection-filter'];
    const title = section?.schema.settings.find(field => field.id === 'title');
    if (title?.type !== 'text' || title.default !== 'Find your everyday.'
        || section.source.split(originalHeading).length !== 2 || section.source.includes(configuredHeading)
        || section.source.split('{% schema %}').length !== 2 || section.source.split('{% endschema %}').length !== 2) {
        throw new Error('Dewdrop 2.0.1 requires the unchanged 2.0.0 discovery heading contract.');
    }
    section.source = section.source.replace(originalHeading, configuredHeading);
    title.label = 'Heading override (blank uses collection name)';
    title.default = '';
    section.source = section.source.replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/,
        `{% schema %}\n${JSON.stringify(section.schema)}\n{% endschema %}`);

    if (!saved) {
        const search = bundle.templates.search.sections['aura-care-search'];
        if (search?.type !== 'collection-filter' || search.settings.title !== 'Search your care shelf') {
            throw new Error('Dewdrop search distribution changed; review the successor.');
        }
        search.settings.title = '';
    }
    const successor = withConfiguredOrderHeading(withNicheOrderPresentation(bundle));
    successor.package = { ...successor.package, version: '2.0.1', version_number: 3 };
    delete successor.package.checksum;
    return LiquidThemePackageBundleSchema.parse(successor);
}
