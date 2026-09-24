'use client';

import { motion } from 'framer-motion';
import { DEFAULT_THEME_SETTINGS } from '@letbuyy/theme-engine';
import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import { ArrowRight } from '@letbuyy/ui';
import BannerCarousel from './banner-carousel';
import Image from 'next/image';

interface Props {
    section: SectionModel;
    theme?: ThemeSettings;
}

interface BannerSettings {
    heading?: string;
    subheading?: string;
    buttonText?: string;
    buttonLink?: string;
    imageUrl?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function textSetting(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function numberSetting(value: unknown, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function heightSetting(value: unknown): 'small' | 'medium' | 'large' | 'full' {
    return value === 'small' || value === 'medium' || value === 'large' || value === 'full'
        ? value
        : 'medium';
}

function alignSetting(value: unknown): 'left' | 'center' | 'right' {
    return value === 'left' || value === 'center' || value === 'right'
        ? value
        : 'left';
}

function normalizeBanner(value: unknown): BannerSettings {
    const banner = asRecord(value);
    return {
        heading: textSetting(banner.heading),
        subheading: textSetting(banner.subheading),
        buttonText: textSetting(banner.buttonText),
        buttonLink: textSetting(banner.buttonLink),
        imageUrl: textSetting(banner.imageUrl),
    };
}

export default function HeroSection({ section, theme }: Props) {
    const settings = section.settings;
    const banners = Array.isArray(settings.banners)
        ? settings.banners.map(normalizeBanner)
        : undefined;
    const colors = theme || DEFAULT_THEME_SETTINGS;

    // If multiple banners, use carousel
    if (banners && banners.length > 1) {
        return (
            <BannerCarousel
                banners={banners}
                autoplay={settings.autoplay !== false}
                interval={numberSetting(settings.autoplayInterval, 5000)}
                showIndicators={settings.showIndicators !== false}
                showArrows={settings.showArrows !== false}
                height={heightSetting(settings.height)}
                textAlign={alignSetting(settings.textAlign)}
                overlay={numberSetting(settings.overlay, 0.4)}
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
        heading = textSetting(firstBanner.heading);
        subheading = textSetting(firstBanner.subheading);
        ctaText = textSetting(firstBanner.buttonText);
        ctaLink = textSetting(firstBanner.buttonLink, '#products');
        backgroundImage = textSetting(firstBanner.imageUrl);
    } else {
        heading = textSetting(settings.heading, textSetting(settings.title, 'Welcome to Our Store'));
        subheading = textSetting(settings.subheading, textSetting(settings.subtitle, 'Discover amazing products at great prices'));
        ctaText = textSetting(settings.ctaText, textSetting(settings.buttonText, 'Shop Now'));
        ctaLink = textSetting(settings.ctaLink, '#products');
        backgroundImage = textSetting(settings.image, textSetting(settings.imageUrl, textSetting(settings.backgroundImage)));
    }

    // B1/B2: declared `height`/`textAlign` settings previously did nothing in this single-banner
    // path (only the multi-banner BannerCarousel branch read them). "full" keeps the pre-existing
    // fixed height so a store that never touches this control sees no change; the other three
    // options are genuinely shorter, matching the carousel's own height ladder.
    const heightValue = heightSetting(settings.height);
    const alignValue = alignSetting(settings.textAlign);
    const singleBannerHeightClasses: Record<'small' | 'medium' | 'large' | 'full', string> = {
        full: 'h-[430px] md:h-[500px]',
        large: 'h-[380px] md:h-[440px]',
        medium: 'h-[320px] md:h-[380px]',
        small: 'h-[260px] md:h-[320px]',
    };
    const contentAlignClass = alignValue === 'center'
        ? 'mx-auto text-center'
        : alignValue === 'right'
            ? 'ml-auto text-right'
            : 'mx-auto text-left';

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
            className={`relative flex w-full items-center overflow-hidden ${singleBannerHeightClasses[heightValue]}`}
            data-height={heightValue}
            data-text-align={alignValue}
            style={{
                background: backgroundImage
                    ? undefined
                    : `linear-gradient(135deg, ${colors.primaryColor}, ${colors.secondaryColor})`
            }}
        >
            {/* Background Image (if provided) */}
            {backgroundImage && (
                <Image
                    src={backgroundImage}
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority
                    unoptimized
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

            {/* Content - aligned per settings.textAlign (B2) */}
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className={`relative z-10 w-full max-w-[calc(100vw-3rem)] px-6 md:container md:max-w-4xl ${contentAlignClass}`}
            >
                {heading && (
                    <motion.h1
                        variants={item}
                        className="break-words text-3xl font-bold leading-tight text-white md:text-4xl lg:text-5xl"
                        style={{ fontFamily: 'var(--font-heading)' }}
                    >
                        {heading}
                    </motion.h1>
                )}

                {subheading && (
                    <motion.p
                        variants={item}
                        className="mt-4 max-w-[19rem] break-words text-base text-white/90 sm:max-w-md md:max-w-xl md:text-lg"
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
                                className="flex min-h-11 items-center gap-2 rounded-lg bg-[var(--lb-color-surface)] px-6 py-3 text-base font-semibold shadow-lg"
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
