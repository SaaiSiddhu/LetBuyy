// ============================================================
// CUSTOMER SERVICE — Core customer management operations
// Handles customer CRUD, password management, wishlist, and stats
// ============================================================

import 'server-only';
import { db } from './supabase';
import * as bcrypt from 'bcryptjs';

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

// ============================================================
// FIND OR CREATE CUSTOMER (Guest Checkout Auto-Creation)
// ============================================================

export async function findOrCreateCustomer(
    storeId: string,
    email: string,
    fullName?: string,
    phone?: string
): Promise<StoreCustomer> {
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing customer
    const { data: existing } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', normalizedEmail)
        .single();

    if (existing) {
        // Update name/phone if provided and currently empty
        const updates: Record<string, unknown> = {};
        if (fullName && !existing.full_name) updates.full_name = fullName;
        if (phone && !existing.phone) updates.phone = phone;

        if (Object.keys(updates).length > 0) {
            await db
                .from('store_customers')
                .update(updates)
                .eq('id', existing.id);
        }

        return mapRow(existing);
    }

    // Create new customer record
    const { data: created, error } = await db
        .from('store_customers')
        .insert({
            store_id: storeId,
            email: normalizedEmail,
            full_name: fullName || null,
            phone: phone || null,
            status: 'active',
            password_hash: null,
        })
        .select()
        .single();

    if (error || !created) {
        console.error('[CustomerService] Create failed:', error?.message);
        throw new Error(`Failed to create customer: ${error?.message}`);
    }

    // Log activity
    await logActivity(created.id, storeId, 'account_created', {
        source: 'checkout',
    });

    return mapRow(created);
}

// ============================================================
// GET CUSTOMER BY EMAIL
// ============================================================

export async function getCustomerByEmail(
    storeId: string,
    email: string
): Promise<StoreCustomer | null> {
    const { data, error } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase().trim())
        .single();

    if (error || !data) return null;
    return mapRow(data);
}

// ============================================================
// CHECK CUSTOMER STATUS (for account bottom sheet flow)
// ============================================================

export async function checkCustomerStatus(
    storeId: string,
    email: string
): Promise<{ exists: boolean; hasPassword: boolean; status: string }> {
    const { data } = await db
        .from('store_customers')
        .select('password_hash, status')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase().trim())
        .single();

    if (!data) {
        return { exists: false, hasPassword: false, status: 'none' };
    }

    return {
        exists: true,
        hasPassword: !!data.password_hash,
        status: data.status,
    };
}

// ============================================================
// SET CUSTOMER PASSWORD (First-time password or reset)
// ============================================================

export async function setCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await db
        .from('store_customers')
        .update({
            password_hash: hashedPassword,
            status: 'active',
        })
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase().trim())
        .select('id')
        .single();

    if (error || !data) {
        throw new Error(`Failed to set password: ${error?.message || 'Customer not found'}`);
    }

    await logActivity(data.id, storeId, 'password_set', {});
}

// ============================================================
// VERIFY CUSTOMER PASSWORD (Login)
// ============================================================

export async function verifyCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<StoreCustomer | null> {
    const { data, error } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase().trim())
        .single();

    if (error || !data || !data.password_hash) {
        return null;
    }

    // Check account status
    if (data.status === 'disabled') {
        throw new Error('Account is disabled. Contact the store for assistance.');
    }

    const isValid = await bcrypt.compare(password, data.password_hash);

    if (!isValid) {
        return null;
    }

    // Update login tracking
    await db
        .from('store_customers')
        .update({
            last_login_at: new Date().toISOString(),
            login_count: (data.login_count || 0) + 1,
        })
        .eq('id', data.id);

    await logActivity(data.id, storeId, 'login', {
        method: 'password',
    });

    return mapRow(data);
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
    const { data: customer } = await db
        .from('store_customers')
        .select('id, total_orders, total_spent')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase().trim())
        .single();

    if (!customer) return;

    await db
        .from('store_customers')
        .update({
            total_orders: (customer.total_orders || 0) + 1,
            total_spent: Number(customer.total_spent || 0) + orderTotal,
            last_order_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

    await logActivity(customer.id, storeId, 'order_placed', {
        orderId,
        orderTotal,
    });
}

// ============================================================
// WISHLIST OPERATIONS
// ============================================================

export async function getCustomerWishlist(
    customerId: string,
    storeId: string
): Promise<string[]> {
    const { data } = await db
        .from('customer_wishlists')
        .select('product_id')
        .eq('customer_id', customerId)
        .eq('store_id', storeId);

    return (data || []).map(r => r.product_id);
}

export async function addToWishlist(
    customerId: string,
    storeId: string,
    productId: string,
    variantId?: string
): Promise<void> {
    await db.from('customer_wishlists').upsert(
        {
            customer_id: customerId,
            store_id: storeId,
            product_id: productId,
            variant_id: variantId || null,
        },
        { onConflict: 'customer_id,product_id' }
    );
}

export async function removeFromWishlist(
    customerId: string,
    productId: string
): Promise<void> {
    await db
        .from('customer_wishlists')
        .delete()
        .eq('customer_id', customerId)
        .eq('product_id', productId);
}

export async function syncWishlistFromLocal(
    customerId: string,
    storeId: string,
    productIds: string[]
): Promise<void> {
    if (!productIds.length) return;

    const rows = productIds.map(productId => ({
        customer_id: customerId,
        store_id: storeId,
        product_id: productId,
    }));

    await db.from('customer_wishlists').upsert(rows, {
        onConflict: 'customer_id,product_id',
    });
}

// ============================================================
// GET CUSTOMER ORDERS
// ============================================================

export async function getCustomerOrders(
    storeId: string,
    email: string
): Promise<Record<string, unknown>[]> {
    const { data, error } = await db
        .from('orders')
        .select('id, order_number, status, total, created_at, items')
        .eq('store_id', storeId)
        .eq('customer_email', email.toLowerCase().trim())
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[CustomerService] Orders fetch failed:', error.message);
        return [];
    }

    return data || [];
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
    let query = db
        .from('store_customers')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

    if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
    }

    if (options?.search) {
        query = query.or(
            `full_name.ilike.%${options.search}%,email.ilike.%${options.search}%`
        );
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    if (options?.offset) {
        query = query.range(
            options.offset,
            options.offset + (options?.limit || 50) - 1
        );
    }

    const { data, count, error } = await query;

    if (error) {
        console.error('[CustomerService] Admin fetch failed:', error.message);
        return { customers: [], total: 0 };
    }

    return {
        customers: (data || []).map(mapRow),
        total: count || 0,
    };
}

// ============================================================
// ACTIVITY LOGGING
// ============================================================

async function logActivity(
    customerId: string,
    storeId: string,
    activityType: string,
    metadata: Record<string, unknown>
): Promise<void> {
    try {
        await db.from('customer_activity_log').insert({
            customer_id: customerId,
            store_id: storeId,
            activity_type: activityType,
            metadata,
        });
    } catch (err) {
        // Don't fail operations if logging fails
        console.warn('[CustomerService] Activity log failed:', err);
    }
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
