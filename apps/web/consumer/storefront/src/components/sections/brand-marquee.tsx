'use client';

import type { SectionModel } from '@/types/store';

interface BrandMarqueeProps {
    section: SectionModel;
}

function normalizeBrands(section: SectionModel): string[] {
    const blockBrands = (section.blocks || [])
        .filter((block) => block.isVisible !== false)
        .sort((a, b) => a.order - b.order)
        .map((block) => (block.settings.name as string) || '')
        .filter(Boolean);

    if (blockBrands.length > 0) return blockBrands;

    return Array.isArray(section.settings.brands)
        ? section.settings.brands.filter((brand): brand is string => typeof brand === 'string' && brand.length > 0)
        : [];
}

export default function BrandMarquee({ section }: BrandMarqueeProps) {
    const brands = normalizeBrands(section);
    if (brands.length === 0) return null;

    const title = (section.settings.title as string) || 'Featured brands';
    const speed = Math.min(Math.max(Number(section.settings.speed) || 25, 10), 60);
    const pauseOnHover = section.settings.pauseOnHover !== false;

    return (
        <section className="py-8 md:py-10 bg-black text-white overflow-hidden border-y border-white/[0.06]">
            <div className="max-w-screen-xl mx-auto px-4 md:px-8 mb-6">
                <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/35 font-medium">
                    {title}
                </p>
            </div>
            <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-black to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-black to-transparent z-10" />
                <div className={`flex lb-marquee ${pauseOnHover ? 'lb-marquee-hover' : ''}`}>
                    {[...brands, ...brands].map((brand, index) => (
                        <div key={`${brand}-${index}`} className="flex-shrink-0 px-6 md:px-10">
                            <span className="text-xl md:text-2xl font-black tracking-tighter text-white/25 hover:text-white/65 transition-colors duration-300 whitespace-nowrap select-none">
                                {brand}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes lb-marquee-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .lb-marquee {
                    animation: lb-marquee-scroll ${speed}s linear infinite;
                }
                .lb-marquee-hover:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </section>
    );
}
