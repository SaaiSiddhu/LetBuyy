'use client';

import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import { motion } from 'framer-motion';
import { Send, Loader2, CheckCircle, Mail, Phone, MapPin } from 'lucide-react';
import { useState } from 'react';

interface Props {
    section: SectionModel;
    theme: ThemeSettings;
}

export default function ContactForm({ section, theme }: Props) {
    const settings = section.settings || {};
    const title = settings.title as string || 'Get In Touch';
    const subtitle = settings.subtitle as string || '';
    const contactEmail = settings.email as string;
    const showPhone = settings.showPhone as boolean;
    const showAddress = settings.showAddress as boolean;

    const [form, setForm] = useState({ name: '', email: '', message: '' });
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.message) return;

        setStatus('sending');
        // Simulate sending (in production, this would call an API)
        await new Promise(resolve => setTimeout(resolve, 1500));
        setStatus('sent');
        setForm({ name: '', email: '', message: '' });
        setTimeout(() => setStatus('idle'), 3000);
    };

    return (
        <section className="py-16 md:py-24 px-4 md:px-8" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="container mx-auto max-w-4xl">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">{title}</h2>
                    {subtitle && <p className="text-lg text-theme-secondary max-w-2xl mx-auto">{subtitle}</p>}
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                    {/* Contact Info */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="md:col-span-2 space-y-6"
                    >
                        {contactEmail && (
                            <div className="flex items-start gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${theme.primaryColor}15` }}
                                >
                                    <Mail size={18} style={{ color: theme.primaryColor }} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Email</p>
                                    <a href={`mailto:${contactEmail}`} className="text-sm text-theme-secondary hover:opacity-70">
                                        {contactEmail}
                                    </a>
                                </div>
                            </div>
                        )}

                        {showPhone && (
                            <div className="flex items-start gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${theme.primaryColor}15` }}
                                >
                                    <Phone size={18} style={{ color: theme.primaryColor }} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Phone</p>
                                    <p className="text-sm text-theme-secondary">Available on request</p>
                                </div>
                            </div>
                        )}

                        {showAddress && (
                            <div className="flex items-start gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${theme.primaryColor}15` }}
                                >
                                    <MapPin size={18} style={{ color: theme.primaryColor }} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Location</p>
                                    <p className="text-sm text-theme-secondary">Available on request</p>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Form */}
                    <motion.form
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        onSubmit={handleSubmit}
                        className="md:col-span-3 card-theme p-6 rounded-xl shadow-sm space-y-4"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-theme-secondary mb-1 block">Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50"
                                    placeholder="Your name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-theme-secondary mb-1 block">Email *</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-theme-secondary mb-1 block">Message *</label>
                            <textarea
                                value={form.message}
                                onChange={e => setForm({ ...form, message: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 resize-none"
                                placeholder="Tell me about your project..."
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={status !== 'idle'}
                            className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                            style={{ backgroundColor: theme.primaryColor }}
                        >
                            {status === 'sending' ? (
                                <><Loader2 size={16} className="animate-spin" /> Sending...</>
                            ) : status === 'sent' ? (
                                <><CheckCircle size={16} /> Sent!</>
                            ) : (
                                <><Send size={16} /> Send Message</>
                            )}
                        </button>
                    </motion.form>
                </div>
            </div>
        </section>
    );
}
