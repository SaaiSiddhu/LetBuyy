'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import { Badge, Banner, Button, Card, CreditCard, EmptyState, Table, IndianRupee, Input, Page, PageHeader, Plus, RefreshCw, SaveBar, Section, Skeleton, useToast } from '@letbuyy/ui'

interface GiftCard {
    id: string
    code: string
    initial_value: number
    balance: number
    status: string
    expires_at: string | null
    created_at: string
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
        code: String(row.code || ''),
        initial_value: Number(row.initial_value || 0),
        balance: Number(row.balance || 0),
        status: String(row.status || 'active'),
        expires_at: typeof row.expires_at === 'string' ? row.expires_at : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : '',
    }
}

function maskCode(code: string) {
    const suffix = code.split('-').pop() || code.slice(-4)
    return `•••• ${suffix || 'gift card'}`
}

function statusLabel(status: string) {
    return status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : 'Active'
}

export default function GiftCardsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [giftCards, setGiftCards] = useState<GiftCard[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [newValue, setNewValue] = useState(emptyValue)
    const [creating, setCreating] = useState(false)

    const loadGiftCards = useCallback(async () => {
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/gift-cards`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load gift cards'))
            }

            const nextGiftCards = Array.isArray(payload?.data)
                ? payload.data.map((row: Record<string, unknown>) => normalizeGiftCard(row)).filter((card: GiftCard) => card.id)
                : []
            setGiftCards(nextGiftCards)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load gift cards'
            setGiftCards([])
            setLoadError(message)
            notify({
                title: 'Gift cards could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

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
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to issue gift card'))
            }

            setShowCreate(false)
            setNewValue(emptyValue)
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
    }, [creating, loadGiftCards, newValue, notify, store])

    const columns = useMemo(() => [
        {
            key: 'code',
            header: 'Code',
            render: (row: GiftCard) => (
                <code className="rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]">
                    {maskCode(row.code)}
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
                <Badge
                    label={statusLabel(row.status)}
                    variant={row.status === 'active' ? 'success' : row.status === 'expired' ? 'warning' : 'default'}
                />
            ),
        },
        {
            key: 'created_at',
            header: 'Created',
            render: (row: GiftCard) => row.created_at
                ? new Date(row.created_at).toLocaleDateString('en-IN')
                : 'Not available',
        },
    ], [])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Gift cards"
                    description="Issue gift card balances that customers can redeem at checkout."
                    breadcrumbs={[{ label: 'Products' }, { label: 'Gift cards' }]}
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
                breadcrumbs={[{ label: 'Products' }, { label: 'Gift cards' }]}
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

            {showCreate && (
                <Card>
                    <Section
                        title="Issue a new gift card"
                        description="A unique gift card code is generated automatically after issuing."
                    >
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-[minmax(0,320px)_1fr] md:items-end">
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

            <SaveBar
                state={saveState}
                onSave={() => void handleCreate()}
                onDiscard={resetCreateForm}
                saveLabel="Issue gift card"
            />
        </Page>
    )
}
