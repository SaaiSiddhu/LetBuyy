'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge, Card } from '@letbuyy/ui'
import { formatInrCurrency } from '@letbuyy/ui/formatting'

interface FoundingStatus {
    is_founding_merchant: boolean
    founding_number: number | null
    allocation_source: string | null
    price_lock_enabled: boolean
    locked_launch_price: number | null
    locked_growth_price: number | null
    founding_allocated_at: string | null
    allocation: {
        plan_slug?: string
        locked_monthly_price?: number
        benefits?: Record<string, unknown>
    } | null
}

function storeParam(value: string | string[] | undefined): string {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value[0] ?? ''
    return ''
}

// Renders ONLY for founding merchants. Silent (null) while loading / for non-founders,
// so it appears for the small set of founders without flashing for everyone else.
export function FoundingMerchantCard() {
    const params = useParams<{ store: string }>()
    const store = storeParam(params?.store)
    const [status, setStatus] = useState<FoundingStatus | null>(null)

    useEffect(() => {
        if (!store) return
        let active = true
        fetch(`/api/stores/${encodeURIComponent(store)}/founding`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
            .then((j) => { if (active) setStatus((j?.data ?? null) as FoundingStatus | null) })
            .catch(() => { if (active) setStatus(null) })
        return () => { active = false }
    }, [store])

    if (!status || !status.is_founding_merchant) return null

    const lockedPaise = status.allocation?.locked_monthly_price
        ?? (status.allocation?.plan_slug === 'growth' ? status.locked_growth_price : status.locked_launch_price)
        ?? null
    const lockedMonthly = lockedPaise != null ? formatInrCurrency(lockedPaise / 100) : null
    const planLabel = status.allocation?.plan_slug === 'growth' ? 'Growth' : 'Launch'
    const joined = status.founding_allocated_at
        ? new Date(status.founding_allocated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : null

    return (
        <Card>
            <div className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-5)]">
                <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)]">
                    <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                        🏆 Founding Merchant #{status.founding_number}
                    </h3>
                    {status.allocation_source ? (
                        <Badge label={status.allocation_source} variant="info" />
                    ) : null}
                </div>

                <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                    {lockedMonthly
                        ? `${planLabel} price locked forever at ${lockedMonthly}/month. Future price changes will never affect you.`
                        : 'Your founding price is locked for life. Future price changes will never affect you.'}
                </p>

                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Badge label="Price Locked Forever" variant="success" />
                    <Badge label="Priority Support" variant="default" />
                    <Badge label="Early Access" variant="default" />
                    <Badge label="Feature Preview" variant="default" />
                </div>

                {joined ? (
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Founding member since {joined}
                    </p>
                ) : null}
            </div>
        </Card>
    )
}
