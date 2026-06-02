'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SetupStatus, StoreInfo } from './page'
import { MaterialIcon } from '@letbuyy/ui'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

/* ——————————————————————————————————————
   Props
   —————————————————————————————————————— */

interface DashboardClientProps {
    store: string
    storeInfo: StoreInfo
    setupStatus: SetupStatus
}

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function DashboardClient({ store, storeInfo, setupStatus }: DashboardClientProps) {
    const currentDomain = storeInfo.custom_domain || `${storeInfo.subdomain}.letbuyy.store`

    return (
        <div className="setup-dashboard">
            {/* Plan Banner */}
            <PlanBanner
                store={store}
                trialEndsAt={storeInfo.trial_ends_at}
                trialStatus={storeInfo.trial_status}
            />

            {/* Store Name + Edit */}
            <div className="setup-card setup-store-card">
                <div className="setup-store-name">
                    <h1>{storeInfo.name || store}</h1>
                    <Link href={`/${store}/settings`} className="setup-edit-icon" title="Edit store name">
                        <MaterialIcon name="edit" style={{ fontSize: '18px' }} />
                    </Link>
                </div>

                {/* Site-type-aware setup cards */}
                <SetupCards
                    store={store}
                    siteType={storeInfo.site_type}
                    setupStatus={setupStatus}
                    currentDomain={currentDomain}
                />
            </div>

            {/* Plan Upsell */}
            <PlanUpsell store={store} />
        </div>
    )
}

/* ——————————————————————————————————————
   Setup Cards (Site-Type-Aware)
   —————————————————————————————————————— */

interface SetupCardsProps {
    store: string
    siteType: SiteType
    setupStatus: SetupStatus
    currentDomain: string
}

function SetupCards({ store, siteType, setupStatus, currentDomain }: SetupCardsProps) {
    const config = SETUP_CONFIGS[siteType] || SETUP_CONFIGS.store

    return (
        <>
            {/* 1×2 Hero Cards */}
            <div className="setup-hero-row">
                {/* Primary Card */}
                <div className={`setup-hero-card ${setupStatus.primaryComplete ? 'completed' : ''}`}>
                    <div className="setup-hero-thumb">
                        <div className="setup-thumb-product">
                            <div className="setup-thumb-img-stack">
                                <div className="setup-thumb-img-back" />
                                <div className="setup-thumb-img-front">
                                    <MaterialIcon name={config.primary.icon} style={{ fontSize: '32px', color: 'var(--text-hint)' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <h3>{config.primary.title}</h3>
                    <p>{config.primary.description}</p>
                    <div className="setup-hero-actions">
                        <Link href={`/${store}/${config.primary.actionLink}`} className="setup-btn-primary">
                            {config.primary.actionText}
                        </Link>
                    </div>
                </div>

                {/* Theme Card */}
                <div className={`setup-hero-card ${setupStatus.themeCustomized ? 'completed' : ''}`}>
                    <div className="setup-hero-thumb">
                        <div className="setup-thumb-theme">
                            <div className="setup-thumb-theme-stack">
                                <div className="setup-thumb-theme-back" />
                                <div className="setup-thumb-theme-front">
                                    <MaterialIcon name="format_size" style={{ fontSize: '28px', color: 'var(--text-hint)' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <h3>{config.secondary.title}</h3>
                    <p>{config.secondary.description}</p>
                    <div className="setup-hero-actions">
                        <Link href={`/${store}/pages`} className="setup-btn-outline">
                            {config.secondary.actionText}
                        </Link>
                    </div>
                </div>
            </div>

            {/* 1×3 Mini Cards */}
            <div className="setup-mini-row">
                {config.miniCards.map((card, i) => (
                    <div key={i} className={`setup-mini-step ${card.checkKey && setupStatus[card.checkKey as keyof SetupStatus] ? 'completed' : ''}`}>
                        <h4>{card.title}</h4>
                        <div className="setup-mini-icons">
                            <div className="setup-shipping-icon">
                                <MaterialIcon name={card.icon} style={{ fontSize: '24px' }} />
                            </div>
                        </div>
                        {card.showDomain ? (
                            <>
                                <div className="setup-domain-display">
                                    <span className="setup-domain-text">{currentDomain}</span>
                                    <button
                                        className="setup-domain-copy"
                                        onClick={() => navigator.clipboard.writeText(currentDomain)}
                                        title="Copy domain"
                                        type="button"
                                    >
                                        <MaterialIcon name="content_copy" style={{ fontSize: '14px' }} />
                                    </button>
                                </div>
                                <Link href={`/${store}/settings`} className="setup-btn-outline">
                                    Customize
                                </Link>
                            </>
                        ) : (
                            <Link href={`/${store}/${card.actionLink}`} className="setup-btn-outline">
                                {card.actionText}
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </>
    )
}

const SETUP_CONFIGS: Record<SiteType, {
    primary: { icon: string; title: string; description: string; actionText: string; actionLink: string }
    secondary: { title: string; description: string; actionText: string }
    miniCards: Array<{ title: string; icon: string; actionText: string; actionLink: string; checkKey?: string; showDomain?: boolean }>
}> = {
    store: {
        primary: { icon: 'diamond', title: 'Add your first product', description: 'Start by adding a product and a few key details — your store starts here.', actionText: 'Add product', actionLink: 'products/new' },
        secondary: { title: 'Customize your online store', description: 'Choose or generate a custom theme, then add your logo, colors, and images.', actionText: 'Customize theme' },
        miniCards: [
            { title: 'Set up payments', icon: 'payments', actionText: 'Activate', actionLink: 'settings/payments', checkKey: 'paymentConfigured' },
            { title: 'Review shipping rates', icon: 'local_shipping', actionText: 'Review', actionLink: 'settings/shipping', checkKey: 'hasShipping' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    portfolio: {
        primary: { icon: 'photo_library', title: 'Add your first project', description: 'Showcase your best work — upload images, write a description, and share your process.', actionText: 'Add project', actionLink: 'projects' },
        secondary: { title: 'Customize your portfolio', description: 'Pick a layout that shows off your work, and set your brand colors and typography.', actionText: 'Customize theme' },
        miniCards: [
            { title: 'Upload gallery images', icon: 'add_photo_alternate', actionText: 'Upload', actionLink: 'gallery', checkKey: 'primaryComplete' },
            { title: 'Set up contact form', icon: 'mail', actionText: 'Configure', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    resume: {
        primary: { icon: 'work', title: 'Add your experience', description: 'Start with your work history — add roles, companies, and what you accomplished.', actionText: 'Add experience', actionLink: 'experience' },
        secondary: { title: 'Customize your resume site', description: 'Choose a clean, professional layout and add your personal branding.', actionText: 'Customize theme' },
        miniCards: [
            { title: 'Add skills & education', icon: 'school', actionText: 'Add', actionLink: 'skills' },
            { title: 'Configure PDF export', icon: 'picture_as_pdf', actionText: 'Set up', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    landing: {
        primary: { icon: 'web', title: 'Design your landing page', description: 'Build a high-converting page with hero sections, CTAs, and social proof.', actionText: 'Start designing', actionLink: 'pages' },
        secondary: { title: 'Customize your design', description: 'Set your brand colors, fonts, and visual style to match your brand identity.', actionText: 'Customize theme' },
        miniCards: [
            { title: 'Set up lead capture', icon: 'contact_mail', actionText: 'Configure', actionLink: 'settings' },
            { title: 'Connect analytics', icon: 'monitoring', actionText: 'Set up', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
    blog: {
        primary: { icon: 'edit_note', title: 'Write your first post', description: 'Share your ideas with the world — write, format, and publish your first blog post.', actionText: 'Write post', actionLink: 'posts' },
        secondary: { title: 'Customize your blog', description: 'Choose a reading-friendly layout, set your brand colors, and configure typography.', actionText: 'Customize theme' },
        miniCards: [
            { title: 'Set up categories', icon: 'category', actionText: 'Add', actionLink: 'categories' },
            { title: 'Enable newsletter', icon: 'mark_email_read', actionText: 'Set up', actionLink: 'settings' },
            { title: 'Customize domain', icon: 'language', actionText: 'Customize', actionLink: 'settings', showDomain: true, checkKey: 'domainConfigured' },
        ],
    },
}

/* ——————————————————————————————————————
   Plan Banner
   —————————————————————————————————————— */

function PlanBanner({
    store,
    trialEndsAt,
    trialStatus,
}: {
    store: string
    trialEndsAt: string | null
    trialStatus: string | null
}) {
    const [dismissed, setDismissed] = useState(false)
    const isOnTrial = trialStatus === 'active' && trialEndsAt

    if (dismissed) return null

    let bannerText = 'Get 3 months for ₹79/month'
    if (isOnTrial) {
        const endDate = new Date(trialEndsAt)
        const now = new Date()
        const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        bannerText = `Get 3 months for ₹79/month • ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in trial`
    }

    return (
        <div className="setup-plan-banner">
            <div className="setup-plan-banner-text">
                <MaterialIcon name="settings" style={{ fontSize: '16px' }} />
                <span>{bannerText}</span>
            </div>
            <div className="setup-plan-banner-right">
                <Link href={`/${store}/access_account/checkout/select-plan`} className="setup-plan-banner-btn">
                    Select a plan
                </Link>
                <button
                    className="setup-plan-banner-close"
                    onClick={() => setDismissed(true)}
                    type="button"
                >
                    <MaterialIcon name="close" style={{ fontSize: '16px' }} />
                </button>
            </div>
        </div>
    )
}

/* ——————————————————————————————————————
   Plan Upsell
   —————————————————————————————————————— */

function PlanUpsell({ store }: { store: string }) {
    return (
        <div className="setup-upsell">
            <div className="setup-upsell-content">
                <h3>Your plan can pay for itself</h3>
                <p>
                    Subscribe for ₹79/month for 3 months. Plus, earn 0.5% back in credits on every
                    sale, up to ₹30,000.
                </p>
                <Link href={`/${store}/access_account/checkout/select-plan`} className="setup-btn-outline">
                    Compare plans
                </Link>
            </div>
            <div className="setup-upsell-visual">
                <MaterialIcon name="monetization_on" style={{ fontSize: '56px', color: '#d4a853' }} />
            </div>
        </div>
    )
}

/* ——————————————————————————————————————
   Skeleton (exported for loading.tsx)
   —————————————————————————————————————— */

export function DashboardSkeleton() {
    return (
        <div className="setup-dashboard">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="skeleton-pulse" style={{ height: '52px', borderRadius: '12px' }} />
                <div className="skeleton-pulse" style={{ height: '420px', borderRadius: '16px' }} />
                <div className="skeleton-pulse" style={{ height: '140px', borderRadius: '16px' }} />
            </div>
        </div>
    )
}
