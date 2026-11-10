import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { personalizationReviewFingerprint, prepareProductFactSnapshot, PersonalizationReviewContextSchema, type ProductModel, type PersonalizationFacts } from '@letbuyy/commerce-core';
import { StorefrontCartLineInputSchema, type StorefrontCartLineInput } from '@letbuyy/checkout-core';
import { productToLiquidDrop } from './product-liquid-drop';
import { MADEYOURS_DEMO_PRODUCTS } from '../demo/madeyours-demo';
import { resolveCatalogDemoContent } from '../demo/catalog-demo-dispatch';
import { catalogDemoReadOnlyHtml } from './catalog-demo-data';
import { loadMadeYoursReviewContext } from './personalization-review-client';

const QaDom = JSDOM as unknown as new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close(): void } };
const dom = new QaDom('<!doctype html><body></body>', { url: 'https://shop.example.invalid/store/madeyours/product/sample' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent, CSS: { escape: (value: string) => value.replace(/["\\]/g, '\\$&') } });
Object.defineProperties(dom.window.HTMLDialogElement.prototype, {
  showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
  close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
});
after(() => { document.body.replaceChildren(); dom.window.close(); });
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('./liquid-hydration-islands').then(module => module.registerLiquidHydrationIslands());
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
// Native review/cart receipts include WebCrypto work. A fixed number of timer turns
// is not a completion signal under the full browser/database qualification load.
async function waitForReceipt(predicate: () => boolean, description: string) {
  const deadline = Date.now() + 5000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), description);
}
type Model = ProductModel & { personalization: PersonalizationFacts };
const model = (index = 0): Model => structuredClone(MADEYOURS_DEMO_PRODUCTS[index]);
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status === 200, ...(status === 200 ? { data } : { error: data }) }), { status });
async function render(item: Model, sectionId = 'made-one') {
  const bundle = createFirstPartyCatalogBundle('letbuyy-nova', { designVersion: '2.0.0' });
  const template = bundle.templates.product, id = template.order.find(key => template.sections[key].type === 'product-detail')!;
  bundle.templates.product = { ...template, order: [sectionId], sections: { [sectionId]: template.sections[id] } };
  const result = await new LiquidRenderer().render({ context: { storeId: item.id, subdomain: 'madeyours', path: '/product/' + item.id, previewMode: false, locale: 'en-IN' }, storeTemplate: { themeId: 'letbuyy-nova', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: 'product', liquidContext: { product: productToLiquidDrop(item)! } });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
  return { html: result.liquid!.contentForLayout, bundle };
}
function root(id = 'made-one') { const found = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`); assert.ok(found); return found; }
const q = <T extends Element = HTMLElement>(section: HTMLElement, key: string) => section.querySelector<T>(`[data-lb-personalization-${key}]`)!;
const purchase = (section: HTMLElement) => section.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!;
function choose(section: HTMLElement, value: string) { const button = [...section.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(node => node.dataset.variantValue === value); assert.ok(button); button.click(); }
function specify(section: HTMLElement, text: string) { q<HTMLInputElement>(section, 'text').value = text; q(section, 'text').dispatchEvent(new dom.window.Event('input', { bubbles: true })); }
function review(section: HTMLElement, text: string) { specify(section, text); q<HTMLButtonElement>(section, 'review').click(); }
const cached = (): Array<Record<string, unknown>> => JSON.parse(window.localStorage.getItem('lb_cart') || '[]');
function clear() { document.body.replaceChildren(); window.localStorage.clear(); }
async function context(item: Model, variantId: string | null) {
  return PersonalizationReviewContextSchema.parse({ product_id: item.id, variant_id: variantId, facts: item.personalization, facts_revision: item.personalization.revision,
    review_fingerprint: await personalizationReviewFingerprint({ product_id: item.id, variant_id: variantId, product_version: 1, facts: item.personalization }) });
}
function backend(models: Model[]) {
  const writes: StorefrontCartLineInput[][] = [], contexts: { url: URL; signal?: AbortSignal | null; cache?: RequestCache }[] = [];
  const byId = new Map(models.map(item => [item.id, item]));
  let cartFailure: string | null = null;
  let lastReceipt: unknown;
  let nextCommitBarrier: Promise<void> | undefined, heldCommit = false, readsDuringHeldCommit = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith('/personalization-review')) {
      contexts.push({ url, signal: init?.signal, cache: init?.cache });
      const item = byId.get(url.pathname.split('/').at(-2)!); assert.ok(item);
      return response(await context(item, url.searchParams.get('variant_id')));
    }
    if (url.pathname.endsWith('/checkout-status')) return response({ cart_status: 'active', checkout_state: null });
    assert.match(url.pathname, /\/cart(?:\/[^/]+)?$/);
    if ((init?.method || 'GET') === 'GET') { if (heldCommit) readsDuringHeldCommit++; return response(lastReceipt); }
    const body = JSON.parse(String(init?.body)) as { lines: unknown[] };
    const lines = body.lines.map(line => StorefrontCartLineInputSchema.parse(line)); writes.push(lines);
    const barrier = nextCommitBarrier; nextCommitBarrier = undefined;
    if (barrier) { heldCommit = true; await barrier; heldCommit = false; }
    if (cartFailure) { const code = cartFailure; cartFailure = null; return response({ code, message: 'Controlled failure' }, code === 'CART_UNAVAILABLE' ? 503 : 409); }
    const saved = await Promise.all(lines.map(async line => {
      const item = byId.get(line.product_id); assert.ok(item);
      const variant = item.variants?.find(row => row.id === line.variant_id);
      const prepared = await prepareProductFactSnapshot({ product_id: item.id, product_version: 1, product_metadata: { personalization: item.personalization }, has_variants: Boolean(item.variants?.length),
        selected_variant: variant ? { id: variant.id, product_id: item.id, options: variant.options } : null, personalization: line.personalization });
      assert.equal(prepared.ok, true, JSON.stringify(prepared)); if (!prepared.ok) throw new Error('Invalid fixture');
      return { ...line, id: `${item.id}:${line.variant_id || ''}:${prepared.configuration_fingerprint}`, title: item.name, unit_price: item.price, currency: 'INR',
        configuration_fingerprint: prepared.configuration_fingerprint, snapshot_fingerprint: prepared.snapshot_fingerprint, niche_snapshot: prepared.snapshot };
    }));
    lastReceipt = { cart_token: 'madeyours-test-receipt', status: 'active', updated_at: '2026-10-25T00:00:00.000Z', lines: saved, currency: 'INR', subtotal: 1290, total: 1290, discount_total: 0, shipping_total: 0, tax_total: 0, coupon_codes: [] };
    return response(lastReceipt);
  }) as typeof fetch;
  return { fetcher, writes, contexts, failNextCart(code: string) { cartFailure = code; },
    get readsDuringHeldCommit() { return readsDuringHeldCommit; },
    holdNextCartCommit() {
      assert.equal(nextCommitBarrier, undefined);
      let release!: () => void; nextCommitBarrier = new Promise<void>(resolve => { release = resolve; });
      return release;
    },
  };
}

test('actual MadeYours mapper/Liquid/native review retains separate configurations through receipts, quantity, removal and rehydrate', async () => {
  await ready(); clear(); const item = model();
  item.personalization.methods[0].styles[0].label = '<img src=x onerror=attack()>';
  const api = backend([item]), original = globalThis.fetch; globalThis.fetch = api.fetcher;
  try {
    document.body.innerHTML = (await render(item)).html;
    const section = root(); assert.equal(purchase(section).disabled, true); assert.equal(api.contexts.length, 0);
    choose(section, 'Walnut'); await flush();
    assert.equal(api.contexts.length, 1); assert.equal(api.contexts[0].cache, 'no-store');
    assert.equal(api.contexts[0].url.searchParams.get('variant_id'), item.variants![0].id);
    specify(section, 'Asha'); purchase(section).click(); await flush(); assert.equal(api.writes.length, 0);
    q<HTMLButtonElement>(section, 'review').click(); assert.equal(purchase(section).disabled, false);
    purchase(section).click(); purchase(section).click(); await flush();
    assert.equal(api.writes.length, 1); assert.equal(cached().length, 1);
    await waitForReceipt(() => typeof cached()[0]?.serverLineId === 'string' && !purchase(section).disabled, 'the first cart receipt must be applied');
    const ashaId = cached()[0].serverLineId; assert.equal(typeof ashaId, 'string');
    review(section, 'Kabir'); purchase(section).click();
    await waitForReceipt(() => api.writes.length === 2 && cached().every(line => typeof line.serverLineId === 'string') && !purchase(section).disabled, 'both configurations must receive their saved identities');
    assert.deepEqual(cached().map(line => (line.personalization as { text: string }).text), ['Asha', 'Kabir']);
    assert.equal(new Set(cached().map(line => line.serverLineId)).size, 2);
    assert.equal(new Set(cached().map(line => line.configurationFingerprint)).size, 2);
    review(section, 'Asha'); purchase(section).click();
    await waitForReceipt(() => api.writes.length === 3 && cached()[0]?.quantity === 2 && !purchase(section).disabled, 'the repeated configuration must receive quantity two');
    assert.deepEqual(cached().map(line => line.quantity), [2, 1]); assert.equal(cached()[0].serverLineId, ashaId);
    const page = document.createElement('lb-cart'), drawer = document.createElement('lb-cart-drawer'); document.body.append(page, drawer); await flush();
    assert.match(page.textContent!, /Asha/); assert.match(page.textContent!, /Kabir/); assert.match(page.textContent!, /Front engraving/);
    assert.match(page.textContent!, /<img src=x onerror=attack\(\)>/); assert.equal(page.querySelector('img,[onerror]'), null);
    const up = [...page.querySelectorAll<HTMLButtonElement>('[data-lb-cart-step="up"]')].find(button => button.dataset.cartLineKey === ashaId)!; up.click();
    await waitForReceipt(() => api.writes.length === 4 && cached()[0]?.quantity === 3
      && page.querySelector('[data-lb-cart-status]') === null,
    'quantity change must receive its saved receipt before the next command');
    assert.deepEqual(api.writes.at(-1)!.map(line => [line.personalization?.text, line.quantity]), [['Asha', 3], ['Kabir', 1]]);
    const remove = [...drawer.querySelectorAll<HTMLButtonElement>('[data-lb-cart-remove]')].find(button => button.dataset.cartLineKey !== ashaId)!; remove.click();
    await waitForReceipt(() => api.writes.length === 5 && cached().length === 1
      && page.querySelector('[data-lb-cart-status]') === null, 'removal must reach the canonical cart');
    assert.deepEqual(api.writes.at(-1)!.map(line => [line.personalization?.text, line.quantity]), [['Asha', 3]]);
    assert.equal(cached()[0].serverLineId, ashaId); assert.ok(cached()[0].snapshotFingerprint); assert.ok(cached()[0].nicheSnapshot);
    for (const line of api.writes.flat()) { assert.deepEqual(line.properties, { Wood: 'Walnut' }); assert.equal(Object.hasOwn(line, 'id'), false); assert.equal(Object.hasOwn(line, 'unit_price'), false); }
    page.remove(); const rehydrated = document.createElement('lb-cart'); document.body.append(rehydrated); await flush();
    assert.match(rehydrated.textContent!, /Asha/); assert.doesNotMatch(rehydrated.textContent!, /Kabir/);
    assert.equal(rehydrated.querySelector<HTMLElement>('[data-lb-cart-step="up"]')!.dataset.cartLineKey, ashaId);
  } finally { clear(); globalThis.fetch = original; }
});

test('cart remount waits for an in-flight drawer removal before reading its canonical receipt', async () => {
  await ready(); clear(); const item = model(), api = backend([item]), original = globalThis.fetch;
  globalThis.fetch = api.fetcher;
  let release: (() => void) | undefined;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root();
    choose(section, 'Walnut'); await flush(); review(section, 'Asha'); purchase(section).click();
    await waitForReceipt(() => cached().length === 1 && typeof cached()[0].serverLineId === 'string' && !purchase(section).disabled, 'first configuration must be acknowledged');
    review(section, 'Kabir'); purchase(section).click();
    await waitForReceipt(() => api.writes.length === 2 && cached().length === 2 && cached().every(line => typeof line.serverLineId === 'string') && !purchase(section).disabled, 'both configurations must be acknowledged');
    const ashaId = cached()[0].serverLineId;
    const page = document.createElement('lb-cart'), drawer = document.createElement('lb-cart-drawer'); document.body.append(page, drawer);
    await waitForReceipt(() => page.querySelector('[data-lb-cart-status]') === null, 'initial cart read must finish before holding the next mutation');
    release = api.holdNextCartCommit();
    const remove = [...drawer.querySelectorAll<HTMLButtonElement>('[data-lb-cart-remove]')].find(button => button.dataset.cartLineKey !== ashaId)!;
    assert.ok(remove); remove.click();
    await waitForReceipt(() => api.writes.length === 3 && cached().length === 1, 'the removal must be in flight with its optimistic draft retained');
    page.remove(); const rehydrated = document.createElement('lb-cart'); document.body.append(rehydrated);
    assert.ok(rehydrated.querySelector('[data-lb-cart-status]'), 'remount must keep checkout unconfirmed while its existing write is pending');
    await flush(); // Let the real mount/read path run while the mutation is held.
    release(); release = undefined;
    await waitForReceipt(() => rehydrated.querySelector('[data-lb-cart-status]') === null && cached().length === 1 && !/Kabir/.test(rehydrated.textContent || ''), 'the acknowledged removal must survive remount');
    assert.equal(api.readsDuringHeldCommit, 0, 'a canonical read must not race the existing unacknowledged write');
    assert.equal(api.writes.length, 3, 'recovery must not replay the mutation');
    assert.equal(cached()[0].serverLineId, ashaId); assert.match(rehydrated.textContent!, /Asha/);
    assert.doesNotMatch(rehydrated.textContent!, /Kabir/);
  } finally { release?.(); clear(); globalThis.fetch = original; }
});

test('cart remount keeps a failed queued drawer removal unconfirmed until explicit saved-cart reload', async () => {
  await ready(); clear(); const item = model(), api = backend([item]), original = globalThis.fetch;
  globalThis.fetch = api.fetcher;
  let release: (() => void) | undefined;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root();
    choose(section, 'Walnut'); await flush(); review(section, 'Asha'); purchase(section).click();
    await waitForReceipt(() => cached().length === 1 && typeof cached()[0].serverLineId === 'string' && !purchase(section).disabled, 'the saved configuration must be acknowledged');
    const page = document.createElement('lb-cart'), drawer = document.createElement('lb-cart-drawer'); document.body.append(page, drawer);
    await waitForReceipt(() => page.querySelector('[data-lb-cart-status]') === null, 'the initial saved-cart read must finish');
    release = api.holdNextCartCommit(); api.failNextCart('CART_UNAVAILABLE');
    drawer.querySelector<HTMLButtonElement>('[data-lb-cart-remove]')!.click();
    await waitForReceipt(() => api.writes.length === 2 && cached().length === 0, 'the removal must reach the held transport outcome');
    page.remove(); const rehydrated = document.createElement('lb-cart'); document.body.append(rehydrated); await flush();
    release(); release = undefined;
    await waitForReceipt(() => cached().length === 1 && Boolean(rehydrated.querySelector('[data-lb-cart-refresh]')), 'an unavailable queued write must leave its recovered receipt explicitly unconfirmed');
    assert.equal(api.readsDuringHeldCommit, 0); assert.equal(api.writes.length, 2);
    assert.equal(rehydrated.querySelector('a.lb-cart__checkout'), null);
    assert.ok(rehydrated.querySelector('.lb-cart__checkout[aria-disabled="true"]'));
    assert.match(rehydrated.textContent!, /could not confirm/);
    rehydrated.querySelector<HTMLButtonElement>('[data-lb-cart-refresh]')!.click();
    await waitForReceipt(() => rehydrated.querySelector('[data-lb-cart-status]') === null && Boolean(rehydrated.querySelector('a.lb-cart__checkout')), 'only an explicit fresh saved-cart read may clear the unavailable state');
    assert.equal(api.writes.length, 2, 'the explicit read must never replay the removal');
    assert.match(rehydrated.textContent!, /Asha/);
  } finally { release?.(); clear(); globalThis.fetch = original; }
});

test('late variant responses are aborted and cannot authorize another selection, including unavailable options', async () => {
  await ready(); clear(); const item = model(); item.variants![1].stock = 3;
  const original = globalThis.fetch, pending: Array<{ url: URL; signal: AbortSignal; resolve(value: Response): void }> = [];
  globalThis.fetch = (async (input, init) => new Promise<Response>(resolve => pending.push({ url: new URL(String(input), window.location.origin), signal: init!.signal!, resolve }))) as typeof fetch;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root();
    choose(section, 'Walnut'); assert.equal(pending.length, 1);
    choose(section, 'Oak'); assert.equal(pending.length, 2); assert.equal(pending[0].signal.aborted, true);
    pending[1].resolve(response(await context(item, item.variants![1].id))); await flush(); review(section, 'Kabir'); assert.equal(purchase(section).disabled, false);
    pending[0].resolve(response(await context(item, item.variants![0].id))); await flush();
    assert.equal(q(section, 'summary-text').textContent, 'Kabir'); assert.equal(purchase(section).disabled, false);
    choose(section, 'Walnut'); assert.equal(purchase(section).disabled, true); assert.equal(q(section, 'summary').hidden, true);
    pending[2].resolve(response(await context(item, item.variants![0].id))); await flush(); assert.equal(purchase(section).disabled, true);
    review(section, 'Asha'); assert.equal(purchase(section).disabled, false);
  } finally { clear(); globalThis.fetch = original; }
  const sold = model(), api = backend([sold]); globalThis.fetch = api.fetcher;
  try { document.body.innerHTML = (await render(sold)).html; const section = root(); choose(section, 'Walnut'); await flush(); review(section, 'Asha'); choose(section, 'Oak'); await flush(); assert.equal(purchase(section).disabled, true); assert.equal(api.contexts.length, 1); } finally { clear(); globalThis.fetch = original; }
});

test('two actual PDPs keep product context private to their elements; disconnect/reconnect discards pending reviews', async () => {
  await ready(); clear(); const a = model(), b = model(1), original = globalThis.fetch, api = backend([a, b]); globalThis.fetch = api.fetcher;
  try {
    document.body.innerHTML = (await render(a, 'one')).html + (await render(b, 'two')).html;
    choose(root('one'), 'Walnut'); choose(root('two'), 'Ivory linen / Indigo spine'); await flush();
    review(root('one'), 'Asha'); assert.equal(purchase(root('two')).disabled, true);
    review(root('two'), 'Kabir'); purchase(root('two')).click(); await flush();
    assert.equal(api.writes[0][0].product_id, b.id); assert.equal(api.writes[0][0].personalization?.method_id, 'cover-print');
    const element = root('one').querySelector<HTMLElement>('lb-add-to-cart')!; element.remove(); root('one').append(element); await flush();
    assert.equal(purchase(root('one')).disabled, true); assert.equal(q(root('one'), 'summary').hidden, true);
    assert.equal(root('one').querySelectorAll('[data-lb-personalization-normalize]').length, 1);
    review(root('one'), 'Asha'); purchase(root('one')).click(); await flush();
    assert.deepEqual(api.writes.at(-1)!.map(line => [line.product_id, line.personalization?.text]), [[b.id, 'Kabir'], [a.id, 'Asha']]);
  } finally { clear(); globalThis.fetch = original; }
});

test('stale409 removes only the rejected optimistic addition and requires current context plus another explicit review', async () => {
  await ready(); clear(); const item = model(), api = backend([item]), original = globalThis.fetch; globalThis.fetch = api.fetcher;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root(); choose(section, 'Walnut'); await flush(); review(section, 'Asha');
    api.failNextCart('PERSONALIZATION_STALE'); item.personalization.revision = 2;
    purchase(section).click(); await flush(); assert.equal(cached().length, 0); assert.equal(purchase(section).disabled, true);
    assert.equal(q<HTMLInputElement>(section, 'text').value, 'Asha'); assert.equal(q(section, 'summary').hidden, true);
    q<HTMLButtonElement>(section, 'review').click(); purchase(section).click(); await flush();
    assert.equal(api.writes.at(-1)![0].personalization?.facts_revision, 2); assert.equal(cached().length, 1); assert.equal(cached()[0].quantity, 1);
  } finally { clear(); globalThis.fetch = original; }
});

test('cart transport retry resends the same reviewed quantity rather than adding it twice', async () => {
  await ready(); clear(); const item = model(), api = backend([item]), original = globalThis.fetch; globalThis.fetch = api.fetcher;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root(); choose(section, 'Walnut'); await flush(); review(section, 'Asha');
    api.failNextCart('CART_UNAVAILABLE'); purchase(section).click(); await flush(); assert.equal(cached()[0].quantity, 1);
    purchase(section).click(); await flush(); assert.equal(api.writes.length, 2);
    assert.deepEqual(api.writes[0], api.writes[1]); assert.equal(cached()[0].quantity, 1); assert.ok(cached()[0].serverLineId);
  } finally { clear(); globalThis.fetch = original; }
});

test('text, method, style and placement edits each invalidate native review; unvarianted review binds explicit null', async () => {
  await ready(); clear(); const item = model(); item.variants = []; item.variantOptions = [];
  item.personalization.methods[0].placements.push({ id: 'back', label: 'On the back' });
  item.personalization.methods.push({ ...structuredClone(item.personalization.methods[0]), id: 'print', label: 'Print' });
  const api = backend([item]), original = globalThis.fetch; globalThis.fetch = api.fetcher;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root(); await flush();
    assert.equal(api.contexts.length, 1); assert.equal(api.contexts[0].url.searchParams.has('variant_id'), false);
    review(section, 'Asha'); assert.equal(purchase(section).disabled, false);
    for (const [field, value] of [['style', 'serif'], ['placement', 'back'], ['method', 'print']] as const) {
      q<HTMLSelectElement>(section, field).value = value; q(section, field).dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      assert.equal(purchase(section).disabled, true, field); assert.equal(q(section, 'summary').hidden, true);
      q<HTMLButtonElement>(section, 'review').click(); assert.equal(purchase(section).disabled, false);
    }
    specify(section, 'Kabir'); assert.equal(purchase(section).disabled, true); q<HTMLButtonElement>(section, 'review').click(); purchase(section).click(); await flush();
    assert.deepEqual(api.writes[0][0].personalization, { method_id: 'print', style_id: 'serif', placement_id: 'back', text: 'Kabir', facts_revision: 1, review_fingerprint: (await context(item, null)).review_fingerprint });
    assert.equal(api.writes[0][0].variant_id, null);
  } finally { clear(); globalThis.fetch = original; }
});

test('product identity changes abort the old context and a late prior-product response cannot restore review', async () => {
  await ready(); clear(); const item = model(), other = model(1), original = globalThis.fetch;
  const pending: Array<{ signal: AbortSignal; resolve(value: Response): void }> = [];
  globalThis.fetch = (async (_input, init) => new Promise<Response>(resolve => pending.push({ signal: init!.signal!, resolve }))) as typeof fetch;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root(); choose(section, 'Walnut');
    const element = section.querySelector<HTMLElement>('lb-add-to-cart')!; element.dataset.productId = other.id;
    assert.equal(pending[0].signal.aborted, true); assert.equal(purchase(section).disabled, true); assert.equal(pending.length, 2);
    pending[0].resolve(response(await context(item, item.variants![0].id))); await flush();
    assert.equal(purchase(section).disabled, true); assert.equal(q<HTMLButtonElement>(section, 'review').disabled, true);
    pending[1].resolve(response({ code: 'VARIANT_NOT_FOUND' }, 404)); await flush();
    assert.equal(purchase(section).disabled, true); assert.equal(section.querySelectorAll('[data-lb-personalization-normalize]').length, 1);
  } finally { clear(); globalThis.fetch = original; }
});

test('a stale rejection after transport retry restores the original cache rather than retaining the rejected draft', async () => {
  await ready(); clear(); const item = model(), api = backend([item]), original = globalThis.fetch; globalThis.fetch = api.fetcher;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root(); choose(section, 'Walnut'); await flush(); review(section, 'Asha');
    api.failNextCart('CART_UNAVAILABLE'); purchase(section).click(); await flush(); assert.equal(cached().length, 1);
    api.failNextCart('PERSONALIZATION_STALE'); item.personalization.revision = 2; purchase(section).click(); await flush();
    assert.equal(cached().length, 0); assert.equal(purchase(section).disabled, true);
    q<HTMLButtonElement>(section, 'review').click(); purchase(section).click(); await flush(); assert.equal(cached()[0].quantity, 1);
  } finally { clear(); globalThis.fetch = original; }
});

test('two concurrent PDP intents keep both configurations while an older receipt supplies the token for the queued mutation', async () => {
  await ready(); clear(); const a = model(), b = model(1), api = backend([a, b]), original = globalThis.fetch;
  let release: (() => void) | undefined, held = false;
  const mutations: Array<{ path: string; method?: string }> = [];
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input), window.location.origin).pathname;
    const cartMutation = /\/cart(?:\/[^/]+)?$/.test(path);
    if (cartMutation) mutations.push({ path, method: init?.method });
    const result = await api.fetcher(input, init);
    if (cartMutation && !held) { held = true; return new Promise<Response>(resolve => { release = () => resolve(result); }); }
    return result;
  }) as typeof fetch;
  try {
    document.body.innerHTML = (await render(a, 'one')).html + (await render(b, 'two')).html;
    choose(root('one'), 'Walnut'); choose(root('two'), 'Ivory linen / Indigo spine'); await flush(); review(root('one'), 'Asha'); review(root('two'), 'Kabir');
    purchase(root('one')).click(); await waitForReceipt(() => Boolean(release), 'the first mutation must reach the held response'); assert.ok(release); assert.equal(api.writes.length, 1);
    purchase(root('two')).click(); await flush(); assert.equal(cached().length, 2); assert.equal(api.writes.length, 1);
    release(); await waitForReceipt(() => api.writes.length === 2, 'the queued mutation must use the first receipt'); await flush();
    assert.equal(api.writes.length, 2); assert.equal(mutations[0].method, 'POST'); assert.equal(mutations[1].method, 'PATCH'); assert.match(mutations[1].path, /\/cart\/madeyours-test-receipt$/);
    assert.deepEqual(cached().map(line => [(line.personalization as { text: string }).text, line.quantity]), [['Asha', 1], ['Kabir', 1]]);
    assert.equal(new Set(cached().map(line => line.serverLineId)).size, 2);
  } finally { clear(); globalThis.fetch = original; }
});

test('failed or mismatched review contexts block purchase, expose retry, and discard a response after disposal', async () => {
  await ready(); clear(); const item = model(), original = globalThis.fetch; let calls = 0, release: ((value: Response) => void) | undefined, signal: AbortSignal | undefined;
  globalThis.fetch = (async (_input, init) => { calls++; if (calls === 1) return response({ code: 'UNAVAILABLE' }, 503); return new Promise<Response>(resolve => { release = resolve; signal = init!.signal!; }); }) as typeof fetch;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root(); choose(section, 'Walnut'); await flush();
    assert.equal(purchase(section).disabled, true); assert.equal(q<HTMLButtonElement>(section, 'review').disabled, true);
    q<HTMLButtonElement>(section, 'retry').click(); assert.equal(calls, 2);
    const element = section.querySelector<HTMLElement>('lb-add-to-cart')!; element.remove(); assert.equal(signal?.aborted, true);
    release!(response(await context(item, item.variants![0].id))); await flush(); assert.equal(element.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!.disabled, true);
    document.body.innerHTML = (await render(item)).html; choose(root(), 'Walnut');
    release!(response(await context(model(1), model(1).variants![0].id))); await flush(); assert.equal(purchase(root()).disabled, true); assert.equal(q<HTMLButtonElement>(root(), 'review').disabled, true);
  } finally { clear(); globalThis.fetch = original; }
});

test('real native normalization needs consent and review; hostile text never reaches cart', async () => {
  await ready(); clear(); const item = model(); item.personalization.methods[0].character_set = 'unicode-letters'; const api = backend([item]), original = globalThis.fetch; globalThis.fetch = api.fetcher;
  try {
    document.body.innerHTML = (await render(item)).html; const section = root(); choose(section, 'Walnut'); await flush();
    review(section, '<img src=x onerror=attack()>'); purchase(section).click(); await flush(); assert.equal(api.writes.length, 0); assert.equal(section.querySelector('[onerror]'), null);
    review(section, 'Jose\u0301'); assert.equal(purchase(section).disabled, true); assert.equal(q<HTMLInputElement>(section, 'text').value, 'Jose\u0301');
    q<HTMLButtonElement>(section, 'normalize').click(); assert.equal(q<HTMLInputElement>(section, 'text').value, 'José'); assert.equal(purchase(section).disabled, true);
    q<HTMLButtonElement>(section, 'review').click(); purchase(section).click();
    await waitForReceipt(() => api.writes.length === 1, 'normalized review must reach the cart');
    assert.equal(api.writes[0][0].personalization?.text, 'José');
  } finally { clear(); globalThis.fetch = original; }
});

test('trusted catalog MadeYours conversion remains inert with zero review or cart requests', async () => {
  await ready(); clear(); const item = model(), rendered = await render(item), original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('Trusted demos must not fetch'); }) as typeof fetch;
  try {
    const content = resolveCatalogDemoContent('letbuyy-nova', '2.0.0', { themeId: 'letbuyy-nova', liquidBundle: rendered.bundle }, '/product/' + item.id)!;
    assert.ok(content); document.body.innerHTML = await catalogDemoReadOnlyHtml(rendered.html, content);
    assert.equal(document.querySelector('lb-add-to-cart,lb-variant-picker'), null);
    document.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.click()); await flush(); assert.equal(calls, 0); assert.equal(cached().length, 0);
  } finally { clear(); globalThis.fetch = original; }
});

test('review adapter validates canonical wire shape/IDs, uses no-store, and accepts no raw version or price', async () => {
  const item = model(), variant = item.variants![0].id, valid = await context(item, variant), original = globalThis.fetch;
  try {
    for (const data of [{ ...valid, product_id: model(1).id }, { ...valid, variant_id: null }, { ...valid, facts_revision: 99 }, { ...valid, product_version: 1 }, { ...valid, unit_price: 1 }]) {
      globalThis.fetch = (async () => response(data)) as typeof fetch;
      assert.equal(await loadMadeYoursReviewContext('madeyours', item.id, variant, new AbortController().signal), null);
    }
    let count = 0;
    globalThis.fetch = (async (_input, init) => { count++; assert.equal(init?.cache, 'no-store'); return response(valid); }) as typeof fetch;
    assert.deepEqual(await loadMadeYoursReviewContext('madeyours', item.id, variant, new AbortController().signal), valid);
    assert.equal(await loadMadeYoursReviewContext('madeyours', 'invalid', variant, new AbortController().signal), null); assert.equal(count, 1);
  } finally { globalThis.fetch = original; }
});
