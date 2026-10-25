'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NicheOrderFacts } from '@/components/storefront/niche-order-facts';
import { readOrderItemFactSnapshot, savedOrderOptions } from '@/lib/order-fact-readback';
import { useWishlist } from '@/context/wishlist-context';

interface OrderDetail {
    id: string;
    order_number?: string | null;
    status?: string | null;
    total?: number | null;
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    shipping_cost?: number | null;
    currency?: string | null;
    created_at?: string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    tracking_number?: string | null;
    carrier?: string | null;
    shipping_address?: Record<string, unknown> | null;
    items?: Array<{ name?: string; title?: string; quantity?: number; price?: number; image?: string; niche_snapshot?: unknown }>;
}

const formatMoney = (amount: number | null | undefined, currency: string | null | undefined) => {
    try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(Number(amount ?? 0)); }
    catch { return `₹${Number(amount ?? 0).toLocaleString('en-IN')}`; }
};

export default function OrderDetailClient({ subdomain, id }: { subdomain: string; id: string }) {
    const basePath = `/store/${subdomain}`;
    const {
        buyerSessionReady,
        buyerSessionRefreshing,
        buyerSessionRevision,
        buyerSessionUnavailable,
    } = useWishlist();
    const [result, setResult] = useState<{
        requestKey: string;
        order: OrderDetail | null;
        message: string | null;
        signedOut: boolean;
    } | null>(null);
    const requestKey = `${id}:buyer-session-${buyerSessionRevision}`;

    useEffect(() => {
        if (!buyerSessionReady || buyerSessionRefreshing || buyerSessionUnavailable) return;
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch(`/api/buyer/orders?order_id=${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal });
                if (controller.signal.aborted) return;
                if (response.status === 401 || response.status === 403) {
                    setResult({ requestKey, order: null, message: null, signedOut: true });
                    return;
                }
                if (response.status === 404) {
                    setResult({ requestKey, order: null, message: 'We could not find this order in your linked order history.', signedOut: false });
                    return;
                }
                if (!response.ok) throw new Error('This order is temporarily unavailable.');
                const body = await response.json() as { order?: OrderDetail };
                if (controller.signal.aborted) return;
                if (!body.order || body.order.id !== id) throw new Error('This order is temporarily unavailable.');
                setResult({ requestKey, order: body.order, message: null, signedOut: false });
            } catch (error: unknown) {
                if ((error instanceof DOMException && error.name === 'AbortError') || controller.signal.aborted) return;
                setResult({
                    requestKey,
                    order: null,
                    message: error instanceof Error ? error.message : 'This order is temporarily unavailable.',
                    signedOut: false,
                });
            }
        })();
        return () => controller.abort();
    }, [buyerSessionReady, buyerSessionRefreshing, buyerSessionRevision, buyerSessionUnavailable, id, requestKey]);

    if (!buyerSessionReady || buyerSessionRefreshing) {
        return <main className="mx-auto max-w-3xl p-6" aria-busy="true">Loading your order…</main>;
    }
    if (buyerSessionUnavailable) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Order unavailable</h1><p role="alert">We could not verify your account right now. Please try again.</p><Link className="underline" href={`${basePath}/account/orders`}>Back to orders</Link></main>;
    if (!result || result.requestKey !== requestKey) return <main className="mx-auto max-w-3xl p-6" aria-busy="true">Loading your order…</main>;

    const { order, message, signedOut } = result;
    if (signedOut) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Sign in to view this order</h1><p>Your linked orders are private to your LetBuyy account.</p><a className="inline-flex rounded-xl px-4 py-3 font-semibold" style={{ backgroundColor: 'var(--primary)', color: 'var(--lb-color-text-inverse, white)' }} href={`/api/buyer-auth/start?return_to=${encodeURIComponent(`${basePath}/account/orders/${id}`)}`}>Continue with LetBuyy</a><Link className="block underline" href={`${basePath}/account/orders`}>Back to orders</Link></main>;
    if (message || !order) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Order unavailable</h1><p role="alert">{message || 'This order is unavailable.'}</p><Link className="underline" href={`${basePath}/account/orders`}>Back to orders</Link></main>;

    const items = Array.isArray(order.items) ? order.items : [];
    const address = order.shipping_address && typeof order.shipping_address === 'object'
        ? Object.values(order.shipping_address).filter((part) => typeof part === 'string' && part.trim()).join(', ')
        : '';
    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6">
            <Link href={`${basePath}/account/orders`} className="text-sm font-semibold underline">← Back to orders</Link>
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-sm text-[var(--text-secondary)]">Order</p><h1 className="text-2xl font-bold">{order.order_number || `#${order.id.slice(0, 8)}`}</h1>{order.created_at && <p className="mt-1 text-sm">Placed {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}</div>
                <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm font-semibold">{order.status || 'Status unavailable'}</span>
            </header>
            <section className="space-y-3 rounded-2xl border p-5" aria-labelledby="order-items-heading">
                <h2 id="order-items-heading" className="text-lg font-semibold">Items</h2>
                {items.length ? items.map((item, index) => {
                    const snapshot = readOrderItemFactSnapshot(item);
                    return <div key={`${item.name || item.title || 'item'}-${index}`} className="min-w-0 border-t py-3"><div className="flex justify-between gap-4"><div><p className="font-medium">{item.name || item.title || 'Item'}</p><p className="text-sm text-[var(--text-secondary)]">Quantity {item.quantity ?? 1}</p></div><strong>{formatMoney(item.price, order.currency)}</strong></div><NicheOrderFacts facts={snapshot?.facts} personalization={snapshot?.personalization} options={savedOrderOptions(snapshot)} itemName={item.name || item.title} /></div>;
                }) : <p className="text-sm">Item details are not available for this order yet.</p>}
                <dl className="space-y-2 border-t pt-3 text-sm">
                    {order.subtotal != null && <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal, order.currency)}</dd></div>}
                    {order.discount != null && Number(order.discount) !== 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatMoney(order.discount, order.currency)}</dd></div>}
                    {order.shipping_cost != null && <div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(order.shipping_cost, order.currency)}</dd></div>}
                    {order.tax != null && <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(order.tax, order.currency)}</dd></div>}
                    <div className="flex justify-between border-t pt-2 text-base font-bold"><dt>Total</dt><dd>{formatMoney(order.total, order.currency)}</dd></div>
                </dl>
            </section>
            {(address || order.tracking_number || order.payment_method || order.payment_status) && <section className="space-y-3 rounded-2xl border p-5"><h2 className="text-lg font-semibold">Delivery and payment</h2>{address && <p><strong>Ship to:</strong> {address}</p>}{order.carrier && <p><strong>Carrier:</strong> {order.carrier}</p>}{order.tracking_number && <p><strong>Tracking:</strong> {order.tracking_number}</p>}{order.payment_method && <p><strong>Payment:</strong> {order.payment_method}{order.payment_status ? ` · ${order.payment_status}` : ''}</p>}</section>}
        </main>
    );
}
