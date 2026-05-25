'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionModel, TestimonialsSettings, ThemeSettings } from '@/types/store';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    section: SectionModel;
    theme?: ThemeSettings;
}

const textValue = (value: unknown, fallback = '') =>
    typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const numberValue = (value: unknown, fallback: number) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export default function TestimonialsSection({ section, theme }: Props) {
    const settings = section.settings as Partial<TestimonialsSettings>;
    const blocks = section.blocks || [];

    const title = settings.title || 'What Our Customers Say';
    const subtitle = settings.subtitle || '';
    const showRating = settings.showRating !== false;

    const testimonials = blocks
        .filter(b => b.type === 'testimonialCard' && b.isVisible !== false)
        .map(b => ({
            id: b.id,
            name: textValue(b.settings.name, 'Customer'),
            text: textValue(b.settings.text, textValue(b.settings.content)),
            rating: numberValue(b.settings.rating, 5),
            image: textValue(b.settings.image, textValue(b.settings.avatar)),
            product: textValue(b.settings.product),
        }));

    const [activeIndex, setActiveIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const goTo = useCallback((index: number, dir?: number) => {
        setDirection(dir ?? (index > activeIndex ? 1 : -1));
        setActiveIndex(index);
    }, [activeIndex]);

    const goNext = useCallback(() => {
        if (testimonials.length === 0) return;
        goTo((activeIndex + 1) % testimonials.length, 1);
    }, [activeIndex, testimonials.length, goTo]);

    const goPrev = useCallback(() => {
        if (testimonials.length === 0) return;
        goTo((activeIndex - 1 + testimonials.length) % testimonials.length, -1);
    }, [activeIndex, testimonials.length, goTo]);

    useEffect(() => {
        if (isPaused || testimonials.length === 0) return;
        timerRef.current = setInterval(goNext, 5000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [goNext, isPaused, testimonials.length]);

    const touchStartX = useRef(0);
    const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; setIsPaused(true); };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                goNext();
            } else {
                goPrev();
            }
        }
        setIsPaused(false);
    };

    if (testimonials.length === 0) return null;

    const active = testimonials[activeIndex];

    const slideVariants = {
        enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
    };

    const pauseNav = () => { setIsPaused(true); setTimeout(() => setIsPaused(false), 8000); };

    return (
        <section className="py-16 md:py-20 px-4 md:px-8 overflow-hidden bg-white text-black">
            <div className="max-w-screen-xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-3">
                    <div>
                        <motion.h2
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-2xl md:text-4xl font-bold tracking-tight"
                        >
                            {title}
                        </motion.h2>
                        {subtitle && (
                            <motion.p
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="mt-2 text-sm md:text-base text-black/40"
                            >
                                {subtitle}
                            </motion.p>
                        )}
                    </div>
                    {/* Arrows — desktop */}
                    <div className="hidden md:flex items-center gap-2">
                        <button onClick={() => { goPrev(); pauseNav(); }} className="w-10 h-10 rounded-full border border-black/15 flex items-center justify-center hover:bg-black/5 transition-colors" aria-label="Previous">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={() => { goNext(); pauseNav(); }} className="w-10 h-10 rounded-full border border-black/15 flex items-center justify-center hover:bg-black/5 transition-colors" aria-label="Next">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Carousel */}
                <div
                    className="relative"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="min-h-[220px] md:min-h-[180px]">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={active.id}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                                className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10"
                            >
                                {/* Quote */}
                                <div className="md:col-span-8">
                                    <div className="bg-black/[0.03] rounded-2xl p-6 md:p-8 border border-black/[0.06] h-full flex flex-col justify-between">
                                        <div>
                                            <svg className="w-8 h-8 mb-4 text-black/15" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                            </svg>
                                            <p className="text-lg md:text-xl leading-relaxed font-light">
                                                {active.text}
                                            </p>
                                        </div>
                                        {showRating && (
                                            <div className="flex gap-0.5 mt-5">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={14}
                                                        fill={i < active.rating ? '#000' : 'none'}
                                                        stroke={i < active.rating ? '#000' : 'rgba(0,0,0,0.15)'}
                                                        strokeWidth={i < active.rating ? 0 : 2}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Author */}
                                <div className="md:col-span-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                                            {active.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">{active.name}</p>
                                            <p className="text-xs text-black/35">Verified Buyer</p>
                                        </div>
                                    </div>
                                    {active.product && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/[0.04] border border-black/[0.06] text-xs text-black/50 w-fit">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                                            {active.product}
                                        </div>
                                    )}
                                    {/* Progress */}
                                    <div className="mt-6 pt-4 border-t border-black/[0.06]">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xs font-medium tabular-nums">{String(activeIndex + 1).padStart(2, '0')}</span>
                                            <div className="flex-1 h-px bg-black/10 relative overflow-hidden">
                                                <motion.div className="absolute inset-y-0 left-0 bg-black" initial={{ width: '0%' }} animate={{ width: `${((activeIndex + 1) / testimonials.length) * 100}%` }} transition={{ duration: 0.35 }} />
                                            </div>
                                            <span className="text-xs text-black/30 tabular-nums">{String(testimonials.length).padStart(2, '0')}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Mobile dots */}
                    <div className="flex items-center justify-center gap-1.5 mt-8 md:hidden">
                        {testimonials.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => { goTo(i); pauseNav(); }}
                                className={`h-1 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-5 bg-black' : 'w-1.5 bg-black/20'}`}
                                aria-label={`Testimonial ${i + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
