'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    AlertTriangle,
    Badge,
    Banner,
    Bell,
    Button,
    Card,
    Mail,
    MessageSquare,
    Package,
    SaveBar,
    Section,
    ShoppingBag,
    Skeleton,
    User,
    type LucideIcon,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings'

type NotificationGroupKey = 'orders' | 'inventory' | 'customers' | 'content'

interface NotificationPref {
    key: string
    label: string
    description: string
    group: NotificationGroupKey
    Icon: LucideIcon
    enabled: boolean
}

interface NotificationGroup {
    key: NotificationGroupKey
    title: string
    description: string
}

interface CustomerTemplate {
    key: string
    label: string
    description: string
    status: string
    Icon: LucideIcon
}

type SaveState = 'saved' | 'unsaved' | 'saving'

const STAFF_NOTIFICATION_GROUPS: NotificationGroup[] = [
    {
        key: 'orders',
        title: 'Orders and fulfillment',
        description: 'Alert staff when new orders arrive or fulfillment status changes.',
    },
    {
        key: 'inventory',
        title: 'Inventory',
        description: 'Surface stock exceptions before products sell out.',
    },
    {
        key: 'customers',
        title: 'Customers',
        description: 'Notify staff about customer account and review activity.',
    },
    {
        key: 'content',
        title: 'Forms and content',
        description: 'Keep lead and contact-form submissions visible to the team.',
    },
]

const DEFAULT_PREFS: NotificationPref[] = [
    { key: 'new_order', label: 'New order', description: 'When a customer places an order', group: 'orders', Icon: ShoppingBag, enabled: true },
    { key: 'order_fulfilled', label: 'Order fulfilled', description: 'When an order is marked as fulfilled', group: 'orders', Icon: Package, enabled: false },
    { key: 'low_inventory', label: 'Low inventory', description: 'When a product has low stock', group: 'inventory', Icon: AlertTriangle, enabled: true },
    { key: 'new_customer', label: 'New customer', description: 'When a customer creates an account', group: 'customers', Icon: User, enabled: false },
    { key: 'new_review', label: 'New review', description: 'When a customer leaves a product review', group: 'customers', Icon: MessageSquare, enabled: false },
    { key: 'form_submission', label: 'Form submission', description: 'When someone submits a contact form', group: 'content', Icon: Mail, enabled: true },
]

const CUSTOMER_TEMPLATES: CustomerTemplate[] = [
    {
        key: 'order_confirmation',
        label: 'Order confirmation',
        description: 'Sent automatically after successful checkout.',
        status: 'Automatic',
        Icon: ShoppingBag,
    },
    {
        key: 'shipping_update',
        label: 'Shipping update',
        description: 'Sent when tracking or fulfillment status changes.',
        status: 'Automatic',
        Icon: Package,
    },
    {
        key: 'account_creation',
        label: 'Account creation',
        description: 'Sent when a shopper creates a customer account.',
        status: 'Automatic',
        Icon: User,
    },
]

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function prefsSignature(prefs: NotificationPref[]) {
    return prefs.map((pref) => `${pref.key}:${pref.enabled ? '1' : '0'}`).join('|')
}

function mergePrefs(saved: Record<string, unknown>) {
    return DEFAULT_PREFS.map((pref) => ({
        ...pref,
        enabled: typeof saved[pref.key] === 'boolean' ? (saved[pref.key] as boolean) : pref.enabled,
    }))
}

interface NotificationSummaryProps {
    icon: ReactNode
    label: string
    value: string
    helper: string
}

function NotificationSummary({ icon, label, value, helper }: NotificationSummaryProps) {
    return (
        <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                {icon}
            </span>
            <span className="min-w-0 space-y-[var(--lb-space-1)]">
                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {label}
                </span>
                <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {value}
                </span>
                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {helper}
                </span>
            </span>
        </div>
    )
}

interface PreferenceRowProps {
    pref: NotificationPref
    onToggle: (key: string) => void
}

function PreferenceRow({ pref, onToggle }: PreferenceRowProps) {
    const inputId = `notification-${pref.key}`
    const Icon = pref.Icon

    return (
        <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface-subdued)] sm:flex-row sm:items-start sm:justify-between"
        >
            <span className="flex min-w-0 items-start gap-[var(--lb-space-3)]">
                <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                    <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                </span>
                <span className="min-w-0 space-y-[var(--lb-space-1)]">
                    <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                        {pref.label}
                    </span>
                    <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {pref.description}
                    </span>
                </span>
            </span>
            <span className="flex items-center gap-[var(--lb-space-3)] self-start sm:self-center">
                <Badge label={pref.enabled ? 'On' : 'Off'} variant={pref.enabled ? 'success' : 'default'} />
                <input
                    id={inputId}
                    type="checkbox"
                    checked={pref.enabled}
                    onChange={() => onToggle(pref.key)}
                    className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] cursor-pointer accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                />
            </span>
        </label>
    )
}

interface TemplateCardProps {
    template: CustomerTemplate
}

function TemplateCard({ template }: TemplateCardProps) {
    const Icon = template.Icon

    return (
        <article className="flex min-w-0 flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                <div className="flex min-w-0 items-start gap-[var(--lb-space-3)]">
                    <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                        <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 space-y-[var(--lb-space-1)]">
                        <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {template.label}
                        </h3>
                        <p className="m-0 text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                            {template.description}
                        </p>
                    </div>
                </div>
                <Badge label={template.status} variant="success" />
            </div>
            <p className="m-0 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                Subject, body, localization, and preview editing need a template API before merchants can customize this message.
            </p>
        </article>
    )
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
    const enabledGroups = useMemo(() => (
        STAFF_NOTIFICATION_GROUPS.filter((group) => prefs.some((pref) => pref.group === group.key && pref.enabled)).length
    ), [prefs])

    useEffect(() => {
        let mounted = true

        async function load() {
            setLoading(true)
            setLoadError(null)

            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                    cache: 'no-store',
                })
                const payload = await response.json() as { data?: Record<string, unknown>; error?: string }

                if (!response.ok) {
                    throw new Error(payload.error || 'Unable to load notification settings')
                }

                const nextSiteSettings = isRecord(payload.data?.site_settings) ? payload.data.site_settings : {}
                const savedPrefs = isRecord(nextSiteSettings.notifications) ? nextSiteSettings.notifications : {}
                const nextPrefs = mergePrefs(savedPrefs)

                if (!mounted) return
                setSiteSettings(nextSiteSettings)
                setPrefs(nextPrefs)
                setInitialPrefs(nextPrefs)
                setSaveState('saved')
            } catch (error) {
                if (!mounted) return
                const message = error instanceof Error ? error.message : 'Unable to load notification settings'
                setLoadError(message)
                notify({
                    title: 'Notification settings could not load',
                    description: message,
                    variant: 'critical',
                })
            } finally {
                if (mounted) setLoading(false)
            }
        }

        void load()

        return () => {
            mounted = false
        }
    }, [notify, store])

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
                store={store}
                title="Notifications"
                description="Choose which store events notify staff and review customer email templates."
                iconName="notifications"
            >
                <Card>
                    <Section title="Notification overview">
                        <Skeleton variant="text" lines={4} />
                    </Section>
                </Card>
                <Card>
                    <Section title="Staff notifications">
                        <Skeleton variant="text" lines={6} />
                    </Section>
                </Card>
                <Card>
                    <Section title="Customer email templates">
                        <Skeleton variant="text" lines={4} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            store={store}
            title="Notifications"
            description="Choose which store events notify staff and review customer email templates."
            iconName="notifications"
            saveBar={(
                <SaveBar
                    state={activeSaveState}
                    onSave={() => void handleSave()}
                    onDiscard={handleDiscard}
                    saveLabel="Save notifications"
                />
            )}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Notification settings could not load"
                    action={<Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Notification overview"
                    description="Review saved staff alert coverage and the customer template surface."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <NotificationSummary
                            icon={<Bell className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Staff alerts"
                            value={`${enabledCount} of ${prefs.length} enabled`}
                            helper={`${enabledGroups} alert group${enabledGroups === 1 ? '' : 's'} active`}
                        />
                        <NotificationSummary
                            icon={<Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Customer templates"
                            value={`${CUSTOMER_TEMPLATES.length} automatic`}
                            helper="Template editing needs backend support"
                        />
                        <NotificationSummary
                            icon={<MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Delivery records"
                            value="Platform logged"
                            helper="Email delivery logs stay service-owned"
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Staff notifications"
                    description="Select which operational events should notify your team."
                    action={<span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{enabledCount} of {prefs.length} enabled</span>}
                >
                    <div className="grid gap-[var(--lb-space-4)]">
                        {STAFF_NOTIFICATION_GROUPS.map((group) => {
                            const groupPrefs = prefs.filter((pref) => pref.group === group.key)
                            const groupEnabledCount = groupPrefs.filter((pref) => pref.enabled).length

                            return (
                                <div key={group.key} className="grid gap-[var(--lb-space-3)]">
                                    <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 space-y-[var(--lb-space-1)]">
                                            <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                {group.title}
                                            </h3>
                                            <p className="m-0 text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                                                {group.description}
                                            </p>
                                        </div>
                                        <span className="self-start">
                                            <Badge label={`${groupEnabledCount}/${groupPrefs.length} on`} variant={groupEnabledCount > 0 ? 'info' : 'default'} />
                                        </span>
                                    </div>
                                    <div className="grid gap-[var(--lb-space-3)]">
                                        {groupPrefs.map((pref) => (
                                            <PreferenceRow key={pref.key} pref={pref} onToggle={togglePref} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Customer email templates"
                    description="Transactional shopper emails are listed here, while editable subject/body templates need a template API."
                    action={<Badge label="Needs backend" variant="warning" />}
                >
                    <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-3">
                        {CUSTOMER_TEMPLATES.map((template) => (
                            <TemplateCard key={template.key} template={template} />
                        ))}
                    </div>
                    <Banner variant="warning" title="Template editing needs backend support">
                        The current merchant settings API persists staff alert booleans only. Editable customer email templates need backend support for template content, localization, preview data, and delivery-test sends.
                    </Banner>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Notification delivery"
                    description="Delivery channels stay platform-managed so operational and shopper messages remain reliable."
                    action={<Badge label="Protected" variant="success" />}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <NotificationSummary
                            icon={<Bell className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Merchant feed"
                            value="Order and lead alerts"
                            helper="Served by the existing admin notifications feed"
                        />
                        <NotificationSummary
                            icon={<Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Customer email"
                            value="Automatic"
                            helper="Transactional sends remain service-owned"
                        />
                        <NotificationSummary
                            icon={<MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="SMS and WhatsApp"
                            value="Needs backend"
                            helper="No channel preference endpoint exists in this app"
                        />
                    </div>
                </Section>
            </Card>

            <Banner variant="info" title="Notification impact">
                Staff notification toggles are saved in store settings. Customer transactional email behavior is managed by LetBuyy&apos;s notification service until template editing is exposed.
            </Banner>
        </SettingsPane>
    )
}
