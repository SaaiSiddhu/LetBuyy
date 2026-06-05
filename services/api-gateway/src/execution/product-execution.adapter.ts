// ============================================================
// PRODUCT EXECUTION ADAPTER — Application-service-backed runtime adapter
// ============================================================

import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    COMMERCE_APPLICATION_WORKFLOWS,
    COMMERCE_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/application-services';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';
import { verifySiteOwnership } from '../lib/auth-user';
import { SaasExecutionAdapter } from './saas-execution.adapter';
import {
    planProductCreate,
    planProductUpdate,
    type CreateProductCommand,
    type ProductOptionInput,
    type ProductVariantInput,
} from '@letbuyy/commerce-core';

interface OwnedProductRow {
    id: string;
    store_id: string;
    price?: number | string | null;
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

    constructor(private db: SupabaseClient) { }

    /**
     * Create a product with store ownership verification.
     * Generates a URL-safe slug from the product name.
     */
    async createProduct(input: CreateProductCommand, userId: string, sessionStoreId?: string) {
        await this.assertStoreOwnership(input.store_id, userId, sessionStoreId, 'You do not own this store');
        await this.assertProductQuota(input.store_id);

        const createPlan = planProductCreate(input);

        const { data, error } = await this.db
            .from('products')
            .insert(createPlan.productInsert)
            .select()
            .single();

        if (error) throw new Error(`Product creation failed: ${error.message}`);
        await this.replaceProductOptions(data.id, createPlan.productOptions);
        await this.replaceProductVariants(data.id, input.price, createPlan.productVariants, userId);
        await this.setInventoryAvailable(data.id, null, createPlan.initialStock, userId, 'product.create');
        await this.recordProductUsage(input.store_id, 1, `product.create:${data.id}`, userId, data.id);
        return data;
    }

    /**
     * Update a product with ownership verification.
     * Only allows updating fields in the allowlist.
     */
    async updateProduct(
        productId: string,
        userId: string,
        updates: Record<string, unknown>,
        sessionStoreId?: string
    ) {
        const ownedProduct = await this.getOwnedProduct(productId, userId, sessionStoreId);

        const updatePlan = planProductUpdate(updates);
        if (Object.keys(updatePlan.safeUpdates).length === 0 && !updatePlan.hasOptionUpdates) {
            throw new ValidationError('No valid fields to update');
        }

        let data: Record<string, unknown> | null = null;
        if (Object.keys(updatePlan.safeUpdates).length > 0) {
            const result = await this.db
                .from('products')
                .update(updatePlan.safeUpdates)
                .eq('id', productId)
                .select()
                .single();

            if (result.error) throw new Error(`Product update failed: ${result.error.message}`);
            data = result.data as Record<string, unknown>;
        }

        if (updatePlan.hasOptionUpdates && Array.isArray(updates.product_options)) {
            await this.replaceProductOptions(productId, updates.product_options as ProductOptionInput[]);
        }

        if (updatePlan.hasVariantUpdates && Array.isArray(updates.variants)) {
            const basePrice = typeof updatePlan.safeUpdates.price === 'number'
                ? updatePlan.safeUpdates.price
                : Number(data?.price ?? ownedProduct.price ?? 0);
            await this.replaceProductVariants(productId, basePrice, updates.variants as ProductVariantInput[], userId);
        }

        if (updatePlan.hasInventoryUpdate && typeof updates.stock === 'number') {
            await this.setInventoryAvailable(productId, null, updates.stock, userId, 'product.update');
        }

        if (!data) {
            const { data: refreshed, error } = await this.db
                .from('products')
                .select()
                .eq('id', productId)
                .single();

            if (error) throw new Error(`Product refresh failed: ${error.message}`);
            data = refreshed as Record<string, unknown>;
        }

        return data;
    }

    /**
     * Soft delete a product using deleted_at timestamp.
     * Also sets is_active = false for backward compat.
     */
    async softDelete(productId: string, userId: string, sessionStoreId?: string) {
        const ownedProduct = await this.getOwnedProduct(productId, userId, sessionStoreId);

        const { error } = await this.db
            .from('products')
            .update({
                is_active: false,
                deleted_at: new Date().toISOString(),
            })
            .eq('id', productId);

        if (error) throw new Error(`Delete failed: ${error.message}`);
        await this.recordProductUsage(ownedProduct.store_id, -1, `product.delete:${productId}`, userId, productId);
        return { deleted: true, product_id: productId, store_id: ownedProduct.store_id };
    }

    /**
     * Bulk operations on products with store ownership verification.
     */
    async bulkAction(
        storeId: string | undefined,
        productIds: string[],
        action: 'activate' | 'deactivate' | 'delete',
        userId: string,
        sessionStoreId?: string
    ) {
        if (storeId) {
            await this.assertStoreOwnership(storeId, userId, sessionStoreId, 'Not authorized for this store');
        }

        const { data: products, error: productError } = await this.db
            .from('products')
            .select('id, store_id')
            .in('id', productIds)
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

    private async getOwnedProduct(productId: string, userId: string, sessionStoreId?: string): Promise<OwnedProductRow> {
        const { data: product, error } = await this.db
            .from('products')
            .select('id, store_id, price')
            .eq('id', productId)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) throw new Error(`Product lookup failed: ${error.message}`);
        if (!product) throw new NotFoundError('Product not found');

        const ownedProduct = product as OwnedProductRow;
        await this.assertStoreOwnership(ownedProduct.store_id, userId, sessionStoreId, 'Not authorized for this product');
        return ownedProduct;
    }

    private async assertProductQuota(storeId: string): Promise<void> {
        const entitlements = await new SaasExecutionAdapter(this.db).resolveEntitlements(storeId);
        const rawLimit = entitlements.limits.products;
        if (rawLimit === null || rawLimit === undefined) return;
        const productLimit = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);

        if (!Number.isFinite(productLimit)) return;

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
