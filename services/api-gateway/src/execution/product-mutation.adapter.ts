import { planProductMutation } from '@letbuyy/commerce-core';
import type { Env } from '../index';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';

// The plan is already JSON text. Describe it as text on the wire so postgres.js
// does not apply its jsonb serializer to the string a second time.
export const APPLY_PRODUCT_EDIT_SQL = 'SELECT public.apply_product_edit_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text::jsonb) AS product';

function mutationError(error: unknown): never {
    if (error instanceof TenantTransactionUnavailableError) {
        throw new AppError('Product saving is temporarily unavailable. Keep your draft and retry.', 503, 'PRODUCT_EDIT_UNAVAILABLE');
    }
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : '';
    if (message.includes('PRODUCT_EDIT_FORBIDDEN') || code === '42501') throw new ForbiddenError('Your access to this store changed.');
    if (message.includes('PRODUCT_EDIT_NOT_FOUND')) throw new NotFoundError('Product not found');
    if (message.includes('PRODUCT_EDIT_VERSION_CONFLICT') || code === '40P01' || code === '40001') {
        throw new AppError('This product or its stock changed. Your draft is kept; reload the latest product before saving again.', 409, 'PRODUCT_VERSION_CONFLICT');
    }
    if (message.includes('PRODUCT_EDIT_KEY_CONFLICT')) {
        throw new AppError('This save key belongs to a different edit. Recover the original save before starting another.', 409, 'PRODUCT_EDIT_KEY_CONFLICT');
    }
    if (message.includes('PRODUCT_EDIT_VARIANT_REMOVAL')) {
        throw new AppError('A removed variant still has stock or history. Keep that variant and adjust its availability instead.', 409, 'PRODUCT_VARIANT_IN_USE');
    }
    if (message.includes('below reserved quantity')) {
        throw new AppError('Stock cannot be reduced below the quantity already reserved. Your draft is kept.', 409, 'PRODUCT_STOCK_RESERVED');
    }
    if (/PRODUCT_EDIT_INVALID|PRODUCT_EDIT_VARIANT_ID/.test(message) || code === '23503' || code === '23514' || code?.startsWith('22')) {
        throw new ValidationError('Some product or variant details are no longer valid. Review your draft and retry.');
    }
    throw error;
}

async function productTransaction(
    env: Env | undefined, storeId: string, actorId: string, requestId: string,
    query: string, parameters: (string | number)[],
): Promise<Record<string, unknown>> {
    try {
        if (!env) throw new TenantTransactionUnavailableError();
        return await withTenantTx(env, { siteId: storeId, requestId }, async (sql) => {
            // The caller supplies the already authenticated canonical account, never a body actor.
            await sql.unsafe('SELECT set_config($1, $2, true)', ['app.actor_id', actorId]);
            const rows = await sql.unsafe(query, parameters);
            const product = rows[0]?.product;
            if (!product || typeof product !== 'object' || Array.isArray(product)) throw new NotFoundError('Product not found');
            return product as Record<string, unknown>;
        });
    } catch (error) { return mutationError(error); }
}

export function readProductForEdit(env: Env, storeId: string, productId: string, actorId: string, requestId: string) {
    return productTransaction(env, storeId, actorId, requestId,
        'SELECT public.read_product_for_edit_v1($1::uuid,$2::uuid,$3::uuid) AS product',
        [storeId, productId, actorId]);
}

export function executeProductMutation(
    env: Env | undefined, storeId: string, productId: string, actorId: string,
    updates: Record<string, unknown>, requestId: string,
) {
    let plan;
    try { plan = planProductMutation(updates); }
    catch { throw new ValidationError('A current positive version, save key and valid product changes are required.'); }
    return productTransaction(env, storeId, actorId, requestId,
        APPLY_PRODUCT_EDIT_SQL,
        [storeId, productId, actorId, plan.expectedVersion, plan.idempotencyKey, JSON.stringify(plan.mutation)]);
}
