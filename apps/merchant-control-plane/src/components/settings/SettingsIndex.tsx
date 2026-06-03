'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Badge, MaterialIcon } from '@letbuyy/ui'
import {
    getSettingsItemHref,
    getSettingsItemPath,
    settingsIndexGroups,
    type SettingsIndexGroup,
    type SettingsIndexItem,
} from './settings-navigation'

interface SettingsIndexProps {
    store: string
    storeName: string
    subdomain: string
    userName: string
    userEmail: string
}

function itemMatchesQuery(item: SettingsIndexItem, query: string) {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return true
    return `${item.label} ${item.description} ${item.badge || ''}`.toLowerCase().includes(normalized)
}

function isActiveItem(pathname: string | null, store: string, item: SettingsIndexItem) {
    const itemPath = getSettingsItemPath(store, item)
    if (!pathname) return false
    if (item.path === '') return pathname === itemPath
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

function filterGroups(query: string): SettingsIndexGroup[] {
    return settingsIndexGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => itemMatchesQuery(item, query)),
        }))
        .filter((group) => group.items.length > 0)
}

export function SettingsIndex({ store, storeName, subdomain, userName, userEmail }: SettingsIndexProps) {
    const pathname = usePathname()
    const [query, setQuery] = useState('')
    const filteredGroups = useMemo(() => filterGroups(query), [query])
    const userInitial = (userName || userEmail || 'U').charAt(0).toUpperCase()
    const storeInitial = (storeName || store || 'S').charAt(0).toUpperCase()

    return (
        <aside className="flex max-h-none min-h-0 flex-col rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] shadow-[var(--lb-component-card-shadow)] lg:sticky lg:top-[var(--lb-space-4)] lg:max-h-[calc(100vh-var(--lb-space-8))]">
            <div className="flex items-center gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                <span className="inline-flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary)] text-[color:var(--lb-color-primary-cta-text)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)]">
                    {storeInitial}
                </span>
                <span className="min-w-0">
                    <strong className="block truncate text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">{storeName}</strong>
                    <span className="block truncate text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{subdomain}.letbuyy.store</span>
                </span>
            </div>

            <label className="relative m-[var(--lb-space-3)] block" htmlFor="settings-index-search">
                <span className="sr-only">Search settings</span>
                <MaterialIcon
                    name="search"
                    className="pointer-events-none absolute left-[var(--lb-space-3)] top-1/2 h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] -translate-y-1/2 text-[color:var(--lb-color-text-subdued)]"
                />
                <input
                    id="settings-index-search"
                    className="h-[var(--lb-density-input-height)] w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] pl-[calc(var(--lb-space-3)+var(--lb-size-icon-inline)+var(--lb-space-2))] pr-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-input-text)] placeholder:text-[color:var(--lb-color-text-subdued)] focus-visible:border-[var(--lb-component-input-focus-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-component-input-focus-ring)]"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search settings"
                />
            </label>

            <nav className="min-h-0 flex-1 space-y-[var(--lb-space-4)] overflow-y-auto px-[var(--lb-space-3)] pb-[var(--lb-space-4)]" aria-label="Settings sections">
                {filteredGroups.length === 0 ? (
                    <p className="rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] p-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        No settings match &quot;{query}&quot;.
                    </p>
                ) : (
                    filteredGroups.map((group) => (
                        <div key={group.label} className="space-y-[var(--lb-space-1)]">
                            <h2 className="px-[var(--lb-space-2)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-badge)] tracking-[0] text-[color:var(--lb-color-text-subdued)]">
                                {group.label}
                            </h2>
                            <div className="space-y-[var(--lb-space-1)]">
                                {group.items.map((item) => (
                                    <SettingsIndexRow
                                        key={item.key}
                                        item={item}
                                        store={store}
                                        active={isActiveItem(pathname, store, item)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </nav>

            <div className="flex items-center gap-[var(--lb-space-3)] border-t border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)]">
                    {userInitial}
                </span>
                <span className="min-w-0">
                    <strong className="block truncate text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text)]">{userName || 'User'}</strong>
                    <span className="block truncate text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{userEmail}</span>
                </span>
            </div>
        </aside>
    )
}

function SettingsIndexRow({
    item,
    store,
    active,
}: {
    item: SettingsIndexItem
    store: string
    active: boolean
}) {
    const className = [
        'group flex min-h-[var(--lb-size-control-lg)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-2)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)]',
        active
            ? 'bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-text)]'
            : 'text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
        item.status === 'ready' ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]' : 'cursor-not-allowed opacity-70',
    ].join(' ')

    const content = (
        <>
            <MaterialIcon name={item.icon} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[color:var(--lb-color-text-subdued)]" />
            <span className="min-w-0 flex-1">
                <span className="block truncate font-[var(--lb-font-weight-medium)]">{item.label}</span>
                <span className="sr-only">{item.description}</span>
            </span>
            {item.badge && <Badge label={item.badge} variant={item.status === 'ready' ? 'info' : 'warning'} className="max-w-[7.5rem] truncate" />}
            {item.status === 'ready' ? (
                <MaterialIcon name="chevron_right" className="hidden h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[color:var(--lb-color-text-subdued)] group-hover:block" />
            ) : null}
        </>
    )

    if (item.status !== 'ready') {
        return (
            <span className={className} aria-disabled="true">
                {content}
            </span>
        )
    }

    return (
        <Link href={getSettingsItemHref(store, item)} className={className} aria-current={active ? 'page' : undefined}>
            {content}
        </Link>
    )
}
