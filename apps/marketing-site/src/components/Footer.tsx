'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
    Check,
    ChevronDown,
    Facebook,
    Globe,
    Instagram,
    Linkedin,
    Twitter,
    X,
    Youtube,
} from '@letbuyy/ui'
import BrandLogo from './BrandLogo'
import { getAssetPublicUrl } from '@/lib/public-urls'

const footerColumns = [
    {
        title: 'LetBuyy',
        links: [
            { label: 'What is LetBuyy?', href: '/' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'Start your store', href: '/create' },
            { label: 'India commerce', href: '/pricing#india' },
        ],
    },
    {
        title: 'Ecosystem',
        links: [
            { label: 'Developer Docs', href: '/developers' },
            { label: 'Theme Marketplace', href: '/themes' },
            { label: 'App Marketplace', href: '/apps' },
            { label: 'Partners', href: '/partners' },
            { label: 'Affiliates', href: '/affiliates' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { label: 'Blog', href: '/blog' },
            { label: 'Compare LetBuyy', href: '/compare' },
            { label: 'Guides', href: '/guides' },
            { label: 'Courses', href: '/courses' },
            { label: 'Free Tools', href: '/tools' },
            { label: 'Changelog', href: '/changelog' },
        ],
    },
    {
        title: 'Support',
        links: [
            { label: 'Help Center', href: '/help' },
            { label: 'Community Forum', href: '/community' },
            { label: 'Hire a Partner', href: '/partners/hire' },
            { label: 'Service Status', href: '/status' },
        ],
    },
]

const legalLinks = [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Legal', href: '/legal' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Sitemap', href: '/sitemap.xml' },
]

const socialLinks = [
    { label: 'Facebook', href: 'https://facebook.com/letbuyy', icon: Facebook },
    { label: 'Twitter', href: 'https://x.com/letbuyy', icon: Twitter },
    { label: 'Instagram', href: 'https://instagram.com/letbuyy', icon: Instagram },
    { label: 'YouTube', href: 'https://youtube.com/@letbuyy', icon: Youtube },
    { label: 'LinkedIn', href: 'https://linkedin.com/company/letbuyy', icon: Linkedin },
]

const privacyChoicesIconUrl = getAssetPublicUrl('/assets/legal/privacy-choices.svg')

export default function Footer() {
    const [privacyPanelOpen, setPrivacyPanelOpen] = useState(false)
    const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
    const [personalizationEnabled, setPersonalizationEnabled] = useState(false)

    function savePrivacyChoices() {
        window.localStorage.setItem(
            'letbuyy_privacy_choices',
            JSON.stringify({
                analytics: analyticsEnabled,
                personalization: personalizationEnabled,
                savedAt: new Date().toISOString(),
            }),
        )
        setPrivacyPanelOpen(false)
    }

    return (
        <footer className="footer" aria-labelledby="site-footer-heading">
            <div className="footer-container">
                <h2 id="site-footer-heading" className="sr-only">
                    LetBuyy footer
                </h2>

                <div className="footer-nav">
                    <Link href="/" className="footer-mark" aria-label="LetBuyy home">
                        <BrandLogo className="footer-logo-image" width={178} height={58} />
                    </Link>

                    <div className="footer-columns">
                        {footerColumns.map((column) => (
                            <nav key={column.title} className="footer-column" aria-label={column.title}>
                                <h3 className="footer-column-title">{column.title}</h3>
                                <ul className="footer-links">
                                    {column.links.map((link) => (
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
                        <button className="footer-region-button" type="button" aria-label="Change region and language">
                            <Globe width={19} height={19} aria-hidden="true" />
                            <span>India</span>
                            <span className="footer-region-divider" aria-hidden="true" />
                            <span>English</span>
                            <ChevronDown width={18} height={18} aria-hidden="true" />
                        </button>
                    </div>

                    <nav className="footer-legal-row" aria-label="Legal links">
                        {legalLinks.map((link) => (
                            <Link key={link.label} href={link.href} className="footer-legal-link">
                                {link.label}
                            </Link>
                        ))}
                        <button
                            type="button"
                            className="footer-privacy-choice"
                            onClick={() => setPrivacyPanelOpen(true)}
                        >
                            <span>Your Privacy Choices</span>
                            <img src={privacyChoicesIconUrl} alt="" width="32" height="16" aria-hidden="true" />
                        </button>
                    </nav>

                    <nav className="footer-social" aria-label="Social links">
                        {socialLinks.map((link) => {
                            const Icon = link.icon
                            return (
                                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                                    <Icon width={24} height={24} aria-hidden="true" />
                                </a>
                            )
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
                        <button
                            type="button"
                            className="footer-privacy-close"
                            aria-label="Close privacy choices"
                            onClick={() => setPrivacyPanelOpen(false)}
                        >
                            <X width={20} height={20} aria-hidden="true" />
                        </button>

                        <img className="footer-privacy-icon" src={privacyChoicesIconUrl} alt="" width="48" height="24" aria-hidden="true" />
                        <h3 id="footer-privacy-title">Your Privacy Choices</h3>
                        <p>
                            Choose how LetBuyy uses optional cookies and similar technologies on this marketing site.
                        </p>

                        <div className="footer-privacy-options">
                            <label className="footer-privacy-option footer-privacy-option-locked">
                                <span>
                                    <strong>Essential</strong>
                                    <small>Required for security, routing, and checkout-safe experiences.</small>
                                </span>
                                <span className="footer-privacy-check">
                                    <Check width={16} height={16} aria-hidden="true" />
                                </span>
                            </label>

                            <label className="footer-privacy-option">
                                <span>
                                    <strong>Analytics</strong>
                                    <small>Help us understand page performance and product interest.</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={analyticsEnabled}
                                    onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                                />
                            </label>

                            <label className="footer-privacy-option">
                                <span>
                                    <strong>Personalization</strong>
                                    <small>Remember non-sensitive marketing preferences for future visits.</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={personalizationEnabled}
                                    onChange={(event) => setPersonalizationEnabled(event.target.checked)}
                                />
                            </label>
                        </div>

                        <button type="button" className="footer-privacy-save" onClick={savePrivacyChoices}>
                            Save choices
                        </button>
                    </div>
                </div>
            )}
        </footer>
    )
}
