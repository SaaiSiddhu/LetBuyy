'use client'

import { motion } from 'framer-motion'

const brands = [
    'Startup Co.',
    'Digital Agency',
    'Creative Studio',
    'Tech Venture',
    'Design Lab',
    'Growth Hub',
    'Brand Forge',
    'Media Plus',
]

export default function SocialProof() {
    return (
        <section className="social-proof">
            <div className="container">
                <motion.p
                    className="social-proof-text"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    Trusted by creators, founders, and businesses worldwide
                </motion.p>

                <div className="social-proof-logos">
                    <div className="social-proof-track">
                        {[...brands, ...brands].map((brand, index) => (
                            <span key={index} className="social-proof-logo">
                                {brand}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
