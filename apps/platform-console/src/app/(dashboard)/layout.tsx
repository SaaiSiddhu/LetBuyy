export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
                    <ConsoleNavLink href="/dashboard" label="Dashboard" icon="📊" />
                    <ConsoleNavLink href="/users" label="Users" icon="👤" />
                    <ConsoleNavLink href="/stores" label="Stores" icon="🏪" />
                    <ConsoleNavLink href="/subscriptions" label="Subscriptions" icon="💳" />
                    <ConsoleNavLink href="/employees" label="Employees" icon="👥" />
                    <ConsoleNavLink href="/analytics" label="Analytics" icon="📈" />
                    <ConsoleNavLink href="/settings" label="Settings" icon="⚙️" />
                    <ConsoleNavLink href="/audit-logs" label="Audit Logs" icon="📋" />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>
        </div>
    );
}

function ConsoleNavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
    return (
        <a
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100"
        >
            <span>{icon}</span>
            {label}
        </a>
    );
}
