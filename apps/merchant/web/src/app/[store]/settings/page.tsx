import Link from 'next/link'
import {
    AppWindow,
    Badge,
    Card,
    PageHeader,
    Section,
    ChevronRight,
    Globe,
    IndianRupee,
    Rocket,
    Store,
    type LucideIcon,
} from '@letbuyy/ui'
import {
    SETTINGS_NAV_ITEMS,
    type SettingsNavItem,
} from '@/components/settings/settings-navigation'

interface PageProps {
    params: Promise<{ store: string }>
}

// Five setup phases mapped from LCIS operating stages:
// Merchant → Commerce (money=true: Orders/Payments/Shipping) → Storefront → Team → Extensions
const PHASES: Array<{
    id: string
    title: string
    description: string
    Icon: LucideIcon
    itemHrefs: string[]
    wide?: boolean
}> = [
    {
        id: 'foundation',
        title: 'Store foundation',
        description: 'Brand identity, business info, and language settings',
        Icon: Store,
        itemHrefs: ['general', 'business', 'localization'],
    },
    {
        id: 'commerce',
        title: 'Commerce',
        description: 'Payments, checkout flow, shipping zones, and tax rates',
        Icon: IndianRupee,
        itemHrefs: ['payments', 'checkout', 'shipping', 'taxes'],
    },
    {
        id: 'storefront',
        title: 'Storefront & trust',
        description: 'Custom domain, customer notifications, and legal policies',
        Icon: Globe,
        itemHrefs: ['domains', 'notifications', 'policies'],
    },
    {
        id: 'team',
        title: 'Plan & team',
        description: 'Subscription, billing history, staff roles, and security',
        Icon: Rocket,
        itemHrefs: ['plan', 'billing', 'users', 'security'],
    },
    {
        id: 'extensions',
        title: 'Extensions',
        description: 'Apps, sales channels, and custom storefront data schemas',
        Icon: AppWindow,
        itemHrefs: ['apps', 'custom-data'],
        wide: true,
    },
]

// Exclude the subscribe/checkout flow — it's a checkout transaction, not a settings section
const DASHBOARD_ITEMS = SETTINGS_NAV_ITEMS.filter(i => i.href !== 'subscribe/checkout')

export default async function SettingsDashboardPage({ params }: PageProps) {
    const { store } = await params

    const totalCount = DASHBOARD_ITEMS.length
    const availableCount = DASHBOARD_ITEMS.filter(i => i.status !== 'backend-needed').length
    const pendingCount = totalCount - availableCount

    return (
        <div className="settings-dashboard">

            {/* ── Hero ── */}
            <Card className="settings-dashboard-hero">
                <PageHeader identity="settings" recipe="settings" title="Dashboard" showIcon={false} description="Configure every aspect of your store — from payments and shipping to your custom domain and team. Use this guide to get ready for your first sale." showDescription />
                <div className="settings-dashboard-hero-stats">
                    <Badge label={`${availableCount} available now`} variant="success" />
                    {pendingCount > 0 && <Badge label={`${pendingCount} coming soon`} variant="warning" />}
                </div>
            </Card>

            {/* ── Setup phases grid ── */}
            <div className="settings-dashboard-phases">
                {PHASES.map((phase) => {
                    const phaseItems = phase.itemHrefs
                        .map(href => DASHBOARD_ITEMS.find(i => i.href === href))
                        .filter((item): item is SettingsNavItem => Boolean(item))

                    const phaseAvailable = phaseItems.filter(i => i.status !== 'backend-needed').length
                    const allReady = phaseAvailable === phaseItems.length
                    const PhaseIcon = phase.Icon

                    return (
                        <Card
                            key={phase.id}
                            className={`settings-dashboard-phase${phase.wide ? ' settings-dashboard-phase--wide' : ''}`}
                        >
                            <Section title={phase.title} description={phase.description} action={
                                <span className="inline-flex items-center gap-[var(--lb-space-2)]">
                                    <span className="settings-dashboard-phase-icon"><PhaseIcon className="letbuyy-icon" aria-hidden="true" /></span>
                                    <Badge aria-label={`${phaseAvailable} of ${phaseItems.length} settings available`} label={`${phaseAvailable}/${phaseItems.length}`} variant={allReady ? 'success' : 'warning'} />
                                </span>
                            }>{null}</Section>

                            {/* Task rows */}
                            {phaseItems.map((item) => {
                                const isReady = item.status !== 'backend-needed'
                                const ItemIcon = item.Icon
                                const href = `/${store}/settings/${item.href}`

                                if (!isReady) {
                                    return (
                                        <div key={item.href} className="settings-dashboard-task settings-dashboard-task--disabled">
                                            <span className="settings-dashboard-task-icon">
                                                <ItemIcon className="letbuyy-icon" aria-hidden="true" />
                                            </span>
                                            <span className="settings-dashboard-task-body">
                                                <span className="settings-dashboard-task-label">{item.label}</span>
                                                <span className="settings-dashboard-task-desc">{item.description}</span>
                                            </span>
                                            <span className="settings-dashboard-task-soon">Coming soon</span>
                                        </div>
                                    )
                                }

                                return (
                                    <Link prefetch={false} key={item.href} href={href} className="settings-dashboard-task">
                                        <span className="settings-dashboard-task-icon">
                                            <ItemIcon className="letbuyy-icon" aria-hidden="true" />
                                        </span>
                                        <span className="settings-dashboard-task-body">
                                            <span className="settings-dashboard-task-label">{item.label}</span>
                                            <span className="settings-dashboard-task-desc">{item.description}</span>
                                        </span>
                                        <span className="settings-dashboard-task-cta">
                                            Configure
                                            <ChevronRight className="letbuyy-icon" aria-hidden="true" />
                                        </span>
                                    </Link>
                                )
                            })}
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
