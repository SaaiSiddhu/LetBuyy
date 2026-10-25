import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readProductNicheFacts, AcceptedPersonalizationSchema } from '@letbuyy/commerce-core';
import { NicheOrderFacts } from './niche-order-facts';
const requireUI = createRequire(path.resolve(__dirname, '../../../../../../packages/typescript/ui/package.json'));
const { JSDOM } = requireUI('jsdom') as { JSDOM: new (html: string) => { window: Window & typeof globalThis & { close(): void } } };

function render(props: React.ComponentProps<typeof NicheOrderFacts>) {
    const html = renderToStaticMarkup(<NicheOrderFacts {...props} />);
    const dom = new JSDOM(html);
    return { html, dom, document: dom.window.document };
}
test('saved facts render as associated semantic terms and values with no links, form or product lookup', () => {
    const facts = readProductNicheFacts({ food: { netQuantity: { value: 500, unit: 'ml' }, ingredients: 'Saved product ingredients' }, books: { kind: 'book', language: 'Hindi', format: 'paperback', edition: 'Recorded edition 2' } });
    const h = render({ facts, options: { 'Pack size': 'Saved pack label', 'आकार': 'बड़ा' } });
    try {
        assert.match(h.document.body.textContent!, /500 ml/); assert.match(h.document.body.textContent!, /Recorded edition 2/); assert.match(h.document.body.textContent!, /Saved product ingredients/);
        assert.match(h.document.body.textContent!, /Pack sizeSaved pack label/); assert.match(h.document.body.textContent!, /आकारबड़ा/);
        assert.equal(h.document.querySelector('summary')!.textContent, 'Saved product details');
        for (const section of h.document.querySelectorAll('section')) assert.ok(h.document.getElementById(section.getAttribute('aria-labelledby')!));
        assert.ok(h.document.querySelectorAll('dt').length > 0); assert.equal(h.document.querySelectorAll('dt').length, h.document.querySelectorAll('dd').length);
        assert.equal(h.document.querySelector('a,form,button,input,script,iframe'), null);
    } finally { h.dom.window.close(); }
});
test('accepted Unicode text and hostile saved text remain escaped and private metadata is absent', () => {
    const attack = '<img src=x onerror="attack()"><script>attack()</script>';
    const personalization = AcceptedPersonalizationSchema.parse({ version: 1, facts_revision: 1, method: { id: 'engrave', label: 'Engrave' }, style: { id: 'serif', label: 'Serif' }, placement: { id: 'front', label: 'Front' }, text: attack + ' आशा' });
    const facts = readProductNicheFacts({ beauty: { ingredients: attack }, internal_supplier: 'PRIVATE-SUPPLIER', electronics: { fact_sheet: { reference: 'javascript:attack()', source_date: '2026-01-01' } } });
    const h = render({ facts, personalization, itemName: attack });
    try {
        assert.match(h.document.body.textContent!, /आशा/); assert.ok(h.document.body.textContent!.includes(attack)); assert.ok(h.html.includes('&lt;img'));
        assert.equal(h.document.querySelector('script,img,svg,iframe,[onerror],[onclick],a'), null); assert.doesNotMatch(h.html, /PRIVATE-SUPPLIER/);
        assert.ok(h.document.body.textContent!.includes('javascript:attack()'));
    } finally { h.dom.window.close(); }
});
test('missing facts are explicit and separate mounted order lines have unique section identities', () => {
    const facts = readProductNicheFacts({ books: { kind: 'book' } });
    const html = renderToStaticMarkup(<div><NicheOrderFacts /><NicheOrderFacts facts={facts} itemName="First item" /><NicheOrderFacts facts={facts} itemName="Second item" /></div>);
    const dom = new JSDOM(html);
    try {
        assert.equal(dom.window.document.querySelectorAll('details').length, 2);
        assert.match(dom.window.document.body.textContent!, /Product details were not recorded with this order/);
        assert.deepEqual([...dom.window.document.querySelectorAll('summary')].map(e => e.textContent), ['Saved product details for First item', 'Saved product details for Second item']);
        const ids = [...dom.window.document.querySelectorAll('[id]')].map(element => element.id);
        assert.equal(new Set(ids).size, ids.length);
        assert.doesNotMatch(dom.window.document.body.textContent!, /0 g|0 ml|Arrives tomorrow|free delivery|allergen-free/i);
    } finally { dom.window.close(); }
});
