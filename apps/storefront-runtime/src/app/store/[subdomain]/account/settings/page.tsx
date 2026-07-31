import { notFound, redirect } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import SettingsPageClient from './settings-client';

export default async function SettingsPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan, isLiquid, isAuthenticated } = await resolveAccountLiquid(
        subdomain,
        'customer_settings',
        'customers/settings',
        `${basePath}/account/settings`,
    );

    if (!store || !plan) return notFound();

    if (isLiquid) {
        if (!isAuthenticated) redirect(basePath);
        return <StorefrontCompositionEngine store={store} plan={plan} sectionData={new Map<string, SectionRenderData>()} />;
    }

    return <SettingsPageClient />;
}
