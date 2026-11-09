import { NextRequest, NextResponse } from 'next/server'
import { CollectionMetadataCommandIntentSchema, CreateSmartCollectionSchema, UpdateSmartCollectionSchema, UuidSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

type Params = Promise<{ store: string }>
export async function collectionMetadataRead(request: NextRequest, params: Params, kind: 'manual' | 'smart', id: string) {
    try {
        const scope = await merchantSecurityScope(request, params, false)
        if (scope.error) return scope.error
        if (!UuidSchema.safeParse(id).success) return invalid()
        const client = createMerchantApiClient(scope.storeId)
        const data = kind === 'manual' ? await client.products.collections.get(id, scope.storeId)
            : await client.smartCollections.get(id, { store_id: scope.storeId })
        return privateSecurityResponse(NextResponse.json({ data }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'The current collection could not be confirmed.')) }
}
function invalid() {
    return privateSecurityResponse(NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Keep the original collection request, version, save key and selected store.' } }, { status: 400 }))
}
export async function collectionMetadataMutation(request: NextRequest, params: Params, kind: 'manual' | 'smart', operation: 'create' | 'update' | 'delete', id: string | null) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error
        const parsed = CollectionMetadataCommandIntentSchema.safeParse({ operation, collection_id: id, command: await request.json().catch(() => null) })
        if (!parsed.success || parsed.data.command.store_id !== scope.storeId || parsed.data.command.collection_type !== kind
            || parsed.data.command.idempotency_key !== request.headers.get('X-Idempotency-Key')) return invalid()
        const intent = parsed.data, client = createMerchantApiClient(scope.storeId)
        const options = { storeId: scope.storeId, idempotencyKey: intent.command.idempotency_key,
            headers: { 'X-Letbuyy-Expected-Actor': scope.actorId } }
        let data
        if (kind === 'manual') {
            data = intent.operation === 'create' ? await client.products.collections.create(intent.command, options)
                : intent.operation === 'update' ? await client.products.collections.update(intent.collection_id, intent.command, options)
                    : await client.products.collections.remove(intent.collection_id, intent.command, options)
        } else if (intent.operation === 'delete') {
            data = await client.smartCollections.remove(intent.collection_id, { version: intent.command.version }, options)
        } else {
            const { collection_type: _kind, store_id: _site, idempotency_key: _key, title, image_url: image, ...fields } = intent.command
            if (image !== undefined) return invalid() // Existing smart transport does not own media.
            data = intent.operation === 'create'
                ? await client.smartCollections.create(CreateSmartCollectionSchema.parse({ ...fields, name: title, slug: intent.command.slug, store_id: scope.storeId }), options)
                : await client.smartCollections.update(intent.collection_id, UpdateSmartCollectionSchema.parse({ ...fields, ...(title !== undefined ? { name: title } : {}) }), options)
        }
        return privateSecurityResponse(NextResponse.json({ data }, { status: operation === 'create' ? 201 : 200 }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'The original collection save could not be confirmed.')) }
}
