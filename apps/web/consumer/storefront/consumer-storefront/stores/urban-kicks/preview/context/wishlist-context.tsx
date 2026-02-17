'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================
// PREVIEW WISHLIST CONTEXT — localStorage only (no auth)
// Used exclusively in theme-preview mode with mock data
// ============================================================

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

export const usePreviewWishlist = () => useContext(WishlistContext);

const STORAGE_KEY = 'uk_preview_wishlist';

export function PreviewWishlistProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<string[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setItems(JSON.parse(stored));
        } catch {
            setItems([]);
        }
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const isInWishlist = useCallback(
        (productId: string) => items.includes(productId),
        [items]
    );

    const toggleWishlist = useCallback(
        (productId: string) => {
            setItems((prev) =>
                prev.includes(productId)
                    ? prev.filter((id) => id !== productId)
                    : [...prev, productId]
            );
        },
        []
    );

    return (
        <WishlistContext.Provider value={{ items, isInWishlist, toggleWishlist, count: items.length }}>
            {children}
        </WishlistContext.Provider>
    );
}
