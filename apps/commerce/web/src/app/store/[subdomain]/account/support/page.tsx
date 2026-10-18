import { notFound } from 'next/navigation';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import SupportClient from './support-client';

export default async function SupportPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan } = await resolveAccountLiquid(subdomain, 'customer_settings', 'customers/settings', `${basePath}/account/support`);
    if (!store || !plan) return notFound();
    return <SupportClient subdomain={subdomain} />;
}
