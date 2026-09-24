export type MerchantSiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

export interface MerchantNavChild {
    path: string
    label: string
    icon?: string
    shortcut?: string
    keywords?: string[]
    /**
     * Match this path exactly rather than by prefix. Needed where one group's
     * path is a prefix of routes that now live in a different group — e.g.
     * `products` vs `products/inventory`, which belongs to Inventory.
     */
    exact?: boolean
}

export type MerchantNavSection = 'primary' | 'sales' | 'apps' | 'bottom'

export interface MerchantNavItem extends MerchantNavChild {
    icon: string
    children?: MerchantNavChild[]
    section?: MerchantNavSection
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

const analyticsItem: MerchantNavItem = {
    path: 'analytics',
    label: 'Analytics',
    icon: 'bar_chart',
    shortcut: 'g a',
}

const appsItem: MerchantNavItem = {
    path: 'apps',
    label: 'Add',
    icon: 'add_circle',
    shortcut: 'g x',
    section: 'apps',
}

const settingsItem: MerchantNavItem = {
    path: 'settings',
    label: 'Settings',
    icon: 'settings',
    shortcut: 'g s',
    section: 'bottom',
}

const baseEndItems: MerchantNavItem[] = [
    analyticsItem,
    appsItem,
    settingsItem,
]

const storeNavigation: MerchantNavItem[] = [
    { path: 'dashboard', label: 'Home', icon: 'home', shortcut: 'g h' },
    // Orders is a leaf: the former `orders?view=drafts` / `?view=abandoned-checkouts`
    // children were dead links. The Orders page filters from local state and never
    // reads useSearchParams, and neither value exists in its OrderStatus union.
    { path: 'orders', label: 'Orders', icon: 'shopping_bag', shortcut: 'g o' },
    {
        // `exact` because `products` prefixes `products/inventory`,
        // `products/purchase-orders` etc., which now live in their own groups.
        // Without it, every warehousing route would also force this group open.
        path: 'products',
        label: 'Products',
        icon: 'inventory_2',
        shortcut: 'g p',
        exact: true,
        children: [
            { path: 'products/new', label: 'Add product', shortcut: 'n p' },
            { path: 'products/collections', label: 'Collections' },
            { path: 'products/smart-collections', label: 'Smart collections', keywords: ['automated', 'rules', 'dynamic collection', 'conditions'] },
            { path: 'categories', label: 'Categories' },
            { path: 'export', label: 'Export and import', keywords: ['csv', 'import', 'export', 'bulk', 'migrate'] },
        ],
    },
    {
        // Stock control. The parent is the inventory page itself.
        path: 'products/inventory',
        label: 'Inventory',
        icon: 'warehouse',
        shortcut: 'g i',
        children: [
            { path: 'products/inventory-history', label: 'Inventory history', keywords: ['movements', 'ledger', 'adjustments', 'audit'] },
            { path: 'products/reservations', label: 'Reservations', keywords: ['reserved', 'hold', 'allocation'] },
            { path: 'products/locations', label: 'Locations', keywords: ['warehouse', 'location', 'stock location'] },
            { path: 'products/operations-dashboard', label: 'Operations dashboard', keywords: ['kpi', 'metrics', 'operations'] },
        ],
    },
    {
        // Procurement — a different persona and cadence from merchandising.
        path: 'products/purchase-orders',
        label: 'Purchasing',
        icon: 'local_shipping',
        children: [
            { path: 'products/transfers', label: 'Transfers' },
            { path: 'products/receipts', label: 'Receipts', keywords: ['receiving', 'received', 'receipt history'] },
            { path: 'products/suppliers', label: 'Vendors', keywords: ['supplier', 'vendor', 'purchasing'] },
        ],
    },
    {
        // Promoted out of Marketing: a customer is a first-class commerce noun
        // with its own detail route, not a marketing asset.
        path: 'customers',
        label: 'Customers',
        icon: 'group',
        shortcut: 'g c',
        children: [
            { path: 'customers/segments', label: 'Segments', keywords: ['segment', 'audience', 'filter', 'cohort'] },
        ],
    },
    {
        path: 'settings/billing',
        label: 'Money',
        icon: 'wallet',
        shortcut: 'g y',
        // No 'Billing' child: the group's own path IS billing, so listing it
        // again would render the same href twice and stop the parent linking.
        children: [
            { path: 'payouts', label: 'Payouts', keywords: ['payout', 'settlement'] },
            // Stored-value liability on the canonical ledger, not a catalog object.
            { path: 'products/gift-cards', label: 'Gift cards', keywords: ['gift card', 'store credit', 'voucher'] },
        ],
    },
    {
        path: 'coupons',
        label: 'Marketing',
        icon: 'marketing',
        shortcut: 'g m',
        // Parent lands on Discounts, so it is not repeated as a child.
        children: [
            { path: 'reviews', label: 'Reviews', shortcut: 'g r' },
            { path: 'marketing', label: 'Campaigns', keywords: ['email', 'campaign', 'newsletter', 'broadcast'] },
            { path: 'ai', label: 'AI Studio', keywords: ['ai', 'credits', 'copy', 'seo', 'generate'] },
        ],
    },
    {
        // Parent lands on Pages, so it is not repeated as a child.
        path: 'pages',
        label: 'Content',
        icon: 'content',
        exact: true,
        children: [
            { path: 'posts', label: 'Blog posts' },
            { path: 'comments', label: 'Comments' },
        ],
    },
    { path: 'analytics', label: 'Analytics', icon: 'bar_chart', shortcut: 'g a' },
    {
        path: 'online-store',
        label: 'Online Store',
        icon: 'storefront',
        shortcut: 'g t',
        section: 'sales',
        children: [
            { path: 'online-store/themes', label: 'Themes' },
            { path: 'online-store/pages', label: 'Store pages' },
            { path: 'online-store/preferences', label: 'Preferences' },
        ],
    },
    appsItem,
    settingsItem,
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
        'g i': 'products/inventory',
        'g c': 'customers',
        'g m': 'coupons',
        'g d': 'coupons',
        'g r': 'reviews',
        'g t': 'online-store/themes',
        'g y': 'settings/billing',
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
    const commands: MerchantCommandItem[] = getQuickActionCommands(siteType, store)

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

function getQuickActionCommands(siteType: string | null | undefined, store: string): MerchantCommandItem[] {
    if (normalizeSiteType(siteType) !== 'store') return []

    return [
        quickAction('Create product', 'add_circle', 'products/new', store, 'n p', [
            'create product',
            'new product',
            'add product',
            'product create',
        ]),
        quickAction('Find order', 'shopping_cart', 'orders', store, 'g o', [
            'find order',
            'search order',
            'lookup order',
            'order search',
            'order number',
        ]),
        quickAction('Find customer', 'group', 'customers', store, 'g c', [
            'find customer',
            'search customer',
            'lookup customer',
            'customer email',
        ]),
        quickAction('Update inventory', 'warehouse', 'products/inventory', store, 'g i', [
            'update inventory',
            'edit inventory',
            'stock',
            'stock count',
        ]),
        quickAction('Customize theme', 'palette', 'online-store/themes', store, 'g t', [
            'customize theme',
            'theme editor',
            'edit theme',
            'online store theme',
        ]),
        quickAction('Install app', 'extension', 'apps', store, 'g x', [
            'install app',
            'app marketplace',
            'find app',
            'embedded app',
        ]),
        quickAction('Review discounts', 'sell', 'coupons', store, 'g d', [
            'discount',
            'coupon',
            'promo code',
            'marketing offer',
        ]),
    ]
}

function quickAction(
    label: string,
    icon: string,
    path: string,
    store: string,
    shortcut: string,
    keywords: string[]
): MerchantCommandItem {
    return {
        label,
        icon,
        href: `/${store}/${path}`,
        section: 'Quick actions',
        pathHint: `/${path}`,
        shortcut,
        keywords: [label, path, shortcut, ...keywords].map((keyword) => keyword.toLowerCase()),
    }
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
