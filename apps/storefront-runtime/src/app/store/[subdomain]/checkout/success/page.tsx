'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, ArrowLeft } from '@letbuyy/ui';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function StripeSuccessPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [subdomain, setSubdomain] = useState('');

    useEffect(() => {
        params.then(p => setSubdomain(p.subdomain));
    }, [params]);

    useEffect(() => {
        if (!sessionId) {
            setStatus('error');
            return;
        }

        // Verify the session with backend (optional enhancement)
        // For now, we trust Stripe's redirect and mark as success
        setStatus('success');
    }, [sessionId]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin" size={32} />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center">
                    <p className="text-lg font-semibold mb-2">Something went wrong</p>
                    <p className="text-sm text-theme-secondary mb-4">We couldn&apos;t verify your payment session.</p>
                    <Link href={`/store/${subdomain}`} className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
                        <ArrowLeft size={14} className="inline mr-1" /> Return to store
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-md"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center"
                >
                    <CheckCircle size={40} className="text-green-600" />
                </motion.div>

                <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
                <p className="text-theme-secondary mb-6">
                    Thank you for your order. We&apos;ve received your payment and will begin processing it shortly.
                </p>

                <div className="card-theme p-4 rounded-xl shadow-sm mb-6 text-sm text-theme-secondary">
                    <p>A confirmation email will be sent to your email address shortly.</p>
                </div>

                <Link
                    href={`/store/${subdomain}`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
                    style={{ backgroundColor: 'var(--primary)' }}
                >
                    <ArrowLeft size={16} /> Continue Shopping
                </Link>
            </motion.div>
        </div>
    );
}
