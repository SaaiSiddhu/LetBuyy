'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { ExportJobSummary } from '@letbuyy/api-client'
import { useReadRequest } from '@/lib/api/use-read-request'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { Button,
    Badge,
    Banner,
    Card,
    ClipboardList,
    Download,
    Package,
    Page,
    PageHeader,
    Section,
    Select,
    Users,
    useToast,
} from '@letbuyy/ui'
import type { LucideIcon } from '@letbuyy/ui'

type ExportType = 'products' | 'orders' | 'customers'

interface ExportCard {
    type: ExportType
    title: string
    description: string
    icon: LucideIcon
}


const exportCards: ExportCard[] = [
    {
        type: 'products',
        title: 'Products',
        description: 'Export product names, pricing, inventory, tags, images, and creation dates.',
        icon: Package,
    },
    {
        type: 'orders',
        title: 'Orders',
        description: 'Export order history with customer, payment, shipping, and tracking details.',
        icon: ClipboardList,
    },
    {
        type: 'customers',
        title: 'Customers',
        description: 'Export saved customer profiles, contact details, and marketing preferences.',
        icon: Users,
    },
]

const statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Processing', value: 'processing' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
]

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

function useExportJobStatus(store: string) {
    const noun='export'
    const [job, setJob] = useState<ExportJobSummary | null>(null)
    const [pollError, setPollError] = useState<string | null>(null)
    const [pollAttempt, setPollAttempt] = useState(0)
    const beginRead = useReadRequest(store)
    const jobId = job?.id
    const preparing = job?.status === 'queued' || job?.status === 'running'

    useEffect(() => {
        if (!jobId || !preparing) return
        let active = true
        let timer: ReturnType<typeof setTimeout> | undefined
        let delay = 1_000
        const started = Date.now()
        setPollError(null)
        const poll = async () => {
            const request = beginRead()
            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/exports/${encodeURIComponent(jobId)}`, { cache: 'no-store', signal: request.signal })
                const payload = await response.json()
                if (!active || !request.isCurrent()) return
                if (!response.ok || payload?.data?.job?.id !== jobId) throw new Error(`Unable to check ${noun}. Check again to resume.`)
                const next = payload.data.job as ExportJobSummary
                setJob(next)
                if (next.status === 'queued' || next.status === 'running') {
                    if (Date.now() - started >= 120_000) setPollError(`Your ${noun} is still preparing. Check again in a moment.`)
                    else {
                        timer = setTimeout(() => void poll(), delay)
                        delay = Math.min(5_000, delay * 2)
                    }
                }
            } catch {
                if (active && request.isCurrent()) setPollError(`Unable to check ${noun}. Check again to resume.`)
            }
        }
        void poll()
        return () => { active = false; clearTimeout(timer) }
    }, [beginRead, store, jobId, preparing, pollAttempt, noun])

    return { job, setJob, pollError, setPollError, preparing, beginRead, checkAgain: () => setPollAttempt(value => value + 1) }
}

export default function ExportPage() {
    const { store } = useParams<{ store: string }>()
    const { actorId } = useMerchantSecurityContext(store)
    return <ExportWorkspace key={`${actorId}:${store}`} store={store} />
}

function ExportWorkspace({ store }: { store: string }) {
    const { notify } = useToast()
    const [exporting, setExporting] = useState<ExportType | null>(null)
    const [statusFilter, setStatusFilter] = useState('')

    const { job, setJob, pollError, setPollError, preparing, beginRead, checkAgain } = useExportJobStatus(store)
    const handleExport = async (type: ExportType) => {
        if (exporting || preparing) return
        setExporting(type)
        setJob(null)
        setPollError(null)
        const request = beginRead()
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/exports`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, ...(type === 'orders' && statusFilter ? { status: statusFilter } : {}) }),
                signal: request.signal,
            })
            const payload = await response.json()
            if (!request.isCurrent()) return
            if (!response.ok || !payload?.data?.job?.id) throw new Error(getErrorMessage(payload, 'Unable to prepare export'))
            setJob(payload.data.job)
        } catch {
            if (request.isCurrent()) notify({ title: 'Export could not be confirmed', description: 'It may still be preparing. You can request a new export.', variant: 'critical' })
        } finally {
            if (request.isCurrent()) setExporting(null)
        }
    }

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Export and import"
                description="Move store data safely with CSV exports and product imports."
                breadcrumbs={[{ label: 'Store' }, { label: 'Export and import' }]}
            />

            <Card>
                <Section
                    title="Export data"
                    description="Download operational data in CSV format for audits, support, and external workflows."
                    action={<Badge label="CSV" variant="info" />}
                >
                    {job && (
                        <Banner variant={job.status === 'failed' ? 'critical' : job.status === 'completed' ? 'success' : 'info'}
                            title={job.status === 'completed' ? 'Export ready' : job.status === 'failed' ? 'Export needs attention' : 'Preparing export'}>
                            {job.status === 'completed' ? (
                                <>
                                    <p>{typeof job.row_count!=='number'?'The export is ready; its record count could not be confirmed.':`${job.row_count.toLocaleString('en-IN')} records are ready to download.`}</p>
                                    <Button asChild><a href={`/api/stores/${encodeURIComponent(store)}/exports/${encodeURIComponent(job.id)}/download`} download={`${job.type}.csv`}>Download CSV</a></Button>
                                </>
                            ) : job.status === 'failed' ? 'The file could not be prepared. Request a new export to try again.' : (
                                <>
                                    <p>{pollError || 'Keep this page open while your complete export is prepared.'}</p>
                                    {pollError && <Button type="button" variant="secondary" onClick={checkAgain}>Check again</Button>}
                                </>
                            )}
                        </Banner>
                    )}
                    <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-3">
                        {exportCards.map((card) => {
                            const Icon = card.icon
                            return (
                                <div
                                    key={card.type}
                                    className="flex h-full flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]"
                                >
                                    <div className="flex items-start gap-[var(--lb-space-3)]">
                                        <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                            <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                {card.title}
                                            </h3>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {card.description}
                                            </p>
                                        </div>
                                    </div>
                                    {card.type === 'orders' && (
                                        <Select
                                            label="Order status"
                                            value={statusFilter}
                                            options={statusOptions}
                                            onChange={(event) => setStatusFilter(event.target.value)}
                                        />
                                    )}
                                    <Button
                                        type="button"
                                        className="mt-auto w-full"
                                        onClick={() => void handleExport(card.type)}
                                        loading={exporting === card.type}
                                        disabled={Boolean(exporting) || preparing}
                                    >
                                        <Download className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        {exporting === card.type ? 'Exporting...' : `Export ${card.title}`}
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </Section>
            </Card>

            <Card><Section title="Import products" description="Create products from CSV, review exact progress and recover or stop the original import.">
                <Button asChild><a href={`/${encodeURIComponent(store)}/products/import`}>Open CSV imports</a></Button>
            </Section></Card>
        </Page>
    )
}
