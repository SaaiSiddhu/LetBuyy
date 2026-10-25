import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPlan, validateBindings, type ReadbackBindings } from './public-readback';

test('unallocated plan refuses before any request; no live IDs or acceptance are fabricated', () => {
    const plan = JSON.parse(readFileSync(new URL('../installed-circuit-fixture.plan.json', import.meta.url), 'utf8'));
    assert.ok(Object.values(plan.bindings).every(value => value === null));
    assert.throws(() => validateBindings(plan.bindings));
});
test('bound query recipe uses canonical schemas, exact supplied tuples and explicit diagnostic without a local filter', () => {
    // Synthetic schema-only identifiers. Never written into the runtime recipe.
    const ids = [1, 2, 3, 4, 5, 6, 7, 8].map(value => `${String(value).repeat(8)}-1111-4111-8111-111111111111`);
    const bindings: ReadbackBindings = { editorRunId: 'synthetic-schema-only', gatewayOrigin: 'http://127.0.0.1:12345', siteId: ids[0],
        subdomain: 'synthetic-schema-only', releaseId: ids[1], releaseDigest: 'a'.repeat(64),
        productIds: { electronics: ids[2], charger: ids[3], cable: ids[4], unknown: ids[5] }, collectionIds: { 'circuit-all': ids[6], 'circuit-empty': ids[7] } };
    const plan = readPlan(bindings); assert.equal(plan.length, 14);
    assert.deepEqual(plan.find(item => item.id === 'connector-or')!.query.connector, ['ac-plug', 'usb-a']);
    assert.deepEqual(plan.find(item => item.id === 'hub-three-power-facts')!.expected, ['electronics']);
    assert.equal(plan.find(item => item.id === 'known-empty-membership')!.query.collection_id, ids[7]);
    assert.equal(plan.find(item => item.id === 'model-only-search-diagnostic')!.diagnostic, true);
    assert.throws(() => validateBindings({ ...bindings, gatewayOrigin: 'https://api.letbuyy.com' }));
    assert.throws(() => validateBindings({ ...bindings, gatewayOrigin: 'http://example.com' }));
    assert.throws(() => validateBindings({ ...bindings, gatewayOrigin: 'http://user:secret@localhost:12345' }));
});
