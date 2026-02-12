import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import OrdersClient from './orders-client';

export default async function OrdersPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) {
        return notFound();
    }

    return (
        <OrdersClient
            subdomain={subdomain}
            storeName={store.name}
        />
    );
}
