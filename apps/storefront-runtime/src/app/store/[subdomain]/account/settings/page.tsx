import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import SettingsPageClient from './settings-client';

export default async function SettingsPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid } = await resolveAccountLiquid(
        subdomain,
        'customer_settings',
        'customers/settings',
        `${basePath}/account/settings`,
    );

    if (!store || !plan) return notFound();

    // T2b — no auth-gate redirect for the Liquid path: customer-settings' own template already
    // branches on {% if customer %} with a real "please sign in" guest state (lb-settings__guest).
    if (isLiquid) {
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    return <SettingsPageClient />;
}
