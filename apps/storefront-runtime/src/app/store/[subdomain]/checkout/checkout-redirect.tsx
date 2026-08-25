'use client';

import { useEffect, useState } from 'react';
import {
    readStorefrontApiJson,
    storefrontBrowserApiFetch,
    storefrontApiErrorMessage,
} from '@/lib/api/browser-client';

const CART_TOKEN_STORAGE_KEY = 'lb_cart_token';

interface CheckoutUrlResponse {
    checkout_url: string;
}

// T6/W2/W4/W5 — mints the real, signed checkout.<root> handoff for the cart already in this
// browser (services/api-gateway's GET /:subdomain/cart/:cartToken/checkout-url — the same real
// endpoint services/api-gateway/src/routes/storefront/cart-routes.ts already exposed) and hands
// off immediately. There is no fallback to a locally-rendered checkout form: an empty cart or a
// mint failure routes back into the store, never into the old themed page this route used to be.
export default function CheckoutRedirect({ subdomain }: { subdomain: string }) {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function redirect() {
            const cartToken = typeof window !== 'undefined' ? window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) : null;
            if (!cartToken) {
                window.location.replace(`/store/${subdomain}/cart`);
                return;
            }

            try {
                const response = await storefrontBrowserApiFetch(subdomain, `/cart/${encodeURIComponent(cartToken)}/checkout-url`);
                const payload = await readStorefrontApiJson<CheckoutUrlResponse>(response);
                if (!response.ok || !payload.data?.checkout_url) {
                    if (!cancelled) setError(storefrontApiErrorMessage(payload, 'Checkout is temporarily unavailable.'));
                    return;
                }
                window.location.replace(payload.data.checkout_url);
            } catch {
                if (!cancelled) setError('Checkout is temporarily unavailable.');
            }
        }

        void redirect();
        return () => {
            cancelled = true;
        };
    }, [subdomain]);

    if (error) {
        return (
            <main className="flex min-h-screen items-center justify-center px-4 text-center">
                <div>
                    <p className="mb-4 text-sm text-theme-secondary">{error}</p>
                    <a href={`/store/${subdomain}/cart`} className="text-sm font-semibold underline">
                        Back to cart
                    </a>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen items-center justify-center px-4 text-center">
            <p className="text-sm text-theme-secondary">Taking you to secure checkout&hellip;</p>
        </main>
    );
}
