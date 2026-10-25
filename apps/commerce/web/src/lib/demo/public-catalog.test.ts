import assert from 'node:assert/strict';
import test from 'node:test';
import type { Theme } from '@letbuyy/shared-types';
import { publicCatalogHref, publicCatalogQuery, publicThemePrice } from './public-catalog';
test('public discovery accepts bounded filters and refuses invalid selection or page', () => {
    assert.equal(publicCatalogQuery({ page: '0' }).success, false);
    assert.equal(publicCatalogQuery({ page: '501' }).success, false);
    assert.equal(publicCatalogQuery({ theme: '../merchant' }).success, false);
    assert.equal(publicCatalogQuery({ sort: 'invented' }).success, false);
    assert.equal(publicCatalogQuery({ search: 'x'.repeat(121) }).success, false);
    assert.deepEqual(publicCatalogQuery({ category: 'clothing', page: '2' }).data, { search: undefined, theme: undefined, category: 'clothing', sort: 'portfolio', page: 2 });
});
test('detail and return URLs preserve filters and reset pagination intentionally', () => {
    const href = publicCatalogHref({ search: 'linen', category: 'clothing', page: 2 }, { theme: 'letbuyy-sense' });
    assert.equal(href, '/theme-preview?search=linen&category=clothing&page=2&theme=letbuyy-sense');
    assert.equal(publicCatalogHref({ search: 'linen', theme: 'letbuyy-sense' }, { theme: undefined, page: 1 }), '/theme-preview?search=linen&page=1');
});
test('missing pricing never presents a free theme', () => {
    const price = (value: object) => publicThemePrice(value as Theme);
    assert.equal(price({}), 'Pricing unavailable');
    assert.equal(price({ pricing_type: 'free', price_inr: 100 }), 'Pricing unavailable');
    assert.equal(price({ letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 }), 'Free');
    assert.equal(price({ pricing_type: 'free', price_inr: 0, is_premium: true }), 'Pricing unavailable');
    assert.match(price({ pricing_type: 'one_time', price_inr: 499 }), /499/);
});
