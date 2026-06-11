'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from '@letbuyy/ui';
import Link from 'next/link';
import { StorefrontListLoadingState } from '@/components/storefront/storefront-states';

export default function StripeSuccessPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState<'loading' | 'error'>('loading');
    const [subdomain, setSubdomain] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        params.then(p => setSubdomain(p.subdomain));
    }, [params]);

    useEffect(() => {
        if (!subdomain) return;

        if (!sessionId) {
            setErrorMessage('Missing payment session.');
            setStatus('error');
            return;
        }

        setErrorMessage('We could not verify this Stripe payment with the store backend.');
        setStatus('error');
    }, [sessionId, subdomain]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="w-full max-w-xl">
                    <StorefrontListLoadingState rows={3} />
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center">
                    <p className="text-lg font-semibold mb-2">Payment verification required</p>
                    <p className="text-sm text-theme-secondary mb-4">{errorMessage || 'We could not verify your payment session.'}</p>
                    <Link href={`/store/${subdomain}/checkout`} className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
                        <ArrowLeft size={14} className="inline mr-1" /> Return to checkout
                    </Link>
                </div>
            </div>
        );
    }

    return null;
}
