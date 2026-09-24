import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return { title: 'Order Confirmation' };

    return buildStoreMetadata(store, {
        title: `Order Confirmation | ${store.name}`,
        description: `Order confirmation from ${store.name}.`,
        path: '/checkout/success',
        noIndex: true,
    });
}

export default function CheckoutSuccessLayout({ children }: { children: ReactNode }) {
    return children;
}
