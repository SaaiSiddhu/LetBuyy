import type { BulkAdjustInput, InventoryAdjustmentInput } from '@letbuyy/commerce-core';
import { InventoryBatchAdjustmentResultSchema, type InventoryBatchAdjustmentResult } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';
import { IdempotencyExecutionAdapter } from './idempotency-execution.adapter';

export const APPLY_INVENTORY_ADJUSTMENT_SQL = 'SELECT public.apply_inventory_adjustment_v1($1::uuid,$2::uuid,$3::text,$4::text::jsonb) AS result';
export const APPLY_INVENTORY_BATCH_ADJUSTMENT_SQL = 'SELECT public.apply_inventory_adjustment_batch_v1($1::uuid,$2::uuid,$3::text,$4::text::jsonb) AS result';

function adjustmentCommand(input: InventoryAdjustmentInput) {
    return { product_id: input.product_id, variant_id: input.variant_id || null,
        location_id: input.location_id || null, adjustment: input.adjustment,
        reason: input.reason, notes: input.notes || null };
}
const sameUuid = (left: string | null | undefined, right: string | null | undefined) =>
    (left?.toLowerCase() || null) === (right?.toLowerCase() || null);

/** The existing SQL writer owns stock, its adjustment audit and its outbox. */
export async function executeInventoryAdjustment(
    env: Env, storeId: string, actorId: string, key: string,
    input: InventoryAdjustmentInput, requestId: string,
): Promise<{ level: Record<string, unknown>; replayed: boolean }> {
    const command = adjustmentCommand(input);
    const normalizedKey = IdempotencyExecutionAdapter.normalizeKey(key);
    try {
        return await withTenantTx(env, { siteId: storeId, requestId }, async sql => {
            await sql.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', actorId]);
            const rows = await sql.unsafe(APPLY_INVENTORY_ADJUSTMENT_SQL, [storeId, actorId, normalizedKey, JSON.stringify(command)]);
            const result = rows[0]?.result as { level?: Record<string, unknown>; replayed?: boolean } | undefined;
            if (!result?.level || typeof result.level !== 'object' || Array.isArray(result.level) || typeof result.replayed !== 'boolean') {
                throw new Error('Inventory adjustment returned no durable acknowledgement');
            }
            return { level: result.level, replayed: result.replayed };
        });
    } catch (error) {
        const code = (error as { code?: string })?.code;
        const message = error instanceof Error ? error.message : '';
        if (error instanceof TenantTransactionUnavailableError) throw new AppError('Stock saving is unavailable. Keep the pending adjustment and retry.', 503, 'INVENTORY_ADJUST_UNAVAILABLE');
        if (/INVENTORY_ADJUST_FORBIDDEN|PRODUCT_EDIT_FORBIDDEN/.test(message) || code === '42501') throw new ForbiddenError('Your access to this store changed.');
        if (message.includes('INVENTORY_ADJUST_NOT_FOUND')) throw new NotFoundError('The product, variant or stock location is no longer available.');
        if (message.includes('INVENTORY_ADJUST_KEY_CONFLICT')) throw new AppError('This key belongs to another stock command. Recover the original adjustment.', 409, 'INVENTORY_ADJUST_KEY_CONFLICT');
        if (message.includes('INVENTORY_ADJUST_LEGACY_KEY')) throw new AppError('This earlier adjustment needs review. Its outcome cannot be safely reapplied.', 409, 'INVENTORY_ADJUST_LEGACY_KEY');
        if (code === '40P01' || code === '40001' || code === '23505') throw new AppError('Stock is changing. Retry the same pending adjustment.', 409, 'INVENTORY_ADJUST_CONFLICT');
        if (/cannot reduce inventory below zero|below reserved quantity/.test(message)) throw new AppError('Inventory adjustment failed', 400, 'INVENTORY_ADJUSTMENT_FAILED');
        if (message.includes('INVENTORY_ADJUST_INVALID') || code === '23503' || code === '23514' || code?.startsWith('22')) throw new ValidationError('The stock adjustment details are invalid.');
        throw error;
    }
}

/** One batch identity around the existing per-item stock/receipt authority. */
export async function executeInventoryAdjustmentBatch(
    env: Env, storeId: string, actorId: string, key: string,
    input: BulkAdjustInput, requestId: string,
): Promise<{ response: InventoryBatchAdjustmentResult; replayed: boolean }> {
    const normalizedKey = IdempotencyExecutionAdapter.normalizeKey(key);
    const command = { adjustments: input.adjustments.map(adjustmentCommand) };
    try {
        return await withTenantTx(env, { siteId: storeId, requestId }, async sql => {
            await sql.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', actorId]);
            const rows = await sql.unsafe(APPLY_INVENTORY_BATCH_ADJUSTMENT_SQL, [storeId, actorId, normalizedKey, JSON.stringify(command)]);
            const result = rows[0]?.result as { response?: unknown; replayed?: unknown } | undefined;
            const parsed = InventoryBatchAdjustmentResultSchema.safeParse(result?.response);
            if (!parsed.success || typeof result?.replayed !== 'boolean' || parsed.data.total !== input.adjustments.length
                || parsed.data.results.some((row, index) => !sameUuid(row.product_id, input.adjustments[index]?.product_id)
                    || row.status === 'adjusted' && (!sameUuid(row.level.store_id, storeId)
                        || !sameUuid(row.level.product_id, row.product_id)
                        || !sameUuid(row.level.variant_id, input.adjustments[index]?.variant_id)
                        || Boolean(input.adjustments[index]?.location_id) && !sameUuid(row.level.location_id, input.adjustments[index]?.location_id)))) {
                throw new AppError('The saved stock batch could not be confirmed. Retry the original request.', 503, 'INVENTORY_BATCH_UNAVAILABLE');
            }
            return { response: parsed.data, replayed: result.replayed };
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        const code = (error as {code?: string})?.code;
        const message = error instanceof Error ? error.message : '';
        if (error instanceof TenantTransactionUnavailableError || ['42883','42703','42P01'].includes(code || '')
            || message.includes('INVENTORY_BATCH_UNAVAILABLE')) throw new AppError('Stock batch saving is unavailable. Retry the original request.', 503, 'INVENTORY_BATCH_UNAVAILABLE');
        if (code === '42501' || /INVENTORY_BATCH_FORBIDDEN|PRODUCT_EDIT_FORBIDDEN/.test(message)) throw new ForbiddenError('Your access to this store changed.');
        if (/INVENTORY_BATCH_KEY_CONFLICT|INVENTORY_ADJUST_KEY_CONFLICT/.test(message)) throw new AppError('This key belongs to another stock command. Recover the original batch.', 409, 'INVENTORY_BATCH_KEY_CONFLICT');
        if (/INVENTORY_BATCH_LEGACY_KEY|INVENTORY_ADJUST_LEGACY_KEY/.test(message)) throw new AppError('This earlier stock batch needs review. Its outcome cannot be safely reapplied.', 409, 'INVENTORY_BATCH_LEGACY_KEY');
        if (message.includes('INVENTORY_ADJUST_NOT_FOUND')) throw new NotFoundError('An acknowledged stock record is no longer available.');
        if (code === '40P01' || code === '40001' || code === '23505') throw new AppError('Stock is changing. Retry the same original batch.', 409, 'INVENTORY_BATCH_CONFLICT');
        if (message.includes('INVENTORY_BATCH_INVALID') || code === '23503' || code === '23514' || code?.startsWith('22')) throw new ValidationError('The stock batch details are invalid.');
        throw error;
    }
}
