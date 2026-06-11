import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import { notFound } from 'next/navigation';
import CheckoutClient from './checkout-client';
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

export default async function CheckoutPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) {
        return notFound();
    }

    return (
        <CheckoutClient
            storeId={store.id}
            sellerId={store.sellerId}
            subdomain={subdomain}
            storeName={store.name}
            codEnabled={store.codEnabled !== false}
            onlinePaymentEnabled={store.onlinePaymentEnabled !== false}
        />
    );
}
