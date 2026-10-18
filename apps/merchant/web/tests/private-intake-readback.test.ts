import assert from 'node:assert/strict'
import test from 'node:test'
import { ReelUploadReadbackSchema } from '@letbuyy/shared-types'
import { bindPrivateIntakeReadback } from '../src/components/reels/private-intake-readback'
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const command = { idempotency_key: 'same-original-request', filename: 'original.mp4', content_type: 'video/mp4' as const, size_bytes: 4096, checksum_sha256: 'a'.repeat(64) }
const reserved = { ...command, id, site_id: other, state: 'reserved', version: 1, expires_at: '2026-10-18T00:00:00Z', created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z', media_asset_id: null, provenance_id: null, processing_available: false, inspection_available: false, replayed: false }
const received = { ...reserved, state: 'received_unprocessed', version: 3, media_asset_id: id, provenance_id: other }
const expected = { command, intentId: id }
test('bound reserved readback and received receipt retain the same request', () => {
    assert.deepEqual(bindPrivateIntakeReadback(reserved, expected), reserved)
    assert.deepEqual(bindPrivateIntakeReadback(received, expected, true), received)
    assert.deepEqual(bindPrivateIntakeReadback(reserved, { command }), reserved)
})
test('valid-shaped mismatched intent, key, checksum or file metadata is rejected', () => {
    for (const patch of [{ id: other }, { idempotency_key: 'another-request-key' }, { checksum_sha256: 'b'.repeat(64) }, { filename: 'other.mp4' }, { content_type: 'video/webm' }, { size_bytes: 4097 }]) {
        const response = { ...reserved, ...patch }
        assert.equal(ReelUploadReadbackSchema.safeParse(response).success, true)
        assert.throws(() => bindPrivateIntakeReadback(response, expected), { code: 'REEL_UPLOAD_READBACK_MISMATCH' })
    }
})
test('a successful HTTP reply needs actual received state and both receipt references', () => {
    for (const response of [reserved, { ...reserved, state: 'receiving' }, { ...received, media_asset_id: null }, { ...received, provenance_id: null }, { ...reserved, media_asset_id: id }]) {
        assert.equal(ReelUploadReadbackSchema.safeParse(response).success, true)
        assert.throws(() => bindPrivateIntakeReadback(response, expected, true), { code: 'REEL_UPLOAD_READBACK_MISMATCH' })
    }
})
test('invalid payload is rejected without exposing a schema payload in the message', () => {
    assert.throws(() => bindPrivateIntakeReadback({ private: 'untrusted' }, expected), { code: 'REEL_UPLOAD_READBACK_MISMATCH', message: /same intake/ })
})
