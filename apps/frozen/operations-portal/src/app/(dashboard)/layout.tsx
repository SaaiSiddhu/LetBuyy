import { AppNavigation, MaterialIcon, ThemeToggleButton, type AppNavigationSection } from '@letbuyy/ui';

const NAV_SECTIONS: AppNavigationSection[] = [
    {
        items: [
            { id: 'home', label: 'Dashboard', href: '/', icon: <MaterialIcon name="dashboard" size={16} aria-hidden="true" /> },
            { id: 'crm', label: 'CRM', href: '/crm', icon: <MaterialIcon name="customers" size={16} aria-hidden="true" /> },
            { id: 'tickets', label: 'Tickets', href: '/tickets', icon: <MaterialIcon name="support" size={16} aria-hidden="true" /> },
            { id: 'merchant-health', label: 'Merchant Health', href: '/merchant-health', icon: <MaterialIcon name="store" size={16} aria-hidden="true" /> },
            { id: 'risk', label: 'Risk Decisions', href: '/risk', icon: <MaterialIcon name="shield_lock" size={16} aria-hidden="true" /> },
            { id: 'trust-safety', label: 'Trust & Safety', href: '/trust-safety', icon: <MaterialIcon name="rate_review" size={16} aria-hidden="true" /> },
            { id: 'developers', label: 'Developer 360', href: '/developers', icon: <MaterialIcon name="deployed_code" size={16} aria-hidden="true" /> },
            { id: 'retention', label: 'Retention', href: '/retention', icon: <MaterialIcon name="trending_up" size={16} aria-hidden="true" /> },
            { id: 'campaigns', label: 'Campaigns', href: '/campaigns', icon: <MaterialIcon name="marketing" size={16} aria-hidden="true" /> },
            { id: 'communications', label: 'Communications', href: '/communications', icon: <MaterialIcon name="chat" size={16} aria-hidden="true" /> },
            { id: 'onboarding', label: 'Onboarding', href: '/onboarding', icon: <MaterialIcon name="steps" size={16} aria-hidden="true" /> },
            { id: 'operations', label: 'Review Queue', href: '/operations', icon: <MaterialIcon name="rate_review" size={16} aria-hidden="true" /> },
        ],
    },
];

export default function TeamDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AppNavigation
            sidebarClassName="hidden lg:flex"
            sections={NAV_SECTIONS}
            brand={
                <div className="flex items-center">
                    <span className="text-[length:var(--lb-font-size-card-title)] font-[var(--lb-font-weight-bold)] text-[color:var(--lb-color-text)]">LetBuyy</span>
                    <span className="ml-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-primary-soft)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-primary)]">
                        Ops
                    </span>
                </div>
            }
            topBar={
                <div className="flex items-center justify-end">
                    <ThemeToggleButton label="Toggle operations theme" />
                </div>
            }
        >
            {children}
        </AppNavigation>
    );
}
