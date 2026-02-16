// ============================================================
// ORDER SERVICE — Supabase Implementation
// Handles order creation, retrieval, and customer authentication
// ============================================================

import { db } from './supabase';
import { OrderModel, OrderItem, OrderCustomer, OrderPricing, OrderPayment, OrderStatus, ShippingAddress } from '@/types/store';
import * as bcrypt from 'bcryptjs';

// ============================================================
// IN-MEMORY FALLBACK (when Supabase is not configured)
// ============================================================
const inMemoryOrders = new Map<string, Record<string, unknown>>();

// ============================================================
// ORDER CREATION
// ============================================================

interface CreateOrderParams {
    storeId: string;
    sellerId: string;
    subdomain: string;
    customer: OrderCustomer;
    items: OrderItem[];
    pricing: OrderPricing;
    paymentMethod: 'razorpay' | 'stripe' | 'paypal' | 'cod';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    stripeSessionId?: string;
    paypalOrderId?: string;
}

export async function createOrder(params: CreateOrderParams): Promise<OrderModel> {
    const orderNumber = await generateOrderNumber(params.storeId);

    const orderData = {
        store_id: params.storeId,
        order_number: orderNumber,
        customer_email: params.customer.email,
        customer_name: params.customer.name,
        customer_phone: params.customer.phone,
        shipping_address: params.customer.address,
        items: params.items,
        subtotal: params.pricing.subtotal,
        shipping_cost: params.pricing.deliveryCharge || 0,
        tax: 0,
        discount: params.pricing.discount || 0,
        total: params.pricing.total,
        payment_method: params.paymentMethod,
        payment_id: params.razorpayPaymentId || params.stripeSessionId || params.paypalOrderId || null,
        status: params.paymentMethod === 'cod' ? 'confirmed' : 'pending',
        payment_status: params.razorpayPaymentId ? 'paid' : 'pending',
    };

    // --- In-memory fallback when Supabase isn't configured ---
    if (!db) {
        const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const row = { id, ...orderData, created_at: new Date().toISOString() };
        inMemoryOrders.set(id, row);
        console.log(`[OrderService] ⚡ Dev mode — order saved in-memory: ${id} (${orderNumber})`);
        return mapOrderRow(row, params.subdomain, params.sellerId);
    }

    // --- Normal Supabase flow ---
    const { data, error } = await db
        .from('orders')
        .insert(orderData)
        .select()
        .single();

    if (error || !data) {
        console.error('[OrderService] Create failed:', error?.message);
        throw new Error(`Failed to create order: ${error?.message}`);
    }

    // Also insert normalized order items
    if (params.items.length > 0) {
        const itemRows = params.items.map((item: OrderItem) => ({
            order_id: data.id,
            product_id: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price,
        }));

        await db.from('order_items').insert(itemRows);
    }

    return mapOrderRow(data, params.subdomain, params.sellerId);
}

async function generateOrderNumber(_storeId: string): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${dateStr}-${rand}`;
}

// ============================================================
// ORDER RETRIEVAL
// ============================================================

export async function getOrderById(orderId: string): Promise<OrderModel | null> {
    // Dev fallback: look up in-memory orders
    if (!db) {
        const row = inMemoryOrders.get(orderId);
        if (!row) return null;
        return mapOrderRow(row, 'demo', 'dev-seller');
    }

    const { data, error } = await db
        .from('orders')
        .select('*, stores!inner(subdomain, user_id)')
        .eq('id', orderId)
        .single();

    if (error || !data) return null;
    const store = data.stores as { subdomain: string; user_id: string };
    return mapOrderRow(data, store.subdomain, store.user_id);
}

export async function getOrdersByContact(
    subdomain: string,
    emailOrPhone: string
): Promise<OrderModel[]> {
    // Dev fallback
    if (!db) {
        const results: OrderModel[] = [];
        for (const row of inMemoryOrders.values()) {
            if (row.customer_email === emailOrPhone || row.customer_phone === emailOrPhone) {
                results.push(mapOrderRow(row, subdomain, 'dev-seller'));
            }
        }
        return results;
    }

    // First get store_id from subdomain
    const { data: store } = await db
        .from('stores')
        .select('id, user_id')
        .eq('subdomain', subdomain)
        .single();

    if (!store) return [];

    // Query by email or phone
    let query = db
        .from('orders')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

    // Check if it's an email or phone
    if (emailOrPhone.includes('@')) {
        query = query.eq('customer_email', emailOrPhone);
    } else {
        query = query.eq('customer_phone', emailOrPhone);
    }

    const { data, error } = await query;

    if (error || !data) return [];
    return data.map((row: Record<string, unknown>) => mapOrderRow(row, subdomain, store.user_id));
}

export async function getSellerOrders(
    sellerId: string,
    status?: OrderStatus
): Promise<OrderModel[]> {
    // Dev fallback
    if (!db) return [];

    // Get all stores for this seller
    const { data: stores } = await db
        .from('stores')
        .select('id, subdomain')
        .eq('user_id', sellerId);

    if (!stores || stores.length === 0) return [];
    const storeIds = stores.map((s: { id: string }) => s.id);
    const subdomainMap = new Map<string, string>(stores.map((s: { id: string; subdomain: string }) => [s.id, s.subdomain]));

    let query = db
        .from('orders')
        .select('*')
        .in('store_id', storeIds)
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: Record<string, unknown>) =>
        mapOrderRow(row, subdomainMap.get(row.store_id as string) || '', sellerId)
    );
}

// ============================================================
// ORDER STATUS UPDATES
// ============================================================

export async function updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    trackingNumber?: string,
    trackingCarrier?: string
): Promise<void> {
    const updates: Record<string, unknown> = { status };

    if (trackingNumber) updates.tracking_number = trackingNumber;
    if (trackingCarrier) updates.carrier = trackingCarrier;

    if (status === 'delivered') {
        updates.payment_status = 'paid';
    } else if (status === 'cancelled') {
        updates.payment_status = 'refunded';
    }

    // Dev fallback
    if (!db) {
        const row = inMemoryOrders.get(orderId);
        if (row) Object.assign(row, updates);
        console.log(`[OrderService] ⚡ Dev mode — order ${orderId} updated:`, updates);
        return;
    }

    const { error } = await db
        .from('orders')
        .update(updates)
        .eq('id', orderId);

    if (error) {
        console.error('[OrderService] Status update failed:', error.message);
        throw new Error(`Failed to update order: ${error.message}`);
    }
}

// ============================================================
// CUSTOMER AUTHENTICATION
// ============================================================

export async function checkCustomerExists(emailOrPhone: string): Promise<boolean> {
    // Dev fallback
    if (!db) {
        for (const row of inMemoryOrders.values()) {
            if (row.customer_email === emailOrPhone || row.customer_phone === emailOrPhone) return true;
        }
        return false;
    }

    const { data } = await db
        .from('orders')
        .select('customer_email')
        .or(`customer_email.eq.${emailOrPhone},customer_phone.eq.${emailOrPhone}`)
        .limit(1);

    return (data && data.length > 0) || false;
}

export async function setCustomerPassword(
    emailOrPhone: string,
    password: string,
    storeId?: string
): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!db) {
        console.log(`[OrderService] Password set for ${emailOrPhone} (in-memory, no DB)`);
        return;
    }

    // Upsert: insert or update the customer's password
    const { error } = await db
        .from('customer_credentials')
        .upsert(
            {
                store_id: storeId,
                email_or_phone: emailOrPhone,
                password_hash: hashedPassword,
            },
            { onConflict: 'store_id,email_or_phone' }
        );

    if (error) {
        console.error('[OrderService] Error setting customer password:', error.message);
        throw new Error('Failed to set password');
    }
}

export async function verifyCustomerPassword(
    emailOrPhone: string,
    password: string,
    storeId?: string
): Promise<boolean> {
    if (!db) {
        console.log(`[OrderService] Verify password for ${emailOrPhone} (no DB)`);
        return false;
    }

    let query = db
        .from('customer_credentials')
        .select('password_hash')
        .eq('email_or_phone', emailOrPhone);

    if (storeId) {
        query = query.eq('store_id', storeId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
        return false;
    }

    const isValid = await bcrypt.compare(password, data.password_hash);

    // Update login metadata on success
    if (isValid && storeId) {
        await db
            .from('customer_credentials')
            .update({
                last_login_at: new Date().toISOString(),
            })
            .eq('store_id', storeId)
            .eq('email_or_phone', emailOrPhone);
    }

    return isValid;
}

export async function hasOrdersForContact(
    subdomain: string,
    emailOrPhone: string
): Promise<boolean> {
    const orders = await getOrdersByContact(subdomain, emailOrPhone);
    return orders.length > 0;
}

// ============================================================
// HELPERS
// ============================================================

function mapOrderRow(
    data: Record<string, unknown>,
    subdomain: string,
    sellerId: string
): OrderModel {
    const shippingAddr = (data.shipping_address as Record<string, string>) || {};

    const address: ShippingAddress = {
        address: shippingAddr.address || shippingAddr.line1 || '',
        city: shippingAddr.city || '',
        state: shippingAddr.state || '',
        pincode: shippingAddr.pincode || shippingAddr.postal_code || '',
    };

    const pricing: OrderPricing = {
        subtotal: Number(data.subtotal) || 0,
        deliveryCharge: Number(data.shipping_cost) || 0,
        discount: Number(data.discount) || 0,
        total: Number(data.total) || 0,
    };

    const payment: OrderPayment = {
        method: (data.payment_method as 'razorpay' | 'stripe' | 'paypal' | 'cod') || 'cod',
        status: (data.payment_status as 'pending' | 'paid' | 'failed' | 'refunded') || 'pending',
        razorpayPaymentId: data.payment_method === 'razorpay' ? (data.payment_id as string) : undefined,
        stripeSessionId: data.payment_method === 'stripe' ? (data.payment_id as string) : undefined,
        paypalOrderId: data.payment_method === 'paypal' ? (data.payment_id as string) : undefined,
    };

    return {
        id: data.id as string,
        storeId: data.store_id as string,
        sellerId,
        subdomain,
        orderNumber: data.order_number as string,
        customer: {
            name: (data.customer_name as string) || '',
            email: (data.customer_email as string) || '',
            phone: (data.customer_phone as string) || '',
            address,
        },
        items: (data.items as OrderItem[]) || [],
        pricing,
        payment,
        status: data.status as OrderStatus,
        tracking: data.tracking_number ? {
            number: data.tracking_number as string,
            carrier: data.carrier as string,
        } : undefined,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}
