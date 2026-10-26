'use client'

import Copy from '@/components/i18n/Copy'

import Link from '@/components/i18n/LocaleLink'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { getAccountsUrl } from '@/lib/public-urls'
import styles from './final-cta.module.css'

export default function FinalCTA() {
    const reduced = useReducedMotion()
    return (
        <section className="final-cta">
            <div className="final-cta-bg" />
            <div className="container">
                <motion.div
                    className="final-cta-content"
                    initial={reduced ? false : { opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <div className={styles.illustration} aria-hidden="true"><Image src="/illustrations/storefront-launch-cta-v1.webp" alt="" width={1536} height={1024} sizes="(max-width: 640px) 90vw, 600px" loading="eager" unoptimized /></div>
                    <h2 className="final-cta-title">
                        <Copy text={"Start building with LetBuyy today."} /></h2>
                    <p className="final-cta-subtitle">
                        <Copy text={"Launch your store, blog, or landing page in minutes."} /></p>
                    <motion.div
                        className="final-cta-actions"
                        initial={reduced ? false : { opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                            <Link href={getAccountsUrl('/signup')} className="btn btn-primary btn-large">
                                <Copy text={"Get Started Free"} /></Link>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                            <Link href="/demo" className="btn btn-outline btn-large">
                                <Copy text={"Request Demo"} /></Link>
                        </motion.div>
                    </motion.div>
                    <p className="final-cta-note">
                        <Copy text={"No credit card required • Free forever plan available"} /></p>
                </motion.div>
            </div>
        </section>
    )
}
