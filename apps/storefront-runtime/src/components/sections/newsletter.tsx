'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SectionModel, ThemeSettings, DEFAULT_THEME_SETTINGS } from '@/types/store';
import { Mail, Send, CheckCircle } from 'lucide-react';

interface Props {
    section: SectionModel;
    theme?: ThemeSettings;
}

function textSetting(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export default function NewsletterSection({ section, theme }: Props) {
    const settings = section.settings;
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const colors = theme || DEFAULT_THEME_SETTINGS;

    const title = textSetting(settings.title, 'Stay Updated');
    const subtitle = textSetting(settings.subtitle, 'Subscribe to our newsletter for exclusive offers and updates.');
    const buttonText = textSetting(settings.buttonText, 'Subscribe');
    const placeholder = textSetting(settings.placeholder, 'Enter your email');
    const successMessage = textSetting(settings.successMessage, 'Subscribed!');

    // Helper to create rgba from hex
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            setIsSubmitted(true);
            setTimeout(() => {
                setEmail('');
                setIsSubmitted(false);
            }, 3000);
        }
    };

    return (
        <section
            className="py-20 px-4 md:px-8"
            style={{ backgroundColor: colors.backgroundColor }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="max-w-2xl mx-auto text-center"
            >
                <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
                    style={{ backgroundColor: hexToRgba(colors.primaryColor, 0.1) }}
                >
                    <Mail
                        className="w-8 h-8"
                        style={{ color: colors.primaryColor }}
                    />
                </div>

                <h2
                    className="text-3xl md:text-4xl font-bold mb-4"
                    style={{ color: colors.textColor }}
                >
                    {title}
                </h2>
                <p
                    className="mb-8"
                    style={{ color: `${colors.textColor}99` }}
                >
                    {subtitle}
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={placeholder}
                        className="flex-1 px-5 py-3 rounded-full border outline-none transition-all"
                        style={{
                            borderColor: hexToRgba(colors.primaryColor, 0.2),
                            color: colors.textColor
                        }}
                        required
                    />
                    <button
                        type="submit"
                        disabled={isSubmitted}
                        className="px-8 py-3 text-white rounded-full font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                        style={{ backgroundColor: colors.primaryColor }}
                    >
                        {isSubmitted ? (
                            <>
                                <CheckCircle size={18} /> {successMessage}
                            </>
                        ) : (
                            <>
                                {buttonText} <Send size={16} />
                            </>
                        )}
                    </button>
                </form>

                <p
                    className="text-xs mt-4"
                    style={{ color: `${colors.textColor}66` }}
                >
                    We respect your privacy. Unsubscribe at any time.
                </p>
            </motion.div>
        </section>
    );
}
