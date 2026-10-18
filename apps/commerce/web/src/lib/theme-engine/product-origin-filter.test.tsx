import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorefrontProductOriginFilter } from './product-origin-filter';

test('origin filter keeps the current collection path and active browse query', () => {
    const html = renderToStaticMarkup(createElement(StorefrontProductOriginFilter, {
        route: {
            type: 'collection',
            path: '/store/demo/collections/summer?country_of_origin=India',
            subdomain: 'demo',
            searchParams: {
                country_of_origin: 'India',
                search: 'linen',
                category: 'clothing',
                page: '2',
            },
        },
    }));

    assert.match(html, /action="\/store\/demo\/collections\/summer"/);
    assert.match(html, /name="country_of_origin"[^>]*value="India"/);
    assert.match(html, /name="search" value="linen"/);
    assert.match(html, /name="category" value="clothing"/);
    assert.match(html, /name="page" value="2"/);
    assert.match(html, /Clear origin filter/);
});

test('origin filter omits itself in editor preview and on unrelated routes', () => {
    const route = { type: 'collection' as const, path: '/store/demo/shop', subdomain: 'demo' };
    assert.equal(StorefrontProductOriginFilter({ route, editorMode: true }), null);
    assert.equal(StorefrontProductOriginFilter({ route: { ...route, type: 'product' } }), null);
});
