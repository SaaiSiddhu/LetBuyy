// ============================================================
// CUSTOMER SERVICE — Core customer management operations
// Handles customer CRUD, password management, wishlist, and stats
// ============================================================

import 'server-only';
import type { CustomerAddress } from '@letbuyy/shared-types';
import { createStorefrontApiClient } from './api/client';

// ============================================================
// Types
// ============================================================

export interface StoreCustomer {
    id: string;
    storeId: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    status: 'active' | 'disabled' | 'guest';
    hasPassword: boolean;
    totalOrders: number;
    totalSpent: number;
    addresses: StoreCustomerAddress[];
    tags: string[];
    notes: string | null;
    acceptsMarketing: boolean;
    lastOrderAt: string | null;
    lastLoginAt: string | null;
    loginCount: number;
    createdAt: string;
    updatedAt: string;
}

export type StoreCustomerAddress = Pick<CustomerAddress, 'id' | 'city' | 'state'> & {
    label?: string | null;
    address: string;
    pincode: string;
    isDefault?: boolean;
};

// ============================================================
// FIND OR CREATE CUSTOMER (Guest Checkout Auto-Creation)
// ============================================================

export async function findOrCreateCustomer(
    storeId: string,
    email: string,
    fullName?: string,
    phone?: string
): Promise<StoreCustomer> {
    const data = await createStorefrontApiClient()
        .storefront
        .findOrCreateCustomer({
            store_id: storeId,
            email,
            full_name: fullName || null,
            phone: phone || null,
        });

    if (!data.customer) {
        throw new Error('Worker response did not include customer');
    }

    return mapRow(data.customer);
}

// ============================================================
// GET CUSTOMER BY EMAIL
// ============================================================

export async function getCustomerByEmail(
    storeId: string,
    email: string
): Promise<StoreCustomer | null> {
    const { customer } = await createStorefrontApiClient()
        .storefront
        .customerByEmail({ store_id: storeId, email });
    return customer ? mapRow(customer) : null;
}

// ============================================================
// CHECK CUSTOMER STATUS (for account bottom sheet flow)
// ============================================================

export async function checkCustomerStatus(
    storeId: string,
    email: string
): Promise<{ exists: boolean; hasPassword: boolean; status: string }> {
    return createStorefrontApiClient()
        .storefront
        .customerStatus({ store_id: storeId, email });
}

// ============================================================
// SET CUSTOMER PASSWORD (First-time password or reset)
// ============================================================

export async function setCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<void> {
    await createStorefrontApiClient()
        .storefront
        .setCustomerPassword({
            store_id: storeId,
            email,
            password,
        });
}

// ============================================================
// VERIFY CUSTOMER PASSWORD (Login)
// ============================================================

export async function verifyCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<StoreCustomer | null> {
    const { customer } = await createStorefrontApiClient()
        .storefront
        .verifyCustomerPassword({
            store_id: storeId,
            email,
            password,
        });
    return customer ? mapRow(customer) : null;
}

// ============================================================
// UPDATE CUSTOMER STATS (After order completion)
// ============================================================

export async function updateCustomerStats(
    storeId: string,
    email: string,
    orderTotal: number,
    orderId: string
): Promise<void> {
    await createStorefrontApiClient()
        .storefront
        .updateCustomerStats({
            store_id: storeId,
            email,
            order_total: orderTotal,
            order_id: orderId,
        });
}

// ============================================================
// WISHLIST OPERATIONS
// ============================================================

export async function getCustomerWishlist(
    customerId: string,
    storeId: string
): Promise<string[]> {
    const data = await createStorefrontApiClient()
        .storefront
        .customerWishlist({ customer_id: customerId, store_id: storeId });
    return Array.isArray(data.product_ids) ? data.product_ids : [];
}

export async function addToWishlist(
    customerId: string,
    storeId: string,
    productId: string,
    variantId?: string
): Promise<void> {
    await createStorefrontApiClient()
        .storefront
        .addCustomerWishlistItem({
            customer_id: customerId,
            store_id: storeId,
            product_id: productId,
            variant_id: variantId || null,
        });
}

export async function removeFromWishlist(
    customerId: string,
    productId: string,
    storeId?: string
): Promise<void> {
    if (!storeId) return;
    await createStorefrontApiClient()
        .storefront
        .removeCustomerWishlistItem({
            customer_id: customerId,
            store_id: storeId,
            product_id: productId,
        });
}

export async function syncWishlistFromLocal(
    customerId: string,
    storeId: string,
    productIds: string[]
): Promise<void> {
    if (!productIds.length) return;

    await createStorefrontApiClient()
        .storefront
        .syncCustomerWishlist({
            customer_id: customerId,
            store_id: storeId,
            product_ids: productIds,
        });
}

// ============================================================
// GET CUSTOMER ORDERS
// ============================================================

export async function getCustomerOrders(
    storeId: string,
    email: string
): Promise<Record<string, unknown>[]> {
    const data = await createStorefrontApiClient()
        .storefront
        .customerOrders({ store_id: storeId, email });
    return Array.isArray(data.orders) ? data.orders : [];
}

// ============================================================
// ADMIN: GET STORE CUSTOMERS (for admin customers page)
// ============================================================

export async function getStoreCustomers(
    storeId: string,
    options?: {
        search?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }
): Promise<{ customers: StoreCustomer[]; total: number }> {
    void storeId;
    void options;
    return { customers: [], total: 0 };
}

// ============================================================
// ROW MAPPER
// ============================================================

function mapRow(row: Record<string, unknown>): StoreCustomer {
    return {
        id: row.id as string,
        storeId: row.store_id as string,
        email: row.email as string,
        fullName: (row.full_name as string) || null,
        phone: (row.phone as string) || null,
        status: (row.status as 'active' | 'disabled' | 'guest') || 'active',
        hasPassword: !!(row.password_hash),
        totalOrders: (row.total_orders as number) || 0,
        totalSpent: Number(row.total_spent) || 0,
        addresses: (row.addresses as StoreCustomerAddress[]) || [],
        tags: (row.tags as string[]) || [],
        notes: (row.notes as string) || null,
        acceptsMarketing: (row.accepts_marketing as boolean) || false,
        lastOrderAt: (row.last_order_at as string) || null,
        lastLoginAt: (row.last_login_at as string) || null,
        loginCount: (row.login_count as number) || 0,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}
