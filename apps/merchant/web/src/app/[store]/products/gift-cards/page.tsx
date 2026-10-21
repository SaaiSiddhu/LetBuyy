'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { GIFT_CARD_STATUS_PRESENTATION, presentStatus } from '@letbuyy/shared-types'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import { Badge, Banner, Button, Card, Copy, CreditCard, Drawer, EmptyState, Eye, IndianRupee, Input, Lock, Mail, Page, PageHeader, Plus, RefreshCw, SaveBar, Section, ShieldCheck, Skeleton, StatusPresentationBadge, Table, useToast } from '@letbuyy/ui'

interface GiftCard {
    id: string
    code_last4: string
    initial_value: number
    balance: number
    currency: string
    status: string
    fraud_hold_reason: string | null
    expires_at: string | null
    created_at: string
    recipient_email: string | null
    redemption_count: number
}

interface LedgerEntry {
    id: string
    entry_type: string
    amount: number
    balance_after: number
    order_id: string | null
    created_at: string
}

interface Redemption {
    id: string
    order_id: string
    amount: number
    status: string
    created_at: string
}

interface CardTransactions {
    found: boolean
    code_last4?: string
    balance?: number
    status?: string
    ledger: LedgerEntry[]
    redemptions: Redemption[]
}

interface IssuedCard {
    id: string
    code: string
    code_last4: string
    balance: number
    currency: string
    recipient_email: string | null
}

const emptyValue = ''

function getErrorMessage(payload: unknown, fallback: string) {
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

function normalizeGiftCard(row: Record<string, unknown>): GiftCard {
    return {
        id: String(row.id || ''),
        code_last4: String(row.code_last4 || ''),
        initial_value: Number(row.initial_value || 0),
        balance: Number(row.balance || 0),
        currency: String(row.currency || 'INR'),
        status: String(row.status || 'active'),
        fraud_hold_reason: typeof row.fraud_hold_reason === 'string' ? row.fraud_hold_reason : null,
        expires_at: typeof row.expires_at === 'string' ? row.expires_at : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : '',
        recipient_email: typeof row.recipient_email === 'string' ? row.recipient_email : null,
        redemption_count: Number(row.redemption_count || 0),
    }
}

function maskCode(last4: string) {
    return `•••• ${last4 || 'card'}`
}

function statusLabel(status: string) {
    return status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : 'Active'
}

function ledgerLabel(entryType: string) {
    const map: Record<string, string> = {
        issued: 'Issued',
        debit: 'Redeemed',
        credit: 'Credited',
        refund_credit: 'Refund credit',
        hold: 'Held',
        release: 'Released',
        expire: 'Expired',
        fraud_hold: 'Fraud hold',
    }
    return map[entryType] || entryType
}

export default function GiftCardsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [giftCards, setGiftCards] = useState<GiftCard[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [newValue, setNewValue] = useState(emptyValue)
    const [recipientEmail, setRecipientEmail] = useState(emptyValue)
    const [creating, setCreating] = useState(false)
    const [issuedCard, setIssuedCard] = useState<IssuedCard | null>(null)
    const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
    const [txCard, setTxCard] = useState<GiftCard | null>(null)
    const [txData, setTxData] = useState<CardTransactions | null>(null)
    const [txLoading, setTxLoading] = useState(false)

    const beginLoadGiftCards = useReadRequest(store)
    const loadGiftCards = useCallback(async () => {
        const request = beginLoadGiftCards()
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/gift-cards`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)

            if (!request.isCurrent()) return
            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load gift cards'))
            }

            const nextGiftCards = Array.isArray(payload?.data)
                ? payload.data.map((row: Record<string, unknown>) => normalizeGiftCard(row)).filter((card: GiftCard) => card.id)
                : []
            setGiftCards(nextGiftCards)
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load gift cards'
            setGiftCards([])
            setLoadError(message)
            notify({
                title: 'Gift cards could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginLoadGiftCards, notify, store])

    useEffect(() => {
        void loadGiftCards()
    }, [loadGiftCards])

    const parsedValue = Number.parseFloat(newValue)
    const hasValidValue = Number.isFinite(parsedValue) && parsedValue > 0
    const hasUnsavedCreate = showCreate && newValue.trim() !== emptyValue
    const saveState = creating ? 'saving' : hasUnsavedCreate ? 'unsaved' : 'saved'

    const resetCreateForm = useCallback(() => {
        setShowCreate(false)
        setNewValue(emptyValue)
        setRecipientEmail(emptyValue)
    }, [])

    const handleCreate = useCallback(async () => {
        if (creating) return
        const value = Number.parseFloat(newValue)
        if (!Number.isFinite(value) || value <= 0) {
            notify({
                title: 'Gift card value is required',
                description: 'Enter a value greater than zero before issuing a gift card.',
                variant: 'warning',
            })
            return
        }

        setCreating(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/gift-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initial_value: value,
                    recipient_email: recipientEmail.trim() || undefined,
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to issue gift card'))
            }

            const issued = payload?.data as Record<string, unknown> | undefined
            const code = typeof issued?.code === 'string' ? issued.code : ''
            if (code) {
                setIssuedCard({
                    id: String(issued?.id || ''),
                    code,
                    code_last4: String(issued?.code_last4 || ''),
                    balance: Number(issued?.balance || value),
                    currency: String(issued?.currency || 'INR'),
                    recipient_email: typeof issued?.recipient_email === 'string' ? issued.recipient_email : (recipientEmail.trim() || null),
                })
            }
            resetCreateForm()
            notify({
                title: 'Gift card issued',
                description: `${formatInrCurrency(value, { maximumFractionDigits: 0 }) || '₹0'} gift card is ready to share.`,
                variant: 'success',
            })
            await loadGiftCards()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to issue gift card'
            notify({
                title: 'Could not issue gift card',
                description: message,
                variant: 'critical',
            })
        } finally {
            setCreating(false)
        }
    }, [creating, loadGiftCards, newValue, notify, recipientEmail, resetCreateForm, store])

    const copyCode = useCallback(async (code: string) => {
        try {
            await navigator.clipboard.writeText(code)
            notify({ title: 'Code copied', description: 'Gift card code copied to clipboard.', variant: 'success' })
        } catch {
            notify({ title: 'Copy failed', description: 'Select and copy the code manually.', variant: 'warning' })
        }
    }, [notify])

    const changeStatus = useCallback(async (card: GiftCard, status: 'active' | 'disabled') => {
        setStatusBusyId(card.id)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/gift-cards/${encodeURIComponent(card.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reason: status === 'disabled' ? 'Disabled by merchant' : null }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to update gift card'))
            }
            notify({
                title: status === 'disabled' ? 'Gift card disabled' : 'Gift card reactivated',
                description: status === 'disabled' ? 'This card can no longer be redeemed.' : 'This card can be redeemed again.',
                variant: 'success',
            })
            await loadGiftCards()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update gift card'
            notify({ title: 'Could not update gift card', description: message, variant: 'critical' })
        } finally {
            setStatusBusyId(null)
        }
    }, [loadGiftCards, notify, store])

    const openTransactions = useCallback(async (card: GiftCard) => {
        setTxCard(card)
        setTxData(null)
        setTxLoading(true)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/gift-cards/${encodeURIComponent(card.id)}`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load transactions'))
            }
            const data = payload?.data as Record<string, unknown> | undefined
            setTxData({
                found: Boolean(data?.found),
                code_last4: typeof data?.code_last4 === 'string' ? data.code_last4 : card.code_last4,
                balance: Number(data?.balance ?? card.balance),
                status: typeof data?.status === 'string' ? data.status : card.status,
                ledger: Array.isArray(data?.ledger) ? (data.ledger as LedgerEntry[]) : [],
                redemptions: Array.isArray(data?.redemptions) ? (data.redemptions as Redemption[]) : [],
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load transactions'
            notify({ title: 'Could not load transactions', description: message, variant: 'critical' })
            setTxData({ found: false, ledger: [], redemptions: [] })
        } finally {
            setTxLoading(false)
        }
    }, [notify, store])

    const columns = useMemo(() => [
        {
            key: 'code',
            header: 'Code',
            render: (row: GiftCard) => (
                <code className="rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]">
                    {maskCode(row.code_last4)}
                </code>
            ),
        },
        {
            key: 'initial_value',
            header: 'Initial value',
            render: (row: GiftCard) => formatInrCurrency(row.initial_value, { maximumFractionDigits: 0 }) || '₹0',
        },
        {
            key: 'balance',
            header: 'Balance',
            render: (row: GiftCard) => formatInrCurrency(row.balance, { maximumFractionDigits: 0 }) || '₹0',
        },
        {
            key: 'status',
            header: 'Status',
            render: (row: GiftCard) => (
                <StatusPresentationBadge presentation={presentStatus(GIFT_CARD_STATUS_PRESENTATION, row.status)} />
            ),
        },
        {
            key: 'redemption_count',
            header: 'Redemptions',
            render: (row: GiftCard) => String(row.redemption_count || 0),
        },
        {
            key: 'created_at',
            header: 'Created',
            render: (row: GiftCard) => row.created_at
                ? new Date(row.created_at).toLocaleDateString('en-IN')
                : 'Not available',
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (row: GiftCard) => (
                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Button type="button" variant="ghost" onClick={() => void openTransactions(row)}>
                        <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Transactions
                    </Button>
                    {row.status === 'active' ? (
                        <Button
                            type="button"
                            variant="destructive"
                            loading={statusBusyId === row.id}
                            disabled={statusBusyId === row.id}
                            onClick={() => void changeStatus(row, 'disabled')}
                        >
                            <Lock className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Disable
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            loading={statusBusyId === row.id}
                            disabled={statusBusyId === row.id || row.status === 'expired'}
                            onClick={() => void changeStatus(row, 'active')}
                        >
                            <ShieldCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Reactivate
                        </Button>
                    )}
                </div>
            ),
        },
    ], [changeStatus, openTransactions, statusBusyId])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Gift cards"
                    description="Issue gift card balances that customers can redeem at checkout."
                    breadcrumbs={[{ label: 'Money' }, { label: 'Gift cards' }]}
                />
                <Card>
                    <Section title="Gift card list">
                        <Skeleton variant="table" lines={6} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Gift cards"
                description="Issue gift card balances that customers can redeem at checkout."
                breadcrumbs={[{ label: 'Money' }, { label: 'Gift cards' }]}
                primaryAction={{
                    label: showCreate ? 'Issue gift card' : 'New gift card',
                    onClick: showCreate ? () => void handleCreate() : () => setShowCreate(true),
                    disabled: creating || (showCreate && !hasValidValue),
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadGiftCards(),
                        disabled: creating,
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Gift cards could not load"
                    action={<Button variant="secondary" onClick={() => void loadGiftCards()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            {issuedCard && (
                <Banner
                    variant="success"
                    title="Gift card issued — copy the code now"
                    action={<Button variant="ghost" onClick={() => setIssuedCard(null)}>Dismiss</Button>}
                >
                    <div className="flex flex-col gap-[var(--lb-space-2)]">
                        <p>
                            This is the only time the full code is shown. Share it with the customer
                            {issuedCard.recipient_email ? ` (also emailed to ${issuedCard.recipient_email})` : ''}.
                        </p>
                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                            <code className="rounded-md bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[var(--lb-font-size-body)] tracking-wider text-[var(--lb-color-text)]">
                                {issuedCard.code}
                            </code>
                            <Button type="button" variant="secondary" onClick={() => void copyCode(issuedCard.code)}>
                                <Copy className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Copy code
                            </Button>
                        </div>
                    </div>
                </Banner>
            )}

            {showCreate && (
                <Card>
                    <Section
                        title="Issue a new gift card"
                        description="A unique gift card code is generated automatically after issuing."
                    >
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-[minmax(0,320px)_minmax(0,320px)_1fr] md:items-end">
                            <Input
                                label="Initial value"
                                type="number"
                                min="1"
                                step="1"
                                value={newValue}
                                onChange={(event) => setNewValue(event.target.value)}
                                placeholder="500"
                                disabled={creating}
                                leftIcon={<IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                helperText="Value must be greater than zero."
                            />
                            <Input
                                label="Recipient email (optional)"
                                type="email"
                                value={recipientEmail}
                                onChange={(event) => setRecipientEmail(event.target.value)}
                                placeholder="friend@example.com"
                                disabled={creating}
                                leftIcon={<Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                helperText="When set, the code is emailed to the recipient."
                            />
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Button
                                    type="button"
                                    onClick={() => void handleCreate()}
                                    loading={creating}
                                    disabled={creating || !hasValidValue}
                                >
                                    <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Issue gift card
                                </Button>
                                <Button type="button" variant="secondary" onClick={resetCreateForm} disabled={creating}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Section>
                </Card>
            )}

            <Card>
                <Section
                    title="Gift card list"
                    description="Track issued balances and redemption status."
                    action={<Badge label={`${giftCards.length} total`} variant="info" />}
                >
                    {giftCards.length === 0 ? (
                        <EmptyState
                            icon={<CreditCard className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                            title="Sell or issue gift cards"
                            body="Gift cards can drive sales, attract new customers, and give shoppers a balance to redeem at checkout."
                            primaryAction={!showCreate ? (
                                <Button type="button" onClick={() => setShowCreate(true)}>
                                    <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Issue gift card
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        <Table
                            rows={giftCards}
                            columns={columns}
                            emptyState={(
                                <EmptyState
                                    icon={<CreditCard className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                                    title="No gift cards found"
                                    body="Issue a gift card to create a redeemable balance."
                                />
                            )}
                        />
                    )}
                </Section>
            </Card>

            <Drawer
                open={Boolean(txCard)}
                onClose={() => { setTxCard(null); setTxData(null) }}
                title={txCard ? `Gift card •••• ${txCard.code_last4}` : 'Gift card'}
                description="Ledger and redemption history for this gift card."
            >
                {txLoading ? (
                    <Skeleton variant="table" lines={6} />
                ) : txData && txData.found ? (
                    <div className="flex flex-col gap-[var(--lb-space-5)]">
                        <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]">
                            <Badge label={`Balance ${formatInrCurrency(txData.balance || 0, { maximumFractionDigits: 0 }) || '₹0'}`} variant="info" />
                            <StatusPresentationBadge presentation={presentStatus(GIFT_CARD_STATUS_PRESENTATION, txData.status || 'active')} />
                        </div>

                        <div>
                            <h3 className="mb-[var(--lb-space-2)] text-[var(--lb-font-size-heading-sm)] font-[var(--lb-font-weight-semibold)]">Ledger</h3>
                            {txData.ledger.length === 0 ? (
                                <p className="text-[var(--lb-color-text-subdued)]">No ledger entries yet.</p>
                            ) : (
                                <ul className="flex flex-col gap-[var(--lb-space-2)]">
                                    {txData.ledger.map((entry) => (
                                        <li key={entry.id} className="flex items-center justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border-subdued)] pb-[var(--lb-space-2)]">
                                            <span>{ledgerLabel(entry.entry_type)}</span>
                                            <span className="text-[var(--lb-color-text-subdued)]">{entry.created_at ? new Date(entry.created_at).toLocaleString('en-IN') : ''}</span>
                                            <span>{formatInrCurrency(entry.amount, { maximumFractionDigits: 0 }) || '₹0'}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <h3 className="mb-[var(--lb-space-2)] text-[var(--lb-font-size-heading-sm)] font-[var(--lb-font-weight-semibold)]">Redemptions</h3>
                            {txData.redemptions.length === 0 ? (
                                <p className="text-[var(--lb-color-text-subdued)]">No redemptions yet.</p>
                            ) : (
                                <ul className="flex flex-col gap-[var(--lb-space-2)]">
                                    {txData.redemptions.map((redemption) => (
                                        <li key={redemption.id} className="flex items-center justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border-subdued)] pb-[var(--lb-space-2)]">
                                            <span>Order {redemption.order_id?.slice(0, 8) || '—'}</span>
                                            <Badge label={statusLabel(redemption.status)} variant={redemption.status === 'committed' ? 'success' : 'default'} />
                                            <span>{formatInrCurrency(redemption.amount, { maximumFractionDigits: 0 }) || '₹0'}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ) : (
                    <EmptyState
                        icon={<CreditCard className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                        title="No transactions"
                        body="This gift card has no ledger or redemption history yet."
                    />
                )}
            </Drawer>

            <SaveBar
                state={saveState}
                onSave={() => void handleCreate()}
                onDiscard={resetCreateForm}
                saveLabel="Issue gift card"
            />
        </Page>
    )
}
