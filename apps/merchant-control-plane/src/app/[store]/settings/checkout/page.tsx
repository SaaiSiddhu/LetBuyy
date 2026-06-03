'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import {
    Banner,
    Badge,
    Button,
    Card,
    Lock,
    Mail,
    MessageSquare,
    Palette,
    SaveBar,
    Section,
    Select,
    Skeleton,
    ShoppingCart,
    User,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings'

interface CheckoutSettings {
    contact_method: 'email' | 'phone' | 'both'
    customer_accounts: 'disabled' | 'optional' | 'required'
    full_name: 'required_both' | 'required_last' | 'optional'
    company_name: 'hidden' | 'optional' | 'required'
    order_notes: boolean
    tip_option: boolean
}

type SaveState = 'saved' | 'unsaved' | 'saving'

const DEFAULTS: CheckoutSettings = {
    contact_method: 'email',
    customer_accounts: 'optional',
    full_name: 'required_last',
    company_name: 'hidden',
    order_notes: false,
    tip_option: false,
}

const contactMethodOptions = [
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone number' },
    { value: 'both', label: 'Email or phone number' },
]

const accountOptions = [
    { value: 'disabled', label: 'Accounts are disabled' },
    { value: 'optional', label: 'Accounts are optional' },
    { value: 'required', label: 'Accounts are required' },
]

const fullNameOptions = [
    { value: 'required_both', label: 'Require first and last name' },
    { value: 'required_last', label: 'Only require last name' },
    { value: 'optional', label: 'Optional' },
]

const companyNameOptions = [
    { value: 'hidden', label: 'Hidden' },
    { value: 'optional', label: 'Optional' },
    { value: 'required', label: 'Required' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readEnum<Value extends string>(record: Record<string, unknown>, key: string, allowed: readonly Value[], fallback: Value) {
    const value = record[key]
    return typeof value === 'string' && allowed.includes(value as Value) ? value as Value : fallback
}

function readCheckoutSettings(siteSettings: Record<string, unknown>) {
    const checkout = isRecord(siteSettings.checkout) ? siteSettings.checkout : {}
    return {
        contact_method: readEnum(checkout, 'contact_method', ['email', 'phone', 'both'], DEFAULTS.contact_method),
        customer_accounts: readEnum(checkout, 'customer_accounts', ['disabled', 'optional', 'required'], DEFAULTS.customer_accounts),
        full_name: readEnum(checkout, 'full_name', ['required_both', 'required_last', 'optional'], DEFAULTS.full_name),
        company_name: readEnum(checkout, 'company_name', ['hidden', 'optional', 'required'], DEFAULTS.company_name),
        order_notes: typeof checkout.order_notes === 'boolean' ? checkout.order_notes : DEFAULTS.order_notes,
        tip_option: typeof checkout.tip_option === 'boolean' ? checkout.tip_option : DEFAULTS.tip_option,
    }
}

function settingsEqual(left: CheckoutSettings, right: CheckoutSettings) {
    return (
        left.contact_method === right.contact_method &&
        left.customer_accounts === right.customer_accounts &&
        left.full_name === right.full_name &&
        left.company_name === right.company_name &&
        left.order_notes === right.order_notes &&
        left.tip_option === right.tip_option
    )
}

interface ToggleRowProps {
    id: string
    label: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
    return (
        <label
            htmlFor={id}
            className="flex cursor-pointer items-start justify-between gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] transition-colors hover:bg-[var(--lb-color-surface-subdued)]"
        >
            <span className="min-w-0 space-y-[var(--lb-space-1)]">
                <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {label}
                </span>
                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {description}
                </span>
            </span>
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
            />
        </label>
    )
}

interface StatusCardProps {
    icon: ReactNode
    label: string
    value: string
    badge?: string
}

function StatusCard({ icon, label, value, badge }: StatusCardProps) {
    return (
        <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                {icon}
            </span>
            <div className="min-w-0 space-y-[var(--lb-space-1)]">
                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                    <p className="m-0 text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                        {label}
                    </p>
                    {badge && <Badge label={badge} variant="info" />}
                </div>
                <p className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {value}
                </p>
            </div>
        </div>
    )
}

interface LockedCoreItemProps {
    title: string
    description: string
}

function LockedCoreItem({ title, description }: LockedCoreItemProps) {
    return (
        <li className="flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
            <Lock className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-success)]" aria-hidden="true" />
            <div className="min-w-0 space-y-[var(--lb-space-1)]">
                <p className="m-0 text-[var(--lb-font-size-secondary)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text)]">
                    {title}
                </p>
                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {description}
                </p>
            </div>
        </li>
    )
}

export default function CheckoutSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [siteSettings, setSiteSettings] = useState<Record<string, unknown>>({})
    const [initialSettings, setInitialSettings] = useState<CheckoutSettings>(DEFAULTS)
    const [settings, setSettings] = useState<CheckoutSettings>(DEFAULTS)

    const hasUnsavedChanges = useMemo(() => !settingsEqual(settings, initialSettings), [settings, initialSettings])
    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

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
                    throw new Error(payload.error || 'Unable to load checkout settings')
                }

                const data = payload.data
                if (!data) {
                    throw new Error('Checkout settings were not returned for this store')
                }

                const nextSiteSettings = isRecord(data.site_settings) ? data.site_settings : {}
                const nextSettings = readCheckoutSettings(nextSiteSettings)

                if (!mounted) return
                setSiteSettings(nextSiteSettings)
                setSettings(nextSettings)
                setInitialSettings(nextSettings)
                setSaveState('saved')
            } catch (error) {
                if (!mounted) return
                const message = error instanceof Error ? error.message : 'Unable to load checkout settings'
                setLoadError(message)
                notify({
                    title: 'Checkout settings could not load',
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

    const updateField = useCallback(<Key extends keyof CheckoutSettings>(key: Key, value: CheckoutSettings[Key]) => {
        setSettings((current) => ({ ...current, [key]: value }))
    }, [])

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges || saveState === 'saving') return

        setSaveState('saving')
        const nextSiteSettings = { ...siteSettings, checkout: settings }

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_settings: nextSiteSettings }),
            })
            const payload = await response.json() as { error?: string }

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to save checkout settings')
            }

            setSiteSettings(nextSiteSettings)
            setInitialSettings(settings)
            setSaveState('saved')
            notify({
                title: 'Checkout settings saved',
                description: 'Customer account, contact, and form preferences are up to date.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save checkout settings'
            setSaveState('unsaved')
            notify({
                title: 'Could not save checkout settings',
                description: message,
                variant: 'critical',
            })
        }
    }, [hasUnsavedChanges, notify, saveState, settings, siteSettings, store])

    const handleDiscard = useCallback(() => {
        setSettings(initialSettings)
        setSaveState('saved')
        notify({
            title: 'Changes discarded',
            description: 'Checkout settings were reset to the last saved version.',
            variant: 'info',
        })
    }, [initialSettings, notify])

    if (loading) {
        return (
            <SettingsPane
                store={store}
                title="Checkout"
                description="Control how customers identify themselves and complete checkout."
                iconName="checkout"
            >
                <Card>
                    <Section title="Customer contact method">
                        <Skeleton variant="text" lines={3} />
                    </Section>
                </Card>
                <Card>
                    <Section title="Customer accounts">
                        <Skeleton variant="text" lines={3} />
                    </Section>
                </Card>
                <Skeleton variant="card" />
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            store={store}
            title="Checkout"
            description="Control how customers identify themselves and complete checkout."
            iconName="checkout"
            saveBar={(
                <SaveBar
                    state={activeSaveState}
                    onSave={() => void handleSave()}
                    onDiscard={handleDiscard}
                    saveLabel="Save checkout"
                />
            )}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Checkout settings could not load"
                    action={<Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Checkout experience"
                    description="Review the customer identification rules currently saved under store settings."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <StatusCard
                            icon={<Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Contact"
                            value={contactMethodOptions.find((option) => option.value === settings.contact_method)?.label ?? 'Email'}
                        />
                        <StatusCard
                            icon={<User className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Customer accounts"
                            value={accountOptions.find((option) => option.value === settings.customer_accounts)?.label ?? 'Accounts are optional'}
                        />
                        <StatusCard
                            icon={<MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Extras"
                            value={`${settings.order_notes ? 'Notes on' : 'Notes off'} / ${settings.tip_option ? 'Tips on' : 'Tips off'}`}
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Customer identity"
                    description="Choose how shoppers identify themselves before order confirmation."
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Select
                            label="Customers can check out using"
                            value={settings.contact_method}
                            options={contactMethodOptions}
                            onChange={(event) => updateField('contact_method', event.target.value as CheckoutSettings['contact_method'])}
                        />
                        <Select
                            label="Account creation"
                            value={settings.customer_accounts}
                            options={accountOptions}
                            onChange={(event) => updateField('customer_accounts', event.target.value as CheckoutSettings['customer_accounts'])}
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Form options"
                    description="Set which extra customer fields appear in checkout."
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Select
                            label="Full name"
                            value={settings.full_name}
                            options={fullNameOptions}
                            onChange={(event) => updateField('full_name', event.target.value as CheckoutSettings['full_name'])}
                        />
                        <Select
                            label="Company name"
                            value={settings.company_name}
                            options={companyNameOptions}
                            onChange={(event) => updateField('company_name', event.target.value as CheckoutSettings['company_name'])}
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Checkout branding"
                    description="Brand controls are shown as a placeholder until checkout-core exposes editable branding fields."
                    action={<Badge label="Needs backend" variant="warning" />}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        <StatusCard
                            icon={<Palette className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Brand theme"
                            value="Storefront theme inherited"
                            badge="Locked"
                        />
                        <StatusCard
                            icon={<ShoppingCart className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Checkout layout"
                            value="LetBuyy managed checkout"
                            badge="Core"
                        />
                    </div>
                    <Banner variant="warning" title="Branding controls need backend support">
                        Checkout logo, accent color, trust badge, and checkout layout settings are not exposed by the current store settings API. The pane keeps the existing options editable and shows branding as read-only.
                    </Banner>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Locked checkout core"
                    description="These behaviours stay platform-managed so orders remain tenant-safe and payment-safe."
                    action={<Badge label="Protected" variant="success" />}
                >
                    <ul className="m-0 grid list-none gap-[var(--lb-space-3)] p-0 md:grid-cols-3">
                        <LockedCoreItem
                            title="Server pricing"
                            description="Totals are recalculated by the checkout service before payment or COD order creation."
                        />
                        <LockedCoreItem
                            title="Payment handoff"
                            description="Provider signatures and idempotency stay outside editable merchant UI settings."
                        />
                        <LockedCoreItem
                            title="Policy links"
                            description="Checkout policy content is managed from the Policies pane."
                        />
                    </ul>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Additional options"
                    description="Enable optional checkout affordances that help customers communicate order details."
                >
                    <div className="grid gap-[var(--lb-space-3)]">
                        <ToggleRow
                            id="order-notes"
                            label="Order notes"
                            description="Allow customers to add notes for fulfilment or delivery."
                            checked={settings.order_notes}
                            onChange={(checked) => updateField('order_notes', checked)}
                        />
                        <ToggleRow
                            id="tip-option"
                            label="Tipping option"
                            description="Show a tip option during checkout."
                            checked={settings.tip_option}
                            onChange={(checked) => updateField('tip_option', checked)}
                        />
                    </div>
                </Section>
            </Card>

            <Banner variant="info" title="Checkout impact">
                These settings control how customers interact with your checkout process.
            </Banner>
        </SettingsPane>
    )
}
