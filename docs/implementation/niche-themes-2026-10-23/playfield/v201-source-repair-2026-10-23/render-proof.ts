/** Source-only real Liquid/native-island DOM proof. No browser, HTTP, DB or installed capture. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { ProductVariantSchema, ToyFactsSchema, type ProductModel } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from '../../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';

const root = new URL('../../../../../', import.meta.url), out = new URL('./', import.meta.url);
const require = createRequire(new URL('../../../../../apps/commerce/web/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
type Plan = { products: Array<{ key: string; createFields: { metadata: { toys: unknown }; product_options: NonNullable<ProductModel['variantOptions']>; variants: unknown[] } }> };
const planPath = new URL('docs/implementation/theme-editor-2026-10-23/evidence/fresh-fixture-data.plan.json', root);
const recipe = (JSON.parse(readFileSync(planPath, 'utf8')) as Plan).products.find(row => row.key === 'toys')!.createFields;
const ids = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
const make = (): ProductModel => ({ id: '11111111-1111-4111-8111-111111111111', name: 'Source-only Playfield recipe', price: 480, stock: 8, currency: 'INR', images: [], toys: ToyFactsSchema.parse(recipe.metadata.toys), variantOptions: recipe.product_options, variants: recipe.variants.map((value, index) => ({ ...ProductVariantSchema.parse(value), id: ids[index] })) });
const bundle = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0', playfieldVersion: '2.0.1' });
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://source.example.invalid/store/playfield' });
const win = dom.window as Window & typeof globalThis;
const names = ['window', 'document', 'HTMLElement', 'Element', 'CustomEvent', 'CSS'];
const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
Object.assign(globalThis, { window: win, document: win.document, HTMLElement: win.HTMLElement, Element: win.Element, CustomEvent: win.CustomEvent });
Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { escape: (value: string) => value.replace(/["\\]/g, '\\$&') } });
const previousFetch = globalThis.fetch;
let liveCalls = 0;
globalThis.fetch = (async () => { liveCalls++; throw new Error('Source proof forbids live calls'); }) as typeof fetch;
mkdirSync(new URL('rendered/', out), { recursive: true });
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const frames: Array<Record<string, unknown>> = [];

async function mount(product: ProductModel, enabled = true) {
    const local = structuredClone(bundle), original = local.templates.product;
    const key = original.order.find(id => original.sections[id].type === 'product-detail')!;
    local.templates.product = { sections: { proof: { ...original.sections[key], settings: { ...original.sections[key].settings, showToyFacts: enabled } } }, order: ['proof'] };
    const result = await new LiquidRenderer().render({ context: { storeId: product.id, subdomain: 'source-only-not-installed', path: '/product/' + product.id, previewMode: false, locale: 'en-IN' }, storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] }, liquidBundle: local, liquidTemplateKey: 'product', liquidContext: { product: productToLiquidDrop(product)! } });
    assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
    document.head.replaceChildren();
    const style = document.createElement('style'); style.textContent = result.liquid!.headStyleText || ''; document.head.append(style);
    document.body.innerHTML = result.liquid!.contentForLayout;
}
function choose(value: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(item => item.dataset.variantValue === value);
    assert.ok(button); button.click();
}
function capture(name: string, expectedId = '') {
    const section = document.querySelector<HTMLElement>('[data-lb-toy-presentation]')!;
    const slots = [...section.querySelectorAll<HTMLElement>('[data-lb-toy-field="age"],[data-lb-toy-warnings],[data-lb-toy-contents],[data-lb-toy-details],[data-lb-toy-status]')];
    if (section.dataset.lbToyFactsEnabled === 'true') for (const target of [section, ...slots]) assert.equal(target.dataset.variantId, expectedId);
    const html = '<!doctype html>\n' + document.documentElement.outerHTML;
    writeFileSync(new URL(`rendered/${name}.html`, out), html);
    frames.push({ name, classification: 'SOURCE_ONLY_JSDOM_NATIVE_PICKER_NOT_BROWSER', variantId: section.dataset.variantId || null, selectionState: section.dataset.selectionState || null, age: section.querySelector('[data-lb-toy-field="age"]')?.textContent || null, contents: section.querySelector('[data-lb-toy-contents]')?.textContent || null, materials: section.querySelector('[data-lb-toy-field="materials"]')?.textContent || null, warningsHidden: section.querySelector<HTMLElement>('[data-lb-toy-warnings]')?.hidden ?? null, details: section.querySelector('[data-lb-toy-details]')?.textContent || null, purchaseDisabled: section.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!.disabled, htmlSha256: hash(html) });
}
async function main() {
    const { registerLiquidHydrationIslands } = await import('../../../../../apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands');
    registerLiquidHydrationIslands();
    await mount(make()); capture('01-unselected');
    choose('Inherited'); capture('02-inherited', ids[0]);
    choose('Unknown facts'); capture('03-unknown', ids[1]);
    choose('Paper'); capture('04-paper', ids[2]);
    choose('Inherited'); capture('05-returned-inherited', ids[0]);
    const clear = make(); clear.variants![1].metadata!.toys = { ...clear.variants![1].metadata!.toys, materials: '' };
    await mount(clear); choose('Unknown facts'); capture('06-explicit-material-clear', ids[1]);
    const unavailable = make(); unavailable.variants![2].stock = 0;
    await mount(unavailable); choose('Paper'); capture('07-unavailable-paper', ids[2]);
    const plain = make(); plain.variants = []; plain.variantOptions = [];
    await mount(plain); capture('08-product-only');
    await mount(make(), false); choose('Paper'); capture('09-setting-off');
    assert.equal(liveCalls, 0);
    const pins = ['packages/theme-engine/src/playfield-theme-v201.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts', 'apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts', 'apps/commerce/web/src/lib/theme-engine/variant-options-carrier.ts', 'apps/commerce/web/src/lib/theme-engine/variant-facts-controller.ts', 'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx'].map(path => ({ path, sha256: hash(readFileSync(new URL(path, root))) }));
    writeFileSync(new URL('render-proof.json', out), JSON.stringify({ classification: 'REAL_LIQUID_NATIVE_ISLAND_SOURCE_PROOF_NOT_INSTALLED_ACCEPTANCE', packageVersion: '2.0.1', syntheticSourceTestIds: true, recipeInputSha256: hash(readFileSync(planPath)), frames, liveCalls, screenshots: 'NOT_RUN_NO_BROWSER_ALLOCATION', sources: pins }, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ sourceFrames: frames.length, liveCalls, screenshots: 'NOT_RUN' }) + '\n');
}
main().finally(() => {
    document.body.replaceChildren(); dom.window.close(); globalThis.fetch = previousFetch;
    for (const name of names) { const descriptor = previous.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
}).catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
