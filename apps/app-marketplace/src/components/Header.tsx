'use client';

import Link from 'next/link';
import { Search, Moon, Sun, Package } from '@letbuyy/ui';
import { useEffect, useState } from 'react';

export function Header() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        if (next) {
            document.documentElement.classList.add('dark');
            document.documentElement.style.colorScheme = 'dark';
            localStorage.setItem('letbuyy_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.style.colorScheme = 'light';
            localStorage.setItem('letbuyy_theme', 'light');
        }
    };

    return (
        <header className="appstore-header">
            <div className="appstore-header-left">
                <Link href="/" className="appstore-header-logo">
                    <div className="appstore-header-logo-icon">
                        <Package size={18} />
                    </div>
                    <span className="appstore-header-brand">LetBuyy Apps</span>
                </Link>

                <nav className="appstore-header-nav">
                    <Link href="/">Home</Link>
                    <Link href="/categories">Categories</Link>
                    <Link href="/collections/staff-picks">Collections</Link>
                    <Link href="/developers">Developers</Link>
                    <Link href="/developers/dashboard">Partner Console</Link>
                </nav>
            </div>

            <div className="appstore-header-center">
                <Link href="/search" className="appstore-search">
                    <Search size={16} />
                    <span>Search apps...</span>
                </Link>
            </div>

            <div className="appstore-header-right">
                <button className="appstore-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <Link href="/my-apps" className="appstore-header-btn">
                    My Apps
                </Link>
                <Link href="/developers/register" className="appstore-header-btn primary">
                    Build an app
                </Link>
            </div>
        </header>
    );
}
