'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    Badge,
    Card,
    MaterialIcon,
    Page,
    PageHeader,
    Section,
} from '@letbuyy/ui'

const settingsGroups = [
    {
        title: 'Store setup',
        description: 'Identity, subscription, billing, and team access.',
        sections: [
            { href: 'general', label: 'General', description: 'Store name, handle, currency, language, and site type.', iconName: 'settings', badge: 'Core' },
            { href: 'plan', label: 'Plan', description: 'Current plan, upgrade options, and cancellation workflow.', iconName: 'rocket_launch', badge: 'Billing' },
            { href: 'billing', label: 'Billing', description: 'Invoices, billing profile, and subscription payment details.', iconName: 'receipt_long', badge: 'Billing' },
            { href: 'users', label: 'Users and permissions', description: 'Invite staff and manage access to the merchant workspace.', iconName: 'group', badge: 'Access' },
        ],
    },
    {
        title: 'Commerce operations',
        description: 'Checkout, payment acceptance, delivery, and tax configuration.',
        sections: [
            { href: 'payments', label: 'Payments', description: 'Configure Razorpay and verify masked provider settings.', iconName: 'payments', badge: 'Money' },
            { href: 'checkout', label: 'Checkout', description: 'Tune buyer checkout preferences and order conversion settings.', iconName: 'shopping_cart_checkout', badge: 'Orders' },
            { href: 'shipping', label: 'Shipping and delivery', description: 'Create zones, delivery rates, and fulfillment defaults.', iconName: 'local_shipping', badge: 'Orders' },
            { href: 'taxes', label: 'Taxes and duties', description: 'Manage tax rates, inclusive pricing, and regional duties.', iconName: 'request_quote', badge: 'Compliance' },
        ],
    },
    {
        title: 'Storefront trust',
        description: 'Domain, notifications, and legal content merchants need before launch.',
        sections: [
            { href: 'domains', label: 'Domains', description: 'Connect your LetBuyy subdomain and custom domain records.', iconName: 'language', badge: 'Launch' },
            { href: 'notifications', label: 'Notifications', description: 'Merchant and shopper email preferences for order events.', iconName: 'notifications', badge: 'Comms' },
            { href: 'policies', label: 'Policies', description: 'Publish privacy, refund, shipping, and terms policy pages.', iconName: 'policy', badge: 'Trust' },
        ],
    },
]

export default function SettingsPage() {
    const { store } = useParams<{ store: string }>()

    return (
        <Page>
            <PageHeader
                title="Settings"
                description="Configure the store controls that support launch, operations, billing, and customer trust."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Settings' }]}
                primaryAction={{ label: 'Open general settings', href: `/${store}/settings/general` }}
            />

            <Card>
                <Section
                    title="Launch checklist"
                    description="These are the settings merchants usually need before accepting real orders."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-4">
                        <ChecklistItem href={`/${store}/settings/payments`} icon="payments" title="Set up payments" />
                        <ChecklistItem href={`/${store}/settings/shipping`} icon="local_shipping" title="Review shipping" />
                        <ChecklistItem href={`/${store}/settings/domains`} icon="language" title="Connect domain" />
                        <ChecklistItem href={`/${store}/settings/policies`} icon="policy" title="Publish policies" />
                    </div>
                </Section>
            </Card>

            {settingsGroups.map((group) => (
                <Card key={group.title}>
                    <Section title={group.title} description={group.description}>
                        <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-2">
                            {group.sections.map((section) => (
                                <SettingsLink
                                    key={section.href}
                                    href={`/${store}/settings/${section.href}`}
                                    label={section.label}
                                    description={section.description}
                                    badge={section.badge}
                                    iconName={section.iconName}
                                />
                            ))}
                        </div>
                    </Section>
                </Card>
            ))}
        </Page>
    )
}

function ChecklistItem({
    href,
    icon,
    title,
}: {
    href: string
    icon: string
    title: string
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] text-[var(--lb-color-text)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                <MaterialIcon name={icon} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
            </span>
            <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)]">
                {title}
            </span>
        </Link>
    )
}

function SettingsLink({
    href,
    label,
    description,
    badge,
    iconName,
}: {
    href: string
    label: string
    description: string
    badge: string
    iconName: string
}) {
    return (
        <Link
            href={href}
            className="group flex min-h-[calc(var(--lb-size-control-lg)+var(--lb-space-7))] gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                <MaterialIcon name={iconName} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                    <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                        {label}
                    </span>
                    <Badge label={badge} variant="info" />
                </span>
                <span className="mt-[var(--lb-space-2)] block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {description}
                </span>
            </span>
            <MaterialIcon
                name="arrow_forward"
                className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-text-subdued)] transition-colors duration-[var(--lb-motion-fast)] group-hover:text-[var(--lb-color-text)]"
            />
        </Link>
    )
}
