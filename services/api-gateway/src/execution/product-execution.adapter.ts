// ============================================================
// PRODUCT EXECUTION ADAPTER — Application-service-backed runtime adapter
// ============================================================

import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    COMMERCE_APPLICATION_WORKFLOWS,
    COMMERCE_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import { AppError, NotFoundError, ForbiddenError } from '../lib/errors';
import { verifySiteOwnership } from '../lib/auth-user';
import { SaasExecutionAdapter } from './saas-execution.adapter';
import type { Env } from '../index';
import { executeProductCreate, executeProductMutation } from './product-mutation.adapter';
import {
    type CreateProductCommand,
    type ProductOptionInput,
    type ProductVariantInput,
} from '@letbuyy/commerce-core';

interface OwnedProductRow {
    id: string;
    store_id: string;
    price?: number | string | null;
}

interface ProductVariantRow {
    id: string;
    title: string;
    price?: number | string | null;
    compare_price?: number | string | null;
    sku?: string | null;
    barcode?: string | null;
    inventory_qty?: number | string | null;
    weight?: number | string | null;
    weight_unit?: string | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    image_url?: string | null;
    position?: number | string | null;
}

interface ProductVariantWriteRow {
    product_id: string;
    title: string;
    price: number;
    compare_price: number | null;
    sku: string | null;
    inventory_qty: number;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    position: number;
}

interface ProductVariantInventoryLevel {
    product_id: string;
    variant_id: string | null;
    location_id: null;
    available: number;
    notes: string;
    request_id: string;
}

interface ProductExecutionAdapterOptions {
    variantDiffEnabled?: boolean;
    mutationEnv?: Env;
}

function normalizedText(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numericValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function nullableNumericValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    return numericValue(value);
}

function variantIdentityKey(variant: Pick<ProductVariantRow, 'sku' | 'title' | 'option1' | 'option2' | 'option3'>): string {
    const sku = normalizedText(variant.sku);
    if (sku) return `sku:${sku.toLowerCase()}`;

    return [
        'shape',
        normalizedText(variant.title)?.toLowerCase() || '',
        normalizedText(variant.option1)?.toLowerCase() || '',
        normalizedText(variant.option2)?.toLowerCase() || '',
        normalizedText(variant.option3)?.toLowerCase() || '',
    ].join(':');
}

function variantWriteChanged(existing: ProductVariantRow, desired: ProductVariantWriteRow): boolean {
    return (
        existing.title !== desired.title ||
        numericValue(existing.price) !== desired.price ||
        nullableNumericValue(existing.compare_price) !== desired.compare_price ||
        (normalizedText(existing.sku) || null) !== desired.sku ||
        (normalizedText(existing.option1) || null) !== desired.option1 ||
        (normalizedText(existing.option2) || null) !== desired.option2 ||
        (normalizedText(existing.option3) || null) !== desired.option3 ||
        numericValue(existing.position) !== desired.position
    );
}

export function isProductVariantDiffEnabled(env: { PRODUCT_VARIANT_DIFF?: string }): boolean {
    return (env.PRODUCT_VARIANT_DIFF || 'on').trim().toLowerCase() !== 'off';
}

export class ProductExecutionAdapter {
    static readonly applicationWorkflows = COMMERCE_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = COMMERCE_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'product-execution.adapter',
        workflowAuthority: 'commerce-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(
        private db: SupabaseClient,
        private options: ProductExecutionAdapterOptions = {},
    ) { }

    /**
     * Create a product with store ownership verification.
     * Generates a URL-safe slug from the product name.
     *
     * `alreadyAuthorized`: set by a caller that has ALREADY verified write access to `input.store_id`
     * through a different, equally-real check (e.g. routes/products.ts's `POST /` calls
     * `assertStaffPermission(c, body.store_id, customUser.id, 'products:write')` first, which correctly
     * allows a permitted staff member, not just the literal owner -- this method's own
     * `assertStoreOwnership` re-check was stricter and ran regardless, silently rejecting that staff
     * member's already-authorized request). Defaults to `false` so every OTHER existing caller (the
     * `/sample` route, which does its own separate owner-only `verifyStoreOwnership` check by design;
     * `routes/export.ts`'s background CSV-import job, which has no live request/session to re-check
     * against) keeps its exact current, unchanged, owner-only behavior.
     */
    async createProduct(input: CreateProductCommand, userId: string, sessionStoreId?: string, alreadyAuthorized = false) {
        if (!alreadyAuthorized) {
            await this.assertStoreOwnership(input.store_id, userId, sessionStoreId, 'You do not own this store');
        }
        await this.assertProductQuota(input.store_id);

        const data = await executeProductCreate(this.options.mutationEnv, input, userId);
        const productId = String(data.id);
        await this.recordProductUsage(input.store_id, 1, `product.create:${productId}`, userId, productId);
        return data;
    }

    /**
     * Update a product. Only allows updating fields in the allowlist.
     *
     * `storeId` is the product's real store, ALREADY VERIFIED by the caller (routes/products.ts's
     * `PATCH /:id` resolves it from the product row itself via `loadProductByIdUnguarded`, then checks
     * owner-OR-staff via `assertStaffPermission`, the same pattern `GET /:id` already used) -- this
     * method no longer re-derives it through an owner-only lookup (the former `getOwnedProduct`, which
     * silently rejected a real, permitted staff member's already-authorized request). `storeId` still
     * scopes every query below, which is what the tenant guard requires and what actually prevents a
     * cross-store write -- authorization (who may act on this store) and scoping (which store this
     * write is confined to) are two different questions, and only the first one changed here.
     */
    async updateProduct(
        productId: string,
        storeId: string,
        userId: string,
        updates: Record<string, unknown>,
        requestId = crypto.randomUUID(),
    ) {
        // The database owns the live actor check, compare-and-swap, all effects and receipt.
        // Creation/import keep their existing writer; no edit can enter its legacy diff branch.
        return executeProductMutation(this.options.mutationEnv, storeId, productId, userId, updates, requestId);
    }

    /**
     * Soft delete a product using deleted_at timestamp. Also sets is_active = false for backward
     * compat. `storeId`: see updateProduct's docstring -- the same already-verified-by-the-caller shape.
     */
    async softDelete(productId: string, storeId: string, userId: string) {
        const ownedProduct = await this.loadProductScopedToStore(productId, storeId);

        const { error } = await this.db
            .from('products')
            .update({
                is_active: false,
                deleted_at: new Date().toISOString(),
            })
            .eq('id', productId)
            .eq('store_id', ownedProduct.store_id);

        if (error) throw new Error(`Delete failed: ${error.message}`);
        await this.recordProductUsage(ownedProduct.store_id, -1, `product.delete:${productId}`, userId, productId);
        return { deleted: true, product_id: productId, store_id: ownedProduct.store_id };
    }

    /**
     * Bulk operations on products with store ownership verification.
     *
     * `alreadyAuthorized`: see createProduct's docstring -- the same shape. `routes/products.ts`'s
     * `POST /bulk` already calls `assertStaffPermission(c, body.store_id, ..., 'products:write')`
     * before this runs, so it passes `true`; any other/future caller keeps today's owner-only default.
     */
    async bulkAction(
        storeId: string | undefined,
        productIds: string[],
        action: 'activate' | 'deactivate' | 'delete',
        userId: string,
        sessionStoreId?: string,
        alreadyAuthorized = false,
    ) {
        if (storeId && !alreadyAuthorized) {
            await this.assertStoreOwnership(storeId, userId, sessionStoreId, 'Not authorized for this store');
        }

        // APPID-FIX2: the ownership question, in the query itself — a bare `.in('id', productIds)`
        // has no store/site predicate and the tenant query guard refuses it outright, the same defect
        // class as `getOwnedProduct`.
        const ownedStoreIds = storeId ? [storeId] : await this.resolveOwnedStoreIds(userId, sessionStoreId);
        if (ownedStoreIds.length === 0) throw new ForbiddenError('Not authorized for this store');

        const { data: products, error: productError } = await this.db
            .from('products')
            .select('id, store_id')
            .in('id', productIds)
            .in('store_id', ownedStoreIds)
            .is('deleted_at', null);

        if (productError) throw new Error(`Bulk ownership check failed: ${productError.message}`);
        if (!products || products.length !== productIds.length) {
            throw new NotFoundError('One or more products were not found');
        }

        const ownedProducts = products as OwnedProductRow[];
        if (storeId && ownedProducts.some((product) => product.store_id !== storeId)) {
            throw new ForbiddenError('Bulk action contains products outside the selected store');
        }

        const uniqueStoreIds = Array.from(new Set(ownedProducts.map((product) => product.store_id)));
        for (const ownedStoreId of uniqueStoreIds) {
            await this.assertStoreOwnership(ownedStoreId, userId, sessionStoreId, 'Not authorized for this store');
        }

        let update: Record<string, unknown>;
        switch (action) {
            case 'activate':
                update = { is_active: true };
                break;
            case 'deactivate':
                update = { is_active: false };
                break;
            case 'delete':
                update = { is_active: false, deleted_at: new Date().toISOString() };
                break;
        }

        const { data, error } = await this.db
            .from('products')
            .update(update)
            .in('id', ownedProducts.map((product) => product.id))
            .in('store_id', ownedStoreIds)
            .select('id');

        if (error) throw new Error(`Bulk action failed: ${error.message}`);
        if (action === 'delete') {
            const countByStore = new Map<string, number>();
            for (const product of ownedProducts) {
                countByStore.set(product.store_id, (countByStore.get(product.store_id) || 0) + 1);
            }

            for (const [ownedStoreId, count] of countByStore.entries()) {
                await this.recordProductUsage(
                    ownedStoreId,
                    -count,
                    `product.bulk_delete:${ownedStoreId}:${productIds.sort().join(',')}`,
                    userId,
                    ownedStoreId
                );
            }
        }
        return { affected: data?.length || 0, action, products: ownedProducts };
    }

    private async assertStoreOwnership(
        storeId: string,
        userId: string,
        sessionStoreId: string | undefined,
        message: string
    ) {
        const ownsStore = await verifySiteOwnership(this.db, storeId, userId, sessionStoreId);
        if (!ownsStore) throw new ForbiddenError(message);
    }

    /**
     * The caller's own store ids (APPID-FIX2: shared by every product lookup that starts from a
     * product id alone, so each one carries the store predicate the tenant query guard requires
     * instead of fetching the row unscoped and checking ownership afterward).
     */
    private async resolveOwnedStoreIds(userId: string, sessionStoreId?: string): Promise<string[]> {
        let ownedStores = this.db
            .from('sites')
            .select('id')
            .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
            .is('deleted_at', null);
        if (sessionStoreId) ownedStores = ownedStores.eq('id', sessionStoreId);
        const { data: stores, error: storesError } = await ownedStores;
        if (storesError) throw new Error(`Store lookup failed: ${storesError.message}`);
        return ((stores ?? []) as { id: string }[]).map((store) => store.id);
    }

    /**
     * The product row, scoped to a store the CALLER has already verified authorization for (see
     * updateProduct's docstring) -- never an ownership derivation of its own. `.eq('store_id', storeId)`
     * is what the tenant query guard requires (a product id alone never satisfies it) and what actually
     * confines this read/write to one store; it is a scope predicate, not an authorization check.
     * Replaces the former `getOwnedProduct` (owner-only, via `resolveOwnedStoreIds`) and
     * `ownedProductStoreId` (same owner-only shape, used by the route to resolve a product's store
     * BEFORE the staff-permission check could run at all -- the actual bug this replacement fixes).
     */
    private async loadProductScopedToStore(productId: string, storeId: string): Promise<OwnedProductRow> {
        const { data: product, error } = await this.db
            .from('products')
            .select('id, store_id, price')
            .eq('id', productId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) throw new Error(`Product lookup failed: ${error.message}`);
        if (!product) throw new NotFoundError('Product not found');
        return product as OwnedProductRow;
    }

    private async assertProductQuota(storeId: string): Promise<void> {
        const entitlements = await new SaasExecutionAdapter(this.db).resolveEntitlements(storeId);
        const rawLimit = entitlements.limits.products;
        if (entitlements.authority !== 'persisted' || rawLimit === undefined) {
            throw new AppError('Product limits are temporarily unavailable. Retry when service is restored.', 503, 'ENTITLEMENT_AUTHORITY_UNAVAILABLE');
        }
        if (rawLimit === null) return;
        const productLimit = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);

        if (!Number.isFinite(productLimit) || productLimit < 0) {
            throw new AppError('Product limits are temporarily unavailable. Retry when service is restored.', 503, 'ENTITLEMENT_AUTHORITY_UNAVAILABLE');
        }

        const { count, error } = await this.db
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .is('deleted_at', null);

        if (error) throw new Error(`Product quota check failed: ${error.message}`);
        if ((count || 0) >= productLimit) {
            throw new ForbiddenError(`Product limit reached for the ${entitlements.plan} plan`);
        }
    }

    private async recordProductUsage(
        storeId: string,
        amount: number,
        idempotencyKey: string,
        actorId: string,
        resourceId: string
    ): Promise<void> {
        await new SaasExecutionAdapter(this.db).recordUsage({
            siteId: storeId,
            meterName: 'products',
            amount,
            idempotencyKey,
            source: 'product-service',
            resourceType: 'product',
            resourceId,
            metadata: { actor_id: actorId },
        });
    }

    private async replaceProductOptions(productId: string, options: ProductOptionInput[]) {
        await this.db.from('product_options').delete().eq('product_id', productId);

        if (options.length === 0) return;

        const { error } = await this.db.from('product_options').insert(
            options.map((option, index) => ({
                product_id: productId,
                name: option.name,
                position: option.position ?? index,
                values: option.values || [],
            }))
        );

        if (error) throw new Error(`Product options save failed: ${error.message}`);
    }

    private async replaceProductVariants(
        productId: string,
        basePrice: number,
        variants: ProductVariantInput[],
        actorId: string
    ) {
        if (this.options.variantDiffEnabled === false) {
            await this.replaceProductVariantsLegacy(productId, basePrice, variants, actorId);
            return;
        }

        if (variants.length === 0) {
            const { error } = await this.db.from('product_variants').delete().eq('product_id', productId);
            if (error) throw new Error(`Product variants delete failed: ${error.message}`);
            return;
        }

        const existingVariants = await this.loadExistingProductVariants(productId);
        const existingByKey = new Map<string, ProductVariantRow[]>();
        for (const existing of existingVariants) {
            const key = variantIdentityKey(existing);
            existingByKey.set(key, [...(existingByKey.get(key) || []), existing]);
        }

        const matchedIds = new Set<string>();
        const rowsToInsert: ProductVariantWriteRow[] = [];
        const rowsToUpdate: Array<{ id: string; row: ProductVariantWriteRow }> = [];
        const inventoryLevels: ProductVariantInventoryLevel[] = [];

        for (const [index, variant] of variants.entries()) {
            const desired = this.normalizeProductVariant(productId, basePrice, variant, index);
            const key = variantIdentityKey(desired);
            const existingQueue = existingByKey.get(key) || [];
            const existing = existingQueue.shift();
            if (existingQueue.length > 0) {
                existingByKey.set(key, existingQueue);
            } else {
                existingByKey.delete(key);
            }

            if (!existing) {
                rowsToInsert.push(desired);
                continue;
            }

            matchedIds.add(existing.id);
            if (variantWriteChanged(existing, desired)) {
                rowsToUpdate.push({ id: existing.id, row: desired });
            }
            if (numericValue(existing.inventory_qty) !== desired.inventory_qty) {
                inventoryLevels.push(this.inventoryLevel(productId, existing.id, desired.inventory_qty, 'variant.inventory.diff'));
            }
        }

        await Promise.all(rowsToUpdate.map(async ({ id, row }) => {
            const { error } = await this.db
                .from('product_variants')
                .update({
                    title: row.title,
                    price: row.price,
                    compare_price: row.compare_price,
                    sku: row.sku,
                    inventory_qty: row.inventory_qty,
                    option1: row.option1,
                    option2: row.option2,
                    option3: row.option3,
                    position: row.position,
                })
                .eq('product_id', productId)
                .eq('id', id);

            if (error) throw new Error(`Product variant update failed: ${error.message}`);
        }));

        if (rowsToInsert.length > 0) {
            const { data, error } = await this.db
                .from('product_variants')
                .insert(rowsToInsert)
                .select('id, inventory_qty');

            if (error) throw new Error(`Product variants insert failed: ${error.message}`);
            for (const variant of data || []) {
                inventoryLevels.push(this.inventoryLevel(
                    productId,
                    variant.id as string,
                    numericValue((variant as ProductVariantRow).inventory_qty),
                    'variant.inventory.diff',
                ));
            }
        }

        const obsoleteIds = existingVariants
            .filter((variant) => !matchedIds.has(variant.id))
            .map((variant) => variant.id);

        if (obsoleteIds.length > 0) {
            const { error } = await this.db
                .from('product_variants')
                .delete()
                .eq('product_id', productId)
                .in('id', obsoleteIds);

            if (error) throw new Error(`Product variants delete failed: ${error.message}`);
        }

        await this.setInventoryAvailableBatch(inventoryLevels, actorId);
    }

    private async replaceProductVariantsLegacy(
        productId: string,
        basePrice: number,
        variants: ProductVariantInput[],
        actorId: string
    ) {
        await this.db.from('product_variants').delete().eq('product_id', productId);

        if (variants.length === 0) return;

        const { data, error } = await this.db
            .from('product_variants')
            .insert(
                variants.map((variant, index) => ({
                    product_id: productId,
                    title: variant.title,
                    price: variant.price ?? variant.price_override ?? basePrice,
                    compare_price: variant.compare_price ?? null,
                    sku: variant.sku || null,
                    inventory_qty: variant.stock ?? 0,
                    option1: Object.values(variant.options || {})[0] || null,
                    option2: Object.values(variant.options || {})[1] || null,
                    option3: Object.values(variant.options || {})[2] || null,
                    position: index,
                }))
            )
            .select('id, inventory_qty');

        if (error) throw new Error(`Product variants save failed: ${error.message}`);

        for (const variant of data || []) {
            await this.setInventoryAvailable(
                productId,
                variant.id as string,
                Number(variant.inventory_qty || 0),
                actorId,
                'variant.inventory.set'
            );
        }
    }

    private async loadExistingProductVariants(productId: string): Promise<ProductVariantRow[]> {
        const { data, error } = await this.db
            .from('product_variants')
            .select('id, title, price, compare_price, sku, barcode, inventory_qty, weight, weight_unit, option1, option2, option3, image_url, position')
            .eq('product_id', productId)
            .order('position', { ascending: true });

        if (error) throw new Error(`Product variants lookup failed: ${error.message}`);
        return data as ProductVariantRow[] || [];
    }

    private async refreshProductVariantJsonbCache(productId: string, storeId: string): Promise<Record<string, unknown>[]> {
        const variants = await this.loadExistingProductVariants(productId);
        const cache = variants.map((variant) => ({
            id: variant.id,
            title: variant.title,
            price: numericValue(variant.price),
            compare_price: nullableNumericValue(variant.compare_price),
            sku: normalizedText(variant.sku),
            barcode: normalizedText(variant.barcode),
            stock: numericValue(variant.inventory_qty),
            inventory_qty: numericValue(variant.inventory_qty),
            weight: nullableNumericValue(variant.weight),
            weight_unit: normalizedText(variant.weight_unit) || 'kg',
            option1: normalizedText(variant.option1),
            option2: normalizedText(variant.option2),
            option3: normalizedText(variant.option3),
            image_url: normalizedText(variant.image_url),
            position: numericValue(variant.position),
        }));

        const { error } = await this.db
            .from('products')
            .update({ variants: cache })
            .eq('id', productId)
            .eq('store_id', storeId);

        if (error) throw new Error(`Product variant cache refresh failed: ${error.message}`);
        return cache;
    }

    private normalizeProductVariant(
        productId: string,
        basePrice: number,
        variant: ProductVariantInput,
        index: number,
    ): ProductVariantWriteRow {
        const optionValues = Object.values(variant.options || {});
        return {
            product_id: productId,
            title: variant.title,
            price: numericValue(variant.price ?? variant.price_override ?? basePrice),
            compare_price: nullableNumericValue(variant.compare_price),
            sku: normalizedText(variant.sku),
            inventory_qty: variant.stock ?? 0,
            option1: normalizedText(optionValues[0]),
            option2: normalizedText(optionValues[1]),
            option3: normalizedText(optionValues[2]),
            position: index,
        };
    }

    private inventoryLevel(
        productId: string,
        variantId: string,
        available: number,
        notes: string,
    ): ProductVariantInventoryLevel {
        return {
            product_id: productId,
            variant_id: variantId,
            location_id: null,
            available,
            notes,
            request_id: `variant.inventory.diff:${productId}:${variantId}`,
        };
    }

    private async setInventoryAvailableBatch(
        levels: ProductVariantInventoryLevel[],
        actorId: string,
    ): Promise<void> {
        if (levels.length === 0) return;

        const { error } = await this.db.rpc('set_inventory_levels_available_batch', {
            p_levels: levels,
            p_actor_id: actorId,
            p_reason: 'adjustment',
            p_notes: 'variant.inventory.diff',
            p_request_id: null,
        });

        if (error) throw new Error(`Inventory batch sync failed: ${error.message}`);
    }

    private async setInventoryAvailable(
        productId: string,
        variantId: string | null,
        available: number,
        actorId: string,
        reason: string
    ) {
        const { error } = await this.db.rpc('set_inventory_level_available', {
            p_product_id: productId,
            p_variant_id: variantId,
            p_location_id: null,
            p_available: available,
            p_actor_id: actorId,
            p_reason: 'adjustment',
            p_notes: reason,
            p_request_id: null,
        });

        if (error) throw new Error(`Inventory sync failed: ${error.message}`);
    }
}
