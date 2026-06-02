'use client';

import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import { motion } from 'framer-motion';
import { ArrowRight } from '@letbuyy/ui';
import Link from 'next/link';

interface Props {
    section: SectionModel;
    theme: ThemeSettings;
}

function textSetting(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export default function CtaSection({ section, theme }: Props) {
    const settings = section.settings || {};
    const heading = textSetting(settings.heading, textSetting(settings.title, 'Ready to get started?'));
    const subheading = textSetting(settings.subheading, textSetting(settings.body));
    const ctaText = textSetting(settings.ctaText, textSetting(settings.buttonText, 'Get Started'));
    const ctaLink = textSetting(settings.ctaLink, textSetting(settings.buttonLink, '#'));
    const style = textSetting(settings.style, 'primary');

    const bgStyles: Record<string, React.CSSProperties> = {
        primary: { backgroundColor: theme.primaryColor },
        gradient: { background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` },
        dark: { backgroundColor: '#0f172a' },
    };

    return (
        <section className="py-4 px-4 md:px-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="container mx-auto max-w-5xl rounded-2xl overflow-hidden"
                style={bgStyles[style] || bgStyles.primary}
            >
                <div className="px-8 py-16 md:py-20 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold font-display text-white mb-4">{heading}</h2>
                    {subheading && (
                        <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">{subheading}</p>
                    )}
                    <Link href={ctaLink}>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-shadow"
                            style={{ color: theme.primaryColor }}
                        >
                            {ctaText} <ArrowRight size={16} />
                        </motion.button>
                    </Link>
                </div>
            </motion.div>
        </section>
    );
}
