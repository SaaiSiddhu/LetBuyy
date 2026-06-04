'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from '@letbuyy/ui'
import {
    ArrowLeft,
    BarChart3,
    Bot,
    ChevronDown,
    ChevronRight,
    Code2,
    CreditCard,
    FileText,
    Globe,
    IndianRupee,
    LayoutDashboard,
    Megaphone,
    MessageCircle,
    Package,
    Palette,
    Puzzle,
    Rocket,
    ShieldCheck,
    ShoppingBag,
    Smartphone,
    Sparkles,
    Store,
    Tag,
    Truck,
    Users,
    X,
} from '@letbuyy/ui'
import BrandLogo from './BrandLogo'

type DropdownKey = 'why' | 'products'

type NavLink =
    | {
        label: string
        menu: DropdownKey
    }
    | {
        href: string
        label: string
    }

type MenuItem = {
    description?: string
    href: string
    icon: LucideIcon
    label: string
}

type MenuSection = {
    eyebrow: string
    items: MenuItem[]
}

const navLinks: NavLink[] = [
    { label: 'Why LetBuyy', menu: 'why' },
    { label: 'Products', menu: 'products' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#how-it-works', label: 'Enterprise' },
]

const whyCards: MenuItem[] = [
    {
        href: '#how-it-works',
        icon: Rocket,
        label: 'Launch fast',
        description: 'Start with guided onboarding, store setup, domains, pages and launch readiness in one flow.',
    },
    {
        href: '#features',
        icon: IndianRupee,
        label: 'India-first commerce',
        description: 'Prepare COD, UPI, GST posture, payment readiness and fulfilment defaults for real merchants.',
    },
    {
        href: '#capabilities',
        icon: Store,
        label: 'More than stores',
        description: 'Build stores, portfolios, resumes, blogs and landing pages from the same workspace.',
    },
]

const whyBuiltIn: MenuItem[] = [
    {
        href: '#features',
        icon: CreditCard,
        label: 'Checkout readiness',
        description: 'Payment, order and policy setup stays connected to the storefront.',
    },
    {
        href: '#features',
        icon: ShieldCheck,
        label: 'Tenant-safe runtime',
        description: 'Wildcard storefronts map back to governed site records and ownership checks.',
    },
    {
        href: '#features',
        icon: Puzzle,
        label: 'App and theme ecosystem',
        description: 'Extend each store through marketplace surfaces instead of one-off code.',
    },
]

const productSections: MenuSection[] = [
    {
        eyebrow: 'Build your website',
        items: [
            { href: '#capabilities', icon: LayoutDashboard, label: 'Store Builder' },
            { href: '#features', icon: Palette, label: 'Themes' },
            { href: '#features', icon: Globe, label: 'Domains' },
            { href: '#capabilities', icon: FileText, label: 'Pages & Blogs' },
            { href: '#features', icon: Users, label: 'Customer Accounts' },
        ],
    },
    {
        eyebrow: 'Sell anywhere',
        items: [
            { href: '#features', icon: Store, label: 'Online Store' },
            { href: '#features', icon: Smartphone, label: 'Mobile Commerce' },
            { href: '#features', icon: ShoppingBag, label: 'App Marketplace' },
            { href: '#features', icon: Megaphone, label: 'Social & Marketplaces' },
            { href: '#features', icon: Globe, label: 'Global + India-first' },
        ],
    },
    {
        eyebrow: 'Marketing & analytics',
        items: [
            { href: '#features', icon: Megaphone, label: 'Campaigns' },
            { href: '#features', icon: MessageCircle, label: 'Forms & Customer Chat' },
            { href: '#pricing', icon: Tag, label: 'Discounts' },
            { href: '#features', icon: BarChart3, label: 'Analytics' },
        ],
    },
    {
        eyebrow: 'Run your business',
        items: [
            { href: '#features', icon: Package, label: 'Orders & Inventory' },
            { href: '#features', icon: Truck, label: 'Shipping & Tax' },
            { href: '#features', icon: Users, label: 'Customers' },
            { href: '#features', icon: Bot, label: 'Workflow Automation' },
        ],
    },
    {
        eyebrow: 'Get paid',
        items: [
            { href: '#features', icon: CreditCard, label: 'Checkout' },
            { href: '#features', icon: IndianRupee, label: 'Payments' },
        ],
    },
    {
        eyebrow: 'Customize & extend LetBuyy',
        items: [
            { href: '#features', icon: Palette, label: 'Theme Marketplace', description: 'Reusable storefront looks.' },
            { href: '#features', icon: Puzzle, label: 'App Marketplace', description: 'Install extension workflows.' },
            { href: '#features', icon: Code2, label: 'Developer Platform', description: 'APIs, webhooks and worker runtime.' },
        ],
    },
]

const productHighlights: MenuItem[] = [
    {
        href: '#features',
        icon: Sparkles,
        label: 'LetBuyy Studio',
        description: 'One workspace for site building, content, commerce and operations.',
    },
    {
        href: '#features',
        icon: Bot,
        label: 'AI operations',
        description: 'Assistant-ready workflows for setup, catalog work and automation.',
    },
    {
        href: '#features',
        icon: ShieldCheck,
        label: 'Governed runtime',
        description: 'Cloudflare API, tenant isolation and storefront routing stay aligned.',
    },
]

function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
    return <Icon width={24} height={24} aria-hidden="true" />
}

function DesktopWhyMenu({ closeMenu }: { closeMenu: () => void }) {
    return (
        <div className="desktop-mega-layout desktop-mega-layout-why">
            <div className="desktop-mega-feature-grid">
                {whyCards.map((item) => (
                    <Link key={item.label} href={item.href} className="desktop-mega-feature-card" onClick={closeMenu}>
                        <div className="desktop-mega-feature-icon">
                            <MenuIcon icon={item.icon} />
                        </div>
                        <span>{item.label}</span>
                        <p>{item.description}</p>
                    </Link>
                ))}
            </div>

            <aside className="desktop-mega-side">
                <p className="desktop-mega-eyebrow">Built into every workspace</p>
                <div className="desktop-mega-side-stack">
                    {whyBuiltIn.map((item) => (
                        <Link key={item.label} href={item.href} className="desktop-mega-side-item" onClick={closeMenu}>
                            <MenuIcon icon={item.icon} />
                            <span>
                                <strong>{item.label}</strong>
                                <small>{item.description}</small>
                            </span>
                        </Link>
                    ))}
                </div>
            </aside>
        </div>
    )
}

function DesktopProductsMenu({ closeMenu }: { closeMenu: () => void }) {
    return (
        <>
            <div className="desktop-mega-layout desktop-mega-layout-products">
                <div className="desktop-mega-section-grid">
                    {productSections.slice(0, 5).map((section) => (
                        <div key={section.eyebrow} className="desktop-mega-section">
                            <p className="desktop-mega-eyebrow">{section.eyebrow}</p>
                            <div className="desktop-mega-link-list">
                                {section.items.map((item) => (
                                    <Link key={item.label} href={item.href} className="desktop-mega-link" onClick={closeMenu}>
                                        <MenuIcon icon={item.icon} />
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <aside className="desktop-mega-side desktop-mega-products-side">
                    <p className="desktop-mega-eyebrow">Non-stop platform work</p>
                    <div className="desktop-mega-preview">
                        <div className="desktop-mega-preview-orbit">
                            <span />
                            <span />
                            <span />
                        </div>
                        <strong>LetBuyy releases</strong>
                        <p>Theme engine, storefront runtime, API gateway and marketplace surfaces evolve together.</p>
                    </div>
                    <div className="desktop-mega-side-stack">
                        {productHighlights.map((item) => (
                            <Link key={item.label} href={item.href} className="desktop-mega-side-item" onClick={closeMenu}>
                                <MenuIcon icon={item.icon} />
                                <span>
                                    <strong>{item.label}</strong>
                                    <small>{item.description}</small>
                                </span>
                            </Link>
                        ))}
                    </div>
                </aside>
            </div>

            <div className="desktop-mega-footer">
                {productSections[5].items.map((item) => (
                    <Link key={item.label} href={item.href} className="desktop-mega-footer-link" onClick={closeMenu}>
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                    </Link>
                ))}
            </div>
        </>
    )
}

function MobileMainMenu({
    closeMenu,
    openPanel,
}: {
    closeMenu: () => void
    openPanel: (panel: DropdownKey) => void
}) {
    return (
        <motion.div
            key="mobile-main"
            className="mobile-drawer-body"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22 }}
        >
            <nav className="mobile-drawer-nav" aria-label="Mobile navigation">
                {navLinks.map((link) => {
                    if ('menu' in link) {
                        return (
                            <button
                                key={link.label}
                                type="button"
                                className="mobile-drawer-link"
                                onClick={() => openPanel(link.menu)}
                            >
                                <span>{link.label}</span>
                                <ChevronRight width={34} height={34} aria-hidden="true" />
                            </button>
                        )
                    }

                    return (
                        <Link key={link.label} href={link.href} className="mobile-drawer-link" onClick={closeMenu}>
                            <span>{link.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </motion.div>
    )
}

function MobileWhyPanel({ closeMenu, goBack }: { closeMenu: () => void; goBack: () => void }) {
    return (
        <motion.div
            key="mobile-why"
            className="mobile-drawer-panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22 }}
        >
            <button type="button" className="mobile-panel-back" onClick={goBack}>
                <ArrowLeft width={24} height={24} aria-hidden="true" />
                <span>Back</span>
            </button>

            <div className="mobile-card-stack">
                {whyCards.map((item) => (
                    <Link key={item.label} href={item.href} className="mobile-feature-card" onClick={closeMenu}>
                        <MenuIcon icon={item.icon} />
                        <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                        </span>
                    </Link>
                ))}
            </div>

            <p className="mobile-panel-eyebrow">Built into every workspace</p>
            <div className="mobile-mini-grid">
                {whyBuiltIn.map((item) => (
                    <Link key={item.label} href={item.href} className="mobile-mini-card" onClick={closeMenu}>
                        <MenuIcon icon={item.icon} />
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                    </Link>
                ))}
            </div>
        </motion.div>
    )
}

function MobileProductsPanel({ closeMenu, goBack }: { closeMenu: () => void; goBack: () => void }) {
    return (
        <motion.div
            key="mobile-products"
            className="mobile-drawer-panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22 }}
        >
            <button type="button" className="mobile-panel-back" onClick={goBack}>
                <ArrowLeft width={24} height={24} aria-hidden="true" />
                <span>Back</span>
            </button>

            <div className="mobile-section-stack">
                {productSections.map((section) => (
                    <section key={section.eyebrow} className="mobile-menu-section">
                        <p className="mobile-panel-eyebrow">{section.eyebrow}</p>
                        <div className="mobile-panel-link-list">
                            {section.items.map((item) => (
                                <Link key={item.label} href={item.href} className="mobile-panel-link" onClick={closeMenu}>
                                    <MenuIcon icon={item.icon} />
                                    <span>
                                        <strong>{item.label}</strong>
                                        {item.description ? <small>{item.description}</small> : null}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </motion.div>
    )
}

export default function Header() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [activeDesktopMenu, setActiveDesktopMenu] = useState<DropdownKey | null>(null)
    const [mobilePanel, setMobilePanel] = useState<DropdownKey | null>(null)

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

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

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setActiveDesktopMenu(null)
                setMobileMenuOpen(false)
                setMobilePanel(null)
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [])

    const closeAllMenus = () => {
        setActiveDesktopMenu(null)
        setMobileMenuOpen(false)
        setMobilePanel(null)
    }

    const openMobileMenu = () => {
        setActiveDesktopMenu(null)
        setMobilePanel(null)
        setMobileMenuOpen(true)
    }

    const toggleDesktopMenu = (menu: DropdownKey) => {
        setMobileMenuOpen(false)
        setActiveDesktopMenu((current) => (current === menu ? null : menu))
    }

    const menuOpen = Boolean(activeDesktopMenu) || mobileMenuOpen

    return (
        <>
            <motion.header
                className={`header ${scrolled ? 'scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="container header-content">
                    <Link href="/" className="header-logo" aria-label="LetBuyy Home" onClick={closeAllMenus}>
                        <BrandLogo className="header-logo-image" width={152} height={49} priority />
                    </Link>

                    <nav className="header-nav" aria-label="Main navigation">
                        {navLinks.map((link) => {
                            if ('menu' in link) {
                                const expanded = activeDesktopMenu === link.menu

                                return (
                                    <button
                                        key={link.label}
                                        type="button"
                                        className={`header-nav-link ${expanded ? 'active' : ''}`}
                                        aria-expanded={expanded}
                                        aria-controls={`desktop-mega-${link.menu}`}
                                        onClick={() => toggleDesktopMenu(link.menu)}
                                    >
                                        <span>{link.label}</span>
                                        <ChevronDown className="header-nav-chevron" width={15} height={15} aria-hidden="true" />
                                    </button>
                                )
                            }

                            return (
                                <Link key={link.label} href={link.href} className="header-nav-link" onClick={closeAllMenus}>
                                    <span>{link.label}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    <div className="header-actions">
                        <Link href="https://accounts.letbuyy.store/lookup" className="btn btn-ghost" onClick={closeAllMenus}>
                            Log in
                        </Link>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Link href="https://accounts.letbuyy.store/signup" className="btn btn-primary" onClick={closeAllMenus}>
                                Start for free
                            </Link>
                        </motion.div>
                    </div>

                    <Link href="https://accounts.letbuyy.store/signup" className="mobile-start-link" onClick={closeAllMenus}>
                        Start for free
                    </Link>

                    <button
                        className="mobile-menu-btn"
                        onClick={mobileMenuOpen ? closeAllMenus : openMobileMenu}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`} />
                    </button>
                </div>
            </motion.header>

            <AnimatePresence>
                {activeDesktopMenu ? (
                    <motion.div
                        key={activeDesktopMenu}
                        id={`desktop-mega-${activeDesktopMenu}`}
                        className="desktop-mega"
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22 }}
                    >
                        <div className="container desktop-mega-inner">
                            {activeDesktopMenu === 'why' ? (
                                <DesktopWhyMenu closeMenu={closeAllMenus} />
                            ) : (
                                <DesktopProductsMenu closeMenu={closeAllMenus} />
                            )}
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {mobileMenuOpen ? (
                    <motion.div
                        className="mobile-drawer"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Mobile navigation"
                    >
                        <div className="mobile-drawer-header">
                            <Link href="/" className="mobile-drawer-logo" onClick={closeAllMenus}>
                                <BrandLogo className="mobile-drawer-logo-image" width={152} height={49} />
                            </Link>
                            <Link href="https://accounts.letbuyy.store/signup" className="mobile-drawer-start" onClick={closeAllMenus}>
                                Start for free
                            </Link>
                            <button className="mobile-drawer-close" onClick={closeAllMenus} aria-label="Close menu">
                                <X width={24} height={24} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="mobile-drawer-content">
                            <AnimatePresence mode="wait">
                                {mobilePanel === 'why' ? (
                                    <MobileWhyPanel closeMenu={closeAllMenus} goBack={() => setMobilePanel(null)} />
                                ) : mobilePanel === 'products' ? (
                                    <MobileProductsPanel closeMenu={closeAllMenus} goBack={() => setMobilePanel(null)} />
                                ) : (
                                    <MobileMainMenu closeMenu={closeAllMenus} openPanel={setMobilePanel} />
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="mobile-drawer-actions">
                            <Link
                                href="https://accounts.letbuyy.store/lookup"
                                className="btn btn-ghost btn-block"
                                onClick={closeAllMenus}
                            >
                                Log in
                            </Link>
                            <Link
                                href="https://accounts.letbuyy.store/signup"
                                className="btn btn-primary btn-block"
                                onClick={closeAllMenus}
                            >
                                Start for free
                            </Link>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </>
    )
}
