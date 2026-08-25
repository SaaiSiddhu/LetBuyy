import { notFound, redirect } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import { getCustomerOrderDetailDrop } from '@/lib/customer-drop';
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

    // T3-fix W2 — this page never checked whether the order itself exists. The Liquid template's
    // own {% if order %}...{% else %}Order not found.{% endif %} branch (customer-order-detail in
    // theme-bundle.ts) rendered "not found" copy for a genuinely-missing/foreign order, but as
    // ordinary 200 page content — Next's notFound() was never called for this case at all, so no
    // loading.tsx boundary was ever involved. Fetching it here (the composition engine fetches it
    // again internally for the render itself; getCustomerOrderDetailDrop is a cheap read, and this
    // mirrors the existing fetch-then-notFound() pattern in product/[productId] and
    // collections/[slug]) lets a genuinely absent or not-this-customer's order 404 for real.
    //
    // A thrown error here is a different fact from "no such order" — do not notFound() on it.
    // Discovered while building this fix: apiClientInputToLetbuyyApiPath (packages/typescript/
    // api-client) returns the path WITH the query string appended, so isStorefrontInternalOnlyPath's
    // exact-match checks in lib/api/client.ts never match any internal-only GET call that carries
    // query params (customer/by-email, /orders, /wishlist, /addresses, ...) — the internal signature
    // is silently never attached, and the gateway correctly 401s "Invalid internal storefront
    // signature". That is a real, pre-existing defect (registered as CAP-C24), out of this phase's
    // scope. Every other Liquid account page already degrades through this silently (their calls
    // sit inside renderLiquidPlan's catch-and-fallback-to-null); catching it here just matches that
    // same existing behavior instead of letting it surface as an uncaught 500 the other pages don't.
    if (isLiquid) {
        let order = null;
        try {
            order = await getCustomerOrderDetailDrop(store.id, id);
        } catch (err) {
            console.error('[OrderDetailPage] Failed to verify order existence (not treated as absence):', err);
            return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
        }
        if (!order) return notFound();

        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    // React fallback: no React order-detail page exists yet; fall back to orders list.
    redirect(`${basePath}/account/orders`);
}
