import { MaterialIcon, type MaterialIconName } from '@letbuyy/ui';

export default function TeamDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-[var(--lb-color-bg)]">
            <aside className="hidden w-72 border-r border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] lg:block">
                <div className="flex h-16 items-center border-b border-[var(--lb-color-border)] px-[var(--lb-space-5)]">
                    <h1 className="text-lg font-bold text-[var(--lb-color-text)]">LetBuyy</h1>
                    <span className="ml-2 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-primary-soft)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-xs font-medium text-[var(--lb-color-primary)]">
                        Ops
                    </span>
                </div>
                <nav className="space-y-1 p-[var(--lb-space-4)]">
                    <TeamNavLink href="/" label="Dashboard" icon="dashboard" />
                    <TeamNavLink href="/crm" label="CRM" icon="customers" />
                    <TeamNavLink href="/tickets" label="Tickets" icon="support" />
                    <TeamNavLink href="/merchant-health" label="Merchant Health" icon="store" />
                    <TeamNavLink href="/risk" label="Risk Decisions" icon="shield_lock" />
                    <TeamNavLink href="/trust-safety" label="Trust & Safety" icon="rate_review" />
                    <TeamNavLink href="/developers" label="Developer 360" icon="deployed_code" />
                    <TeamNavLink href="/retention" label="Retention" icon="trending_up" />
                    <TeamNavLink href="/campaigns" label="Campaigns" icon="marketing" />
                    <TeamNavLink href="/communications" label="Communications" icon="chat" />
                    <TeamNavLink href="/onboarding" label="Onboarding" icon="steps" />
                    <TeamNavLink href="/operations" label="Review Queue" icon="rate_review" />
                </nav>
            </aside>

            <main className="flex-1">
                {children}
            </main>
        </div>
    );
}

function TeamNavLink({ href, label, icon }: { href: string; label: string; icon: MaterialIconName }) {
    return (
        <a
            href={href}
            className="flex items-center gap-3 rounded-[var(--lb-radius-lg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm font-medium text-[var(--lb-color-text-subdued)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] hover:text-[var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <MaterialIcon name={icon} size={16} aria-hidden="true" />
            {label}
        </a>
    );
}
