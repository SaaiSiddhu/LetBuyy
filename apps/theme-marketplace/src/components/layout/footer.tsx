'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    Button,
    Check,
    Checkbox,
    ChevronDown,
    Facebook,
    Globe,
    Instagram,
    Linkedin,
    Twitter,
    X,
    Youtube,
} from '@letbuyy/ui';
import BrandLogo from '@/components/brand-logo';

/* The platform footer, matching the marketing site: same wordmark, same
   four-column nav, same region / legal / social meta row, same privacy sheet.

   The brand column carries a tagline where marketing puts its Android
   download badges — this property has no app to link to. */

const PLATFORM_URL = process.env.NEXT_PUBLIC_MARKETING_URL?.trim() || 'https://letbuyy.com';
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@letbuyy.com';

const footerColumns = [
    {
        title: 'Browse',
        links: [
            { label: 'All themes', href: '/themes' },
            { label: 'Store themes', href: '/themes/category/store' },
            { label: 'Portfolio themes', href: '/themes/category/portfolio' },
            { label: 'Landing pages', href: '/themes/category/landing' },
            { label: 'Compare themes', href: '/themes/compare' },
        ],
    },
    {
        title: 'Build',
        links: [
            { label: 'Theme docs', href: '/docs' },
            { label: 'API reference', href: '/docs/api' },
            { label: 'Developer console', href: '/developer' },
            { label: 'Submit a theme', href: '/developer/listings/new' },
        ],
    },
    {
        title: 'Platform',
        links: [
            { label: 'LetBuyy', href: PLATFORM_URL },
            { label: 'Platform pricing', href: `${PLATFORM_URL}/pricing` },
            { label: 'App Marketplace', href: `${PLATFORM_URL}/sitemap` },
            { label: 'Theme pricing', href: '/pricing' },
        ],
    },
    {
        title: 'Support',
        links: [
            { label: 'Help centre', href: '/support' },
            { label: 'Contact us', href: '/contact' },
            { label: 'About Themes', href: '/about' },
            { label: 'Your account', href: '/dashboard' },
        ],
    },
];

const legalLinks = [
    { label: 'Terms', href: '/legal/terms' },
    { label: 'Privacy', href: '/legal/privacy' },
    { label: 'Refunds', href: '/legal/refund' },
    { label: 'Licence', href: '/legal/license' },
];

const socialLinks = [
    { label: 'Facebook', href: 'https://facebook.com/letbuyy', icon: Facebook },
    { label: 'Twitter', href: 'https://x.com/letbuyy', icon: Twitter },
    { label: 'Instagram', href: 'https://instagram.com/letbuyy', icon: Instagram },
    { label: 'YouTube', href: 'https://youtube.com/@letbuyy', icon: Youtube },
    { label: 'LinkedIn', href: 'https://linkedin.com/company/letbuyy', icon: Linkedin },
];

export default function Footer() {
    const [privacyPanelOpen, setPrivacyPanelOpen] = useState(false);
    const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
    const [personalizationEnabled, setPersonalizationEnabled] = useState(false);

    function savePrivacyChoices() {
        window.localStorage.setItem(
            'letbuyy_privacy_choices',
            JSON.stringify({
                analytics: analyticsEnabled,
                personalization: personalizationEnabled,
                savedAt: new Date().toISOString(),
            }),
        );
        setPrivacyPanelOpen(false);
    }

    return (
        <footer className="footer" aria-labelledby="site-footer-heading">
            <div className="footer-container">
                <h2 id="site-footer-heading" className="sr-only">
                    LetBuyy Themes footer
                </h2>

                <div className="footer-nav">
                    <div className="footer-brand">
                        <Link href="/" className="footer-mark" aria-label="LetBuyy Themes home">
                            <BrandLogo className="footer-logo-image" width={178} height={58} />
                        </Link>

                        <p className="footer-tagline">
                            Reviewed themes for LetBuyy stores, portfolios, resumes, landing pages and
                            SaaS consoles — previewed with your own products before you install.
                        </p>
                    </div>

                    <div className="footer-columns">
                        {footerColumns.map(column => (
                            <nav key={column.title} className="footer-column" aria-label={column.title}>
                                <h3 className="footer-column-title">{column.title}</h3>
                                <ul className="footer-links">
                                    {column.links.map(link => (
                                        <li key={link.label}>
                                            <Link href={link.href} className="footer-link">
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        ))}
                    </div>
                </div>

                <div className="footer-rule" aria-hidden="true" />

                <div className="footer-meta">
                    <div className="footer-region-row" aria-label="Region and language">
                        <Button unstyled className="footer-region-button" type="button" aria-label="Change region and language">
                            <Globe width={19} height={19} aria-hidden="true" />
                            <span>India</span>
                            <span className="footer-region-divider" aria-hidden="true" />
                            <span>English</span>
                            <ChevronDown width={18} height={18} aria-hidden="true" />
                        </Button>
                    </div>

                    <nav className="footer-legal-row" aria-label="Legal links">
                        {legalLinks.map(link => (
                            <Link key={link.label} href={link.href} className="footer-legal-link">
                                {link.label}
                            </Link>
                        ))}
                        <a href={`mailto:${SUPPORT_EMAIL}`} className="footer-legal-link">
                            {SUPPORT_EMAIL}
                        </a>
                        <Button
                            unstyled
                            type="button"
                            className="footer-privacy-choice"
                            onClick={() => setPrivacyPanelOpen(true)}
                        >
                            <span>Your Privacy Choices</span>
                        </Button>
                    </nav>

                    <nav className="footer-social" aria-label="Social links">
                        {socialLinks.map(link => {
                            const Icon = link.icon;
                            return (
                                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                                    <Icon width={24} height={24} aria-hidden="true" />
                                </a>
                            );
                        })}
                    </nav>
                </div>

                <p className="footer-copyright">
                    © {new Date().getFullYear()} LetBuyy. All rights reserved.
                </p>
            </div>

            {privacyPanelOpen && (
                <div className="footer-privacy-sheet" role="dialog" aria-modal="true" aria-labelledby="footer-privacy-title">
                    <div className="footer-privacy-card">
                        <Button
                            unstyled
                            type="button"
                            className="footer-privacy-close"
                            aria-label="Close privacy choices"
                            onClick={() => setPrivacyPanelOpen(false)}
                        >
                            <X width={20} height={20} aria-hidden="true" />
                        </Button>

                        <h3 id="footer-privacy-title">Your Privacy Choices</h3>
                        <p>
                            Choose how LetBuyy Themes uses optional cookies and similar technologies on this site.
                        </p>

                        <div className="footer-privacy-options">
                            <label className="footer-privacy-option footer-privacy-option-locked">
                                <span>
                                    <strong>Essential</strong>
                                    <small>Required for security, routing, and preview sessions.</small>
                                </span>
                                <span className="footer-privacy-check">
                                    <Check width={16} height={16} aria-hidden="true" />
                                </span>
                            </label>

                            <label className="footer-privacy-option">
                                <span>
                                    <strong>Analytics</strong>
                                    <small>Help us understand which themes people look for.</small>
                                </span>
                                <Checkbox
                                    unstyled
                                    label="Analytics"
                                    checked={analyticsEnabled}
                                    onCheckedChange={setAnalyticsEnabled}
                                />
                            </label>

                            <label className="footer-privacy-option">
                                <span>
                                    <strong>Personalization</strong>
                                    <small>Remember non-sensitive preferences for future visits.</small>
                                </span>
                                <Checkbox
                                    unstyled
                                    label="Personalization"
                                    checked={personalizationEnabled}
                                    onCheckedChange={setPersonalizationEnabled}
                                />
                            </label>
                        </div>

                        <Button unstyled type="button" className="footer-privacy-save" onClick={savePrivacyChoices}>
                            Save choices
                        </Button>
                    </div>
                </div>
            )}
        </footer>
    );
}
