import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import CheckoutClient from './checkout-client';

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
