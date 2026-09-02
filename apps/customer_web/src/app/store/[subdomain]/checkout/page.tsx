import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import { notFound } from 'next/navigation';
import CheckoutRedirect from './checkout-redirect';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return { title: 'Checkout' };

    return buildStoreMetadata(store, {
        title: `Checkout | ${store.name}`,
        description: `Secure checkout for ${store.name}.`,
        path: '/checkout',
        noIndex: true,
    });
}

// T6/W4/W5 — this route no longer renders the checkout form. checkout.<root> (see
// apps/storefront-runtime/src/app/checkout-origin/checkout/page.tsx) is now the one live
// checkout surface: it verifies a signed handoff server-side and carries no merchant theme CSS.
// This page's only remaining job is to mint that handoff for whatever cart is in the browser
// right now and hand the shopper off to it — it must never render the old themed checkout form
// again (that would resurrect the second entry point this phase closed).
export default async function CheckoutPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) {
        return notFound();
    }

    return <CheckoutRedirect subdomain={subdomain} />;
}
