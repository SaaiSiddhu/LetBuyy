import {
    Activity,
    BarChart3,
    ClipboardList,
    CreditCard,
    Gauge,
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
        <div className="flex min-h-screen bg-zinc-950">
            {/* Sidebar */}
            <aside className="hidden w-64 border-r border-zinc-800 lg:block">
                <div className="flex h-16 items-center border-b border-zinc-800 px-6">
                    <h1 className="text-lg font-bold text-zinc-50">LetBuyy</h1>
                    <span className="ml-2 rounded bg-red-600/10 px-2 py-0.5 text-xs font-medium text-red-400">
                        Console
                    </span>
                </div>
                <nav className="space-y-1 p-4">
                    <ConsoleNavLink href="/dashboard" label="Dashboard" icon={<Gauge size={16} />} />
                    <ConsoleNavLink href="/operations" label="Operations" icon={<Activity size={16} />} />
                    <ConsoleNavLink href="/trust-safety" label="Trust & Safety" icon={<ShieldAlert size={16} />} />
                    <ConsoleNavLink href="/users" label="Users" icon={<Users size={16} />} />
                    <ConsoleNavLink href="/stores" label="Stores" icon={<Store size={16} />} />
                    <ConsoleNavLink href="/subscriptions" label="Subscriptions" icon={<CreditCard size={16} />} />
                    <ConsoleNavLink href="/employees" label="Employees" icon={<Shield size={16} />} />
                    <ConsoleNavLink href="/analytics" label="Analytics" icon={<BarChart3 size={16} />} />
                    <ConsoleNavLink href="/settings" label="Settings" icon={<Settings size={16} />} />
                    <ConsoleNavLink href="/audit-logs" label="Audit Logs" icon={<ClipboardList size={16} />} />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1">
                <header className="flex min-h-16 items-center justify-end gap-4 border-b border-zinc-800 px-6">
                    <span className="text-sm text-zinc-400">{session.email}</span>
                    <form action="/api/console-auth/logout" method="post">
                        <button
                            type="submit"
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
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
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
            <span className="grid h-5 w-5 place-items-center">{icon}</span>
            {label}
        </a>
    );
}
