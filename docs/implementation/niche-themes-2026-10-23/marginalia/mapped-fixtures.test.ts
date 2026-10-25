/** Cross-boundary evidence belongs here, not in engine imports of app/commerce source. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { assembleLiquidPageFromRenderResult } from '../../../../apps/commerce/web/src/lib/theme-engine/liquid-page-assembly';
import { MARGINALIA_DEMO_PRODUCTS, MARGINALIA_DEMO_COLLECTIONS, withMarginaliaDemoContent } from '../../../../apps/commerce/web/src/lib/demo/marginalia-demo';
import { createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog';
import { LiquidThemePackageBundleSchema } from '../../../../packages/theme-engine/src/theme-bundle';
import { LiquidRenderer } from '../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/theme-settings';

const evidence = path.resolve('docs/implementation/niche-themes-2026-10-23/marginalia');
const basePath = '/store/marginalia-mapped-evidence';
const products = MARGINALIA_DEMO_PRODUCTS.map(product => productToLiquidDrop(product, basePath)!);
const bookId = MARGINALIA_DEMO_PRODUCTS[0].id;
const empty = productToLiquidDrop({ id: 'missing-facts', name: 'A product without supplied details', description: '', price: 300, currency: 'INR', images: [], stock: 0, isActive: true, variants: [], variantOptions: [] }, basePath)!;
const invalidRecord = structuredClone(MARGINALIA_DEMO_PRODUCTS[0]);
Reflect.set(invalidRecord, 'books', { kind: 'book', pages: -20, authors: ['Invalid author must disappear'] });
invalidRecord.variants = []; invalidRecord.variantOptions = [];
const invalid = productToLiquidDrop(invalidRecord, basePath)!;

function bundle() {
  const result = LiquidThemePackageBundleSchema.parse(withMarginaliaDemoContent({ liquidBundle: createFirstPartyCatalogBundle('letbuyy-dawn', { designVersion: '2.0.0' }) }).liquidBundle);
  const index = result.templates.index.sections['marginalia-index'];
  index.blocks = { 'subject-essays': { type: 'subject', settings: { label: 'Essays', href: '/products?category=Essays' }, disabled: false, blocks: {}, block_order: [] } };
  index.block_order = ['subject-essays'];
  return result;
}
async function render(key: 'index' | 'collection' | 'product', item = products[0], items = products, previewMode = true) {
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'marginalia-mapped-evidence', path: key === 'product' ? String(item.url) : basePath + '/products', previewMode, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-dawn', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle(), liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Marginalia', description: 'Fictional sample bookshop; not for sale.', policies: [] }, product: item, collection: { title: 'Books and paper', products: items, total: items.length }, collections: MARGINALIA_DEMO_COLLECTIONS, section_products: { 'marginalia-index': [products[0]], 'marginalia-reading': products.slice(0, 2) } },
  });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []); assert.ok(result.liquid);
  return result.liquid;
}

test('real app mapper derives public facts from canonical demo variant metadata', () => {
  const source = MARGINALIA_DEMO_PRODUCTS[0];
  assert.equal(source.id, bookId);
  const variants = products[0].variants as Array<Record<string, unknown>>;
  const first = variants[0].books_display as Record<string, unknown>;
  const second = variants[1].books_display as Record<string, unknown>;
  assert.equal(first.dimensions, '140 × 216 mm'); assert.equal(second.dimensions, '156 × 234 mm');
  assert.equal((variants[2].books as Record<string, unknown>).language, 'Hindi');
  assert.equal((products[0].books_display as Record<string, unknown>).multiple_editions, true);
  assert.equal((products[0].books_display as Record<string, unknown>).authors, 'Mira Sen');
  assert.equal((products[2].books_display as Record<string, unknown>).dimensions, '148 × 210 mm');
});
test('actual mapped collection retains bibliography, stationery units and multiple-edition cue', async () => {
  const result = await render('collection'); const dom = new JSDOM(result.contentForLayout);
  const rows = dom.window.document.querySelectorAll('.mg-book-row'); assert.equal(rows.length, 3);
  for (const value of ['Mira Sen', 'Multiple editions', 'INR 480.00']) assert.ok(rows[0].textContent?.includes(value), value);
  for (const value of ['Dev Rao', 'English', 'paperback', 'First edition']) assert.ok(rows[1].textContent?.includes(value), value);
  for (const value of ['100 gsm', '148 × 210 mm', '96 pages', '48 sheets']) assert.ok(rows[2].textContent?.includes(value), value);
  assert.doesNotMatch(rows[2].textContent ?? '', /Mira Sen|ISBN|paperback/);
  dom.window.close();
});
test('actual mapped PDP carries each durable edition with its own dimensions, price and stock', async () => {
  const result = await render('product'); const dom = new JSDOM(result.contentForLayout);
  const picker = dom.window.document.querySelector('lb-variant-picker')!;
  const variants = JSON.parse(picker.getAttribute('data-variants')!);
  assert.equal(variants.length, 3);
  const expected = [['140 × 216 mm', 480, 6], ['156 × 234 mm', 780, 3], ['140 × 216 mm', 460, 0]] as const;
  expected.forEach(([dimensions, price, stock], index) => {
    assert.equal(variants[index].id, MARGINALIA_DEMO_PRODUCTS[0].variants![index].id);
    assert.equal(variants[index].books_display.dimensions, dimensions);
    assert.equal(variants[index].price, price); assert.equal(variants[index].stock, stock);
    const row = dom.window.document.querySelector(`[data-variant-id="${variants[index].id}"]`)!;
    assert.ok(row.textContent?.includes(dimensions));
    if (stock === 0) assert.ok(row.textContent?.includes('Currently unavailable'));
  });
  assert.equal(dom.window.document.querySelectorAll('#reading-sample').length, 1);
  assert.match(dom.window.document.querySelector('#reading-sample')!.textContent!, /Original fictional demonstration excerpt/);
  dom.window.close();
});
test('stationery variants are presented as options and keep square media instead of book edition labels', async () => {
  const paper = structuredClone(MARGINALIA_DEMO_PRODUCTS[2]);
  paper.variantOptions = [{ name: 'Ruling', values: ['Blank', 'Lined'] }];
  paper.variants = ['Blank', 'Lined'].map((ruling, index) => Object.assign({ id: `7b669c70-7301-4000-8000-00000000000${index + 1}`, name: ruling, price: 320, stock: 3, options: { Ruling: ruling } }, { metadata: { books: { kind: 'stationery', ruling: ruling.toLowerCase(), paper_gsm: 100, dimensions_mm: { width: 148, height: 210 }, page_count: 96, sheet_count: 48 } } }));
  const mapped = productToLiquidDrop(paper, basePath)!;
  const listing = (await render('collection', mapped, [mapped])).contentForLayout;
  assert.match(listing, /View options/); assert.doesNotMatch(listing, /View editions|Multiple editions/);
  const detail = await render('product', mapped, [mapped]);
  assert.match(detail.contentForLayout, /data-product-kind="stationery"/);
  assert.match(detail.headStyleText!, /\[data-product-kind="stationery"\] \.lb-product-detail__gallery-image\{aspect-ratio:1\}/);
});
test('mapper rejects invalid/private facts and missing data remains explicit without fabricated details', async () => {
  const source = structuredClone(MARGINALIA_DEMO_PRODUCTS[0]);
  Reflect.set(source, 'private_cost', 'never-public');
  const first = source.variants![0];
  Reflect.set(first, 'metadata', { ...('metadata' in first ? first.metadata as Record<string, unknown> : {}), private_cost: 'variant-never-public' });
  const mapped = productToLiquidDrop(source, basePath)!;
  assert.doesNotMatch(JSON.stringify(mapped), /never-public|variant-never-public|private_cost/);
  assert.equal(invalid.books, undefined); assert.equal(invalid.books_display, undefined);
  for (const item of [empty, invalid]) {
    const html = (await render('product', item, [item])).contentForLayout;
    assert.match(html, /Detailed product facts have not been supplied/);
    assert.doesNotMatch(html, /Invalid author must disappear|<dt>ISBN|<dt>Pages|<dt>Dimensions|id="reading-sample"/);
    if (item === empty) assert.doesNotMatch(html, /<summary>Description<\/summary>/);
  }
});
test('mapped merchant edits render without raw markup execution or stale display strings', async () => {
  const edited = structuredClone(MARGINALIA_DEMO_PRODUCTS[1]);
  Reflect.set(edited, 'books', { kind: 'book', authors: ['<img src=x onerror="alert(1)">'], language: 'Hindi', format: 'hardback', edition: 'Revised sample edition' });
  const mapped = productToLiquidDrop(edited, basePath)!;
  const html = (await render('collection', mapped, [mapped])).contentForLayout;
  const dom = new JSDOM(html); assert.equal(dom.window.document.querySelectorAll('[onerror],script').length, 0);
  assert.ok(dom.window.document.querySelector('.mg-author')?.textContent?.includes('<img src=x'));
  assert.match(html, /Hindi/); assert.match(html, /hardback/); assert.match(html, /Revised sample edition/);
  assert.doesNotMatch(html, /Dev Rao|First edition/); dom.window.close();
});
test('v2 dispatcher, Source Sans 3 and editable inline subject roots are explicit', () => {
  const b = bundle(); assert.equal(b.package.version, '2.0.0');
  assert.equal(b.config.settings_data.current.bodyFontFamily, 'Source Sans 3');
  assert.match(b.sections['category-grid'].source, /<a[^>]*\{\{ block\.editor_attributes \| raw \}\}/);
  assert.notEqual(createFirstPartyCatalogBundle('letbuyy-dawn').package.version, '2.0.0');
});
test('subject root has its exact editor block identity only in preview, without an extra wrapper', async () => {
  const preview = new JSDOM((await render('index')).contentForLayout);
  const link = preview.window.document.querySelector('.mg-subjects > a[data-block-id="subject-essays"]');
  assert.ok(link); assert.equal(link.tagName, 'A'); assert.equal(link.textContent?.trim().startsWith('Essays'), true);
  assert.equal(preview.window.document.querySelectorAll('[data-block-id="subject-essays"]').length, 1);
  const published = new JSDOM((await render('index', products[0], products, false)).contentForLayout);
  assert.equal(published.window.document.querySelectorAll('[data-block-id]').length, 0);
  assert.ok(published.window.document.querySelector('.mg-subjects > a'));
  preview.window.close(); published.window.close();
});
test('a cleared selected reading shelf cannot silently substitute the rest of the catalog', async () => {
  const result = await render('product');
  const dom = new JSDOM(result.contentForLayout);
  const related = dom.window.document.querySelector('[data-section-id="product-related"]')!;
  assert.ok(related); assert.equal(related.querySelectorAll('.mg-book-row').length, 0);
  assert.equal(related.querySelectorAll('h2').length, 0);
  dom.window.close();
});
test('save inspectable real mapper → Liquid → canonical page-assembly evidence', async () => {
  fs.mkdirSync(path.join(evidence, 'rendered'), { recursive: true });
  const files = [];
  for (const [key, name, item] of [['index', 'home', products[0]], ['collection', 'collection', products[0]], ['product', 'book', products[0]], ['product', 'stationery', products[2]], ['product', 'missing', empty], ['product', 'invalid', invalid]] as const) {
    const result = await render(key, item); const assembled = assembleLiquidPageFromRenderResult(result);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marginalia · mapped Liquid evidence</title><style>body{margin:0}button,input,select{font:inherit}</style><style>${assembled.headStyleText}</style></head><body><div data-theme-renderer="liquid">${assembled.html}</div></body></html>`;
    const nameOnDisk = `rendered/${name}.html`; fs.writeFileSync(path.join(evidence, nameOnDisk), html);
    files.push({ path: nameOnDisk, bytes: Buffer.byteLength(html), warnings: [] });
  }
  fs.writeFileSync(path.join(evidence, 'mapped-fixtures.json'), JSON.stringify({ generatedAt: new Date().toISOString(), chain: 'Canonical ProductModel demo → actual app productToLiquidDrop → actual LiquidRenderer → canonical assembleLiquidPageFromRenderResult.', globalDepthRelaxed: false, scope: 'Direct modules, no app server/database/hydrated purchase/editor lifecycle proof. Isolated HTML includes minimal body-margin/input-font reset; production font loading is not certified.', files }, null, 2) + '\n');
});
