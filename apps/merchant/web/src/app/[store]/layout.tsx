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

    // Verify store ownership
    const storeData = await getStoreForUser(store, user.id);
    if (!storeData) {
        notFound();
    }

    // The switcher list is useful but not required for the current store page.
    // If the shared query-cost bucket is draining, keep the merchant workflow open.
    const userStores = await getUserStores(user.id).catch((error) => {
        if (!isQueryCostRateLimited(error)) {
            throw error;
        }

        return [{
            id: storeData.id,
            name: storeData.name,
            store_name: storeData.store_name,
            subdomain: storeData.subdomain,
            site_type: storeData.site_type,
            status: storeData.status,
        }];
    });

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
