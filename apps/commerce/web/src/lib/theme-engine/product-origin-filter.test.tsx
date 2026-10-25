import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StorefrontDiscoveryQueryInput } from '@letbuyy/commerce-core';
import { discoveryRouteQuery, scalarDiscoveryQuery } from './discovery-route-query';
import { productOriginFilterMarkup } from './platform-control-markup';
import { StorefrontProductOriginFilter } from './product-origin-filter';
import { projectDiscoveryPage } from './storefront-discovery';

test('origin Apply and Clear conserve the observed Pantry query including repeated connectors', async () => {
    const { JSDOM } = await import('jsdom');
    const query = discoveryRouteQuery({
        page: '4', limit: '1', search: 'lentils', category: 'Staples',
        country_of_origin: 'India', sort: 'newest', pack_size: 'g:250',
        connector: ['usb-c', 'hdmi'], collection_id: '82c43d65-85bc-4313-a49b-c745c8328de6',
    });
    for (const type of ['collection', 'search'] as const) {
        const path = `/store/demo/${type === 'collection' ? 'collections/staples' : 'search'}`;
        const html = renderToStaticMarkup(createElement(StorefrontProductOriginFilter, {
            route: { type, path, subdomain: 'demo', discoveryQuery: query, searchParams: scalarDiscoveryQuery(query) },
        }));
        const dom = new JSDOM(html);
        const window = dom.window as typeof dom.window & { FormData: typeof FormData; close(): void };
        const form = dom.window.document.querySelector('form')!;
        assert.equal(form.getAttribute('method'), 'get');
        assert.equal(form.getAttribute('action'), path);
        form.querySelector<HTMLInputElement>('[name="country_of_origin"]')!.value = 'Nepal';
        const submitted = new URLSearchParams(Array.from(new window.FormData(form), ([key, value]) => [key, String(value)]));
        assert.equal(submitted.getAll('country_of_origin').length, 1);
        assert.deepEqual(submitted.getAll('connector'), ['hdmi', 'usb-c']);
        assert.deepEqual(discoveryRouteQuery(submitted), { ...query, page: 1, country_of_origin: 'Nepal', connector: ['hdmi', 'usb-c'] });
        const cleared = new URL(dom.window.document.querySelector('a')!.getAttribute('href')!, 'https://store.invalid');
        assert.equal(cleared.pathname, path);
        const expectedClear = { ...query, page: 1, connector: ['hdmi', 'usb-c'] };
        delete expectedClear.country_of_origin;
        assert.deepEqual(discoveryRouteQuery(cleared.searchParams), expectedClear);
        window.close();
    }
});

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
    assert.doesNotMatch(html, /name="page"/);
    assert.match(html, /Clear origin filter/);
});

const nicheQueries = {
    apparel: { size: 'M', color: 'Blue', min_price: 10, max_price: 40 },
    toys: { age_band: '6-8', interest: 'making' },
    electronics: { electronics_kind: 'hub', connector: ['hdmi', 'usb-c'], power_input_w: 100, power_output_w: 65, power_capacity_w: 100, pass_through_output_w: 60, data_rate_mbps: 5000, length_mm: 150 },
    food: { pack_size: 'ml:500' },
    furniture: { material: 'Oak " ><img src=x onerror=alert(1)>', finish: "Oiled & waxed ' satin", max_width_cm: 80, max_depth_cm: 40 },
    gifts: { occasion: 'birthday', recipient: 'friend' },
    personalization: { personalization_method: 'engraving' },
    beauty: { routine_stage: 'care', format: 'Serum', shade: 'Rose' },
    sports: { activity: 'Badminton', equipment_type: 'racket', length_value: 68.5, length_unit: 'cm' },
    books: { books_kind: 'stationery', books_author: 'A Writer', books_subject: 'Math', books_language: 'Tamil', books_format: 'spiral-bound', books_ruling: 'dotted' },
} satisfies Record<string, StorefrontDiscoveryQueryInput>;

for (const [niche, filters] of Object.entries(nicheQueries)) {
    test(`origin control conserves ${niche} filters on Apply, blank Apply and Clear`, async () => {
        const { JSDOM } = await import('jsdom');
        const query = discoveryRouteQuery({ ...filters, page: 7, limit: 2, sort: 'price-desc', search: 'browse & " <script>bad</script>', country_of_origin: 'India' });
        // Canonical context is authoritative; scalar compatibility values cannot replace it.
        const dom = new JSDOM(productOriginFilterMarkup({
            type: 'search', path: '/store/demo/search', subdomain: 'demo', discoveryQuery: query,
            searchParams: { country_of_origin: 'Wrong', search: 'wrong', token: 'transport-only' },
        }));
        const window = dom.window as typeof dom.window & { FormData: typeof FormData; close(): void };
        const doc = dom.window.document, form = doc.querySelector('form')!;
        assert.equal(doc.querySelectorAll('img,script,[onerror]').length, 0);
        const origin = form.querySelector<HTMLInputElement>('[name="country_of_origin"]')!;
        assert.equal(origin.value, 'India');
        const expectedClear = { ...query, page: 1 };
        delete expectedClear.country_of_origin;
        for (const country of ['Nepal', '']) {
            origin.value = country;
            const params = new URLSearchParams(Array.from(new window.FormData(form), ([key, value]) => [key, String(value)]));
            assert.equal(params.has('token'), false);
            const actual = discoveryRouteQuery(params);
            if (country) assert.deepEqual(actual, { ...query, page: 1, country_of_origin: country });
            else { delete actual.country_of_origin; assert.deepEqual(actual, expectedClear); }
        }
        const clear = new URL(doc.querySelector('a')!.getAttribute('href')!, 'https://store.invalid');
        assert.deepEqual(discoveryRouteQuery(clear.searchParams), expectedClear);
        window.close();
    });
}

test('origin control accepts the existing q alias, omits transport fields and binds collection scope', async () => {
    const { JSDOM } = await import('jsdom');
    const collectionId = '82c43d65-85bc-4313-a49b-c745c8328de6';
    const route = { type: 'collection' as const, path: '/store/demo/collections/staples', subdomain: 'demo', searchParams: {
        q: 'lentils', collection_id: collectionId, token: 'transport-only', editor: '1', variant: 'selection', theme_preview_token: 'preview-only',
    } };
    const dom = new JSDOM(productOriginFilterMarkup(route));
    const window = dom.window as typeof dom.window & { FormData: typeof FormData; close(): void };
    const form = dom.window.document.querySelector('form')!;
    assert.equal(dom.window.document.querySelector('a'), null);
    const params = new URLSearchParams(Array.from(new window.FormData(form), ([key, value]) => [key, String(value)]));
    assert.equal(params.has('q'), false);
    assert.equal(params.get('search'), 'lentils');
    assert.equal(params.get('collection_id'), collectionId);
    for (const key of ['token', 'editor', 'variant', 'theme_preview_token']) assert.equal(params.has(key), false);
    const query = discoveryRouteQuery(params);
    assert.equal(query.page, 1);
    assert.equal(query.limit, 20);
    assert.equal(query.sort, 'display_order');
    assert.equal(query.country_of_origin, undefined);
    assert.throws(() => productOriginFilterMarkup({ ...route, discoveryQuery: discoveryRouteQuery({ collection_id: '7369995f-a9f9-44bb-8dee-bb0ab7b8e265' }) }), /selected collection/);
    assert.throws(() => productOriginFilterMarkup({ ...route, searchParams: { sort: 'unknown' } }), /filter values/);
    assert.throws(() => productOriginFilterMarkup({ ...route, searchParams: { length_value: '5' } }), /filter values/);
    window.close();
});

test('origin control after canonical clear-all does not restore stale niche filters', async () => {
    const { JSDOM } = await import('jsdom');
    const path = '/store/demo/collections/staples';
    const query = discoveryRouteQuery({
        page: 4, limit: 1, sort: 'newest', search: 'lentils', category: 'Staples', country_of_origin: 'India',
        pack_size: 'g:250', connector: ['usb-c', 'hdmi'], collection_id: '82c43d65-85bc-4313-a49b-c745c8328de6',
    });
    const clearAll = projectDiscoveryPage({ data: [], total: 0, page: query.page, limit: query.limit, has_more: false }, path, query, true).collection.clear_filters_url;
    const cleared = discoveryRouteQuery(new URL(clearAll, 'https://store.invalid').searchParams);
    const dom = new JSDOM(productOriginFilterMarkup({
        type: 'collection', path, subdomain: 'demo', discoveryQuery: cleared, searchParams: scalarDiscoveryQuery(query),
    }));
    const window = dom.window as typeof dom.window & { FormData: typeof FormData; close(): void };
    assert.equal(dom.window.document.querySelector('a'), null);
    const form = dom.window.document.querySelector('form')!;
    form.querySelector<HTMLInputElement>('[name="country_of_origin"]')!.value = 'Nepal';
    const submitted = discoveryRouteQuery(new URLSearchParams(Array.from(new window.FormData(form), ([key, value]) => [key, String(value)])));
    assert.deepEqual(submitted, { page: 1, limit: 1, sort: 'newest', search: 'lentils', collection_id: query.collection_id, country_of_origin: 'Nepal' });
    window.close();
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
