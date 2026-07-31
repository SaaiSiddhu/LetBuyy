'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CreditCard, MaterialIcon, Package, Palette, Store, Zap, type LucideIcon } from '@letbuyy/ui'
import {
    getAccountsUrl,
    getAppMarketplaceUrl,
    getDeveloperPortalUrl,
    getMarketingSiteUrl,
    getThemeMarketplaceUrl,
} from '@/lib/public-urls'

// ── Static data ─────────────────────────────────────────────────────────────

const METRICS = [
    { value: '12+',  label: 'Platform Surfaces' },
    { value: '1',    label: 'Unified Identity'  },
    { value: '100%', label: 'Commerce Engine'   },
    { value: 'AI',   label: 'Native Foundation' },
]

const FLAGSHIP_CHIPS = [
    'Products', 'Orders', 'Inventory', 'Customers', 'Analytics', 'AI Copilot',
]

const OS_MODS = [
    { label: 'Products',   color: 'rgb(139 92 246)',  active: false },
    { label: 'Orders',     color: 'rgb(59 130 246)',  active: true  },
    { label: 'Inventory',  color: 'rgb(245 158 11)',  active: false },
    { label: 'Payments',   color: 'rgb(16 185 129)',  active: false },
    { label: 'Customers',  color: 'rgb(236 72 153)',  active: false },
    { label: 'Analytics',  color: 'rgb(139 92 246)',  active: false },
    { label: 'AI Copilot', color: 'rgb(167 139 250)', active: false },
]

const CHART_BARS = [42, 68, 55, 78, 62, 90, 74]

// ── Merchant OS mock ─────────────────────────────────────────────────────────

function MerchantOSMock() {
    return (
        <div className="ecos-os" aria-hidden="true">
            <div className="ecos-os-topbar">
                <div className="ecos-os-topbar-left">
                    <div className="ecos-os-topbar-logo" />
                    <span className="ecos-os-topbar-domain">urban-kicks.letbuyy.com</span>
                </div>
                <div className="ecos-os-live">
                    <span className="ecos-os-live-dot" />
                    Live
                </div>
            </div>
            <div className="ecos-os-body">
                <nav className="ecos-os-sidebar">
                    {OS_MODS.map(m => (
                        <div key={m.label} className={`ecos-os-mod${m.active ? ' is-active' : ''}`}>
                            <span className="ecos-os-mod-dot" style={{ background: m.color }} />
                            <span className="ecos-os-mod-label">{m.label}</span>
                        </div>
                    ))}
                </nav>
                <div className="ecos-os-main">
                    <div className="ecos-os-kpis">
                        {[
                            { v: '₹84.2K', l: 'Revenue'  },
                            { v: '248',    l: 'Orders'   },
                            { v: '99.2%',  l: 'Payments' },
                            { v: '3.9%',   l: 'Conv.'    },
                        ].map(k => (
                            <div key={k.l} className="ecos-os-kpi">
                                <span className="ecos-os-kpi-v">{k.v}</span>
                                <span className="ecos-os-kpi-l">{k.l}</span>
                            </div>
                        ))}
                    </div>
                    <div className="ecos-os-chart">
                        {CHART_BARS.map((h, i) => (
                            <div key={i} className="ecos-os-bar" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                    <div className="ecos-os-feed">
                        <div className="ecos-os-feed-row">
                            <span className="ecos-os-feed-dot ecos-os-feed-dot--success" />
                            <span>Order #4821 shipped · Air Classic</span>
                        </div>
                        <div className="ecos-os-feed-row">
                            <span className="ecos-os-feed-dot ecos-os-feed-dot--ai" />
                            <span>AI: Restock Everyday Hoodie — 7 units left</span>
                        </div>
                        <div className="ecos-os-feed-row">
                            <span className="ecos-os-feed-dot ecos-os-feed-dot--pay" />
                            <span>Payment confirmed · ₹2,999 via UPI</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Rail item — mirrors cmap-nav-item exactly ────────────────────────────────

interface EcosRailCard {
    title: string
    tagline: string
    cta: string
    href: string
    accent: string
    Icon?: LucideIcon
    materialIcon?: string
}

function EcosRailItem({
    card,
    index,
    reduced,
}: {
    card: EcosRailCard
    index: number
    reduced: boolean
}) {
    const Icon = card.Icon
    return (
        <motion.div
            initial={{ opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={
                reduced
                    ? { duration: 0 }
                    : { duration: 0.4, delay: index * 0.065, ease: [0.16, 1, 0.3, 1] as const }
            }
        >
            <Link
                href={card.href}
                className="ecos-rail-item"
                style={{ '--ecos-accent': card.accent } as React.CSSProperties}
            >
                {/* Icon box */}
                <span className="ecos-rail-icon" aria-hidden="true">
                    {card.materialIcon
                        ? <MaterialIcon name={card.materialIcon} size={16} />
                        : Icon ? <Icon width={16} height={16} strokeWidth={1.8} /> : null
                    }
                </span>

                {/* Label + tagline */}
                <span className="ecos-rail-text">
                    <span className="ecos-rail-label">{card.title}</span>
                    <span className="ecos-rail-tagline">{card.tagline}</span>
                </span>

                {/* Live badge */}
                <span className="ecos-rail-badge">Live</span>

                {/* Arrow */}
                <ArrowRight
                    width={13}
                    height={13}
                    className="ecos-rail-arrow"
                    aria-hidden="true"
                />
            </Link>
        </motion.div>
    )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EcosystemMap() {
    const reduced = useReducedMotion()

    const cards: EcosRailCard[] = [
        {
            title: 'Themes',
            tagline: 'Production-ready storefronts',
            cta: 'Browse Themes',
            href: getThemeMarketplaceUrl('/themes'),
            accent: 'rgb(6 182 212)',
            Icon: Palette,
        },
        {
            title: 'Apps',
            tagline: 'Payments, shipping & loyalty',
            cta: 'Browse Apps',
            href: getAppMarketplaceUrl('/'),
            accent: 'rgb(16 185 129)',
            Icon: Package,
        },
        {
            title: 'Developers',
            tagline: 'APIs, Webhooks, OAuth, SDKs',
            cta: 'Explore Docs',
            href: getDeveloperPortalUrl('/docs'),
            accent: 'rgb(245 158 11)',
            materialIcon: 'code',
        },
        {
            title: 'Pricing',
            tagline: 'Founder & growth plans',
            cta: 'View Pricing',
            href: getMarketingSiteUrl('/pricing'),
            accent: 'rgb(139 92 246)',
            Icon: CreditCard,
        },
    ]

    return (
        <section id="ecosystem" className="ecosystem">
            <div className="container">

                {/* ── Header ── */}
                <motion.div
                    className="ecosystem-header"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={
                        reduced
                            ? { duration: 0 }
                            : { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }
                    }
                >
                    <div className="ecosystem-eyebrow">
                        <Zap width={11} height={11} aria-hidden="true" />
                        LetBuyy Ecosystem
                    </div>
                    <h2 className="ecosystem-headline">
                        One platform.{' '}
                        <span className="ecosystem-headline-accent">
                            Many powerful surfaces.
                        </span>
                    </h2>
                    <p className="ecosystem-subhead">
                        Everything merchants, developers, operators, and partners need
                        to run commerce from one connected ecosystem.
                    </p>
                </motion.div>

                {/* ── Metrics strip ── */}
                <motion.div
                    className="ecosystem-metrics"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={
                        reduced
                            ? { duration: 0 }
                            : { duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] as const }
                    }
                >
                    {METRICS.map((m, i) => (
                        <div key={i} className="ecosystem-metric">
                            <span className="ecosystem-metric-val">{m.value}</span>
                            <span className="ecosystem-metric-lbl">{m.label}</span>
                        </div>
                    ))}
                </motion.div>

                {/* ── Platform map ── */}
                <div className="ecosystem-grid">

                    {/* Left — Merchant Control Plane flagship */}
                    <motion.article
                        className="ecosystem-flagship"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={
                            reduced
                                ? { duration: 0 }
                                : { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }
                        }
                    >
                        <div className="ecosystem-flagship-badge">
                            <span className="ecosystem-flagship-badge-dot" />
                            <span className="ecosystem-flagship-badge-text">Core Platform</span>
                        </div>

                        <div className="ecosystem-flagship-body">
                            <div className="ecosystem-flagship-top">
                                <span className="ecosystem-flagship-icon" aria-hidden="true">
                                    <Store width={18} height={18} strokeWidth={1.6} />
                                </span>
                                <div>
                                    <div className="ecosystem-flagship-kicker">Merchant Control Plane</div>
                                    <p className="ecosystem-flagship-desc">
                                        The operating system behind every LetBuyy store.
                                    </p>
                                </div>
                            </div>

                            <div className="ecosystem-flagship-chips">
                                {FLAGSHIP_CHIPS.map(c => (
                                    <span key={c} className="ecosystem-flagship-chip">{c}</span>
                                ))}
                            </div>

                            <MerchantOSMock />

                            <Link href={getAccountsUrl('/signup')} className="ecosystem-flagship-cta">
                                Open Control Plane
                                <ArrowRight width={14} height={14} aria-hidden="true" />
                            </Link>
                        </div>
                    </motion.article>

                    {/* Right — Ecosystem rail (mirrors cmap-nav exactly) */}
                    <div className="ecosystem-rail">
                        <p className="ecosystem-rail-label">Platform surfaces</p>
                        <div className="ecosystem-rail-items">
                            {cards.map((card, i) => (
                                <EcosRailItem
                                    key={card.title}
                                    card={card}
                                    index={i}
                                    reduced={!!reduced}
                                />
                            ))}
                        </div>
                        <p className="ecosystem-rail-foot">
                            All surfaces share the same commerce engine,
                            identity system, and data layer.
                        </p>
                    </div>

                </div>
            </div>
        </section>
    )
}
