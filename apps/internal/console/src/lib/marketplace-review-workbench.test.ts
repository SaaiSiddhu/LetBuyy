import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketplaceRevisionDiff, getSafeMarketplaceEvidenceLinks } from './marketplace-revision-diff';
import { buildListingDecisionBody } from './listing-decision';

test('first marketplace submission compares against an absent baseline without a blank diff row', () => {
    const diff = buildMarketplaceRevisionDiff(null, {
        product: { name: 'New product', images: ['https://cdn.example.test/product.png'] },
    });

    assert.deepEqual(diff, [
        { path: 'product.name', before: '—', after: 'New product' },
        { path: 'product.images[0]', before: '—', after: 'https://cdn.example.test/product.png' },
    ]);
});

test('marketplace evidence links are unique HTTP(S) URLs without embedded credentials', () => {
    const links = getSafeMarketplaceEvidenceLinks({
        product: {
            images: [
                'https://cdn.example.test/image.png',
                'https://cdn.example.test/image.png',
                'https://reviewer:secret@cdn.example.test/private.png',
                'javascript:alert(1)',
                'ftp://cdn.example.test/image.png',
                'not a url',
            ],
        },
    });

    assert.deepEqual(links, ['https://cdn.example.test/image.png']);
});

test('review decisions trim required values and bind the request to the authenticated operator', () => {
    assert.deepEqual(buildListingDecisionBody({
        decision: 'approve',
        reason: '',
        idempotencyKey: '  review-key  ',
        operatorUserId: '550e8400-e29b-41d4-a716-446655440000',
    }), {
        idempotency_key: 'review-key',
        operator_user_id: '550e8400-e29b-41d4-a716-446655440000',
    });

    assert.throws(() => buildListingDecisionBody({
        decision: 'reject',
        reason: '  short  ',
        idempotencyKey: 'review-key',
        operatorUserId: '550e8400-e29b-41d4-a716-446655440000',
    }), /requires a reason/);
    assert.throws(() => buildListingDecisionBody({
        decision: 'approve',
        reason: '',
        idempotencyKey: 'review-key',
        operatorUserId: 'not-a-uuid',
    }), /operator identity is unavailable/);
});
