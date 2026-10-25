import { LiquidThemePackageBundleSchema, ThemeLiquidSectionSchema, type LiquidThemePackageBundle, type ThemeLiquidSectionFile } from '../../../../../../../packages/theme-engine/src/theme-bundle';

type Field = ThemeLiquidSectionFile['schema']['settings'][number];
const list = '<div class="pn-product-list">';
const selectableList = '<div class="pn-product-list{% if section.settings.shelfColumns == \'one\' %} pn-product-list--one{% endif %}">';
const storage = '{% if section.settings.showCardStorage and item.food.storage != blank %}<p class="pn-meta pn-card-storage"><strong>Storage:</strong> {{ item.food.storage }}</p>{% endif %}';
const cardPrice = '<p class="pn-card-price">';
const layout = 'class="lb-product-detail__layout pn-product-layout"';
const selectableLayout = 'class="lb-product-detail__layout pn-product-layout{% if section.settings.layout == \'stacked\' %} pn-product-layout--stacked{% endif %}"';
const layoutStyles = `{% if content_for_layout contains 'pn-product-list--one' or content_for_layout contains 'pn-product-layout--stacked' %}<style data-pantry-layout-controls="1">.pn-theme .pn-product-list--one{grid-template-columns:minmax(0,1fr)}.pn-theme .pn-product-layout.pn-product-layout--stacked{display:flex;flex-direction:column;align-items:stretch}.pn-theme .pn-product-layout.pn-product-layout--stacked>*{width:100%}</style>{% endif %}`;
const guideCondition = '{% if section.settings.content != blank or section.settings.image != blank %}';
const selectableGuide = '{% assign pn_has_guide_link = false %}{% if section.settings.linkLabel != blank and section.settings.linkUrl != blank %}{% assign pn_has_guide_link = true %}{% endif %}{% if section.settings.content != blank or section.settings.image != blank or pn_has_guide_link %}';
const typeScale = `{% if settings.pantryTextScale == 'comfortable' %}<style data-pantry-text-scale="1">.pn-theme{font-size:18px}.pn-theme .pn-meta,.pn-theme .pn-card-net,.pn-theme .pn-food-fact p,.pn-theme .pn-food-unknown p,.pn-theme .pn-net-info,.pn-theme .pn-pack-options,.pn-theme .pn-quantity-label{font-size:.984375rem}.pn-theme h1{font-size:clamp(2.25rem,4.5vw,3.375rem)}.pn-theme h2{font-size:clamp(1.85625rem,3.375vw,2.25rem)}.pn-theme h3{font-size:1.40625rem}.pn-theme .pn-food-facts h2{font-size:1.6875rem}.pn-theme .lb-product-detail__info h1{font-size:2.25rem}@media(max-width:600px){.pn-theme .lb-product-detail__info h1{font-size:2.1375rem}.pn-theme .pn-card h3{font-size:1.18125rem}}</style>{% endif %}`;

function replaceOnce(source: string, before: string, after: string, name: string): string {
  if (source.split(before).length !== 2) throw new Error(`Pantry controls require the exact ${name} source contract.`);
  return source.replace(before, after);
}

function update(file: ThemeLiquidSectionFile, additions: Field[], source: string): void {
  const existing = new Set(file.schema.settings.map(field => field.id));
  if (additions.some(field => existing.has(field.id))) throw new Error('Pantry control descriptor already exists without its complete source contract.');
  file.schema = ThemeLiquidSectionSchema.parse({ ...file.schema, settings: [...file.schema.settings, ...additions] });
  file.source = source.replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/, `{% schema %}\n${JSON.stringify(file.schema)}\n{% endschema %}`);
}

/** Private version-neutral proposal. Root must select the version/capture path before distribution. */
export function withPantryPresentationControls(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
  if (base.package.slug !== 'letbuyy-refresh' || base.package.version !== '2.0.1') throw new Error('Pantry controls require the admitted-source Pantry2.0.1 contract.');
  if (base.layout.theme.source.includes('data-pantry-text-scale="1"')) {
    if (!base.layout.theme.source.includes(layoutStyles)
      || !base.sections['product-detail'].source.includes(selectableLayout)
      || !base.sections['about-section'].source.includes(selectableGuide)
      || !['product-grid', 'collection-product-list', 'featured-products'].every(type => base.sections[type].source.includes(selectableList) && base.sections[type].source.includes(storage))) {
      throw new Error('Pantry controls refuse a partial presentation overlay.');
    }
    return LiquidThemePackageBundleSchema.parse(structuredClone(base));
  }
  const bundle = structuredClone(base);
  for (const type of ['product-grid', 'collection-product-list', 'featured-products']) {
    const file = bundle.sections[type];
    if (!file) throw new Error(`Missing Pantry section ${type}.`);
    const source = replaceOnce(replaceOnce(file.source, list, selectableList, type), cardPrice, storage + cardPrice, `${type} card`);
    update(file, [
      { id:'shelfColumns', type:'select', label:'Columns on wide screens', default:'responsive', options:['responsive','one'] },
      { id:'showCardStorage', type:'toggle', label:'Show supplied storage guidance on cards', default:false },
    ], source);
  }
  const product = bundle.sections['product-detail'];
  update(product, [{ id:'layout', type:'select', label:'Product layout', default:'ingredients', options:['ingredients','stacked'] }], replaceOnce(product.source, layout, selectableLayout, 'product layout'));
  const guide = bundle.sections['about-section'];
  guide.source = replaceOnce(guide.source, guideCondition, selectableGuide, 'merchant guide');
  const typography = bundle.config.settings_schema.settings.typography;
  if (!typography || typography.fields.pantryTextScale) throw new Error('Pantry controls require the unchanged canonical typography field group.');
  typography.fields.pantryTextScale = { type:'select', label:'Pantry text scale', default:'standard', options:['standard','comfortable'], info:'Standard preserves the approved design; comfortable increases the existing body and heading scale by 12.5%. No arbitrary CSS values.' };
  if (bundle.config.settings_data.current.pantryTextScale === undefined) bundle.config.settings_data.current.pantryTextScale = 'standard';
  bundle.layout.theme.source = replaceOnce(bundle.layout.theme.source, '</head>', layoutStyles + typeScale + '</head>', 'layout head');
  delete bundle.package.checksum;
  return LiquidThemePackageBundleSchema.parse(bundle);
}
