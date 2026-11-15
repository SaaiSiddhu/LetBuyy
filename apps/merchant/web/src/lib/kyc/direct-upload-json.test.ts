import assert from 'node:assert/strict'
import test from 'node:test'
import { readDirectUploadJson } from './direct-upload-json'

test('KYC JSON proxy accepts only bounded metadata and stops an oversized stream', async () => {
    const valid = new Request('https://merchant.example.test/kyc/upload-intent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document_type: 'business_pan', byte_size: 1234 }),
    })
    assert.deepEqual(await readDirectUploadJson(valid), { document_type: 'business_pan', byte_size: 1234 })

    let readCount = 0
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            readCount++
            controller.enqueue(new Uint8Array(3000))
        },
        cancel() { cancelled = true },
    })
    const tooLarge = new Request('https://merchant.example.test/kyc/upload-complete', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: stream, duplex: 'half',
    } as RequestInit)
    assert.equal(await readDirectUploadJson(tooLarge), null)
    assert.equal(cancelled, true)
    assert.ok(readCount <= 3, 'the proxy stops reading near its 4 KiB bound')

    const multipart = new Request('https://merchant.example.test/kyc/upload-intent', {
        method: 'POST', headers: { 'content-type': 'multipart/form-data' }, body: 'file bytes',
    })
    assert.equal(await readDirectUploadJson(multipart), null)
    assert.equal(multipart.bodyUsed, false)
})
