import type { LucideIcon } from '@letbuyy/ui'
import {
    AppWindow,
    Bell,
    CreditCard,
    FileJson,
    FileText,
    Globe,
    IndianRupee,
    Rocket,
    Settings,
    ShieldCheck,
    ShoppingCart,
    Store,
    Tag,
    Truck,
    Users,
} from '@letbuyy/ui'

export interface SettingsNavItem {
    href: string
    label: string
    description: string
    keywords: string[]
    Icon: LucideIcon
    status?: 'available' | 'backend-needed' | 'handoff'
}

export interface SettingsNavGroup {
    title: string
    items: SettingsNavItem[]
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
    {
        title: 'Store',
        items: [
            {
                href: 'general',
                label: 'Store details',
                description: 'Name, store handle, description, currency, and locale.',
                keywords: ['general', 'store', 'details', 'currency', 'locale', 'language'],
                Icon: Settings,
            },
            {
                href: 'business',
                label: 'Business details',
                description: 'Legal entity, GSTIN, and billing address.',
                keywords: ['business', 'legal', 'gst', 'gstin', 'address'],
                Icon: Store,
                status: 'backend-needed',
            },
            {
                href: 'localization',
                label: 'Languages and localization',
                description: 'Store languages, default locale, and regional formatting.',
                keywords: ['languages', 'localization', 'locale', 'translation', 'markets'],
                Icon: Globe,
                status: 'backend-needed',
            },
        ],
    },
    {
        title: 'Plan and billing',
        items: [
            {
                href: 'plan',
                label: 'Plan',
                description: 'Subscription status, trial timing, and plan comparison.',
                keywords: ['plan', 'subscription', 'trial', 'upgrade'],
                Icon: Rocket,
            },
            {
                href: 'billing',
                label: 'Billing',
                description: 'Invoices, payment method, and billing history.',
                keywords: ['billing', 'invoice', 'charges', 'payment method'],
                Icon: CreditCard,
            },
            {
                href: 'subscribe/checkout',
                label: 'Subscribe checkout',
                description: 'Razorpay plan checkout and activation flow.',
                keywords: ['subscribe', 'checkout', 'razorpay', 'plan checkout'],
                Icon: CreditCard,
            },
        ],
    },
    {
        title: 'Users and permissions',
        items: [
            {
                href: 'users',
                label: 'Users and permissions',
                description: 'Invite staff and control access roles.',
                keywords: ['users', 'permissions', 'staff', 'roles', 'invite'],
                Icon: Users,
            },
            {
                href: 'security',
                label: 'Security',
                description: '2FA, passkeys, and recovery code readiness.',
                keywords: ['security', '2fa', 'mfa', 'passkeys', 'recovery'],
                Icon: ShieldCheck,
                status: 'backend-needed',
            },
        ],
    },
    {
        title: 'Commerce operations',
        items: [
            {
                href: 'payments',
                label: 'Payments',
                description: 'Razorpay, Cash on Delivery, and provider status.',
                keywords: ['payments', 'razorpay', 'cod', 'upi', 'cashfree'],
                Icon: IndianRupee,
            },
            {
                href: 'checkout',
                label: 'Checkout',
                description: 'Customer account, contact, and form options.',
                keywords: ['checkout', 'customer accounts', 'order notes', 'tips'],
                Icon: ShoppingCart,
            },
            {
                href: 'shipping',
                label: 'Shipping and delivery',
                description: 'Delivery zones, countries, and rate coverage.',
                keywords: ['shipping', 'delivery', 'zones', 'rates', 'fulfillment'],
                Icon: Truck,
            },
            {
                href: 'taxes',
                label: 'Taxes and duties',
                description: 'GST, regional tax rates, and inclusive pricing.',
                keywords: ['taxes', 'duties', 'gst', 'hsn', 'inclusive pricing'],
                Icon: Tag,
            },
        ],
    },
    {
        title: 'Storefront trust',
        items: [
            {
                href: 'domains',
                label: 'Domains',
                description: 'LetBuyy subdomain and custom domain setup.',
                keywords: ['domains', 'custom domain', 'dns', 'cname'],
                Icon: Globe,
            },
            {
                href: 'notifications',
                label: 'Notifications',
                description: 'Staff alerts and customer transactional emails.',
                keywords: ['notifications', 'emails', 'alerts', 'templates'],
                Icon: Bell,
            },
            {
                href: 'policies',
                label: 'Policies',
                description: 'Refund, privacy, terms, and shipping policies.',
                keywords: ['policies', 'legal', 'refund', 'privacy', 'terms'],
                Icon: FileText,
            },
        ],
    },
    {
        title: 'Extensions',
        items: [
            {
                href: 'apps',
                label: 'Apps and sales channels',
                description: 'Installed apps, channel readiness, and marketplace handoff.',
                keywords: ['apps', 'sales channels', 'marketplace', 'extensions'],
                Icon: AppWindow,
            },
            {
                href: 'custom-data',
                label: 'Custom data',
                description: 'Metafields and metaobjects for custom storefront data.',
                keywords: ['custom data', 'metafields', 'metaobjects', 'schema'],
                Icon: FileJson,
                status: 'backend-needed',
            },
        ],
    },
]

export const SETTINGS_NAV_ITEMS = SETTINGS_NAV_GROUPS.flatMap((group) => group.items)

export function getSettingsItemByPath(pathname: string | null | undefined, store: string) {
    if (!pathname) return null
    return SETTINGS_NAV_ITEMS.find((item) => {
        const href = `/${store}/settings/${item.href}`
        return pathname === href || pathname.startsWith(`${href}/`)
    }) ?? null
}
