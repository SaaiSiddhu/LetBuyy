import { notFound, redirect } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';

// Account dashboard. Liquid stores render the existing `customers/account` template (nav + identity).
// React stores have no bare /account page today, so they fall through to the existing /account/orders
// entry point. Anonymous shoppers are redirected to the store home (same target as the React chrome).
export default async function AccountPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid } = await resolveAccountLiquid(
        subdomain,
        'customer_account',
        'customers/account',
        `${basePath}/account`,
    );

    if (!store || !plan) return notFound();

    if (isLiquid) {
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    redirect(`${basePath}/account/orders`);
}
