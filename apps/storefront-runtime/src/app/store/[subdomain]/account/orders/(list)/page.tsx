import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import OrdersClient from './orders-client';

// Customer order history. Liquid stores render the existing `customers/orders` template; the
// `customer.orders` drop is fetched route-scoped (only here) via the existing getCustomerOrders
// contract. React stores keep the existing client orders page unchanged.
export default async function OrdersPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid } = await resolveAccountLiquid(
        subdomain,
        'customer_orders',
        'customers/orders',
        `${basePath}/account/orders`,
    );

    if (!store || !plan) return notFound();

    // T2b — no auth-gate redirect for the Liquid path: customer-orders' own template now branches
    // on {% if customer %} with a real "please sign in" guest state (lb-orders__guest), matching
    // every other account section.
    if (isLiquid) {
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    return <OrdersClient />;
}
