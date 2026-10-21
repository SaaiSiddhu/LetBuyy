'use client';

import { readStorefrontApiJson, storefrontBrowserApiFetch } from '@/lib/api/browser-client';

export const CART_RETIRED_EVENT = 'letbuyy:cart:retired';
export type CartReconciliation = 'ready' | 'retired' | 'unavailable';
const TOKEN_KEY = 'lb_cart_token';
const ITEMS_KEY = 'lb_cart';
const SERVER_KEY = 'lb_cart_server';
const inFlight = new Map<string, Promise<CartReconciliation>>();

type CheckoutReceipt = {
    cart_status?: string;
    checkout_state?: string | null;
    order?: { id?: string };
};

/** Tenant storage cannot be cleared by the separate hosted-checkout origin.
 * Only the capability-bound committed receipt retires its own unchanged cache.
 * Unknown/pending results never invent a new purchase or discard a draft.
 * Deduplication lasts only for the in-flight read, not across navigation/commands. */
export function reconcileStoredCart(subdomain: string): Promise<CartReconciliation> | null {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const items = window.localStorage.getItem(ITEMS_KEY);
    const server = window.localStorage.getItem(SERVER_KEY);
    const key = JSON.stringify([subdomain, token, items, server]);
    const current = inFlight.get(key);
    if (current) return current;
    const read = (async (): Promise<CartReconciliation> => {
        try {
            const response = await storefrontBrowserApiFetch(subdomain, `/cart/${encodeURIComponent(token)}/checkout-status`);
            const payload = await readStorefrontApiJson<CheckoutReceipt>(response);
            if (!response.ok || !payload.success || !payload.data) return 'unavailable';
            // Another tab or a later local edit owns its new state, even if our
            // old request has a successful committed receipt.
            if (window.localStorage.getItem(TOKEN_KEY) !== token
                || window.localStorage.getItem(ITEMS_KEY) !== items
                || window.localStorage.getItem(SERVER_KEY) !== server) return 'unavailable';
            const receipt = payload.data;
            if (receipt.cart_status === 'active' && receipt.checkout_state !== 'completed') return 'ready';
            if (receipt.cart_status !== 'converted' || receipt.checkout_state !== 'completed'
                || typeof receipt.order?.id !== 'string' || !receipt.order.id.trim()) return 'unavailable';
            window.localStorage.removeItem(TOKEN_KEY);
            window.localStorage.removeItem(SERVER_KEY);
            window.localStorage.setItem(ITEMS_KEY, '[]');
            window.dispatchEvent(new CustomEvent(CART_RETIRED_EVENT));
            window.dispatchEvent(new CustomEvent('letbuyy:cart:changed', { detail: { items: [] } }));
            return 'retired';
        } catch {
            return 'unavailable';
        }
    })();
    inFlight.set(key, read);
    void read.finally(() => { if (inFlight.get(key) === read) inFlight.delete(key); });
    return read;
}
