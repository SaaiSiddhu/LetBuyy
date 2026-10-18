import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { ResetPasswordForm } from './reset-password-form';

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
    return typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'Reset password',
        robots: { index: false, follow: false },
        referrer: 'no-referrer',
    };
}

export default async function CustomerResetPasswordPage({ params, searchParams }: Props) {
    const [{ subdomain }, query] = await Promise.all([
        params,
        searchParams || Promise.resolve({} as Record<string, string | string[] | undefined>),
    ]);
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const claimedStoreId = firstValue(query.store_id);
    return (
        <ResetPasswordForm
            storeId={store.id}
            storeName={store.name}
            email={firstValue(query.email)}
            token={firstValue(query.token)}
            queryStoreMatches={!claimedStoreId || claimedStoreId.toLowerCase() === store.id.toLowerCase()}
        />
    );
}
