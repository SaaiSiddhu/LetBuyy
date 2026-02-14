import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser, getStoreForUser } from "@/lib/auth/session";
import Sidebar from "@/components/Sidebar";
import TrialBanner from "@/components/TrialBanner";
import HeaderBar from "@/components/HeaderBar";

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

    const isDraft = storeData.status === 'draft';

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar store={store} />
            <main className="admin-main">
                {/* Trial banner */}
                <TrialBanner
                    trialEndsAt={storeData.trial_ends_at}
                    trialStatus={storeData.trial_status}
                />
                {/* Draft banner */}
                {isDraft && (
                    <div className="admin-draft-banner">
                        <span>⚠️</span>
                        Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                    </div>
                )}
                {/* Header bar */}
                <HeaderBar store={store} userName={user.email} />
                {children}
            </main>
        </div>
    );
}
