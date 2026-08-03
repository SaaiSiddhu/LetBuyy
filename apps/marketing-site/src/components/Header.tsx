'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from '@letbuyy/ui'
import {
    ArrowLeft,
    Award,
    BarChart3,
    Bot,
    Button,
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
    RotateCcw,
    ShieldCheck,
    Smartphone,
    Sparkles,
    Store,
    Tag,
    Truck,
    Users,
    X,
} from '@letbuyy/ui'
import BrandLogo from './BrandLogo'
import {
    getAccountsUrl,
    getAppMarketplaceUrl,
    getDeveloperPortalUrl,
    getThemeMarketplaceUrl,
} from '../lib/public-urls'

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

const themeMarketplaceUrl = getThemeMarketplaceUrl('/themes')
const appMarketplaceUrl = getAppMarketplaceUrl('/')
const developerPortalUrl = getDeveloperPortalUrl('/docs')

const navLinks: NavLink[] = [
    { label: 'Why LetBuyy', menu: 'why' },
    { label: 'Products', menu: 'products' },
    { href: themeMarketplaceUrl, label: 'Themes' },
    { href: appMarketplaceUrl, label: 'Apps' },
    { href: developerPortalUrl, label: 'Developers' },
    { href: '#pricing', label: 'Pricing' },
]

const whyIntro =
    'LetBuyy is a simple way for Indian businesses to sell online — your shop, payments, orders and customers, all in one place.'

const whyCards: MenuItem[] = [
    {
        href: '#how-it-works',
        icon: Rocket,
        label: 'Start selling today',
        description: 'Pick a design, add your products, go live. No coding and no agency needed.',
    },
    {
        href: '#features',
        icon: IndianRupee,
        label: 'Made for India',
        description: 'Take UPI, cards and cash on delivery. GST bills are created for you on every order.',
    },
    {
        href: '#capabilities',
        icon: Store,
        label: 'Everything in one place',
        description: 'Products, orders, stock and customers together — no more juggling apps and sheets.',
    },
]

const whyBuiltIn: MenuItem[] = [
    {
        href: '#features',
        icon: CreditCard,
        label: 'Get paid on time',
        description: 'Money reaches your bank account, and every payment and refund is tracked for you.',
    },
    {
        href: '#features',
        icon: Truck,
        label: 'Deliver anywhere',
        description: 'Ship across India with rates, pickup and tracking already set up.',
    },
    {
        href: '#features',
        icon: ShieldCheck,
        label: 'Safe and always open',
        description: 'Your shop stays online round the clock, and customer details stay private.',
    },
    {
        href: '#features',
        icon: BarChart3,
        label: 'Know what sells',
        description: 'See daily sales, best products and repeat buyers in plain numbers.',
    },
    {
        href: '#features',
        icon: MessageCircle,
        label: 'Sell on WhatsApp',
        description: 'Share your shop and send order updates where your customers already are.',
    },
    {
        href: '#features',
        icon: Puzzle,
        label: 'Grow when ready',
        description: 'Add new designs and features any time — nothing needs rebuilding.',
    },
]

const productSections: MenuSection[] = [
    {
        eyebrow: 'Build your shop',
        items: [
            { href: '#capabilities', icon: LayoutDashboard, label: 'Shop Builder' },
            { href: themeMarketplaceUrl, icon: Palette, label: 'Designs' },
            { href: '#features', icon: Globe, label: 'Domain Name' },
            { href: '#capabilities', icon: FileText, label: 'Pages & Blogs' },
            { href: '#features', icon: Users, label: 'Customer Logins' },
        ],
    },
    {
        eyebrow: 'Sell anywhere',
        items: [
            { href: '#features', icon: Store, label: 'Online Shop' },
            { href: '#features', icon: Smartphone, label: 'Sell on Mobile' },
            { href: '#features', icon: MessageCircle, label: 'WhatsApp Orders' },
            { href: '#features', icon: Megaphone, label: 'Social Selling' },
            { href: '#features', icon: Globe, label: 'India & Overseas' },
        ],
    },
    {
        eyebrow: 'Bring in customers',
        items: [
            { href: '#features', icon: Megaphone, label: 'Campaigns' },
            { href: '#features', icon: MessageCircle, label: 'Customer Chat' },
            { href: '#pricing', icon: Tag, label: 'Discount Codes' },
            { href: '#features', icon: Award, label: 'Gift Cards' },
            { href: '#features', icon: BarChart3, label: 'Sales Reports' },
        ],
    },
    {
        eyebrow: 'Run your business',
        items: [
            { href: '#features', icon: Package, label: 'Orders & Stock' },
            { href: '#features', icon: Truck, label: 'Shipping & GST' },
            { href: '#features', icon: Users, label: 'Customers' },
            { href: '#features', icon: Bot, label: 'Auto Reminders' },
        ],
    },
    {
        eyebrow: 'Get paid',
        items: [
            { href: '#features', icon: CreditCard, label: 'Checkout' },
            { href: '#features', icon: IndianRupee, label: 'UPI, Cards & COD' },
            { href: '#features', icon: FileText, label: 'GST Invoices' },
            { href: '#features', icon: RotateCcw, label: 'Refunds & Returns' },
        ],
    },
    {
        eyebrow: 'Make it your own',
        items: [
            { href: themeMarketplaceUrl, icon: Palette, label: 'Browse Designs', description: 'Ready-made looks for your shop.' },
            { href: appMarketplaceUrl, icon: Puzzle, label: 'Browse Add-ons', description: 'Add new features in a click.' },
            { href: developerPortalUrl, icon: Code2, label: 'For Developers', description: 'Build custom features with our tools.' },
        ],
    },
]

const productHighlights: MenuItem[] = [
    {
        href: '#features',
        icon: Sparkles,
        label: 'One place for everything',
        description: 'Build your shop, add products and handle daily work without switching apps.',
    },
    {
        href: '#features',
        icon: Bot,
        label: 'AI that helps you',
        description: 'Set up your shop and write product details in seconds, not hours.',
    },
    {
        href: '#features',
        icon: ShieldCheck,
        label: 'Safe and reliable',
        description: 'Your shop stays fast and online, and your business data stays private.',
    },
]

/* Proof points for the Why panel footer. Each is verifiable against the
   product, not a marketing round-number: 0% is the actual pricing commitment,
   GST invoices are generated per order, and all three payment routes ship. */
const whyProof = [
    { value: '0%', label: 'commission on your sales' },
    { value: 'GST', label: 'invoice on every order' },
    { value: 'UPI · Cards · COD', label: 'ready from day one' },
]

/* Four rendered columns from six authored sections: "Get paid" rides under
   "Run your business" so the panel is four columns wide rather than three
   columns deep, which is what made the old one fill the viewport. */
const productColumns: MenuSection[][] = [
    [productSections[0]],
    [productSections[1]],
    [productSections[2]],
    [productSections[3], productSections[4]],
]

function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
    return <Icon width={17} height={17} aria-hidden="true" />
}

function DesktopWhyMenu({ closeMenu }: { closeMenu: () => void }) {
    return (
        <>
            <div className="mega-lead">
                <p className="mega-eyebrow">Why LetBuyy</p>
                <p className="mega-lead-text">{whyIntro}</p>
            </div>

            <div className="mega-body mega-body-why">
                <section className="mega-col">
                    <p className="mega-eyebrow">Where it starts</p>
                    <div className="mega-stack">
                        {whyCards.map((item) => (
                            <Link key={item.label} href={item.href} className="mega-item" onClick={closeMenu}>
                                <span className="mega-item-icon">
                                    <MenuIcon icon={item.icon} />
                                </span>
                                <span className="mega-item-text">
                                    <strong>{item.label}</strong>
                                    <small>{item.description}</small>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="mega-col">
                    <p className="mega-eyebrow">Included with every store</p>
                    {/* Titles only. Six descriptions here made the panel taller
                        than the three pillars beside it and left a void. */}
                    <div className="mega-pair-grid">
                        {whyBuiltIn.map((item) => (
                            <Link key={item.label} href={item.href} className="mega-compact" onClick={closeMenu}>
                                <span className="mega-item-icon">
                                    <MenuIcon icon={item.icon} />
                                </span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>

            <div className="mega-foot">
                <div className="mega-facts">
                    {whyProof.map((fact) => (
                        <span key={fact.value} className="mega-fact">
                            <strong>{fact.value}</strong>
                            <small>{fact.label}</small>
                        </span>
                    ))}
                </div>
                <Link href="#pricing" className="mega-foot-cta" onClick={closeMenu}>
                    See pricing
                    <ChevronRight width={14} height={14} aria-hidden="true" />
                </Link>
            </div>
        </>
    )
}

function DesktopProductsMenu({ closeMenu }: { closeMenu: () => void }) {
    return (
        <>
            <div className="mega-body mega-body-products">
                <div className="mega-cols">
                    {productColumns.map((column, index) => (
                        <div key={index} className="mega-col">
                            {column.map((section) => (
                                <section key={section.eyebrow} className="mega-col-section">
                                    <p className="mega-eyebrow">{section.eyebrow}</p>
                                    <div className="mega-stack-tight">
                                        {section.items.map((item) => (
                                            <Link
                                                key={item.label}
                                                href={item.href}
                                                className="mega-compact"
                                                onClick={closeMenu}
                                            >
                                                <span className="mega-item-icon">
                                                    <MenuIcon icon={item.icon} />
                                                </span>
                                                <span>{item.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ))}
                </div>

                <aside className="mega-rail">
                    <p className="mega-eyebrow">Built to keep up</p>
                    <div className="mega-stack">
                        {productHighlights.map((item) => (
                            <Link key={item.label} href={item.href} className="mega-item" onClick={closeMenu}>
                                <span className="mega-item-icon">
                                    <MenuIcon icon={item.icon} />
                                </span>
                                <span className="mega-item-text">
                                    <strong>{item.label}</strong>
                                    <small>{item.description}</small>
                                </span>
                            </Link>
                        ))}
                    </div>
                </aside>
            </div>

            <div className="mega-foot">
                <p className="mega-eyebrow mega-foot-eyebrow">Make it your own</p>
                <div className="mega-foot-links">
                    {productSections[5].items.map((item) => (
                        <Link key={item.label} href={item.href} className="mega-foot-link" onClick={closeMenu}>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                        </Link>
                    ))}
                </div>
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
                            <Button unstyled
                                key={link.label}
                                type="button"
                                className="mobile-drawer-link"
                                onClick={() => openPanel(link.menu)}
                            >
                                <span>{link.label}</span>
                                <ChevronRight width={34} height={34} aria-hidden="true" />
                            </Button>
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
            <Button unstyled type="button" className="mobile-panel-back" onClick={goBack}>
                <ArrowLeft width={24} height={24} aria-hidden="true" />
                <span>Back</span>
            </Button>

            <p className="mobile-panel-intro">{whyIntro}</p>

            <div className="mobile-card-stack">
                {whyCards.map((item) => (
                    <Link key={item.label} href={item.href} className="mobile-feature-card" onClick={closeMenu}>
                        <span className="mobile-link-icon">
                            <MenuIcon icon={item.icon} />
                        </span>
                        <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                        </span>
                    </Link>
                ))}
            </div>

            <p className="mobile-panel-eyebrow">Included with every store</p>
            <div className="mobile-mini-grid">
                {whyBuiltIn.map((item) => (
                    <Link key={item.label} href={item.href} className="mobile-mini-card" onClick={closeMenu}>
                        <span className="mobile-link-icon">
                            <MenuIcon icon={item.icon} />
                        </span>
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
            <Button unstyled type="button" className="mobile-panel-back" onClick={goBack}>
                <ArrowLeft width={24} height={24} aria-hidden="true" />
                <span>Back</span>
            </Button>

            <div className="mobile-section-stack">
                {productSections.map((section) => (
                    <section key={section.eyebrow} className="mobile-menu-section">
                        <p className="mobile-panel-eyebrow">{section.eyebrow}</p>
                        <div
                            className={
                                section.items.some((item) => item.description)
                                    ? 'mobile-panel-link-list is-detailed'
                                    : 'mobile-panel-link-list'
                            }
                        >
                            {section.items.map((item) => (
                                <Link key={item.label} href={item.href} className="mobile-panel-link" onClick={closeMenu}>
                                    <span className="mobile-link-icon">
                                        <MenuIcon icon={item.icon} />
                                    </span>
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

/* Hover timings. 90ms of intent stops the panel flashing open as the cursor
   crosses a trigger on its way somewhere else; 180ms of grace covers the
   diagonal from trigger to panel without the panel vanishing mid-move. */
const OPEN_DELAY_MS = 90
const CLOSE_DELAY_MS = 180

/* Panel widths, in JS because the anchor maths needs the number before the
   element exists. Clamped to the viewport at measure time. */
const MENU_WIDTH: Record<DropdownKey, number> = { why: 780, products: 1080 }
const MENU_MARGIN = 20
/* Panel padding (20) minus the trigger's own inline padding (~8), so the
   panel's first column of text sits under the trigger's label. */
const MENU_TEXT_INSET = 12

export default function Header() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [activeDesktopMenu, setActiveDesktopMenu] = useState<DropdownKey | null>(null)
    const [mobilePanel, setMobilePanel] = useState<DropdownKey | null>(null)
    const [megaBox, setMegaBox] = useState<{ left: number; width: number } | null>(null)

    const hoverTimer = useRef<number | null>(null)
    /* Measured off the nav by data attribute rather than per-trigger refs:
       @letbuyy/ui Button does not forward a ref, and adding one there would
       change a shared component for a layout detail local to this header. */
    const navRef = useRef<HTMLElement | null>(null)
    /* Hover only drives the menu where a real pointer exists. On touch the
       trigger stays a plain toggle, or the panel would open on first tap and
       the link underneath would never be reachable. */
    const pointerIsFine = useRef(false)

    useEffect(() => {
        const query = window.matchMedia('(hover: hover) and (pointer: fine)')
        const sync = () => {
            pointerIsFine.current = query.matches
        }
        sync()
        query.addEventListener('change', sync)
        return () => query.removeEventListener('change', sync)
    }, [])

    const clearHoverTimer = useCallback(() => {
        if (hoverTimer.current !== null) {
            window.clearTimeout(hoverTimer.current)
            hoverTimer.current = null
        }
    }, [])

    useEffect(() => clearHoverTimer, [clearHoverTimer])

    /* Hang the panel's left edge under the trigger's left edge, offset by the
       difference in horizontal padding so the first column's text lines up
       with the trigger's label rather than with the panel's outer edge.

       Centring on the trigger was tried first and is wrong here: the nav is
       left-aligned and these panels are 780-1080px wide, so every centred
       position clamped to the viewport margin and the anchor did nothing. */
    const measureMenu = useCallback((menu: DropdownKey) => {
        const trigger = navRef.current?.querySelector<HTMLElement>(`[data-menu="${menu}"]`)
        if (!trigger) return

        const rect = trigger.getBoundingClientRect()
        const width = Math.min(MENU_WIDTH[menu], window.innerWidth - MENU_MARGIN * 2)
        const preferred = rect.left - MENU_TEXT_INSET
        const left = Math.max(
            MENU_MARGIN,
            Math.min(preferred, window.innerWidth - width - MENU_MARGIN),
        )

        setMegaBox({ left, width })
    }, [])

    const openDesktopMenu = useCallback(
        (menu: DropdownKey) => {
            clearHoverTimer()
            measureMenu(menu)
            setMobileMenuOpen(false)
            setMobilePanel(null)
            setActiveDesktopMenu(menu)
        },
        [clearHoverTimer, measureMenu],
    )

    const scheduleClose = useCallback(() => {
        clearHoverTimer()
        hoverTimer.current = window.setTimeout(() => {
            setActiveDesktopMenu(null)
        }, CLOSE_DELAY_MS)
    }, [clearHoverTimer])

    const handleTriggerEnter = useCallback(
        (menu: DropdownKey) => {
            if (!pointerIsFine.current) return
            clearHoverTimer()

            /* Moving between triggers switches with no delay — the intent was
               already established by the panel being open. */
            if (activeDesktopMenu) {
                openDesktopMenu(menu)
                return
            }

            hoverTimer.current = window.setTimeout(() => openDesktopMenu(menu), OPEN_DELAY_MS)
        },
        [activeDesktopMenu, clearHoverTimer, openDesktopMenu],
    )

    const handlePointerLeave = useCallback(() => {
        if (!pointerIsFine.current) return
        scheduleClose()
    }, [scheduleClose])

    /* The anchor is viewport-relative, so a resize invalidates it. */
    useEffect(() => {
        if (!activeDesktopMenu) return
        const remeasure = () => measureMenu(activeDesktopMenu)
        window.addEventListener('resize', remeasure)
        return () => window.removeEventListener('resize', remeasure)
    }, [activeDesktopMenu, measureMenu])

    /* Authoritative close: while a panel is open, anything the pointer moves
       onto that is neither the panel nor a trigger schedules the dismiss.
       The element-level onPointerLeave stays because it responds a frame
       sooner, but it cannot be the only mechanism — React derives leave from
       pointerout's relatedTarget, and Next renders <body> as a React element,
       so moving onto empty page background does not reliably produce one. */
    useEffect(() => {
        if (!activeDesktopMenu) return

        const handlePointerOver = (event: PointerEvent) => {
            if (!pointerIsFine.current) return
            const target = event.target as Element | null
            if (target?.closest('.desktop-mega') || target?.closest('[data-menu]')) {
                clearHoverTimer()
                return
            }
            scheduleClose()
        }

        document.addEventListener('pointerover', handlePointerOver)
        return () => document.removeEventListener('pointerover', handlePointerOver)
    }, [activeDesktopMenu, clearHoverTimer, scheduleClose])

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

    useEffect(() => {
        const desktopQuery = window.matchMedia('(min-width: 1024px)')
        const handleNavigationModeChange = (event: MediaQueryListEvent) => {
            if (event.matches) {
                setMobileMenuOpen(false)
                setMobilePanel(null)
                return
            }

            setActiveDesktopMenu(null)
        }

        desktopQuery.addEventListener('change', handleNavigationModeChange)
        return () => desktopQuery.removeEventListener('change', handleNavigationModeChange)
    }, [])

    const closeAllMenus = () => {
        clearHoverTimer()
        setActiveDesktopMenu(null)
        setMobileMenuOpen(false)
        setMobilePanel(null)
    }

    const loginUrl = getAccountsUrl('/lookup')
    const signupUrl = getAccountsUrl('/signup')

    const openMobileMenu = () => {
        setActiveDesktopMenu(null)
        setMobilePanel(null)
        setMobileMenuOpen(true)
    }

    /* Still a real toggle: this is the path for touch, for keyboard Enter and
       Space, and for anyone who clicks out of habit. */
    const toggleDesktopMenu = (menu: DropdownKey) => {
        clearHoverTimer()
        if (activeDesktopMenu === menu) {
            setActiveDesktopMenu(null)
            return
        }
        openDesktopMenu(menu)
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

                    <nav className="header-nav" aria-label="Main navigation" ref={navRef}>
                        {navLinks.map((link) => {
                            if ('menu' in link) {
                                const expanded = activeDesktopMenu === link.menu

                                return (
                                    <Button unstyled
                                        key={link.label}
                                        data-menu={link.menu}
                                        type="button"
                                        className={`header-nav-link ${expanded ? 'active' : ''}`}
                                        aria-expanded={expanded}
                                        aria-controls={`desktop-mega-${link.menu}`}
                                        onClick={() => toggleDesktopMenu(link.menu)}
                                        onPointerEnter={() => handleTriggerEnter(link.menu)}
                                        onPointerLeave={handlePointerLeave}
                                    >
                                        <span>{link.label}</span>
                                        <ChevronDown className="header-nav-chevron" width={15} height={15} aria-hidden="true" />
                                    </Button>
                                )
                            }

                            return (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="header-nav-link"
                                    onClick={closeAllMenus}
                                    /* Pointing at a sibling link dismisses an open
                                       panel, same as leaving the nav entirely. */
                                    onPointerEnter={handlePointerLeave}
                                >
                                    <span>{link.label}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    <div className="header-actions">
                        <Link href={loginUrl} className="btn btn-ghost" onClick={closeAllMenus}>
                            Log in
                        </Link>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Link href={signupUrl} className="btn btn-primary" onClick={closeAllMenus}>
                                Start for free
                            </Link>
                        </motion.div>
                    </div>

                    <Link href={signupUrl} className="mobile-start-link" onClick={closeAllMenus}>
                        Start for free
                    </Link>

                    <Button unstyled
                        className="mobile-menu-btn"
                        onClick={mobileMenuOpen ? closeAllMenus : openMobileMenu}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`} />
                    </Button>
                </div>
            </motion.header>

            <AnimatePresence>
                {activeDesktopMenu ? (
                    <motion.div
                        key={activeDesktopMenu}
                        id={`desktop-mega-${activeDesktopMenu}`}
                        className="desktop-mega"
                        data-menu={activeDesktopMenu}
                        style={
                            megaBox
                                ? { left: `${megaBox.left}px`, width: `${megaBox.width}px` }
                                : undefined
                        }
                        initial={{ opacity: 0, y: -10, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.99 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onPointerEnter={clearHoverTimer}
                        onPointerLeave={handlePointerLeave}
                        /* Keyboard users tab into the panel; that must not be
                           treated as the pointer having left it. */
                        onFocusCapture={clearHoverTimer}
                    >
                        <div className="desktop-mega-card">
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
                            <Link href={signupUrl} className="mobile-drawer-start" onClick={closeAllMenus}>
                                Start for free
                            </Link>
                            <Button unstyled className="mobile-drawer-close" onClick={closeAllMenus} aria-label="Close menu">
                                <X width={24} height={24} aria-hidden="true" />
                            </Button>
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
                                href={loginUrl}
                                className="btn btn-ghost btn-block"
                                onClick={closeAllMenus}
                            >
                                Log in
                            </Link>
                            <Link
                                href={signupUrl}
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
