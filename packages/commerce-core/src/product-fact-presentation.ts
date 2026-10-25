import { readProductNicheFacts, readVariantNicheFacts } from './niche-product-facts';
import { deriveFoodUnitPrice, type FoodNetQuantity } from './pantry-facts';
import { resolveFurnitureFacts, type FurnitureDimensions, type FurnitureFacts } from './habitat-facts';
import { resolveSportsMeasurements, type SportsMeasurements } from './trailmark-facts';
import { mergeBooksVariantFacts, type BooksFacts } from './marginalia-facts';
import { resolveToyFacts, type ToyFacts } from './playfield-facts';

type TextDisplay = Record<string, string | number | boolean>;

function foodDisplay(net: FoodNetQuantity | null | undefined, priceMinor?: number): TextDisplay {
  if (!net) return {};
  const price = deriveFoodUnitPrice(priceMinor ?? NaN, net);
  return {
    netQuantityValue: net.value, netQuantityUnit: net.unit, basisQuantity: 100,
    ...(price ? { unitPriceMinor: price.amountMinor } : {}),
  };
}

function furnitureDimensions(value: FurnitureDimensions | undefined, labelled: boolean): string | undefined {
  if (!value) return undefined;
  const parts = value.diameter !== undefined ? [`${value.diameter} Ø`]
    : ([['width', 'W'], ['depth', 'D']] as const).flatMap(([key, label]) => value[key] === undefined ? [] : [`${value[key]}${labelled ? ` ${label}` : ''}`]);
  if (value.height !== undefined) parts.push(`${value.height}${labelled ? ' H' : ''}`);
  return parts.length ? `${parts.join(' × ')} ${value.unit}` : undefined;
}
function furnitureDisplay(facts: FurnitureFacts): TextDisplay {
  const assembled = furnitureDimensions(facts.assembled, true);
  const packaged = furnitureDimensions(facts.package, true);
  return {
    ...(assembled ? { assembled } : {}), ...(packaged ? { package: packaged } : {}),
    ...(facts.weight ? { weight: `${facts.weight.value} ${facts.weight.unit}` } : {}),
    ...(facts.seat_height ? { seat_height: `${facts.seat_height.value} ${facts.seat_height.unit}` } : {}),
    ...(facts.materials ? { materials: facts.materials.join(' · ') } : {}),
    ...(facts.assembly ? { assembly: [
      facts.assembly.status === 'assembled' ? 'Arrives assembled' : facts.assembly.status === 'required' ? 'Assembly required' : 'Assembly information not supplied',
      facts.assembly.instructions,
      facts.assembly.tools ? `Tools: ${facts.assembly.tools}` : undefined,
    ].filter(Boolean).join(' · ') } : {}),
    ...(facts.care ? { care: facts.care } : {}),
  };
}
function sportsDisplay(facts: SportsMeasurements): TextDisplay {
  return {
    ...(facts.length ? { length: `${facts.length.value} ${facts.length.unit}` } : {}),
    ...(facts.weight ? { weight: `${facts.weight.value} ${facts.weight.unit}` } : {}),
    ...(facts.gripCircumference ? { grip: `${facts.gripCircumference.value} ${facts.gripCircumference.unit}` } : {}),
    ...(facts.dimensions ? { dimensions: `${facts.dimensions.length} × ${facts.dimensions.width}${facts.dimensions.height === undefined ? '' : ` × ${facts.dimensions.height}`} ${facts.dimensions.unit}` } : {}),
  };
}
function booksDisplay(facts: BooksFacts): TextDisplay {
  return {
    ...(facts.kind === 'book' ? {
      ...(facts.authors ? { authors: facts.authors.join(', ') } : {}),
      ...(facts.language ? { language: facts.language } : {}),
      ...(facts.format ? { format: facts.format } : {}),
      ...(facts.edition ? { edition: facts.edition } : {}),
    } : {}),
    ...(facts.dimensions_mm ? { dimensions: `${facts.dimensions_mm.width} × ${facts.dimensions_mm.height} mm` } : {}),
  };
}
function toysCard(facts: ToyFacts, hasOptions: boolean): TextDisplay {
  return {
    ...(facts.ageStatement || facts.ageBands.length ? { ageLabel: facts.ageStatement || facts.ageBands.map(band => `Ages ${band.replace('-', '–')}`).join(' · ') } : {}),
    ...(facts.contents.length ? { contentsLabel: facts.contents.map(row => `${row.quantity} × ${row.label}`).join(' · ') } : {}),
    contentsComplete: facts.contentsComplete,
    hasOptions,
  };
}

/** JSON stays a scalar through the generic depth cap. The renderer escapes the attribute once. */
function inertJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&]/g, character => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' })[character]!);
}

/** Derived display fields, not merchant input. Every namespace is validated before flattening. */
export function buildProductFactPresentation(input: {
  facts: unknown; priceMinor?: number; hasVariants?: boolean; hasOptions?: boolean; variantCount?: number;
}): Record<string, unknown> {
  const facts = readProductNicheFacts(input.facts);
  return {
    ...facts,
    ...(facts.food ? { food: { ...facts.food, ...foodDisplay(input.hasVariants ? null : facts.food.netQuantity, input.priceMinor) } } : {}),
    ...(facts.furniture ? { furniture_display: furnitureDisplay(facts.furniture) } : {}),
    ...(facts.sports ? { sports_display: sportsDisplay(facts.sports) } : {}),
    ...(facts.books ? { books_display: { ...booksDisplay(facts.books), multiple_editions: (input.variantCount ?? 0) > 1 } } : {}),
    ...(facts.toys ? { toys_card: toysCard(facts.toys, input.hasOptions === true) } : {}),
    ...(facts.electronics?.video ? { electronics_video_summary: `${facts.electronics.video.width_px} × ${facts.electronics.video.height_px} / ${facts.electronics.video.refresh_hz} Hz` } : {}),
    ...(facts.electronics?.connectors.some(row => row.role === 'power-output') ? { electronics_output_connector_summary: facts.electronics.connectors.filter(row => row.role === 'power-output').map(row => `${row.count} × ${row.kind.toUpperCase()}`).join(' · ') } : {}),
    ...(facts.gifts?.contents ? { gifts: { ...facts.gifts, itemCount: facts.gifts.contents.reduce((count, row) => count + row.quantity, 0) } } : {}),
    ...(facts.beauty ? { beauty: { ...facts.beauty, shadeCount: facts.beauty.shades.length, ...(facts.beauty.netQuantity ? { netQuantityLabel: `${facts.beauty.netQuantity.value} ${facts.beauty.netQuantity.unit}` } : {}) } } : {}),
    ...(facts.personalization ? {
      personalization_json: inertJson(facts.personalization),
      personalization: { ...facts.personalization, methodSummary: facts.personalization.methods.map(row => `${row.label} · ${row.min_graphemes}–${row.max_graphemes}`).join('; ') },
    } : {}),
  };
}

/** Called for a selected canonical variant. Food pack quantities never inherit product quantities. */
export function buildVariantFactPresentation(metadata: unknown, commonFacts: unknown, priceMinor?: number): Record<string, unknown> {
  const facts = readVariantNicheFacts(metadata);
  const common = readProductNicheFacts(commonFacts);
  const furniture = common.furniture ? resolveFurnitureFacts(common.furniture, facts.furniture) : facts.furniture;
  const sports = common.sports ? resolveSportsMeasurements(common.sports, facts.sports) : facts.sports;
  const books = facts.books ? mergeBooksVariantFacts(common.books ?? null, facts.books) : common.books;
  const toys = resolveToyFacts(common.toys, facts.toys);
  return {
    ...facts,
    ...(facts.food ? { food: { ...facts.food, ...foodDisplay(facts.food.netQuantity, priceMinor) } } : {}),
    ...(furniture ? { furniture_display: furnitureDisplay(furniture) } : {}),
    ...(sports ? { sports_display: sportsDisplay(sports) } : {}),
    ...(books ? { books_display: booksDisplay(books) } : {}),
    ...(toys ? { toys_card: toysCard(toys, false) } : {}),
  };
}
