import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ReelReviewSubmissionSchema,
  ReelReviewBindingError,
  buildReelReviewPayload,
  fingerprintReelReviewPayload,
  type ReelReviewSubmission,
  type ServerResolvedReelReviewContext,
  type ReelReviewBindingErrorCode,
} from '../schemas/reel.schema.ts';

const id = (number: number) => `00000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
const hash = (letter: string) => letter.repeat(64);

function fixture(): { request: ReelReviewSubmission; context: ServerResolvedReelReviewContext } {
  return {
    request: {
      media_asset_id: id(2), listing_id: id(3), variant_id: id(5), thumbnail_asset_id: id(6),
      caption: 'The reviewed product', rights_evidence_ids: [id(7), id(8)],
    },
    context: {
      site: { id: id(1), status: 'published', deleted: false },
      media: { id: id(2), site_id: id(1), asset_type: 'video', version: 'media:v1', checksum_sha256: hash('a'), access: 'private', deleted: false, provider_asset_id: 'synthetic-owned-provider-asset' },
      processing_evidence: {
        id: id(9), site_id: id(1), media_asset_id: id(2), media_version: 'media:v1',
        checksum_sha256: hash('a'), provider_asset_id: 'synthetic-owned-provider-asset', state: 'ready',
      },
      thumbnail: { id: id(6), site_id: id(1), asset_type: 'image', version: 'poster:v1', checksum_sha256: hash('b'), access: 'private', deleted: false },
      product: { id: id(4), site_id: id(1), is_active: true, deleted: false },
      listing: {
        id: id(3), site_id: id(1), product_id: id(4), channel: 'marketplace', status: 'approved', visibility: 'public',
        approved_product_fingerprint: hash('c'), current_product_fingerprint: hash('c'),
      },
      variants: [{ id: id(5), product_id: id(4) }, { id: id(10), product_id: id(4) }],
      rights_evidence: [
        { id: id(7), site_id: id(1), version: 'rights:v1', checksum_sha256: hash('d'), deleted: false },
        { id: id(8), site_id: id(1), version: 'disclosure:v1', checksum_sha256: hash('e'), deleted: false },
      ],
    },
  };
}

test('public Gateway facade builds one immutable review payload using the exact SQL fingerprint', async () => {
  const { request, context } = fixture();
  const { payload, fingerprint } = await fingerprintReelReviewPayload(request, context);
  assert.equal(payload.schema_version, 1);
  assert.equal(payload.site_id, id(1));
  assert.deepEqual(payload.product, { listing_id: id(3), product_id: id(4), variant_id: id(5), approved_product_fingerprint: hash('c') });
  assert.equal(payload.media.processing_evidence_id, id(9));
  assert.equal(payload.caption, request.caption);
  assert.deepEqual(payload.rights_evidence.map((item) => item.evidence_id), [id(7), id(8)]);
  assert.equal(fingerprint, createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex'));
  assert.equal('approved' in payload, false);
  assert.equal('status' in payload, false);
  assert.equal('playback_url' in payload.media, false);
  assert.ok(Object.isFrozen(payload) && Object.isFrozen(payload.media) && Object.isFrozen(payload.product));
  assert.ok(Object.isFrozen(payload.thumbnail) && Object.isFrozen(payload.rights_evidence) && Object.isFrozen(payload.rights_evidence[0]));
});

test('caller cannot supply scope, processing, provider URLs, fingerprints, price/stock or approval flags', () => {
  const { request, context } = fixture();
  for (const [key, value] of Object.entries({
    site_id: id(1), product_id: id(4), approved: true, status: 'approved', provider_ready: true,
    processing_status: 'processed', processing_evidence: context.processing_evidence,
    approved_product_fingerprint: hash('c'), url: 'https://example.invalid/video.mp4',
    thumbnail_url: 'https://example.invalid/poster.png', price: 1, stock: 999, serverResolved: context,
  })) {
    assert.equal(ReelReviewSubmissionSchema.safeParse({ ...request, [key]: value }).success, false, key);
    assert.throws(() => buildReelReviewPayload({ ...request, [key]: value }, context), key);
  }
  assert.equal(ReelReviewSubmissionSchema.safeParse({ ...request, ...context }).success, false);
});

test('caller selections must be canonical IDs, with explicit variant selection and no duplicate rights refs', () => {
  const { request } = fixture();
  for (const key of ['media_asset_id', 'listing_id', 'variant_id', 'thumbnail_asset_id'] as const) {
    assert.equal(ReelReviewSubmissionSchema.safeParse({ ...request, [key]: 'https://example.invalid/embed' }).success, false, key);
  }
  const { variant_id: _ignored, ...withoutVariant } = request;
  assert.equal(ReelReviewSubmissionSchema.safeParse(withoutVariant).success, false);
  assert.equal(ReelReviewSubmissionSchema.safeParse({ ...request, rights_evidence_ids: [id(7), id(7)] }).success, false);
  assert.equal(ReelReviewSubmissionSchema.safeParse({ ...request, caption: { html: '<iframe />' } }).success, false);
});

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
  }
  return value;
}

test('request/object/DB set ordering never changes canonical bytes or digest', async () => {
  const { request, context } = fixture();
  const first = await fingerprintReelReviewPayload(request, context);
  request.rights_evidence_ids.reverse();
  context.rights_evidence.reverse();
  context.variants.reverse();
  const second = await fingerprintReelReviewPayload(reverseKeys(request), reverseKeys(context) as ServerResolvedReelReviewContext);
  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(JSON.stringify(second.payload), JSON.stringify(first.payload));
});

type Change = (request: ReelReviewSubmission, context: ServerResolvedReelReviewContext) => void;
const materialChanges: Record<string, Change> = {
  caption: (r) => { r.caption += ' corrected'; },
  'caption whitespace': (r) => { r.caption += ' '; },
  'caption Unicode': (r) => { r.caption = 'பொருள்'; },
  'media identity': (r, c) => { r.media_asset_id = c.media.id = c.processing_evidence.media_asset_id = id(20); },
  'media version': (_r, c) => { c.media.version = c.processing_evidence.media_version = 'media:v2'; },
  'media checksum': (_r, c) => { c.media.checksum_sha256 = c.processing_evidence.checksum_sha256 = hash('f'); },
  'processing evidence': (_r, c) => { c.processing_evidence.id = id(21); },
  'provider asset': (_r, c) => { c.media.provider_asset_id = c.processing_evidence.provider_asset_id = 'synthetic-replacement-asset'; },
  'product revision': (_r, c) => { c.listing.approved_product_fingerprint = c.listing.current_product_fingerprint = hash('f'); },
  'canonical variant': (r) => { r.variant_id = id(10); },
  'listing identity': (r, c) => { r.listing_id = c.listing.id = id(22); },
  'product identity': (_r, c) => { c.product.id = c.listing.product_id = id(23); c.variants.forEach((v) => { v.product_id = id(23); }); },
  'poster identity': (r, c) => { r.thumbnail_asset_id = c.thumbnail.id = id(24); },
  'poster version': (_r, c) => { c.thumbnail.version = 'poster:v2'; },
  'poster checksum': (_r, c) => { c.thumbnail.checksum_sha256 = hash('f'); },
  'rights identity': (r, c) => { r.rights_evidence_ids[0] = c.rights_evidence[0].id = id(25); },
  'rights version': (_r, c) => { c.rights_evidence[0].version = 'rights:v2'; },
  'rights content': (_r, c) => { c.rights_evidence[0].checksum_sha256 = hash('f'); },
};
for (const [name, change] of Object.entries(materialChanges)) {
  test(`material ${name} change cannot inherit revision identity`, async () => {
    const { request, context } = fixture();
    const previous = await fingerprintReelReviewPayload(request, context);
    change(request, context);
    const next = await fingerprintReelReviewPayload(request, context);
    assert.notEqual(next.fingerprint, previous.fingerprint);
  });
}

function denial(name: string, code: ReelReviewBindingErrorCode, change: Change) {
  test(`denies ${name}`, async () => {
    const { request, context } = fixture();
    change(request, context);
    const expected = (error: unknown) => error instanceof ReelReviewBindingError && error.code === code;
    assert.throws(() => buildReelReviewPayload(request, context), expected);
    await assert.rejects(fingerprintReelReviewPayload(request, context), expected);
  });
}

for (const key of ['media', 'processing_evidence', 'thumbnail', 'product', 'listing'] as const) {
  denial(`another seller's ${key}`, 'REEL_SCOPE_MISMATCH', (_r, c) => { c[key].site_id = id(99); });
}
denial('unresolved selected media', 'REEL_MEDIA_UNAVAILABLE', (r) => { r.media_asset_id = id(99); });
denial('public media', 'REEL_MEDIA_UNAVAILABLE', (_r, c) => { c.media.access = 'public'; });
denial('deleted media', 'REEL_MEDIA_UNAVAILABLE', (_r, c) => { c.media.deleted = true; });
denial('non-video media', 'REEL_MEDIA_UNAVAILABLE', (_r, c) => { c.media.asset_type = 'image'; });
for (const state of ['pending', 'processing', 'failed', 'deleted'] as const) {
  denial(`${state} processing`, 'REEL_PROCESSING_UNVERIFIED', (_r, c) => { c.processing_evidence.state = state; });
}
denial('processing proof for another asset', 'REEL_PROCESSING_UNVERIFIED', (_r, c) => { c.processing_evidence.media_asset_id = id(99); });
denial('processing proof for another provider asset', 'REEL_PROCESSING_UNVERIFIED', (_r, c) => { c.processing_evidence.provider_asset_id = 'synthetic-unrelated-provider-asset'; });
denial('processing proof for replaced version', 'REEL_PROCESSING_UNVERIFIED', (_r, c) => { c.media.version = 'replacement:v2'; });
denial('processing proof for replaced bytes', 'REEL_PROCESSING_UNVERIFIED', (_r, c) => { c.media.checksum_sha256 = hash('f'); });
denial('unresolved thumbnail', 'REEL_THUMBNAIL_UNAVAILABLE', (r) => { r.thumbnail_asset_id = id(99); });
denial('public thumbnail', 'REEL_THUMBNAIL_UNAVAILABLE', (_r, c) => { c.thumbnail.access = 'public'; });
denial('deleted thumbnail', 'REEL_THUMBNAIL_UNAVAILABLE', (_r, c) => { c.thumbnail.deleted = true; });
denial('non-image thumbnail', 'REEL_THUMBNAIL_UNAVAILABLE', (_r, c) => { c.thumbnail.asset_type = 'video'; });
denial('unresolved listing', 'REEL_LISTING_UNAVAILABLE', (r) => { r.listing_id = id(99); });
denial('unrelated listing/product', 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.listing.product_id = id(99); });
denial('storefront listing', 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.listing.channel = 'storefront'; });
denial('hidden listing', 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.listing.visibility = 'hidden'; });
for (const state of ['draft', 'pending_review', 'rejected', 'paused', 'delisted']) {
  denial(`${state} listing`, 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.listing.status = state; });
}
denial('inactive product', 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.product.is_active = false; });
denial('deleted product', 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.product.deleted = true; });
denial('unpublished site', 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.site.status = 'draft'; });
denial('deleted site', 'REEL_LISTING_UNAVAILABLE', (_r, c) => { c.site.deleted = true; });
denial('stale SQL fingerprint', 'REEL_PRODUCT_REVISION_STALE', (_r, c) => { c.listing.current_product_fingerprint = hash('f'); });
denial('missing approved fingerprint', 'REEL_PRODUCT_REVISION_STALE', (_r, c) => { c.listing.approved_product_fingerprint = null; });
denial('missing current fingerprint', 'REEL_PRODUCT_REVISION_STALE', (_r, c) => { c.listing.current_product_fingerprint = null; });
denial('invented variant ID', 'REEL_VARIANT_MISMATCH', (r) => { r.variant_id = id(99); });
denial('omitted selection for product variants', 'REEL_VARIANT_MISMATCH', (r) => { r.variant_id = null; });
denial('variant of another product', 'REEL_VARIANT_MISMATCH', (_r, c) => { c.variants[0].product_id = id(99); });
denial('duplicate canonical variant rows', 'REEL_VARIANT_MISMATCH', (_r, c) => { c.variants.push({ ...c.variants[0] }); });
denial('unresolved rights reference', 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE', (r) => { r.rights_evidence_ids[0] = id(99); });
denial('missing rights row', 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE', (_r, c) => { c.rights_evidence.pop(); });
denial('extra rights row', 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE', (_r, c) => { c.rights_evidence.push({ ...c.rights_evidence[0], id: id(99) }); });
denial('another seller rights evidence', 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE', (_r, c) => { c.rights_evidence[0].site_id = id(99); });
denial('deleted rights evidence', 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE', (_r, c) => { c.rights_evidence[0].deleted = true; });
denial('duplicate resolved rights rows', 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE', (_r, c) => { c.rights_evidence[1] = { ...c.rights_evidence[0] }; });

test('generic processed flag or an external provider URL cannot replace verified processing evidence', () => {
  const { request, context } = fixture();
  const { processing_evidence: _ignored, ...generic } = context;
  assert.throws(() => buildReelReviewPayload(request, { ...generic, processing_status: 'processed' } as unknown as ServerResolvedReelReviewContext));
  context.processing_evidence.provider_asset_id = 'https://example.invalid/unverified.mp4';
  assert.throws(() => buildReelReviewPayload(request, context));
  context.processing_evidence.provider_asset_id = '';
  assert.throws(() => buildReelReviewPayload(request, context));
  for (const url of ['https:example.invalid', 'data:video', 'https://example.invalid/video.mp4']) {
    context.media.provider_asset_id = context.processing_evidence.provider_asset_id = url;
    assert.throws(() => buildReelReviewPayload(request, context));
  }
});

test('missing or altered format fingerprints are denied without normalizing SQL output', () => {
  const { request, context } = fixture();
  context.listing.approved_product_fingerprint = context.listing.current_product_fingerprint = 'C'.repeat(64);
  assert.throws(() => buildReelReviewPayload(request, context));
  context.listing.approved_product_fingerprint = context.listing.current_product_fingerprint = 'c'.repeat(63);
  assert.throws(() => buildReelReviewPayload(request, context));
});

test('variantless product and empty rights evidence remain explicit review content, never an approval verdict', () => {
  const { request, context } = fixture();
  request.variant_id = null;
  context.variants = [];
  request.rights_evidence_ids = [];
  context.rights_evidence = [];
  const payload = buildReelReviewPayload(request, context);
  assert.equal(payload.product.variant_id, null);
  assert.deepEqual(payload.rights_evidence, []);
  assert.equal('approved' in payload, false);
});

test('later caller/server input mutation cannot alter the built revision or frozen evidence', () => {
  const { request, context } = fixture();
  const payload = buildReelReviewPayload(request, context);
  const bytes = JSON.stringify(payload);
  request.caption = 'late edit';
  context.media.version = 'late:v2';
  context.rights_evidence[0].checksum_sha256 = hash('f');
  assert.equal(JSON.stringify(payload), bytes);
  assert.equal(Reflect.set(payload.media, 'version', 'forged:v2'), false);
  assert.equal(Reflect.set(payload.rights_evidence[0], 'version', 'forged:v2'), false);
  assert.equal(JSON.stringify(payload), bytes);
});
