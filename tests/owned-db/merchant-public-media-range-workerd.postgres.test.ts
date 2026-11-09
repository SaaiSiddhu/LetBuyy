// Actual compiled Gateway + ephemeral R2; no browser/device/hosted claim.
import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeGateway } from '../helpers/native-owned-gateway';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { gatewayEnv, newIdentityKeys } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
const owned = requireOwnedDatabase();

test('compiled public media honors byte delivery without exposing protected object facts', async t => {
  const gateway = await NativeGateway.create(gatewayEnv(owned, await newIdentityKeys()) as unknown as Record<string, unknown>, async () => { throw new Error('No external provider belongs to asset reads'); });
  try {
    const bucket = await gateway.mf.getR2Bucket('R2_BUCKET');
    const key = 'public-media/synthetic/range.mp4', bytes = '0123456789';
    await bucket.put(key, bytes, { httpMetadata: { contentType: 'video/mp4' }, customMetadata: { visibility: 'public', delivery: 'letbuyy-public-v1' } });
    const get = (headers: Record<string, string> = {}, method = 'GET') => gateway.dispatch('/assets/' + key, { method, headers });
    const full = await get(); assert.equal(full.status, 200); assert.equal(await full.text(), bytes);
    const etag = full.headers.get('ETag')!; assert.ok(etag);
    for (const [range, expected, contentRange] of [
      ['bytes=0-1', '01', 'bytes 0-1/10'], ['bytes=4-', '456789', 'bytes 4-9/10'],
      ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-99999999999999999999999999', '89', 'bytes 8-9/10'],
    ]) await t.test('partial ' + range, async () => {
      const reply = await get({ Range: range }); assert.equal(reply.status, 206);
      assert.equal(reply.headers.get('Content-Range'), contentRange);
      assert.equal(reply.headers.get('Content-Length'), String(expected.length));
      assert.equal(reply.headers.get('Accept-Ranges'), 'bytes'); assert.equal(await reply.text(), expected);
    });
    for (const range of ['bytes=10-', 'bytes=7-2', 'bytes=-0', 'bytes=99999999999999999999999999-']) await t.test('unsatisfiable ' + range, async () => {
      const reply = await get({ Range: range }); assert.equal(reply.status, 416);
      assert.equal(reply.headers.get('Content-Range'), 'bytes */10'); assert.equal(await reply.text(), '');
    });
    await t.test('If-Range matches strongly or delivers the complete current object', async () => {
      const matching = await get({ Range: 'bytes=0-1', 'If-Range': etag }); assert.equal(matching.status, 206); assert.equal(await matching.text(), '01');
      for (const condition of ['"old-revision"', 'W/' + etag, 'Wed, 21 Oct 2015 07:28:00 GMT']) {
        const different = await get({ Range: 'bytes=0-1', 'If-Range': condition }); assert.equal(different.status, 200); assert.equal(await different.text(), bytes);
      }
    });
    await t.test('HEAD ignores Range and conditional cache hits take precedence', async () => {
      const head = await get({ Range: 'bytes=0-1' }, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.headers.get('Content-Length'), '10'); assert.equal(head.headers.get('Accept-Ranges'), 'bytes'); assert.equal(await head.text(), '');
      const cached = await get({ Range: 'bytes=99-', 'If-None-Match': etag }); assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
    });
    await t.test('unsupported multi-ranges and malformed units retain full delivery', async () => {
      for (const range of ['bytes=0-1,4-5', 'items=1-3', 'bytes=bad']) {
        const reply = await get({ Range: range }); assert.equal(reply.status, 200); assert.equal(await reply.text(), bytes);
      }
    });
    await t.test('range and conditional requests disclose no protected or unsupported bytes or length', async () => {
      for (const [name, metadata, contentType] of [
        ['private', { visibility: 'private', delivery: 'letbuyy-public-v1' }, 'video/mp4'],
        ['wrong-delivery', { visibility: 'public', delivery: 'private-v1' }, 'video/mp4'],
        ['script', { visibility: 'public', delivery: 'letbuyy-public-v1' }, 'image/svg+xml'],
      ] as const) {
        const secret = 'public-media/synthetic/' + name; await bucket.put(secret, 'PRIVATE-CONTROL', { httpMetadata: { contentType }, customMetadata: metadata });
        for (const headers of [{ Range: 'bytes=0-1' }, { Range: 'bytes=99-', 'If-None-Match': etag }]) {
          const reply = await gateway.dispatch('/assets/' + secret, { headers }); assert.equal(reply.status, 404);
          assert.equal(reply.headers.get('Content-Range'), null); assert.notEqual(reply.headers.get('Content-Length'), '15');
          assert.equal(reply.headers.get('Cache-Control'), 'no-store'); assert.doesNotMatch(await reply.text(), /PRIVATE-CONTROL/);
        }
      }
    });
  } finally { await gateway.settle(); }
});
