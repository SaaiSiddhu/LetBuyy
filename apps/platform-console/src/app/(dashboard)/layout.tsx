import {
    Activity,
    AppWindow,
    BarChart3,
    ClipboardList,
    CreditCard,
    Gauge,
    IndianRupee,
    LogOut,
    Settings,
    Shield,
    ShieldAlert,
    Store,
    Users,
} from '@letbuyy/ui';
import { requireConsoleSession } from '@/lib/console-auth-server';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await requireConsoleSession({ mfa: true });

    return (
        <div className="flex min-h-screen bg-[var(--lb-color-bg)]">
            <aside className="hidden w-72 border-r border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] lg:block">
                <div className="flex h-16 items-center border-b border-[var(--lb-color-border)] px-[var(--lb-space-5)]">
                    <h1 className="text-lg font-bold text-[var(--lb-color-text)]">LetBuyy</h1>
                    <span className="ml-2 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-critical-soft)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-xs font-medium text-[var(--lb-color-critical)]">
                        Console
                    </span>
                </div>
                <nav className="space-y-1 p-[var(--lb-space-4)]">
                    <ConsoleNavLink href="/dashboard" label="Leadership Home" icon={<Gauge size={16} />} />
                    <ConsoleNavLink href="/stores" label="Merchant Directory" icon={<Store size={16} />} />
                    <ConsoleNavLink href="/revenue" label="Revenue" icon={<IndianRupee size={16} />} />
                    <ConsoleNavLink href="/subscriptions" label="Subscriptions" icon={<CreditCard size={16} />} />
                    <ConsoleNavLink href="/marketplace-governance" label="Marketplace Governance" icon={<AppWindow size={16} />} />
                    <ConsoleNavLink href="/trust-safety" label="Trust & Safety" icon={<ShieldAlert size={16} />} />
                    <ConsoleNavLink href="/analytics" label="Analytics" icon={<BarChart3 size={16} />} />
                    <ConsoleNavLink href="/operations" label="Platform Ops" icon={<Activity size={16} />} />
                    <ConsoleNavLink href="/users" label="Users" icon={<Users size={16} />} />
                    <ConsoleNavLink href="/employees" label="Employees" icon={<Shield size={16} />} />
                    <ConsoleNavLink href="/audit-logs" label="Audit Logs" icon={<ClipboardList size={16} />} />
                    <ConsoleNavLink href="/settings" label="Settings" icon={<Settings size={16} />} />
                </nav>
            </aside>

            <main className="flex-1">
                <header className="flex min-h-16 items-center justify-end gap-4 border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-5)]">
                    <span className="text-sm text-[var(--lb-color-text-subdued)]">{session.email}</span>
                    <form action="/api/console-auth/logout" method="post">
                        <button
                            type="submit"
                            className="flex min-h-11 items-center gap-2 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        >
                            <LogOut size={16} />
                            Logout
                        </button>
                    </form>
                </header>
                {children}
            </main>
        </div>
    );
}

function ConsoleNavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
    return (
        <a
            href={href}
            className="flex items-center gap-3 rounded-[var(--lb-radius-lg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-text-subdued)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] hover:text-[var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <span className="grid h-5 w-5 place-items-center">{icon}</span>
            {label}
        </a>
    );
}
