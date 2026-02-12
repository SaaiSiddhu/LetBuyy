import { notFound, redirect } from "next/navigation";
import { getSessionUser, getStoreForUser } from "@/lib/auth/session";
import Sidebar from "@/components/Sidebar";

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
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000';
        redirect(`${accountsUrl}/lookup`);
    }

    // Verify store ownership
    const storeData = await getStoreForUser(store, user.id);
    if (!storeData) {
        notFound();
    }

    const isDraft = storeData.status === 'draft';

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar store={store} />
            <main className="admin-main">
                {/* Draft banner */}
                {isDraft && (
                    <div className="admin-draft-banner">
                        <span>⚠️</span>
                        Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}
