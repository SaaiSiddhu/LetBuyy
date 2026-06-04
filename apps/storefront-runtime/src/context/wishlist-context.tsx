// ============================================================
// WISHLIST CONTEXT — Dual-mode wishlist (guest + authenticated)
// Guest: localStorage | Authenticated: server API
// ============================================================

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCustomerAuth } from './customer-auth-context';

interface WishlistContextType {
    items: string[];
    isInWishlist: (productId: string) => boolean;
    toggleWishlist: (productId: string) => void;
    count: number;
}

const WishlistContext = createContext<WishlistContextType>({
    items: [],
    isInWishlist: () => false,
    toggleWishlist: () => { },
    count: 0,
});

export const useWishlist = () => useContext(WishlistContext);

const WISHLIST_STORAGE_KEY = 'lb_wishlist';

export function WishlistProvider({
    children,
    storeId,
}: {
    children: React.ReactNode;
    storeId: string;
}) {
    const { isAuthenticated } = useCustomerAuth();
    const [items, setItems] = useState<string[]>([]);

    // Load wishlist on mount / auth change
    useEffect(() => {
        if (isAuthenticated) {
            fetch('/api/customer/wishlist')
                .then(r => r.json())
                .then(d => setItems(d.productIds || []))
                .catch(() => { });
        } else {
            try {
                const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
                setItems(stored ? JSON.parse(stored) : []);
            } catch {
                setItems([]);
            }
        }
    }, [isAuthenticated]);

    // Persist local wishlist for guests
    useEffect(() => {
        if (!isAuthenticated) {
            localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
        }
    }, [items, isAuthenticated]);

    const isInWishlist = useCallback(
        (productId: string) => items.includes(productId),
        [items]
    );

    const toggleWishlist = useCallback(
        (productId: string) => {
            const exists = items.includes(productId);
            const updated = exists
                ? items.filter(id => id !== productId)
                : [...items, productId];
            setItems(updated);

            if (isAuthenticated) {
                fetch('/api/customer/wishlist', {
                    method: exists ? 'DELETE' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId, storeId }),
                }).catch(() => { });
            }
        },
        [items, isAuthenticated, storeId]
    );

    return (
        <WishlistContext.Provider value={{ items, isInWishlist, toggleWishlist, count: items.length }}>
            {children}
        </WishlistContext.Provider>
    );
}
