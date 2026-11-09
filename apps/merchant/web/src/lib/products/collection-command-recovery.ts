import type { CollectionMetadataCommandIntent } from '@letbuyy/shared-types'

// These are presentation/recovery outcomes, never substitutes for a server
// receipt. Generic404 and transport failures leave original intent uncertain.
export function collectionCommandRejection(intent: CollectionMetadataCommandIntent, error: unknown): 'review' | 'missing' | null {
    const reason = error as { status?: number; code?: string } | null
    if (intent.operation !== 'create' && intent.collection_id && reason?.status === 404 && reason.code === 'COLLECTION_NOT_FOUND') return 'missing'
    if (reason?.status === 400 && reason.code === 'VALIDATION_ERROR'
        || reason?.status === 409 && ['COLLECTION_VERSION_CONFLICT', 'COLLECTION_SLUG_CONFLICT'].includes(reason.code ?? '')) return 'review'
    return null
}
