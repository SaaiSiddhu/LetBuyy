'use client'

import * as motion from 'framer-motion/m'
import { CheckCircle2 } from '@letbuyy/ui'

// Feature data with benefits (max 3)
const features = [
    {
        id: 'ecommerce',
        title: 'E-commerce Store',
        description: 'Build a complete online store with everything you need to sell at scale.',
        benefits: ['Real-time inventory', 'Multi-gateway payments', 'Order & shipping management'],
        visual: 'ecommerce',
    },
    {
        id: 'landing',
        title: 'Landing Pages',
        description: 'High-conversion pages that turn visitors into customers.',
        benefits: ['Lead capture forms', 'A/B testing', 'Analytics & domains'],
        visual: 'landing',
    },
    {
        id: 'blog',
        title: 'Blogs',
        description: 'Publish articles, guides, and announcements from the same workspace.',
        benefits: ['Posts & categories', 'SEO-ready pages', 'Analytics & domains'],
        visual: 'landing',
    },
    ...(process.env.NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES === 'true'
        ? [
            {
                id: 'portfolio',
                title: 'Portfolio',
                description: 'Legacy portfolio sites for existing cohorts.',
                benefits: ['Project galleries', 'Skills & testimonials', 'Contact forms'],
                visual: 'portfolio',
            },
            {
                id: 'resume',
                title: 'Resume Website',
                description: 'Legacy resume sites for existing cohorts.',
                benefits: ['PDF export', 'Multiple themes', 'Work history & skills'],
                visual: 'resume',
            },
        ]
        : []),
]

// CSS-based visual mockups for each feature type
function FeatureVisual({ type }: { type: string }) {
    if (type === 'ecommerce') {
        return (
            <div className="feature-visual feature-visual-ecommerce">
                <div className="mockup-header">
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                </div>
                <div className="mockup-sidebar">
                    <div className="mockup-nav-item active"></div>
                    <div className="mockup-nav-item"></div>
                    <div className="mockup-nav-item"></div>
                    <div className="mockup-nav-item"></div>
                </div>
                <div className="mockup-content">
                    <div className="mockup-stats">
                        <div className="mockup-stat-card"></div>
                        <div className="mockup-stat-card"></div>
                        <div className="mockup-stat-card"></div>
                    </div>
                    <div className="mockup-products">
                        <div className="mockup-product"></div>
                        <div className="mockup-product"></div>
                        <div className="mockup-product"></div>
                        <div className="mockup-product"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (type === 'portfolio') {
        return (
            <div className="feature-visual feature-visual-portfolio">
                <div className="mockup-header">
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                </div>
                <div className="mockup-portfolio-grid">
                    <div className="mockup-portfolio-item large"></div>
                    <div className="mockup-portfolio-item"></div>
                    <div className="mockup-portfolio-item"></div>
                    <div className="mockup-portfolio-item"></div>
                    <div className="mockup-portfolio-item"></div>
                </div>
            </div>
        )
    }

    if (type === 'resume') {
        return (
            <div className="feature-visual feature-visual-resume">
                <div className="mockup-header">
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                </div>
                <div className="mockup-resume-content">
                    <div className="mockup-resume-header"></div>
                    <div className="mockup-resume-section">
                        <div className="mockup-resume-line long"></div>
                        <div className="mockup-resume-line"></div>
                        <div className="mockup-resume-line"></div>
                    </div>
                    <div className="mockup-resume-section">
                        <div className="mockup-resume-line long"></div>
                        <div className="mockup-resume-line"></div>
                    </div>
                    <div className="mockup-resume-btn"></div>
                </div>
            </div>
        )
    }

    if (type === 'landing') {
        return (
            <div className="feature-visual feature-visual-landing">
                <div className="mockup-header">
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                    <div className="mockup-dot"></div>
                </div>
                <div className="mockup-landing-hero">
                    <div className="mockup-landing-headline"></div>
                    <div className="mockup-landing-subtext"></div>
                    <div className="mockup-landing-cta"></div>
                </div>
                <div className="mockup-landing-features">
                    <div className="mockup-landing-feature"></div>
                    <div className="mockup-landing-feature"></div>
                    <div className="mockup-landing-feature"></div>
                </div>
            </div>
        )
    }

    return null
}

export default function SiteTypes() {
    return (
        <section className="site-types" id="capabilities">
            <div className="container">
                {/* Section Header */}
                <motion.div
                    className="site-types-header"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="section-label">WHAT YOU CAN BUILD</span>
                    <h2 className="section-title">One platform. Endless possibilities.</h2>
                    <p className="section-subtitle">
                        From stores to campaigns and blogs — launch with one governed workspace.
                    </p>
                </motion.div>

                {/* Feature Rows - Alternating Layout */}
                <div className="site-types-features">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.id}
                            className={`feature-row ${index % 2 === 1 ? 'feature-row-reverse' : ''}`}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                        >
                            {/* Visual */}
                            <motion.div
                                className="feature-visual-container"
                                whileInView={{ scale: [0.95, 1] }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6 }}
                            >
                                <FeatureVisual type={feature.visual} />
                            </motion.div>

                            {/* Content */}
                            <div className="feature-content">
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-description">{feature.description}</p>
                                <ul className="feature-benefits">
                                    {feature.benefits.map((benefit) => (
                                        <li key={benefit}>
                                            <CheckCircle2 width={20} height={20} aria-hidden="true" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
