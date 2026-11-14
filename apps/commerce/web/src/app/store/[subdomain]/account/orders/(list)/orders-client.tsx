'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Calendar, ChevronRight, Package, ShoppingBag } from '@letbuyy/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StorefrontEmptyState, StorefrontListLoadingState } from '@/components/storefront/storefront-states';
import { useWishlist } from '@/context/wishlist-context';

interface OrderSummary {
    id: string;
    order_number: string | null;
    status: string | null;
    total: number | null;
    currency: string | null;
    created_at: string | null;
}

const money = (amount: number | null, currency: string | null) => {
    const value = Number(amount ?? 0);
    try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(value); }
    catch { return `₹${value.toLocaleString('en-IN')}`; }
};

export default function OrdersClient() {
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;
    const {
        buyerSessionReady,
        buyerSessionRefreshing,
        buyerSessionRevision,
        buyerSessionUnavailable,
    } = useWishlist();
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signedOut, setSignedOut] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [claimMessage, setClaimMessage] = useState('');
    const [loadedSessionRevision, setLoadedSessionRevision] = useState<number | null>(null);
    const readGeneration = useRef(0);
    const currentSessionRevision = useRef(buyerSessionRevision);
    currentSessionRevision.current = buyerSessionRevision;

    const loadPage = useCallback(async (nextCursor: string | null, append: boolean, signal?: AbortSignal) => {
        const generation = ++readGeneration.current;
        if (append) setLoadingMore(true);
        else {
            setLoading(true);
            setLoadingMore(false);
        }
        setError(null);
        try {
            const query = new URLSearchParams({ limit: '20' });
            if (nextCursor) query.set('cursor', nextCursor);
            const response = await fetch(`/api/buyer/orders?${query}`, { cache: 'no-store', signal });
            if (signal?.aborted || generation !== readGeneration.current) return;
            if (response.status === 401 || response.status === 403) {
                setSignedOut(true);
                setOrders([]);
                setHasMore(false);
                return;
            }
            if (!response.ok) throw new Error('Orders are temporarily unavailable. Please try again.');
            const body = await response.json() as { orders?: OrderSummary[]; nextCursor?: string | null; hasMore?: boolean };
            if (signal?.aborted || generation !== readGeneration.current) return;
            if (!Array.isArray(body.orders)) throw new Error('Orders are temporarily unavailable. Please try again.');
            setSignedOut(false);
            setOrders((current) => append ? [...current, ...body.orders!] : body.orders!);
            setCursor(typeof body.nextCursor === 'string' ? body.nextCursor : null);
            setHasMore(body.hasMore === true && typeof body.nextCursor === 'string');
        } catch (cause) {
            if ((cause instanceof DOMException && cause.name === 'AbortError') || signal?.aborted || generation !== readGeneration.current) return;
            setError(cause instanceof Error ? cause.message : 'Orders are temporarily unavailable. Please try again.');
        } finally {
            if (!signal?.aborted && generation === readGeneration.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!buyerSessionReady || buyerSessionRefreshing) return;
        setClaiming(false);
        setClaimMessage('');
        if (buyerSessionUnavailable) {
            setOrders([]);
            setCursor(null);
            setHasMore(false);
            setSignedOut(false);
            setError('We could not verify your account right now. Please try again.');
            setLoading(false);
            setLoadedSessionRevision(buyerSessionRevision);
            return;
        }
        const controller = new AbortController();
        setOrders([]);
        setCursor(null);
        setHasMore(false);
        void loadPage(null, false, controller.signal).then(() => {
            if (!controller.signal.aborted) setLoadedSessionRevision(buyerSessionRevision);
        });
        return () => controller.abort();
    }, [buyerSessionReady, buyerSessionRefreshing, buyerSessionRevision, buyerSessionUnavailable, loadPage]);

    useEffect(() => {
        const status = new URLSearchParams(window.location.search).get('buyer_claim');
        if (status === 'complete') setClaimMessage('The verified orders for this store have been checked and linked.');
        else if (status === 'unverified') setClaimMessage('Verify your LetBuyy email before claiming historical orders.');
        else if (status === 'unavailable') setClaimMessage('Historical orders could not be checked right now. Please try again.');
    }, []);

    const claimHistoricalOrders = async () => {
        const sessionRevision = buyerSessionRevision;
        setClaiming(true);
        setClaimMessage('');
        try {
            const response = await fetch('/api/buyer/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({}),
            });
            const body = await response.json() as {
                claimed?: { linked?: number; alreadyLinked?: number; conflicts?: number };
                error?: string;
                code?: string;
            };
            if (currentSessionRevision.current !== sessionRevision) return;
            if (response.status === 403 && body.code === 'EMAIL_UNVERIFIED') {
                setClaimMessage('Verify your LetBuyy email before claiming historical orders.');
                return;
            }
            if (!response.ok || !body.claimed) throw new Error(body.error || 'Historical orders could not be checked right now.');
            const linkedCount = Number(body.claimed.linked) || 0;
            const existingCount = Number(body.claimed.alreadyLinked) || 0;
            const conflicts = Number(body.claimed.conflicts) || 0;
            setClaimMessage(linkedCount > 0
                ? `${linkedCount} historical order${linkedCount === 1 ? '' : 's'} linked${conflicts ? `; ${conflicts} could not be linked` : ''}.`
                : existingCount > 0 && conflicts > 0
                    ? `${existingCount} eligible order${existingCount === 1 ? ' is' : 's are'} already linked; ${conflicts} could not be linked. Contact the store for help.`
                    : existingCount > 0
                    ? 'Your eligible orders are already linked.'
                    : conflicts > 0
                        ? `${conflicts} eligible order${conflicts === 1 ? '' : 's'} could not be linked. Contact the store for help.`
                        : 'No historical orders matched your verified LetBuyy email at this store.');
            await loadPage(null, false);
        } catch (cause) {
            if (currentSessionRevision.current !== sessionRevision) return;
            setClaimMessage(cause instanceof Error ? cause.message : 'Historical orders could not be checked right now.');
        } finally {
            if (currentSessionRevision.current === sessionRevision) setClaiming(false);
        }
    };

    if (!buyerSessionReady || buyerSessionRefreshing || loading || loadedSessionRevision !== buyerSessionRevision) {
        return <StorefrontListLoadingState rows={4} />;
    }

    if (signedOut) {
        return (
            <StorefrontEmptyState
                icon={<ShoppingBag size={28} aria-hidden="true" />}
                title="Sign in to LetBuyy to view your orders"
                body="Your linked orders are private to your LetBuyy account. Sign in to continue."
                actionHref={`/api/buyer-auth/start?return_to=${encodeURIComponent(`${basePath}/account/orders`)}`}
                actionLabel="Continue with LetBuyy"
                actionIcon={<ShoppingBag size={18} aria-hidden="true" />}
            />
        );
    }

    return (
        <div>
            <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-2xl font-bold">My Orders</h1>
                <Link href={`${basePath}/account/support`} className="text-sm font-semibold underline">Contact support</Link>
            </header>
            <section className="mb-5 rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Find past orders from this store placed with your verified LetBuyy email. This only checks this store.</p>
                <Button unstyled type="button" disabled={claiming} onClick={() => void claimHistoricalOrders()} className="mt-3 min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
                    {claiming ? 'Checking orders…' : 'Find past orders'}
                </Button>
                {claimMessage && <p role="status" aria-live="polite" className="mt-3 text-sm">{claimMessage}</p>}
            </section>
            {error && <div role="alert" className="mb-4 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>{error} <Button unstyled className="ml-2 underline" onClick={() => void loadPage(null, false)}>Try again</Button></div>}
            {error ? null : orders.length === 0 ? (
                <StorefrontEmptyState
                    icon={<ShoppingBag size={28} aria-hidden="true" />}
                    title="No linked orders yet"
                    body="Orders linked to your LetBuyy account will appear here."
                    actionHref={`${basePath}/shop`}
                    actionLabel="Start shopping"
                    actionIcon={<ShoppingBag size={18} aria-hidden="true" />}
                />
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => (
                        <Link key={order.id} href={`${basePath}/account/orders/${encodeURIComponent(order.id)}`} className="block rounded-2xl border p-4 transition-shadow hover:shadow-md" style={{ borderColor: 'var(--border)' }}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 font-semibold text-sm"><Package size={18} style={{ color: 'var(--primary)' }} />{order.order_number || `#${order.id.slice(0, 8)}`}</span>
                                <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--surface)' }}>{order.status || 'Status unavailable'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}><Calendar size={13} aria-hidden="true" />{order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable'}<strong className="ml-2 text-sm text-[var(--text)]">{money(order.total, order.currency)}</strong></span>
                                <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--primary)' }}>View order <ChevronRight size={16} aria-hidden="true" /></span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            {hasMore && <div className="mt-6 text-center"><Button unstyled disabled={loadingMore} onClick={() => void loadPage(cursor, true)} className="min-h-11 rounded-xl border px-5 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>{loadingMore ? 'Loading…' : 'Load more orders'}</Button></div>}
        </div>
    );
}
