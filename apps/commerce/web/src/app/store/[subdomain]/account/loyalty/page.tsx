import { notFound } from 'next/navigation';
import { resolveAccountLiquid } from '@/lib/account-liquid';
import LoyaltyClient from './loyalty-client';

export default async function LoyaltyPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const basePath = `/store/${subdomain}`;
    const { store, plan } = await resolveAccountLiquid(
        subdomain,
        'customer_account',
        'customers/account',
        `${basePath}/account/loyalty`,
    );
    if (!store || !plan) return notFound();
    return <LoyaltyClient />;
}
