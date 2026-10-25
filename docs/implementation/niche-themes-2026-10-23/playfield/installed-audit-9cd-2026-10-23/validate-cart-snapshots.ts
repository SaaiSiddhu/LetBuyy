/** Validate saved whitelisted cart snapshots only. No live application or database calls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { ProductFactSnapshotSchema } from '@letbuyy/commerce-core';

type SavedCart = { result: { activeCarts: Array<{ items: Array<{ variantId: string; nicheSnapshot: unknown }> }> } };
const out = new URL('./', import.meta.url);
const root = new URL('../../../../../', import.meta.url);
const path = new URL('inputs/editor/cart-playfield-two-editions.json', out);
const saved = JSON.parse(readFileSync(path, 'utf8')) as SavedCart;
const results = saved.result.activeCarts.flatMap(cart => cart.items.map(line => {
    const parsed = ProductFactSnapshotSchema.safeParse(line.nicheSnapshot);
    assert.ok(parsed.success, `Actual saved snapshot for ${line.variantId} must validate`);
    return { variantId: line.variantId, schemaValid: true };
}));
assert.equal(results.length, 2);
const source = new URL('packages/commerce-core/src/product-fact-snapshot.ts', root);
const result = {
    classification: 'SAVED_CART_SCHEMA_VALIDATION_NOT_ORDER_ACCEPTANCE',
    sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'),
    inputSha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    results,
};
writeFileSync(new URL('cart-snapshot-schema-validation.json', out), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify({ savedCartSnapshotsValid: results.length, liveCalls: 0 }) + '\n');
