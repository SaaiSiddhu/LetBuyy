'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

const plans = [
    {
        name: 'Free Trial',
        price: { monthly: 0, yearly: 0 },
        note: '14 days free',
        features: [
            '1 site',
            '10 products',
            'Basic analytics',
            'Email support',
            'letbuyy.store subdomain',
        ],
        cta: 'Start free trial',
        featured: false,
    },
    {
        name: 'Starter',
        price: { monthly: 199, yearly: 1999 },
        note: 'Then ₹999/month',
        features: [
            '3 sites',
            '100 products',
            'Advanced analytics',
            'Custom domain',
            'Priority support',
            'PDF export',
        ],
        cta: 'Get started',
        featured: true,
    },
    {
        name: 'Business',
        price: { monthly: 1999, yearly: 19999 },
        note: 'For growing businesses',
        features: [
            '10 sites',
            '1000 products',
            'Multi-location inventory',
            'Advanced shipping',
            'API access',
            '0% transaction fees',
        ],
        cta: 'Contact sales',
        featured: false,
    },
]

const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            delay: i * 0.15,
            ease: [0.16, 1, 0.3, 1] as const,
        },
    }),
}

export default function Pricing() {
    const [isYearly, setIsYearly] = useState(false)

    return (
        <section id="pricing" className="pricing">
            <div className="container">
                <motion.div
                    className="pricing-header"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="section-label">Simple Pricing</p>
                    <h2 className="section-title">Start free, scale as you grow</h2>
                    <p className="section-subtitle" style={{ textAlign: 'center', margin: '0 auto' }}>
                        No hidden fees. Cancel anytime.
                    </p>

                    <div className="pricing-toggle">
                        <button
                            className={`pricing-toggle-btn ${!isYearly ? 'active' : ''}`}
                            onClick={() => setIsYearly(false)}
                        >
                            Monthly
                        </button>
                        <button
                            className={`pricing-toggle-btn ${isYearly ? 'active' : ''}`}
                            onClick={() => setIsYearly(true)}
                        >
                            Yearly (Save 20%)
                        </button>
                    </div>
                </motion.div>

                <div className="pricing-grid">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.name}
                            className={`pricing-card ${plan.featured ? 'featured' : ''}`}
                            custom={index}
                            variants={cardVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            whileHover={{ y: plan.featured ? -8 : -12 }}
                        >
                            {plan.featured && <span className="pricing-badge">Most Popular</span>}

                            <h3 className="pricing-name">{plan.name}</h3>

                            <div className="pricing-price">
                                <span className="pricing-price-currency">₹</span>
                                <motion.span
                                    key={isYearly ? 'yearly' : 'monthly'}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {isYearly ? plan.price.yearly : plan.price.monthly}
                                </motion.span>
                                <span className="pricing-price-period">/{isYearly ? 'year' : 'month'}</span>
                            </div>

                            <p className="pricing-note">{plan.note}</p>

                            <ul className="pricing-features">
                                {plan.features.map((feature, i) => (
                                    <li key={i}>
                                        <span className="pricing-check">✓</span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Link
                                    href="http://localhost:3001/signup"
                                    className={`btn ${plan.featured ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ width: '100%' }}
                                >
                                    {plan.cta}
                                </Link>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
