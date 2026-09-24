'use client'

import Link from '@/components/i18n/LocaleLink'
import { motion } from 'framer-motion'
import { getAccountsUrl } from '@/lib/public-urls'

export default function FinalCTA() {
    return (
        <section className="final-cta">
            <div className="final-cta-bg" />
            <div className="container">
                <motion.div
                    className="final-cta-content"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <h2 className="final-cta-title">
                        Start building with LetBuyy today.
                    </h2>
                    <p className="final-cta-subtitle">
                        Launch your store, blog, or landing page in minutes.
                    </p>
                    <motion.div
                        className="final-cta-actions"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                            <Link href={getAccountsUrl('/signup')} className="btn btn-primary btn-large">
                                Get Started Free
                            </Link>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                            <Link href="/demo" className="btn btn-outline btn-large">
                                Request Demo
                            </Link>
                        </motion.div>
                    </motion.div>
                    <p className="final-cta-note">
                        No credit card required • Free forever plan available
                    </p>
                </motion.div>
            </div>
        </section>
    )
}
