// /store/[subdomain]/password — Renders the Liquid `password` template (password-gate.liquid).
//
// REACHABILITY: on a live, password-protected store, proxy.ts intercepts every request before it
// reaches the Next app tree and rewrites to the platform holding page (`/preview/coming-soon`) —
// this route is never hit by an end shopper. It IS reached in theme-editor preview mode (a valid
// theme_preview_token bypasses the access gate in proxy.ts), which is exactly what it is for: a
// design surface so a merchant can preview the password-gate page. The actual runtime password
// gate (unlock verification, cookie issuance) is unchanged and lives entirely in proxy.ts.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import type { SectionRenderData } from '@/lib/theme-engine/types';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ theme_preview_token?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Coming Soon' };

    return buildStoreMetadata(store, {
        title: `Coming Soon | ${store.name}`,
        description: `${store.name} is password protected.`,
        path: '/password',
        noIndex: true,
    });
}

export default async function PasswordGatePage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = await searchParams;
    const previewToken = await resolveThemePreviewToken(subdomain, query?.theme_preview_token);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const plan = resolveStorefrontTemplate(store, {
        type: 'password',
        path: `/store/${subdomain}/password`,
        subdomain,
    });
    if (plan.liquidTemplateMiss) return notFound();

    return (
        <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />
    );
}
