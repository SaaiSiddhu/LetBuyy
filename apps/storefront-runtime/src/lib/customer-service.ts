// ============================================================
// CUSTOMER SERVICE — Core customer management operations
// Handles customer CRUD, password management, wishlist, and stats
// ============================================================

import 'server-only';
import { readWorkerJson, workerFetch } from './worker-client';

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
    addresses: Address[];
    tags: string[];
    notes: string | null;
    acceptsMarketing: boolean;
    lastOrderAt: string | null;
    lastLoginAt: string | null;
    loginCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface Address {
    id?: string;
    label?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean;
}

type WorkerPayload<T> = {
    data?: T;
};

function getWorkerData<T>(payload: unknown): T {
    const data = (payload as WorkerPayload<T>).data;
    if (!data) {
        throw new Error('Worker response did not include data');
    }
    return data;
}

// ============================================================
// FIND OR CREATE CUSTOMER (Guest Checkout Auto-Creation)
// ============================================================

export async function findOrCreateCustomer(
    storeId: string,
    email: string,
    fullName?: string,
    phone?: string
): Promise<StoreCustomer> {
    const response = await workerFetch('/storefront/customer/find-or-create', {
        method: 'POST',
        body: JSON.stringify({
            store_id: storeId,
            email,
            full_name: fullName || null,
            phone: phone || null,
        }),
    });
    const payload = await readWorkerJson(response);
    const data = getWorkerData<{ customer: Record<string, unknown> }>(payload);

    return mapRow(data.customer);
}

// ============================================================
// GET CUSTOMER BY EMAIL
// ============================================================

export async function getCustomerByEmail(
    storeId: string,
    email: string
): Promise<StoreCustomer | null> {
    const response = await workerFetch(
        `/storefront/customer/by-email?store_id=${encodeURIComponent(storeId)}&email=${encodeURIComponent(email)}`
    );
    const payload = await readWorkerJson(response);
    const customer = payload?.data?.customer;
    return customer ? mapRow(customer) : null;
}

// ============================================================
// CHECK CUSTOMER STATUS (for account bottom sheet flow)
// ============================================================

export async function checkCustomerStatus(
    storeId: string,
    email: string
): Promise<{ exists: boolean; hasPassword: boolean; status: string }> {
    const response = await workerFetch(
        `/storefront/customer/status?store_id=${encodeURIComponent(storeId)}&email=${encodeURIComponent(email)}`
    );
    const payload = await readWorkerJson(response);
    return payload?.data || { exists: false, hasPassword: false, status: 'none' };
}

// ============================================================
// SET CUSTOMER PASSWORD (First-time password or reset)
// ============================================================

export async function setCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<void> {
    const response = await workerFetch('/storefront/customer/password', {
        method: 'POST',
        body: JSON.stringify({
            store_id: storeId,
            email,
            password,
        }),
    });
    await readWorkerJson(response);
}

// ============================================================
// VERIFY CUSTOMER PASSWORD (Login)
// ============================================================

export async function verifyCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<StoreCustomer | null> {
    const response = await workerFetch('/storefront/customer/login', {
        method: 'POST',
        body: JSON.stringify({
            store_id: storeId,
            email,
            password,
        }),
    });
    const payload = await readWorkerJson(response);
    const customer = payload?.data?.customer;
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
    const response = await workerFetch('/storefront/customer/order-stats', {
        method: 'POST',
        body: JSON.stringify({
            store_id: storeId,
            email,
            order_total: orderTotal,
            order_id: orderId,
        }),
    });
    await readWorkerJson(response);
}

// ============================================================
// WISHLIST OPERATIONS
// ============================================================

export async function getCustomerWishlist(
    customerId: string,
    storeId: string
): Promise<string[]> {
    const response = await workerFetch(
        `/storefront/customer/wishlist?customer_id=${encodeURIComponent(customerId)}&store_id=${encodeURIComponent(storeId)}`
    );
    const payload = await readWorkerJson(response);
    return Array.isArray(payload?.data?.product_ids) ? payload.data.product_ids : [];
}

export async function addToWishlist(
    customerId: string,
    storeId: string,
    productId: string,
    variantId?: string
): Promise<void> {
    const response = await workerFetch('/storefront/customer/wishlist', {
        method: 'POST',
        body: JSON.stringify({
            customer_id: customerId,
            store_id: storeId,
            product_id: productId,
            variant_id: variantId || null,
        }),
    });
    await readWorkerJson(response);
}

export async function removeFromWishlist(
    customerId: string,
    productId: string,
    storeId?: string
): Promise<void> {
    if (!storeId) return;
    const response = await workerFetch('/storefront/customer/wishlist', {
        method: 'DELETE',
        body: JSON.stringify({
            customer_id: customerId,
            store_id: storeId,
            product_id: productId,
        }),
    });
    await readWorkerJson(response);
}

export async function syncWishlistFromLocal(
    customerId: string,
    storeId: string,
    productIds: string[]
): Promise<void> {
    if (!productIds.length) return;

    const response = await workerFetch('/storefront/customer/wishlist/sync', {
        method: 'POST',
        body: JSON.stringify({
            customer_id: customerId,
            store_id: storeId,
            product_ids: productIds,
        }),
    });
    await readWorkerJson(response);
}

// ============================================================
// GET CUSTOMER ORDERS
// ============================================================

export async function getCustomerOrders(
    storeId: string,
    email: string
): Promise<Record<string, unknown>[]> {
    const response = await workerFetch(
        `/storefront/customer/orders?store_id=${encodeURIComponent(storeId)}&email=${encodeURIComponent(email)}`
    );
    const payload = await readWorkerJson(response);
    return Array.isArray(payload?.data?.orders) ? payload.data.orders : [];
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
        addresses: (row.addresses as Address[]) || [],
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
