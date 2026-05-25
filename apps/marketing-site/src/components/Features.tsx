'use client'

import { motion } from 'framer-motion'

const features = [
    {
        icon: '🎯',
        title: 'Drag & Drop Builder',
        desc: 'No coding required. Build beautiful pages with our intuitive visual editor.',
        span: 'span-3',
    },
    {
        icon: '📱',
        title: 'Mobile-First',
        desc: 'Your site looks stunning on every device, automatically optimized.',
        span: 'span-3',
    },
    {
        icon: '💳',
        title: 'Indian Payments',
        desc: 'Accept UPI, cards, and wallets via Razorpay & Stripe.',
        span: 'span-2',
    },
    {
        icon: '📦',
        title: 'Inventory',
        desc: 'Real-time stock tracking with low-stock alerts.',
        span: 'span-2',
    },
    {
        icon: '📊',
        title: 'Analytics',
        desc: 'Track sales and visitors in real-time.',
        span: 'span-2',
    },
    {
        icon: '🔗',
        title: 'Custom Domains',
        desc: 'Use your own domain or get a free *.letbuyy.store subdomain.',
        span: 'span-3',
    },
    {
        icon: '🔐',
        title: 'Enterprise Security',
        desc: 'SSL certificates, secure payments, and data protection built-in.',
        span: 'span-3',
    },
]

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
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

export default function Features() {
    return (
        <section id="features" className="features">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="section-label">Powerful Features</p>
                    <h2 className="section-title">Everything you need to succeed</h2>
                    <p className="section-subtitle">
                        From payments to analytics — all the tools you need in one place.
                    </p>
                </motion.div>

                <motion.div
                    className="features-grid"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            className={`feature-card ${feature.span}`}
                            variants={cardVariants}
                            whileHover={{ y: -4 }}
                        >
                            <div className="feature-icon">{feature.icon}</div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-desc">{feature.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}
