import assert from 'node:assert/strict';
import test from 'node:test';

import { mediaKeyForUpload, signUploadToken, verifyUploadToken, type UploadTokenPayload } from '../src/index';

test('media keys are scoped and sanitized', () => {
  const key = mediaKeyForUpload({ purpose: 'Delivery Proof', fileName: '../Proof Photo.JPG' });

  assert.match(key, /^delivery-proof\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+-proof-photo.jpg$/);
});

test('upload token round trips and rejects tampering', async () => {
  const payload: UploadTokenPayload = {
    key: 'delivery-proof/2026-06-01/proof.jpg',
    contentType: 'image/jpeg',
    purpose: 'delivery-proof',
    expiresAt: 1_780_000_000,
  };
  const token = await signUploadToken(payload, 'secret');

  assert.deepEqual(await verifyUploadToken(token, 'secret'), payload);
  assert.equal(await verifyUploadToken(`${token}x`, 'secret'), null);
  assert.equal(await verifyUploadToken(token, 'wrong-secret'), null);
});
