import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { PersonalizationFactsSchema, personalizationReviewFingerprint, prepareProductFactSnapshot, type PersonalizationCartDraft } from '@letbuyy/commerce-core';
import { StorefrontConfiguredLineEditSchema } from '@letbuyy/checkout-core';
import { bindMadeYoursPersonalization, createMadeYoursCartEditControls } from './madeyours-personalization';

const product = '7b669c70-9000-4000-8000-000000000001', moss = '7b669c70-9100-4000-8000-000000000001', oat = '7b669c70-9100-4000-8000-000000000002';
const facts = PersonalizationFactsSchema.parse({ version: 1, revision: 2, methods: [{ id: 'engrave', label: 'Engrave', min_graphemes: 1, max_graphemes: 18, character_set: 'unicode-letters', styles: [{ id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }], placements: [{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }] }] });
const QaDom = JSDOM as unknown as new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close(): void } };
const dom = new QaDom('<!doctype html><body></body>', { url: 'https://shop.example.invalid/store/madeyours/cart' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, HTMLElement: w.HTMLElement, Element: w.Element, CustomEvent: w.CustomEvent, CSS: { escape: (v: string) => v.replace(/["\\]/g, '\\$&') } });
Object.defineProperties(w.HTMLDialogElement.prototype, { showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } }, close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } } });
const ready = import('./liquid-hydration-islands').then(module => { module.registerLiquidHydrationIslands(); return module; });
const originalFetch = globalThis.fetch;
afterEach(() => { document.body.replaceChildren(); w.localStorage.clear(); globalThis.fetch = originalFetch; });
after(() => { w.close(); });
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
const q = <T extends Element = HTMLElement>(root: ParentNode, key: string) => root.querySelector<T>(`[data-lb-personalization-${key}]`)!;
const draft = async (text = 'Asha', variant: string = moss): Promise<PersonalizationCartDraft> => {
  const fingerprint = await personalizationReviewFingerprint({ product_id: product, variant_id: variant, product_version: 1, facts }); assert.ok(fingerprint);
  return { method_id: 'engrave', style_id: 'sans', placement_id: 'front', text, facts_revision: facts.revision, review_fingerprint: fingerprint };
};
const context = async (variant: string | null, current = facts) => ({ product_id: product, variant_id: variant, facts: current, facts_revision: current.revision,
  review_fingerprint: await personalizationReviewFingerprint({ product_id: product, variant_id: variant, product_version: 1, facts: current }) });
function input(root: HTMLElement, text: string) { q<HTMLInputElement>(root, 'text').value = text; q(root, 'text').dispatchEvent(new w.Event('input', { bubbles: true })); }
function review(root: HTMLElement) { q<HTMLButtonElement>(root, 'review').click(); }
const save = (root: ParentNode) => root.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!;

test('restored accepted input requires a fresh context and deliberate Review', async () => {
  const root = createMadeYoursCartEditControls(document, product, facts); document.body.append(root);
  const binding = bindMadeYoursPersonalization(root, { loadReviewContext: variant => context(variant) }); assert.ok(binding);
  binding.restoreDraft(await draft()); binding.setSelection(moss, true); await flush();
  assert.equal(q<HTMLInputElement>(root, 'text').value, 'Asha'); assert.equal(save(root).disabled, true);
  review(root); assert.equal(save(root).disabled, false); assert.equal(binding.readReviewedCartDraft()?.text, 'Asha'); binding.destroy();
});
test('invalid Unicode draft preserves exact input and last valid preview; normalization is explicit', async () => {
  const root = createMadeYoursCartEditControls(document, product, facts); document.body.append(root);
  const binding = bindMadeYoursPersonalization(root, { loadReviewContext: variant => context(variant) }); assert.ok(binding);
  binding.restoreDraft(await draft()); binding.setSelection(moss, true); await flush(); review(root);
  q<HTMLButtonElement>(root, 'edit').click(); input(root, 'Asha ✦');
  assert.equal(q<HTMLInputElement>(root, 'text').value, 'Asha ✦'); assert.equal(q(root, 'preview-text').textContent, 'Asha'); assert.equal(save(root).disabled, true);
  input(root, 'Jose\u0301'); review(root); assert.equal(save(root).disabled, true);
  assert.equal(q<HTMLInputElement>(root, 'text').value, 'Jose\u0301');
  q<HTMLButtonElement>(root, 'normalize').click(); assert.equal(q<HTMLInputElement>(root, 'text').value, 'José'); assert.equal(save(root).disabled, true);
  review(root); assert.equal(binding.readReviewedCartDraft()?.text, 'José'); binding.destroy();
});
test('revoked saved choices remain unavailable instead of silently becoming the first current option', async () => {
  const current = structuredClone(facts); current.revision++; current.methods[0].styles = [{ id: 'sans', label: 'Sans' }];
  const root = createMadeYoursCartEditControls(document, product, facts); document.body.append(root);
  const binding = bindMadeYoursPersonalization(root, { loadReviewContext: variant => context(variant, current) }); assert.ok(binding);
  binding.restoreDraft({ ...await draft(), style_id: 'serif' }); binding.setSelection(moss, true); await flush(); review(root);
  assert.equal(q<HTMLSelectElement>(root, 'style').value, 'serif'); assert.equal(q<HTMLSelectElement>(root, 'style').selectedOptions[0].disabled, true);
  assert.equal(save(root).disabled, true); assert.equal(binding.readReviewedCartDraft(), null);
  q<HTMLSelectElement>(root, 'style').value = 'sans'; q(root, 'style').dispatchEvent(new w.Event('change')); review(root);
  assert.equal(binding.readReviewedCartDraft()?.style_id, 'sans'); binding.destroy();
});
test('context failure and late variant context cannot expose a reviewed cart draft', async () => {
  const root = createMadeYoursCartEditControls(document, product, facts); document.body.append(root);
  const pending: Array<{ signal: AbortSignal; resolve(value: unknown): void }> = [];
  const binding = bindMadeYoursPersonalization(root, { loadReviewContext: (_variant, signal) => new Promise(resolve => pending.push({ signal, resolve })) }); assert.ok(binding);
  binding.restoreDraft(await draft()); binding.setSelection(moss, true); binding.setSelection(oat, true); assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(null); await flush(); assert.equal(binding.readDraft().text, 'Asha'); assert.equal(save(root).disabled, true);
  pending[0].resolve(await context(moss)); await flush(); review(root); assert.equal(binding.readReviewedCartDraft(), null); binding.destroy();
});

async function fixture(mode: 'success' | 'lost' | 'conflict' | 'closed' = 'success') {
  await ready;
  async function line(text: string, variant = moss, quantity = 1) {
    const personalization = await draft(text, variant);
    const result = await prepareProductFactSnapshot({ product_id: product, product_version: 1, product_metadata: { personalization: facts }, has_variants: true,
      selected_variant: { id: variant, product_id: product, metadata: {}, options: { Cover: variant === moss ? 'Moss' : 'Oat' } }, personalization });
    assert.equal(result.ok, true); if (!result.ok) throw new Error('Invalid source fixture');
    return { id: `${product}:${variant}:${result.configuration_fingerprint}`, product_id: product, variant_id: variant, title: 'Notebook', quantity, unit_price: 690, line_total: 690 * quantity, currency: 'INR', properties: { Cover: variant === moss ? 'Moss' : 'Oat' }, personalization, niche_snapshot: result.snapshot, configuration_fingerprint: result.configuration_fingerprint };
  }
  let cart = { id: '7b669c70-9300-4000-8000-000000000001', cart_token: 'ct_source_only_owned', status: 'active', updated_at: '2026-10-24T11:31:00.123456+00:00', currency: 'INR', subtotal: 1380, discount_total: 0, shipping_total: 0, tax_total: 0, total: 1380, coupon_codes: [] as string[], lines: [await line('Asha'), await line('Kabir')] };
  const initial = structuredClone(cart), commands: unknown[] = [], wholeWrites: Array<{ expected_updated_at?: string; lines: Array<{ personalization?: PersonalizationCartDraft }> }> = [], reads: { path: string; cache?: RequestCache }[] = [];
  let effects = 0; const completed = new Map<string, unknown>();
  const response = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status === 200, ...(status === 200 ? { data } : { error: data }) }), { status });
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input), w.location.origin); reads.push({ path: url.pathname, cache: init?.cache });
    if (url.pathname.endsWith('/checkout-status')) return response({ cart_status: cart.status, checkout_state: null });
    if (url.pathname.endsWith('/personalization-review')) return response(await context(url.searchParams.get('variant_id')));
    if (url.pathname.endsWith(`/products/${product}`)) return response({ id: product, metadata: { personalization: facts }, product_options: [{ name: 'Cover', position: 0, values: ['Moss', 'Oat'] }], variants: [{ id: moss, product_id: product, title: 'Moss', option1: 'Moss', price: 690, inventory_qty: 4 }, { id: oat, product_id: product, title: 'Oat', option1: 'Oat', price: 690, inventory_qty: 4 }] });
    assert.match(url.pathname, /\/cart\/ct_source_only_owned$/);
    if (!init?.body) return response(cart);
    const body = JSON.parse(String(init.body));
    if (!body.line_edit) { wholeWrites.push(body); return response(cart); }
    const command = StorefrontConfiguredLineEditSchema.parse(body.line_edit); commands.push(structuredClone(command));
    if (completed.has(command.operation_key)) return response({ ...cart, edit_receipt: completed.get(command.operation_key) });
    if (mode === 'conflict' || command.expected_updated_at !== cart.updated_at) return response({ code: 'CART_REVISION_CONFLICT' }, 409);
    const old = cart.lines.find(row => row.id === command.line_id); assert.ok(old);
    const replacement = await line(command.replacement.personalization.text, command.replacement.variant_id!, old.quantity);
    cart = { ...cart, updated_at: '2026-10-24T11:31:00.123457+00:00', lines: cart.lines.map(row => row.id === old.id ? replacement : row) };
    effects++; const receipt = { operation_key: command.operation_key }; completed.set(command.operation_key, receipt);
    if (mode === 'closed') cart.status = 'abandoned';
    if (mode === 'lost') throw new Error('Controlled acknowledgement loss after model commit');
    return response({ ...cart, edit_receipt: receipt });
  }) as typeof fetch;
  w.localStorage.setItem('lb_cart_token', cart.cart_token); w.localStorage.setItem('lb_cart_server', JSON.stringify(cart));
  w.localStorage.setItem('lb_cart', JSON.stringify(cart.lines.map(row => ({ id: row.product_id, variantId: row.variant_id, serverLineId: row.id, name: row.title, price: row.unit_price, currency: row.currency, quantity: row.quantity, images: [], selectedVariant: row.properties, personalization: row.personalization, nicheSnapshot: row.niche_snapshot }))));
  return { initial, commands, wholeWrites, reads, effects: () => effects, cart: () => cart };
}
async function openInstalled(tag: 'lb-cart' | 'lb-cart-drawer') {
  const host = document.createElement(tag); document.body.append(host); await flush();
  if (tag === 'lb-cart-drawer') { w.dispatchEvent(new w.CustomEvent('letbuyy:cart:open')); await flush(); }
  const button = host.querySelector<HTMLButtonElement>('[data-lb-cart-edit]'); assert.ok(button, `${tag} actual edit control`); button.click(); await flush();
  const panel = host.querySelector<HTMLElement>('[data-lb-cart-edit-panel]'); assert.ok(panel); return { host, panel };
}
for (const tag of ['lb-cart', 'lb-cart-drawer'] as const) test(`${tag}: actual edit control saves one replacement and preserves unrelated Kabir`, async () => {
  const api = await fixture(); const { panel } = await openInstalled(tag); const before = w.localStorage.getItem('lb_cart');
  input(panel, 'Asha-Rae'); review(panel); assert.equal(w.localStorage.getItem('lb_cart'), before); save(panel).click(); await flush();
  assert.equal(api.effects(), 1); assert.equal(api.commands.length, 1); assert.equal(api.cart().lines[0].personalization.text, 'Asha-Rae');
  assert.deepEqual(api.cart().lines[1], api.initial.lines[1]); assert.equal(document.querySelector('[data-lb-cart-edit-panel]'), null);
  assert.ok(api.reads.filter(row => /personalization-review|products\//.test(row.path)).every(row => row.cache === 'no-store'));
});
test('Cancel and Escape return focus without a mutation or accepted-line loss', async () => {
  const api = await fixture(); const { host, panel } = await openInstalled('lb-cart'); const before = w.localStorage.getItem('lb_cart');
  input(panel, 'Unsaved'); panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-cancel]')!.click(); assert.equal(api.effects(), 0); assert.equal(w.localStorage.getItem('lb_cart'), before);
  assert.equal(document.activeElement, host.querySelector('[data-lb-cart-edit]'));
  host.querySelector<HTMLButtonElement>('[data-lb-cart-edit]')!.click(); await flush(); document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(api.commands.length, 0); assert.equal(document.querySelector('[data-lb-cart-edit-panel]'), null);
});
test('unknown acknowledgement keeps same command/key; retry confirms once and blocks navigation/cancel', async () => {
  const api = await fixture('lost'); const { host, panel } = await openInstalled('lb-cart'); const before = w.localStorage.getItem('lb_cart');
  input(panel, 'Asha-Rae'); review(panel); save(panel).click(); save(panel).click(); await flush();
  assert.equal(api.effects(), 1); assert.equal(api.commands.length, 1); assert.equal(w.localStorage.getItem('lb_cart'), before);
  assert.equal(panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-cancel]')!.disabled, true);
  const checkout = host.querySelector('a[href$="/checkout"]')!; const click = new w.MouseEvent('click', { bubbles: true, cancelable: true }); checkout.dispatchEvent(click); assert.equal(click.defaultPrevented, true);
  panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-retry]')!.click(); await flush();
  assert.equal(api.effects(), 1); assert.equal(api.commands.length, 2); assert.deepEqual(api.commands[1], api.commands[0]);
  assert.equal(document.querySelector('[data-lb-cart-edit-panel]'), null); assert.match(w.localStorage.getItem('lb_cart')!, /Asha-Rae/);
});
test('stale-tab refusal preserves accepted cart and exact draft and requires fresh read/review', async () => {
  const api = await fixture('conflict'); const { panel } = await openInstalled('lb-cart'); const before = w.localStorage.getItem('lb_cart');
  input(panel, 'Asha-Rae'); review(panel); save(panel).click(); await flush();
  assert.equal(api.effects(), 0); assert.equal(w.localStorage.getItem('lb_cart'), before); assert.equal(q<HTMLInputElement>(panel, 'text').value, 'Asha-Rae');
  assert.equal(save(panel).disabled, true); review(panel); assert.equal(save(panel).disabled, true);
  panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-retry]')!.click(); await flush(); review(panel); assert.equal(save(panel).disabled, false);
});
test('changing actual variant UUID invalidates Review and keeps old line until acknowledgement', async () => {
  const api = await fixture(); const { panel } = await openInstalled('lb-cart'); review(panel); assert.equal(save(panel).disabled, false);
  const select = panel.querySelector<HTMLSelectElement>('[data-lb-cart-edit-variant]')!; select.value = oat; select.dispatchEvent(new w.Event('change')); assert.equal(save(panel).disabled, true); await flush();
  assert.equal(api.cart().lines[0].variant_id, moss); review(panel); save(panel).click(); await flush(); assert.equal(api.cart().lines[0].variant_id, oat);
});
test('another window revision retires Review while retaining exact transient draft', async () => {
  await fixture(); const { panel } = await openInstalled('lb-cart'); input(panel, 'Asha-Rae'); review(panel); assert.equal(save(panel).disabled, false);
  const receipt = JSON.parse(w.localStorage.getItem('lb_cart_server')!); receipt.updated_at = '2026-10-24T11:31:00.123459+00:00';
  w.localStorage.setItem('lb_cart_server', JSON.stringify(receipt)); w.dispatchEvent(new w.StorageEvent('storage', { key: 'lb_cart_server' }));
  assert.equal(q<HTMLInputElement>(panel, 'text').value, 'Asha-Rae'); assert.equal(save(panel).disabled, true);
  assert.equal(panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-retry]')!.hidden, false);
});
test('cart identity switch removes the previous private draft without modifying the replacement cart', async () => {
  const api = await fixture(); const { panel } = await openInstalled('lb-cart'); input(panel, 'Private unsaved name');
  w.localStorage.setItem('lb_cart_token', 'ct_other_owned_context'); w.localStorage.setItem('lb_cart', '[]'); w.localStorage.removeItem('lb_cart_server');
  w.dispatchEvent(new w.StorageEvent('storage', { key: 'lb_cart_token' }));
  assert.equal(document.querySelector('[data-lb-cart-edit-panel]'), null); assert.doesNotMatch(document.body.textContent!, /Private unsaved name/);
  assert.equal(w.localStorage.getItem('lb_cart_token'), 'ct_other_owned_context'); assert.equal(w.localStorage.getItem('lb_cart'), '[]'); assert.equal(api.commands.length, 0);
});
test('opening a saved cart is read-only; stale visible rows cannot overwrite a newer acknowledged configuration', async () => {
  const api = await fixture(); const { host, panel } = await openInstalled('lb-cart'); const oldItems = w.localStorage.getItem('lb_cart')!;
  assert.equal(api.wholeWrites.length, 0, 'mount must read the saved cart, not write a local snapshot');
  input(panel, 'Asha-Rae'); review(panel); save(panel).click(); await flush();
  const newRevision = api.cart().updated_at;
  w.localStorage.setItem('lb_cart', oldItems); w.dispatchEvent(new w.CustomEvent('letbuyy:cart:changed'));
  host.querySelector<HTMLButtonElement>('[data-lb-cart-remove]')!.click(); await flush();
  assert.equal(api.wholeWrites.length, 1); assert.equal(api.wholeWrites[0].expected_updated_at, newRevision);
  assert.ok(api.wholeWrites[0].lines.some(line => line.personalization?.text === 'Asha-Rae'), 'mutation derives from one acknowledged revision and contents, not the stale visible array');
});
test('committed edit readback for a subsequently closed cart cannot republish an active checkout', async () => {
  const api = await fixture('closed'); const { host, panel } = await openInstalled('lb-cart');
  input(panel, 'Asha-Rae'); review(panel); save(panel).click(); await flush();
  assert.equal(api.effects(), 1); assert.equal(document.querySelector('[data-lb-cart-edit-panel]'), null);
  assert.equal(JSON.parse(w.localStorage.getItem('lb_cart_server')!).status, 'abandoned');
  assert.match(w.localStorage.getItem('lb_cart')!, /Asha-Rae/); assert.equal(host.querySelector('a[href$="/checkout"]'), null);
});
test('auth refusal while recovering an uncertain save never discards its original command or falsely denies the prior commit', async () => {
  const api = await fixture('lost'); const { panel } = await openInstalled('lb-cart'); input(panel, 'Asha-Rae'); review(panel); save(panel).click(); await flush();
  const first = structuredClone(api.commands[0]), upstream = globalThis.fetch;
  globalThis.fetch = (async (input, init) => init?.method === 'PATCH'
    ? new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }), { status: 401 }) : upstream(input, init)) as typeof fetch;
  panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-retry]')!.click(); await flush();
  assert.equal(panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-cancel]')!.disabled, true); assert.equal(save(panel).disabled, true); assert.equal(api.effects(), 1);
  globalThis.fetch = upstream; panel.querySelector<HTMLButtonElement>('[data-lb-cart-edit-retry]')!.click(); await flush();
  assert.deepEqual(api.commands[1], first); assert.equal(api.effects(), 1); assert.equal(document.querySelector('[data-lb-cart-edit-panel]'), null);
});
