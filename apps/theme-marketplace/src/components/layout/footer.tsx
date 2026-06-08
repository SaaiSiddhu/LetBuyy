import Link from 'next/link';
import { Heart, Palette, Mail } from '@letbuyy/ui';

const FOOTER_LINKS = {
    Product: [
        { label: 'Browse Themes', href: '/themes' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Store Themes', href: '/themes?category=store' },
        { label: 'Portfolio Themes', href: '/themes?category=portfolio' },
    ],
    Resources: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Theme Development', href: '/developer' },
        { label: 'API Reference', href: '/docs/api' },
    ],
    Company: [
        { label: 'About LetBuyy', href: '/about' },
        { label: 'Support', href: '/support' },
        { label: 'Contact', href: '/contact' },
    ],
    Legal: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Terms of Service', href: '/legal/terms' },
        { label: 'Refund Policy', href: '/legal/refund' },
        { label: 'License Agreement', href: '/legal/license' },
    ],
};

export default function Footer() {
    return (
        <footer className="border-t border-border bg-bg-secondary/50 mt-auto">
            <div className="container-main py-16">
                {/* Top Section */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                <Palette className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-base font-bold text-text-heading">LetBuyy Themes</span>
                        </Link>
                        <p className="text-sm text-text-muted max-w-xs mb-5">
                            Governed LetBuyy themes for stores, portfolios, resumes, SaaS pages, and landing pages.
                        </p>
                        <div className="flex items-center gap-3">
                            <a href="mailto:support@letbuyy.com" className="p-2 rounded-lg bg-surface hover:bg-surface-hover text-text-muted hover:text-text-heading transition-all" aria-label="Email LetBuyy support">
                                <Mail className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Link Columns */}
                    {Object.entries(FOOTER_LINKS).map(([title, links]) => (
                        <div key={title}>
                            <h4 className="text-sm font-semibold text-text-heading mb-4">{title}</h4>
                            <ul className="space-y-2.5">
                                {links.map(link => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-text-muted hover:text-text-heading transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-text-subtle">
                        © {new Date().getFullYear()} LetBuyy. All rights reserved.
                    </p>
                    <p className="inline-flex items-center gap-1 text-xs text-text-subtle">
                        India-first theme marketplace <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                    </p>
                </div>
            </div>
        </footer>
    );
}
