'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from '@letbuyy/ui'

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
                    <h1 className="hero-title">
                        Build the next online brand.
                    </h1>
                    <p className="hero-subtitle">
                        Launch stores, portfolios, blogs and landing pages from one workspace. Commerce, checkout and operations are already connected.
                    </p>

                    <div className="hero-cta" aria-label="Primary actions">
                        <Link href="https://accounts.letbuyy.store/signup" className="btn btn-primary btn-large">
                            Start for free
                            <ArrowRight width={18} height={18} aria-hidden="true" />
                        </Link>
                        <Link href="#capabilities" className="btn btn-outline btn-large">
                            <span className="hero-cta-play" aria-hidden="true" />
                            See what you can build
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
