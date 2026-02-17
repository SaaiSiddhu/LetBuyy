'use client';

import Link from 'next/link';
import { SectionModel } from '@/types/store';

interface FooterSectionProps {
    section: SectionModel;
    storeName?: string;
    basePath?: string;
}

export default function FooterSection({
    section,
    storeName = 'Urban Kicks',
    basePath = '/theme-preview/urban-kicks',
}: FooterSectionProps) {
    const settings = section.settings || {};
    const columns = (settings.columns as number) || 3;
    const showSocial = settings.showSocial !== false;
    const showPaymentIcons = settings.showPaymentIcons !== false;
    const copyrightText = (settings.copyrightText as string) || `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`;
    const contactEmail = (settings.contactEmail as string) || `hello@${storeName.toLowerCase().replace(/\s+/g, '-')}.store`;
    const instagramUrl = (settings.instagramUrl as string) || '';
    const twitterUrl = (settings.twitterUrl as string) || '';

    return (
        <footer className="text-white py-12" style={{ backgroundColor: 'var(--footer-bg)' }}>
            <div className="max-w-screen-xl mx-auto px-4">
                <div
                    className="grid grid-cols-1 gap-8"
                    style={{ gridTemplateColumns: `repeat(${Math.min(columns + 1, 4)}, minmax(0, 1fr))` }}
                >
                    {/* Brand */}
                    <div>
                        <h3 className="text-lg font-bold mb-3">{storeName}</h3>
                        <p className="text-sm opacity-60 leading-relaxed">
                            Premium streetwear & sneakers. Curated drops from top brands, delivered to your door.
                        </p>
                    </div>

                    {/* Shop Links */}
                    <div>
                        <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">Shop</h4>
                        <ul className="space-y-2 text-sm opacity-60">
                            <li><Link href={`${basePath}/shop`} className="hover:opacity-100 transition-opacity">All Products</Link></li>
                            <li><Link href={`${basePath}/new-arrivals`} className="hover:opacity-100 transition-opacity">New Arrivals</Link></li>
                            <li><Link href={`${basePath}/shop?category=Sneakers`} className="hover:opacity-100 transition-opacity">Sneakers</Link></li>
                            <li><Link href={`${basePath}/shop?category=Apparel`} className="hover:opacity-100 transition-opacity">Apparel</Link></li>
                        </ul>
                    </div>

                    {/* Help Links */}
                    <div>
                        <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">Help</h4>
                        <ul className="space-y-2 text-sm opacity-60">
                            <li><Link href={`${basePath}/track-order`} className="hover:opacity-100 transition-opacity">Track Order</Link></li>
                            <li><span className="hover:opacity-100 cursor-pointer transition-opacity">Returns & Exchanges</span></li>
                            <li><span className="hover:opacity-100 cursor-pointer transition-opacity">Shipping Info</span></li>
                            <li><span className="hover:opacity-100 cursor-pointer transition-opacity">FAQs</span></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    {columns >= 3 && (
                        <div>
                            <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">Contact</h4>
                            <ul className="space-y-2 text-sm opacity-60">
                                <li>{contactEmail}</li>
                                {showSocial && instagramUrl && <li>Instagram: @{storeName.toLowerCase().replace(/\s+/g, '')}</li>}
                                {showSocial && twitterUrl && <li>Twitter: @{storeName.toLowerCase().replace(/\s+/g, '')}</li>}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Payment Icons */}
                {showPaymentIcons && (
                    <div className="border-t border-white/10 mt-6 pt-4 flex items-center justify-center gap-3 opacity-40">
                        {['Visa', 'Mastercard', 'UPI', 'PayPal'].map(method => (
                            <span key={method} className="text-[10px] font-medium uppercase tracking-wider border border-white/20 rounded px-2 py-0.5">
                                {method}
                            </span>
                        ))}
                    </div>
                )}

                {/* Copyright */}
                <div className="border-t border-white/10 mt-4 pt-6 text-center text-xs opacity-40">
                    {copyrightText} Powered by LetBuyy.
                </div>
            </div>
        </footer>
    );
}
