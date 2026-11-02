const MAX_JSON_BYTES = 4096

/** Keep KYC bytes out of the Merchant proxy, including chunked requests. */
export async function readDirectUploadJson(request: Request): Promise<Record<string, unknown> | null> {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
    const length = Number(request.headers.get('content-length') || 0)
    if (!Number.isFinite(length) || length > MAX_JSON_BYTES) return null
    if (!request.body) return null
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_JSON_BYTES) { await reader.cancel(); return null }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    try {
        const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        return input && typeof input === 'object' && !Array.isArray(input)
            ? input as Record<string, unknown> : null
    } catch { return null }
}
