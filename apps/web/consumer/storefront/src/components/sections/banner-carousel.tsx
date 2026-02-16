'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { ThemeSettings, DEFAULT_THEME_SETTINGS } from '@/types/store';

interface BannerSlide {
    heading?: string;
    subheading?: string;
    buttonText?: string;
    buttonLink?: string;
    imageUrl?: string;
}

interface BannerCarouselProps {
    banners: BannerSlide[];
    autoplay?: boolean;
    interval?: number;
    showIndicators?: boolean;
    showArrows?: boolean;
    height?: 'small' | 'medium' | 'large' | 'full';
    textAlign?: 'left' | 'center' | 'right';
    overlay?: number;
    theme?: ThemeSettings;
}

// Updated height classes - medium is now 500px
const heightClasses: Record<string, string> = {
    full: 'h-[700px] md:h-[800px]',
    large: 'h-[600px]',
    medium: 'h-[500px]',
    small: 'h-[400px]',
};

const alignClasses: Record<string, string> = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
};

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? '100%' : '-100%',
        opacity: 0,
    }),
};

export default function BannerCarousel({
    banners,
    autoplay = true,
    interval = 5000,
    showIndicators = true,
    showArrows = true,
    height = 'medium',
    textAlign = 'left',
    overlay = 0.4,
    theme,
}: BannerCarouselProps) {
    const [[currentIndex, direction], setCurrentIndex] = useState([0, 0]);
    const [isPaused, setIsPaused] = useState(false);
    const colors = theme || DEFAULT_THEME_SETTINGS;

    // Show placeholder when no banners configured (matching builder preview)
    const displayBanners = banners.length > 0 ? banners : [{
        heading: 'Welcome to Our Store',
        subheading: 'Discover amazing products at great prices',
        buttonText: 'Shop Now',
        buttonLink: '#products',
    }];

    const totalSlides = displayBanners.length;

    const paginate = useCallback((newDirection: number) => {
        setCurrentIndex(([prev]) => {
            let next = prev + newDirection;
            if (next >= totalSlides) next = 0;
            if (next < 0) next = totalSlides - 1;
            return [next, newDirection];
        });
    }, [totalSlides]);

    const goToSlide = (index: number) => {
        const dir = index > currentIndex ? 1 : -1;
        setCurrentIndex([index, dir]);
    };

    // Autoplay
    useEffect(() => {
        if (!autoplay || isPaused || totalSlides <= 1) return;
        const timer = setInterval(() => paginate(1), interval);
        return () => clearInterval(timer);
    }, [autoplay, isPaused, interval, totalSlides, paginate]);

    // Handle swipe
    const handleDragEnd = (_: any, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x > threshold) {
            paginate(-1);
        } else if (info.offset.x < -threshold) {
            paginate(1);
        }
    };

    const currentBanner = displayBanners[currentIndex] || displayBanners[0];

    return (
        <section
            className={`relative ${heightClasses[height]} overflow-hidden`}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Slides */}
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                    key={currentIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.1}
                    onDragEnd={handleDragEnd}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                >
                    {/* Background - Theme gradient or image */}
                    {currentBanner.imageUrl ? (
                        <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                            style={{ backgroundImage: `url(${currentBanner.imageUrl})` }}
                        />
                    ) : (
                        /* Theme gradient background (matching builder preview) */
                        <div
                            className="absolute inset-0"
                            style={{
                                background: `linear-gradient(135deg, ${colors.primaryColor}, ${colors.secondaryColor})`
                            }}
                        />
                    )}

                    {/* Left-to-right overlay (matching builder preview) */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: currentBanner.imageUrl
                                ? 'linear-gradient(to right, rgba(0,0,0,0.6), transparent)'
                                : 'linear-gradient(to right, rgba(0,0,0,0.4), transparent)'
                        }}
                    />

                    {/* Content - Left aligned by default (matching builder preview) */}
                    <div className={`relative z-10 h-full container mx-auto px-6 flex flex-col justify-center ${alignClasses[textAlign]}`}>
                        <div className="max-w-2xl">
                            {/* Heading */}
                            {currentBanner.heading && (
                                <motion.h1
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight"
                                    style={{ fontFamily: 'var(--font-heading)' }}
                                >
                                    {currentBanner.heading}
                                </motion.h1>
                            )}

                            {/* Subheading */}
                            {currentBanner.subheading && (
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="mt-4 text-base md:text-lg text-white/90 max-w-xl"
                                >
                                    {currentBanner.subheading}
                                </motion.p>
                            )}

                            {/* CTA Button - White bg, primary text (matching builder preview) */}
                            {currentBanner.buttonText && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="mt-6"
                                >
                                    <Link href={currentBanner.buttonLink || '#'}>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="px-6 py-3 bg-white rounded-lg font-semibold text-base flex items-center gap-2 shadow-lg"
                                            style={{ color: colors.primaryColor }}
                                        >
                                            {currentBanner.buttonText}
                                            <ArrowRight size={18} />
                                        </motion.button>
                                    </Link>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            {showArrows && totalSlides > 1 && (
                <>
                    <button
                        onClick={() => paginate(-1)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => paginate(1)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </>
            )}

            {/* Indicators */}
            {showIndicators && totalSlides > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                    {displayBanners.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`transition-all duration-300 rounded-full ${index === currentIndex
                                ? 'w-6 h-2 bg-white'
                                : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                                }`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
