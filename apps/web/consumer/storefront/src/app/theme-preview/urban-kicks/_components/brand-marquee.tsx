'use client';

import { useEffect, useRef } from 'react';

const BRANDS = [
    'NIKE', 'ADIDAS', 'PUMA', 'JORDAN', 'NEW BALANCE',
    'CONVERSE', 'REEBOK', 'VANS', 'ASICS', 'UNDER ARMOUR',
];

export default function BrandMarquee() {
    return (
        <section className="py-8 md:py-10 bg-black text-white overflow-hidden border-y border-white/[0.06]">
            <div className="max-w-screen-xl mx-auto px-4 md:px-8 mb-6">
                <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/30 font-medium">
                    Trusted by top brands worldwide
                </p>
            </div>
            <div className="relative">
                {/* Fade edges */}
                <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-black to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-black to-transparent z-10" />

                {/* Scrolling track */}
                <div className="flex animate-marquee">
                    {[...BRANDS, ...BRANDS].map((brand, i) => (
                        <div
                            key={`${brand}-${i}`}
                            className="flex-shrink-0 px-6 md:px-10"
                        >
                            <span className="text-xl md:text-2xl font-black tracking-tighter text-white/20 hover:text-white/60 transition-colors duration-300 whitespace-nowrap select-none">
                                {brand}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* CSS animation */}
            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 25s linear infinite;
                }
                .animate-marquee:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </section>
    );
}
