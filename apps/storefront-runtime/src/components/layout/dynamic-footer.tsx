'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { FooterSettings, ThemeSettings, BlockModel } from '@letbuyy/theme-engine';
import { resolveStoreHref } from '@/lib/store-paths';
import { Mail, Instagram, Facebook, Twitter, Youtube, Heart, MessageCircle, Send } from '@letbuyy/ui';

interface DynamicFooterProps {
    store: StoreModel;
    settings?: FooterSettings;
    blocks?: BlockModel[];
}

function textSetting(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function booleanSetting(value: unknown, fallback = false): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

export default function DynamicFooter({ store, settings, blocks = [] }: DynamicFooterProps) {
    const theme: ThemeSettings = store.templateConfig?.themeSettings || {
        primaryColor: 'rgb(0 179 179)',
        secondaryColor: 'rgb(0 128 128)',
        accentColor: 'rgb(164 229 0)',
        backgroundColor: 'rgb(255 255 255)',
        textColor: 'rgb(26 26 46)',
        fontFamily: 'Inter',
        headingFontFamily: 'Inter',
        borderRadius: 12,
        enableAnimations: true,
        enableShadows: true,
    };

    const currentYear = new Date().getFullYear();
    const copyrightText = `© ${currentYear} ${store.name}. All rights reserved.`;
    const showSocial = settings?.showSocial !== false;
    // Social URLs from settings (empty = hidden)
    const instagramUrl = settings?.instagramUrl || '';
    const facebookUrl = settings?.facebookUrl || '';
    const twitterUrl = settings?.twitterUrl || '';
    const whatsappUrl = settings?.whatsappUrl || '';
    const telegramUrl = settings?.telegramUrl || '';
    const youtubeUrl = settings?.youtubeUrl || '';

    // Contact email
    const contactEmail = settings?.contactEmail || 'help@letbuyy.store';

    const footerBlockLinks = blocks
        .filter((block) => block.type === 'footerLink' && block.isVisible !== false)
        .map((block) => ({
            id: block.id,
            label: textSetting(block.settings.label, 'Link'),
            href: textSetting(block.settings.href, '/'),
            openInNewTab: booleanSetting(block.settings.openInNewTab),
        }))
        .filter((link) => link.label.length > 0 && link.href.length > 0);

    const quickLinks = footerBlockLinks.length
        ? footerBlockLinks
        : store.navigation?.footer?.length
        ? store.navigation.footer
        : store.navigation?.main || [];

    const policyLinks = store.navigation?.policies || [];

    // Build social icons array from URLs
    const socialIcons = [];
    if (instagramUrl) socialIcons.push({ Icon: Instagram, url: instagramUrl });
    if (facebookUrl) socialIcons.push({ Icon: Facebook, url: facebookUrl });
    if (twitterUrl) socialIcons.push({ Icon: Twitter, url: twitterUrl });
    if (whatsappUrl) socialIcons.push({ Icon: MessageCircle, url: whatsappUrl });
    if (telegramUrl) socialIcons.push({ Icon: Send, url: telegramUrl });
    if (youtubeUrl) socialIcons.push({ Icon: Youtube, url: youtubeUrl });

    return (
        <footer className="relative overflow-hidden footer-theme">
            {/* Decorative gradient */}
            <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.accentColor}, ${theme.primaryColor})` }}
            />

            <div className="container mx-auto px-4 py-10 md:py-12">
                {/* Main Footer Content */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
                    {/* Brand Column */}
                    <div className="col-span-2 md:col-span-1">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                        >
                            <h3
                                className="text-lg font-bold mb-2"
                                style={{ color: theme.primaryColor }}
                            >
                                {store.name}
                            </h3>
                            {store.tagline && (
                                <p className="footer-text-muted text-sm leading-relaxed mb-4">
                                    {store.tagline}
                                </p>
                            )}

                            {/* Social Icons */}
                            {showSocial && socialIcons.length > 0 && (
                                <div className="flex gap-2">
                                    {socialIcons.map(({ Icon, url }, i) => (
                                        <motion.a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            whileHover={{ scale: 1.1, y: -2 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="p-2 rounded-lg footer-text-muted hover:text-white transition-colors"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                                        >
                                            <Icon size={16} />
                                        </motion.a>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Quick Links */}
                    {quickLinks.length > 0 && (
                        <div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                            >
                                <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                                    Quick Links
                                </h4>
                                <ul className="space-y-2">
                                    {quickLinks.map((link) => (
                                        <li key={link.id}>
                                            <Link
                                                href={resolveStoreHref(store.subdomain, link.href)}
                                                target={link.openInNewTab ? '_blank' : undefined}
                                                rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                                                className="text-sm footer-text-muted hover:text-white transition-colors inline-flex items-center gap-1 group"
                                            >
                                                <span className="w-0 group-hover:w-2 h-px transition-all" style={{ backgroundColor: theme.primaryColor }} />
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </div>
                    )}

                    {/* Policies */}
                    {policyLinks.length > 0 && (
                        <div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                            >
                                <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                                    Policies
                                </h4>
                                <ul className="space-y-2">
                                    {policyLinks.map((link) => (
                                        <li key={link.id}>
                                            <Link
                                                href={resolveStoreHref(store.subdomain, link.href)}
                                                target={link.openInNewTab ? '_blank' : undefined}
                                                rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
                                                className="text-sm footer-text-muted hover:text-white transition-colors inline-flex items-center gap-1 group"
                                            >
                                                <span className="w-0 group-hover:w-2 h-px transition-all" style={{ backgroundColor: theme.primaryColor }} />
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </div>
                    )}

                    {/* Contact */}
                    <div>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                        >
                            <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                                Contact
                            </h4>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm footer-text-muted">
                                    <Mail size={14} style={{ color: theme.primaryColor }} />
                                    <span>{contactEmail}</span>
                                </li>
                            </ul>
                        </motion.div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-white/10 pt-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                        <motion.p
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            className="footer-text-muted text-xs"
                        >
                            {copyrightText}
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            className="flex items-center gap-1.5 text-xs footer-text-muted"
                        >
                            <span>Made with</span>
                            <Heart size={12} fill={theme.primaryColor} color={theme.primaryColor} />
                            <span>by</span>
                            <a
                                href="https://letbuyy.store"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold hover:opacity-80 transition-opacity"
                                style={{ color: theme.primaryColor }}
                            >
                                LetBuyy
                            </a>
                        </motion.div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
