'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import type { InstalledApp } from '@letbuyy/shared-types'
import {
    Badge,
    Banner,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    ExternalLink,
    Globe,
    MaterialIcon,
    Package,
    Puzzle,
    Section,
    ShieldCheck,
    Store,
    Trash2,
    useToast,
} from '@letbuyy/ui'

export type AppUninstallResult = {
    ok: boolean
    message: string
}

interface AppsSettingsContentProps {
    store: string
    installations: InstalledApp[]
    loadError: string | null
    uninstallAction: (appId: string) => Promise<AppUninstallResult>
}

const SALES_CHANNELS = [
    {
        key: 'online-store',
        title: 'Online Store',
        description: 'Native storefront, theme preview, cart, checkout, customer account, and policy routes.',
        status: 'Connected',
        icon: Store,
    },
    {
        key: 'app-marketplace',
        title: 'App Marketplace',
        description: 'Published marketplace apps can add embedded admin links, storefront blocks, and checkout extensions.',
        status: 'Available',
        icon: Puzzle,
    },
    {
        key: 'external-apps',
        title: 'External app access',
        description: 'Installed apps use scoped API access and lifecycle webhooks managed by the app-store gateway.',
        status: 'Scoped',
        icon: ShieldCheck,
    },
]

function appName(installation: InstalledApp) {
    return installation.marketplace_apps?.name || 'Installed app'
}

function appTagline(installation: InstalledApp) {
    return installation.marketplace_apps?.tagline || 'Embedded admin app'
}

function appInitial(installation: InstalledApp) {
    return appName(installation).trim().charAt(0).toUpperCase() || 'A'
}

function formatDate(value?: string | null) {
    if (!value) return 'Recently'
    return new Date(value).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

function formatStatus(value: string) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Active'
}

function formatScope(value: string) {
    return value.replace(/[.:_]/g, ' ')
}

export default function AppsSettingsContent({
    store,
    installations,
    loadError,
    uninstallAction,
}: AppsSettingsContentProps) {
    const { notify } = useToast()
    const [installedApps, setInstalledApps] = useState(installations)
    const [appToUninstall, setAppToUninstall] = useState<InstalledApp | null>(null)
    const [pendingAppId, setPendingAppId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const activeApps = useMemo(
        () => installedApps.filter((installation) => installation.status === 'active').length,
        [installedApps],
    )
    const totalScopes = useMemo(
        () => installedApps.reduce((count, installation) => count + installation.scopes_granted.length, 0),
        [installedApps],
    )
    const embeddedApps = useMemo(
        () => installedApps.filter((installation) => Boolean(installation.marketplace_apps?.app_url)).length,
        [installedApps],
    )

    const confirmUninstall = () => {
        if (!appToUninstall || pendingAppId) return

        const appId = appToUninstall.app_id
        const selectedName = appName(appToUninstall)
        setPendingAppId(appId)

        startTransition(() => {
            void uninstallAction(appId).then((result) => {
                if (result.ok) {
                    setInstalledApps((current) => current.filter((installation) => installation.app_id !== appId))
                    setAppToUninstall(null)
                    notify({
                        title: 'App uninstalled',
                        description: `${selectedName} was removed from this store.`,
                        variant: 'success',
                    })
                    return
                }

                notify({
                    title: 'App could not be uninstalled',
                    description: result.message,
                    variant: 'critical',
                })
            }).finally(() => {
                setPendingAppId(null)
            })
        })
    }

    return (
        <>
            {loadError && (
                <Banner variant="critical" title="Installed apps could not load">
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card className="p-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <Puzzle className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                        <div>
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Installed apps</p>
                            <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{installedApps.length}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <ShieldCheck className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                        <div>
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Active apps</p>
                            <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{activeApps}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <Globe className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                        <div>
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Granted scopes</p>
                            <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{totalScopes}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <Section
                    title="Installed apps"
                    description="Apps installed on this store through the LetBuyy app marketplace."
                    action={<Badge label={`${installedApps.length} installed`} variant={installedApps.length > 0 ? 'success' : 'default'} />}
                >
                    {installedApps.length > 0 ? (
                        <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                            {installedApps.map((installation) => {
                                const name = appName(installation)
                                const scopes = installation.scopes_granted.slice(0, 3)
                                const remainingScopes = Math.max(installation.scopes_granted.length - scopes.length, 0)
                                const busy = pendingAppId === installation.app_id || isPending

                                return (
                                    <div key={installation.id} className="grid gap-[var(--lb-space-4)] p-[var(--lb-space-4)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                        <div className="flex min-w-0 gap-[var(--lb-space-3)]">
                                            <div className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                                <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">{appInitial(installation)}</span>
                                            </div>
                                            <div className="min-w-0 space-y-[var(--lb-space-2)]">
                                                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                    <h2 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                        {name}
                                                    </h2>
                                                    <Badge label={formatStatus(installation.status)} variant={installation.status === 'active' ? 'success' : 'warning'} />
                                                    <Badge label={installation.marketplace_apps?.pricing_model || 'App'} variant="info" />
                                                </div>
                                                <p className="m-0 text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                                                    {appTagline(installation)}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    <Package className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    <span>Installed {formatDate(installation.installed_at)}</span>
                                                    {scopes.map((scope) => (
                                                        <Badge key={scope} label={formatScope(scope)} variant="default" />
                                                    ))}
                                                    {remainingScopes > 0 && <Badge label={`+${remainingScopes} more`} variant="default" />}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)] lg:justify-end">
                                            <Link
                                                href={`/${store}/apps/${installation.id}`}
                                                className="inline-flex h-[var(--lb-density-icon-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-transparent px-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lb-color-bg)]"
                                            >
                                                <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                Open
                                            </Link>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setAppToUninstall(installation)}
                                                disabled={busy}
                                            >
                                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                Uninstall
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <EmptyState
                            icon={<MaterialIcon name="extension_off" className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)]" />}
                            title="No apps installed"
                            body="Install apps from the marketplace to add embedded workflows, storefront blocks, checkout extensions, and automation to this store."
                            primaryAction={(
                                <a
                                    href="https://apps.letbuyy.store"
                                    className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-button-primary-text)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-component-button-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    <Puzzle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Browse marketplace
                                </a>
                            )}
                        />
                    )}
                </Section>
            </Card>

            <Card>
                <Section
                    title="Sales channels"
                    description="Channels and extension surfaces that can reach this store."
                    action={<Badge label={`${embeddedApps} embedded apps`} variant={embeddedApps > 0 ? 'info' : 'default'} />}
                >
                    <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-3">
                        {SALES_CHANNELS.map((channel) => {
                            const Icon = channel.icon

                            return (
                                <div key={channel.key} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                    <div className="mb-[var(--lb-space-3)] flex items-center justify-between gap-[var(--lb-space-3)]">
                                        <Icon className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                                        <Badge label={channel.status} variant={channel.status === 'Connected' ? 'success' : 'info'} />
                                    </div>
                                    <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">{channel.title}</h3>
                                    <p className="mb-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                                        {channel.description}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </Section>
            </Card>

            <Banner variant="warning" title="Uninstall data-loss note">
                Uninstalling an app revokes its store API access, disables embedded app entry points, and can stop app-owned webhook or storefront behavior. Data stored by the app outside LetBuyy may need recovery through the app developer.
            </Banner>

            <ConfirmDialog
                open={Boolean(appToUninstall)}
                title="Uninstall app?"
                description={appToUninstall ? `Uninstall ${appName(appToUninstall)} from this store. This revokes app access and can stop embedded workflows, storefront blocks, checkout extensions, and app webhooks.` : 'Uninstall this app from the store.'}
                confirmLabel={pendingAppId ? 'Uninstalling' : 'Uninstall app'}
                destructive
                onConfirm={confirmUninstall}
                onClose={() => {
                    if (!pendingAppId) setAppToUninstall(null)
                }}
            />
        </>
    )
}
