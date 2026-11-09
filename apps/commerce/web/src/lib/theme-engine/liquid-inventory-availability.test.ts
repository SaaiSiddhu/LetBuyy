import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { applyLiquidInventoryAvailability } from './liquid-inventory-availability';

const unknown = { id: 'synthetic-unknown', inventory_known: false };
const known = { id: 'synthetic-known', inventory_known: true };
const card = (id: string) => `<article class="lb-product-card"><span class="lb-product-card__badge lb-product-card__badge--sold-out">Sold out</span><lb-add-to-cart data-product-id="${id}"><button data-lb-add-to-cart disabled>Sold out</button></lb-add-to-cart></article>`;

test('known inventory leaves already sanitized HTML byte-identical and does not inspect arbitrary metadata', async () => {
    const html = card(known.id);
    for (const scope of [{ product: known }, {}, { metadata: { product: unknown } }]) {
        assert.equal(await applyLiquidInventoryAvailability(html, scope), html);
    }
});

test('unknown stock repairs existing immutable card markup without changing a neighboring known product or merchant content', async () => {
    const context = { collection: { products: [unknown, known] } }, before = structuredClone(context);
    const html = `<section data-section-id="catalog"><h2>Merchant copy &amp; identity</h2>${card(unknown.id)}${card(known.id)}</section>`;
    const result = await applyLiquidInventoryAvailability(html, context), dom = new JSDOM(result);
    try {
        const [unavailable, available] = dom.window.document.querySelectorAll('article');
        assert.equal(unavailable.querySelector('lb-add-to-cart')?.getAttribute('data-inventory-known'), 'false');
        assert.equal(unavailable.querySelector('button')?.textContent, 'Stock unavailable');
        assert.equal(unavailable.querySelector('button')?.getAttribute('aria-disabled'), 'true');
        assert.equal(unavailable.querySelector('[role="status"]')?.textContent, 'Stock unavailable. Reload and try again.');
        assert.equal(unavailable.querySelector('.lb-product-card__badge--sold-out'), null);
        assert.doesNotMatch(unavailable.textContent!, /Sold out/);
        assert.equal(available.outerHTML, new JSDOM(card(known.id)).window.document.querySelector('article')!.outerHTML);
        assert.equal(dom.window.document.querySelector('section')?.getAttribute('data-inventory-known'), null, 'one unknown card cannot disable its entire collection');
        assert.equal(dom.window.document.querySelector('h2')?.textContent, 'Merchant copy & identity');
        assert.deepEqual(context, before);
    } finally { (dom.window as unknown as { close(): void }).close(); }
});

test('server product, collection, search, section and wishlist drop sources all bind the same unknown purchase guard', async () => {
    const html = `<section data-section-id="detail"><lb-variant-picker data-product-id="${unknown.id}"><p data-lb-variant-status></p></lb-variant-picker><lb-add-to-cart data-product-id="${unknown.id}"><button data-lb-add-to-cart>Add to cart</button><button data-lb-buy-now>Buy now</button></lb-add-to-cart></section>`;
    for (const scope of [{ product: unknown }, { collection: { products: [unknown] } }, { search: { results: [unknown] } },
        { section_products: { featured: [unknown] } }, { customer: { wishlist_products: [unknown] } }, { buyer_wishlist: { products: [unknown] } }]) {
        const dom = new JSDOM(await applyLiquidInventoryAvailability(html, scope));
        try {
            assert.equal(dom.window.document.querySelector('section')?.getAttribute('data-inventory-known'), 'false');
            for (const button of dom.window.document.querySelectorAll('button')) assert.equal(button.disabled, true);
            assert.equal(dom.window.document.querySelector('[data-lb-variant-status]')?.textContent, 'Stock unavailable. Reload and try again.');
        } finally { (dom.window as unknown as { close(): void }).close(); }
    }
});
