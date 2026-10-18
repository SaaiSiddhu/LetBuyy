import { ReelUploadReadbackSchema, type ReelUploadBegin, type ReelUploadReadback } from '@letbuyy/shared-types'

/** Bind untrusted readback to this tab's retained request before using its ID or state. */
export function bindPrivateIntakeReadback(value: unknown, expected: { command: ReelUploadBegin; intentId?: string | null }, requireReceived = false): ReelUploadReadback {
    const parsed = ReelUploadReadbackSchema.safeParse(value)
    const fail = () => Object.assign(new Error('The server reply could not confirm this same intake. Keep the original request and check its status.'), { code: 'REEL_UPLOAD_READBACK_MISMATCH' })
    if (!parsed.success) throw fail()
    const row = parsed.data, command = expected.command
    if (expected.intentId && row.id !== expected.intentId
        || row.idempotency_key !== command.idempotency_key
        || row.filename !== command.filename || row.content_type !== command.content_type
        || row.size_bytes !== command.size_bytes || row.checksum_sha256 !== command.checksum_sha256) throw fail()
    const received = row.state === 'received_unprocessed'
    if (received ? row.media_asset_id === null || row.provenance_id === null : row.media_asset_id !== null || row.provenance_id !== null) throw fail()
    if (requireReceived && !received) throw fail()
    return row
}
