'use client';

import { motion } from 'framer-motion';

export default function Marquee() {
    const items = [
        "Free Shipping on all orders over INR 999",
        "New Collection Dropping Soon",
        "Premium Quality Guaranteed",
        "30-Day Easy Returns",
        "World Wide Shipping Available"
    ];

    return (
        <div className="footer-theme py-3 overflow-hidden whitespace-nowrap relative z-40">
            <div className="flex">
                <motion.div
                    className="flex gap-12 pr-12"
                    animate={{ x: "-100%" }}
                    transition={{
                        duration: 30,
                        repeat: Infinity,
                        ease: "linear",
                        repeatType: "loop"
                    }}
                >
                    {[...items, ...items, ...items].map((item, i) => (
                        <span key={i} className="text-xs font-medium uppercase tracking-[0.2em] flex items-center gap-12">
                            {item}
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--lb-color-surface)]/30" />
                        </span>
                    ))}
                </motion.div>

                {/* Duplicate for seamless loop */}
                <motion.div
                    className="flex gap-12 pr-12"
                    animate={{ x: "-100%" }}
                    transition={{
                        duration: 30,
                        repeat: Infinity,
                        ease: "linear",
                        repeatType: "loop"
                    }}
                >
                    {[...items, ...items, ...items].map((item, i) => (
                        <span key={`dup-${i}`} className="text-xs font-medium uppercase tracking-[0.2em] flex items-center gap-12">
                            {item}
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--lb-color-surface)]/30" />
                        </span>
                    ))}
                </motion.div>
            </div>
        </div>
    );
}
