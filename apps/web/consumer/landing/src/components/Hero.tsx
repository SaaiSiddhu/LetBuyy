'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import SocialProof from './SocialProof'

export default function Hero() {
    return (
        <section className="hero">
            {/* Animated Gradient Background */}
            <div className="hero-gradient" />

            {/* Floating Gradient Blobs - Desktop only via CSS */}
            <div className="hero-blob-1" aria-hidden="true" />
            <div className="hero-blob-2" aria-hidden="true" />
            <div className="hero-blob-3" aria-hidden="true" />

            {/* Radial Glow */}
            <div className="hero-glow" aria-hidden="true" />

            {/* Content */}
            <div className="hero-content">
                {/* Headline - At the TOP */}
                <motion.h1
                    className="hero-title"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                    Build Anything.<br />
                    <span className="hero-title-emphasis">Sell Everything.</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    className="hero-subtitle"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                >
                    Your all-in-one platform for e-commerce stores, portfolios,
                    and digital presence. Launch in minutes, scale forever.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    className="hero-cta"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                >
                    <Link href="https://accounts.letbuyy.com/signup" className="btn btn-primary btn-large">
                        Start Free
                    </Link>
                    <Link href="#demo" className="btn btn-outline btn-large">
                        View Demo
                    </Link>
                </motion.div>

                {/* Badge - BELOW CTAs */}
                <motion.div
                    className="hero-badge"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                >
                    <span className="hero-badge-dot" />
                    Free forever plan • No credit card required
                </motion.div>

                {/* Social Proof Carousel */}
                <motion.div
                    className="hero-social-proof"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 1.0 }}
                >
                    <SocialProof />
                </motion.div>
            </div>
        </section>
    )
}
