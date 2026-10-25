'use client';

import { StorefrontCartRevisionSchema, type CartItem, type StorefrontCartLineInput } from '@letbuyy/checkout-core';
import { CART_RETIRED_EVENT, reconcileStoredCart } from '@/lib/checkout/cart-lifecycle';
import type { ProductModel } from '@letbuyy/commerce-core';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    readStorefrontApiJson,
    storefrontApiErrorMessage,
    storefrontBrowserApiFetch,
} from '@/lib/api/browser-client';

export interface CartContextType {
    items: CartItem[];
    addToCart: (product: ProductModel, variantContext?: CartVariantContext) => void;
    removeFromCart: (productId: string, variantId?: string | null) => void;
    updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
    clearCart: () => void;
    cartTotal: number;
    cartCount: number;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    // T10/W2 — the server explicitly REJECTED the last cart write (a validation error, not a
    // network outage). Distinct from silence: a shopper's cart can now diverge from the server
    // without ever being told, which is exactly the failure mode this field exists to close. Null
    // means the last sync (if any) succeeded, or none has been attempted yet.
    syncError: string | null;
}

export interface CartVariantContext {
    variantId: string | null;
    variantTitle?: string;
    price: number;
    comparePrice?: number | null;
}

type ServerCartLine = {
    id?: string;
    marketplace_listing_id?: string;
    personalization?: StorefrontCartLineInput['personalization'];
    product_id: string;
    variant_id?: string | null;
    title: string;
    image_url?: string | null;
    quantity: number;
    unit_price: number;
    compare_price?: number | null;
    currency: string;
    properties?: Record<string, unknown>;
};

type ServerCart = {
    cart_token: string;
    updated_at: string;
    status: string;
    lines: ServerCartLine[];
};

// T10/W3 — this used to be a local, hand-rolled type that carried an extra `unit_price` field
// the gateway's StorefrontCartLineInputSchema (`.strict()`) had never accepted, so every cart
// write from this (React/non-Liquid) storefront renderer 400'd, silently, since server-side
// carts shipped (61b68172) — the UI showed the item added, the server cart stayed empty, and a
// shopper who then went to checkout was bounced back to /cart in a loop with no error message
// (CheckoutRedirect finds no cart_token in localStorage, since the failed sync never set one).
// A client-supplied price is correctly never trusted server-side — pricing is always recomputed
// from product_id/quantity — so the fix is not to accept the field, it is to stop this file
// declaring its own copy of the request shape at all. Importing the gateway's actual schema type
// makes the two structurally impossible to diverge again: assigning an object literal with an
// extra key to this type fails TypeScript's excess-property check at the call site below.
type CartLineInput = StorefrontCartLineInput;

// T6/W2 — exported so the checkout-origin route tree (apps/commerce/web/src/app/
// checkout-origin/**, which is NEVER wrapped by this file's CartProvider — see
// app/store/[subdomain]/layout.tsx, the only place CartProvider mounts) can read via
// useContext directly (never throws on a missing provider, unlike useCart()) and fall back to
// a server-fetched cart sourced from the verified handoff instead.
export const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'lb_cart';
const CART_TOKEN_STORAGE_KEY = 'lb_cart_token';

function getStorefrontSubdomain(): string | null {
    if (typeof window === 'undefined') return null;

    const pathMatch = window.location.pathname.match(/^\/store\/([^/?#]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

    const querySubdomain = new URLSearchParams(window.location.search).get('subdomain');
    if (querySubdomain) return querySubdomain;

    const hostname = window.location.hostname.split('.')[0];
    return hostname && !['localhost', '127', '0', 'www'].includes(hostname) ? hostname : null;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

    const output: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === 'string') output[key] = entry;
    }

    return Object.keys(output).length > 0 ? output : undefined;
}

function serverCartToItems(serverCart: ServerCart): CartItem[] {
    return serverCart.lines.map((line) => ({
        id: line.product_id,
        serverLineId: line.id,
        marketplaceListingId: line.marketplace_listing_id,
        personalizationDraft: line.personalization,
        variantId: line.variant_id ?? null,
        name: line.title,
        description: '',
        price: line.unit_price,
        compareAtPrice: line.compare_price || undefined,
        currency: line.currency || 'INR',
        images: line.image_url ? [line.image_url] : [],
        stock: 999,
        quantity: line.quantity,
        selectedVariant: stringRecord(line.properties),
    }));
}

function cartLineInputFromItem(item: CartItem): CartLineInput {
    const variantId = (item as CartItem & { variantId?: string | null }).variantId ?? null;
    return {
        product_id: item.id,
        variant_id: variantId,
        quantity: item.quantity,
        properties: item.selectedVariant || {},
        ...(item.marketplaceListingId ? { marketplace_listing_id: item.marketplaceListingId } : {}),
        ...(item.personalizationDraft ? { personalization: item.personalizationDraft } : {}),
    };
}

function readCachedItems(): CartItem[] {
    try {
        const saved = window.localStorage.getItem(CART_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const alive = useRef(true);
    const generation = useRef(0);
    const readSequence = useRef(0);
    const writes = useRef<Promise<void>>(Promise.resolve());

    function adopt(cart: ServerCart) {
        const accepted = serverCartToItems(cart);
        setItems(accepted);
        localStorage.setItem(CART_TOKEN_STORAGE_KEY, cart.cart_token);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(accepted));
        localStorage.setItem('lb_cart_server', JSON.stringify(cart));
    }

    async function readCurrent(subdomain: string, token: string): Promise<ServerCart> {
        const response = await storefrontBrowserApiFetch(subdomain, `/cart/${encodeURIComponent(token)}`);
        const result = await readStorefrontApiJson<ServerCart>(response);
        if (!response.ok || !result.success || !result.data || result.data.cart_token !== token
            || result.data.status !== 'active' || !Array.isArray(result.data.lines)
            || !StorefrontCartRevisionSchema.safeParse(result.data.updated_at).success) {
            throw new Error('Reload your saved cart before changing it.');
        }
        return result.data;
    }

    useEffect(() => {
        alive.current = true;
        let live = true;
        const loadEpoch = readSequence.current;
        const ownsLoad = () => live && alive.current && readSequence.current === loadEpoch;
        const retired = () => { generation.current++; setItems([]); };
        window.addEventListener(CART_RETIRED_EVENT, retired);
        const subdomain = getStorefrontSubdomain();
        void (async () => {
            const reconciliation = subdomain ? reconcileStoredCart(subdomain) : null;
            if (reconciliation && await reconciliation === 'unavailable') {
                if (ownsLoad()) { setItems(readCachedItems()); setSyncError('We could not check your previous checkout. Please try again.'); }
                return;
            }
            const token = localStorage.getItem(CART_TOKEN_STORAGE_KEY);
            if (!ownsLoad()) return;
            if (!subdomain || !token) { setItems(readCachedItems()); return; }
            try {
                const cart = await readCurrent(subdomain, token);
                if (ownsLoad() && getStorefrontSubdomain() === subdomain && localStorage.getItem(CART_TOKEN_STORAGE_KEY) === token) adopt(cart);
            } catch { if (ownsLoad()) { setItems(readCachedItems()); setSyncError('We could not load your saved cart. Please try again.'); } }
        })();
        return () => { live = false; alive.current = false; readSequence.current++; generation.current++; window.removeEventListener(CART_RETIRED_EVENT, retired); };
    }, []);

    // The server cart is the one authority. Serialize explicit user intents and
    // derive both full contents and raw revision from the same fresh read. A
    // mount/read never writes cached contents back over another cart consumer.
    function mutate(change: (current: CartItem[]) => CartItem[] | null): Promise<void> {
        const site = getStorefrontSubdomain(), epoch = generation.current;
        const work = async () => {
            if (!alive.current || !site || getStorefrontSubdomain() !== site || epoch !== generation.current) return;
            try {
                readSequence.current++; // retire older mount reads, not a cart revision
                const reconciliation = reconcileStoredCart(site);
                if (reconciliation && await reconciliation === 'unavailable') throw new Error('We could not check your previous checkout. Please try again.');
                const token = localStorage.getItem(CART_TOKEN_STORAGE_KEY);
                const base = token ? await readCurrent(site, token) : null;
                if (!alive.current || getStorefrontSubdomain() !== site || localStorage.getItem(CART_TOKEN_STORAGE_KEY) !== token) return;
                const next = change(base ? serverCartToItems(base) : []);
                if (!next) { if (base) adopt(base); return; }
                if (!token && next.length === 0) { setItems([]); return; }
                const lines = next.map(item => {
                    const accepted = item.serverLineId && base?.lines.find(line => line.id === item.serverLineId);
                    if (!accepted || accepted.product_id !== item.id || (accepted.variant_id ?? null) !== (item.variantId ?? null)) return cartLineInputFromItem(item);
                    // This consumer only changes quantity/removal. Retain all
                    // accepted configuration and JSON properties from the same
                    // server object used for the revision precondition.
                    return { product_id: accepted.product_id, variant_id: accepted.variant_id ?? null,
                        quantity: item.quantity, properties: accepted.properties || {},
                        ...(accepted.marketplace_listing_id ? { marketplace_listing_id: accepted.marketplace_listing_id } : {}),
                        ...(accepted.personalization ? { personalization: accepted.personalization } : {}) };
                });
                const body = { lines, ...(base ? { expected_updated_at: base.updated_at } : {}) };
                const response = await storefrontBrowserApiFetch(site, token ? `/cart/${encodeURIComponent(token)}` : '/cart', {
                    method: token ? 'PATCH' : 'POST', body: JSON.stringify(body),
                });
                const result = await readStorefrontApiJson<ServerCart>(response);
                if (!response.ok || !result.success || !result.data || result.data.status !== 'active'
                    || typeof result.data.cart_token !== 'string' || !result.data.cart_token
                    || token !== null && result.data.cart_token !== token || !Array.isArray(result.data.lines)
                    || !StorefrontCartRevisionSchema.safeParse(result.data.updated_at).success) {
                    generation.current++;
                    throw new Error(storefrontApiErrorMessage(result, 'Could not update your cart. Review your saved cart and try again.'));
                }
                if (!alive.current || getStorefrontSubdomain() !== site || localStorage.getItem(CART_TOKEN_STORAGE_KEY) !== token) return;
                adopt(result.data); setSyncError(null);
            } catch (error) {
                generation.current++; // queued old intents cannot silently retry an unknown write
                if (alive.current) setSyncError(error instanceof Error ? error.message : 'Could not update your cart. Please try again.');
            }
        };
        const pending = writes.current.then(work, work);
        writes.current = pending;
        return pending;
    }

    const addToCart = async (product: ProductModel, variantContext?: CartVariantContext) => {
        await mutate(current => {
            const variantId = variantContext?.variantId ?? null;
            const existing = current.find(item => item.id === product.id && (item.variantId ?? null) === variantId
                && !item.personalizationDraft && !item.marketplaceListingId);
            if (existing) return current.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
            return [...current, { ...product, price: variantContext?.price ?? product.price,
                compareAtPrice: variantContext?.comparePrice === undefined ? product.compareAtPrice : variantContext.comparePrice ?? undefined,
                quantity: 1, variantId }];
        });
        setIsOpen(true);
    };
    const matches = (item: CartItem, productId: string, variantId?: string | null) => item.id === productId
        && (variantId === undefined || (item.variantId ?? null) === variantId);
    const removeFromCart = (productId: string, variantId?: string | null) => mutate(current => {
        if (current.filter(item => matches(item, productId, variantId)).length > 1) {
            setSyncError('This product has several saved configurations. Choose the specific configured line in your storefront cart.'); return null;
        }
        return current.filter(item => !matches(item, productId, variantId));
    });
    const updateQuantity = (productId: string, quantity: number, variantId?: string | null) => mutate(current => {
        if (current.filter(item => matches(item, productId, variantId)).length > 1) {
            setSyncError('This product has several saved configurations. Choose the specific configured line in your storefront cart.'); return null;
        }
        return quantity < 1 ? current.filter(item => !matches(item, productId, variantId))
            : current.map(item => matches(item, productId, variantId) ? { ...item, quantity } : item);
    });
    const clearCart = () => mutate(() => []);
    return <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart,
        cartTotal: items.reduce((total,item) => total+item.price*item.quantity,0),
        cartCount: items.reduce((total,item) => total+item.quantity,0), isOpen, setIsOpen, syncError }}>{children}</CartContext.Provider>;
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within CartProvider');
    return context;
};
