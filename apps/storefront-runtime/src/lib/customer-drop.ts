// ============================================================
// CUSTOMER DROP — builds the Liquid `customer` object for the
// authenticated shopper. Resolves the existing HS256 customer
// session (lib/session) and the existing gateway customer read
// (customer-service.getCustomerByEmail). No new auth, no new
// session model, no new backend. Anonymous shoppers receive null.
// ============================================================

import 'server-only';
import { getSession } from './session';
import { getCustomerByEmail, getCustomerWishlist, getCustomerOrders, type StoreCustomer, type StoreCustomerAddress } from './customer-service';

export interface LiquidCustomerAddressDrop {
    id: string;
    label: string | null;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
    landmark: string | null;
    full_name: string;
    is_default: boolean;
}

export interface LiquidCustomerOrderDetail {
    id: string;
    number: string;
    status: string;
    currency: string;
    created_at: string | null;
    subtotal: number;
    discount_total: number;
    shipping_total: number;
    total: number;
    payment_method: string;
    payment_status: string;
    tracking_number: string | null;
    carrier: string | null;
    line_items: Array<{
        title: string;
        quantity: number;
        price: number;
        line_price: number;
        image: string | null;
        variant: Record<string, string> | null;
    }>;
    shipping_address: {
        name: string;
        address: string;
        city: string;
        state: string;
        zip: string;
    } | null;
    timeline: Array<{ label: string; reached: boolean }>;
}

export interface LiquidCustomerOrder {
    id: string;
    number: string;
    status: string;
    total: number;
    currency: string;
    created_at: string | null;
}

export interface LiquidCustomerDrop {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    tags: string[];
    total_orders: number;
    total_spent: number;
    accepts_marketing: boolean;
    default_address: LiquidCustomerAddressDrop | null;
    addresses: LiquidCustomerAddressDrop[];
    wishlist: string[];
    wishlist_products: unknown[];
    orders: LiquidCustomerOrder[];
}

/**
 * Resolve the Liquid `customer` drop for the current request, or null for anonymous shoppers.
 * Tenant-safe: the session's storeId must match the store being rendered, otherwise null.
 */
export async function getStorefrontCustomerDrop(
    storeId: string,
    options: { includeOrders?: boolean } = {},
): Promise<LiquidCustomerDrop | null> {
    const session = await getSession();
    if (!session?.email || session.storeId !== storeId) return null;

    const customer = await getCustomerByEmail(storeId, session.email);
    if (!customer) return null;

    const wishlist = await getCustomerWishlist(customer.id, storeId);
    // Orders are route-scoped (fetched only on the customer-orders / customer_order routes) so the
    // global customer drop on home/product/cart/collection pages is not inflated with order history.
    const orders = options.includeOrders
        ? (await getCustomerOrders(storeId, session.email)).map(mapOrderDrop)
        : [];
    return mapCustomerDrop(customer, wishlist, orders);
}

/**
 * Fetch a single order by ID for the authenticated customer. Uses the existing customerOrders list
 * contract (there is no direct order-by-id gateway endpoint) — fetches all orders and finds the match.
 * Returns null if not found or if the customer session does not match the store.
 */
export async function getCustomerOrderDetailDrop(
    storeId: string,
    orderId: string,
): Promise<LiquidCustomerOrderDetail | null> {
    const session = await getSession();
    if (!session?.email || session.storeId !== storeId) return null;

    const rows = await getCustomerOrders(storeId, session.email);
    const row = rows.find((r) => String(r.id) === orderId);
    if (!row) return null;

    return mapOrderDetailDrop(row);
}

function mapCustomerDrop(
    customer: StoreCustomer,
    wishlist: string[],
    orders: LiquidCustomerOrder[],
): LiquidCustomerDrop {
    return {
        id: customer.id,
        name: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        tags: customer.tags,
        total_orders: customer.totalOrders,
        total_spent: customer.totalSpent,
        accepts_marketing: customer.acceptsMarketing,
        default_address: mapDefaultAddress(customer.addresses, customer.fullName),
        // D3: pass customer.fullName into each address drop so the full_name field is honest.
        addresses: customer.addresses.map((addr) => mapAddressDrop(addr, customer.fullName)),
        wishlist,
        wishlist_products: [],
        orders,
    };
}

function mapOrderDrop(order: Record<string, unknown>): LiquidCustomerOrder {
    return {
        id: String(order.id ?? ''),
        number: String(order.order_number ?? order.number ?? ''),
        status: typeof order.status === 'string' ? order.status : 'pending',
        total: Number(order.total) || 0,
        currency: typeof order.currency === 'string' ? order.currency : 'INR',
        created_at: typeof order.created_at === 'string' ? order.created_at : null,
    };
}

// D3: accept optional fullName from the parent customer record so full_name is honest.
// landmark and address2 remain null — the gateway does not return these fields.
function mapAddressDrop(addr: StoreCustomerAddress, fullName?: string | null): LiquidCustomerAddressDrop {
    return {
        id: addr.id,
        label: addr.label ?? null,
        address1: addr.address,
        address2: null,
        city: addr.city,
        province: addr.state,
        zip: addr.pincode,
        country: 'IN',
        landmark: null,
        full_name: fullName ?? '',
        is_default: addr.isDefault ?? false,
    };
}

function mapDefaultAddress(addresses: StoreCustomerAddress[], fullName?: string | null): LiquidCustomerAddressDrop | null {
    if (!addresses || addresses.length === 0) return null;

    const preferred = addresses.find((address) => address.isDefault) || addresses[0];
    return mapAddressDrop(preferred, fullName);
}

const ORDER_TIMELINE_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

function buildOrderTimeline(status: string): Array<{ label: string; reached: boolean }> {
    const reached = new Set<string>();
    for (const s of ORDER_TIMELINE_STATUSES) {
        reached.add(s);
        if (s === status) break;
    }
    return ORDER_TIMELINE_STATUSES.map((s) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        reached: reached.has(s),
    }));
}

function mapOrderDetailDrop(row: Record<string, unknown>): LiquidCustomerOrderDetail {
    const items = Array.isArray(row.items) ? row.items : [];
    const shippingAddr = row.shipping_address && typeof row.shipping_address === 'object'
        ? row.shipping_address as Record<string, unknown>
        : null;

    return {
        id: String(row.id ?? ''),
        number: String(row.order_number ?? row.number ?? ''),
        status: typeof row.status === 'string' ? row.status : 'pending',
        currency: typeof row.currency === 'string' ? row.currency : 'INR',
        created_at: typeof row.created_at === 'string' ? row.created_at : null,
        subtotal: Number(row.subtotal) || 0,
        discount_total: Number(row.discount) || 0,
        shipping_total: Number(row.shipping_cost) || 0,
        total: Number(row.total) || 0,
        payment_method: typeof row.payment_method === 'string' ? row.payment_method : 'cod',
        payment_status: typeof row.payment_status === 'string' ? row.payment_status : 'pending',
        tracking_number: typeof row.tracking_number === 'string' ? row.tracking_number : null,
        carrier: typeof row.carrier === 'string' ? row.carrier : null,
        line_items: items.map((item: Record<string, unknown>) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            const variant = item.variant && typeof item.variant === 'object' && !Array.isArray(item.variant)
                ? Object.fromEntries(
                    Object.entries(item.variant as Record<string, unknown>).map(([k, v]) => [k, String(v)])
                )
                : null;
            return {
                title: typeof item.name === 'string' ? item.name : 'Product',
                quantity: qty,
                price,
                line_price: price * qty,
                image: typeof (item.image || item.image_url) === 'string'
                    ? (item.image || item.image_url) as string
                    : null,
                variant,
            };
        }),
        shipping_address: shippingAddr ? {
            name: String(shippingAddr.customer_name ?? ''),
            address: String(shippingAddr.address ?? shippingAddr.line1 ?? ''),
            city: String(shippingAddr.city ?? ''),
            state: String(shippingAddr.state ?? ''),
            zip: String(shippingAddr.pincode ?? shippingAddr.postal_code ?? shippingAddr.zip ?? ''),
        } : null,
        timeline: buildOrderTimeline(typeof row.status === 'string' ? row.status : 'pending'),
    };
}
