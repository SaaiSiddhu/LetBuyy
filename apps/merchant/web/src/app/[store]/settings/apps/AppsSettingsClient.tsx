'use client'

import { useMemo, useState, useTransition } from 'react'
import type { InstalledApp } from '@letbuyy/shared-types'
import { Button,
    AppWindow,
    Badge,
    Banner,
    Card,
    ConfirmDialog,
    EmptyState,
    ExternalLink,
    Section,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface AppsSettingsClientProps {
    store: string
    installedApps: unknown
    onUninstall: (appId: string) => Promise<{ ok: boolean; message: string }>
}

const APP_MARKETPLACE_URL = 'https://apps.letbuyy.com'

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback
}

function readOptionalString(value: unknown) {
    const text = readString(value).trim()
    return text || null
}

function appName(app: InstalledApp) {
    return app.marketplace_apps?.name || app.app_id
}

function appScopes(app: InstalledApp) {
    return Array.isArray(app.scopes_granted) ? app.scopes_granted : []
}

function safeExternalUrl(value?: string | null) {
    if (!value) return null

    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
    } catch {
        return null
    }
}

function appLaunchUrl(app: InstalledApp) {
    return safeExternalUrl(app.marketplace_apps?.app_url)
}

function normalizeMarketplaceApp(value: unknown, appId: string): InstalledApp['marketplace_apps'] {
    if (!isRecord(value)) return null

    return {
        id: readString(value.id, appId),
        name: readString(value.name, appId),
        slug: readOptionalString(value.slug),
        icon_url: readOptionalString(value.icon_url),
        tagline: readOptionalString(value.tagline),
        pricing_model: readOptionalString(value.pricing_model),
        app_url: readOptionalString(value.app_url),
    }
}

function normalizeInstalledApps(value: unknown): InstalledApp[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((app) => {
        if (!isRecord(app) || typeof app.id !== 'string' || !app.id || typeof app.app_id !== 'string' || !app.app_id) return []

        return [{
            id: app.id,
            app_id: app.app_id,
            store_id: readString(app.store_id),
            status: readString(app.status, 'active'),
            scopes_granted: Array.isArray(app.scopes_granted)
                ? app.scopes_granted.filter((scope): scope is string => typeof scope === 'string' && scope.trim().length > 0)
                : [],
            config: isRecord(app.config) ? app.config : {},
            installed_at: readOptionalString(app.installed_at),
            uninstalled_at: readOptionalString(app.uninstalled_at),
            marketplace_apps: normalizeMarketplaceApp(app.marketplace_apps, app.app_id),
        }]
    })
}

export function AppsSettingsClient({ store, installedApps, onUninstall }: AppsSettingsClientProps) {
    const { notify } = useToast()
    const [apps, setApps] = useState(() => normalizeInstalledApps(installedApps))
    const [pendingApp, setPendingApp] = useState<InstalledApp | null>(null)
    const [isPending, startTransition] = useTransition()

    const activeCount = useMemo(
        () => apps.filter((app) => app.status !== 'uninstalled').length,
        [apps],
    )

    const uninstall = () => {
        if (!pendingApp) return
        const app = pendingApp

        startTransition(async () => {
            const result = await onUninstall(app.app_id)

            if (result.ok) {
                setApps((current) => current.filter((item) => item.id !== app.id))
                setPendingApp(null)
                notify({
                    title: 'App uninstalled',
                    description: `${appName(app)} no longer has access to this store.`,
                    variant: 'success',
                })
                return
            }

            notify({
                title: 'Could not uninstall app',
                description: result.message,
                variant: 'critical',
            })
        })
    }

    return (
        <SettingsPane
            store={store}
            title="Apps and sales channels"
            description="Review installed apps and sales channel access for this store."
            guidance={{
                title: 'Installed apps use scoped access',
                body: 'Uninstalling an app removes its active access token and can stop embedded app surfaces, automation, and storefront extensions.',
                variant: 'info',
            }}
            primaryAction={{
                label: 'Browse app marketplace',
                href: APP_MARKETPLACE_URL,
                icon: <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            }}
        >
            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card className="p-[var(--lb-space-4)]">
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Installed apps
                    </p>
                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                        {apps.length}
                    </p>
                </Card>
                <Card className="p-[var(--lb-space-4)]">
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Active access
                    </p>
                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                        {activeCount}
                    </p>
                </Card>
                <Card className="p-[var(--lb-space-4)]">
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Sales channels
                    </p>
                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                        {apps.filter((app) => appLaunchUrl(app)).length}
                    </p>
                </Card>
            </div>

            <Card>
                <Section
                    title="Installed apps"
                    description="Apps listed here are installed through the existing app-store gateway installation contract."
                >
                    {apps.length === 0 ? (
                        <EmptyState
                            icon={<AppWindow className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No apps installed"
                            body="Install apps from the marketplace when you are ready to add channels, automations, or embedded merchant tools."
                            primaryAction={(
                                <Button
                                    as="a"
                                    variant="primary"
                                    href={APP_MARKETPLACE_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Browse app marketplace
                                </Button>
                            )}
                        />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                            {apps.map((app) => {
                                const launchUrl = appLaunchUrl(app)

                                return (
                                    <div key={app.id} className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-4)] lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0 space-y-[var(--lb-space-2)]">
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                    {appName(app)}
                                                </h3>
                                                <Badge label={app.status} variant={app.status === 'active' ? 'success' : 'warning'} />
                                                {app.marketplace_apps?.pricing_model && (
                                                    <Badge label={app.marketplace_apps.pricing_model} variant="info" />
                                                )}
                                            </div>
                                            <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {app.marketplace_apps?.tagline || `Installed ${formatIndiaDate(app.installed_at, { emptyValue: 'Recently installed' })}`}
                                            </p>
                                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                                {appScopes(app).slice(0, 5).map((scope) => (
                                                    <Badge key={scope} label={scope} variant="default" />
                                                ))}
                                                {appScopes(app).length > 5 && (
                                                    <Badge label={`+${appScopes(app).length - 5} more`} variant="default" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                            {launchUrl && (
                                                <a
                                                    href={launchUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex h-[var(--lb-size-control-sm)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lb-color-bg)]"
                                                >
                                                    <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    Open
                                                </a>
                                            )}
                                            <Button type="button" variant="destructive" size="sm" onClick={() => setPendingApp(app)}>
                                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                Uninstall
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Section>
            </Card>

            <Banner variant="warning" title="Data-loss note">
                Uninstalling an app can stop sync jobs, embedded admin pages, and storefront extensions that depend on its granted scopes.
            </Banner>

            <ConfirmDialog
                open={Boolean(pendingApp)}
                title="Uninstall app?"
                description={pendingApp ? `Uninstall ${appName(pendingApp)} and remove its active access to this store.` : 'Uninstall this app.'}
                confirmLabel={isPending ? 'Uninstalling' : 'Uninstall app'}
                destructive
                onConfirm={uninstall}
                onClose={() => {
                    if (!isPending) setPendingApp(null)
                }}
            />
        </SettingsPane>
    )
}
