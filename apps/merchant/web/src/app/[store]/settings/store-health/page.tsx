import { notFound } from 'next/navigation';
import { getSessionUser, getStoreForUser } from '@/lib/auth/session';
import { createMerchantApiClient } from '@/lib/api/client';
import { StoreReadinessPanel } from '@/components/StoreReadinessPanel';
import { Page } from '@letbuyy/ui';

export default async function StoreHealthPage({ params }: { params: Promise<{ store: string }> }) {
    const { store } = await params;
    const user = await getSessionUser();
    if (!user) notFound();
    const site = await getStoreForUser(store, user.id);
    if (!site) notFound();
    const health = await createMerchantApiClient().stores.health(site.id).catch(() => null);
    return <Page><StoreReadinessPanel store={store} health={health} /></Page>;
}
