'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, PackageOpen } from 'lucide-react'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import type {
    DashboardActivity,
    DashboardHomeData,
    SetupStatus,
    StoreInfo,
} from './page'
import { FoundingMerchantCard } from '@/components/founding/FoundingMerchantCard'
import { resolveDashboardDomain } from './dashboard-setup-status'
import { getStorefrontRootDomain } from '@/lib/public-urls'
import { MerchantNavigationLink } from '@/components/MerchantNavigationLink'
import { Badge,
    Banner,
    Card,
    MaterialIcon,
    MetricCard,
    Page,
    Section,
    Skeleton,
} from '@letbuyy/ui'
import HomeSetupGuide, { type HomeSetupStep } from './HomeSetupGuide'

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

/**
 * What the store actually is right now, derived only from real fields.
 *
 *   ACTIVATING  no sellable catalog yet — the checklist IS the page
 *   SELLING     products exist, no orders yet — metrics start to mean something
 *   OPERATING   real orders — metrics lead, checklist collapses away
 *
 * hasOrders ORs in recentActivity because totalOrders is a 30-day window: a store
 * that sold in month one and paused would otherwise be demoted back to SELLING
 * and shown a launch checklist it already finished.
 */
type DashboardStage = 'activating' | 'selling' | 'operating'

function resolveStage(
    siteType: SiteType,
    setupStatus: SetupStatus,
    homeData: DashboardHomeData,
): DashboardStage {
    // Non-store site types get emptyDashboardHomeData(), so never show them
    // commerce metrics they can't populate.
    if (siteType !== 'store') return 'activating'

    const hasOrders =
        homeData.totalOrders > 0 || homeData.recentActivity.some((activity) => activity.kind === 'order')
    if (hasOrders) return 'operating'

    const hasProducts = setupStatus.primaryComplete || homeData.totalProducts > 0
    return hasProducts ? 'selling' : 'activating'
}

export default function DashboardClient({ store, storeInfo, setupStatus, homeData }: DashboardClientProps) {
    const router = useRouter()
    const [isRefreshing, startRefresh] = useTransition()
    const retrySetupChecks = () => startRefresh(() => router.refresh())
    const config = SETUP_CONFIGS[storeInfo.site_type] || SETUP_CONFIGS.store
    const currentDomain = resolveDashboardDomain({
        subdomain: storeInfo.subdomain,
        customDomain: storeInfo.custom_domain,
        customDomainStatus: storeInfo.custom_domain_status,
    }).domain ?? `${storeInfo.subdomain}.${getStorefrontRootDomain()}`
    const stage = resolveStage(storeInfo.site_type, setupStatus, homeData)
    const setupSteps = buildSetupChecklist({
        config,
        currentDomain,
        setupStatus,
        siteType: storeInfo.site_type,
        storeStatus: storeInfo.status,
        customDomainActive: storeInfo.custom_domain_status === 'active',
    })

    return (
        <Page>
            <HomeSetupGuide
                store={store}
                storeName={storeInfo.name || store}
                isStore={storeInfo.site_type === 'store'}
                isDraft={storeInfo.status === 'draft'}
                trialEndsAt={storeInfo.trial_ends_at}
                trialStatus={storeInfo.trial_status}
                steps={setupSteps}
                compact={stage !== 'activating'}
                onRetry={retrySetupChecks}
                isRefreshing={isRefreshing}
            />
            {stage !== 'activating' && <HomeMetrics homeData={homeData} />}
            <RecentActivity store={store} activities={homeData.recentActivity} />

            <FoundingMerchantCard />
        </Page>
    )
}

function HomeMetrics({ homeData }: { homeData: DashboardHomeData }) {
    if (!homeData.analyticsAvailable) {
        return <Banner variant="info" title="Analytics are still warming up">
            Summary cards will appear when store activity can be loaded.
        </Banner>
    }

    return (
        <>
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
                {/* Products and average order value replace the former Visitors and
                    Conversion tiles. Both were permanently "Not tracked" — nothing
                    fetches session analytics — while these two are already in the
                    payload and were being discarded. */}
                <MetricCard
                    label="Products"
                    value={formatNumber(homeData.totalProducts)}
                    delta={homeData.totalProducts === 0 ? 'Add your first product' : 'In your catalog'}
                    deltaTone="neutral"
                />
                <MetricCard
                    label="Average order"
                    value={
                        homeData.totalOrders === 0
                            ? '—'
                            : formatInrCurrency(homeData.avgOrderValue, { maximumFractionDigits: 0 }) || '₹0'
                    }
                    delta={homeData.totalOrders === 0 ? 'After your first order' : 'Across last 30 days'}
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
                            <MerchantNavigationLink
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
                            </MerchantNavigationLink>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                        <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]">
                            <PackageOpen size={20} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">No activity yet</p>
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">Product updates and orders will appear here.</p>
                        </div>
                        <MerchantNavigationLink href={`/${store}/products/new`} className="inline-flex items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-card)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)] no-underline hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lb-color-focus-ring)]">
                            Add product <ArrowRight size={14} aria-hidden="true" />
                        </MerchantNavigationLink>
                    </div>
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
    customDomainActive,
}: {
    config: SetupConfig
    currentDomain: string
    setupStatus: SetupStatus
    siteType: SiteType
    storeStatus: string
    customDomainActive: boolean
}): HomeSetupStep[] {
    if (siteType === 'store') {
        return [
            {
                id: 'details', title: 'Store details',
                description: 'Review the name and contact details customers will see.',
                actionText: 'Review details', actionLink: 'settings/general', art: 'details',
                complete: false, available: true, tracked: false, optional: true,
            },
            {
                id: 'product', title: 'Add first product',
                description: 'Start your catalog, then confirm the product is ready to publish.',
                actionText: 'Add product', actionLink: 'products/new', art: 'product',
                complete: setupStatus.primaryComplete, available: setupStatus.primaryAvailable, tracked: true,
            },
            {
                id: 'theme', title: 'Choose a theme',
                description: 'Customize your storefront design and review its preview.',
                actionText: 'Choose theme', actionLink: 'online-store/themes', art: 'theme',
                complete: setupStatus.themeCustomized, available: true, tracked: true,
            },
            {
                id: 'payments', title: 'Set up payments',
                description: 'Review your payment methods and their test or live readiness.',
                actionText: 'Review payments', actionLink: 'settings/payments', art: 'payments',
                complete: Boolean(setupStatus.paymentConfigured), available: setupStatus.paymentAvailable ?? false,
                tracked: true, detail: setupStatus.paymentConfigured ? 'A payment option is configured. Review its provider mode before selling.' : undefined,
            },
            {
                id: 'shipping', title: 'Shipping & delivery',
                description: 'Review delivery zones, rates and serviceability.',
                actionText: 'Review rates', actionLink: 'settings/shipping', art: 'shipping',
                complete: Boolean(setupStatus.hasShipping), available: setupStatus.shippingAvailable ?? false, tracked: true,
            },
            {
                id: 'taxes', title: 'Tax settings',
                description: 'Review the tax rules that apply to your products and location.',
                actionText: 'Review taxes', actionLink: 'settings/taxes', art: 'taxes',
                complete: false, available: true, tracked: false, optional: true,
            },
            {
                id: 'domain', title: 'Connect a custom domain',
                description: `Your default address is ${currentDomain}. A custom domain is optional.`,
                actionText: 'Review domain', actionLink: 'settings/domains', art: 'domain',
                complete: customDomainActive, available: true, tracked: false, optional: true, group: 'additional',
            },
            {
                id: 'launch', title: 'Publish storefront',
                description: 'Review the storefront and its prerequisites before publication.',
                actionText: 'Review launch', actionLink: 'online-store/themes', art: 'launch',
                complete: storeStatus === 'published', available: true, tracked: true, group: 'additional',
                detail: storeStatus === 'published' ? 'Store status is published. Review the public storefront to confirm what shoppers see.' : undefined,
            },
        ]
    }

    const mini: HomeSetupStep[] = config.miniCards.map((card, index) => ({
        id: `step-${index}`,
        title: card.title,
        description: card.showDomain ? `Review the public address ${currentDomain}.` : 'Review this setup task for your site.',
        actionText: card.showDomain ? 'Review domain' : card.actionText,
        actionLink: card.showDomain ? 'settings/domains' : card.actionLink,
        art: (card.showDomain ? 'domain' : card.checkKey === 'paymentConfigured' ? 'payments' : card.checkKey === 'hasShipping' ? 'shipping' : 'details') as HomeSetupStep['art'],
        complete: Boolean(card.checkKey && setupStatus[card.checkKey]),
        available: card.checkKey === 'primaryComplete' ? setupStatus.primaryAvailable
            : card.checkKey === 'paymentConfigured' ? setupStatus.paymentAvailable ?? false
                : card.checkKey === 'hasShipping' ? setupStatus.shippingAvailable ?? false : true,
        tracked: Boolean(card.checkKey),
        optional: !card.checkKey,
    }))
    return [
        { id: 'primary', title: config.primary.title, description: config.primary.description,
            actionText: config.primary.actionText, actionLink: config.primary.actionLink, art: 'details',
            complete: setupStatus.primaryComplete, available: setupStatus.primaryAvailable, tracked: true },
        { id: 'theme', title: config.secondary.title, description: config.secondary.description,
            actionText: config.secondary.actionText, actionLink: config.secondary.actionLink, art: 'theme',
            complete: setupStatus.themeCustomized, available: true, tracked: true },
        ...mini,
    ]
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
