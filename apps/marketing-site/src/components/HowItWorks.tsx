'use client'

import { motion } from 'framer-motion'
import { Palette, Rocket, Sparkles, type LucideIcon } from '@letbuyy/ui'

const steps: Array<{ number: string; title: string; description: string; icon: LucideIcon }> = [
    {
        number: '01',
        title: 'Create your site',
        description: 'Choose a template, pick your site type, and start building in minutes. No coding required.',
        icon: Sparkles,
    },
    {
        number: '02',
        title: 'Customize & Manage',
        description: 'Add products, customize your design, set up payments, and configure your store settings.',
        icon: Palette,
    },
    {
        number: '03',
        title: 'Publish & Grow',
        description: 'Launch your site, connect your domain, and start selling to customers worldwide.',
        icon: Rocket,
    },
]

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="how-it-works">
            <div className="container">
                <motion.div
                    className="how-it-works-header"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="section-label">How It Works</span>
                    <h2 className="section-title">Launch in three simple steps</h2>
                    <p className="section-subtitle">
                        Get your site online in minutes, not months.
                    </p>
                </motion.div>

                <div className="how-it-works-steps">
                    {steps.map((step, index) => {
                        const Icon = step.icon

                        return (
                            <motion.div
                                key={step.number}
                                className="how-it-works-step"
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.2 }}
                            >
                                <div className="step-icon">
                                    <Icon aria-hidden="true" />
                                </div>
                                <div className="step-number">{step.number}</div>
                                <h3 className="step-title">{step.title}</h3>
                                <p className="step-desc">{step.description}</p>
                                {index < steps.length - 1 && (
                                    <div className="step-connector" />
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
