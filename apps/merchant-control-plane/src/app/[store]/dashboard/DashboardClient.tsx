'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SetupStatus, StoreInfo } from './page'
import {
    Badge,
    Banner,
    Button,
    Card,
    MaterialIcon,
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

export default function DashboardClient({ store, storeInfo, setupStatus }: DashboardClientProps) {
    const config = SETUP_CONFIGS[storeInfo.site_type] || SETUP_CONFIGS.store
    const currentDomain = storeInfo.custom_domain || `${storeInfo.subdomain}.letbuyy.store`

    return (
        <Page>
            <PageHeader
                breadcrumbs={[{ label: 'Home' }]}
                eyebrow={formatSiteType(storeInfo.site_type)}
                title={storeInfo.name || store}
                description={`${config.dashboardDescription} Your current domain is ${currentDomain}.`}
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

            <SetupCards
                store={store}
                siteType={storeInfo.site_type}
                setupStatus={setupStatus}
                currentDomain={currentDomain}
            />

            <PlanUpsell store={store} />
        </Page>
    )
}

interface SetupCardsProps {
    store: string
    siteType: SiteType
    setupStatus: SetupStatus
    currentDomain: string
}

function SetupCards({ store, siteType, setupStatus, currentDomain }: SetupCardsProps) {
    const router = useRouter()
    const [copiedDomain, setCopiedDomain] = useState(false)
    const config = SETUP_CONFIGS[siteType] || SETUP_CONFIGS.store
    const miniCompletions = config.miniCards.map((card) => Boolean(card.checkKey && setupStatus[card.checkKey]))
    const totalSteps = 2 + config.miniCards.length
    const completedSteps =
        Number(setupStatus.primaryComplete) +
        Number(setupStatus.themeCustomized) +
        miniCompletions.filter(Boolean).length

    const navigateTo = (path: string) => {
        router.push(`/${store}/${path}`)
    }

    const copyDomain = () => {
        void navigator.clipboard.writeText(currentDomain).then(() => {
            setCopiedDomain(true)
            window.setTimeout(() => setCopiedDomain(false), 1800)
        })
    }

    return (
        <Card>
            <Section
                title="Setup guide"
                description="Finish the highest-impact steps to get this storefront ready for customers."
                action={
                    <Badge
                        label={`${completedSteps}/${totalSteps} complete`}
                        variant={completedSteps === totalSteps ? 'success' : 'info'}
                    />
                }
            >
                <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-2">
                    <SetupActionPanel
                        icon={config.primary.icon}
                        title={config.primary.title}
                        description={config.primary.description}
                        actionText={config.primary.actionText}
                        complete={setupStatus.primaryComplete}
                        onAction={() => navigateTo(config.primary.actionLink)}
                    />
                    <SetupActionPanel
                        icon={config.secondary.icon}
                        title={config.secondary.title}
                        description={config.secondary.description}
                        actionText={config.secondary.actionText}
                        complete={setupStatus.themeCustomized}
                        onAction={() => navigateTo(config.secondary.actionLink)}
                    />
                </div>

                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                    {config.miniCards.map((card) => {
                        const complete = Boolean(card.checkKey && setupStatus[card.checkKey])

                        return (
                            <div
                                key={card.title}
                                className="flex min-h-[calc(var(--lb-space-7)*3)] flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]"
                            >
                                <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                                    <div className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                        <MaterialIcon name={card.icon} className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)]" />
                                    </div>
                                    <Badge label={complete ? 'Done' : 'Next'} variant={complete ? 'success' : 'default'} />
                                </div>
                                <div className="space-y-[var(--lb-space-1)]">
                                    <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                        {card.title}
                                    </h3>
                                    {card.showDomain && (
                                        <div className="flex items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-2)]">
                                            <span className="min-w-0 flex-1 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {currentDomain}
                                            </span>
                                            <Button
                                                aria-label="Copy domain"
                                                size="icon"
                                                variant="ghost"
                                                onClick={copyDomain}
                                            >
                                                <MaterialIcon name={copiedDomain ? 'check' : 'content_copy'} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-auto">
                                    <Button
                                        fullWidth
                                        variant={complete ? 'secondary' : 'outline'}
                                        onClick={() => navigateTo(card.showDomain ? 'settings' : card.actionLink)}
                                    >
                                        {card.showDomain ? 'Customize' : card.actionText}
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

function SetupActionPanel({
    icon,
    title,
    description,
    actionText,
    complete,
    onAction,
}: {
    icon: string
    title: string
    description: string
    actionText: string
    complete: boolean
    onAction: () => void
}) {
    return (
        <div className="flex min-h-[calc(var(--lb-space-7)*4)] flex-col justify-between gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-raised)] p-[var(--lb-space-5)] shadow-[var(--lb-shadow-sm)]">
            <div className="flex items-start justify-between gap-[var(--lb-space-4)]">
                <div className="flex h-[calc(var(--lb-size-control-lg)+var(--lb-space-3))] w-[calc(var(--lb-size-control-lg)+var(--lb-space-3))] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                    <MaterialIcon name={icon} className="h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)]" />
                </div>
                <Badge label={complete ? 'Complete' : 'Recommended'} variant={complete ? 'success' : 'info'} />
            </div>
            <div className="space-y-[var(--lb-space-2)]">
                <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                    {title}
                </h3>
                <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                    {description}
                </p>
            </div>
            <Button variant={complete ? 'secondary' : 'primary'} onClick={onAction}>
                {complete ? 'Review' : actionText}
            </Button>
        </div>
    )
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
                        <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                            Your plan can pay for itself
                        </h2>
                        <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                            Subscribe for ₹79/month for 3 months. Plus, earn 0.5% back in credits on every sale, up to ₹30,000.
                        </p>
                        <Button variant="outline" onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>
                            Compare plans
                        </Button>
                    </div>
                    <div className="flex h-[calc(var(--lb-size-control-lg)*2)] w-[calc(var(--lb-size-control-lg)*2)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]">
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
