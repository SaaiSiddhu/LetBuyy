import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { ReelUploadBeginSchema, ReelUploadRetrySchema, REEL_UPLOAD_METADATA_BYTES } from '@letbuyy/shared-types';
import { parseDomainEventPayload, getDomainEventContract, queueNamesForEvent } from '@letbuyy/event-core';
import { createReelReviewSdk, type LetbuyyRequestOptions } from '@letbuyy/api-client';
import { parseReelUploadProfile, readReelUploadJson } from '../execution/reel-upload.adapter';
import { privateOriginalRuntimeAvailable, originalKey } from '@letbuyy/infrastructure/storage-adapter';
import { inputValidation } from '../middleware/security';
import uploads from '../routes/reel-uploads';
import { AppError } from '../lib/errors';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const begin = { idempotency_key: 'same-private-original', filename: 'original.mp4', content_type: 'video/mp4', size_bytes: 4096, checksum_sha256: 'a'.repeat(64) };
// Synthetic envelope only; these values establish no business/provider policy.
const profile = { private_upload_enabled: true, processing_enabled: false, inspection_enabled: false, approved_profile_ref: 'synthetic-local-only', profile: {
  binding_ref: 'REEL_ORIGINALS_BUCKET', accepted_types: ['video/mp4'], max_bytes: 8192, max_intents: 4, max_charged_bytes: 32768,
  reservation_ttl_seconds: 120, lease_seconds: 10, max_wall_ms: 5000, gateway_ingress_max_bytes: 8192, merchant_ingress_max_bytes: 8192,
} };
const app = () => {
  const a = new Hono(); a.use('*', inputValidation as never);
  a.use('*', async (c, next) => { c.set('auth' as never, { user: { id: id(1), storeId: id(2), authSource: 'internal-sso' } } as never); await next(); });
  a.route('/v1/reels/uploads', uploads as never);
  a.onError((e, c) => c.json({ error: { code: e instanceof AppError ? e.code : 'UNEXPECTED' } }, (e instanceof AppError ? e.statusCode : 500) as 400));
  return a;
};

test('strict public DTOs reject custody, profile, URL and readiness authority injection', () => {
  assert.equal(ReelUploadBeginSchema.safeParse(begin).success, true);
  for (const extra of [{ site_id: id(2) }, { profile }, { object_key: 'public/file' }, { public_url: 'https://example.invalid/a' }, { ready: true }, { provider_asset_id: 'x' }, { admission: profile.profile }]) assert.equal(ReelUploadBeginSchema.safeParse({ ...begin, ...extra }).success, false);
  for (const change of [{ checksum_sha256: 'A'.repeat(64) }, { size_bytes: Number.MAX_SAFE_INTEGER + 1 }, { size_bytes: 15 }, { filename: 'bad\nname' }, { idempotency_key: 'space key' }]) assert.equal(ReelUploadBeginSchema.safeParse({ ...begin, ...change }).success, false);
  assert.equal(ReelUploadRetrySchema.safeParse({ idempotency_key: begin.idempotency_key, expected_version: 1, ready: true }).success, false);
});

test('missing, disabled, malformed, public binding and unsupported envelopes remain unavailable', () => {
  assert.ok(parseReelUploadProfile(profile));
  for (const value of [undefined, null, '{bad', JSON.stringify(profile).repeat(100), {}, { ...profile, approved_profile_ref: null }, { ...profile, processing_enabled: true }, { ...profile, private_upload_enabled: false }, { ...profile, profile: { ...profile.profile, binding_ref: 'R2_BUCKET' } }, { ...profile, profile: { ...profile.profile, gateway_ingress_max_bytes: 1024 } }, { ...profile, profile: { ...profile.profile, lease_seconds: 1 } }, { ...profile, profile: { ...profile.profile, accepted_types: ['video/mp4', 'video/mp4'] } }]) assert.equal(parseReelUploadProfile(value), null);
  assert.equal(privateOriginalRuntimeAvailable(), false, 'Node does not stand in for native DigestStream/FixedLengthStream');
});

test('default-off and even synthetic profile without native runtime admit no reservation or transfer', async () => {
  for (const env of [{}, { REEL_CUSTODY_PROFILE: JSON.stringify(profile), REEL_ORIGINALS_BUCKET: { head() { throw new Error('must not touch storage'); } } }]) {
    const a = app();
    const response = await a.request(`/v1/reels/uploads?store_id=${id(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Internal-Session-Token': 'synthetic' }, body: JSON.stringify(begin) }, env);
    assert.equal(response.status, 503); assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'REEL_PRIVATE_INTAKE_UNAVAILABLE');
    const raw = await a.request(`/v1/reels/uploads/${id(3)}/content?store_id=${id(2)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(2 * 1024 * 1024) }, env);
    assert.equal(raw.status, 503);
  }
});

test('bounded JSON parser measures actual UTF8 bytes and cancels before draining an oversized stream', async () => {
  const valid = new Request('https://example.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: '{"filename":"தமிழ்"}' });
  assert.deepEqual(await readReelUploadJson(valid), { filename: 'தமிழ்' });
  let pulls = 0, canceled = false;
  const stream = new ReadableStream({ pull(c) { pulls++; c.enqueue(new Uint8Array(1024)); }, cancel() { canceled = true; } });
  const request = new Request('https://example.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '1' }, body: stream, duplex: 'half' } as RequestInit);
  await assert.rejects(readReelUploadJson(request), (e: AppError) => e.statusCode === 413);
  assert.ok(canceled); assert.ok(pulls <= REEL_UPLOAD_METADATA_BYTES / 1024 + 2);
  for (const type of ['text/plain', 'application/jsonx', 'video/mp4']) await assert.rejects(readReelUploadJson(new Request('https://example.invalid', { method: 'POST', headers: { 'Content-Type': type }, body: '{}' })), (e: AppError) => e.statusCode === 415);
  await assert.rejects(readReelUploadJson(new Request('https://example.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]) })), (e: AppError) => e.statusCode === 400);
});

test('exact metadata intake bypasses eager global clone and enforces its own byte ceiling, siblings retain global checks', async () => {
  const a = app();
  const response = await a.request('/v1/reels/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: '界'.repeat(10000) }) }, {});
  assert.equal(response.status, 413); assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'REEL_UPLOAD_REQUEST_INVALID');
  const unrelated = new Hono(); unrelated.use('*', inputValidation as never); unrelated.post('/v1/reels/uploads/sibling', c => c.json({ reached: true }));
  const sibling = await unrelated.request('/v1/reels/uploads/sibling', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(1048577) }, {});
  assert.equal(sibling.status, 413); assert.equal(((await sibling.json()) as { error: { code: string } }).error.code, 'PAYLOAD_TOO_LARGE');
});

test('private upload event accepts metadata only and declares zero queue/external consumer', () => {
  const payload = { site_id: id(2), intent_id: id(3), state: 'received_unprocessed', version: 3 };
  assert.deepEqual(parseDomainEventPayload('reel.upload.changed', payload), payload);
  for (const extra of [{ filename: 'private.mp4' }, { checksum_sha256: begin.checksum_sha256 }, { object_key: 'x' }, { public_url: 'x' }, { ready: true }]) assert.throws(() => parseDomainEventPayload('reel.upload.changed', { ...payload, ...extra }));
  assert.deepEqual(getDomainEventContract('reel.upload.changed')!.consumers, []); assert.deepEqual(queueNamesForEvent('reel.upload.changed'), []);
  assert.ok(queueNamesForEvent('media.processed').length > 0, 'ordinary media event remains enabled');
});

test('SDK preserves same request/version and transmits original Blob without JSON conversion', async () => {
  const calls: { path: string; options?: LetbuyyRequestOptions }[] = [];
  const sdk = createReelReviewSdk({ async requestData<T>(path: string, options?: LetbuyyRequestOptions) { calls.push({ path, options }); return {} as T; } });
  await sdk.uploadBegin(id(2), begin as never); await sdk.uploadBegin(id(2), begin as never);
  assert.deepEqual(calls[0], calls[1]);
  const body = new Blob([new Uint8Array(16)], { type: 'video/mp4' }), retry = { idempotency_key: begin.idempotency_key, expected_version: 2 };
  await sdk.uploadOriginal(id(2), id(3), body, retry);
  assert.equal(calls[2].options?.body, body); assert.equal(calls[2].options?.idempotencyKey, retry.idempotency_key);
  assert.equal(new Headers(calls[2].options?.headers).get('X-Reel-Upload-Version'), '2');
  await sdk.uploadReconcile(id(2), id(3), retry); assert.deepEqual(calls[3].options?.body, retry);
});

test('original key contains only canonical UUID identities and never filename or URL authority', () => {
  const intent = { siteId: id(2), intentId: id(3), objectNonce: id(4), profileDigest: 'b'.repeat(64), bytes: 16, sha256: begin.checksum_sha256, contentType: 'video/mp4' as const, expectedVersion: null };
  assert.equal(originalKey(intent), `private-reel-originals/${id(2)}/${id(3)}/${id(4)}`);
  for (const field of ['siteId', 'intentId', 'objectNonce']) assert.throws(() => originalKey({ ...intent, [field]: '../outside' }));
});

test('shipping profile stays disabled; new rollback stays unconditional, restrictive and retained-data guarded', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../../../config/media/reel-custody-profiles.json', import.meta.url), 'utf8')), { private_upload_enabled: false, processing_enabled: false, inspection_enabled: false, approved_profile_ref: null, profile: null });
  const rollback = readFileSync(new URL('../../../../database/supabase/rollback/359_private_reel_intake.rollback.sql', import.meta.url), 'utf8');
  assert.match(rollback, /REEL_UPLOAD_ROLLBACK_RETAINED_DATA/); assert.match(rollback, /pg_prepared_xacts/); assert.match(rollback, /NOWAIT/);
  assert.doesNotMatch(rollback, /\bCASCADE\b|(?:DROP|ALTER)[^;\n]*\bIF EXISTS\b|DELETE FROM|TRUNCATE\s/i);
});
