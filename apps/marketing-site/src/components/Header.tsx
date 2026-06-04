'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Monitor, Moon, Sun, X } from '@letbuyy/ui'
import BrandLogo from './BrandLogo'
import { useTheme } from './ThemeProvider'

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

function renderThemeIcon(theme: ThemeMode, resolvedTheme: ResolvedTheme) {
    if (theme === 'system') {
        return <Monitor width={20} height={20} aria-hidden="true" />
    }

    if (resolvedTheme === 'dark') {
        return <Moon width={20} height={20} aria-hidden="true" />
    }

    return <Sun width={20} height={20} aria-hidden="true" />
}

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
        { href: '#capabilities', label: 'Why LetBuyy', hasDropdown: true },
        { href: '#features', label: 'Products', hasDropdown: true },
        { href: '#pricing', label: 'Pricing' },
        { href: '#how-it-works', label: 'Enterprise' },
    ]

    const cycleTheme = () => {
        const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
        const currentIndex = themes.indexOf(theme)
        const nextIndex = (currentIndex + 1) % themes.length
        setTheme(themes[nextIndex])
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
                        <BrandLogo className="header-logo-image" width={152} height={49} priority />
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="header-nav" aria-label="Main navigation">
                        {navLinks.map((link) => (
                            <Link key={link.href} href={link.href} className="header-nav-link">
                                <span>{link.label}</span>
                                {link.hasDropdown ? (
                                    <ChevronDown className="header-nav-chevron" width={15} height={15} aria-hidden="true" />
                                ) : null}
                            </Link>
                        ))}
                    </nav>

                    {/* Desktop Actions */}
                    <div className="header-actions">
                        <Link href="https://accounts.letbuyy.store/lookup" className="btn btn-ghost">
                            Log in
                        </Link>
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Link href="https://accounts.letbuyy.store/signup" className="btn btn-primary">
                                Start for free
                            </Link>
                        </motion.div>
                    </div>

                    <Link href="https://accounts.letbuyy.store/signup" className="mobile-start-link">
                        Start for free
                    </Link>

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
                                    <BrandLogo className="mobile-drawer-logo-image" width={176} height={57} />
                                </Link>
                                <button
                                    className="mobile-drawer-close"
                                    onClick={() => setMobileMenuOpen(false)}
                                    aria-label="Close menu"
                                >
                                    <X width={24} height={24} aria-hidden="true" />
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
                                            <ChevronRight width={20} height={20} aria-hidden="true" />
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
                                    href="https://accounts.letbuyy.store/lookup"
                                    className="btn btn-ghost btn-block"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="https://accounts.letbuyy.store/signup"
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
                                    {renderThemeIcon(theme, resolvedTheme)}
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
