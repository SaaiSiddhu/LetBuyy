import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Banner, Card, MaterialIcon, Section, type MaterialIconName } from '@letbuyy/ui'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import {
    SettingsPane,
    getSettingsItemHref,
    settingsIndexGroups,
    type SettingsIndexItem,
} from '@/components/settings'

interface SettingsPageProps {
    params: Promise<{ store: string }>
}

const launchPriorityKeys = new Set(['payments', 'shipping', 'domains', 'policies'])

function allSettingsItems() {
    return settingsIndexGroups.flatMap((group) => group.items)
}

function statusLabel(item: SettingsIndexItem) {
    if (item.badge) return item.badge
    return item.status === 'ready' ? 'Ready' : 'Planned'
}

export default async function SettingsPage({ params }: SettingsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const storeName = storeData.name || storeData.store_name || store
    const subdomain = storeData.subdomain || storeData.store_name || store
    const items = allSettingsItems()
    const readyItems = items.filter((item) => item.status === 'ready')
    const plannedItems = items.filter((item) => item.status !== 'ready')
    const launchItems = readyItems.filter((item) => launchPriorityKeys.has(item.key))

    return (
        <SettingsPane
            store={store}
            title="Settings"
            description="Centralized controls for store setup, billing, payments, delivery, compliance, and platform access."
            iconName="settings"
        >
            <Banner variant="info" title="Settings architecture baseline">
                {readyItems.length} settings routes are available now. {plannedItems.length} rows are staged as honest placeholders until their backend fields or endpoints exist.
            </Banner>

            <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <Card>
                    <Section title="Store profile" description="Current real-stack store context used by every settings pane.">
                        <div className="grid gap-[var(--lb-space-3)]">
                            <ProfileRow icon="storefront" label="Store" value={storeName} detail={`${subdomain}.letbuyy.store`} />
                            <ProfileRow icon="account_circle" label="Session" value={user.fullName || user.email.split('@')[0] || 'User'} detail={user.email} />
                            <ProfileRow icon="currency_rupee" label="Market" value="India-first defaults" detail="INR, GST-aware commerce settings" />
                        </div>
                    </Section>
                </Card>

                <Card>
                    <Section title="Launch priorities" description="Operational settings merchants usually verify before accepting real orders.">
                        <div className="grid gap-[var(--lb-space-2)] sm:grid-cols-2">
                            {launchItems.map((item) => (
                                <SettingsTile key={item.key} store={store} item={item} compact />
                            ))}
                        </div>
                    </Section>
                </Card>
            </div>

            <Section
                title="Settings map"
                description="Grouped settings index aligned to the left navigation shell."
                columns={2}
            >
                {settingsIndexGroups.map((group) => (
                    <Card key={group.label}>
                        <div className="grid gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                            <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                <h2 className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                    {group.label}
                                </h2>
                                <Badge
                                    label={`${group.items.filter((item) => item.status === 'ready').length}/${group.items.length} ready`}
                                    variant={group.items.every((item) => item.status === 'ready') ? 'success' : 'warning'}
                                />
                            </div>
                            <div className="grid gap-[var(--lb-space-2)]">
                                {group.items.map((item) => (
                                    <SettingsTile key={item.key} store={store} item={item} />
                                ))}
                            </div>
                        </div>
                    </Card>
                ))}
            </Section>
        </SettingsPane>
    )
}

function ProfileRow({
    icon,
    label,
    value,
    detail,
}: {
    icon: MaterialIconName
    label: string
    value: string
    detail: string
}) {
    return (
        <div className="flex min-w-0 items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
            <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]">
                <MaterialIcon name={icon} />
            </span>
            <span className="min-w-0">
                <span className="block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{label}</span>
                <strong className="block truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">{value}</strong>
                <span className="block truncate text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{detail}</span>
            </span>
        </div>
    )
}

function SettingsTile({
    store,
    item,
    compact = false,
}: {
    store: string
    item: SettingsIndexItem
    compact?: boolean
}) {
    const className = [
        'group flex min-h-[var(--lb-size-control-lg)] min-w-0 gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] transition-colors duration-[var(--lb-motion-fast)]',
        item.status === 'ready' ? 'hover:bg-[var(--lb-color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]' : 'opacity-75',
    ].join(' ')

    const body = (
        <>
            <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]">
                <MaterialIcon name={item.icon} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                    <strong className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">{item.label}</strong>
                    <Badge label={statusLabel(item)} variant={item.status === 'ready' ? 'info' : 'warning'} />
                </span>
                {!compact && (
                    <span className="mt-[var(--lb-space-1)] block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {item.description}
                    </span>
                )}
            </span>
            {item.status === 'ready' && (
                <MaterialIcon name="arrow_forward" className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[color:var(--lb-color-text-subdued)] group-hover:text-[color:var(--lb-color-text)]" />
            )}
        </>
    )

    if (item.status !== 'ready') {
        return (
            <span className={className} aria-disabled="true">
                {body}
            </span>
        )
    }

    return (
        <Link href={getSettingsItemHref(store, item)} className={className}>
            {body}
        </Link>
    )
}
