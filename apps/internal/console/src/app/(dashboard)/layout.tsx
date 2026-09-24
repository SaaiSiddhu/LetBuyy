import {
    Activity,
    AlertCircle,
    AppNavigation,
    AppWindow,
    Award,
    BarChart3,
    Button,
    ShieldCheck,
    ClipboardList,
    Code2,
    CreditCard,
    Gauge,
    IndianRupee,
    LogOut,
    Settings,
    Shield,
    ShieldAlert,
    Store,
    ThemeToggleButton,
    Users,
    type AppNavigationSection,
} from '@letbuyy/ui';
import { requireConsoleSession } from '@/lib/console-auth-server';

const NAV_SECTIONS: AppNavigationSection[] = [
    {
        items: [
            { id: 'dashboard', label: 'Leadership Home', href: '/dashboard', icon: <Gauge size={16} /> },
            { id: 'stores', label: 'Merchant Directory', href: '/stores', icon: <Store size={16} /> },
            { id: 'merchants', label: 'Merchant 360', href: '/merchants', icon: <Store size={16} /> },
            { id: 'revenue', label: 'Revenue', href: '/revenue', icon: <IndianRupee size={16} /> },
            { id: 'money-reconciliation', label: 'Money Reconciliation', href: '/money-reconciliation', icon: <IndianRupee size={16} /> },
            { id: 'subscriptions', label: 'Subscriptions', href: '/subscriptions', icon: <CreditCard size={16} /> },
            { id: 'founding', label: 'Founding Merchants', href: '/founding', icon: <Award size={16} /> },
            { id: 'marketplace-governance', label: 'Marketplace Governance', href: '/marketplace-governance', icon: <AppWindow size={16} /> },
            { id: 'risk', label: 'Risk Detection', href: '/risk', icon: <ShieldAlert size={16} /> },
            { id: 'trust-safety', label: 'Trust & Safety', href: '/trust-safety', icon: <ShieldAlert size={16} /> },
            { id: 'analytics', label: 'Analytics', href: '/analytics', icon: <BarChart3 size={16} /> },
            { id: 'developers', label: 'Developers', href: '/developers', icon: <Code2 size={16} /> },
            { id: 'incidents', label: 'Incidents', href: '/incidents', icon: <AlertCircle size={16} /> },
            { id: 'operations', label: 'Platform Ops', href: '/operations', icon: <Activity size={16} /> },
            { id: 'compliance', label: 'Compliance', href: '/compliance', icon: <ShieldCheck size={16} /> },
            { id: 'users', label: 'Users', href: '/users', icon: <Users size={16} /> },
            { id: 'employees', label: 'Employees', href: '/employees', icon: <Shield size={16} /> },
            { id: 'audit-logs', label: 'Audit Logs', href: '/audit-logs', icon: <ClipboardList size={16} /> },
            { id: 'settings', label: 'Settings', href: '/settings', icon: <Settings size={16} /> },
        ],
    },
];

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await requireConsoleSession({ mfa: true });

    return (
        <AppNavigation
            sidebarClassName="hidden lg:flex"
            sections={NAV_SECTIONS}
            brand={
                <div className="flex items-center">
                    <span className="text-[length:var(--lb-font-size-card-title)] font-[var(--lb-font-weight-bold)] text-[color:var(--lb-color-text)]">LetBuyy</span>
                    <span className="ml-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-critical-soft)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-critical)]">
                        Console
                    </span>
                </div>
            }
            topBar={
                <div className="flex items-center justify-end gap-[var(--lb-space-4)]">
                    <ThemeToggleButton label="Toggle console theme" />
                    <span className="text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">{session.email}</span>
                    <form action="/api/console-auth/logout" method="post">
                        <Button
                            unstyled
                            type="submit"
                            className="flex min-h-11 items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        >
                            <LogOut size={16} />
                            Logout
                        </Button>
                    </form>
                </div>
            }
        >
            {children}
        </AppNavigation>
    );
}
