'use client'

import Link from 'next/link'
import { Badge, Settings } from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import type { SettingsNavGroup, SettingsNavItem } from './settings-navigation'

interface SettingsIndexProps {
    store: string
    groups: SettingsNavGroup[]
    activePathname: string | null
    onNavigate?: () => void
}

function statusLabel(item: SettingsNavItem) {
    if (item.status === 'backend-needed') return 'Needs backend'
    if (item.status === 'handoff') return 'Handoff'
    return null
}

export function SettingsIndex({ store, groups, activePathname, onNavigate }: SettingsIndexProps) {
    const hasResults = groups.some((group) => group.items.length > 0)
    const settingsHomeHref = `/${store}/settings`
    const homeActive = activePathname === settingsHomeHref

    if (!hasResults) {
        return (
            <EmptyState scene="settings-search"
                icon={<Settings className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                title="No settings found"
                body="Try a different search term or clear the search to see every setting."
            />
        )
    }

    return (
        <nav className="flex flex-col gap-[var(--lb-space-5)]" aria-label="Settings">
            <Link prefetch={false}
                href={settingsHomeHref}
                onClick={onNavigate}
                aria-current={homeActive ? 'page' : undefined}
                className={[
                    'flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-3)] transition-colors duration-[var(--lb-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                    homeActive
                        ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]'
                        : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
                ].join(' ')}
            >
                <Settings className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                    <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">
                        Settings home
                    </span>
                    <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Opening checklist and grouped settings overview.
                    </span>
                </span>
            </Link>

            {groups.map((group) => (
                group.items.length > 0 && (
                    <section key={group.title} className="flex flex-col gap-[var(--lb-space-2)]">
                        <h2 className="m-0 px-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {group.title}
                        </h2>
                        <div className="flex flex-col gap-[var(--lb-space-1)]">
                            {group.items.map((item) => {
                                const href = `/${store}/settings/${item.href}`
                                const active = activePathname === href || activePathname?.startsWith(`${href}/`)
                                const ItemIcon = item.Icon
                                const label = statusLabel(item)

                                return (
                                    <Link prefetch={false}
                                        key={item.href}
                                        href={href}
                                        onClick={onNavigate}
                                        aria-current={active ? 'page' : undefined}
                                        className={[
                                            'group flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] transition-colors duration-[var(--lb-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                            active
                                                ? 'bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]'
                                                : 'text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
                                        ].join(' ')}
                                    >
                                        <ItemIcon className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0" aria-hidden="true" />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">
                                                    {item.label}
                                                </span>
                                                {label && <Badge label={label} variant={item.status === 'backend-needed' ? 'warning' : 'info'} />}
                                            </span>
                                            <span className="mt-[var(--lb-space-1)] block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {item.description}
                                            </span>
                                        </span>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>
                )
            ))}
        </nav>
    )
}
