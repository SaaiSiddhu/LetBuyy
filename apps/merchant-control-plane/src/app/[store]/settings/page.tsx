'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    Badge,
    Card,
    Section,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import {
    SETTINGS_NAV_GROUPS,
    SETTINGS_NAV_ITEMS,
    type SettingsNavItem,
} from '@/components/settings/settings-navigation'

const launchChecklist = ['payments', 'shipping', 'domains', 'policies']

function getStatusLabel(status: SettingsNavItem['status']) {
    if (status === 'backend-needed') return 'Needs backend'
    if (status === 'handoff') return 'Handoff'
    return 'Ready'
}

export default function SettingsPage() {
    const { store } = useParams<{ store: string }>()
    const checklistItems = launchChecklist
        .map((href) => SETTINGS_NAV_ITEMS.find((item) => item.href === href))
        .filter((item): item is SettingsNavItem => Boolean(item))

    return (
        <SettingsPane
            title="Settings"
            description="Configure the store controls that support launch, operations, billing, and customer trust."
            store={store}
            breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Settings' }]}
            primaryAction={{ label: 'Open general settings', href: `/${store}/settings/general` }}
        >
            <Card>
                <Section
                    title="Launch checklist"
                    description="These are the settings merchants usually need before accepting real orders."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-4">
                        {checklistItems.map((item) => (
                            <ChecklistItem
                                key={item.href}
                                href={`/${store}/settings/${item.href}`}
                                item={item}
                            />
                        ))}
                    </div>
                </Section>
            </Card>

            {SETTINGS_NAV_GROUPS.map((group) => (
                <Card key={group.title}>
                    <Section title={group.title}>
                        <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-2">
                            {group.items.map((item) => (
                                <SettingsLink
                                    key={item.href}
                                    href={`/${store}/settings/${item.href}`}
                                    item={item}
                                />
                            ))}
                        </div>
                    </Section>
                </Card>
            ))}
        </SettingsPane>
    )
}

function ChecklistItem({
    href,
    item,
}: {
    href: string
    item: SettingsNavItem
}) {
    const Icon = item.Icon

    return (
        <Link
            href={href}
            className="flex items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] text-[var(--lb-color-text)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
            </span>
            <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)]">
                {item.label}
            </span>
        </Link>
    )
}

function SettingsLink({
    href,
    item,
}: {
    href: string
    item: SettingsNavItem
}) {
    const Icon = item.Icon
    const badgeVariant = item.status === 'backend-needed' ? 'warning' : 'info'

    return (
        <Link
            href={href}
            className="group flex min-h-[calc(var(--lb-size-control-lg)+var(--lb-space-7))] gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                    <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                        {item.label}
                    </span>
                    <Badge label={getStatusLabel(item.status)} variant={badgeVariant} />
                </span>
                <span className="mt-[var(--lb-space-2)] block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {item.description}
                </span>
            </span>
            <span className="mt-[var(--lb-space-1)] shrink-0 text-[var(--lb-color-text-subdued)] transition-colors duration-[var(--lb-motion-fast)] group-hover:text-[var(--lb-color-text)]">
                &rarr;
            </span>
        </Link>
    )
}
