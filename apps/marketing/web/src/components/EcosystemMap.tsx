'use client'

import Copy from '@/components/i18n/Copy'

import Link from '@/components/i18n/LocaleLink'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Store } from '@letbuyy/ui'
import styles from './platform-surfaces.module.css'
import {
    getAccountsUrl,
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
    { label: 'Products',   color: 'var(--lb-primitive-color-purple-500)',  active: false },
    { label: 'Orders',     color: 'var(--lb-primitive-color-blue-500)',  active: true  },
    { label: 'Inventory',  color: 'var(--lb-primitive-color-amber-500)',  active: false },
    { label: 'Payments',   color: 'var(--lb-primitive-color-emerald-500)',  active: false },
    { label: 'Customers',  color: 'var(--lb-primitive-color-pink-500)',  active: false },
    { label: 'Analytics',  color: 'var(--lb-primitive-color-purple-500)',  active: false },
    { label: 'AI Copilot', color: 'var(--lb-primitive-color-purple-400)', active: false },
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
                    <Copy text={"Preview"} /></div>
            </div>
            <div className="ecos-os-body">
                <nav className="ecos-os-sidebar">
                    {OS_MODS.map(m => (
                        <div key={m.label} className={`ecos-os-mod${m.active ? ' is-active' : ''}`}>
                            <span className="ecos-os-mod-dot" style={{ background: m.color }} />
                            <span className="ecos-os-mod-label"><Copy text={m.label} /></span>
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
                                <span className="ecos-os-kpi-l"><Copy text={k.l} /></span>
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
                            <span>Order ORD-4821 shipped · Air Classic</span>
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
    artwork: string
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
    return (
        <motion.div
            className="ecos-rail-item-wrap"
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
                className={`ecos-rail-item ${styles.item}`}
                style={{ '--ecos-accent': card.accent } as React.CSSProperties}
            >
                {/* Icon box */}
                <span className={styles.artwork} aria-hidden="true">
                    <Image src={card.artwork} alt="" width={512} height={512} sizes="64px" loading="eager" unoptimized />
                </span>

                {/* Label + tagline */}
                <span className="ecos-rail-text">
                    <span className="ecos-rail-label"><Copy text={card.title} /></span>
                    <span className="ecos-rail-tagline"><Copy text={card.tagline} /></span>
                </span>

                {/* Live badge */}
                <span className="ecos-rail-badge"><Copy text={card.title === "Pricing" ? "Plans" : "Guide"} /></span>

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
            tagline: 'Storefront themes guide',
            cta: 'Browse Themes',
            href: '/resources/platform/how-themes-work',
            accent: 'var(--lb-primitive-color-cyan-500)',
            artwork: '/illustrations/surfaces/surface-themes-v1.webp',
        },
        {
            title: 'Apps',
            tagline: 'App integrations guide',
            cta: 'Browse Apps',
            href: '/resources/platform/introduction-to-apps',
            accent: 'var(--lb-primitive-color-emerald-500)',
            artwork: '/illustrations/surfaces/surface-apps-v1.webp',
        },
        {
            title: 'Developers',
            tagline: 'APIs, Webhooks, OAuth, SDKs',
            cta: 'Explore Docs',
            href: '/resources/developers',
            accent: 'var(--lb-primitive-color-amber-500)',
            artwork: '/illustrations/surfaces/surface-developers-v1.webp',
        },
        {
            title: 'Pricing',
            tagline: 'Founder & growth plans',
            cta: 'View Pricing',
            href: '/pricing',
            accent: 'var(--lb-primitive-color-purple-500)',
            artwork: '/illustrations/surfaces/surface-pricing-v1.webp',
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
                    <p className="section-label"><Copy text={"LetBuyy Ecosystem"} /></p>
                    <h2 className="ecosystem-headline">
                        <Copy text={"One platform."} />{' '}
                        <span className="ecosystem-headline-accent">
                            <Copy text={"Many powerful surfaces."} /></span>
                    </h2>
                    <p className="ecosystem-subhead">
                        <Copy text={"Everything merchants, developers, operators, and partners need to run commerce from one connected ecosystem."} /></p>
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
                            <span className="ecosystem-metric-val"><Copy text={m.value} /></span>
                            <span className="ecosystem-metric-lbl"><Copy text={m.label} /></span>
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
                            <span className="ecosystem-flagship-badge-text"><Copy text={"Core Platform"} /></span>
                        </div>

                        <div className="ecosystem-flagship-body">
                            <div className="ecosystem-flagship-top">
                                <span className="ecosystem-flagship-icon" aria-hidden="true">
                                    <Store width={18} height={18} strokeWidth={1.6} />
                                </span>
                                <div>
                                    <div className="ecosystem-flagship-kicker"><Copy text={"Merchant Control Plane"} /></div>
                                    <p className="ecosystem-flagship-desc">
                                        <Copy text={"The operating system behind every LetBuyy store."} /></p>
                                </div>
                            </div>

                            <div className="ecosystem-flagship-chips">
                                {FLAGSHIP_CHIPS.map(c => (
                                    <span key={c} className="ecosystem-flagship-chip"><Copy text={c} /></span>
                                ))}
                            </div>

                            <MerchantOSMock />

                            <Link href={getAccountsUrl('/signup')} className="ecosystem-flagship-cta">
                                <Copy text={"Open Control Plane"} /><ArrowRight width={14} height={14} aria-hidden="true" />
                            </Link>
                        </div>
                    </motion.article>

                    {/* Right — Ecosystem rail (mirrors cmap-nav exactly) */}
                    <div className="ecosystem-rail">
                        <p className="ecosystem-rail-label"><Copy text={"Platform surfaces"} /></p>
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
                            <Copy text={"All surfaces share the same commerce engine, identity system, and data layer."} /></p>
                    </div>

                </div>
            </div>
        </section>
    )
}
