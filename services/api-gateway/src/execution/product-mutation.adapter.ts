import { planProductCreate, planProductMutation, type CreateProductCommand, type ProductCreatePlan } from '@letbuyy/commerce-core';
import type { PooledSqlClient } from '@letbuyy/infrastructure/pooled-sql-adapter';
import type { Env } from '../index';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';

// The plan is already JSON text. Describe it as text on the wire so postgres.js
// does not apply its jsonb serializer to the string a second time.
export const APPLY_PRODUCT_EDIT_SQL = 'SELECT public.apply_product_edit_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text::jsonb) AS product';

// Static columns only. Table defaults create the UUID/revision/timestamps; no
// client-generated variant ID or REST child write participates in creation.
export const INSERT_PRODUCT_SQL = `INSERT INTO public.products (
    store_id,site_id,name,slug,description,price,compare_price,cost_per_item,images,category,product_type,vendor,
    stock,track_inventory,status,sku,barcode,sell_when_oos,is_physical,weight,weight_unit,country_of_origin,
    importer_details,hs_code,hsn_code,url_handle,seo_title,seo_description,charge_tax,is_active,is_featured,
    tags,metadata,variants,display_order,created_by,updated_by
) SELECT p.store_id,p.store_id,p.name,p.slug,p.description,p.price,p.compare_price,p.cost_per_item,p.images,p.category,p.product_type,p.vendor,
    0,p.track_inventory,p.status,p.sku,p.barcode,p.sell_when_oos,p.is_physical,p.weight,p.weight_unit,p.country_of_origin,
    p.importer_details,p.hs_code,p.hsn_code,p.url_handle,p.seo_title,p.seo_description,p.charge_tax,p.is_active,p.is_featured,
    p.tags,p.metadata,'[]'::jsonb,p.display_order,$2::uuid,$2::uuid
FROM jsonb_populate_record(NULL::public.products,$1::text::jsonb) p RETURNING id,version`;

function mutationError(error: unknown): never {
    if (error instanceof TenantTransactionUnavailableError) {
        throw new AppError('Product saving is temporarily unavailable. Keep your draft and retry.', 503, 'PRODUCT_EDIT_UNAVAILABLE');
    }
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : '';
    if (message.includes('PRODUCT_LIMIT_REACHED')) {
        throw new AppError('Your store has reached its current product limit.', 403, 'PRODUCT_LIMIT_REACHED');
    }
    if (message.includes('ENTITLEMENT_AUTHORITY_UNAVAILABLE')) {
        throw new AppError('Product limits are temporarily unavailable. Keep your draft and retry.', 503, 'ENTITLEMENT_AUTHORITY_UNAVAILABLE');
    }
    if (message.includes('PRODUCT_EDIT_FORBIDDEN') || code === '42501') throw new ForbiddenError('Your access to this store changed.');
    if (message.includes('PRODUCT_EDIT_NOT_FOUND')) throw new NotFoundError('Product not found');
    if (message.includes('PRODUCT_EDIT_VERSION_CONFLICT') || code === '40P01' || code === '40001') {
        throw new AppError('This product or its stock changed. Your draft is kept; reload the latest product before saving again.', 409, 'PRODUCT_VERSION_CONFLICT');
    }
    if (message.includes('PRODUCT_EDIT_KEY_CONFLICT')) {
        throw new AppError('This save key belongs to a different edit. Recover the original save before starting another.', 409, 'PRODUCT_EDIT_KEY_CONFLICT');
    }
    if (/PRODUCT_PERSONALIZATION_REVISION_(REQUIRED|DECREASED)/.test(message)) {
        throw new AppError('Personalization choices changed. Advance the personalization revision and review your draft before saving.', 409, 'PERSONALIZATION_REVISION_CONFLICT');
    }
    if (message.includes('PRODUCT_PERSONALIZATION_INVALID')) {
        throw new ValidationError('Supply valid personalization facts with a positive revision, or explicitly remove them.');
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

/** The existing create boundary and edit writer share one real tenant transaction. */
export async function createProductInTenantTransaction(
    sql: PooledSqlClient, plan: ProductCreatePlan, storeId: string, actorId: string, creationKey: string,
) {
    if (plan.productInsert.store_id !== storeId) throw new ValidationError('The product store changed.');
    // One lock and the current persisted entitlement authority precede the
    // parent INSERT, including concurrent normal creates and CSV rows.
    await sql.unsafe('SELECT public.assert_product_creation_limit_v1($1::uuid,$2::uuid)', [storeId, actorId]);
    const inserted = await sql.unsafe(INSERT_PRODUCT_SQL, [JSON.stringify(plan.productInsert), actorId]);
    const productId = inserted[0]?.id;
    const version = inserted[0]?.version;
    if (typeof productId !== 'string' || typeof version !== 'number') throw new NotFoundError('Product not found');
    const mutation = { fields: {}, product_options: plan.productOptions, variants: plan.productVariants, stock: plan.initialStock };
    const rows = await sql.unsafe(APPLY_PRODUCT_EDIT_SQL,
        [storeId, productId, actorId, version, creationKey, JSON.stringify(mutation)]);
    const product = rows[0]?.product;
    if (!product || typeof product !== 'object' || Array.isArray(product)) throw new NotFoundError('Product not found');
    await sql.unsafe('SELECT public.record_product_creation_usage_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid)',
        [storeId, actorId, productId, creationKey]);
    return product as Record<string, unknown>;
}

export async function executeProductCreate(env: Env | undefined, input: CreateProductCommand, actorId: string) {
    let plan;
    try { plan = planProductCreate(input); }
    catch { throw new ValidationError('Some product or variant details are invalid. Review your draft and retry.'); }
    const requestId = crypto.randomUUID();
    try {
        if (!env) throw new TenantTransactionUnavailableError();
        return await withTenantTx(env, { siteId: input.store_id, requestId }, async sql => {
            await sql.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', actorId]);
            return createProductInTenantTransaction(sql, plan, input.store_id, actorId, requestId);
        });
    } catch (error) { return mutationError(error); }
}
