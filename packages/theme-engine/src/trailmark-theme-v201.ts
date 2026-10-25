import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from './theme-bundle';
import { createTrailmarkTheme } from './trailmark-theme';
import { withNicheOrderPresentation, withConfiguredOrderHeading, CONFIGURED_ORDER_HEADING_SOURCE } from './niche-order-presentation';

const fallbackHeading = '{{ collection.title | default: section.settings.title }}';
const customHeading = `{% if section.settings.headingOverride != blank %}{{ section.settings.headingOverride }}{% else %}${fallbackHeading}{% endif %}`;
const savedFactsMarker = '<!-- lb:niche-order-presentation:v1 -->';

/** Explicit opt-in successor. Frozen2.0.0 factories and persisted merchant data remain unchanged. */
export function createTrailmarkThemeV201(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
  if (base.package.slug === 'letbuyy-ride' && base.package.version === '2.0.1') {
    const results = base.sections['collection-product-list'];
    const detail = base.sections['customer-order-detail'];
    if (!results?.source.includes(customHeading)
      || results.schema.settings.find(field => field.id === 'headingOverride')?.type !== 'text'
      || !detail?.source.includes(CONFIGURED_ORDER_HEADING_SOURCE) || !detail.source.includes(savedFactsMarker)) {
      throw new Error('Trailmark 2.0.1 requires its heading and saved-order presentation contract.');
    }
    return LiquidThemePackageBundleSchema.parse(structuredClone(base));
  }

  // The canonical saved-facts helper accepts the existing2.0.0 builder input before version advances.
  const bundle = withNicheOrderPresentation(createTrailmarkTheme(base));
  const results = bundle.sections['collection-product-list'];
  const title = results?.schema.settings.find(field => field.id === 'title');
  if (!results || !title || title.type !== 'text' || title.default !== 'Equipment'
    || results.schema.settings.some(field => field.id === 'headingOverride')
    || results.source.split(fallbackHeading).length !== 2) {
    throw new Error('Trailmark 2.0.1 requires the unchanged2.0.0 collection heading contract.');
  }
  // A separate blank override preserves existing titles/fallback values and approved default visuals.
  title.label = 'Fallback heading';
  results.schema.settings.push({ id: 'headingOverride', type: 'text', label: 'Heading override', default: '' });
  results.source = results.source.replace(fallbackHeading, customHeading)
    .replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/, `{% schema %}\n${JSON.stringify(results.schema)}\n{% endschema %}`);

  if (!bundle.sections['customer-order-detail']?.source.includes(savedFactsMarker)) {
    throw new Error('Trailmark 2.0.1 requires the canonical saved-facts order detail contract.');
  }
  const successor = withConfiguredOrderHeading(bundle);
  successor.package = { ...successor.package, version: '2.0.1', version_number: 3 };
  delete successor.package.checksum;
  return LiquidThemePackageBundleSchema.parse(successor);
}
