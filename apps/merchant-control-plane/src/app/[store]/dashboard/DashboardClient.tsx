'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import type {
    DashboardActivity,
    DashboardHomeData,
    SetupStatus,
    StoreInfo,
} from './page'
import { FoundingMerchantCard } from '@/components/founding/FoundingMerchantCard'
import { Button,
    Badge,
    Banner,
    Card,
    EmptyState,
    MaterialIcon,
    MetricCard,
    Page,
    PageHeader,
    Section,
    Skeleton,
} from '@letbuyy/ui'

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'
type SetupCheckKey = keyof SetupStatus

interface DashboardClientProps {
    store: string
    storeInfo: StoreInfo
    setupStatus: SetupStatus
    homeData: DashboardHomeData
}

interface SetupHeroConfig {
    icon: string
    title: string
    description: string
    actionText: string
    actionLink: string
}

interface SetupMiniConfig {
    title: string
    icon: string
    actionText: string
    actionLink: string
    checkKey?: SetupCheckKey
    showDomain?: boolean
}

interface SetupConfig {
    dashboardDescription: string
    primary: SetupHeroConfig
    secondary: SetupHeroConfig
    miniCards: SetupMiniConfig[]
}

interface SetupChecklistItem {
    title: string
    description: string
    icon: string
    actionText: string
    actionLink: string
    complete: boolean
    detail?: string
}

export default function DashboardClient({ store, storeInfo, setupStatus, homeData }: DashboardClientProps) {
    const config = SETUP_CONFIGS[storeInfo.site_type] || SETUP_CONFIGS.store
    const currentDomain = storeInfo.custom_domain || `${storeInfo.subdomain}.letbuyy.com`

    return (
        <Page>
            <PageHeader
                breadcrumbs={[{ label: 'Home' }]}
                eyebrow={formatSiteType(storeInfo.site_type)}
                title={storeInfo.name || store}
                description={`${config.dashboardDescription} Your current domain is ${currentDomain}.`}
                showIcon={false}
                primaryAction={{
                    label: config.primary.actionText,
                    href: `/${store}/${config.primary.actionLink}`,
                    icon: <MaterialIcon name={config.primary.icon} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
                }}
                secondaryActions={[
                    {
                        label: 'Store settings',
                        href: `/${store}/settings`,
                        icon: <MaterialIcon name="settings" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
                    },
                ]}
            />

            <PlanBanner
                store={store}
                trialEndsAt={storeInfo.trial_ends_at}
                trialStatus={storeInfo.trial_status}
            />

            <FoundingMerchantCard />

            <HomeMetrics homeData={homeData} />

            <SetupCards
                store={store}
                siteType={storeInfo.site_type}
                setupStatus={setupStatus}
                currentDomain={currentDomain}
                storeStatus={storeInfo.status}
            />

            <RecentActivity store={store} activities={homeData.recentActivity} />

            <PlanUpsell store={store} />
        </Page>
    )
}

interface SetupCardsProps {
    store: string
    siteType: SiteType
    setupStatus: SetupStatus
    currentDomain: string
    storeStatus: string
}

function SetupCards({ store, siteType, setupStatus, currentDomain, storeStatus }: SetupCardsProps) {
    const router = useRouter()
    const [copiedDomain, setCopiedDomain] = useState(false)
    const config = SETUP_CONFIGS[siteType] || SETUP_CONFIGS.store
    const checklist = useMemo(
        () => buildSetupChecklist({ config, currentDomain, setupStatus, siteType, storeStatus }),
        [config, currentDomain, setupStatus, siteType, storeStatus],
    )
    const totalSteps = checklist.length
    const completedSteps = checklist.filter((item) => item.complete).length
    const completionPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
    const nextStepIndex = checklist.findIndex((item) => !item.complete)
    const nextStep = nextStepIndex >= 0 ? checklist[nextStepIndex] : null
    const blockers = checklist.filter((item) => !item.complete)
    const allDone = completedSteps === totalSteps

    const navigateTo = (path: string) => router.push(`/${store}/${path}`)
    const copyDomain = () => {
        void navigator.clipboard.writeText(currentDomain).then(() => {
            setCopiedDomain(true)
            window.setTimeout(() => setCopiedDomain(false), 1800)
        })
    }

    const circumference = 2 * Math.PI * 29
    const dashOffset = circumference * (1 - completionPercent / 100)

    return (
        <Card>
            <Section
                title="Setup guide"
                description={nextStep
                    ? `Next: ${nextStep.title}. ${nextStep.description}`
                    : 'All recommended launch steps are complete. Keep reviewing your storefront as orders come in.'}
                action={
                    <Badge
                        label={`${completedSteps}/${totalSteps} complete`}
                        variant={allDone ? 'success' : 'info'}
                    />
                }
            >
                {/* ── Hero banner ── */}
                <div className="relative overflow-hidden rounded-[var(--lb-radius-xl)] border border-[var(--lb-component-card-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                    {/* Ambient glow blobs */}
                    <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)] opacity-[0.07] blur-3xl" aria-hidden="true" />
                    <div className="pointer-events-none absolute -bottom-8 left-6 h-28 w-28 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)] opacity-[0.04] blur-2xl" aria-hidden="true" />

                    <div className="relative flex flex-col gap-[var(--lb-space-3)] sm:flex-row sm:items-center sm:justify-between">
                        {/* Left: heading block */}
                        <div className="space-y-[var(--lb-space-1)]">
                            <span className="inline-flex items-center gap-[4px] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] px-[var(--lb-space-2)] py-[2px] text-[10px] font-[var(--lb-font-weight-semibold)] uppercase tracking-[0.08em] text-[color:var(--lb-color-primary)]">
                                <MaterialIcon name="rocket_launch" size={10} aria-hidden="true" />
                                Launch checklist
                            </span>
                            <h2 className="m-0 text-[length:var(--lb-font-size-h4)] font-[var(--lb-font-weight-bold)] leading-[1.2] tracking-[-0.01em] text-[color:var(--lb-color-text)]">
                                Opening checklist for{' '}
                                <span className="text-[color:var(--lb-color-primary)]">{store}</span>
                            </h2>
                            <p className="m-0 max-w-[360px] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                {allDone
                                    ? 'All setup blockers are cleared.'
                                    : `${blockers.length} step${blockers.length !== 1 ? 's' : ''} remaining before publication readiness.`}
                            </p>
                        </div>

                        {/* Right: circular progress card */}
                        <div className="flex shrink-0 flex-row items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-xl)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] px-[var(--lb-space-4)] py-[var(--lb-space-3)] shadow-[var(--lb-shadow-md)] sm:flex-col sm:gap-[var(--lb-space-2)]">
                            <div className="relative flex items-center justify-center">
                                <svg
                                    width="64"
                                    height="64"
                                    viewBox="0 0 72 72"
                                    style={{ transform: 'rotate(-90deg)' }}
                                    aria-hidden="true"
                                >
                                    <circle cx="36" cy="36" r="29" fill="none" stroke="var(--lb-color-border)" strokeWidth="6" />
                                    <circle
                                        cx="36" cy="36" r="29"
                                        fill="none"
                                        stroke="var(--lb-color-primary)"
                                        strokeWidth="6"
                                        strokeLinecap="round"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={dashOffset}
                                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                    />
                                </svg>
                                <span
                                    className="absolute text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-bold)] leading-none text-[color:var(--lb-color-text)]"
                                    aria-live="polite"
                                >
                                    {completionPercent}%
                                </span>
                            </div>
                            <div className="text-left sm:text-center">
                                <p className="m-0 text-[10px] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]">
                                    Setup progress
                                </p>
                                <p className="m-0 text-[10px] text-[color:var(--lb-color-text-subdued)]">
                                    {completedSteps} of {totalSteps} complete
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Step list ── */}
                <div className="grid gap-[var(--lb-space-2)]">
                    {checklist.map((item, index) => {
                        const isNext = index === nextStepIndex
                        const isDone = item.complete

                        return (
                            <div
                                key={item.title}
                                className={[
                                    'grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-3)] transition-all duration-[var(--lb-motion-normal)] md:grid-cols-[auto_1fr_auto] md:items-center',
                                    isNext
                                        ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] shadow-[0_0_0_1px_var(--lb-color-primary)]'
                                        : isDone
                                            ? 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] opacity-60'
                                            : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]',
                                ].join(' ')}
                            >
                                <div className="flex items-start gap-[var(--lb-space-3)] md:contents">
                                    {/* Step indicator */}
                                    <div className={[
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] text-[11px] font-[var(--lb-font-weight-bold)] transition-all duration-[var(--lb-motion-normal)]',
                                        isDone
                                            ? 'bg-[var(--lb-color-success-soft)] text-[color:var(--lb-color-success)]'
                                            : isNext
                                                ? 'bg-[var(--lb-color-primary)] text-white shadow-[0_4px_14px_rgba(139,92,246,0.4)]'
                                                : 'border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-color-text-subdued)]',
                                    ].join(' ')}>
                                        {isDone
                                            ? <MaterialIcon name="check" size={16} aria-hidden="true" />
                                            : <span>{index + 1}</span>}
                                    </div>

                                    {/* Content */}
                                    <div className="min-w-0 space-y-[var(--lb-space-1)]">
                                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                            <MaterialIcon
                                                name={item.icon}
                                                size={15}
                                                className={[
                                                    'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]',
                                                    isDone ? 'text-[color:var(--lb-color-text-subdued)]' : 'text-[color:var(--lb-color-primary)]',
                                                ].join(' ')}
                                                aria-hidden="true"
                                            />
                                            <h3 className={[
                                                'm-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]',
                                                isDone ? 'text-[color:var(--lb-color-text-subdued)]' : 'text-[color:var(--lb-color-text)]',
                                            ].join(' ')}>
                                                {item.title}
                                            </h3>
                                            {isNext && (
                                                <span className="rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)] px-[var(--lb-space-2)] py-[2px] text-[10px] font-[var(--lb-font-weight-semibold)] uppercase tracking-[0.05em] text-white">
                                                    Up next
                                                </span>
                                            )}
                                            {isDone && (
                                                <span className="rounded-[var(--lb-radius-full)] bg-[var(--lb-color-success-soft)] px-[var(--lb-space-2)] py-[2px] text-[10px] font-[var(--lb-font-weight-semibold)] uppercase tracking-[0.05em] text-[color:var(--lb-color-success)]">
                                                    Done
                                                </span>
                                            )}
                                        </div>
                                        <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                            {item.description}
                                        </p>
                                        {item.detail && (
                                            <div className="mt-[var(--lb-space-2)] flex max-w-xs items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
                                                <MaterialIcon name="link" size={13} className="shrink-0 text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                                                <span className="min-w-0 flex-1 truncate font-mono text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                    {item.detail}
                                                </span>
                                                <Button aria-label="Copy domain" size="icon" variant="ghost" onClick={copyDomain}>
                                                    <MaterialIcon name={copiedDomain ? 'check' : 'content_copy'} size={13} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action */}
                                <div className="flex justify-start pl-11 md:justify-end md:pl-0">
                                    <Button
                                        variant={isNext ? undefined : 'outline'}
                                        onClick={() => navigateTo(item.actionLink)}
                                    >
                                        {isDone ? 'Review' : item.actionText}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Section>
        </Card>
    )
}

function HomeMetrics({ homeData }: { homeData: DashboardHomeData }) {
    return (
        <>
            {!homeData.analyticsAvailable && (
                <Banner variant="info" title="Analytics are still warming up">
                    Summary cards will update when the analytics endpoint returns store activity.
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Revenue"
                    value={formatInrCurrency(homeData.totalRevenue, { maximumFractionDigits: 0 }) || '₹0'}
                    delta={formatPercentChange(homeData.revenueChangePct, 'last 30 days')}
                    deltaTone={toneFromChange(homeData.revenueChangePct)}
                />
                <MetricCard
                    label="Orders"
                    value={formatNumber(homeData.totalOrders)}
                    delta={formatPercentChange(homeData.ordersChangePct, 'last 30 days')}
                    deltaTone={toneFromChange(homeData.ordersChangePct)}
                />
                <MetricCard
                    label="Visitors"
                    value="Not tracked"
                    delta="Needs storefront session analytics"
                    deltaTone="neutral"
                />
                <MetricCard
                    label="Conversion"
                    value="Not tracked"
                    delta="Needs visitor and checkout funnel data"
                    deltaTone="neutral"
                />
            </div>
        </>
    )
}

function RecentActivity({ store, activities }: { store: string; activities: DashboardActivity[] }) {
    return (
        <Card>
            <Section
                title="Recent activity"
                description="The newest orders and catalog updates, pulled from the current merchant data surfaces."
                action={<Badge label={`${activities.length} shown`} variant={activities.length > 0 ? 'info' : 'default'} />}
            >
                {activities.length > 0 ? (
                    <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                        {activities.map((activity) => (
                            <a
                                key={activity.id}
                                href={`/${store}/${activity.href}`}
                                className="grid gap-[var(--lb-space-3)] p-[var(--lb-space-4)] text-[color:var(--lb-color-text)] no-underline transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] md:grid-cols-[auto_1fr_auto] md:items-center"
                            >
                                <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]">
                                    <MaterialIcon name={activity.icon} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">
                                        {activity.title}
                                    </span>
                                    <span className="mt-[var(--lb-space-1)] block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        {activity.description}
                                    </span>
                                </span>
                                <span className="flex flex-wrap items-center gap-[var(--lb-space-2)] md:justify-end">
                                    <Badge label={activity.badgeLabel} variant={activity.badgeVariant} />
                                    <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        {formatRelativeTime(activity.timestamp)}
                                    </span>
                                </span>
                            </a>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        kind="orders"
                        icon={<MaterialIcon name="receipt_long" className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[color:var(--lb-color-primary)]" />}
                        title="Recent activity will appear here"
                        body="Orders and product updates will show up as soon as this store has merchant or shopper activity."
                        primaryAction={<Button type="button" onClick={() => { window.location.href = `/${store}/products/new` }}>Add product</Button>}
                        secondaryAction={<Button type="button" variant="secondary" onClick={() => { window.location.href = `/${store}/orders` }}>View orders</Button>}
                    />
                )}
            </Section>
        </Card>
    )
}

function buildSetupChecklist({
    config,
    currentDomain,
    setupStatus,
    siteType,
    storeStatus,
}: {
    config: SetupConfig
    currentDomain: string
    setupStatus: SetupStatus
    siteType: SiteType
    storeStatus: string
}): SetupChecklistItem[] {
    if (siteType === 'store') {
        return [
            {
                title: 'Add product',
                description: 'Create the first sellable item so shoppers can browse and buy.',
                icon: 'product',
                actionText: 'Add product',
                actionLink: 'products/new',
                complete: setupStatus.primaryComplete,
            },
            {
                title: 'Customize theme',
                description: 'Choose a theme and tune storefront branding before publication.',
                icon: 'palette',
                actionText: 'Customize',
                actionLink: 'online-store/themes',
                complete: setupStatus.themeCustomized,
            },
            {
                title: 'Set up payments',
                description: 'Configure payment acceptance before taking live orders.',
                icon: 'payments',
                actionText: 'Activate',
                actionLink: 'settings/payments',
                complete: Boolean(setupStatus.paymentConfigured),
            },
            {
                title: 'Connect domain',
                description: 'Use the default LetBuyy domain or connect a custom storefront domain.',
                icon: 'language',
                actionText: 'Connect',
                actionLink: 'settings/domains',
                complete: setupStatus.domainConfigured,
                detail: currentDomain,
            },
            {
                title: 'Launch store',
                description: 'Publish the storefront when products, theme, payments, and domain are ready.',
                icon: 'rocket_launch',
                actionText: 'Publish',
                actionLink: 'online-store/themes',
                complete: storeStatus === 'published',
            },
        ]
    }

    return [
        {
            title: config.primary.title,
            description: config.primary.description,
            icon: config.primary.icon,
            actionText: config.primary.actionText,
            actionLink: config.primary.actionLink,
            complete: setupStatus.primaryComplete,
        },
        {
            title: config.secondary.title,
            description: config.secondary.description,
            icon: config.secondary.icon,
            actionText: config.secondary.actionText,
            actionLink: config.secondary.actionLink,
            complete: setupStatus.themeCustomized,
        },
        ...config.miniCards.map((card) => ({
            title: card.title,
            description: card.showDomain
                ? 'Review the public domain visitors will use.'
                : 'Complete this recommended launch preparation step.',
            icon: card.icon,
            actionText: card.showDomain ? 'Customize' : card.actionText,
            actionLink: card.showDomain ? 'settings/domains' : card.actionLink,
            complete: Boolean(card.checkKey && setupStatus[card.checkKey]),
            detail: card.showDomain ? currentDomain : undefined,
        })),
    ].slice(0, 5)
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
}

function formatPercentChange(value: number, period: string) {
    if (!value) return `No change in ${period}`
    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value.toFixed(1)}% in ${period}`
}

function toneFromChange(value: number) {
    if (value > 0) return 'positive'
    if (value < 0) return 'negative'
    return 'neutral'
}

function formatRelativeTime(value: string | null) {
    if (!value) return 'Recently'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Recently'

    const diffMs = date.getTime() - Date.now()
    const diffMinutes = Math.round(diffMs / 60000)
    const absMinutes = Math.abs(diffMinutes)

    if (absMinutes < 60) return new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' }).format(diffMinutes, 'minute')

    const diffHours = Math.round(diffMinutes / 60)
    if (Math.abs(diffHours) < 24) return new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' }).format(diffHours, 'hour')

    const diffDays = Math.round(diffHours / 24)
    return new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' }).format(diffDays, 'day')
}

const SETUP_CONFIGS: Record<SiteType, SetupConfig> = {
    store: {
        dashboardDescription: 'Run store setup, products, theme customization, payments, and domain work from one place.',
        primary: { icon: 'product', title: 'Add your first product', description: 'Start by adding a product and a few key details so customers can browse and buy.', actionText: 'Add product', actionLink: 'products/new' },
        secondary: { icon: 'format_size', title: 'Customize your online store', description: 'Choose a theme, then tune your logo, colors, content, and imagery.', actionText: 'Customize theme', actionLink: 'online-store/themes' },
        miniCards: [
            { title: 'Set up payments', icon: 'payments', actionText: 'Activate', actionLink: 'settings/payments', checkKey: 'paymentConfigured' },
            { title: 'Review shipping rates', icon: 'local_shipping', actionText: 'Review', actionLink: 'settings/shipping', checkKey: 'hasShipping' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    portfolio: {
        dashboardDescription: 'Build a portfolio site with projects, visual galleries, contact capture, and a polished public domain.',
        primary: { icon: 'photo_library', title: 'Add your first project', description: 'Showcase your best work with images, a clear description, and your process.', actionText: 'Add project', actionLink: 'projects' },
        secondary: { icon: 'palette', title: 'Customize your portfolio', description: 'Pick a layout that shows off your work, then set your brand colors and typography.', actionText: 'Customize theme', actionLink: 'online-store/themes' },
        miniCards: [
            { title: 'Upload gallery images', icon: 'add_photo_alternate', actionText: 'Upload', actionLink: 'gallery', checkKey: 'primaryComplete' },
            { title: 'Set up contact form', icon: 'mail', actionText: 'Configure', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    resume: {
        dashboardDescription: 'Publish a professional resume site with experience, skills, export settings, and a custom domain.',
        primary: { icon: 'work', title: 'Add your experience', description: 'Start with your work history, including roles, companies, and accomplishments.', actionText: 'Add experience', actionLink: 'experience' },
        secondary: { icon: 'palette', title: 'Customize your resume site', description: 'Choose a clean layout and add personal branding for a stronger first impression.', actionText: 'Customize theme', actionLink: 'online-store/themes' },
        miniCards: [
            { title: 'Add skills & education', icon: 'school', actionText: 'Add', actionLink: 'skills' },
            { title: 'Configure PDF export', icon: 'picture_as_pdf', actionText: 'Set up', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    landing: {
        dashboardDescription: 'Build and launch a conversion-focused landing page with lead capture, analytics, and domain setup.',
        primary: { icon: 'web', title: 'Design your landing page', description: 'Build a focused page with hero content, calls to action, and social proof.', actionText: 'Start designing', actionLink: 'pages' },
        secondary: { icon: 'palette', title: 'Customize your design', description: 'Set brand colors, fonts, and visual style to match your brand identity.', actionText: 'Customize theme', actionLink: 'online-store/themes' },
        miniCards: [
            { title: 'Set up lead capture', icon: 'contact_mail', actionText: 'Configure', actionLink: 'settings' },
            { title: 'Connect analytics', icon: 'monitoring', actionText: 'Set up', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    blog: {
        dashboardDescription: 'Manage posts, categories, newsletter setup, reading experience, and domain readiness for your blog.',
        primary: { icon: 'edit_note', title: 'Write your first post', description: 'Share your ideas by writing, formatting, and publishing your first blog post.', actionText: 'Write post', actionLink: 'posts' },
        secondary: { icon: 'palette', title: 'Customize your blog', description: 'Choose a reading-friendly layout, then configure typography and brand styling.', actionText: 'Customize theme', actionLink: 'online-store/themes' },
        miniCards: [
            { title: 'Set up categories', icon: 'category', actionText: 'Add', actionLink: 'categories' },
            { title: 'Enable newsletter', icon: 'mark_email_read', actionText: 'Set up', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
}

function PlanBanner({
    store,
    trialEndsAt,
    trialStatus,
}: {
    store: string
    trialEndsAt: string | null
    trialStatus: string | null
}) {
    const router = useRouter()
    const [dismissed, setDismissed] = useState(false)
    const isOnTrial = Boolean(trialStatus === 'active' && trialEndsAt)

    if (dismissed) return null

    let bannerText = 'Get 3 months for ₹79/month.'
    if (isOnTrial && trialEndsAt) {
        const endDate = new Date(trialEndsAt)
        const now = new Date()
        const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        bannerText = `Get 3 months for ₹79/month. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in trial.`
    }

    return (
        <Banner
            title="Intro plan available"
            variant="warning"
            action={
                <div className="flex flex-wrap items-center justify-end gap-[var(--lb-space-2)]">
                    <Button variant="secondary" onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>
                        Select a plan
                    </Button>
                    <Button aria-label="Dismiss plan banner" size="icon" variant="ghost" onClick={() => setDismissed(true)}>
                        <MaterialIcon name="close" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                    </Button>
                </div>
            }
        >
            <p className="m-0">{bannerText}</p>
        </Banner>
    )
}

function PlanUpsell({ store }: { store: string }) {
    const router = useRouter()

    return (
        <Card>
            <Section>
                <div className="grid items-center gap-[var(--lb-space-5)] md:grid-cols-[1fr_auto]">
                    <div className="space-y-[var(--lb-space-2)]">
                        <h2 className="m-0 text-[length:var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[color:var(--lb-color-text)]">
                            Your plan can pay for itself
                        </h2>
                        <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                            Subscribe for ₹79/month for 3 months. Plus, earn 0.5% back in credits on every sale, up to ₹30,000.
                        </p>
                        <Button variant="outline" onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>
                            Compare plans
                        </Button>
                    </div>
                    <div className="flex h-[calc(var(--lb-size-control-lg)*2)] w-[calc(var(--lb-size-control-lg)*2)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning-soft)] text-[color:var(--lb-color-warning)]">
                        <MaterialIcon name="monetization_on" className="h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)]" />
                    </div>
                </div>
            </Section>
        </Card>
    )
}

function formatSiteType(siteType: SiteType) {
    return siteType
        .split('-')
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(' ')
}

export function DashboardSkeleton() {
    return (
        <Page>
            <Skeleton variant="text" lines={2} />
            <Skeleton variant="card" />
            <Card>
                <Section>
                    <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-2">
                        <Skeleton variant="card" />
                        <Skeleton variant="card" />
                    </div>
                    <Skeleton variant="table" lines={3} />
                </Section>
            </Card>
        </Page>
    )
}
