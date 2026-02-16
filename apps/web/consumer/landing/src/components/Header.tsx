'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from './ThemeProvider'

export default function Header() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const { theme, setTheme, resolvedTheme } = useTheme()

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [mobileMenuOpen])

    // Close menu on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileMenuOpen(false)
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [])

    const navLinks = [
        { href: '#capabilities', label: 'Product' },
        { href: '#features', label: 'Features' },
        { href: '#pricing', label: 'Pricing' },
        { href: '/templates', label: 'Templates' },
        { href: '/docs', label: 'Docs' },
    ]

    const cycleTheme = () => {
        const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
        const currentIndex = themes.indexOf(theme)
        const nextIndex = (currentIndex + 1) % themes.length
        setTheme(themes[nextIndex])
    }

    const ThemeIcon = () => {
        if (theme === 'system') {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
            )
        }
        if (resolvedTheme === 'dark') {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )
        }
        return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
        )
    }

    return (
        <>
            <motion.header
                className={`header ${scrolled ? 'scrolled' : ''}`}
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="container header-content">
                    {/* Logo */}
                    <Link href="/" className="header-logo" aria-label="LetBuyy Home">
                        <Image
                            src="/icons/landscape_logo.png"
                            alt="LetBuyy"
                            width={320}
                            height={80}
                            className="header-logo-image"
                            priority
                            unoptimized
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="header-nav" aria-label="Main navigation">
                        {navLinks.map((link) => (
                            <Link key={link.href} href={link.href} className="header-nav-link">
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Desktop Actions */}
                    <div className="header-actions">
                        <Link href="https://accounts.letbuyy.com/lookup" className="btn btn-ghost">
                            Sign In
                        </Link>
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Link href="https://accounts.letbuyy.com/signup" className="btn btn-primary">
                                Get Started Free
                            </Link>
                        </motion.div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`} />
                    </button>
                </div>
            </motion.header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="mobile-menu-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onClick={() => setMobileMenuOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Drawer */}
                        <motion.div
                            className="mobile-drawer"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Mobile navigation"
                        >
                            {/* Drawer Header */}
                            <div className="mobile-drawer-header">
                                <Link href="/" className="mobile-drawer-logo" onClick={() => setMobileMenuOpen(false)}>
                                    <Image
                                        src="/icons/landscape_logo.png"
                                        alt="LetBuyy"
                                        width={240}
                                        height={60}
                                        className="mobile-drawer-logo-image"
                                        unoptimized
                                    />
                                </Link>
                                <button
                                    className="mobile-drawer-close"
                                    onClick={() => setMobileMenuOpen(false)}
                                    aria-label="Close menu"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            {/* Drawer Divider */}
                            <div className="mobile-drawer-divider" />

                            {/* Navigation Links */}
                            <nav className="mobile-drawer-nav">
                                {navLinks.map((link, index) => (
                                    <motion.div
                                        key={link.href}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 + 0.1 }}
                                    >
                                        <Link
                                            href={link.href}
                                            className="mobile-drawer-link"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            <span>{link.label}</span>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </Link>
                                    </motion.div>
                                ))}
                            </nav>

                            {/* Spacer */}
                            <div className="mobile-drawer-spacer" />

                            {/* Drawer Divider */}
                            <div className="mobile-drawer-divider" />

                            {/* Bottom Actions */}
                            <div className="mobile-drawer-actions">
                                <Link
                                    href="https://accounts.letbuyy.com/lookup"
                                    className="btn btn-ghost btn-block"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="https://accounts.letbuyy.com/signup"
                                    className="btn btn-primary btn-block"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Get Started Free
                                </Link>

                                {/* Theme Toggle */}
                                <button
                                    className="mobile-drawer-theme-toggle"
                                    onClick={cycleTheme}
                                    aria-label={`Current theme: ${theme}. Click to change.`}
                                >
                                    <ThemeIcon />
                                    <span>
                                        {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
