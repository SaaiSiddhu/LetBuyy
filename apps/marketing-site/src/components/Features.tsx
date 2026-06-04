'use client'

import { motion } from 'framer-motion'
import {
    AppWindow,
    BadgeCheck,
    CreditCard,
    FileText,
    Palette,
    ShoppingBag,
    Store,
    Truck,
    type LucideIcon,
} from '@letbuyy/ui'

type ShowcaseKey = 'products' | 'themes' | 'apps' | 'payments'

interface ShowcaseFeature {
    key: ShowcaseKey
    icon: LucideIcon
    eyebrow: string
    title: string
    copy: string
    proof: string
    points: string[]
}

const showcaseFeatures: ShowcaseFeature[] = [
    {
        key: 'products',
        icon: ShoppingBag,
        eyebrow: 'Products',
        title: 'Catalogs built for daily merchant work',
        copy: 'Create rich product pages, group collections, monitor stock, and keep the launch checklist visible without leaving the control plane.',
        proof: 'Products, inventory and launch status in one view',
        points: ['Variants and collections', 'Inventory warnings', 'Published-store readiness'],
    },
    {
        key: 'themes',
        icon: Palette,
        eyebrow: 'Themes',
        title: 'A visual builder that feels like the storefront',
        copy: 'Pick a theme, preview responsive sections, and tune the customer-facing page structure while the storefront stays connected to the same content model.',
        proof: 'Theme preview plus mobile frame',
        points: ['Responsive sections', 'Brand controls', 'Preview before publish'],
    },
    {
        key: 'apps',
        icon: AppWindow,
        eyebrow: 'Apps',
        title: 'Marketplace workflows for extensions and partners',
        copy: 'Install app capabilities through governed marketplace surfaces, with review-ready listings and clear operational states for merchants and partners.',
        proof: 'Install-ready marketplace cards',
        points: ['App discovery', 'Install status', 'Partner review path'],
    },
    {
        key: 'payments',
        icon: CreditCard,
        eyebrow: 'Payments',
        title: 'India-first checkout readiness',
        copy: 'Show merchants a clear path through COD, GST invoice posture, payment-provider setup, and fulfillment signals without inventing live provider status.',
        proof: 'COD, GST and provider setup visibility',
        points: ['COD workflow', 'GST-ready invoices', 'Provider setup guidance'],
    },
]

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
        },
    },
}

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1] as const,
        },
    },
}

function ProductsVisual() {
    return (
        <div className="feature-showcase-visual feature-products-visual" aria-label="Products catalog management preview">
            <div className="feature-visual-toolbar">
                <span>Products</span>
                <span>Live</span>
            </div>
            <div className="feature-product-list">
                {[
                    ['Classic Sneakers', '42 in stock', 'Published'],
                    ['Everyday Hoodie', '7 left', 'Low stock'],
                    ['Gift Card', 'Digital', 'Ready'],
                ].map(([name, stock, status]) => (
                    <div key={name} className="feature-product-row">
                        <div className="feature-product-thumb" aria-hidden="true" />
                        <div>
                            <strong>{name}</strong>
                            <span>{stock}</span>
                        </div>
                        <em>{status}</em>
                    </div>
                ))}
            </div>
            <div className="feature-visual-metrics">
                <span>3 collections</span>
                <span>92% ready</span>
            </div>
        </div>
    )
}

function ThemesVisual() {
    return (
        <div className="feature-showcase-visual feature-themes-visual" aria-label="Theme editor preview">
            <div className="feature-theme-browser">
                <div className="feature-theme-hero">
                    <Store width={18} height={18} aria-hidden="true" />
                    <span>Urban Kicks</span>
                </div>
                <div className="feature-theme-grid">
                    <span />
                    <span />
                    <span />
                </div>
            </div>
            <div className="feature-theme-phone">
                <span />
                <span />
                <span />
            </div>
            <div className="feature-theme-swatches" aria-label="Theme swatches">
                <span className="feature-swatch-primary" />
                <span className="feature-swatch-success" />
                <span className="feature-swatch-warning" />
            </div>
        </div>
    )
}

function AppsVisual() {
    return (
        <div className="feature-showcase-visual feature-apps-visual" aria-label="App marketplace install preview">
            <div className="feature-app-card feature-app-card-active">
                <BadgeCheck width={18} height={18} aria-hidden="true" />
                <div>
                    <strong>Reviews sync</strong>
                    <span>Installed</span>
                </div>
            </div>
            <div className="feature-app-card">
                <Truck width={18} height={18} aria-hidden="true" />
                <div>
                    <strong>Shipping rules</strong>
                    <span>Ready to install</span>
                </div>
            </div>
            <div className="feature-app-card">
                <FileText width={18} height={18} aria-hidden="true" />
                <div>
                    <strong>Invoice tools</strong>
                    <span>Review required</span>
                </div>
            </div>
        </div>
    )
}

function PaymentsVisual() {
    return (
        <div className="feature-showcase-visual feature-payments-visual" aria-label="Payments and GST readiness preview">
            <div className="feature-payment-total">
                <span>Checkout readiness</span>
                <strong>COD + GST</strong>
            </div>
            <div className="feature-payment-rail">
                <span>COD</span>
                <em>Enabled workflow</em>
            </div>
            <div className="feature-payment-rail">
                <span>GST invoice</span>
                <em>Ready fields</em>
            </div>
            <div className="feature-payment-rail">
                <span>Provider setup</span>
                <em>Guided status</em>
            </div>
        </div>
    )
}

function FeatureVisual({ feature }: { feature: ShowcaseKey }) {
    if (feature === 'products') return <ProductsVisual />
    if (feature === 'themes') return <ThemesVisual />
    if (feature === 'apps') return <AppsVisual />
    return <PaymentsVisual />
}

export default function Features() {
    return (
        <section id="features" className="features feature-showcase">
            <div className="container">
                <motion.div
                    className="feature-showcase-header"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="section-label">Feature showcase</p>
                    <h2 className="section-title">The core workflows merchants inspect first</h2>
                    <p className="section-subtitle">
                        LetBuyy brings product management, theme editing, marketplace apps, and checkout readiness into one merchant operating surface.
                    </p>
                </motion.div>

                <motion.div
                    className="feature-showcase-grid"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    {showcaseFeatures.map((feature) => {
                        const Icon = feature.icon

                        return (
                            <motion.article
                                key={feature.key}
                                className="feature-showcase-card"
                                variants={cardVariants}
                                whileHover={{ y: -4 }}
                            >
                                <div className="feature-showcase-copy">
                                    <div className="feature-showcase-kicker">
                                        <Icon width={18} height={18} aria-hidden="true" />
                                        <span>{feature.eyebrow}</span>
                                    </div>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.copy}</p>
                                    <strong>{feature.proof}</strong>
                                    <ul>
                                        {feature.points.map((point) => (
                                            <li key={point}>
                                                <BadgeCheck width={16} height={16} aria-hidden="true" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <FeatureVisual feature={feature.key} />
                            </motion.article>
                        )
                    })}
                </motion.div>
            </div>
        </section>
    )
}
