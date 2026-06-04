'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    ArrowRight,
    CheckCircle2,
    CreditCard,
    Package,
    Palette,
    ShieldCheck,
    Truck,
    type LucideIcon,
} from '@letbuyy/ui'
import BrandLogo from './BrandLogo'

const launchProof = [
    'No credit card required',
    'INR, GST and COD-ready setup',
    'Store, portfolio, resume and blog sites',
]

const highlights: Array<{ icon: LucideIcon; title: string; copy: string }> = [
    {
        icon: Palette,
        title: 'Visual store builder',
        copy: 'Design storefront sections, pages and brand settings without leaving the merchant workspace.',
    },
    {
        icon: CreditCard,
        title: 'India-first checkout',
        copy: 'Prepare COD, online payments, tax guidance and launch defaults from the same onboarding path.',
    },
    {
        icon: Package,
        title: 'Operations from day one',
        copy: 'Products, inventory, orders, themes and analytics are organized for daily merchant work.',
    },
]

const merchantSegments = ['D2C stores', 'Creators', 'Freelancers', 'Service teams']

function HighlightCard({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
    return (
        <li className="hero-highlight-card">
            <span className="hero-highlight-icon">
                <Icon width={18} height={18} aria-hidden="true" />
            </span>
            <span>
                <strong>{title}</strong>
                <span>{copy}</span>
            </span>
        </li>
    )
}

function ProductPreview() {
    return (
        <div className="hero-product-preview" aria-label="LetBuyy merchant launch dashboard preview">
            <div className="hero-preview-topbar">
                <BrandLogo className="hero-preview-logo" width={120} height={39} />
                <span className="hero-preview-status">
                    <CheckCircle2 width={14} height={14} aria-hidden="true" />
                    Live preview
                </span>
            </div>

            <div className="hero-preview-main">
                <div className="hero-preview-storefront">
                    <div className="hero-storefront-header">
                        <span>Urban Kicks</span>
                        <span>letbuyy.store</span>
                    </div>
                    <div className="hero-storefront-hero">
                        <span>New season drops</span>
                        <strong>Launch a storefront that is ready to sell.</strong>
                    </div>
                    <div className="hero-product-grid" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                </div>

                <div className="hero-preview-panel">
                    <div className="hero-panel-header">
                        <span>Launch checklist</span>
                        <strong>4 of 5 ready</strong>
                    </div>
                    <ul className="hero-checklist">
                        <li>
                            <CheckCircle2 width={16} height={16} aria-hidden="true" />
                            Store theme selected
                        </li>
                        <li>
                            <CheckCircle2 width={16} height={16} aria-hidden="true" />
                            Products imported
                        </li>
                        <li>
                            <Truck width={16} height={16} aria-hidden="true" />
                            Shipping zones drafted
                        </li>
                        <li>
                            <ShieldCheck width={16} height={16} aria-hidden="true" />
                            COD policy reviewed
                        </li>
                    </ul>
                    <div className="hero-payment-row">
                        <span>UPI</span>
                        <span>Cards</span>
                        <span>COD</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function Hero() {
    return (
        <>
            <section className="hero">
                <div className="container hero-shell">
                    <motion.div
                        className="hero-copy"
                        initial={{ opacity: 0, y: 28 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <p className="hero-kicker">India-first commerce operating system</p>
                        <h1 className="hero-title">
                            Launch a polished online store without stitching tools together.
                        </h1>
                        <p className="hero-subtitle">
                            LetBuyy brings site building, themes, products, checkout readiness and merchant operations into one workspace for stores, creators and small teams.
                        </p>

                        <div className="hero-cta" aria-label="Primary actions">
                            <Link href="https://accounts.letbuyy.com/signup" className="btn btn-primary btn-large">
                                Start free
                                <ArrowRight width={18} height={18} aria-hidden="true" />
                            </Link>
                            <Link href="#capabilities" className="btn btn-outline btn-large">
                                See what you can build
                            </Link>
                        </div>

                        <ul className="hero-proof-list" aria-label="Launch proof points">
                            {launchProof.map((item) => (
                                <li key={item}>
                                    <CheckCircle2 width={16} height={16} aria-hidden="true" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    <motion.div
                        className="hero-visual"
                        initial={{ opacity: 0, y: 32 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <ProductPreview />
                    </motion.div>
                </div>
            </section>

            <section id="landing-highlights" className="container hero-value-strip" aria-label="Feature highlights and audience fit">
                <ul className="hero-highlights">
                    {highlights.map((item) => (
                        <HighlightCard key={item.title} {...item} />
                    ))}
                </ul>
                <div className="hero-segments">
                    <span>Built for</span>
                    {merchantSegments.map((segment) => (
                        <strong key={segment}>{segment}</strong>
                    ))}
                </div>
            </section>
        </>
    )
}
