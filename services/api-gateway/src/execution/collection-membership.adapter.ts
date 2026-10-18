import type { Env } from '../index';
import type { OwnedStoreScope } from '../lib/tenant-context';
import { verifySiteOwnership } from '../lib/auth-user';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';
import { CollectionMembershipSnapshotSchema, type CollectionMembershipSnapshot } from '@letbuyy/shared-types';
import { ReplaceCollectionMembershipSchema, type ReplaceCollectionMembershipInput } from '@letbuyy/commerce-core';

function failure(error: unknown): never {
    if (error instanceof AppError) throw error;
    if (error instanceof TenantTransactionUnavailableError) throw new AppError('Collection saving is temporarily unavailable. Keep this save and retry.', 503, 'COLLECTION_MEMBERSHIP_UNAVAILABLE');
    const code = (error as {code?: string})?.code, message = error instanceof Error ? error.message : '';
    if (message.includes('COLLECTION_MEMBERSHIP_FORBIDDEN') || code === '42501') throw new ForbiddenError('Your access to this store changed.');
    if (message.includes('COLLECTION_MEMBERSHIP_NOT_FOUND')) throw new NotFoundError('Collection not found');
    if (message.includes('COLLECTION_MEMBERSHIP_VERSION_CONFLICT') || code === '40P01' || code === '40001') throw new AppError('Collection membership changed. Your selection is kept; reload the current collection.', 409, 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT');
    if (message.includes('COLLECTION_MEMBERSHIP_LEGACY_KEY')) throw new AppError('This key belongs to an older collection save. Reload the current collection before starting another save.', 409, 'COLLECTION_MEMBERSHIP_LEGACY_KEY');
    if (message.includes('COLLECTION_MEMBERSHIP_KEY_CONFLICT')) throw new AppError('This key belongs to a different collection save. Recover the original save.', 409, 'COLLECTION_MEMBERSHIP_KEY_CONFLICT');
    if (message.includes('COLLECTION_MEMBERSHIP_INVALID') || code === '23503' || code === '23514' || code?.startsWith('22')) throw new ValidationError('Every selected product must be valid and belong to this store. Review your selection.');
    throw new AppError('Collection products could not be confirmed. Retry this request.', 500, 'COLLECTION_MEMBERSHIP_FAILED');
}
export async function readCollectionMembership(scope: OwnedStoreScope, collectionId: string): Promise<CollectionMembershipSnapshot> {
    try {
        // ResolveOwnedStoreScope already verified the selected current owner.
        // Bracket junction/products with the monotonic parent revision. A
        // change (including ABA) across these reads is an explicit conflict.
        const {data: collection, error} = await scope.db.from('collections')
            .select('id, store_id, membership_version').eq('store_id', scope.siteId).eq('id', collectionId).is('deleted_at', null).maybeSingle();
        if (error) throw error;
        if (!collection) throw new NotFoundError('Collection not found');
        const {data: assignments, error: assignedError} = await scope.db.from('collection_products')
            .select('product_id, position, id').eq('collection_id', collectionId).order('position', {ascending: true}).order('id', {ascending: true});
        if (assignedError) throw assignedError;
        const ids = (assignments || []).map(row => row.product_id as string);
        let products: unknown[] = [], unavailableProductIds: string[] = [];
        if (ids.length) {
            const {data, error: productError} = await scope.db.from('products')
                .select('id, name, price, is_active, thumbnail_url').eq('store_id', scope.siteId).in('id', ids).is('deleted_at', null);
            if (productError) throw productError;
            const byId = new Map((data || []).map(row => [row.id, row]));
            unavailableProductIds = ids.filter(id => !byId.has(id));
            products = ids.filter(id => byId.has(id)).map(id => byId.get(id));
        }
        // A live ownership change during the private read never returns the
        // old owner's response. The SQL command repeats this fence under locks.
        if (!await verifySiteOwnership(scope.db, scope.siteId, scope.customUser.id, scope.authUser.storeId)) throw new ForbiddenError('Your access to this store changed.');
        const {data: confirmed, error: confirmError} = await scope.db.from('collections')
            .select('id, store_id, membership_version').eq('store_id', scope.siteId).eq('id', collectionId).is('deleted_at', null).maybeSingle();
        if (confirmError) throw confirmError;
        if (!confirmed || confirmed.membership_version !== collection.membership_version) {
            throw new AppError('Collection membership changed while loading. Retry to read the current collection.', 409, 'COLLECTION_MEMBERSHIP_READ_CONFLICT');
        }
        return CollectionMembershipSnapshotSchema.parse({collection_id: collectionId, store_id: scope.siteId,
            membership_version: collection.membership_version, product_ids: ids, products, unavailable_product_ids: unavailableProductIds});
    } catch (error) { return failure(error); }
}
export async function replaceCollectionMembership(env: Env, scope: OwnedStoreScope, collectionId: string, body: unknown): Promise<CollectionMembershipSnapshot> {
    let input: ReplaceCollectionMembershipInput;
    try { input = ReplaceCollectionMembershipSchema.parse(body); }
    catch { throw new ValidationError('An explicit product list, current membership version and save key are required.'); }
    try {
        const result = await withTenantTx(env, scope.tenant, async sql => {
            await sql.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', scope.customUser.id]);
            const rows = await sql.unsafe('SELECT public.apply_collection_membership_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text::jsonb) AS membership',
                [scope.siteId, collectionId, scope.customUser.id, input.expected_version, input.idempotency_key, JSON.stringify(input.product_ids)]);
            return rows[0]?.membership;
        });
        return CollectionMembershipSnapshotSchema.parse(result);
    } catch (error) { return failure(error); }
}

