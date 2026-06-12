// V1 ships Razorpay+COD; Stripe deferred (LB-2)
// This route is kept so old links do not 404. Razorpay orders resolve inline
// via the checkout client; this page is only reached via a stale Stripe redirect.
'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Package } from '@letbuyy/ui';
import Link from 'next/link';

export default function OrderStatusPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const [subdomain, setSubdomain] = useState('');

    useEffect(() => {
        params.then(p => setSubdomain(p.subdomain));
    }, [params]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                    <Package size={32} className="text-slate-500" />
                </div>
                <p className="text-lg font-semibold mb-2">Order status</p>
                <p className="text-sm text-theme-secondary mb-6">
                    To check the status of your order, please visit your orders page.
                </p>
                {subdomain && (
                    <Link
                        href={`/store/${subdomain}/orders`}
                        className="inline-flex items-center gap-2 text-sm font-medium"
                        style={{ color: 'var(--primary)' }}
                    >
                        <ArrowLeft size={14} /> View your orders
                    </Link>
                )}
            </div>
        </div>
    );
}
