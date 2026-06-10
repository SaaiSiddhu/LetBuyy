'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Check, IndianRupee, Package, ShoppingBag, Store } from '@letbuyy/ui'
import { getAccountsUrl } from '@/lib/public-urls'

const metrics = [
    { label: 'Revenue', value: '₹4.8L', trend: '+18%', icon: IndianRupee },
    { label: 'Orders', value: '1,284', trend: '+32%', icon: ShoppingBag },
    { label: 'Catalog', value: '326', trend: 'Live', icon: Package },
]

const launches = ['Storefront', 'Payments', 'Inventory', 'Campaign']

export default function Hero() {
    return (
        <section className="hero">
            <div className="hero-bg" aria-hidden="true" />
            <div className="hero-overlay" aria-hidden="true" />
            <div className="container hero-shell">
                <motion.div
                    className="hero-copy"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="hero-eyebrow">
                        <Store width={16} height={16} aria-hidden="true" />
                        Commerce workspace for modern Indian brands
                    </div>
                    <h1 className="hero-title">
                        Build premium storefronts from day one.
                    </h1>
                    <p className="hero-subtitle">
                        Launch stores, blogs and landing pages from one polished workspace. Themes, checkout readiness and operations stay connected.
                    </p>

                    <div className="hero-cta" aria-label="Primary actions">
                        <Link href={getAccountsUrl('/signup')} className="btn btn-primary btn-large">
                            Start for free
                            <ArrowRight width={18} height={18} aria-hidden="true" />
                        </Link>
                        <Link href="#capabilities" className="btn btn-outline btn-large">
                            <span className="hero-cta-play" aria-hidden="true" />
                            See what you can build
                        </Link>
                    </div>
                </motion.div>

                <motion.div
                    className="hero-visual"
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 34, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.82, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="hero-image">
                        <div className="hero-browser-bar">
                            <span className="hero-window-dots">
                                <span />
                                <span />
                                <span />
                            </span>
                            <span className="hero-browser-url">letbuyy.com/workspace</span>
                        </div>

                        <div className="hero-dashboard">
                            <div className="hero-dashboard-main">
                                <div className="hero-dashboard-heading">
                                    <span className="hero-dashboard-kicker">
                                        <BarChart3 width={16} height={16} aria-hidden="true" />
                                        Launch health
                                    </span>
                                    <strong>Urban Loom</strong>
                                </div>

                                <div className="hero-chart" />

                                <div className="hero-launch-list">
                                    {launches.map((item) => (
                                        <span key={item}>
                                            <Check width={14} height={14} aria-hidden="true" />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="hero-metrics">
                                {metrics.map(({ label, value, trend, icon: Icon }) => (
                                    <div className="hero-metric" key={label}>
                                        <span className="hero-metric-icon">
                                            <Icon width={16} height={16} aria-hidden="true" />
                                        </span>
                                        <span className="hero-metric-copy">
                                            <small>{label}</small>
                                            <strong>{value}</strong>
                                        </span>
                                        <em>{trend}</em>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="hero-phone">
                        <div className="hero-phone-top" />
                        <div className="hero-phone-card">
                            <span>Live order</span>
                            <strong>₹2,840</strong>
                        </div>
                        <div className="hero-phone-lines">
                            <span />
                            <span />
                            <span />
                        </div>
                        <BarChart3 width={40} height={40} aria-hidden="true" />
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
