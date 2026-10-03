import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import OrderDetailClient from './order-detail-client';

export default async function OrderDetailPage({ params }: { params: Promise<{ subdomain: string; id: string }> }) {
    const { subdomain, id } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid } = await resolveAccountLiquid(subdomain, 'customer_order', 'customers/order', `${basePath}/account/orders/${id}`);
    if (!store || !plan) return notFound();
    if (!isLiquid) return <OrderDetailClient subdomain={subdomain} id={id} />;
    return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
}
