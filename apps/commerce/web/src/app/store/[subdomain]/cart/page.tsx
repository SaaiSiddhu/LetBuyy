import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import CartPageClient from './cart-client';

export const revalidate = 0;

// The cart is browser-owned (the cart token lives in localStorage), so this server component only
// resolves the render plan. When the store's theme renders via Liquid AND ships a `cart` template, the
// cart page renders through the shared StorefrontCompositionEngine (the lb-cart island then hydrates
// the browser cart). Otherwise it falls back to the existing React cart UI unchanged. Checkout is not
// touched in either path.
export default async function CartPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    const plan = resolveStorefrontTemplate(store, {
        type: 'cart',
        path: `/store/${subdomain}/cart`,
        subdomain,
    });

    if (plan.rendererEngine === 'liquid') {
        // No product data binding needed: the cart drop is browser_hydrated (collectLiquidCart).
        const sectionData = new Map<string, SectionRenderData>();
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={sectionData} />;
    }

    return <CartPageClient />;
}
