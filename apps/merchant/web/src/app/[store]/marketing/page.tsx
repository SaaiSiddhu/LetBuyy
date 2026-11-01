'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import type {
    MarketingEmailCampaign,
    MarketingEmailAudience,
    MarketingEmailAudiencePreview,
    MarketingEmailSendResult,
} from '@letbuyy/shared-types'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'
import {
    Badge,
    Banner,
    Button,
    Card,
    Input,
    MaterialIcon,
    Modal,
    Page,
    PageHeader,
    Section,
    Select,
    Skeleton,
    Table,
    Textarea,
    useToast,
    type TableColumn,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'

// ─── Local types ──────────────────────────────────────────────────────────────

type AudienceType = MarketingEmailAudience['type']
type CampaignStatus = MarketingEmailCampaign['status']

interface CampaignRow {
    id: string
    name: string
    subject: string
    status: CampaignStatus
    audience_type: AudienceType
    recipient_count: number
    sent_count: number
    failed_count: number
    delivery_mode: string
    created_at: string
    sent_at: string | null
}

interface CreateFormState {
    name: string
    subject: string
    preview_text: string
    body_text: string
    audience_type: AudienceType
    manual_recipients: string
}

interface AudiencePreviewState {
    loading: boolean
    count: number | null
    error: string | null
}

interface SendConfirmState {
    open: boolean
    campaignId: string
    campaignName: string
    recipientCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readString(row: Record<string, unknown>, key: string): string {
    const value = row[key]
    return typeof value === 'string' ? value : ''
}

function readNullableString(row: Record<string, unknown>, key: string): string | null {
    const value = row[key]
    return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(row: Record<string, unknown>, key: string): number {
    const value = row[key]
    return typeof value === 'number' ? value : Number(value || 0)
}

function getErrorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string') return message
    }
    return fallback
}

const VALID_STATUSES: ReadonlyArray<CampaignStatus> = [
    'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled',
]

function isCampaignStatus(value: string): value is CampaignStatus {
    return VALID_STATUSES.includes(value as CampaignStatus)
}

const VALID_AUDIENCE_TYPES: ReadonlyArray<AudienceType> = [
    'all_marketing', 'segment', 'manual',
]

function isAudienceType(value: string): value is AudienceType {
    return VALID_AUDIENCE_TYPES.includes(value as AudienceType)
}

function mapCampaign(row: Record<string, unknown>): CampaignRow {
    const statusRaw = readString(row, 'status')
    const audienceRaw = readString(row, 'audience_type')
    return {
        id: readString(row, 'id'),
        name: readString(row, 'name') || 'Untitled campaign',
        subject: readString(row, 'subject'),
        status: isCampaignStatus(statusRaw) ? statusRaw : 'draft',
        audience_type: isAudienceType(audienceRaw) ? audienceRaw : 'all_marketing',
        recipient_count: readNumber(row, 'recipient_count'),
        sent_count: readNumber(row, 'sent_count'),
        failed_count: readNumber(row, 'failed_count'),
        delivery_mode: readString(row, 'delivery_mode') || 'sandbox',
        created_at: readString(row, 'created_at'),
        sent_at: readNullableString(row, 'sent_at'),
    }
}

function statusVariant(status: CampaignStatus): 'success' | 'critical' | 'warning' | 'info' | 'default' {
    switch (status) {
        case 'sent': return 'success'
        case 'failed': return 'critical'
        case 'sending': return 'warning'
        case 'scheduled': return 'info'
        case 'cancelled': return 'default'
        case 'draft':
        default: return 'default'
    }
}

function statusLabel(status: CampaignStatus): string {
    switch (status) {
        case 'draft': return 'Draft'
        case 'scheduled': return 'Scheduled'
        case 'sending': return 'Sending'
        case 'sent': return 'Sent'
        case 'failed': return 'Failed'
        case 'cancelled': return 'Cancelled'
        default: return status
    }
}

function audienceLabel(type: AudienceType): string {
    switch (type) {
        case 'all_marketing': return 'All subscribers'
        case 'segment': return 'Segment'
        case 'manual': return 'Manual list'
        default: return type
    }
}

const EMPTY_FORM: CreateFormState = {
    name: '',
    subject: '',
    preview_text: '',
    body_text: '',
    audience_type: 'all_marketing',
    manual_recipients: '',
}

const EMPTY_SEND_CONFIRM: SendConfirmState = {
    open: false,
    campaignId: '',
    campaignName: '',
    recipientCount: 0,
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function MarketingCampaignsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    // List state
    const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Create modal state
    const [createOpen, setCreateOpen] = useState(false)
    const [form, setForm] = useState<CreateFormState>(EMPTY_FORM)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    // Audience preview state
    const [audiencePreview, setAudiencePreview] = useState<AudiencePreviewState>({
        loading: false,
        count: null,
        error: null,
    })

    // Send confirm state
    const [sendConfirm, setSendConfirm] = useState<SendConfirmState>(EMPTY_SEND_CONFIRM)
    const [sending, setSending] = useState(false)

    // Send result (dismissible info)
    const [sendResult, setSendResult] = useState<{
        sandbox: boolean
        sentCount: number
        failedCount: number
    } | null>(null)

    // ─── Fetch campaigns ───────────────────────────────────────────────────────

    const beginLoadCampaigns = useReadRequest(store)
    const loadCampaigns = useCallback(async () => {
        const request = beginLoadCampaigns()
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/marketing/campaigns?limit=50`,
                { cache: 'no-store', signal: request.signal },
            )
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return
            if (!response.ok) {
                setError(getErrorMessage(payload, 'Unable to load campaigns'))
                setCampaigns([])
                return
            }
            const rows = (Array.isArray(payload?.data) ? payload.data : []).map(mapCampaign)
            setCampaigns(rows)
        } catch {
            if (!request.isCurrent()) return
            setError('Unable to load campaigns')
            setCampaigns([])
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginLoadCampaigns, store])

    useEffect(() => { loadCampaigns() }, [loadCampaigns])

    // ─── Audience preview ──────────────────────────────────────────────────────

    function buildAudience(audienceType: AudienceType, manualRecipients: string): MarketingEmailAudience {
        if (audienceType === 'manual') {
            const recipients = manualRecipients
                .split(/[\n,;]+/)
                .map((e) => e.trim().toLowerCase())
                .filter((e) => e.includes('@'))
            return { type: 'manual', recipients }
        }
        return { type: audienceType, recipients: [] }
    }

    const previewAudience = useCallback(async (audienceType: AudienceType, manualRecipients: string) => {
        setAudiencePreview({ loading: true, count: null, error: null })
        try {
            const audience = buildAudience(audienceType, manualRecipients)
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/marketing/campaigns/audience-preview`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audience }),
                },
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                setAudiencePreview({
                    loading: false,
                    count: null,
                    error: getErrorMessage(payload, 'Unable to preview audience'),
                })
                return
            }
            const preview = payload?.data as MarketingEmailAudiencePreview | null
            setAudiencePreview({
                loading: false,
                count: preview?.customer_count ?? null,
                error: null,
            })
        } catch {
            setAudiencePreview({ loading: false, count: null, error: 'Unable to preview audience' })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store])

    // ─── Create campaign ───────────────────────────────────────────────────────

    const handleCreate = useCallback(async () => {
        if (!form.name.trim() || !form.subject.trim() || !form.body_text.trim()) {
            setCreateError('Campaign name, email subject, and body are required.')
            return
        }
        setCreating(true)
        setCreateError(null)
        try {
            const audience = buildAudience(form.audience_type, form.manual_recipients)
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/marketing/campaigns`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: form.name.trim(),
                        subject: form.subject.trim(),
                        body_text: form.body_text.trim(),
                        ...(form.preview_text.trim() ? { preview_text: form.preview_text.trim() } : {}),
                        audience,
                    }),
                },
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                setCreateError(getErrorMessage(payload, 'Unable to create campaign'))
                return
            }
            setCreateOpen(false)
            setForm(EMPTY_FORM)
            setAudiencePreview({ loading: false, count: null, error: null })
            notify({
                title: 'Campaign created',
                description: 'Your campaign has been saved as a draft.',
                variant: 'success',
            })
            await loadCampaigns()
        } catch {
            setCreateError('Unable to create campaign')
        } finally {
            setCreating(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, store, notify, loadCampaigns])

    // ─── Send campaign ─────────────────────────────────────────────────────────

    const openSendConfirm = useCallback((campaign: CampaignRow) => {
        setSendResult(null)
        setSendConfirm({
            open: true,
            campaignId: campaign.id,
            campaignName: campaign.name,
            recipientCount: campaign.recipient_count,
        })
    }, [])

    const handleSend = useCallback(async () => {
        if (!sendConfirm.campaignId) return
        setSending(true)
        try {
            const idempotency_key = crypto.randomUUID()
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/marketing/campaigns/${encodeURIComponent(sendConfirm.campaignId)}/send`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idempotency_key }),
                },
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                notify({
                    title: 'Send failed',
                    description: getErrorMessage(payload, 'Unable to send campaign'),
                    variant: 'critical',
                })
                setSendConfirm(EMPTY_SEND_CONFIRM)
                return
            }
            const result = payload?.data as MarketingEmailSendResult | null
            setSendConfirm(EMPTY_SEND_CONFIRM)
            if (result) {
                setSendResult({
                    sandbox: result.sandbox,
                    sentCount: result.sent_count,
                    failedCount: result.failed_count,
                })
            }
            const sentCount = result?.sent_count ?? 0
            notify({
                title: 'Campaign sent',
                description: `${sentCount} email${sentCount === 1 ? '' : 's'} sent.`,
                variant: 'success',
            })
            await loadCampaigns()
        } catch {
            notify({
                title: 'Send failed',
                description: 'Unable to send campaign',
                variant: 'critical',
            })
            setSendConfirm(EMPTY_SEND_CONFIRM)
        } finally {
            setSending(false)
        }
    }, [sendConfirm, store, notify, loadCampaigns])

    // ─── Form helpers ──────────────────────────────────────────────────────────

    const handleFormChange = useCallback(
        (field: keyof CreateFormState) =>
            (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                setForm((prev) => ({ ...prev, [field]: e.target.value }))
                setCreateError(null)
            },
        [],
    )

    const handleAudienceTypeChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const value = e.target.value
            if (!isAudienceType(value)) return
            setForm((prev) => ({ ...prev, audience_type: value, manual_recipients: '' }))
            setAudiencePreview({ loading: false, count: null, error: null })
        },
        [],
    )

    const handlePreviewAudience = useCallback(() => {
        previewAudience(form.audience_type, form.manual_recipients)
    }, [form.audience_type, form.manual_recipients, previewAudience])

    // ─── Table columns ─────────────────────────────────────────────────────────

    const columns: Array<TableColumn<CampaignRow>> = useMemo(
        () => [
            {
                key: 'name',
                header: 'Campaign',
                render: (row) => (
                    <div className="flex min-w-0 flex-col gap-[var(--lb-space-1)]">
                        <span className="min-w-0 truncate font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                            {row.name}
                        </span>
                        <span className="min-w-0 truncate text-[var(--lb-font-size-sm)] text-[var(--lb-color-text-subdued)]">
                            {row.subject}
                        </span>
                    </div>
                ),
            },
            {
                key: 'status',
                header: 'Status',
                render: (row) => (
                    <Badge label={statusLabel(row.status)} variant={statusVariant(row.status)} />
                ),
            },
            {
                key: 'audience_type',
                header: 'Audience',
                render: (row) => audienceLabel(row.audience_type),
            },
            {
                key: 'recipient_count',
                header: 'Recipients',
                render: (row) => String(row.recipient_count),
            },
            {
                key: 'sent_count',
                header: 'Sent / Failed',
                render: (row) =>
                    row.status === 'sent' || row.status === 'failed'
                        ? `${row.sent_count} / ${row.failed_count}`
                        : '—',
            },
            {
                key: 'delivery_mode',
                header: 'Mode',
                render: (row) => (
                    <Badge
                        label={row.delivery_mode === 'live' ? 'Live' : 'Sandbox'}
                        variant={row.delivery_mode === 'live' ? 'success' : 'default'}
                    />
                ),
            },
            {
                key: 'created_at',
                header: 'Created',
                render: (row) => formatDate(row.created_at),
            },
            {
                key: 'sent_at',
                header: 'Sent at',
                render: (row) => formatDate(row.sent_at) || '—',
            },
            {
                key: 'actions',
                header: '',
                render: (row) => {
                    if (
                        row.status === 'sent' ||
                        row.status === 'sending' ||
                        row.status === 'cancelled'
                    ) {
                        return null
                    }
                    return (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                                e.stopPropagation()
                                openSendConfirm(row)
                            }}
                        >
                            <MaterialIcon name="send" />
                            Send
                        </Button>
                    )
                },
            },
        ],
        [openSendConfirm],
    )

    // ─── Modals ────────────────────────────────────────────────────────────────

    const createFooter = (
        <div className="flex justify-end gap-[var(--lb-space-3)]">
            <Button
                variant="secondary"
                onClick={() => { setCreateOpen(false); setCreateError(null) }}
                disabled={creating}
            >
                Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
                Save as draft
            </Button>
        </div>
    )

    const sendFooter = (
        <div className="flex justify-end gap-[var(--lb-space-3)]">
            <Button
                variant="secondary"
                onClick={() => setSendConfirm(EMPTY_SEND_CONFIRM)}
                disabled={sending}
            >
                Cancel
            </Button>
            <Button onClick={handleSend} loading={sending}>
                <MaterialIcon name="send" />
                Send now
            </Button>
        </div>
    )

    // ─── Empty state ───────────────────────────────────────────────────────────

    const emptyState = (
        <EmptyState scene="marketing"
            icon={<MaterialIcon name={error ? 'error' : 'campaign'} />}
            title={error ? 'Unable to load campaigns' : 'No campaigns yet'}
            body={error ?? 'Create an email campaign to reach your subscribed customers.'}
            primaryAction={
                error ? (
                    <Button onClick={loadCampaigns}>
                        <MaterialIcon name="refresh" />
                        Retry
                    </Button>
                ) : (
                    <Button
                        onClick={() => {
                            setCreateOpen(true)
                            setCreateError(null)
                            setForm(EMPTY_FORM)
                            setAudiencePreview({ loading: false, count: null, error: null })
                        }}
                    >
                        <MaterialIcon name="add" />
                        Create campaign
                    </Button>
                )
            }
        />
    )

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <Page>
            <PageHeader identity="marketing"
                recipe="index"
                eyebrow="Marketing"
                title="Email Campaigns"
                description="Send emails to your subscribed customers. Emails are sent in sandbox mode until a live Resend API key is configured."
                breadcrumbs={[
                    { label: 'Home', href: `/${store}/dashboard` },
                    { label: 'Email Campaigns' },
                ]}
                primaryAction={{
                    label: 'Create campaign',
                    icon: <MaterialIcon name="add" />,
                    onClick: () => {
                        setCreateOpen(true)
                        setCreateError(null)
                        setForm(EMPTY_FORM)
                        setAudiencePreview({ loading: false, count: null, error: null })
                    },
                }}
                secondaryActions={[{ label: 'Customers', href: `/${store}/customers` }]}
            />

            {sendResult && (
                <Banner
                    title={sendResult.sandbox ? 'Campaign sent in sandbox mode' : 'Campaign sent'}
                    variant={sendResult.failedCount > 0 ? 'warning' : 'success'}
                >
                    {sendResult.sandbox
                        ? `${sendResult.sentCount} email${sendResult.sentCount === 1 ? '' : 's'} logged in sandbox — no real emails delivered. Configure RESEND_API_KEY to send live.`
                        : `${sendResult.sentCount} email${sendResult.sentCount === 1 ? '' : 's'} sent.${sendResult.failedCount > 0 ? ` ${sendResult.failedCount} failed.` : ''}`}
                    {' '}
                    <Button
                        unstyled
                        type="button"
                        className="text-[var(--lb-color-text)] underline"
                        onClick={() => setSendResult(null)}
                    >
                        Dismiss
                    </Button>
                </Banner>
            )}

            <Card>
                <Section
                    title="Campaigns"
                    description={`${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} total.`}
                    action={
                        <Button variant="secondary" size="sm" onClick={loadCampaigns}>
                            <MaterialIcon name="sync" />
                            Refresh
                        </Button>
                    }
                >
                    {loading ? (
                        <Skeleton variant="table" lines={5} />
                    ) : (
                        <Table rows={campaigns} columns={columns} emptyState={emptyState} />
                    )}
                </Section>
            </Card>

            {/* ── Create campaign modal ─────────────────────────────────────── */}
            <Modal
                open={createOpen}
                onClose={() => { setCreateOpen(false); setCreateError(null) }}
                title="Create email campaign"
                footer={createFooter}
            >
                <div className="flex flex-col gap-[var(--lb-space-5)]">
                    {createError && (
                        <Banner title="Unable to create campaign" variant="critical">
                            {createError}
                        </Banner>
                    )}

                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Input
                            label="Campaign name"
                            placeholder="e.g. Summer sale announcement"
                            value={form.name}
                            onChange={handleFormChange('name')}
                            required
                        />
                        <Input
                            label="Email subject"
                            placeholder="e.g. Your exclusive offer inside"
                            value={form.subject}
                            onChange={handleFormChange('subject')}
                            required
                        />
                    </div>

                    <Input
                        label="Preview text"
                        placeholder="Optional — shown after the subject in the inbox"
                        value={form.preview_text}
                        onChange={handleFormChange('preview_text')}
                        helperText="Short teaser shown in the inbox before the email is opened (under 90 characters recommended)."
                    />

                    <Textarea
                        label="Email body"
                        placeholder="Write your email content here…"
                        value={form.body_text}
                        onChange={handleFormChange('body_text')}
                        rows={8}
                        required
                        helperText="Plain text email body. The gateway generates a safe HTML wrapper automatically."
                    />

                    <Section
                        title="Audience"
                        description="Choose who receives this campaign."
                    >
                        <div className="flex flex-col gap-[var(--lb-space-4)]">
                            <Select
                                label="Audience type"
                                value={form.audience_type}
                                onChange={handleAudienceTypeChange}
                                options={[
                                    { label: 'All marketing subscribers', value: 'all_marketing' },
                                    { label: 'Manual email list', value: 'manual' },
                                ]}
                            />

                            {form.audience_type === 'manual' && (
                                <Textarea
                                    label="Recipient emails"
                                    placeholder="one@example.com, two@example.com"
                                    value={form.manual_recipients}
                                    onChange={handleFormChange('manual_recipients')}
                                    rows={4}
                                    helperText="Separate addresses with commas, semicolons, or new lines. Only opted-in addresses receive the email."
                                />
                            )}

                            <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handlePreviewAudience}
                                    loading={audiencePreview.loading}
                                >
                                    <MaterialIcon name="people" />
                                    Preview recipient count
                                </Button>
                                {audiencePreview.count !== null && !audiencePreview.loading && (
                                    <span className="text-[var(--lb-font-size-sm)] text-[var(--lb-color-text-subdued)]">
                                        <strong className="text-[var(--lb-color-text)]">
                                            {audiencePreview.count}
                                        </strong>
                                        {' '}eligible recipient{audiencePreview.count === 1 ? '' : 's'}
                                    </span>
                                )}
                                {audiencePreview.error && (
                                    <span className="text-[var(--lb-font-size-sm)] text-[var(--lb-color-critical)]">
                                        {audiencePreview.error}
                                    </span>
                                )}
                            </div>
                        </div>
                    </Section>

                    <Banner title="Sandbox mode is active" variant="info">
                        Emails are logged in the database but not delivered until a live{' '}
                        <strong>RESEND_API_KEY</strong> is configured in the worker environment.
                    </Banner>
                </div>
            </Modal>

            {/* ── Send confirm modal ────────────────────────────────────────── */}
            <Modal
                open={sendConfirm.open}
                onClose={() => { if (!sending) setSendConfirm(EMPTY_SEND_CONFIRM) }}
                title="Send this campaign?"
                footer={sendFooter}
            >
                <div className="flex flex-col gap-[var(--lb-space-4)]">
                    <p className="m-0 text-[var(--lb-font-size-base)] text-[var(--lb-color-text-subdued)]">
                        You are about to send{' '}
                        <strong className="text-[var(--lb-color-text)]">{sendConfirm.campaignName}</strong>{' '}
                        to up to{' '}
                        <strong className="text-[var(--lb-color-text)]">{sendConfirm.recipientCount}</strong>{' '}
                        recipient{sendConfirm.recipientCount === 1 ? '' : 's'}.
                    </p>
                    <Banner title="This action cannot be undone" variant="warning">
                        Once sent, the campaign cannot be recalled. If{' '}
                        <strong>RESEND_API_KEY</strong> is not configured, emails will be logged in sandbox mode only — no real emails will be delivered.
                    </Banner>
                </div>
            </Modal>
        </Page>
    )
}
