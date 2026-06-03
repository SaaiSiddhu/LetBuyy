'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Banner,
    Bell,
    Button,
    Card,
    Mail,
    MessageSquare,
    Package,
    Section,
    ShoppingBag,
    Skeleton,
    User,
    AlertTriangle,
    type LucideIcon,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface NotificationPref {
    key: string
    label: string
    description: string
    Icon: LucideIcon
    enabled: boolean
}

type SaveState = 'saved' | 'unsaved' | 'saving'

const DEFAULT_PREFS: NotificationPref[] = [
    { key: 'new_order', label: 'New order', description: 'When a customer places an order', Icon: ShoppingBag, enabled: true },
    { key: 'order_fulfilled', label: 'Order fulfilled', description: 'When an order is marked as fulfilled', Icon: Package, enabled: false },
    { key: 'low_inventory', label: 'Low inventory', description: 'When a product has low stock', Icon: AlertTriangle, enabled: true },
    { key: 'new_customer', label: 'New customer', description: 'When a customer creates an account', Icon: User, enabled: false },
    { key: 'new_review', label: 'New review', description: 'When a customer leaves a product review', Icon: MessageSquare, enabled: false },
    { key: 'form_submission', label: 'Form submission', description: 'When someone submits a contact form', Icon: Mail, enabled: true },
]

function prefsSignature(prefs: NotificationPref[]) {
    return prefs.map((pref) => `${pref.key}:${pref.enabled ? '1' : '0'}`).join('|')
}

function mergePrefs(saved: Record<string, unknown>) {
    return DEFAULT_PREFS.map((pref) => ({
        ...pref,
        enabled: typeof saved[pref.key] === 'boolean' ? saved[pref.key] as boolean : pref.enabled,
    }))
}

export default function NotificationsSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [siteSettings, setSiteSettings] = useState<Record<string, unknown>>({})
    const [prefs, setPrefs] = useState<NotificationPref[]>(DEFAULT_PREFS)
    const [initialPrefs, setInitialPrefs] = useState<NotificationPref[]>(DEFAULT_PREFS)

    const hasUnsavedChanges = useMemo(() => prefsSignature(prefs) !== prefsSignature(initialPrefs), [initialPrefs, prefs])
    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'
    const enabledCount = useMemo(() => prefs.filter((pref) => pref.enabled).length, [prefs])

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
                signal,
            })
            const payload = await response.json() as { data?: Record<string, unknown>; error?: string }

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to load notification settings')
            }

            const data = payload.data
            const nextSiteSettings = data?.site_settings && typeof data.site_settings === 'object'
                ? data.site_settings as Record<string, unknown>
                : {}
            const savedPrefs = nextSiteSettings.notifications && typeof nextSiteSettings.notifications === 'object'
                ? nextSiteSettings.notifications as Record<string, unknown>
                : {}
            const nextPrefs = mergePrefs(savedPrefs)

            setSiteSettings(nextSiteSettings)
            setPrefs(nextPrefs)
            setInitialPrefs(nextPrefs)
            setSaveState('saved')
        } catch (error) {
            if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return

            const message = error instanceof Error ? error.message : 'Unable to load notification settings'
            setLoadError(message)
            notify({
                title: 'Notification settings could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        const controller = new AbortController()
        void loadData(controller.signal)

        return () => {
            controller.abort()
        }
    }, [loadData])

    const togglePref = useCallback((key: string) => {
        setPrefs((current) => current.map((pref) => (
            pref.key === key ? { ...pref, enabled: !pref.enabled } : pref
        )))
    }, [])

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges || saveState === 'saving') return

        setSaveState('saving')

        try {
            const notifMap: Record<string, boolean> = {}
            prefs.forEach((pref) => {
                notifMap[pref.key] = pref.enabled
            })

            const nextSettings = { ...siteSettings, notifications: notifMap }
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_settings: nextSettings }),
            })
            const payload = await response.json() as { error?: string }

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to save notification settings')
            }

            setSiteSettings(nextSettings)
            setInitialPrefs(prefs)
            setSaveState('saved')
            notify({
                title: 'Notification preferences saved',
                description: `${enabledCount} staff notification${enabledCount === 1 ? '' : 's'} enabled.`,
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save notification settings'
            setSaveState('unsaved')
            notify({
                title: 'Could not save notification preferences',
                description: message,
                variant: 'critical',
            })
        }
    }, [enabledCount, hasUnsavedChanges, notify, prefs, saveState, siteSettings, store])

    const handleDiscard = useCallback(() => {
        setPrefs(initialPrefs)
        setSaveState('saved')
        notify({
            title: 'Changes discarded',
            description: 'Notification preferences were reset to the last saved version.',
            variant: 'info',
        })
    }, [initialPrefs, notify])

    if (loading) {
        return (
            <SettingsPane
                title="Notifications"
                description="Choose which store events notify staff and which customer emails are automatic."
                store={store}
            >
                <Card>
                    <Section title="Staff notifications">
                        <Skeleton variant="text" lines={6} />
                    </Section>
                </Card>
                <Card>
                    <Section title="Customer notifications">
                        <Skeleton variant="text" lines={3} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            title="Notifications"
            description="Choose which store events notify staff and which customer emails are automatic."
            store={store}
            guidance={{
                title: 'Operational notifications',
                body: 'Staff alerts are editable here. Customer transactional emails still follow the existing order and account workflows.',
            }}
            saveBar={{
                state: activeSaveState,
                onSave: () => void handleSave(),
                onDiscard: handleDiscard,
                saveLabel: 'Save notifications',
            }}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Notification settings could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Staff notifications"
                    description="Select which operational events should notify your team."
                    action={<span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{enabledCount} of {prefs.length} enabled</span>}
                >
                    <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]">
                        {prefs.map(({ key, label, description, Icon, enabled }) => {
                            const inputId = `notification-${key}`
                            return (
                                <label
                                    key={key}
                                    htmlFor={inputId}
                                    className="flex cursor-pointer flex-col gap-[var(--lb-space-3)] p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface-subdued)] sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <span className="flex min-w-0 items-start gap-[var(--lb-space-3)]">
                                        <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                            <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                {label}
                                            </span>
                                            <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {description}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-[var(--lb-space-3)] self-start sm:self-center">
                                        <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            {enabled ? 'On' : 'Off'}
                                        </span>
                                        <input
                                            id={inputId}
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={() => togglePref(key)}
                                            className="h-[var(--lb-space-4)] w-[var(--lb-space-4)] cursor-pointer accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                        />
                                    </span>
                                </label>
                            )
                        })}
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Customer notifications"
                    description="These transactional emails are sent automatically from existing order and account workflows."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        {[
                            ['Order confirmations', ShoppingBag],
                            ['Shipping updates', Bell],
                            ['Account creation', User],
                        ].map(([label, Icon]) => {
                            const NotificationIcon = Icon as LucideIcon
                            return (
                                <div
                                    key={label as string}
                                    className="flex items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]"
                                >
                                    <NotificationIcon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                                    <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                        {label as string}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </Section>
            </Card>
        </SettingsPane>
    )
}
