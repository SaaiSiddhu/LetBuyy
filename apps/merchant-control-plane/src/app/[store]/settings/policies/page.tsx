'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    ClipboardList,
    FileText,
    SaveBar,
    Section,
    Shield,
    Skeleton,
    Textarea,
    Truck,
    type LucideIcon,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings'

type PolicyType = 'refund' | 'privacy' | 'terms' | 'shipping'
type PolicyStatus = 'draft' | 'published' | 'archived'
type SaveState = 'saved' | 'unsaved' | 'saving'

interface PolicyTemplate {
    key: PolicyType
    label: string
    description: string
    placeholder: string
    template: string
    Icon: LucideIcon
}

interface PolicyDraft extends PolicyTemplate {
    id: string | null
    status: PolicyStatus
    updatedAt: string | null
    value: string
}

interface ApiPolicy {
    id?: string | null
    policy_type?: string | null
    slug?: string | null
    title?: string | null
    body?: string | null
    status?: string | null
    updated_at?: string | null
}

type PoliciesPayload = {
    data?: ApiPolicy[] | ApiPolicy
    error?: string | { message?: string }
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
    {
        key: 'refund',
        label: 'Refund policy',
        description: 'Set expectations for returns, refunds, exchange windows, and eligibility.',
        placeholder: 'Enter your refund policy...',
        Icon: ClipboardList,
        template: [
            'We accept return or exchange requests for eligible products within 7 days of delivery.',
            'Products must be unused, undamaged, and returned with original packaging and invoice.',
            'Refunds are processed to the original payment method after inspection. Cash on delivery refunds may require bank details from the customer.',
            'Shipping fees, payment charges, and products marked final sale may be non-refundable unless required by law.',
        ].join('\n\n'),
    },
    {
        key: 'privacy',
        label: 'Privacy policy',
        description: 'Explain how customer information is collected, used, and protected.',
        placeholder: 'Enter your privacy policy...',
        Icon: Shield,
        template: [
            'We collect customer information needed to process orders, provide support, and improve the shopping experience.',
            'Personal information may include name, email address, phone number, shipping address, billing address, and order history.',
            'We do not sell customer personal information. We share information only with payment, shipping, analytics, and support providers needed to operate the store.',
            'Customers can contact us to request access, correction, or deletion of their personal information where applicable.',
        ].join('\n\n'),
    },
    {
        key: 'terms',
        label: 'Terms of service',
        description: 'Define the terms customers agree to when using your storefront.',
        placeholder: 'Enter your terms of service...',
        Icon: FileText,
        template: [
            'By using this store, customers agree to follow these terms and all applicable laws.',
            'Product availability, pricing, descriptions, and offers may change without notice. We may cancel orders when payment, inventory, fraud, or address verification fails.',
            'Customers are responsible for providing accurate contact, shipping, and payment information.',
            'Store content, product images, and brand assets may not be copied or reused without permission.',
        ].join('\n\n'),
    },
    {
        key: 'shipping',
        label: 'Shipping policy',
        description: 'Describe shipping timelines, charges, delivery areas, and tracking.',
        placeholder: 'Enter your shipping policy...',
        Icon: Truck,
        template: [
            'Orders are processed after payment confirmation or cash on delivery acceptance.',
            'Estimated delivery timelines depend on destination, courier availability, product availability, and public holidays.',
            'Shipping charges, if any, are shown during checkout before the order is placed.',
            'Customers receive tracking information when the order is dispatched. Delivery delays may occur because of weather, courier restrictions, or incorrect address details.',
        ].join('\n\n'),
    },
]

function emptyPolicies() {
    return POLICY_TEMPLATES.map((policy) => ({
        ...policy,
        id: null,
        status: 'draft' as const,
        updatedAt: null,
        value: '',
    }))
}

function policySignature(policies: PolicyDraft[]) {
    return policies.map((policy) => `${policy.key}:${policy.status}:${policy.value}`).join('|')
}

function normalizePolicyStatus(value: unknown): PolicyStatus {
    return value === 'published' || value === 'archived' ? value : 'draft'
}

function getPayloadError(payload: PoliciesPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function mergePolicyRecords(records: ApiPolicy[]) {
    const byType = new Map(records.map((record) => [record.policy_type, record]))

    return POLICY_TEMPLATES.map((template) => {
        const record = byType.get(template.key)
        return {
            ...template,
            id: typeof record?.id === 'string' ? record.id : null,
            status: normalizePolicyStatus(record?.status),
            updatedAt: typeof record?.updated_at === 'string' ? record.updated_at : null,
            value: typeof record?.body === 'string' ? record.body : '',
        }
    })
}

interface PolicyMetricProps {
    icon: ReactNode
    label: string
    value: string
    helper: string
}

function PolicyMetric({ icon, label, value, helper }: PolicyMetricProps) {
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

interface PolicyEditorProps {
    policy: PolicyDraft
    onApplyTemplate: (key: PolicyType) => void
    onChange: (key: PolicyType, value: string) => void
}

function PolicyEditor({ policy, onApplyTemplate, onChange }: PolicyEditorProps) {
    const Icon = policy.Icon
    const isComplete = policy.value.trim().length > 0

    return (
        <div className="grid gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-[var(--lb-space-3)]">
                <div className="flex items-start gap-[var(--lb-space-3)]">
                    <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                        <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 space-y-[var(--lb-space-2)]">
                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                            <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                {policy.label}
                            </h3>
                            <Badge label={isComplete ? policy.status : 'Draft'} variant={isComplete && policy.status === 'published' ? 'success' : 'info'} />
                        </div>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {policy.description}
                        </p>
                    </div>
                </div>
                <Button variant="secondary" onClick={() => onApplyTemplate(policy.key)}>
                    Use starter template
                </Button>
                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {policy.updatedAt ? `Last updated ${new Date(policy.updatedAt).toLocaleDateString()}` : 'No storefront policy record saved yet.'}
                </p>
            </div>
            <Textarea
                aria-label={policy.label}
                value={policy.value}
                onChange={(event) => onChange(policy.key, event.target.value)}
                rows={8}
                placeholder={policy.placeholder}
                helperText={`${policy.value.trim().length} characters`}
            />
        </div>
    )
}

export default function PoliciesSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [policies, setPolicies] = useState<PolicyDraft[]>(emptyPolicies)
    const [initialPolicies, setInitialPolicies] = useState<PolicyDraft[]>(emptyPolicies)

    const hasUnsavedChanges = useMemo(() => policySignature(policies) !== policySignature(initialPolicies), [initialPolicies, policies])
    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'
    const completedCount = useMemo(() => policies.filter((policy) => policy.value.trim().length > 0).length, [policies])
    const publishedCount = useMemo(() => policies.filter((policy) => policy.value.trim().length > 0 && policy.status === 'published').length, [policies])
    const draftCount = policies.length - publishedCount

    useEffect(() => {
        let mounted = true

        async function load() {
            setLoading(true)
            setLoadError(null)

            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/policies?status=all`, {
                    cache: 'no-store',
                })
                const payload = await response.json() as PoliciesPayload

                if (!response.ok || !Array.isArray(payload.data)) {
                    throw new Error(getPayloadError(payload, 'Unable to load policies'))
                }

                const nextPolicies = mergePolicyRecords(payload.data)

                if (!mounted) return
                setPolicies(nextPolicies)
                setInitialPolicies(nextPolicies)
                setSaveState('saved')
            } catch (error) {
                if (!mounted) return
                const message = error instanceof Error ? error.message : 'Unable to load policies'
                setLoadError(message)
                notify({
                    title: 'Policies could not load',
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

    const updatePolicy = useCallback((key: PolicyType, value: string) => {
        setPolicies((current) => current.map((policy) => (
            policy.key === key
                ? { ...policy, value, status: value.trim() ? 'published' : 'draft' }
                : policy
        )))
    }, [])

    const applyTemplate = useCallback((key: PolicyType) => {
        setPolicies((current) => current.map((policy) => (
            policy.key === key
                ? { ...policy, value: policy.template, status: 'published' }
                : policy
        )))
        notify({
            title: 'Starter template applied',
            description: 'Review the policy language before saving it to the storefront.',
            variant: 'info',
        })
    }, [notify])

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges || saveState === 'saving') return

        setSaveState('saving')

        try {
            const saved = await Promise.all(policies.map(async (policy) => {
                const body = policy.value.trim()
                const endpoint = policy.id
                    ? `/api/stores/${encodeURIComponent(store)}/policies/${encodeURIComponent(policy.id)}`
                    : `/api/stores/${encodeURIComponent(store)}/policies`
                const response = await fetch(endpoint, {
                    method: policy.id ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        policy_type: policy.key,
                        slug: policy.key,
                        title: policy.label,
                        body,
                        status: body ? 'published' : 'draft',
                    }),
                })
                const payload = await response.json().catch(() => null) as PoliciesPayload | null

                if (!response.ok || !payload?.data || Array.isArray(payload.data)) {
                    throw new Error(getPayloadError(payload, `Unable to save ${policy.label}`))
                }

                return payload.data
            }))

            const nextPolicies = mergePolicyRecords(saved)
            setPolicies(nextPolicies)
            setInitialPolicies(nextPolicies)
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
                store={store}
                title="Policies"
                description="Manage storefront and checkout policies that help customers buy with confidence."
                iconName="policies"
            >
                <Card>
                    <Section title="Policy overview">
                        <Skeleton variant="text" lines={4} />
                    </Section>
                </Card>
                <Card>
                    <Section title="Storefront policies">
                        <Skeleton variant="text" lines={6} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            store={store}
            title="Policies"
            description="Manage storefront and checkout policies that help customers buy with confidence."
            iconName="policies"
            saveBar={(
                <SaveBar
                    state={activeSaveState}
                    onSave={() => void handleSave()}
                    onDiscard={handleDiscard}
                    saveLabel="Save policies"
                />
            )}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Policies could not load"
                    action={<Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Policy overview"
                    description="Review storefront policy coverage before publishing changes."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <PolicyMetric
                            icon={<FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Completed policies"
                            value={`${completedCount} of ${policies.length}`}
                            helper="Policies with customer-facing text"
                        />
                        <PolicyMetric
                            icon={<Shield className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Published"
                            value={`${publishedCount} published`}
                            helper={`${draftCount} draft or empty`}
                        />
                        <PolicyMetric
                            icon={<ClipboardList className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Templates"
                            value="4 starter templates"
                            helper="Refund, privacy, terms, and shipping"
                        />
                    </div>
                </Section>
            </Card>

            <Banner variant="info" title="Policies appear on your storefront">
                These policies are saved as storefront policy records and shown on public policy pages when published. Review starter templates before saving them.
            </Banner>

            <Card>
                <Section
                    title="Storefront policies"
                    description="Use simple merchant-facing language. Starter templates are local defaults that you can edit before saving."
                    action={<span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{completedCount} of {policies.length} complete</span>}
                >
                    <div className="grid gap-[var(--lb-space-4)]">
                        {policies.map((policy) => (
                            <PolicyEditor
                                key={policy.key}
                                policy={policy}
                                onApplyTemplate={applyTemplate}
                                onChange={updatePolicy}
                            />
                        ))}
                    </div>
                </Section>
            </Card>

            <Banner variant="warning" title="Legal review required">
                Starter templates are operational defaults only. A merchant or legal reviewer must confirm final wording, marketplace-specific disclosures, and regional compliance before publishing.
            </Banner>
        </SettingsPane>
    )
}
