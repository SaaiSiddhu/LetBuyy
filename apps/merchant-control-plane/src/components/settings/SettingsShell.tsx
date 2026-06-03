'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
    Avatar,
    Button,
    Menu,
    Store,
    X,
} from '@letbuyy/ui'
import { SettingsIndex } from './SettingsIndex'
import { SettingsSearch } from './SettingsSearch'
import {
    SETTINGS_NAV_GROUPS,
    getSettingsItemByPath,
} from './settings-navigation'

interface SettingsShellProps {
    store: string
    storeName: string
    subdomain: string
    userName: string
    userEmail: string
    children: React.ReactNode
}

function normalizeSearch(value: string) {
    return value.trim().toLowerCase()
}

function itemMatches(query: string, groupTitle: string, itemText: string[]) {
    if (!query) return true
    const haystack = [groupTitle, ...itemText].join(' ').toLowerCase()
    return haystack.includes(query)
}

export function SettingsShell({
    store,
    storeName,
    subdomain,
    userName,
    userEmail,
    children,
}: SettingsShellProps) {
    const pathname = usePathname()
    const [query, setQuery] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const normalizedQuery = normalizeSearch(query)
    const activeItem = getSettingsItemByPath(pathname, store)

    const filteredGroups = useMemo(() => SETTINGS_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => itemMatches(normalizedQuery, group.title, [
            item.label,
            item.description,
            ...item.keywords,
        ])),
    })), [normalizedQuery])

    const resultCount = useMemo(
        () => filteredGroups.reduce((total, group) => total + group.items.length, 0),
        [filteredGroups],
    )

    const settingsIndex = (
        <div className="flex h-full flex-col gap-[var(--lb-space-5)]">
            <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
                <div className="flex items-start gap-[var(--lb-space-3)]">
                    <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                        <Store className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {storeName}
                        </p>
                        <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {subdomain}.letbuyy.store
                        </p>
                    </div>
                </div>
            </div>

            <SettingsSearch value={query} onChange={setQuery} resultCount={resultCount} />

            <div className="min-h-0 flex-1 overflow-auto pr-[var(--lb-space-1)]">
                <SettingsIndex
                    store={store}
                    groups={filteredGroups}
                    activePathname={pathname}
                    onNavigate={() => setDrawerOpen(false)}
                />
            </div>

            <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)]">
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <Avatar name={userName || userEmail || 'User'} size="sm" />
                    <div className="min-w-0">
                        <p className="m-0 truncate text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]">
                            {userName || 'User'}
                        </p>
                        <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {userEmail}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-[calc(100vh-var(--lb-space-7))] bg-[var(--lb-color-bg)] text-[var(--lb-color-text)]">
            <div className="border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-4)] py-[var(--lb-space-3)] lg:hidden">
                <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                    <div className="min-w-0">
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            Settings
                        </p>
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {activeItem?.label || 'Settings home'}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setDrawerOpen(true)}
                        aria-expanded={drawerOpen}
                        aria-controls="settings-mobile-drawer"
                    >
                        <Menu className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Index
                    </Button>
                </div>
            </div>

            <div className="grid min-h-[calc(100vh-var(--lb-space-7))] lg:grid-cols-[360px_minmax(0,1fr)]">
                <aside className="sticky top-[var(--lb-space-7)] hidden h-[calc(100vh-var(--lb-space-7))] overflow-hidden border-r border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)] lg:block">
                    {settingsIndex}
                </aside>

                <section className="min-w-0" aria-label={activeItem?.label || 'Settings home'}>
                    {children}
                </section>
            </div>

            {drawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
                    <button
                        type="button"
                        className="absolute inset-0 bg-[var(--lb-color-overlay)]"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close settings index"
                    />
                    <aside
                        id="settings-mobile-drawer"
                        className="relative z-10 flex h-full w-[min(380px,calc(100vw-var(--lb-space-5)))] flex-col overflow-hidden border-r border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] shadow-[var(--lb-shadow-lg)]"
                        aria-label="Settings index"
                    >
                        <div className="mb-[var(--lb-space-4)] flex items-center justify-between gap-[var(--lb-space-3)]">
                            <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                Settings
                            </h2>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close settings index"
                            >
                                <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </Button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden">
                            {settingsIndex}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    )
}
