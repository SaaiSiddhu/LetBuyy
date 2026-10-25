import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from './theme-bundle';
import { createThreadlineTheme } from './threadline-theme';
import { withConfiguredOrderHeading, CONFIGURED_ORDER_HEADING_SOURCE } from './niche-order-presentation';

const originalCategoryHeading = '<div class="tl-heading"><h2>{{ section.settings.title }}</h2></div>';
const configuredCategoryHeading = '<div class="tl-heading">{% if section.settings.subtitle != blank %}<div><h2>{{ section.settings.title }}</h2><p>{{ section.settings.subtitle }}</p></div>{% else %}<h2>{{ section.settings.title }}</h2>{% endif %}</div>';
const originalCollectionHeading = "{{ collection.title | default: 'Clothing' }}";
const configuredCollectionHeading = "{{ section.settings.title | strip | default: collection.title | default: 'Clothing' }}";

function replaceHeading(source: string, before: string, after: string): string {
    if (source.split(before).length !== 2 || source.includes(after)) {
        throw new Error('Threadline 2.0.1 requires the unchanged 2.0.0 heading contract.');
    }
    return source.replace(before, after);
}

/** Explicit successor construction; saved Threadline documents never re-enter the defaults factory. */
export function createThreadlineThemeV201(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    const saved = base.package.slug === 'letbuyy-sense' && ['2.0.0', '2.0.1'].includes(base.package.version);
    const fresh = base.package.version === '1.0.0'
        && ['letbuyy-core-liquid', 'urban-kicks-liquid', 'letbuyy-sense'].includes(base.package.slug);
    if (!saved && !fresh) throw new Error('Threadline 2.0.1 requires a canonical Core distribution or saved Threadline input.');

    if (saved && base.package.version === '2.0.1') {
        if (base.package.version_number !== 3
            || base.sections['category-grid']?.source.split(configuredCategoryHeading).length !== 2
            || base.sections['category-grid'].source.includes(originalCategoryHeading)
            || base.sections['collection-product-list']?.source.split(configuredCollectionHeading).length !== 2
            || base.sections['collection-product-list'].source.includes(originalCollectionHeading)
            || base.sections['collection-product-list'].schema.settings.find(field => field.id === 'title')?.default !== ''
            || base.sections['customer-order-detail']?.source.split(CONFIGURED_ORDER_HEADING_SOURCE).length !== 2) {
            throw new Error('Threadline 2.0.1 requires its exact configured heading contract.');
        }
        return withConfiguredOrderHeading(base);
    }

    const bundle = saved ? structuredClone(base) : createThreadlineTheme(base);
    const category = bundle.sections['category-grid'];
    const collection = bundle.sections['collection-product-list'];
    const subtitle = category?.schema.settings.find(field => field.id === 'subtitle');
    const title = collection?.schema.settings.find(field => field.id === 'title');
    if (subtitle?.type !== 'text' || title?.type !== 'text' || title.default !== 'Clothing') {
        throw new Error('Threadline 2.0.1 requires the canonical subtitle and collection text controls.');
    }
    category.source = replaceHeading(category.source, originalCategoryHeading, configuredCategoryHeading);
    collection.source = replaceHeading(collection.source, originalCollectionHeading, configuredCollectionHeading);
    title.label = 'Heading override (blank uses collection name)';
    title.default = '';
    if (collection.source.split('{% schema %}').length !== 2 || collection.source.split('{% endschema %}').length !== 2) {
        throw new Error('Threadline 2.0.1 requires one collection section schema.');
    }
    collection.source = collection.source.replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/,
        `{% schema %}\n${JSON.stringify(collection.schema)}\n{% endschema %}`);

    if (!saved) {
        // These two values were inert in the old distribution. Do not clear saved merchant content.
        const silhouettes = bundle.templates['list-collections'].sections['list-collections-grid'].settings;
        const search = bundle.templates.search.sections['search-results'].settings;
        if (silhouettes.subtitle !== 'Browse every collection in the store.' || search.title !== 'Results') {
            throw new Error('Threadline distribution defaults changed; review the successor.');
        }
        silhouettes.subtitle = '';
        search.title = '';
    }
    const successor = withConfiguredOrderHeading(bundle);
    successor.package = { ...successor.package, version: '2.0.1', version_number: 3 };
    delete successor.package.checksum;
    return LiquidThemePackageBundleSchema.parse(successor);
}
