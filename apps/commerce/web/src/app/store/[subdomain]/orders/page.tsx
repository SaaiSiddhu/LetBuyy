import { StoreService } from '@/lib/store-service';
import { notFound, redirect } from 'next/navigation';

export default async function OrdersPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) {
        return notFound();
    }

    // Keep legacy storefront links useful while sending every order-history
    // request through signed buyer ownership and explicit verified-email claim.
    redirect(`/store/${encodeURIComponent(subdomain)}/account/orders`);
}
