// ============================================================
// ACCOUNT LAYOUT — Server router (Slice 7, approved B3 refactor)
// Liquid store  → pass-through (the Liquid customers/* templates carry their own
//                 chrome + account nav; auth is enforced per page via getSession).
// React store   → the existing client AccountChrome (useCustomerAuth + sidebar),
//                 unchanged. No new auth, no new session logic.
// ============================================================

import type { ReactNode } from 'react';
import { StoreService } from '@/lib/store-service';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import AccountChromeClient from './account-chrome-client';

async function storeRendersLiquid(subdomain: string): Promise<boolean> {
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return false;
    return resolveStorefrontTemplate(store, {
        type: 'customer_account',
        templateKey: 'customers/account',
        path: `/store/${subdomain}/account`,
        subdomain,
    }).rendererEngine === 'liquid';
}

export default async function AccountLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ subdomain: string }>;
}) {
    const { subdomain } = await params;

    if (await storeRendersLiquid(subdomain)) {
        return <>{children}</>;
    }

    return <AccountChromeClient>{children}</AccountChromeClient>;
}
