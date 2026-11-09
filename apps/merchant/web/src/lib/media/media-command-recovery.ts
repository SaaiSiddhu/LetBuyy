import { z } from 'zod'
import { MediaAssetSchema, MediaMetadataUpdateSchema, MediaRegistrationInputSchema, PublicUploadRecoveryInputSchema, UuidSchema, type MediaMetadataUpdate } from '@letbuyy/shared-types'
import { createScopedCommandJournal, type CommandScope } from '../api/scoped-command-journal'

// Browser workflow state, not another commerce DTO or server authority.
const uploadCommand = PublicUploadRecoveryInputSchema.extend({ media_key: UuidSchema }).strict()
const publicAcknowledgement = z.object({
    store_id: UuidSchema, url: z.string().url().max(4000), key: z.string().min(1).max(512),
    size: z.number().int().min(0), content_type: z.string().min(1).max(160), storage: z.literal('r2'),
}).strict().superRefine((ack, ctx) => {
    const url = new URL(ack.url)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
        || !ack.key.startsWith('public-media/') || !url.pathname.endsWith('/' + ack.key)) {
        ctx.addIssue({ code: 'custom', message: 'A confirmed public upload is required.' })
    }
})
const intentSchema = z.discriminatedUnion('operation', [
    z.object({ operation: z.literal('upload'), command: uploadCommand, acknowledgement: publicAcknowledgement.nullable() }).strict(),
    z.object({ operation: z.literal('update'), media_id: UuidSchema,
        command: z.object({ store_id: UuidSchema, idempotency_key: UuidSchema, input: MediaMetadataUpdateSchema }).strict() }).strict(),
    z.object({ operation: z.literal('delete'), media_id: UuidSchema,
        command: z.object({ store_id: UuidSchema, idempotency_key: UuidSchema }).strict() }).strict(),
]).superRefine((intent, ctx) => {
    if (intent.operation !== 'upload') return
    const c = intent.command, a = intent.acknowledgement
    if (c.folder !== `${c.store_id}/products` || (a && (a.store_id !== c.store_id || a.size !== c.byte_size || a.content_type !== c.content_type))) {
        ctx.addIssue({ code: 'custom', message: 'The upload acknowledgement does not match the original.' })
    }
})
export type MediaBrowserIntent = z.infer<typeof intentSchema>
const journal = createScopedCommandJournal('letbuyy:media-command:v1', intentSchema, 'media')
type Ports = {
    scope: CommandScope; store: string; storage: Parameters<typeof journal.read>[1]; locks: Parameters<typeof journal.read>[2];
    check: () => void; fetch: typeof fetch;
}
export type MediaFileDescriptor = Pick<File, 'name' | 'type' | 'size'> & { sha256: string }
export function createMediaCommandRecovery(p: Ports) {
    const { scope, storage, locks, check } = p
    const read = () => journal.read(scope, storage, locks, check)
    const path = `/api/stores/${encodeURIComponent(p.store)}`
    async function request(endpoint: string, key: string, method: string, body?: object | FormData): Promise<unknown> {
        check()
        const multipart = body instanceof FormData
        const target = endpoint === '/upload/recover' ? `/api/v1/stores/${encodeURIComponent(p.store)}${endpoint}` : path + endpoint
        const response = await p.fetch(target, { method, credentials: 'same-origin', cache: 'no-store',
            headers: { 'X-LetBuyy-Merchant-Context': scope.actorId, 'X-Idempotency-Key': key,
                ...(multipart || !body ? {} : { 'Content-Type': 'application/json' }) },
            body: multipart ? body : body ? JSON.stringify(body) : undefined })
        check()
        const payload: unknown = await response.json(); check()
        if (!response.ok || !payload || typeof payload !== 'object' || !('data' in payload)) {
            throw new Error('The media request is unconfirmed. Keep browser data and confirm the saved request before another change.')
        }
        return (payload as { data: unknown }).data
    }
    function asset(value: unknown, siteId: string, id?: string) {
        const result = MediaAssetSchema.parse(value)
        if (result.store_id !== siteId || (id && result.id !== id)) throw new Error('Media acknowledgement context changed. Keep the saved request.')
        return result
    }
    async function send(saved: NonNullable<Awaited<ReturnType<typeof read>>>, file?: File) {
        const intent = saved.intent
        if (intent.operation === 'upload') {
            const c = intent.command
            let ack = intent.acknowledgement
            if (!ack) {
                let raw: unknown
                if (file) {
                    const form = new FormData(); form.set('file', file); form.set('folder', c.folder); form.set('store_id', c.store_id)
                    raw = await request('/upload', c.idempotency_key, 'POST', form)
                } else {
                    const { media_key: _mediaKey, ...recovery } = c
                    raw = await request('/upload/recover', c.idempotency_key, 'POST', recovery)
                }
                // Project the public fields only; never persist passthrough bytes,
                // signed URLs, provider secrets or development inline fixtures.
                if (!raw || typeof raw !== 'object') throw new Error('Upload remains unconfirmed.')
                const value = raw as Record<string, unknown>
                ack = publicAcknowledgement.parse(Object.fromEntries(['store_id', 'url', 'key', 'size', 'content_type', 'storage'].map(k => [k, value[k]])))
                saved = await journal.advance(saved, intentSchema.parse({ ...intent, acknowledgement: ack }), storage, locks, check)
            }
            const input = MediaRegistrationInputSchema.parse({ store_id: c.store_id, filename: c.filename, original_name: c.filename,
                url: ack.url, storage_key: ack.key, mime_type: ack.content_type, size_bytes: c.byte_size,
                folder: 'products', checksum_sha256: c.sha256_hex })
            const result = asset(await request('/media', c.media_key, 'POST', input), c.store_id)
            if (result.url !== ack.url) throw new Error('Media registration did not confirm the original upload.')
            await journal.clear(saved, storage, locks, check); return result
        }
        const c = intent.command
        if (intent.operation === 'update') {
            const result = asset(await request(`/media/${intent.media_id}`, c.idempotency_key, 'PATCH', intent.command.input), c.store_id, intent.media_id)
            if (Object.entries(intent.command.input).some(([key, value]) => JSON.stringify(result[key]) !== JSON.stringify(value))) {
                throw new Error('The media acknowledgement differs from the saved metadata. Keep the original request.')
            }
            await journal.clear(saved, storage, locks, check); return result
        }
        const result = await request(`/media/${intent.media_id}`, c.idempotency_key, 'DELETE')
        if (!result || typeof result !== 'object' || !('deleted' in result) || result.deleted !== true) throw new Error('Media deletion is not confirmed.')
        await journal.clear(saved, storage, locks, check); return null
    }
    return {
        read,
        upload: (file: File, descriptor: MediaFileDescriptor) => {
            const intent = intentSchema.parse({ operation: 'upload', acknowledgement: null, command: {
                store_id: scope.siteId, idempotency_key: crypto.randomUUID(), media_key: crypto.randomUUID(),
                filename: descriptor.name, folder: `${scope.siteId}/products`, content_type: descriptor.type,
                byte_size: descriptor.size, sha256_hex: descriptor.sha256,
            } })
            if (file.name !== descriptor.name || file.size !== descriptor.size || file.type !== descriptor.type) throw new Error('Choose the same original file.')
            return journal.withExecution(scope, locks, check, async () => send(await journal.retain(scope, intent, storage, locks, check), file))
        },
        change: (mediaId: string, input?: MediaMetadataUpdate) => {
            // Capture before the first yield, including mutable tags from editors.
            const intent = intentSchema.parse(input === undefined
                ? { operation: 'delete', media_id: mediaId, command: { store_id: scope.siteId, idempotency_key: crypto.randomUUID() } }
                : { operation: 'update', media_id: mediaId, command: { store_id: scope.siteId, idempotency_key: crypto.randomUUID(), input } })
            return journal.withExecution(scope, locks, check, async () => send(await journal.retain(scope, intent, storage, locks, check)))
        },
        resume: (original?: { file: File; descriptor: MediaFileDescriptor }) => journal.withExecution(scope, locks, check, async () => {
            const saved = await read(); if (!saved) return null
            if (original) {
                const c = saved.intent.command, d = original.descriptor
                if (saved.intent.operation !== 'upload' || saved.intent.acknowledgement || !('sha256_hex' in c)
                    || d.sha256 !== c.sha256_hex || d.size !== c.byte_size || d.type !== c.content_type || d.name !== c.filename
                    || original.file.name !== d.name || original.file.size !== d.size || original.file.type !== d.type) throw new Error('Reselect the exact original file to recover this upload.')
            }
            return send(saved, original?.file)
        }),
    }
}
