import { LiquidThemePackageBundleSchema, ThemeLiquidSectionSchema, type LiquidThemePackageBundle } from '../../../../../../../packages/theme-engine/src/theme-bundle.ts';
import { createPantryTheme } from '../../../../../../../packages/theme-engine/src/pantry-theme.ts';
import { withNicheOrderPresentation } from '../../../../../../../packages/theme-engine/src/niche-order-presentation.ts';

const rowHeading = '{% if section.settings.showHeading %}{% if section.settings.title != blank %}<h2>{{ section.settings.title }}</h2>{% elsif collection.title != blank %}<h2>{{ collection.title }}</h2>{% endif %}{% endif %}';
const rowAnchor = '<div class="pn-wrap pn-section">{% if collection.products.size > 0 %}';
const oldOrderHeading = '<h1>Order #{{ order.number }}</h1>';
const orderHeading = '<h1>{% if section.settings.heading != blank %}{{ section.settings.heading }}{% else %}Order{% endif %} #{{ order.number }}</h1>';
const factsMarker = 'lb:niche-order-presentation:v1';
const factsStyle = 'data-niche-order-presentation="1"';

function assertRowContract(bundle: LiquidThemePackageBundle): void {
  const rows = bundle.sections['collection-product-list'];
  const fields = rows?.schema.settings.filter(field => field.id === 'showHeading') ?? [];
  const title = rows?.schema.settings.find(field => field.id === 'title');
  if (!rows || fields.length !== 1 || fields[0].type !== 'toggle' || fields[0].default !== false
    || title?.type !== 'text' || title.default !== 'Everyday staples'
    || rows.source.split(rowHeading).length !== 2) {
    throw new Error('Pantry 2.0.1 requires the exact opt-in row-heading contract.');
  }
}

function assertSuccessorContract(bundle: LiquidThemePackageBundle): void {
  assertRowContract(bundle);
  const detail = bundle.sections['customer-order-detail'];
  const heading = detail?.schema.settings.find(field => field.id === 'heading');
  if (bundle.package.version_number !== 3 || heading?.type !== 'text' || heading.default !== 'Order'
    || !detail || detail.source.split(orderHeading).length !== 2
    || detail.source.split(factsMarker).length !== 2
    || bundle.layout.theme.source.split(factsStyle).length !== 2) {
    throw new Error('Pantry 2.0.1 requires the canonical order identity and saved-facts contract.');
  }
}

/** Explicit append-only successor; captured 2.0.0, merchant values and default visuals stay intact. */
export function createPantryThemeV201(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
  if (base.package.slug === 'letbuyy-refresh' && base.package.version === '2.0.1') {
    assertSuccessorContract(base);
    return LiquidThemePackageBundleSchema.parse(structuredClone(base));
  }

  // Existing Pantry documents must not pass through the defaults factory again.
  const source = base.package.slug === 'letbuyy-refresh' && base.package.version === '2.0.0'
    ? structuredClone(base) : createPantryTheme(base);
  // Apply the canonical immutable-facts decorator while its supported version is still 2.0.0.
  const bundle = withNicheOrderPresentation(source);
  const rows = bundle.sections['collection-product-list'];
  const title = rows?.schema.settings.find(field => field.id === 'title');
  if (!rows || title?.type !== 'text' || title.default !== 'Everyday staples') {
    throw new Error('Pantry 2.0.1 requires the unchanged 2.0.0 row-heading descriptor.');
  }
  if (rows.schema.settings.some(field => field.id === 'showHeading')) {
    // Reuse the already-qualified private correction without duplicating its setting or body.
    assertRowContract(bundle);
  } else {
    if (rows.source.split(rowAnchor).length !== 2) {
      throw new Error('Pantry 2.0.1 requires the unchanged 2.0.0 collection-row source.');
    }
    rows.schema = ThemeLiquidSectionSchema.parse({ ...rows.schema, settings: [
      ...rows.schema.settings, { id: 'showHeading', type: 'toggle', label: 'Show heading', default: false },
    ] });
    rows.source = rows.source.replace(rowAnchor, `<div class="pn-wrap pn-section">${rowHeading}{% if collection.products.size > 0 %}`);
    rows.source = rows.source.replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/, `{% schema %}\n${JSON.stringify(rows.schema)}\n{% endschema %}`);
  }

  const detail = bundle.sections['customer-order-detail'];
  const declaredHeading = detail?.schema.settings.find(field => field.id === 'heading');
  if (!detail || declaredHeading?.type !== 'text' || declaredHeading.default !== 'Order'
    || detail.source.split(oldOrderHeading).length !== 2) {
    throw new Error('Pantry 2.0.1 requires the unchanged canonical order heading.');
  }
  detail.source = detail.source.replace(oldOrderHeading, orderHeading);
  bundle.package = { ...bundle.package, version: '2.0.1', version_number: 3 };
  delete bundle.package.checksum;
  assertSuccessorContract(bundle);
  return LiquidThemePackageBundleSchema.parse(bundle);
}
