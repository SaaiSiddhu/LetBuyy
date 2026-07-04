// /store/[subdomain]/customers/login — Dedicated login page for Liquid-engine stores.
//
// WHY THIS EXISTS: The catch-all [...path]/page.tsx at the sibling level only handles single-segment
// paths (path.length !== 1 → notFound()). The route /customers/login is two segments, so it is
// NOT caught by the catch-all. This dedicated page fills that gap and routes through the
// StorefrontCompositionEngine with liquidTemplateKey='customers/login'.
//
// The customers/login Liquid template (E8) now includes a hidden <input name="storeId"> so the
// no-JS form POST to /api/customer/login carries the storeId, mirroring the D10 register pattern.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import type { SectionRenderData } from '@/lib/theme-engine/types';

export const revalidate = 60;

type Props = {
    params: Promise<{ subdomain: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Sign In' };
    return buildStoreMetadata(store, {
        title: `Sign In | ${store.name}`,
        description: `Sign in to your ${store.name} account.`,
        path: '/customers/login',
    });
}

export default async function CustomerLoginPage({ params }: Props) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const renderPlan = resolveStorefrontTemplate(store, {
        type: 'customer_account',
        path: `/store/${subdomain}/customers/login`,
        subdomain,
        templateKey: 'customers/login',
    });

    const sectionData = new Map<string, SectionRenderData>();

    return (
        <StorefrontCompositionEngine
            store={store}
            plan={renderPlan}
            sectionData={sectionData}
        />
    );
}
