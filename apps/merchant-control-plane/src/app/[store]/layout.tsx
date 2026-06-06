import { notFound, redirect } from "next/navigation";
import { getSessionUser, getStoreForUser, getUserStores } from "@/lib/auth/session";
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

    // Get all user's stores for store switcher
    const userStores = await getUserStores(user.id);

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
