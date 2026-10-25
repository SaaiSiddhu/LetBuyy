'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

import Link from '@/components/i18n/LocaleLink'
import { motion } from 'framer-motion'
import { ArrowRight, Zap } from '@letbuyy/ui'
import { getAccountsUrl } from '@/lib/public-urls'
import CommerceGlobe from './CommerceGlobe'
import { TrustPills, CommerceMetrics } from './TrustIndicators'

export default function Hero() {
    const { t } = useCopy()
    return (
        <section className="hero">
            <div className="hero-bg" aria-hidden="true" />
            <div className="hero-overlay" aria-hidden="true" />

            <div className="container hero-shell">
                <motion.div
                    className="hero-copy"
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] as const }}
                >
                    <div className="hero-eyebrow">
                        <Zap width={14} height={14} aria-hidden="true" />
                        <Copy text={"Commerce Operating System"} /></div>

                    <h1 className="hero-title">
                        <span className="hero-title-line"><Copy text={"More than a store."} /></span>{' '}
                        <span className="hero-title-os"><Copy text={"Your Commerce OS."} /></span>
                    </h1>

                    <p className="hero-subtitle">
                        <Copy text={"Run storefronts, inventory, orders, payments, analytics, AI, B2B, and operations from one unified platform built for modern commerce."} /></p>

                    <div className="hero-cta" aria-label={t("Get started")}>
                        <Link href={getAccountsUrl('/signup')} className="btn btn-primary btn-hero">
                            <Copy text={"Start Free"} /><ArrowRight width={17} height={17} aria-hidden="true" />
                        </Link>
                        <Link href="#capabilities" className="btn btn-outline btn-hero">
                            <span className="hero-cta-play" aria-hidden="true" />
                            <Copy text={"Explore capabilities"} /></Link>
                    </div>

                    <TrustPills />
                    <CommerceMetrics />
                </motion.div>

                <motion.div
                    className="hero-visual"
                    aria-label={t("Commerce globe illustration")}
                    initial={false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                    <CommerceGlobe placement="hero" />
                </motion.div>
            </div>
        </section>
    )
}
