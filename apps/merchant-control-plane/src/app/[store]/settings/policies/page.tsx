'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button,
    Banner,
    Card,
    ClipboardList,
    FileText,
    Section,
    Shield,
    Skeleton,
    Textarea,
    Truck,
    useToast,
    type LucideIcon,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface PolicyField {
    key: string
    label: string
    description: string
    placeholder: string
    Icon: LucideIcon
    value: string
}

type SaveState = 'saved' | 'unsaved' | 'saving'

type SettingsPayload = {
    data?: unknown
    error?: string | { message?: string }
}

const POLICY_FIELDS: PolicyField[] = [
    {
        key: 'refund_policy',
        label: 'Refund policy',
        description: 'Set expectations for returns, refunds, exchange windows, and eligibility.',
        placeholder: 'Enter your refund policy...',
        Icon: ClipboardList,
        value: '',
    },
    {
        key: 'privacy_policy',
        label: 'Privacy policy',
        description: 'Explain how customer information is collected, used, and protected.',
        placeholder: 'Enter your privacy policy...',
        Icon: Shield,
        value: '',
    },
    {
        key: 'terms_of_service',
        label: 'Terms of service',
        description: 'Define the terms customers agree to when using your storefront.',
        placeholder: 'Enter your terms of service...',
        Icon: FileText,
        value: '',
    },
    {
        key: 'shipping_policy',
        label: 'Shipping policy',
        description: 'Describe shipping timelines, charges, delivery areas, and tracking.',
        placeholder: 'Enter your shipping policy...',
        Icon: Truck,
        value: '',
    },
]

function policySignature(policies: PolicyField[]) {
    return policies.map((policy) => `${policy.key}:${policy.value}`).join('|')
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getPayloadError(payload: SettingsPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

export default function PoliciesSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [policies, setPolicies] = useState<PolicyField[]>(POLICY_FIELDS)
    const [initialPolicies, setInitialPolicies] = useState<PolicyField[]>(POLICY_FIELDS)

    const hasUnsavedChanges = useMemo(() => policySignature(policies) !== policySignature(initialPolicies), [initialPolicies, policies])
    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'
    const completedCount = useMemo(() => policies.filter((policy) => policy.value.trim().length > 0).length, [policies])

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
                signal,
            })
            const payload = (await response.json().catch(() => null)) as SettingsPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to load policies'))
            }

            const data = isRecord(payload?.data) ? payload.data : {}
            const nextPolicies = POLICY_FIELDS.map((policy) => {
                const value = data[policy.key]
                return {
                    ...policy,
                    value: typeof value === 'string' ? value : '',
                }
            })

            setPolicies(nextPolicies)
            setInitialPolicies(nextPolicies)
            setSaveState('saved')
        } catch (error) {
            if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return

            const message = error instanceof Error ? error.message : 'Unable to load policies'
            setLoadError(message)
            notify({
                title: 'Policies could not load',
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

    const updatePolicy = useCallback((key: string, value: string) => {
        setPolicies((current) => current.map((policy) => (
            policy.key === key ? { ...policy, value } : policy
        )))
    }, [])

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges || saveState === 'saving') return

        setSaveState('saving')

        try {
            const update: Record<string, string> = {}
            policies.forEach((policy) => {
                update[policy.key] = policy.value
            })

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
            })
            const payload = (await response.json().catch(() => null)) as SettingsPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to save policies'))
            }

            setInitialPolicies(policies)
            setSaveState('saved')
            notify({
                title: 'Policies saved',
                description: `${completedCount} of ${policies.length} storefront policies completed.`,
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save policies'
            setSaveState('unsaved')
            notify({
                title: 'Could not save policies',
                description: message,
                variant: 'critical',
            })
        }
    }, [completedCount, hasUnsavedChanges, notify, policies, saveState, store])

    const handleDiscard = useCallback(() => {
        setPolicies(initialPolicies)
        setSaveState('saved')
        notify({
            title: 'Changes discarded',
            description: 'Policies were reset to the last saved version.',
            variant: 'info',
        })
    }, [initialPolicies, notify])

    if (loading) {
        return (
            <SettingsPane
                title="Policies"
                description="Manage storefront and checkout policies that help customers buy with confidence."
                store={store}
            >
                <Card>
                    <Section title="Storefront policies">
                        <Skeleton variant="text" lines={6} />
                    </Section>
                </Card>
                <Skeleton variant="card" />
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            title="Policies"
            description="Manage storefront and checkout policies that help customers buy with confidence."
            store={store}
            guidance={{
                title: 'Policies appear on your storefront',
                body: 'These policies appear on storefront policy pages and during checkout. Clear policies build customer trust.',
            }}
            saveBar={{
                state: activeSaveState,
                onSave: () => void handleSave(),
                onDiscard: handleDiscard,
                saveLabel: 'Save policies',
            }}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Policies could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Storefront policies"
                    description="Use simple merchant-facing language. You can refine the details later."
                    action={<span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{completedCount} of {policies.length} complete</span>}
                >
                    <div className="grid gap-[var(--lb-space-4)]">
                        {policies.map(({ key, label, description, placeholder, Icon, value }) => (
                            <div
                                key={key}
                                className="grid gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] lg:grid-cols-[240px_minmax(0,1fr)]"
                            >
                                <div className="flex items-start gap-[var(--lb-space-3)]">
                                    <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                        <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </span>
                                    <div className="space-y-[var(--lb-space-1)]">
                                        <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                            {label}
                                        </h3>
                                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            {description}
                                        </p>
                                    </div>
                                </div>
                                <Textarea
                                    aria-label={label}
                                    value={value}
                                    onChange={(event) => updatePolicy(key, event.target.value)}
                                    rows={6}
                                    placeholder={placeholder}
                                    helperText={`${value.trim().length} characters`}
                                />
                            </div>
                        ))}
                    </div>
                </Section>
            </Card>
        </SettingsPane>
    )
}
