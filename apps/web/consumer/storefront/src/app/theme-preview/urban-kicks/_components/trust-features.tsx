'use client';

import { motion } from 'framer-motion';
import { Truck, ShieldCheck, RotateCcw, Headphones } from 'lucide-react';

const FEATURES = [
    {
        icon: Truck,
        title: 'Free Shipping',
        desc: 'On orders above ₹999',
    },
    {
        icon: ShieldCheck,
        title: '100% Authentic',
        desc: 'Guaranteed genuine products',
    },
    {
        icon: RotateCcw,
        title: 'Easy Returns',
        desc: '7-day hassle-free returns',
    },
    {
        icon: Headphones,
        title: '24/7 Support',
        desc: 'We\'re here to help',
    },
];

export default function TrustFeatures() {
    return (
        <section className="py-10 md:py-14 px-4 md:px-8 bg-white">
            <div className="max-w-screen-xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {FEATURES.map((feat, i) => (
                        <motion.div
                            key={feat.title}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="flex flex-col items-center text-center p-5 md:p-6 rounded-xl border border-black/[0.06] hover:border-black/15 transition-colors group"
                        >
                            <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-black flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                <feat.icon size={18} className="text-white" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-sm md:text-base font-semibold text-black mb-0.5">
                                {feat.title}
                            </h3>
                            <p className="text-[11px] md:text-xs text-black/40">
                                {feat.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
