'use client';

import { motion } from 'framer-motion';
import { SectionModel, TestimonialsSettings, ThemeSettings, DEFAULT_THEME_SETTINGS } from '@/types/store';
import { Star, Quote } from 'lucide-react';

interface Props {
    section: SectionModel;
    theme?: ThemeSettings;
}

export default function TestimonialsSection({ section, theme }: Props) {
    const settings = section.settings as Partial<TestimonialsSettings>;
    const blocks = section.blocks || [];
    const colors = theme || DEFAULT_THEME_SETTINGS;

    const title = settings.title || 'What Our Customers Say';
    const subtitle = settings.subtitle || '';
    const showRating = settings.showRating !== false;
    const showImage = settings.showImage !== false;

    // Extract testimonials from blocks
    const testimonials = blocks
        .filter(b => b.type === 'testimonialCard' && b.isVisible !== false)
        .map(b => ({
            id: b.id,
            name: b.settings.name || 'Customer',
            text: b.settings.text || b.settings.content || '',
            rating: b.settings.rating || 5,
            image: b.settings.image || b.settings.avatar,
        }));

    if (testimonials.length === 0) return null;

    // Helper to create rgba from hex
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return (
        <section
            className="py-24 px-4 md:px-8"
            style={{ backgroundColor: colors.backgroundColor }}
        >
            <div className="max-w-6xl mx-auto">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2
                        className="text-4xl md:text-5xl font-bold tracking-tight"
                        style={{ color: colors.textColor }}
                    >
                        {title}
                    </h2>
                    {subtitle && (
                        <p
                            className="mt-4 text-lg"
                            style={{ color: `${colors.textColor}80` }}
                        >
                            {subtitle}
                        </p>
                    )}
                </motion.div>

                {/* Testimonials Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, i) => (
                        <motion.div
                            key={testimonial.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15 }}
                            className="rounded-2xl p-8 relative"
                            style={{ backgroundColor: hexToRgba(colors.primaryColor, 0.05) }}
                        >
                            {/* Quote Icon */}
                            <Quote
                                className="absolute top-6 right-6 w-8 h-8"
                                style={{ color: hexToRgba(colors.primaryColor, 0.15) }}
                            />

                            {/* Rating */}
                            {showRating && (
                                <div className="flex gap-1 mb-4">
                                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                                        <Star
                                            key={i}
                                            size={16}
                                            className="fill-amber-400"
                                            style={{ color: colors.accentColor }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Text */}
                            <p
                                className="text-lg leading-relaxed mb-6"
                                style={{ color: `${colors.textColor}CC` }}
                            >
                                "{testimonial.text}"
                            </p>

                            {/* Author */}
                            <div className="flex items-center gap-3">
                                {showImage && testimonial.image ? (
                                    <img
                                        src={testimonial.image}
                                        alt={testimonial.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                        style={{
                                            background: `linear-gradient(135deg, ${colors.primaryColor}, ${colors.secondaryColor})`
                                        }}
                                    >
                                        {testimonial.name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <p
                                        className="font-semibold"
                                        style={{ color: colors.textColor }}
                                    >
                                        {testimonial.name}
                                    </p>
                                    <p
                                        className="text-sm"
                                        style={{ color: `${colors.textColor}80` }}
                                    >
                                        Verified Buyer
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
