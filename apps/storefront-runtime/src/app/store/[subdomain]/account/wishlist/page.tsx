import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import WishlistPageClient from './wishlist-client';

export default async function WishlistPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid } = await resolveAccountLiquid(
        subdomain,
        'customer_wishlist',
        'customers/wishlist',
        `${basePath}/account/wishlist`,
    );

    if (!store || !plan) return notFound();

    // T2b — no auth-gate redirect for the Liquid path: customer-wishlist's own template already
    // branches on {% elsif customer %} / {% else %} with a real "please sign in" guest state
    // (lb-wishlist__guest).
    if (isLiquid) {
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    return <WishlistPageClient />;
}
