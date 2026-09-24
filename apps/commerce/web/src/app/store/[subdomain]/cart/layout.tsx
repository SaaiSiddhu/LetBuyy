import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return { title: 'Cart' };

    return buildStoreMetadata(store, {
        title: `Cart | ${store.name}`,
        description: `Review your shopping bag at ${store.name}.`,
        path: '/cart',
        noIndex: true,
    });
}

export default function CartLayout({ children }: { children: ReactNode }) {
    return children;
}
