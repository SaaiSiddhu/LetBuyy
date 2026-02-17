'use client';

import { Search, ShoppingCart, User, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SectionModel } from '@/types/store';

interface NavPage {
    id: string;
    label: string;
    href: string;
    isVisible?: boolean;
}

const DEFAULT_NAV: NavPage[] = [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'shop', label: 'Shop', href: '/shop' },
    { id: 'new-arrivals', label: 'New Arrivals', href: '/new-arrivals' },
    { id: 'track-order', label: 'Track Order', href: '/track-order' },
];

interface HeaderSectionProps {
    section: SectionModel;
    storeName?: string;
    basePath?: string;
    cartCount?: number;
    onMenuClick?: () => void;
    onSearchClick?: () => void;
    onAccountClick?: () => void;
}

export default function HeaderSection({
    section,
    storeName = 'Urban Kicks',
    basePath = '/theme-preview/urban-kicks',
    cartCount = 0,
    onMenuClick,
    onSearchClick,
    onAccountClick,
}: HeaderSectionProps) {
    const pathname = usePathname();
    const settings = section.settings || {};

    const showSearch = settings.showSearch !== false;
    const showCart = settings.showCart !== false;
    const showAccount = settings.showAccount === true;
    const logoPlacement = (settings.logoPlacement as string) || 'left';

    // Build nav links from settings or defaults
    const navPages: NavPage[] = (settings.navPages as NavPage[])?.filter(p => p.isVisible !== false) || DEFAULT_NAV;
    const links = navPages.map(p => ({
        ...p,
        href: p.href.startsWith('/') ? `${basePath}${p.href === '/' ? '' : p.href}` : p.href,
    }));

    const isActive = (href: string) => pathname === href;

    return (
        <header className="sticky top-8 z-40 backdrop-blur-md bg-white/90 border-b border-black/5">
            <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
                {/* Left: Menu + Logo */}
                <div className={`flex items-center gap-3 ${logoPlacement === 'center' ? 'flex-1' : ''}`}>
                    <button
                        onClick={onMenuClick}
                        className="p-2 -ml-2 rounded-lg hover:bg-black/5 transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu size={20} style={{ color: 'var(--text)' }} />
                    </button>
                    {logoPlacement === 'left' && (
                        <Link href={basePath} className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                            {storeName}
                        </Link>
                    )}
                </div>

                {/* Center: Logo (if centered) or Desktop Nav */}
                {logoPlacement === 'center' ? (
                    <Link href={basePath} className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                        {storeName}
                    </Link>
                ) : (
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {links.map((link) => (
                            <Link
                                key={link.id}
                                href={link.href}
                                className={`transition-opacity ${isActive(link.href) ? 'opacity-100 font-semibold' : 'opacity-70 hover:opacity-100'}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                )}

                {/* Right: Icons */}
                <div className={`flex items-center gap-1 ${logoPlacement === 'center' ? 'flex-1 justify-end' : ''}`} style={{ color: 'var(--text)' }}>
                    {showSearch && (
                        <button
                            onClick={onSearchClick}
                            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                            aria-label="Search"
                        >
                            <Search size={20} />
                        </button>
                    )}
                    {showAccount && (
                        <button
                            onClick={onAccountClick}
                            className="p-2 rounded-lg hover:bg-black/5 transition-colors hidden sm:block"
                            aria-label="Account"
                        >
                            <User size={20} />
                        </button>
                    )}
                    {showCart && (
                        <Link
                            href={`${basePath}/cart`}
                            className="p-2 rounded-lg hover:bg-black/5 transition-colors relative"
                            aria-label="Cart"
                        >
                            <ShoppingCart size={20} />
                            {cartCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                                    {cartCount > 9 ? '9+' : cartCount}
                                </span>
                            )}
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
