// ============================================================
// WISHLIST CONTEXT — Dual-mode wishlist (guest + authenticated)
// Guest: localStorage | Authenticated: server API
// ============================================================

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useCustomerAuth } from './customer-auth-context';
import { getWishlistIdentityMode } from './wishlist-identity';
import { applyWishlistProductState } from './wishlist-state';

interface WishlistContextType {
    items: string[];
    isInWishlist: (productId: string) => boolean;
    isToggling: (productId: string) => boolean;
    toggleWishlist: (productId: string) => void;
    count: number;
    buyerSession: boolean;
    buyerSessionId: string | null;
    buyerSessionEmail: string | null;
    buyerSessionReady: boolean;
    buyerSessionRefreshing: boolean;
    buyerSessionRevision: number;
    buyerSessionUnavailable: boolean;
    buyerStoreLinked: boolean;
    storeAccountUnavailable: boolean;
    unavailable: boolean;
    mutationError: boolean;
    isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType>({
    items: [],
    isInWishlist: () => false,
    isToggling: () => false,
    toggleWishlist: () => { },
    count: 0,
    buyerSession: false,
    buyerSessionId: null,
    buyerSessionEmail: null,
    buyerSessionReady: false,
    buyerSessionRefreshing: false,
    buyerSessionRevision: 0,
    buyerSessionUnavailable: false,
    buyerStoreLinked: false,
    storeAccountUnavailable: false,
    unavailable: false,
    mutationError: false,
    isLoading: false,
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
    const { isAuthenticated, isLoading: customerSessionLoading, customer } = useCustomerAuth();
    const [items, setItems] = useState<string[]>([]);
    const [buyerId, setBuyerId] = useState<string | null>(null);
    const [buyerEmail, setBuyerEmail] = useState<string | null | undefined>(undefined);
    const [buyerSessionRefreshing, setBuyerSessionRefreshing] = useState(false);
    const [buyerSessionRevision, setBuyerSessionRevision] = useState(0);
    const [buyerSessionUnavailable, setBuyerSessionUnavailable] = useState(false);
    const [buyerStoreLinked, setBuyerStoreLinked] = useState(false);
    const [storeAccountUnavailable, setStoreAccountUnavailable] = useState(false);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [mutationErrorKey, setMutationErrorKey] = useState<string | null>(null);
    const pendingProductIds = useRef(new Set<string>());
    const [pendingProductIdsState, setPendingProductIdsState] = useState<string[]>([]);
    const buyerSession = Boolean(buyerEmail);
    const identityMode = getWishlistIdentityMode(buyerSession, isAuthenticated);
    const wishlistKey = `${storeId}:${identityMode === 'store_customer' ? `customer:${customer?.id ?? 'active'}` : identityMode === 'buyer' ? `buyer:${buyerEmail}` : buyerEmail === undefined ? 'checking' : 'guest'}:session-${buyerSessionRevision}`;
    const isLoading = buyerSessionRefreshing || loadedFor !== wishlistKey;
    const wishlistKeyRef = useRef(wishlistKey);
    useEffect(() => {
        wishlistKeyRef.current = wishlistKey;
    }, [wishlistKey]);

    useEffect(() => {
        let active = true;
        let requestId = 0;
        let controller: AbortController | null = null;
        const refreshBuyerSession = (refreshWishlist = false) => {
            // A returning tab may still hold another buyer's items in React state.
            // Hide that generation before checking the host-only cookie so nothing
            // from the previous account is rendered during the session round trip.
            if (refreshWishlist) {
                setBuyerSessionRefreshing(true);
            }
            controller?.abort();
            const currentController = new AbortController();
            controller = currentController;
            const currentRequestId = ++requestId;
            fetch('/api/buyer-auth/session', { cache: 'no-store', signal: currentController.signal })
                .then(async (response) => {
                    if (!response.ok) throw new Error('session_unavailable');
                    const payload = await response.json() as { buyer?: { id?: unknown; email?: unknown } | null };
                    if (active && currentRequestId === requestId) {
                        setBuyerId(typeof payload.buyer?.id === 'string' ? payload.buyer.id : null);
                        setBuyerEmail(typeof payload.buyer?.email === 'string' ? payload.buyer.email.toLowerCase() : null);
                        setBuyerSessionUnavailable(false);
                        if (refreshWishlist) setBuyerSessionRevision((current) => current + 1);
                        setBuyerSessionRefreshing(false);
                    }
                })
                .catch((error: unknown) => {
                    if (error instanceof Error && error.name === 'AbortError') return;
                    if (active && currentRequestId === requestId) {
                        setBuyerEmail(null);
                        setBuyerId(null);
                        setBuyerSessionUnavailable(true);
                        if (refreshWishlist) setBuyerSessionRevision((current) => current + 1);
                        setBuyerSessionRefreshing(false);
                    }
                });
        };
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') refreshBuyerSession(true);
        };
        const refreshOnFocus = () => refreshBuyerSession(true);
        const refreshOnPageShow = () => refreshBuyerSession(true);
        refreshBuyerSession();
        document.addEventListener('visibilitychange', refreshWhenVisible);
        window.addEventListener('focus', refreshOnFocus);
        window.addEventListener('pageshow', refreshOnPageShow);
        return () => {
            active = false;
            requestId += 1;
            controller?.abort();
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            // Keep the exact listener references so this provider leaves no global handlers behind.
            window.removeEventListener('focus', refreshOnFocus);
            window.removeEventListener('pageshow', refreshOnPageShow);
        };
    }, []);

    // Load wishlist on mount / auth change
    useEffect(() => {
        if (customerSessionLoading || buyerEmail === undefined || buyerSessionRefreshing) return;
        let active = true;
        if (identityMode === 'store_customer') {
            fetch('/api/customer/wishlist')
                .then(async (r) => {
                    const data = await r.json();
                    if (!r.ok) throw new Error('wishlist_unavailable');
                    return data;
                })
                .then(d => { if (active) { setItems(d.productIds || []); setBuyerStoreLinked(false); setStoreAccountUnavailable(false); setUnavailable(false); } })
                .catch(() => { if (active) { setItems([]); setUnavailable(true); } })
                .finally(() => { if (active) setLoadedFor(wishlistKey); });
        } else if (identityMode === 'buyer') {
            fetch('/api/buyer/wishlist', { cache: 'no-store' })
                .then(async (r) => {
                    const data = await r.json();
                    if (!r.ok) throw new Error('wishlist_unavailable');
                    if (active) {
                        setBuyerStoreLinked(Boolean(data.linked));
                        setStoreAccountUnavailable(Boolean(data.storeAccountUnavailable));
                        setItems(data.linked && Array.isArray(data.productIds) ? data.productIds : []);
                        setUnavailable(false);
                    }
                })
                .catch(() => { if (active) { setBuyerStoreLinked(false); setStoreAccountUnavailable(false); setItems([]); setUnavailable(true); } })
                .finally(() => { if (active) setLoadedFor(wishlistKey); });
        } else {
            queueMicrotask(() => {
                if (!active) return;
                setBuyerStoreLinked(false);
                setStoreAccountUnavailable(false);
                try {
                    const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
                    const parsed: unknown = stored ? JSON.parse(stored) : [];
                    setItems(Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : []);
                    setUnavailable(false);
                } catch {
                    setItems([]);
                    setUnavailable(true);
                }
                setLoadedFor(wishlistKey);
            });
        }
        return () => { active = false; };
    }, [buyerEmail, buyerSessionRefreshing, buyerSessionRevision, customerSessionLoading, customer?.id, identityMode, storeId, wishlistKey]);

    // Persist local wishlist for guests
    useEffect(() => {
        if (!isLoading && !customerSessionLoading && !buyerSession && !isAuthenticated) {
            localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
        }
    }, [buyerSession, customerSessionLoading, items, isAuthenticated, isLoading]);

    const isInWishlist = useCallback(
        (productId: string) => !isLoading && items.includes(productId),
        [isLoading, items]
    );

    const isToggling = useCallback(
        (productId: string) => pendingProductIdsState.includes(`${wishlistKey}:${productId}`),
        [pendingProductIdsState, wishlistKey],
    );

    const toggleWishlist = useCallback(
        (productId: string) => {
            if (isLoading) return;
            if (identityMode === 'buyer' && !buyerStoreLinked) return;
            const exists = items.includes(productId);

            if (identityMode === 'guest') {
                setItems((current) => applyWishlistProductState(current, productId, !exists));
                return;
            }

            // Ignore repeat clicks for this item until the request completes. Different items can
            // save concurrently; functional state updates below preserve each confirmed result.
            const mutationKey = `${wishlistKey}:${productId}`;
            if (pendingProductIds.current.has(mutationKey)) return;
            pendingProductIds.current.add(mutationKey);
            setPendingProductIdsState((current) => [...current, mutationKey]);
            const buyerApi = identityMode === 'buyer';
            fetch(buyerApi ? '/api/buyer/wishlist' : '/api/customer/wishlist', {
                method: exists ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(buyerApi && buyerId ? { 'x-letbuyy-expected-buyer-id': buyerId } : {}),
                },
                body: JSON.stringify(buyerApi ? { productId } : { productId, storeId }),
            })
                .then((response) => {
                    if (!response.ok) throw new Error('wishlist_mutation_failed');
                    if (wishlistKeyRef.current !== wishlistKey) return;
                    setItems((current) => applyWishlistProductState(current, productId, !exists));
                    setMutationErrorKey(null);
                })
                .catch(() => {
                    if (wishlistKeyRef.current === wishlistKey) setMutationErrorKey(wishlistKey);
                })
                .finally(() => {
                    pendingProductIds.current.delete(mutationKey);
                    setPendingProductIdsState((current) => current.filter((id) => id !== mutationKey));
                });
        },
        [buyerId, identityMode, buyerStoreLinked, isLoading, items, storeId, wishlistKey]
    );

    return (
        <WishlistContext.Provider value={{
            items: isLoading ? [] : items,
            isInWishlist,
            isToggling,
            toggleWishlist,
            count: isLoading ? 0 : items.length,
            buyerSession: !isLoading && buyerSession,
            buyerSessionId: buyerId,
            buyerSessionEmail: buyerEmail ?? null,
            buyerSessionReady: buyerEmail !== undefined && !buyerSessionRefreshing,
            buyerSessionRefreshing,
            buyerSessionRevision,
            buyerSessionUnavailable,
            buyerStoreLinked: !isLoading && buyerStoreLinked,
            storeAccountUnavailable: !isLoading && storeAccountUnavailable,
            unavailable: !isLoading && unavailable,
            mutationError: !isLoading && mutationErrorKey === wishlistKey,
            isLoading,
        }}>
            {children}
        </WishlistContext.Provider>
    );
}
