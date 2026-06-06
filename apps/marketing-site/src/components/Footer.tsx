'use client'

import Link from 'next/link'
import { Instagram, Linkedin, Twitter } from '@letbuyy/ui'
import BrandLogo from './BrandLogo'

const footerLinks = {
    Product: [
        { label: 'E-commerce', href: '#' },
        { label: 'Blogs', href: '#' },
        { label: 'Landing Page', href: '#' },
        { label: 'Templates', href: '/templates' },
    ],
    Company: [
        { label: 'About', href: '/about' },
        { label: 'Blog', href: '/blog' },
        { label: 'Careers', href: '/careers' },
        { label: 'Contact', href: '/contact' },
    ],
    Resources: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Help Center', href: '/help' },
        { label: 'API Reference', href: '/api' },
        { label: 'Changelog', href: '/changelog' },
    ],
    Legal: [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Cookie Policy', href: '/cookies' },
        { label: 'GDPR', href: '/gdpr' },
    ],
}

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-grid">
                    {/* Brand */}
                    <div className="footer-brand">
                        <Link href="/" className="footer-logo">
                            <BrandLogo className="footer-logo-image" width={188} height={61} />
                        </Link>
                        <p className="footer-tagline">
                            Build stores, blogs, and landing pages in one platform.
                        </p>
                        <div className="footer-social">
                            <a href="https://twitter.com/letbuyy" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                                <Twitter width={20} height={20} aria-hidden="true" />
                            </a>
                            <a href="https://linkedin.com/company/letbuyy" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                                <Linkedin width={20} height={20} aria-hidden="true" />
                            </a>
                            <a href="https://instagram.com/letbuyy" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                <Instagram width={20} height={20} aria-hidden="true" />
                            </a>
                        </div>
                    </div>

                    {/* Links */}
                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category} className="footer-column">
                            <h4 className="footer-column-title">{category}</h4>
                            <ul className="footer-links">
                                {links.map((link) => (
                                    <li key={link.label}>
                                        <Link href={link.href} className="footer-link">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="footer-bottom">
                    <p className="footer-copyright">
                        © {new Date().getFullYear()} LetBuyy. All rights reserved.
                    </p>
                    <div className="footer-bottom-links">
                        <Link href="/privacy">Privacy Policy</Link>
                        <Link href="/terms">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
