export type MerchantSiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

export interface MerchantNavChild {
    path: string
    label: string
    icon?: string
    shortcut?: string
    keywords?: string[]
}

export interface MerchantNavItem extends MerchantNavChild {
    icon: string
    children?: MerchantNavChild[]
}

export interface MerchantCommandItem {
    label: string
    icon: string
    href: string
    section: string
    pathHint: string
    shortcut?: string
    keywords: string[]
}

const settingsChildren: MerchantNavChild[] = [
    { path: 'settings/general', label: 'General', icon: 'general' },
    { path: 'settings/plan', label: 'Plan', icon: 'plan' },
    { path: 'settings/billing', label: 'Billing', icon: 'receipt_long' },
    { path: 'settings/domains', label: 'Domains', icon: 'language' },
    { path: 'settings/payments', label: 'Payments', icon: 'payments' },
    { path: 'settings/checkout', label: 'Checkout', icon: 'shopping_cart_checkout' },
    { path: 'settings/shipping', label: 'Shipping', icon: 'shipping' },
    { path: 'settings/taxes', label: 'Taxes', icon: 'taxes' },
    { path: 'settings/policies', label: 'Policies', icon: 'policies' },
    { path: 'settings/notifications', label: 'Notifications', icon: 'notifications' },
    { path: 'settings/users', label: 'Users and permissions', icon: 'manage_accounts' },
]

const baseEndItems: MerchantNavItem[] = [
    {
        path: 'apps',
        label: 'Apps',
        icon: 'extension',
        shortcut: 'g x',
        children: [
            { path: 'apps', label: 'Installed apps', icon: 'extension' },
            { path: 'ai', label: 'LetBuyy AI', icon: 'auto_awesome' },
        ],
    },
    { path: 'analytics', label: 'Analytics', icon: 'bar_chart', shortcut: 'g a' },
    {
        path: 'settings',
        label: 'Settings',
        icon: 'settings',
        shortcut: 'g s',
        children: settingsChildren,
    },
]

const storeNavigation: MerchantNavItem[] = [
    { path: 'dashboard', label: 'Home', icon: 'home', shortcut: 'g h' },
    { path: 'orders', label: 'Orders', icon: 'shopping_cart', shortcut: 'g o' },
    {
        path: 'products',
        label: 'Products',
        icon: 'inventory_2',
        shortcut: 'g p',
        children: [
            { path: 'products/new', label: 'Add product', icon: 'add_circle', shortcut: 'n p' },
            { path: 'products/collections', label: 'Collections', icon: 'folder_special' },
            { path: 'products/inventory', label: 'Inventory', icon: 'inventory' },
            { path: 'products/purchase-orders', label: 'Purchase orders', icon: 'request_quote' },
            { path: 'products/transfers', label: 'Transfers', icon: 'swap_horiz' },
            { path: 'products/gift-cards', label: 'Gift cards', icon: 'card_giftcard' },
        ],
    },
    { path: 'customers', label: 'Customers', icon: 'group', shortcut: 'g c' },
    {
        path: 'coupons',
        label: 'Marketing',
        icon: 'marketing',
        shortcut: 'g m',
        children: [
            { path: 'coupons', label: 'Discounts', icon: 'sell' },
            { path: 'reviews', label: 'Reviews', icon: 'rate_review' },
        ],
    },
    {
        path: 'pages',
        label: 'Content',
        icon: 'pages',
        children: [
            { path: 'pages', label: 'Pages', icon: 'page' },
            { path: 'posts', label: 'Blog posts', icon: 'posts' },
            { path: 'categories', label: 'Categories', icon: 'category' },
            { path: 'comments', label: 'Comments', icon: 'comment' },
        ],
    },
    {
        path: 'online-store',
        label: 'Online Store',
        icon: 'storefront',
        shortcut: 'g t',
        children: [
            { path: 'online-store/themes', label: 'Themes', icon: 'palette' },
            { path: 'online-store/pages', label: 'Store pages', icon: 'web_asset' },
            { path: 'online-store/preferences', label: 'Preferences', icon: 'tune' },
        ],
    },
    ...baseEndItems,
]

const portfolioNavigation: MerchantNavItem[] = [
    { path: 'dashboard', label: 'Home', icon: 'home', shortcut: 'g h' },
    {
        path: 'projects',
        label: 'Content',
        icon: 'projects',
        shortcut: 'g p',
        children: [
            { path: 'projects', label: 'Projects', icon: 'projects' },
            { path: 'gallery', label: 'Gallery', icon: 'gallery' },
            { path: 'pages', label: 'Pages', icon: 'pages' },
        ],
    },
    {
        path: 'skills',
        label: 'Profile',
        icon: 'user',
        children: [
            { path: 'skills', label: 'Skills', icon: 'skills' },
            { path: 'education', label: 'Education', icon: 'education' },
            { path: 'testimonials', label: 'Testimonials', icon: 'testimonials' },
        ],
    },
    { path: 'contact', label: 'Marketing', icon: 'marketing', shortcut: 'g m' },
    { path: 'appearance', label: 'Online Store', icon: 'palette', shortcut: 'g t' },
    ...baseEndItems,
]

const resumeNavigation: MerchantNavItem[] = [
    { path: 'dashboard', label: 'Home', icon: 'home', shortcut: 'g h' },
    {
        path: 'experience',
        label: 'Profile',
        icon: 'work',
        shortcut: 'g p',
        children: [
            { path: 'experience', label: 'Experience', icon: 'work' },
            { path: 'education', label: 'Education', icon: 'education' },
            { path: 'skills', label: 'Skills', icon: 'skills' },
            { path: 'certifications', label: 'Certifications', icon: 'verified' },
        ],
    },
    {
        path: 'ats-score',
        label: 'Productivity',
        icon: 'steps',
        children: [
            { path: 'ats-score', label: 'ATS score', icon: 'analytics' },
            { path: 'export', label: 'PDF export', icon: 'picture_as_pdf' },
        ],
    },
    ...baseEndItems,
]

const landingNavigation: MerchantNavItem[] = [
    { path: 'dashboard', label: 'Home', icon: 'home', shortcut: 'g h' },
    { path: 'pages', label: 'Content', icon: 'pages', shortcut: 'g p' },
    { path: 'leads', label: 'Marketing', icon: 'marketing', shortcut: 'g m' },
    { path: 'appearance', label: 'Online Store', icon: 'palette', shortcut: 'g t' },
    ...baseEndItems,
]

const blogNavigation: MerchantNavItem[] = [
    { path: 'dashboard', label: 'Home', icon: 'home', shortcut: 'g h' },
    {
        path: 'posts',
        label: 'Content',
        icon: 'posts',
        shortcut: 'g p',
        children: [
            { path: 'posts', label: 'Posts', icon: 'posts' },
            { path: 'categories', label: 'Categories', icon: 'category' },
            { path: 'comments', label: 'Comments', icon: 'comment' },
            { path: 'pages', label: 'Pages', icon: 'pages' },
        ],
    },
    { path: 'appearance', label: 'Online Store', icon: 'palette', shortcut: 'g t' },
    ...baseEndItems,
]

const navigationByType: Record<MerchantSiteType, MerchantNavItem[]> = {
    store: storeNavigation,
    portfolio: portfolioNavigation,
    resume: resumeNavigation,
    landing: landingNavigation,
    blog: blogNavigation,
}

const shortcutDestinations: Record<MerchantSiteType, Record<string, string>> = {
    store: {
        'g h': 'dashboard',
        'g o': 'orders',
        'g p': 'products',
        'g c': 'customers',
        'g m': 'coupons',
        'g t': 'online-store/themes',
        'g a': 'analytics',
        'g x': 'apps',
        'g s': 'settings',
        'n p': 'products/new',
    },
    portfolio: {
        'g h': 'dashboard',
        'g p': 'projects',
        'g m': 'contact',
        'g t': 'appearance',
        'g a': 'analytics',
        'g x': 'apps',
        'g s': 'settings',
    },
    resume: {
        'g h': 'dashboard',
        'g p': 'experience',
        'g a': 'analytics',
        'g x': 'apps',
        'g s': 'settings',
    },
    landing: {
        'g h': 'dashboard',
        'g p': 'pages',
        'g m': 'leads',
        'g t': 'appearance',
        'g a': 'analytics',
        'g x': 'apps',
        'g s': 'settings',
    },
    blog: {
        'g h': 'dashboard',
        'g p': 'posts',
        'g t': 'appearance',
        'g a': 'analytics',
        'g x': 'apps',
        'g s': 'settings',
    },
}

export function normalizeSiteType(siteType: string | null | undefined): MerchantSiteType {
    if (siteType === 'portfolio' || siteType === 'resume' || siteType === 'landing' || siteType === 'blog') {
        return siteType
    }

    return 'store'
}

export function getMerchantNavigation(siteType: string | null | undefined): MerchantNavItem[] {
    return navigationByType[normalizeSiteType(siteType)]
}

export function getMerchantCommandItems(siteType: string | null | undefined, store: string): MerchantCommandItem[] {
    const commands: MerchantCommandItem[] = []

    for (const item of getMerchantNavigation(siteType)) {
        commands.push(toCommand(item, item.label, store))

        for (const child of item.children ?? []) {
            commands.push(toCommand({ ...child, icon: child.icon ?? item.icon }, item.label, store))
        }
    }

    return commands
}

export function resolveKeyboardShortcut(siteType: string | null | undefined, sequence: string): string | null {
    return shortcutDestinations[normalizeSiteType(siteType)][sequence.toLowerCase()] ?? null
}

function toCommand(item: MerchantNavChild & { icon: string }, section: string, store: string): MerchantCommandItem {
    return {
        label: item.label,
        icon: item.icon,
        href: `/${store}/${item.path}`,
        section,
        pathHint: `/${item.path}`,
        shortcut: item.shortcut,
        keywords: [item.label, item.path, section, ...(item.keywords ?? [])].map((keyword) => keyword.toLowerCase()),
    }
}
