'use client'

import { motion } from 'framer-motion'
import { FileText, Palette, Rocket, Store, type LucideIcon } from '@letbuyy/ui'

const capabilities: Array<{ icon: LucideIcon; title: string; desc: string }> = [
    {
        icon: Store,
        title: 'E-commerce Store',
        desc: 'Sell products online with payments, inventory tracking & automated shipping.',
    },
    {
        icon: Palette,
        title: 'Portfolio',
        desc: 'Showcase your creative work with stunning galleries and project displays.',
    },
    {
        icon: FileText,
        title: 'Resume',
        desc: 'Create professional CVs with PDF export and ATS-optimized templates.',
    },
    {
        icon: Rocket,
        title: 'Landing Page',
        desc: 'Build high-converting marketing pages for products and campaigns.',
    },
]

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
        },
    },
}

const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1] as const,
        },
    },
}

export default function Capabilities() {
    return (
        <section id="capabilities" className="capabilities">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="section-label">What you can build</p>
                    <h2 className="section-title">One platform, endless possibilities</h2>
                    <p className="section-subtitle">
                        Whether you&apos;re a small business, freelancer, or entrepreneur — LetBuyy adapts to your needs.
                    </p>
                </motion.div>

                <motion.div
                    className="capabilities-grid"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-50px' }}
                >
                    {capabilities.map((item, index) => {
                        const Icon = item.icon

                        return (
                            <motion.div
                                key={index}
                                className="capability-card"
                                variants={cardVariants}
                                whileHover={{ y: -8 }}
                            >
                                <div className="capability-icon">
                                    <Icon aria-hidden="true" />
                                </div>
                                <h3 className="capability-title">{item.title}</h3>
                                <p className="capability-desc">{item.desc}</p>
                            </motion.div>
                        )
                    })}
                </motion.div>
            </div>
        </section>
    )
}
