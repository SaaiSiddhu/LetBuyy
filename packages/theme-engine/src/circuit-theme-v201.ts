import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from './theme-bundle';
import { createCircuitTheme } from './circuit-theme';
import { withNicheOrderPresentation, withConfiguredOrderHeading, CONFIGURED_ORDER_HEADING_SOURCE } from './niche-order-presentation';

const optionalResultsHeading = '{% if section.settings.title != blank %}<h2>{{ section.settings.title }}</h2>{% endif %}';

/** Private proposed successor. Captured 2.0.0 source and default catalog dispatch stay unchanged. */
export function createCircuitThemeV201(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
  if (base.package.slug === 'letbuyy-forge' && base.package.version === '2.0.1') {
    if (!base.sections['collection-product-list']?.source.includes(optionalResultsHeading)
      || !base.sections['customer-order-detail']?.source.includes(CONFIGURED_ORDER_HEADING_SOURCE)) {
      throw new Error('Circuit 2.0.1 requires its exact heading-control contract.');
    }
    return LiquidThemePackageBundleSchema.parse(structuredClone(base));
  }

  // Reuse canonical saved-order presentation while the base is still its accepted 2.0.0 input.
  const bundle = withNicheOrderPresentation(createCircuitTheme(base));
  const results = bundle.sections['collection-product-list'];
  const title = results.schema.settings.find(field => field.id === 'title');
  const anchor = '<div>{% if collection.sort_options.size > 0 %}';
  if (!title || title.type !== 'text' || title.default !== 'Products'
    || results.source.split(anchor).length !== 2) {
    throw new Error('Circuit 2.0.1 requires the unchanged 2.0.0 results section contract.');
  }
  // An empty optional default retains the approved default page; explicit merchant edits render.
  title.default = '';
  results.source = results.source.replace(anchor, `<div>${optionalResultsHeading}{% if collection.sort_options.size > 0 %}`);
  results.source = results.source.replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/, `{% schema %}\n${JSON.stringify(results.schema)}\n{% endschema %}`);

  const successor = withConfiguredOrderHeading(bundle);
  successor.package = { ...successor.package, version: '2.0.1', version_number: 3 };
  delete successor.package.checksum;
  return LiquidThemePackageBundleSchema.parse(successor);
}
