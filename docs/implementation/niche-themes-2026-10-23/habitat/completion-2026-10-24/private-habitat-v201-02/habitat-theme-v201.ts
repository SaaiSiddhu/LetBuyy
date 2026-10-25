import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '../../../../../../packages/theme-engine/src/theme-bundle';
import { createHabitatTheme } from '../../../../../../packages/theme-engine/src/habitat-theme';
import { withNicheOrderPresentation, withConfiguredOrderHeading, CONFIGURED_ORDER_HEADING_SOURCE } from '../../../../../../packages/theme-engine/src/niche-order-presentation';

const factsMarker = '<!-- lb:niche-order-presentation:v1 -->';
const factsStyle = 'data-niche-order-presentation="1"';
const originalBadgeSource = '<span {{ block.editor_attributes | raw }} class="lb-badge">{{ block.settings.label }}</span>';
const childOutlet = '{% for child in block.sub_blocks %}{% unless child.is_app_block %}{{ child.html | raw }}{% endunless %}{% endfor %}';

function assertHabitatSuccessor(bundle: LiquidThemePackageBundle): void {
  const detail = bundle.sections['customer-order-detail'];
  const heading = detail?.schema.settings.find(field => field.id === 'heading');
  const badge = bundle.blocks.badge;
  if (bundle.package.slug !== 'letbuyy-craft' || bundle.package.version !== '2.0.1'
    || bundle.package.version_number !== 3 || heading?.type !== 'text' || heading.default !== 'Order'
    || !detail || detail.source.split(CONFIGURED_ORDER_HEADING_SOURCE).length !== 2
    || detail.source.split(factsMarker).length !== 2
    || bundle.layout.theme.source.split(factsStyle).length !== 2
    || badge?.source !== originalBadgeSource + childOutlet
    || badge.schema.settings.length !== 1 || badge.schema.settings[0].id !== 'label') {
    throw new Error('Habitat 2.0.1 requires the canonical order heading, saved-facts and reusable-child contract.');
  }
}

/** Explicit successor opt-in; frozen2.0.0 factories and existing merchant values stay intact. */
export function createHabitatThemeV201(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
  if (base.package.slug === 'letbuyy-craft' && base.package.version === '2.0.1') {
    assertHabitatSuccessor(base);
    return LiquidThemePackageBundleSchema.parse(structuredClone(base));
  }
  if (base.package.slug === 'letbuyy-craft' && base.package.version !== '2.0.0') {
    throw new Error('Habitat successor input version is not supported.');
  }
  const source = base.package.slug === 'letbuyy-craft' && base.package.version === '2.0.0'
    ? structuredClone(base) : createHabitatTheme(base);
  const successor = withConfiguredOrderHeading(withNicheOrderPresentation(source));
  const badge = successor.blocks.badge;
  if (!badge || badge.source !== originalBadgeSource || badge.schema.settings.length !== 1
    || badge.schema.settings[0].id !== 'label') {
    throw new Error('Habitat successor requires the unchanged reusable badge contract.');
  }
  // The canonical renderer supplies sanitized first-party child HTML; no app output is activated.
  badge.source += childOutlet;
  successor.package = { ...successor.package, version: '2.0.1', version_number: 3 };
  delete successor.package.checksum;
  assertHabitatSuccessor(successor);
  return LiquidThemePackageBundleSchema.parse(successor);
}
