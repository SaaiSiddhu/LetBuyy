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

test('platform controls escape query attributes and preserve local navigation', async () => {
    const { JSDOM } = await import('jsdom');
    const { productOriginFilterMarkup, collectionPaginationMarkup } = await import('./platform-control-markup');
    const attack = '\"><img src=x onerror=alert(1)>';
    const route = { type: 'search' as const, path: '/store/demo/search', subdomain: 'demo', searchParams: { search: attack, country_of_origin: attack } };
    const doc = new JSDOM(productOriginFilterMarkup(route)).window.document;
    assert.equal(doc.querySelectorAll('img,script,[onerror]').length, 0);
    assert.equal(doc.querySelector<HTMLInputElement>('[name="search"]')!.value, attack);
    assert.equal(doc.querySelector<HTMLInputElement>('[name="country_of_origin"]')!.value, attack);
    const clear = new URL(doc.querySelector('a')!.getAttribute('href')!, 'https://store.invalid');
    assert.equal(clear.searchParams.get('search'), attack);
    assert.equal(clear.searchParams.has('country_of_origin'), false);
    const pages = new JSDOM(collectionPaginationMarkup({items:[],nextCursor:attack,previousCursor:null}, '/store/demo/collections')).window.document;
    assert.equal(pages.querySelectorAll('img,script,[onerror]').length,0);
    assert.equal(new URL(pages.querySelector('a')!.getAttribute('href')!, 'https://store.invalid').searchParams.get('after'), attack);
    for (const path of ['//evil.invalid', 'https://evil.invalid', '/\\evil.invalid', '/\nevil.invalid']) {
        assert.throws(() => productOriginFilterMarkup({...route,path}), /local path/);
        assert.throws(() => collectionPaginationMarkup({items:[],nextCursor:'cursor',previousCursor:null},path), /local path/);
    }
});
