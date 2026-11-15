import assert from 'node:assert/strict'
import test from 'node:test'
import { createMediaCommandRecovery } from '../src/lib/media/media-command-recovery'
import { MediaAssetSchema } from '@letbuyy/shared-types'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const scope = { actorId: id(1), siteId: id(2) }
class MemoryStorage {
    data = new Map<string, string>(); failWrite = false
    getItem(key: string) { return this.data.get(key) ?? null }
    setItem(key: string, value: string) { if (this.failWrite) throw new Error('Synthetic storage failure'); this.data.set(key, value) }
    removeItem(key: string) { this.data.delete(key) }
}
function locks() {
    const tails = new Map<string, Promise<unknown>>()
    return { request<T>(key: string, work: () => Promise<T> | T) {
        const task = (tails.get(key) ?? Promise.resolve()).then(work); tails.set(key, task.catch(() => undefined)); return task
    } }
}
const file = () => new File([Uint8Array.of(1, 2, 3)], 'synthetic.png', { type: 'image/png' })
const descriptor = { name: 'synthetic.png', size: 3, type: 'image/png', sha256: 'a'.repeat(64) }
const ack = { store_id: scope.siteId, url: 'https://cdn.synthetic.invalid/public-media/original.png', key: 'public-media/original.png', size: 3, content_type: 'image/png', storage: 'r2' }
const row = { id: id(7), store_id: scope.siteId, filename: 'synthetic.png', url: ack.url, mime_type: 'image/png', size_bytes: 3 }
test('canonical Media accepts real PostgreSQL timestamps and rejects malformed dates', () => {
    for (const timestamp of ['2026-11-06T23:47:53.527102+00:00', '2026-11-07T05:17:53.527102+05:30', '2026-11-06T23:47:53.527Z']) {
        assert(MediaAssetSchema.safeParse({ ...row, created_at: timestamp, updated_at: timestamp }).success)
    }
    for (const timestamp of ['not-a-date', '2026-13-07T00:00:00+00:00', '2026-11-07T25:00:00+00:00']) assert.equal(MediaAssetSchema.safeParse({ ...row, created_at: timestamp }).success, false)
})
function fixture() {
    const storage = new MemoryStorage(), lock = locks(), requests: { path: string; key: string | null; body: unknown }[] = []
    let failure: 'upload' | 'registration' | 'update' | 'delete' | null = null
    let alive = true, held: (() => Promise<void>) | null = null
    let reply: object = row, explicitReply = false
    const transport: typeof fetch = async (input, init) => {
        const path = String(input), key = new Headers(init?.headers).get('X-Idempotency-Key')
        assert.equal(new Headers(init?.headers).get('X-LetBuyy-Merchant-Context'), scope.actorId)
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
        requests.push({ path, key, body })
        if (held) await held()
        const kind = path.endsWith('/upload') ? 'upload' : path.endsWith('/media') ? 'registration' : init?.method === 'DELETE' ? 'delete' : 'update'
        if (failure === kind && !path.endsWith('/recover')) throw new Error('Synthetic lost acknowledgement after server effect')
        return Response.json({ data: path.includes('/upload') ? ack : init?.method === 'DELETE' ? { deleted: true } : init?.method === 'PATCH' && !explicitReply ? { ...reply, ...(body as object) } : reply })
    }
    const engine = (s = scope) => createMediaCommandRecovery({ scope: s, store: 'synthetic', storage, locks: lock,
        check: () => { if (!alive) throw new Error('Retired surface') }, fetch: transport })
    return { storage, requests, engine, fail: (value: typeof failure) => { failure = value }, retire: () => { alive = false },
        hold: (work: () => Promise<void>) => { held = work }, reply: (value: object) => { reply = value; explicitReply = true } }
}
for (const lost of ['upload', 'registration'] as const) test(`lost ${lost} response recovers after reload with original upload and registration keys`, async () => {
    const f = fixture(); f.fail(lost)
    await assert.rejects(() => f.engine().upload(file(), descriptor))
    const saved = await f.engine().read(); assert(saved); assert.equal(saved.intent.operation, 'upload')
    f.fail(null)
    const recovered = await f.engine().resume(); assert.equal(recovered?.id, row.id)
    assert.equal(await f.engine().read(), null)
    assert.equal(f.requests.filter(r => r.path.endsWith('/upload')).length, 1, 'Recovery sends no new file bytes')
    const recoveredUpload = f.requests.find(r => r.path.endsWith('/recover'))
    if (lost === 'upload') {
        assert.equal(recoveredUpload?.key, f.requests[0].key)
        assert.equal(recoveredUpload?.path, '/api/v1/stores/synthetic/upload/recover')
    }
    const registrations = f.requests.filter(r => r.path.endsWith('/media'))
    assert.equal(new Set(registrations.map(r => r.key)).size, 1)
    assert.equal(new Set(registrations.map(r => JSON.stringify(r.body))).size, 1)
})
for (const removing of [false, true]) test(`lost ${removing ? 'delete' : 'metadata'} response keeps exact key and payload after row changes`, async () => {
    const f = fixture(); f.fail(removing ? 'delete' : 'update')
    const input = { alt_text: 'Original new label', tags: ['retained'] }
    const started = f.engine().change(row.id, removing ? undefined : input)
    input.tags.push('late mutation')
    await assert.rejects(() => started)
    const original = JSON.stringify(f.requests[0]); f.fail(null)
    await f.engine().resume()
    assert.equal(JSON.stringify(f.requests[1]), original)
    assert.equal(await f.engine().read(), null)
    if (!removing) assert.deepEqual((f.requests[0].body as typeof input).tags, ['retained'])
})
test('a saved upload cannot be replaced; wrong account/store cannot read or replay it', async () => {
    const f = fixture(); f.fail('upload'); await assert.rejects(() => f.engine().upload(file(), descriptor))
    const before = [...f.storage.data.entries()]
    await assert.rejects(() => f.engine().change(row.id, { filename: 'replacement' }))
    for (const s of [{ ...scope, actorId: id(8) }, { ...scope, siteId: id(8) }]) {
        assert.equal(await f.engine(s).read(), null); assert.equal(await f.engine(s).resume(), null)
    }
    assert.deepEqual([...f.storage.data.entries()], before); assert.equal(f.requests.length, 1)
})
test('persistence failure and corrupt storage stop dispatch; a mismatched ACK stays retained', async () => {
    const f = fixture(); f.storage.failWrite = true
    await assert.rejects(() => f.engine().change(row.id, { alt_text: 'save' })); assert.equal(f.requests.length, 0)
    f.storage.failWrite = false; f.reply({ ...row, store_id: id(8) })
    await assert.rejects(() => f.engine().change(row.id, { alt_text: 'save' })); assert(await f.engine().read())
    const key = [...f.storage.data.keys()][0]; f.storage.data.set(key, '{corrupt')
    await assert.rejects(() => f.engine().read()); await assert.rejects(() => f.engine().resume()); assert.equal(f.requests.length, 1)
})
test('two tabs recover one saved request under one execution lease', async () => {
    const f = fixture(); f.fail('delete'); await assert.rejects(() => f.engine().change(row.id)); f.fail(null)
    await Promise.all([f.engine().resume(), f.engine().resume()])
    assert.equal(f.requests.length, 2); assert.equal(await f.engine().read(), null)
})
test('same-row metadata with different fields cannot consume the retained request', async () => {
    const f = fixture(); f.reply({ ...row, alt_text: 'Wrong receipt' })
    await assert.rejects(() => f.engine().change(row.id, { alt_text: 'Retained label' }), /differs from the saved metadata/)
    assert(await f.engine().read()); assert.equal(f.requests.length, 1)
    f.reply({ ...row, alt_text: 'Retained label' }); await f.engine().resume()
    assert.equal(await f.engine().read(), null); assert.equal(f.requests[0].key, f.requests[1].key)
})
test('scope retirement during a late accepted response cannot erase the retained command', async () => {
    const f = fixture(); let release!: () => void, entered!: () => void
    const pending = new Promise<void>(r => { release = r }), arrival = new Promise<void>(r => { entered = r })
    f.hold(async () => { entered(); await pending })
    const started = f.engine().change(row.id); await arrival; f.retire(); release()
    await assert.rejects(() => started, /Retired/); assert.equal(f.storage.data.size, 1)
})
test('reselecting the wrong original never resends bytes or changes the saved intent', async () => {
    const f = fixture(); f.fail('upload'); await assert.rejects(() => f.engine().upload(file(), descriptor))
    const before = [...f.storage.data.entries()]
    await assert.rejects(() => f.engine().resume({ file: file(), descriptor: { ...descriptor, sha256: 'b'.repeat(64) } }))
    assert.equal(f.requests.length, 1); assert.deepEqual([...f.storage.data.entries()], before)
    f.fail(null); await f.engine().resume({ file: file(), descriptor })
    assert.equal(f.requests.filter(r => r.path.endsWith('/upload')).length, 2)
    assert.equal(f.requests[0].key, f.requests[1].key)
})
