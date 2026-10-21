'use client';

import type { CartItem, StorefrontCartLineInput } from '@letbuyy/checkout-core';
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
    const [cartToken, setCartToken] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const skipNextSyncRef = useRef(false);
    const lastSyncPayloadRef = useRef('');

    useEffect(() => {
        let alive = true;
        const retired = () => {
            setItems([]);
            setCartToken(null);
            lastSyncPayloadRef.current = '';
        };
        const load = () => {
            if (!alive) return;
            const cached = readCachedItems();
            // Returning to the storefront is a read. Only a deliberate mutation
            // syncs a draft; mounting must not replay pre-checkout cart contents.
            lastSyncPayloadRef.current = JSON.stringify(cached.map(cartLineInputFromItem));
            setItems(cached);
            setCartToken(window.localStorage.getItem(CART_TOKEN_STORAGE_KEY));
            setHasLoadedStorage(true);
        };
        window.addEventListener(CART_RETIRED_EVENT, retired);
        const subdomain = getStorefrontSubdomain();
        const reconciliation = subdomain ? reconcileStoredCart(subdomain) : null;
        if (reconciliation) void reconciliation.then(load);
        else load();
        return () => { alive = false; window.removeEventListener(CART_RETIRED_EVENT, retired); };
    }, []);

    async function prepareCartMutation(): Promise<boolean> {
        const subdomain = getStorefrontSubdomain();
        const reconciliation = subdomain ? reconcileStoredCart(subdomain) : null;
        if (reconciliation && await reconciliation === 'unavailable') {
            setSyncError('We could not check your previous checkout. Please try again.');
            return false;
        }
        return true;
    }

    async function syncCartToServer(nextItems: CartItem[]) {
        const subdomain = getStorefrontSubdomain();
        if (!subdomain) return;

        const reconciliation = reconcileStoredCart(subdomain);
        if (reconciliation) {
            const outcome = await reconciliation;
            if (outcome === 'retired') return;
            if (outcome === 'unavailable') {
                setSyncError('We could not check your previous checkout. Please try again.');
                return;
            }
        }
        const currentToken = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
        const body = {
            lines: nextItems.map(cartLineInputFromItem),
        };

        try {
            const response = await storefrontBrowserApiFetch(subdomain, currentToken ? `/cart/${currentToken}` : '/cart', {
                method: currentToken ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
            });
            const result = await readStorefrontApiJson<ServerCart>(response);

            // T10/W2 — the request reached the server and the server REJECTED it (e.g. a schema
            // validation error). This is not "the gateway is unreachable" — the previous version
            // of this function treated both the same way (silently give up), which is exactly how
            // a 400 on every write from this renderer shipped unnoticed: the local cart kept
            // showing the item, the server cart stayed empty, and the shopper was later bounced
            // out of checkout with no explanation. A genuinely offline/unreachable gateway is
            // still handled below, silently, by design — that distinction is the point.
            if (!response.ok || !result.success || !result.data) {
                const message = storefrontApiErrorMessage(result, 'Could not update your cart. Please try again.');
                // eslint-disable-next-line no-console
                console.error('[cart] server rejected cart sync', { status: response.status, body });
                setSyncError(message);
                return;
            }

            setSyncError(null);
            const serverCart = result.data;
            const serverItems = serverCartToItems(serverCart);
            const serverPayload = JSON.stringify(serverItems);

            setCartToken(serverCart.cart_token);
            localStorage.setItem(CART_TOKEN_STORAGE_KEY, serverCart.cart_token);
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));

            if (serverPayload !== JSON.stringify(nextItems)) {
                skipNextSyncRef.current = true;
                lastSyncPayloadRef.current = serverPayload;
                setItems(serverItems);
            }
        } catch (err) {
            // Keep the browser cache usable while the gateway is temporarily unavailable — a
            // transient network failure must not destroy a shopper's cart. Logged (not shown to
            // the shopper — this branch is specifically the "offline-tolerant" case, distinct
            // from the explicit-rejection branch above) so it is still visible in devtools/telemetry.
            // eslint-disable-next-line no-console
            console.error('[cart] cart sync network failure (server unreachable, will retry on next change)', err);
        }
    }

    useEffect(() => {
        if (!hasLoadedStorage) return;

        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        if (skipNextSyncRef.current) {
            skipNextSyncRef.current = false;
            return;
        }

        const payload = JSON.stringify(items.map(cartLineInputFromItem));
        // Opening a storefront or editor preview is a read. Create the server
        // cart when a real line exists; an existing cart can still be cleared.
        if (!cartToken && items.length === 0) { lastSyncPayloadRef.current = payload; return; }
        if (payload === lastSyncPayloadRef.current) return;
        lastSyncPayloadRef.current = payload;
        void syncCartToServer(items);
    }, [items, hasLoadedStorage, cartToken]);

    const addToCart = async (product: ProductModel, variantContext?: CartVariantContext) => {
        if (!await prepareCartMutation()) return;
        setItems(prev => {
            const cartLineKey = variantContext?.variantId
                ? `${product.id}:${variantContext.variantId}`
                : product.id;
            const existing = prev.find(i => {
                const iKey = (i as CartItem & { variantId?: string | null }).variantId
                    ? `${i.id}:${(i as CartItem & { variantId?: string | null }).variantId}`
                    : i.id;
                return iKey === cartLineKey;
            });
            const effectivePrice = variantContext?.price ?? product.price;
            const effectiveCompareAtPrice = variantContext?.comparePrice !== undefined
                ? variantContext.comparePrice ?? undefined
                : product.compareAtPrice;
            if (existing) {
                return prev.map(i => {
                    const iKey = (i as CartItem & { variantId?: string | null }).variantId
                        ? `${i.id}:${(i as CartItem & { variantId?: string | null }).variantId}`
                        : i.id;
                    return iKey === cartLineKey ? { ...i, quantity: i.quantity + 1 } : i;
                });
            }
            const newItem: CartItem & { variantId?: string | null; variantTitle?: string } = {
                ...product,
                price: effectivePrice,
                compareAtPrice: effectiveCompareAtPrice,
                quantity: 1,
                variantId: variantContext?.variantId ?? null,
                variantTitle: variantContext?.variantTitle,
            };
            return [...prev, newItem];
        });
        setIsOpen(true);
    };

    const removeFromCart = async (productId: string, variantId?: string | null) => {
        if (!await prepareCartMutation()) return;
        setItems(prev => prev.filter(i => {
            const iVariantId = (i as CartItem & { variantId?: string | null }).variantId ?? null;
            if (i.id !== productId) return true;
            if (variantId !== undefined) return iVariantId !== variantId;
            return false;
        }));
    };

    const updateQuantity = async (productId: string, quantity: number, variantId?: string | null) => {
        if (!await prepareCartMutation()) return;
        if (quantity < 1) {
            removeFromCart(productId, variantId);
            return;
        }
        setItems(prev => prev.map(i => {
            const iVariantId = (i as CartItem & { variantId?: string | null }).variantId ?? null;
            const matches = i.id === productId && (variantId === undefined || iVariantId === variantId);
            return matches ? { ...i, quantity } : i;
        }));
    };

    const clearCart = async () => { if (await prepareCartMutation()) setItems([]); };

    const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
    const cartCount = items.reduce((count, item) => count + item.quantity, 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart: addToCart as CartContextType['addToCart'],
            removeFromCart,
            updateQuantity,
            clearCart,
            cartTotal,
            cartCount,
            isOpen,
            setIsOpen,
            syncError
        }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within CartProvider');
    return context;
};
