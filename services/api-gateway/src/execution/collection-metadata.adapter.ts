import {
    CollectionMetadataSchema, CollectionMetadataReceiptSchema, CollectionMetadataPageSchema,
    CreateCollectionMetadataSchema, UpdateCollectionMetadataSchema, DeleteCollectionMetadataSchema,
    SmartCollectionPreviewSchema, UuidSchema,
    type CollectionMetadata, type CollectionMetadataReceipt, type CollectionMetadataPage,
    type CreateCollectionMetadata, type UpdateCollectionMetadata, type DeleteCollectionMetadata,
    type SmartCollectionPreviewResult,
} from '@letbuyy/shared-types';
import { canonicalizeExecutionPayload } from '@letbuyy/event-core';
import type { Env } from '../index';
import type { OwnedStoreScope } from '../lib/tenant-context';
import { AppError, ForbiddenError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';

function failure(error: unknown): never {
    if (error instanceof AppError) throw error;
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : '';
    if (code === '42501' || message.includes('COLLECTION_METADATA_FORBIDDEN')) {
        throw new ForbiddenError('Your access to this store changed.');
    }
    // Distinguish a live canonical rejection (after authority/receipt lookup)
    // from a proxy/route404, which cannot settle an uncertain saved command.
    if (message.includes('COLLECTION_METADATA_NOT_FOUND')) throw new AppError('The collection is no longer available.', 404, 'COLLECTION_NOT_FOUND');
    if (message.includes('COLLECTION_METADATA_KEY_CONFLICT')) {
        throw new AppError('This save key belongs to a different collection request. Recover the original request.', 409, 'COLLECTION_KEY_CONFLICT');
    }
    if (message.includes('COLLECTION_METADATA_VERSION_CONFLICT')) {
        throw new AppError('This collection changed. Keep your edits and reload its current version before saving.', 409, 'COLLECTION_VERSION_CONFLICT');
    }
    if (code === '23505') throw new AppError('A collection already uses this slug.', 409, 'COLLECTION_SLUG_CONFLICT');
    if (code === '40P01' || code === '40001') {
        throw new AppError('The collection changed while saving. Retry the original request.', 409, 'COLLECTION_RETRY_ORIGINAL');
    }
    if (/COLLECTION_METADATA_INVALID|COLLECTION_METADATA_KIND_IMMUTABLE|COLLECTION_RULES_INVALID/.test(message)
        || code === '23503' || code === '23514' || code?.startsWith('22')) {
        throw new ValidationError('The collection details are invalid.');
    }
    if (error instanceof TenantTransactionUnavailableError || code === '42883' || code === '42703') {
        throw new AppError('Collections are temporarily unavailable. Your unsaved changes are kept.', 503, 'COLLECTIONS_UNAVAILABLE');
    }
    throw new AppError('Collections are temporarily unavailable. Your unsaved changes are kept.', 503, 'COLLECTIONS_UNAVAILABLE');
}

function requireScope(scope: OwnedStoreScope) {
    if (!UuidSchema.safeParse(scope.siteId).success || !UuidSchema.safeParse(scope.customUser.id).success
        || scope.storeId !== scope.siteId || scope.tenant.siteId !== scope.siteId
        || scope.tenant.userId !== scope.customUser.id || scope.authUser.id !== scope.customUser.id
        || scope.authUser.storeId && scope.authUser.storeId !== scope.siteId) {
        throw new ForbiddenError('The selected store changed.');
    }
}

// The executor and SQL client remain private to this closed set of operations.
async function call(env: Env, scope: OwnedStoreScope, sqlText: string, parameters: (string | number | null)[]): Promise<unknown> {
    requireScope(scope);
    try {
        return await withTenantTx(env, scope.tenant, async sql => {
            await sql.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)',
                ['app.actor_id', scope.customUser.id, 'request.jwt.claim.sub', scope.customUser.id]);
            const rows = await sql.unsafe(sqlText, parameters);
            return rows[0]?.result;
        });
    } catch (error) { return failure(error); }
}

export async function readCollectionMetadata(env: Env, scope: OwnedStoreScope, id: string): Promise<CollectionMetadata> {
    if (!UuidSchema.safeParse(id).success) throw new ValidationError('Choose a valid collection.');
    const parsed = CollectionMetadataSchema.safeParse(await call(env, scope,
        'SELECT public.read_collection_metadata_v1($1::uuid,$2::uuid,$3::uuid)AS result', [scope.siteId, scope.customUser.id, id]));
    if (!parsed.success || parsed.data.id !== id || parsed.data.store_id !== scope.siteId || parsed.data.deleted_at !== null) {
        throw new AppError('The current collection could not be confirmed. Retry loading it.', 503, 'COLLECTIONS_UNCONFIRMED');
    }
    return parsed.data;
}

export async function readCollectionMetadataPage(env: Env, scope: OwnedStoreScope,
    kind: 'manual' | 'smart', page: number, limit: number, search: string): Promise<CollectionMetadataPage> {
    const parsed = CollectionMetadataPageSchema.safeParse(await call(env, scope,
        'SELECT public.read_collection_metadata_page_v1($1::uuid,$2::uuid,$3::text,$4::integer,$5::integer,$6::text)AS result',
        [scope.siteId, scope.customUser.id, kind, page, limit, search]));
    if (!parsed.success || parsed.data.meta.store_id !== scope.siteId || parsed.data.meta.page !== page
        || parsed.data.meta.per_page !== limit || parsed.data.data.some(row => row.collection_type !== kind)) {
        throw new AppError('The current collection list could not be confirmed. Retry loading it.', 503, 'COLLECTIONS_UNCONFIRMED');
    }
    return parsed.data;
}

export async function previewCollectionRules(env: Env, scope: OwnedStoreScope, id: string): Promise<SmartCollectionPreviewResult> {
    if (!UuidSchema.safeParse(id).success) throw new ValidationError('Choose a valid collection.');
    const parsed = SmartCollectionPreviewSchema.safeParse(await call(env, scope,
        'SELECT public.preview_collection_rules_v1($1::uuid,$2::uuid,$3::uuid)AS result', [scope.siteId, scope.customUser.id, id]));
    if (!parsed.success || parsed.data.store_id !== scope.siteId || parsed.data.collection_id !== id) {
        throw new AppError('The saved rule preview could not be confirmed. Retry loading it.', 503, 'COLLECTIONS_UNCONFIRMED');
    }
    return parsed.data;
}

export async function executeCollectionMetadataCommand(env: Env, scope: OwnedStoreScope,
    operation: 'create' | 'update' | 'delete', id: string | null,
    intent: CreateCollectionMetadata | UpdateCollectionMetadata | DeleteCollectionMetadata): Promise<CollectionMetadataReceipt> {
    const parsed = (operation === 'create' ? CreateCollectionMetadataSchema
        : operation === 'update' ? UpdateCollectionMetadataSchema : DeleteCollectionMetadataSchema).safeParse(intent);
    if (!parsed.success) throw new ValidationError('A current collection intent, store and save key are required.');
    if (parsed.data.store_id !== scope.siteId || (operation === 'create' ? id !== null : !UuidSchema.safeParse(id).success)) {
        throw new ValidationError('A current collection intent, store and save key are required.');
    }
    const input = parsed.data;
    const version = 'version' in input ? input.version : null;
    const payload = Object.fromEntries(Object.entries(input).filter(([key, value]) =>
        !['store_id', 'idempotency_key', 'version'].includes(key) && value !== undefined));
    const acknowledgement = CollectionMetadataReceiptSchema.safeParse(await call(env, scope,
        'SELECT public.apply_collection_metadata_v1($1::uuid,$2::uuid,$3::text,$4::uuid,$5::integer,$6::uuid,$7::text::jsonb)AS result',
        [scope.siteId, scope.customUser.id, operation, id, version, input.idempotency_key, JSON.stringify(payload)]));
    if (!acknowledgement.success || acknowledgement.data.store_id !== scope.siteId
        || ('collection_type' in payload && acknowledgement.data.collection_type !== payload.collection_type)
        || acknowledgement.data.actor_id !== scope.customUser.id || acknowledgement.data.operation !== operation
        || acknowledgement.data.idempotency_key !== input.idempotency_key || acknowledgement.data.expected_version !== version
        || id !== null && acknowledgement.data.id !== id
        || canonicalizeExecutionPayload(acknowledgement.data.request) !== canonicalizeExecutionPayload(payload)) {
        throw new AppError('This collection save could not be confirmed. Recover the original request.', 503, 'COLLECTION_SAVE_UNCONFIRMED');
    }
    return acknowledgement.data;
}
