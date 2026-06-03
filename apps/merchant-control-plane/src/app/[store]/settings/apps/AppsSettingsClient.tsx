'use client'

import { useMemo, useState, useTransition } from 'react'
import type { InstalledApp } from '@letbuyy/shared-types'
import {
    AppWindow,
    Badge,
    Banner,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    ExternalLink,
    Section,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface AppsSettingsClientProps {
    store: string
    installedApps: InstalledApp[]
    onUninstall: (appId: string) => Promise<{ ok: boolean; message: string }>
}

function formatDate(value?: string | null) {
    if (!value) return 'Recently installed'
    return new Date(value).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function appName(app: InstalledApp) {
    return app.marketplace_apps?.name || app.app_id
}

export function AppsSettingsClient({ store, installedApps, onUninstall }: AppsSettingsClientProps) {
    const { notify } = useToast()
    const [apps, setApps] = useState(installedApps)
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
                href: 'https://apps.letbuyy.store',
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
                        {apps.filter((app) => app.marketplace_apps?.app_url).length}
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
                                <a
                                    href="https://apps.letbuyy.store"
                                    className="inline-flex h-[var(--lb-size-control-md)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    Browse app marketplace
                                </a>
                            )}
                        />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                            {apps.map((app) => (
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
                                            {app.marketplace_apps?.tagline || `Installed ${formatDate(app.installed_at)}`}
                                        </p>
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                            {(app.scopes_granted || []).slice(0, 5).map((scope) => (
                                                <Badge key={scope} label={scope} variant="default" />
                                            ))}
                                            {app.scopes_granted.length > 5 && (
                                                <Badge label={`+${app.scopes_granted.length - 5} more`} variant="default" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                        {app.marketplace_apps?.app_url && (
                                            <Button type="button" variant="secondary" size="sm" onClick={() => window.open(app.marketplace_apps?.app_url || '', '_blank', 'noopener,noreferrer')}>
                                                <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                Open
                                            </Button>
                                        )}
                                        <Button type="button" variant="destructive" size="sm" onClick={() => setPendingApp(app)}>
                                            <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            Uninstall
                                        </Button>
                                    </div>
                                </div>
                            ))}
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
