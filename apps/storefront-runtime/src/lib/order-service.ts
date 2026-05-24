// ============================================================
// ORDER SERVICE — Storefront read/customer helpers.
// Order creation and payment mutation flows are owned by the Hono worker.
// ============================================================

import { OrderModel, OrderItem, OrderPricing, OrderPayment, OrderStatus, ShippingAddress } from '@/types/store';
import { readWorkerJson, workerFetch } from './worker-client';

// ============================================================
// ORDER RETRIEVAL
// ============================================================

export async function getOrderById(orderId: string): Promise<OrderModel | null> {
    void orderId;
    throw new Error('Direct order lookup requires a store-scoped worker endpoint');
}

export async function getOrdersByContact(
    subdomain: string,
    emailOrPhone: string
): Promise<OrderModel[]> {
    const summary = await getOrderContactSummary(subdomain, emailOrPhone);
    return summary.orders;
}

export async function getOrderContactSummary(
    subdomain: string,
    emailOrPhone: string
): Promise<{ orders: OrderModel[]; hasOrders: boolean; hasPassword: boolean }> {
    const response = await workerFetch(
        `/storefront/${encodeURIComponent(subdomain)}/orders/contact?contact=${encodeURIComponent(emailOrPhone)}`
    );
    const payload = await readWorkerJson(response);
    const data = payload?.data || {};
    const rows = Array.isArray(data.orders) ? data.orders : [];

    return {
        orders: rows.map((row: Record<string, unknown>) => mapOrderRow(row, subdomain, '')),
        hasOrders: Boolean(data.hasOrders),
        hasPassword: Boolean(data.hasPassword),
    };
}

export async function getSellerOrders(
    sellerId: string,
    status?: OrderStatus
): Promise<OrderModel[]> {
    void sellerId;
    void status;
    throw new Error('Seller order reads must use the authenticated admin worker API');
}

// ============================================================
// CUSTOMER AUTHENTICATION
// ============================================================

export async function checkCustomerExists(emailOrPhone: string): Promise<boolean> {
    void emailOrPhone;
    throw new Error('Customer existence checks require a store-scoped worker endpoint');
}

export async function setCustomerPassword(
    emailOrPhone: string,
    password: string,
    storeId?: string,
    subdomain?: string
): Promise<void> {
    const response = await workerFetch('/storefront/customer/order-credential', {
        method: 'POST',
        body: JSON.stringify({
            store_id: storeId,
            subdomain,
            email_or_phone: emailOrPhone,
            password,
        }),
    });
    await readWorkerJson(response);
}

export async function verifyCustomerPassword(
    emailOrPhone: string,
    password: string,
    storeId?: string,
    subdomain?: string
): Promise<boolean> {
    const response = await workerFetch('/storefront/customer/order-credential/login', {
        method: 'POST',
        body: JSON.stringify({
            store_id: storeId,
            subdomain,
            email_or_phone: emailOrPhone,
            password,
        }),
    });
    const payload = await readWorkerJson(response);
    return Boolean(payload?.data?.valid);
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
    const shippingAddr = asRecord(data.shipping_address);

    const address: ShippingAddress = {
        address: asText(shippingAddr.address || shippingAddr.line1),
        city: asText(shippingAddr.city),
        state: asText(shippingAddr.state),
        pincode: asText(shippingAddr.pincode || shippingAddr.postal_code || shippingAddr.zip),
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

    const items = Array.isArray(data.items) ? data.items.map(mapOrderItem) : [];

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
        items,
        pricing,
        payment,
        status: toOrderStatus(data.status),
        tracking: data.tracking_number ? {
            number: data.tracking_number as string,
            carrier: data.carrier as string,
        } : undefined,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}

function mapOrderItem(value: unknown): OrderItem {
    const item = asRecord(value);

    return {
        productId: asText(item.productId || item.product_id),
        name: asText(item.name),
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0,
        image: asText(item.image || item.image_url || item.thumbnail_url),
        variant: asTextRecord(item.variant),
    };
}

function toOrderStatus(value: unknown): OrderStatus {
    const status = asText(value);
    if (
        status === 'pending' ||
        status === 'confirmed' ||
        status === 'processing' ||
        status === 'shipped' ||
        status === 'delivered' ||
        status === 'cancelled' ||
        status === 'refunded'
    ) {
        return status;
    }

    return 'pending';
}

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return {};
        }
    }

    return {};
}

function asText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
}

function asTextRecord(value: unknown): Record<string, string> | undefined {
    const record = asRecord(value);
    const entries = Object.entries(record)
        .map(([key, entryValue]) => [key, asText(entryValue)] as const)
        .filter(([, entryValue]) => entryValue);

    return entries.length ? Object.fromEntries(entries) : undefined;
}
