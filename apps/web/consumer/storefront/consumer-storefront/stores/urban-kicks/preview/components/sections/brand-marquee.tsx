'use client';

import { SectionModel } from '@/types/store';

const DEFAULT_BRANDS = [
    'NIKE', 'ADIDAS', 'PUMA', 'JORDAN', 'NEW BALANCE',
    'CONVERSE', 'REEBOK', 'VANS', 'ASICS', 'UNDER ARMOUR',
];

interface BrandMarqueeProps {
    section: SectionModel;
}

export default function BrandMarquee({ section }: BrandMarqueeProps) {
    const settings = section.settings || {};
    const title = (settings.title as string) || 'Trusted by top brands worldwide';
    const speed = (settings.speed as number) || 25;
    const pauseOnHover = settings.pauseOnHover !== false;

    // Use blocks if defined, otherwise fall back to defaults
    const brands: string[] = section.blocks?.length
        ? section.blocks
            .filter(b => b.isVisible !== false)
            .sort((a, b) => a.order - b.order)
            .map(b => (b.settings.name as string) || '')
            .filter(Boolean)
        : (settings.brands as string[]) || DEFAULT_BRANDS;

    return (
        <section className="py-8 md:py-10 bg-black text-white overflow-hidden border-y border-white/[0.06]">
            <div className="max-w-screen-xl mx-auto px-4 md:px-8 mb-6">
                <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/30 font-medium">
                    {title}
                </p>
            </div>
            <div className="relative">
                {/* Fade edges */}
                <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-black to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-black to-transparent z-10" />

                {/* Scrolling track */}
                <div className={`flex uk-marquee ${pauseOnHover ? 'uk-marquee-hover' : ''}`}>
                    {[...brands, ...brands].map((brand, i) => (
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

            <style>{`
                @keyframes uk-marquee-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .uk-marquee {
                    animation: uk-marquee-scroll ${speed}s linear infinite;
                }
                .uk-marquee-hover:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </section>
    );
}
