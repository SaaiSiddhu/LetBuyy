import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { InstalledApp } from '@letbuyy/shared-types'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { Badge, Card, EmptyState, MaterialIcon, Page, PageHeader, Section } from '@letbuyy/ui'

interface AppsPageProps {
    params: Promise<{ store: string }>
}

function appName(installation: InstalledApp) {
    return installation.marketplace_apps?.name || 'Installed app'
}

function appTagline(installation: InstalledApp) {
    return installation.marketplace_apps?.tagline || 'Embedded admin app'
}

export default async function AppsPage({ params }: AppsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const installations = await createMerchantApiClient().appStore.installations({ store_id: storeData.id })

    return (
        <Page>
            <PageHeader
                breadcrumbs={[
                    { label: 'Home', href: `/${store}/dashboard` },
                    { label: 'Apps' },
                ]}
                eyebrow="Apps"
                title="Installed apps"
                description="Open embedded apps, review installed extensions, and reach the LetBuyy app marketplace."
                primaryAction={{
                    label: 'Browse marketplace',
                    href: 'https://apps.letbuyy.com',
                    icon: <MaterialIcon name="extension" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
                }}
            />

            <Card>
                <Section
                    title="Installed apps"
                    description="Apps connected to this store appear here with direct embedded admin access."
                    action={<Badge label={`${installations.length} installed`} variant={installations.length > 0 ? 'success' : 'default'} />}
                >
                    {installations.length > 0 ? (
                        <div className="grid gap-[var(--lb-space-3)]">
                            {installations.map((installation) => (
                                <Link
                                    key={installation.id}
                                    href={`/${store}/apps/${installation.id}`}
                                    className="group flex items-center gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    <div className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                        <MaterialIcon name="extension" className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                            {appName(installation)}
                                        </h2>
                                        <p className="m-0 truncate text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                            {appTagline(installation)}
                                        </p>
                                    </div>
                                    <Badge label="Embedded" variant="info" />
                                    <MaterialIcon name="chevron_right" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[var(--lb-color-text-subdued)] transition-transform group-hover:translate-x-[var(--lb-space-1)]" />
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={<MaterialIcon name="extension_off" className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)]" />}
                            title="No apps installed"
                            body="Install apps from the marketplace to add embedded workflows to this admin."
                            primaryAction={
                                <a
                                    href="https://apps.letbuyy.com"
                                    className="inline-flex h-[var(--lb-size-control-md)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-inverse)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                >
                                    <MaterialIcon name="extension" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                                    Browse apps
                                </a>
                            }
                        />
                    )}
                </Section>
            </Card>
        </Page>
    )
}
