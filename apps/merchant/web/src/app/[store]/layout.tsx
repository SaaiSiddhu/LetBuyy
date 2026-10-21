import { notFound, redirect } from "next/navigation";
import { getSessionUser, getStoreForUser, getUserStores, isQueryCostRateLimited } from "@/lib/auth/session";
import AdminShell from "@/components/AdminShell";
import { getAccountsUrl } from "@/lib/public-urls";

interface StoreLayoutProps {
    children: React.ReactNode;
    params: Promise<{ store: string }>;
}

export default async function StoreLayout({ children, params }: StoreLayoutProps) {
    const { store } = await params;

    if (!store) {
        notFound();
    }

    // Validate session
    const user = await getSessionUser();
    if (!user) {
        redirect(getAccountsUrl('/lookup'));
    }

    // Both readers independently authorize this session. Start the optional
    // switcher alongside the current store rather than adding a serial round trip.
    // Settle its rejection immediately so a missing store cannot leave it unhandled.
    const storesPromise = getUserStores(user.id).then(
        (stores) => ({ stores, error: null }),
        (error: unknown) => ({ stores: null, error }),
    );
    const storeData = await getStoreForUser(store, user.id);
    if (!storeData) {
        notFound();
    }

    // The switcher list is useful but not required for the current store page.
    // If the shared query-cost bucket is draining, keep the merchant workflow open.
    const storeList = await storesPromise;
    const userStores = storeList.stores ?? (() => {
        if (!isQueryCostRateLimited(storeList.error)) {
            throw storeList.error;
        }

        return [{
            id: storeData.id,
            name: storeData.name,
            store_name: storeData.store_name,
            subdomain: storeData.subdomain,
            site_type: storeData.site_type,
            status: storeData.status,
        }];
    })();

    return (
        <AdminShell
            store={store}
            storeData={storeData}
            user={user}
            userStores={userStores}
        >
            {children}
        </AdminShell>
    );
}
