'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, ArrowLeft, XCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    readWorkerJson,
    storefrontWorkerFetch,
    workerErrorMessage,
} from '@/lib/browser-worker-client';

export default function PayPalReturnPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const searchParams = useSearchParams();
    const token = searchParams.get('token'); // PayPal order ID from redirect
    const orderId = searchParams.get('orderId');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [subdomain, setSubdomain] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        params.then(p => setSubdomain(p.subdomain));
    }, [params]);

    useEffect(() => {
        if (!token || !orderId) {
            setErrorMessage('Missing payment information.');
            setStatus('error');
            return;
        }

        if (!subdomain) return;

        // Capture the PayPal payment
        const capturePayment = async () => {
            try {
                const res = await storefrontWorkerFetch(subdomain, '/payments/paypal/capture', {
                    method: 'POST',
                    body: JSON.stringify({
                        paypalOrderId: token,
                        orderId,
                        idempotencyKey: `paypal-capture-${orderId}-${token}`,
                    }),
                });

                const result = await readWorkerJson<{ captured?: boolean }>(res);

                if (res.ok && result.success !== false) {
                    setStatus('success');
                } else {
                    setErrorMessage(workerErrorMessage(result, 'Payment capture failed.'));
                    setStatus('error');
                }
            } catch (error) {
                console.error('PayPal capture error:', error);
                setErrorMessage('Something went wrong while processing your payment.');
                setStatus('error');
            }
        };

        capturePayment();
    }, [token, orderId, subdomain]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
                <p className="text-sm text-theme-secondary">Processing your PayPal payment...</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle size={32} className="text-red-600" />
                    </div>
                    <p className="text-lg font-semibold mb-2">Payment Failed</p>
                    <p className="text-sm text-theme-secondary mb-6">{errorMessage}</p>
                    <Link href={`/store/${subdomain}/checkout`} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--primary)' }}>
                        <ArrowLeft size={14} /> Try again
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
                    Your PayPal payment has been processed. We&apos;ll begin preparing your order shortly.
                </p>

                <div className="card-theme p-4 rounded-xl shadow-sm mb-6 text-sm text-theme-secondary">
                    <p>A confirmation email will be sent to your PayPal email address.</p>
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
