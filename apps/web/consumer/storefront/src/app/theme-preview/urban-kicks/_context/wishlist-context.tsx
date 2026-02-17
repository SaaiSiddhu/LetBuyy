'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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

function readStorage(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {
        /* ignore */
    }
    return [];
}

export function PreviewWishlistProvider({ children }: { children: React.ReactNode }) {
    // Start with empty array (matches SSR) to avoid hydration mismatch
    const [items, setItems] = useState<string[]>([]);
    const hydrated = useRef(false);

    // After mount (client only), load real data from localStorage
    useEffect(() => {
        const stored = readStorage();
        setItems(stored);
        hydrated.current = true;
    }, []);

    // Persist to localStorage ONLY after hydration is complete
    useEffect(() => {
        if (hydrated.current) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        }
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
            // Also mark as hydrated so persists from now on
            hydrated.current = true;
        },
        []
    );

    return (
        <WishlistContext.Provider value={{ items, isInWishlist, toggleWishlist, count: items.length }}>
            {children}
        </WishlistContext.Provider>
    );
}
