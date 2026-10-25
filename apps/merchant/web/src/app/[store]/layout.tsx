import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser, getStoreForUser, getUserStores } from "@/lib/auth/session";
import AdminShell from "@/components/AdminShell";
import { getMerchantSignInUrl, MERCHANT_RETURN_PATH_HEADER } from "@/lib/public-urls";

interface StoreLayoutProps {
    children: React.ReactNode;
    params: Promise<{ store: string }>;
}

export default async function StoreLayout({ children, params }: StoreLayoutProps) {
    const { store } = await params;

    if (!store) {
        notFound();
    }

    // Both endpoints independently authenticate the current cookie. Start them
    // together; neither response can make an unauthorized workspace render.
    const userPromise = getSessionUser();
    const currentStorePromise = getStoreForUser(store);
    const userStoresPromise = userPromise.then(user => user ? getUserStores(user.id) : []).then(
        stores => ({ stores, unavailable: false }),
        () => ({ stores: [], unavailable: true }),
    );
    const [user, storeData] = await Promise.all([userPromise, currentStorePromise]);
    if (!user) {
        const requestHeaders = await headers();
        redirect(getMerchantSignInUrl(requestHeaders.get(MERCHANT_RETURN_PATH_HEADER), `/${encodeURIComponent(store)}/dashboard`));
    }
    if (!storeData) {
        notFound();
    }

    // The switcher list is useful but not required for the current store page.
    // If the shared query-cost bucket is draining, keep the merchant workflow open.
    // Current-store authorization remains mandatory. Stream the optional list
    // independently so it cannot hold the whole workspace blank. Raw errors
    // remain server-side; the switcher gets an explicit unavailable state.
    const userStores = [{
            id: storeData.id,
            name: storeData.name,
            store_name: storeData.store_name,
            subdomain: storeData.subdomain,
            site_type: storeData.site_type,
            status: storeData.status,
        }];

    return (
        <AdminShell
            store={store}
            storeData={storeData}
            user={user}
            userStores={userStores}
            userStoresPromise={userStoresPromise}
        >
            {children}
        </AdminShell>
    );
}
