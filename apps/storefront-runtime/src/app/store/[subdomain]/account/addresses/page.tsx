import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import AddressesPageClient from './addresses-client';

export default async function AddressesPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid } = await resolveAccountLiquid(
        subdomain,
        'customer_addresses',
        'customers/addresses',
        `${basePath}/account/addresses`,
    );

    if (!store || !plan) return notFound();

    // T2b — no auth-gate redirect for the Liquid path: customer-addresses' own template already
    // branches on {% if customer %} with a real "please sign in" guest state (lb-addresses__guest).
    // Redirecting away before that ever renders was starving the guest empty-state this phase's
    // brief explicitly requires ("every surface must have a real empty state").
    if (isLiquid) {
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    return <AddressesPageClient />;
}
