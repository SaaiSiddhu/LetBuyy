/** Public synthetic preview content. Never install these records into a merchant catalog. */
import { BooksFactsSchema, BooksVariantFactsSchema, type ProductModel } from '@letbuyy/commerce-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { StoreNavigation } from '@letbuyy/tenant-core';

const media = '/theme-assets/marginalia/v2/';
const basePath = '/store/urban-kicks-demo';
const bookId = '7b669c70-7100-4000-8000-000000000001';
const thoughtId = '7b669c70-7100-4000-8000-000000000002';
const paperId = '7b669c70-7100-4000-8000-000000000003';
const commonBook = BooksFactsSchema.parse({ kind: 'book', authors: ['Mira Sen'], subjects: ['Essays', 'Nature and place'], excerpt: { text: 'We began the morning with a blank page. Outside, the city was already writing its own story. A bicycle passed the gate; a cup rested on the low wall. There was room, we found, to notice both.\n\nThis is where the notebook began: not with a destination, but with the small things we had hurried past.', permission: 'merchant_owned', attribution: 'Original fictional demonstration excerpt, created for Marginalia by LetBuyy. Not a quotation from a published book.' } });
const fieldNotes: ProductModel = { id: bookId, name: 'Field Notes for a Slower City', description: 'Fictional essays about attention, everyday places and a slower way through the city. Demonstration product; not for sale.', price: 480, currency: 'INR', stock: 9, isActive: true, category: 'Essays', images: [media + 'field-notes-cover.webp'], variantOptions: [{ name: 'Edition', values: ['English paperback', 'English illustrated hardback', 'Hindi paperback'] }], variants: [
  Object.assign({ id: '7b669c70-7200-4000-8000-000000000001', name: 'English paperback', price: 480, stock: 6, options: { Edition: 'English paperback' } }, { metadata: { books: BooksVariantFactsSchema.parse({ kind: 'book', language: 'English', format: 'paperback', edition: 'First edition', pages: 208, dimensions_mm: { width: 140, height: 216 } }) } }),
  Object.assign({ id: '7b669c70-7200-4000-8000-000000000002', name: 'English illustrated hardback', price: 780, stock: 3, options: { Edition: 'English illustrated hardback' } }, { metadata: { books: BooksVariantFactsSchema.parse({ kind: 'book', language: 'English', format: 'hardback', edition: 'Illustrated edition', pages: 240, dimensions_mm: { width: 156, height: 234 } }) } }),
  Object.assign({ id: '7b669c70-7200-4000-8000-000000000003', name: 'Hindi paperback', price: 460, stock: 0, options: { Edition: 'Hindi paperback' } }, { metadata: { books: BooksVariantFactsSchema.parse({ kind: 'book', language: 'Hindi', format: 'paperback', edition: 'Hindi edition', pages: 216, dimensions_mm: { width: 140, height: 216 } }) } }),
] };
const smallThought: ProductModel = { id: thoughtId, name: 'The Shape of a Small Thought', description: 'A fictional collection of short reflections for an unhurried afternoon. Demonstration product; not for sale.', price: 420, currency: 'INR', stock: 5, isActive: true, category: 'Essays', images: [media + 'small-thought-cover.webp'], variants: [], variantOptions: [] };
const notebook: ProductModel = { id: paperId, name: 'Olive A5 blank notebook', description: 'Fictional paper goods with explicit gsm, millimetres, page and sheet counts. Demonstration product; not for sale.', price: 320, currency: 'INR', stock: 12, isActive: true, category: 'Stationery', images: [media + 'notebook.webp'], variants: [], variantOptions: [] };

// Canonical ProductModel records enriched with the validated public namespace, not app-local DTOs.
export const MARGINALIA_DEMO_PRODUCTS: ProductModel[] = [
  Object.assign(fieldNotes, { books: commonBook }),
  Object.assign(smallThought, { books: BooksFactsSchema.parse({ kind: 'book', authors: ['Dev Rao'], subjects: ['Essays'], language: 'English', format: 'paperback', edition: 'First edition', pages: 160 }) }),
  Object.assign(notebook, { books: BooksFactsSchema.parse({ kind: 'stationery', paper_gsm: 100, dimensions_mm: { width: 148, height: 210 }, page_count: 96, sheet_count: 48, ruling: 'blank', binding: 'Thread sewn', included: ['One notebook'], materials: 'Paper pages with an olive-coloured cover. Fictional demonstration specification.' }) }),
];
export const MARGINALIA_DEMO_COLLECTIONS = [
  { id: '7b669c70-7300-4000-8000-000000000001', handle: 'essays', title: 'Essays', description: 'A fictional reading shelf.', image_url: media + 'field-notes-cover.webp', product_count: 2 },
  { id: '7b669c70-7300-4000-8000-000000000002', handle: 'stationery', title: 'Stationery', description: 'Paper for your own words. Fictional demonstration collection.', image_url: media + 'notebook.webp', product_count: 1 },
  { id: '7b669c70-7300-4000-8000-000000000003', handle: 'reading-soon', title: 'Reading soon', description: 'An intentionally empty fictional shelf for the empty collection preview.', image_url: '', product_count: 0 },
];
/** Exact public preview membership. A known empty shelf is distinct from a missing ID. */
export const MARGINALIA_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]> = {
  '7b669c70-7300-4000-8000-000000000001': [bookId, thoughtId],
  '7b669c70-7300-4000-8000-000000000002': [paperId],
  '7b669c70-7300-4000-8000-000000000003': [],
};
export const MARGINALIA_DEMO_NAVIGATION: StoreNavigation = {
  main: [
    { id: 'marginalia-books', label: 'Books', href: basePath + '/products', isDefault: false, isVisible: true },
    { id: 'marginalia-paper', label: 'Paper & stationery', href: basePath + `/product/${paperId}`, isDefault: false, isVisible: true },
    { id: 'marginalia-reading', label: 'Read a sample', href: basePath + `/product/${bookId}#reading-sample`, isDefault: false, isVisible: true },
  ],
  footer: [{ id: 'marginalia-all', label: 'Explore the shelves', href: basePath + '/products', isDefault: false, isVisible: true }], policies: [],
};

/** Same immutable package shape and renderer; only explicit sample settings/resources differ. */
export function withMarginaliaDemoContent(input: Record<string, unknown>): Record<string, unknown> {
  const bundle = LiquidThemePackageBundleSchema.parse(structuredClone(input.liquidBundle));
  for (const template of Object.values(bundle.templates)) for (const item of Object.values(template.sections)) {
    if (item.type === 'category-grid') Object.assign(item.settings, { product1: bookId, eyebrow: 'ON THE READING TABLE', linkLabel: 'View editions' });
    if (item.type === 'product-grid') Object.assign(item.settings, { collectionId: MARGINALIA_DEMO_COLLECTIONS[0].id, title: 'A little further along the shelf', productLimit: 6 });
    if (item.type === 'about-section') Object.assign(item.settings, { image: media + 'notebook.webp', imageAlt: 'Fictional olive A5 blank notebook', content: 'A place for your notes, lists and next beginnings. Explore the sample notebook’s paper weight, size, ruling and page count before choosing.', linkLabel: 'Explore the notebook', linkUrl: `/product/${paperId}` });
  }
  return { ...input, liquidBundle: bundle, templates: bundle.templates };
}
