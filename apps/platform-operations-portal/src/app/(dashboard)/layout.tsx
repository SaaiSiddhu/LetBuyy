import { MaterialIcon, type MaterialIconName } from '@letbuyy/ui';

export default function TeamDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="hidden w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:block">
                <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
                    <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">LetBuyy</h1>
                    <span className="ml-2 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        Team
                    </span>
                </div>
                <nav className="space-y-1 p-4">
                    {/* Items shown based on employee role — TODO: role-based filtering */}
                    <TeamNavLink href="/" label="Dashboard" icon="dashboard" />
                    <TeamNavLink href="/support" label="Support" icon="support" />
                    <TeamNavLink href="/users" label="Users" icon="users" />
                    <TeamNavLink href="/stores" label="Stores" icon="store" />
                    <TeamNavLink href="/marketing" label="Marketing" icon="marketing" />
                    <TeamNavLink href="/operations" label="Operations" icon="analytics" />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 bg-zinc-50 dark:bg-zinc-900">
                {children}
            </main>
        </div>
    );
}

function TeamNavLink({ href, label, icon }: { href: string; label: string; icon: MaterialIconName }) {
    return (
        <a
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
            <MaterialIcon name={icon} size={16} aria-hidden="true" />
            {label}
        </a>
    );
}
