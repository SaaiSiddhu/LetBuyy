import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicProduct, withPublicPriceObservation } from '../lib/public-product-view';

test('public compare price is the complete prior-period low, never an unsupported merchant claim', () => {
    const product = {
        id: 'product-1',
        price: 80,
        compare_price: 150,
        private_margin: 7,
    };
    const incomplete = withPublicPriceObservation(product, {
        current_price: 80,
        prior_lowest_price_30d: 100,
        prior_coverage_complete: false,
        price_observed_at: '2026-10-04T00:00:00Z',
    });
    assert.equal(incomplete.compare_price, null);
    assert.equal(incomplete.prior_lowest_price_30d, 100);
    assert.equal(incomplete.prior_price_coverage_complete, false);

    const complete = withPublicPriceObservation(product, {
        current_price: '80.00',
        prior_lowest_price_30d: '100.00',
        prior_coverage_complete: true,
        price_observed_at: '2026-10-04T00:00:00Z',
    });
    assert.equal(complete.compare_price, 100);
    const exposed = toPublicProduct(complete);
    assert.equal(exposed.compare_price, 100);
    assert.equal(exposed.prior_price_coverage_complete, true);
    assert.equal('private_margin' in exposed, false);
});

test('country of origin is public product data while unapproved/private product fields stay filtered', () => {
    const exposed = toPublicProduct({
        id: 'product-origin',
        country_of_origin: 'India',
        importer_details: 'Example Imports, Mumbai',
        importer_registration: 'private',
        cost_per_item: 12,
    });
    assert.equal(exposed.country_of_origin, 'India');
    assert.equal(exposed.importer_details, 'Example Imports, Mumbai');
    assert.ok(!('importer_registration' in exposed));
    assert.equal('importer_registration' in exposed, false);
    assert.equal('cost_per_item' in exposed, false);
});

test('a reference at or below the current price does not create a sale claim', () => {
    const product = withPublicPriceObservation({ id: 'product-2', price: 80, compare_price: 150 }, {
        current_price: 80,
        prior_lowest_price_30d: 79,
        prior_coverage_complete: true,
        price_observed_at: '2026-10-04T00:00:00Z',
    });
    assert.equal(product.compare_price, null);
});

test('variant price-history fields survive the recursive public projection', () => {
    const product = withPublicPriceObservation({
        id: 'product-3',
        price: 50,
        variants: [withPublicPriceObservation({ id: 'variant-1', price: 45, sku: 'private-sku' }, {
            current_price: 45,
            prior_lowest_price_30d: 60,
            prior_coverage_complete: true,
            price_observed_at: '2026-10-04T00:00:00Z',
        })],
    }, {
        current_price: 50,
        prior_lowest_price_30d: null,
        prior_coverage_complete: false,
        price_observed_at: '2026-10-04T00:00:00Z',
    });
    const exposed = toPublicProduct(product);
    const variant = (exposed.variants as Array<Record<string, unknown>>)[0];
    assert.equal(variant.compare_price, 60);
    assert.equal(variant.prior_price_coverage_complete, true);
    assert.equal('sku' in variant, false);
});

test('public variant option labels expose only the option contract', () => {
    const exposed = toPublicProduct({ id: 'p', product_options: [{ name: 'Size', position: 0, values: ['Small', { secret: 'hidden' }], product_id: 'private-owner', internal_note: 'hidden' }] });
    assert.deepEqual(exposed.product_options, [{ name: 'Size', position: 0, values: ['Small'] }]);
});
