'use client';

import type { CartItem } from '@letbuyy/checkout-core';
import type { ProductModel } from '@letbuyy/commerce-core';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    readStorefrontApiJson,
    storefrontBrowserApiFetch,
} from '@/lib/api/browser-client';

interface CartContextType {
    items: CartItem[];
    addToCart: (product: ProductModel) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    cartTotal: number;
    cartCount: number;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
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

type CartLineInput = {
    product_id: string;
    variant_id?: string | null;
    quantity: number;
    properties: Record<string, unknown>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);
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
    return {
        product_id: item.id,
        variant_id: null,
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
    const skipNextSyncRef = useRef(false);
    const lastSyncPayloadRef = useRef('');

    useEffect(() => {
        setItems((prev) => (prev.length > 0 ? prev : readCachedItems()));
        setCartToken(window.localStorage.getItem(CART_TOKEN_STORAGE_KEY));
        setHasLoadedStorage(true);
    }, []);

    async function syncCartToServer(nextItems: CartItem[]) {
        const subdomain = getStorefrontSubdomain();
        if (!subdomain) return;

        const body = {
            lines: nextItems.map(cartLineInputFromItem),
        };

        try {
            const response = await storefrontBrowserApiFetch(subdomain, cartToken ? `/cart/${cartToken}` : '/cart', {
                method: cartToken ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
            });
            const result = await readStorefrontApiJson<ServerCart>(response);
            if (!response.ok || !result.success || !result.data) return;

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
        } catch {
            // Keep the browser cache usable while the gateway is temporarily unavailable.
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
        if (payload === lastSyncPayloadRef.current) return;
        lastSyncPayloadRef.current = payload;
        void syncCartToServer(items);
    }, [items, hasLoadedStorage]);

    const addToCart = (product: ProductModel) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setIsOpen(true);
    };

    const removeFromCart = (productId: string) => {
        setItems(prev => prev.filter(i => i.id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(productId);
            return;
        }
        setItems(prev => prev.map(i => i.id === productId ? { ...i, quantity } : i));
    };

    const clearCart = () => setItems([]);

    const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
    const cartCount = items.reduce((count, item) => count + item.quantity, 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            cartTotal,
            cartCount,
            isOpen,
            setIsOpen
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
