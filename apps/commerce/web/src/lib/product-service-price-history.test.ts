import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPublicProductPriceHistory } from './product-price-history';

test('product mapping only exposes a compare-at reference with complete 30-day history', () => {
    const incomplete = mapPublicProductPriceHistory({
        id: 'product-1',
        name: 'Item',
        price: 80,
        compare_price: 120,
        compare_at_price: 150,
        prior_lowest_price_30d: 120,
        prior_price_coverage_complete: false,
    });

    assert.equal(incomplete.compareAtPrice, undefined);
    assert.equal(incomplete.priorLowestPrice30d, undefined);
    assert.equal(incomplete.priorPriceCoverageComplete, false);

    const complete = mapPublicProductPriceHistory({
        id: 'product-2',
        name: 'Item',
        price: 80,
        compare_price: 120,
        prior_lowest_price_30d: '120.00',
        prior_price_coverage_complete: true,
    });

    assert.equal(complete.compareAtPrice, 120);
    assert.equal(complete.priorLowestPrice30d, 120);
    assert.equal(complete.priorPriceCoverageComplete, true);
});

test('variant compare-at references require complete evidence and must exceed the current price', () => {
    const product = mapPublicProductPriceHistory({
        id: 'product-3',
        name: 'Item',
        price: 80,
        variants: [
            { id: 'v1', price: 70, compare_price: 100, prior_lowest_price_30d: 100, prior_price_coverage_complete: true },
            { id: 'v2', price: 60, compare_price: 90, prior_lowest_price_30d: 90, prior_price_coverage_complete: false },
            { id: 'v3', price: 50, compare_price: 70, prior_lowest_price_30d: 50, prior_price_coverage_complete: true },
        ],
    });

    assert.deepEqual(product.variants.map((variant) => variant.compare_price), [100, null, null]);
});
