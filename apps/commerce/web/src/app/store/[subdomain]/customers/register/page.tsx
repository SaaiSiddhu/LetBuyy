// /store/[subdomain]/customers/register — Dedicated register page for Liquid-engine stores.
// The dedicated page exists so the Liquid theme can offer canonical buyer sign-in/registration at
// this store's account entry point. Existing per-store password customers can still use login and
// link their verified account from settings.
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
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// T1/W2 — Next.js searchParams values can be string | string[] | undefined; the Liquid request.query
// drop only makes sense as flat strings (it is display text, never parsed), so a repeated query key
// takes its first occurrence rather than silently rendering "a,b".
function flattenSearchParams(params: Record<string, string | string[] | undefined> | undefined): Record<string, string> {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(params || {})) {
        if (typeof value === 'string') flat[key] = value;
        else if (Array.isArray(value) && typeof value[0] === 'string') flat[key] = value[0];
    }
    return flat;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Create Account' };
    return buildStoreMetadata(store, {
        title: `Create Account | ${store.name}`,
        description: `Create a ${store.name} account.`,
        path: '/customers/register',
    });
}

export default async function CustomerRegisterPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = flattenSearchParams(await searchParams);
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const plan = resolveStorefrontTemplate(store, {
        type: 'customer_account',
        path: `/store/${subdomain}/customers/register`,
        subdomain,
        templateKey: 'customers/register',
        searchParams: query,
    });
    if (plan.liquidTemplateMiss) return notFound();

    return (
        <StorefrontCompositionEngine
            store={store}
            plan={plan}
            sectionData={new Map<string, SectionRenderData>()}
        />
    );
}
