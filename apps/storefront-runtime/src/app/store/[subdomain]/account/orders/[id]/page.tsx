import { notFound, redirect } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';

export default async function OrderDetailPage({
    params,
}: {
    params: Promise<{ subdomain: string; id: string }>;
}) {
    const { subdomain, id } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid, isAuthenticated } = await resolveAccountLiquid(
        subdomain,
        'customer_order',
        'customers/order',
        `${basePath}/account/orders/${id}`,
    );

    if (!store || !plan) return notFound();

    // Authenticated check: if not signed in, redirect to store home.
    if (!isAuthenticated) redirect(basePath);

    if (isLiquid) {
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    // React fallback: no React order-detail page exists yet; fall back to orders list.
    redirect(`${basePath}/account/orders`);
}
