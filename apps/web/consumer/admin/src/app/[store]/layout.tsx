import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser, getStoreForUser, getUserStores } from "@/lib/auth/session";
import AdminShell from "@/components/AdminShell";

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
        // Clear stale session cookie to prevent redirect loops
        const cookieStore = await cookies();
        if (cookieStore.get('lb_session')) {
            cookieStore.delete('lb_session');
        }
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000';
        redirect(`${accountsUrl}/lookup`);
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
