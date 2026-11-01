'use client'

import {
    AppWindow, Award, BarChart3, BadgeCheck, Briefcase, CircleHelp,
    FileText, GraduationCap, Home, Image, Megaphone, MessageCircle,
    Newspaper, Package, Palette, Settings, ShoppingBag, ShoppingCart, Store, Tag,
    User, Users, Wallet, type LucideIcon,
} from 'lucide-react'

const icons: Record<string, LucideIcon> = {
    home: Home,
    shopping_bag: ShoppingBag,
    inventory_2: Package,
    products: Package,
    group: Users,
    customers: Users,
    shopping_cart: ShoppingCart,
    wallet: Wallet,
    marketing: Megaphone,
    content: Newspaper,
    bar_chart: BarChart3,
    storefront: Store,
    add_circle: AppWindow,
    settings: Settings,
    projects: Briefcase,
    gallery: Image,
    pages: FileText,
    user: User,
    skills: BadgeCheck,
    education: GraduationCap,
    testimonials: Award,
    work: Briefcase,
    verified: BadgeCheck,
    palette: Palette,
    posts: Newspaper,
    category: Tag,
    comment: MessageCircle,
}

/** Functional navigation icons follow the repository's Lucide web contract. */
export function MerchantSidebarIcon({ name }: { name: string; label?: string }) {
    const Icon = icons[name] ?? CircleHelp
    return <Icon className="merchant-sidebar-icon letbuyy-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
}
