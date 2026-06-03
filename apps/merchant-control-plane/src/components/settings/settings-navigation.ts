import type { MaterialIconName } from '@letbuyy/ui'

export type SettingsItemStatus = 'ready' | 'planned' | 'needs-backend'

export interface SettingsIndexItem {
    key: string
    label: string
    description: string
    path: string
    icon: MaterialIconName
    status: SettingsItemStatus
    badge?: string
    query?: string
}

export interface SettingsIndexGroup {
    label: string
    items: SettingsIndexItem[]
}

export const settingsIndexGroups: SettingsIndexGroup[] = [
    {
        label: 'Store',
        items: [
            {
                key: 'overview',
                label: 'Overview',
                description: 'Launch readiness, defaults, and the main settings map.',
                path: '',
                icon: 'settings',
                status: 'ready',
            },
            {
                key: 'general',
                label: 'General',
                description: 'Store name, contact details, currency, locale, and deletion controls.',
                path: 'general',
                icon: 'storefront',
                status: 'ready',
            },
            {
                key: 'business',
                label: 'Business details',
                description: 'Legal entity, GSTIN, and billing address fields.',
                path: 'business',
                icon: 'work',
                status: 'needs-backend',
                badge: 'Needs backend',
            },
        ],
    },
    {
        label: 'Plan & Billing',
        items: [
            {
                key: 'plan',
                label: 'Plan',
                description: 'Current plan, upgrade options, and cancellation workflow.',
                path: 'plan',
                icon: 'plan',
                status: 'ready',
                badge: 'Ends in 14 days',
            },
            {
                key: 'billing',
                label: 'Billing',
                description: 'Invoices, billing profile, and subscription payment details.',
                path: 'billing',
                icon: 'receipt_long',
                status: 'ready',
            },
            {
                key: 'subscribe-checkout',
                label: 'Subscribe checkout',
                description: 'Plan checkout flow through the existing Razorpay subscription contract.',
                path: 'subscribe/checkout',
                query: 'plan=starter&bp=MONTHLY&site_type=store',
                icon: 'credit_card',
                status: 'ready',
                badge: 'Flow',
            },
        ],
    },
    {
        label: 'Users & Permissions',
        items: [
            {
                key: 'users',
                label: 'Users',
                description: 'Invite staff and manage workspace roles.',
                path: 'users',
                icon: 'manage_accounts',
                status: 'ready',
            },
            {
                key: 'security',
                label: 'Security',
                description: '2FA, passkeys, recovery codes, and account security controls.',
                path: 'security',
                icon: 'shield_lock',
                status: 'needs-backend',
                badge: 'Needs backend',
            },
        ],
    },
    {
        label: 'Payments',
        items: [
            {
                key: 'payments',
                label: 'Payments',
                description: 'Razorpay, COD, Cashfree, UPI, and provider account settings.',
                path: 'payments',
                icon: 'payments',
                status: 'ready',
            },
        ],
    },
    {
        label: 'Checkout',
        items: [
            {
                key: 'checkout',
                label: 'Checkout',
                description: 'Checkout branding, buyer options, and order conversion controls.',
                path: 'checkout',
                icon: 'shopping_cart_checkout',
                status: 'ready',
            },
        ],
    },
    {
        label: 'Shipping & Delivery',
        items: [
            {
                key: 'shipping',
                label: 'Shipping and delivery',
                description: 'Shipping zones, delivery rates, and fulfillment defaults.',
                path: 'shipping',
                icon: 'local_shipping',
                status: 'ready',
            },
        ],
    },
    {
        label: 'Taxes & Duties',
        items: [
            {
                key: 'taxes',
                label: 'Taxes and duties',
                description: 'GST, inclusive pricing, and regional tax rates.',
                path: 'taxes',
                icon: 'request_quote',
                status: 'ready',
            },
        ],
    },
    {
        label: 'Domains',
        items: [
            {
                key: 'domains',
                label: 'Domains',
                description: 'Primary domain, LetBuyy subdomain, and custom-domain setup.',
                path: 'domains',
                icon: 'domains',
                status: 'ready',
            },
        ],
    },
    {
        label: 'Notifications',
        items: [
            {
                key: 'notifications',
                label: 'Notifications',
                description: 'Merchant alerts and shopper email preferences.',
                path: 'notifications',
                icon: 'notifications',
                status: 'ready',
            },
        ],
    },
    {
        label: 'Languages',
        items: [
            {
                key: 'localization',
                label: 'Languages',
                description: 'Storefront languages, default locale, and market-specific copy.',
                path: 'localization',
                icon: 'language',
                status: 'needs-backend',
                badge: 'Needs backend',
            },
        ],
    },
    {
        label: 'Policies',
        items: [
            {
                key: 'policies',
                label: 'Policies',
                description: 'Privacy, refund, shipping, and terms policy pages.',
                path: 'policies',
                icon: 'policy',
                status: 'ready',
            },
        ],
    },
    {
        label: 'Apps & Channels',
        items: [
            {
                key: 'apps',
                label: 'Apps and sales channels',
                description: 'Installed apps, channels, app data access, and uninstall actions.',
                path: 'apps',
                icon: 'extension',
                status: 'needs-backend',
                badge: 'Needs backend',
            },
        ],
    },
    {
        label: 'Custom Data',
        items: [
            {
                key: 'custom-data',
                label: 'Custom data',
                description: 'Metafields, metaobjects, and content model extensions.',
                path: 'custom-data',
                icon: 'deployed_code',
                status: 'needs-backend',
                badge: 'Needs backend',
            },
        ],
    },
]

export function getSettingsItemHref(store: string, item: SettingsIndexItem) {
    const base = item.path ? `/${store}/settings/${item.path}` : `/${store}/settings`
    return item.query ? `${base}?${item.query}` : base
}

export function getSettingsItemPath(store: string, item: SettingsIndexItem) {
    return item.path ? `/${store}/settings/${item.path}` : `/${store}/settings`
}

export function getSettingsReadyItems() {
    return settingsIndexGroups.flatMap((group) => group.items.filter((item) => item.status === 'ready'))
}
