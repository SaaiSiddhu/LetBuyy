import 'server-only';

import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSessionForRender } from '@/lib/buyer-auth/data-session';
import { mapOrderDetailDrop, type LiquidCustomerOrderDetail, type LiquidCustomerOrder } from '@/lib/customer-drop';

export interface LiquidBuyerDrop {
    email: string;
    email_verified?: boolean;
    full_name?: string | null;
    phone?: string | null;
    addresses?: Array<Record<string, unknown>>;
    orders: LiquidCustomerOrder[];
    has_more: boolean;
    next_cursor: string | null;
}

export async function getStorefrontBuyerAccountDrop(
    storeId: string,
): Promise<{ buyer: LiquidBuyerDrop | null; unavailable: boolean }> {
    const session = await resolveBuyerDataSessionForRender(storeId);
    if (!session) return { buyer: null, unavailable: false };
    if ('unavailable' in session) return { buyer: null, unavailable: true };

    try {
        const query = `?store_id=${encodeURIComponent(session.siteId)}`;
        const [profileResponse, addressesResponse] = await Promise.all([
            storefrontApiFetch(`/storefront/buyer/profile${query}`, { method: 'GET', headers: session.headers, cache: 'no-store' }),
            storefrontApiFetch(`/storefront/buyer/addresses${query}`, { method: 'GET', headers: session.headers, cache: 'no-store' }),
        ]);
        if ([profileResponse, addressesResponse].some((response) => response.status === 401 || response.status === 403)) {
            return { buyer: null, unavailable: false };
        }
        if (!profileResponse.ok || !addressesResponse.ok) return { buyer: null, unavailable: true };

        const [profileBody, addressesBody] = await Promise.all([
            profileResponse.json().catch(() => null) as Promise<{ data?: { buyer?: Record<string, unknown> } } | null>,
            addressesResponse.json().catch(() => null) as Promise<{ data?: { addresses?: Array<Record<string, unknown>> } } | null>,
        ]);
        const profile = profileBody?.data?.buyer;
        if (!profile || typeof profile.email !== 'string' || !profile.email) return { buyer: null, unavailable: true };
        const addresses = Array.isArray(addressesBody?.data?.addresses) ? addressesBody.data.addresses.map((address) => ({
            id: address.id,
            label: address.label,
            full_name: address.full_name,
            phone: address.phone,
            address_line1: address.address_line1,
            address_line2: address.address_line2,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country,
            landmark: address.landmark,
            is_default: address.is_default,
        })) : [];

        return {
            buyer: {
                email: profile.email,
                email_verified: profile.email_verified === true,
                full_name: typeof profile.full_name === 'string' ? profile.full_name : null,
                phone: typeof profile.phone === 'string' ? profile.phone : null,
                addresses,
                orders: [],
                has_more: false,
                next_cursor: null,
            },
            unavailable: false,
        };
    } catch {
        return { buyer: null, unavailable: true };
    }
}

export async function getStorefrontBuyerOrderDrop(
    storeId: string,
    orderId?: string,
    cursor?: string,
): Promise<{ buyer: LiquidBuyerDrop | null; order: LiquidCustomerOrderDetail | null; unavailable: boolean } | null> {
    const session = await resolveBuyerDataSessionForRender(storeId);
    if (!session) return null;
    if ('unavailable' in session) return { buyer: null, order: null, unavailable: true };
    try {
        const profileResponse = await storefrontApiFetch(`/storefront/buyer/profile?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
        if (profileResponse.status === 401 || profileResponse.status === 403) return null;
        if (!profileResponse.ok) return { buyer: null, order: null, unavailable: true };
        const profile = await profileResponse.json().catch(() => null) as { data?: { buyer?: { email?: unknown } } } | null;
        const email = profile?.data?.buyer?.email;
        if (typeof email !== 'string' || !email) return { buyer: null, order: null, unavailable: true };

        if (orderId) {
            const detailResponse = await storefrontApiFetch(`/storefront/buyer/storefront-orders/${encodeURIComponent(orderId)}?store_id=${encodeURIComponent(session.siteId)}`, {
                method: 'GET', headers: session.headers, cache: 'no-store',
            });
            if (detailResponse.status === 401 || detailResponse.status === 403) return null;
            if (detailResponse.status >= 500) return { buyer: { email, orders: [], has_more: false, next_cursor: null }, order: null, unavailable: true };
            if (!detailResponse.ok) return { buyer: { email, orders: [], has_more: false, next_cursor: null }, order: null, unavailable: false };
            const body = await detailResponse.json().catch(() => null) as { data?: { order?: Record<string, unknown> } } | null;
            if (!body?.data?.order || body.data.order.id !== orderId) return { buyer: { email, orders: [], has_more: false, next_cursor: null }, order: null, unavailable: false };
            const detail = mapOrderDetailDrop(body.data.order);
            return { buyer: { email, orders: [], has_more: false, next_cursor: null }, order: detail, unavailable: false };
        }

        const query = new URLSearchParams({ store_id: session.siteId, limit: '20' });
        if (cursor) query.set('cursor', cursor);
        const ordersResponse = await storefrontApiFetch(`/storefront/buyer/storefront-orders?${query}`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
        if (ordersResponse.status === 401 || ordersResponse.status === 403) return null;
        if (!ordersResponse.ok) return { buyer: { email, orders: [], has_more: false, next_cursor: null }, order: null, unavailable: true };
        const ordersBody = await ordersResponse.json().catch(() => null) as { data?: { orders?: Array<Record<string, unknown>>; next_cursor?: unknown; has_more?: unknown } } | null;
        if (!Array.isArray(ordersBody?.data?.orders)) return { buyer: { email, orders: [], has_more: false, next_cursor: null }, order: null, unavailable: true };
        const orders = ordersBody.data.orders.map((row) => ({
            id: String(row.id ?? ''),
            number: String(row.order_number ?? ''),
            status: typeof row.status === 'string' ? row.status : 'pending',
            total: Number(row.total) || 0,
            currency: typeof row.currency === 'string' ? row.currency : 'INR',
            created_at: typeof row.created_at === 'string' ? row.created_at : null,
        }));
        return { buyer: { email, orders, has_more: ordersBody.data.has_more === true, next_cursor: typeof ordersBody.data.next_cursor === 'string' ? ordersBody.data.next_cursor : null }, order: null, unavailable: false };
    } catch {
        return { buyer: null, order: null, unavailable: true };
    }
}
