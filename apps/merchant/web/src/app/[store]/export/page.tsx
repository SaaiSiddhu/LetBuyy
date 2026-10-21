'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useParams } from 'next/navigation'
import type { ExportJobSummary } from '@letbuyy/api-client'
import { useReadRequest } from '@/lib/api/use-read-request'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { Button, Input,
    Badge,
    Banner,
    Card,
    ClipboardList,
    Download,
    Package,
    Page,
    PageHeader,
    SaveBar,
    Section,
    Select,
    Upload,
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

interface ImportResult {
    tone: 'success' | 'critical'
    message: string
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

function useJobStatus(store: string, noun: 'export' | 'import') {
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
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [exporting, setExporting] = useState<ExportType | null>(null)
    const [importing, setImporting] = useState(false)
    const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null)
    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [statusFilter, setStatusFilter] = useState('')

    const { job, setJob, pollError, setPollError, preparing, beginRead, checkAgain } = useJobStatus(store, 'export')
    const importStatus = useJobStatus(store, 'import')
    const importGeneration = useRef(0)
    useEffect(() => () => { importGeneration.current += 1 }, [])

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

    const clearImportFile = useCallback(() => {
        setSelectedImportFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || importing || importStatus.preparing) return
        setSelectedImportFile(file)
        setImportResult(null)
        event.target.value = ''
    }

    const handleImportSelectedFile = async () => {
        if (!selectedImportFile || importing || importStatus.preparing) return
        const generation = ++importGeneration.current
        const isCurrent = () => generation === importGeneration.current
        let commandSent = false
        setImporting(true)
        setImportResult(null)
        importStatus.setJob(null)
        importStatus.setPollError(null)

        try {
            // Gateway's existing JSON envelope limit is one Mi UTF-16 units.
            // Its largest possible UTF-8 CSV is below three MiB. Reject larger
            // files before reading them; the gateway owns CSV/row validation.
            if (selectedImportFile.size > 3 * 1_048_576) throw new Error('This CSV is too large. Split it into smaller files with at most 500 products each.')
            const text = await selectedImportFile.text()
            const gatewayEnvelopeCharacters = JSON.stringify({ store_id: '0'.repeat(36), csv: '' }).length
            if (text.length > 1_048_576 - gatewayEnvelopeCharacters) throw new Error('This CSV is too large. Split it into smaller files with at most 500 products each.')
            if (!isCurrent()) return
            const body = JSON.stringify({ csv: text })
            const storeScopeCharacters = gatewayEnvelopeCharacters - JSON.stringify({ csv: '' }).length
            if (body.length + storeScopeCharacters > 1_048_576) throw new Error('This CSV is too large. Split it into smaller files with at most 500 products each.')

            commandSent = true
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            })
            const payload = await response.json().catch(() => null)
            if (!isCurrent()) return

            if (!response.ok) {
                if (response.status < 500) commandSent = false
                throw new Error(getErrorMessage(payload, 'Unable to import products'))
            }

            if (typeof payload?.data?.job?.id !== 'string') throw new Error('Import acknowledgement is unavailable.')
            clearImportFile()
            importStatus.setJob(payload.data.job)
            notify({ title: 'Import queued', description: 'Keep this page open to check progress.', variant: 'success' })
        } catch (error) {
            if (!isCurrent()) return
            const message = commandSent
                ? 'The import could not be confirmed. Some products may already exist. Check your catalog before importing again.'
                : error instanceof Error ? error.message : 'Unable to read the CSV file.'
            clearImportFile()
            setImportResult({ tone: 'critical', message })
            notify({ title: 'Import needs attention', description: message, variant: 'critical' })
        } finally {
            if (isCurrent()) setImporting(false)
        }
    }

    const importSaveState = importing ? 'saving' : selectedImportFile ? 'unsaved' : 'saved'

    return (
        <Page>
            <PageHeader
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
                                    <p>{job.row_count.toLocaleString('en-IN')} records are ready to download.</p>
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

            <Card>
                <Section
                    title="Import products"
                    description="Upload a product CSV with a required name column and optional price, description, category, stock, tags, and image URL columns."
                    action={<Badge label="Products only" variant="default" />}
                >
                    {importStatus.job && (
                        <Banner variant={importStatus.job.status === 'failed' ? 'critical' : importStatus.job.status === 'completed' ? 'success' : 'info'}
                            title={importStatus.job.status === 'completed' ? 'Import complete' : importStatus.job.status === 'failed' ? 'Import needs attention' : 'Import queued'}>
                            {importStatus.job.status === 'completed'
                                ? `${importStatus.job.row_count.toLocaleString('en-IN')} ${importStatus.job.row_count === 1 ? 'product' : 'products'} imported.`
                                : importStatus.job.status === 'failed'
                                    ? 'Processing stopped. Some products may already exist. Check your catalog before importing this file again.'
                                    : <><p>{importStatus.pollError || 'Keep this page open while products are imported.'}</p>
                                        {importStatus.pollError && <Button type="button" variant="secondary" onClick={importStatus.checkAgain}>Check import again</Button>}</>}
                        </Banner>
                    )}
                    {importResult && (
                        <Banner
                            variant={importResult.tone === 'success' ? 'success' : 'critical'}
                            title={importResult.tone === 'success' ? 'Import queued' : 'Import needs attention'}
                        >
                            {importResult.message}
                        </Banner>
                    )}
                    {selectedImportFile && (
                        <Banner
                            variant="info"
                            title="CSV selected"
                        >
                            {`${selectedImportFile.name} is ready to import. Review the filename, then use the sticky import bar to continue.`}
                        </Banner>
                    )}
                    <div className="rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-5)]">
                        <div className="flex flex-col gap-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-[var(--lb-space-3)]">
                                <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                    <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                </span>
                                <div>
                                    <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                        Product CSV
                                    </h3>
                                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                        Choose a CSV file, confirm it in the save bar, and the imported row count appears as soon as processing finishes.
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => fileInputRef.current?.click()}
                                loading={importing}
                                disabled={importing || importStatus.preparing}
                            >
                                <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                {importing ? 'Importing...' : selectedImportFile ? 'Change CSV file' : 'Choose CSV file'}
                            </Button>
                        </div>
                        <Input unstyled
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            className="sr-only"
                            onChange={(event) => void handleImportFile(event)}
                        />
                    </div>
                </Section>
            </Card>
            <SaveBar
                state={importSaveState}
                onSave={() => void handleImportSelectedFile()}
                onDiscard={clearImportFile}
                saveLabel="Import CSV"
                discardLabel="Clear file"
            />
        </Page>
    )
}
