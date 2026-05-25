'use client';

import { motion } from 'framer-motion';
import { SectionModel, ThemeSettings, DEFAULT_THEME_SETTINGS } from '@/types/store';
import { ArrowRight } from 'lucide-react';
import BannerCarousel from './banner-carousel';

interface Props {
    section: SectionModel;
    theme?: ThemeSettings;
}

export default function HeroSection({ section, theme }: Props) {
    const settings = section.settings as Record<string, any>;
    const banners = settings.banners as any[] | undefined;
    const colors = theme || DEFAULT_THEME_SETTINGS;

    // If multiple banners, use carousel
    if (banners && banners.length > 1) {
        return (
            <BannerCarousel
                banners={banners}
                autoplay={settings.autoplay !== false}
                interval={settings.autoplayInterval || 5000}
                showIndicators={settings.showIndicators !== false}
                showArrows={settings.showArrows !== false}
                height={settings.height || 'medium'}
                textAlign={settings.textAlign || 'left'}
                overlay={settings.overlay ?? 0.4}
                theme={colors}
            />
        );
    }

    // Single banner or legacy format - render matching builder preview exactly
    let heading: string, subheading: string, ctaText: string, ctaLink: string, backgroundImage: string;
    const hasBanners = banners && banners.length >= 1;

    if (hasBanners) {
        const firstBanner = banners[0];
        // Allow empty text when banner has empty fields
        heading = firstBanner.heading || '';
        subheading = firstBanner.subheading || '';
        ctaText = firstBanner.buttonText || '';
        ctaLink = firstBanner.buttonLink || '#products';
        backgroundImage = firstBanner.imageUrl || '';
    } else {
        // Legacy format or no banners - use defaults as placeholder
        heading = settings.heading || settings.title || 'Welcome to Our Store';
        subheading = settings.subheading || settings.subtitle || 'Discover amazing products at great prices';
        ctaText = settings.ctaText || settings.buttonText || 'Shop Now';
        ctaLink = settings.ctaLink || '#products';
        backgroundImage = settings.image || settings.imageUrl || settings.backgroundImage || '';
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: "easeOut" as const }
        }
    };

    return (
        <section
            className="relative h-[500px] flex items-center overflow-hidden"
            style={{
                background: backgroundImage
                    ? undefined
                    : `linear-gradient(135deg, ${colors.primaryColor}, ${colors.secondaryColor})`
            }}
        >
            {/* Background Image (if provided) */}
            {backgroundImage && (
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                />
            )}

            {/* Gradient overlay - from left (matching builder preview) */}
            <div
                className="absolute inset-0"
                style={{
                    background: backgroundImage
                        ? 'linear-gradient(to right, rgba(0,0,0,0.6), transparent)'
                        : 'linear-gradient(to right, rgba(0,0,0,0.4), transparent)'
                }}
            />

            {/* Content - Left aligned (matching builder preview) */}
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="relative z-10 container mx-auto px-6 max-w-4xl"
            >
                {heading && (
                    <motion.h1
                        variants={item}
                        className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight"
                        style={{ fontFamily: 'var(--font-heading)' }}
                    >
                        {heading}
                    </motion.h1>
                )}

                {subheading && (
                    <motion.p
                        variants={item}
                        className="mt-4 text-base md:text-lg text-white/90 max-w-xl"
                    >
                        {subheading}
                    </motion.p>
                )}

                {/* CTA Button - White bg, primary text (matching builder preview) */}
                {ctaText && (
                    <motion.div variants={item} className="mt-6">
                        <a href={ctaLink}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-6 py-3 bg-white rounded-lg font-semibold text-base flex items-center gap-2 shadow-lg"
                                style={{ color: colors.primaryColor }}
                            >
                                {ctaText}
                                <ArrowRight size={18} />
                            </motion.button>
                        </a>
                    </motion.div>
                )}
            </motion.div>
        </section>
    );
}
