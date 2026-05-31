'use client';

import { motion } from 'framer-motion';
import { SectionModel, ThemeSettings, DEFAULT_THEME_SETTINGS } from '@/types/store';
import Image from 'next/image';

interface Props {
    section: SectionModel;
    theme?: ThemeSettings;
}

function textSetting(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export default function AboutSection({ section, theme }: Props) {
    const settings = section.settings;
    const colors = theme || DEFAULT_THEME_SETTINGS;

    const title = textSetting(settings.title, textSetting(settings.heading, 'About Us'));
    const content = textSetting(settings.content, textSetting(settings.body, textSetting(settings.description)));
    const imageUrl = textSetting(settings.imageUrl, textSetting(settings.image));
    const layout = textSetting(settings.layout, textSetting(settings.imagePosition, 'left'));

    return (
        <section
            className="py-20 px-4 md:px-8"
            style={{ backgroundColor: colors.backgroundColor }}
        >
            <div className="max-w-6xl mx-auto">
                {layout === 'center' ? (
                    // Centered layout
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <h2
                            className="text-4xl md:text-5xl font-bold mb-6"
                            style={{ color: colors.textColor }}
                        >
                            {title}
                        </h2>
                        {content && (
                            <p
                                className="text-lg leading-relaxed whitespace-pre-wrap"
                                style={{ color: `${colors.textColor}99` }}
                            >
                                {content}
                            </p>
                        )}
                        {imageUrl && (
                            <div className="relative mx-auto mt-10 aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-2xl shadow-xl">
                                <Image
                                    src={imageUrl}
                                    alt={title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 672px"
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        )}
                    </motion.div>
                ) : (
                    // Side-by-side layout
                    <div className={`grid md:grid-cols-2 gap-12 items-center ${layout === 'right' ? '' : ''}`}>
                        <motion.div
                            initial={{ opacity: 0, x: layout === 'right' ? 30 : -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className={`${layout === 'right' ? 'md:order-2' : ''}`}
                        >
                            <span
                                className="font-semibold text-sm uppercase tracking-widest mb-3 block"
                                style={{ color: colors.primaryColor }}
                            >
                                Our Story
                            </span>
                            <h2
                                className="text-4xl md:text-5xl font-bold mb-6"
                                style={{ color: colors.textColor }}
                            >
                                {title}
                            </h2>
                            {content && (
                                <p
                                    className="text-lg leading-relaxed whitespace-pre-wrap"
                                    style={{ color: `${colors.textColor}99` }}
                                >
                                    {content}
                                </p>
                            )}
                        </motion.div>

                        {imageUrl && (
                            <motion.div
                                initial={{ opacity: 0, x: layout === 'right' ? -30 : 30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                className={`relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl ${layout === 'right' ? 'md:order-1' : ''}`}
                            >
                                <Image
                                    src={imageUrl}
                                    alt={title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    className="object-cover"
                                    unoptimized
                                />
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
