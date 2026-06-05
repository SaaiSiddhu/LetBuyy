'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
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
        description: 'Export customer contact records for support and lifecycle work.',
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

function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}

function toCsvRow(values: (string | number | boolean | null | undefined)[]) {
    return values.map((value) => {
        if (value == null) return ''
        const stringValue = String(value)
        return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue
    }).join(',')
}

function parseCsvRow(line: string) {
    const result: string[] = []
    let field = ''
    let inQuotes = false

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index]
        if (inQuotes) {
            if (character === '"' && line[index + 1] === '"') {
                field += '"'
                index += 1
            } else if (character === '"') {
                inQuotes = false
            } else {
                field += character
            }
        } else if (character === '"') {
            inQuotes = true
        } else if (character === ',') {
            result.push(field.trim())
            field = ''
        } else {
            field += character
        }
    }

    result.push(field.trim())
    return result
}

export default function ExportPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [exporting, setExporting] = useState<ExportType | null>(null)
    const [importing, setImporting] = useState(false)
    const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null)
    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [statusFilter, setStatusFilter] = useState('')

    const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

    const handleExport = async (type: ExportType) => {
        if (exporting) return
        setExporting(type)

        try {
            if (type === 'products') {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products?limit=100`, { cache: 'no-store' })
                const payload = await response.json().catch(() => null)
                if (!response.ok) throw new Error(getErrorMessage(payload, 'Unable to export products'))

                const data = Array.isArray(payload?.data) ? payload.data : []
                if (data.length === 0) {
                    notify({
                        title: 'No products to export',
                        description: 'Add products before downloading a product CSV.',
                        variant: 'warning',
                    })
                    return
                }

                const headers = ['id', 'name', 'description', 'price', 'compare_price', 'category', 'stock', 'is_active', 'tags', 'images', 'created_at']
                const rows = [
                    toCsvRow(headers),
                    ...data.map((product: Record<string, unknown>) => toCsvRow([
                        product.id as string,
                        product.name as string,
                        product.description as string,
                        Number(product.price || 0),
                        Number(product.compare_price || 0),
                        product.category as string,
                        Number(product.stock || 0),
                        Boolean(product.is_active),
                        ((product.tags as string[]) || []).join(';'),
                        ((product.images as string[]) || []).join(';'),
                        product.created_at as string,
                    ])),
                ]
                downloadCsv(rows.join('\n'), `products-${today}.csv`)
                notify({
                    title: 'Products exported',
                    description: `${data.length.toLocaleString('en-IN')} products were downloaded as CSV.`,
                    variant: 'success',
                })
            } else if (type === 'orders') {
                const query = new URLSearchParams({ limit: '100' })
                if (statusFilter) query.set('status', statusFilter)
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders?${query.toString()}`, { cache: 'no-store' })
                const payload = await response.json().catch(() => null)
                if (!response.ok) throw new Error(getErrorMessage(payload, 'Unable to export orders'))

                const data = Array.isArray(payload?.data) ? payload.data : []
                if (data.length === 0) {
                    notify({
                        title: 'No orders to export',
                        description: 'Try another status filter or wait for orders to arrive.',
                        variant: 'warning',
                    })
                    return
                }

                const headers = ['order_number', 'status', 'customer_name', 'customer_email', 'customer_phone', 'subtotal', 'shipping_cost', 'discount', 'total', 'payment_method', 'payment_status', 'tracking_number', 'carrier', 'created_at']
                const rows = [
                    toCsvRow(headers),
                    ...data.map((order: Record<string, unknown>) => toCsvRow([
                        order.order_number as string,
                        order.status as string,
                        order.customer_name as string,
                        order.customer_email as string,
                        order.customer_phone as string,
                        Number(order.subtotal || 0),
                        Number(order.shipping_cost || 0),
                        Number(order.discount || 0),
                        Number(order.total || 0),
                        order.payment_method as string,
                        order.payment_status as string,
                        order.tracking_number as string,
                        order.carrier as string,
                        order.created_at as string,
                    ])),
                ]
                downloadCsv(rows.join('\n'), `orders-${today}.csv`)
                notify({
                    title: 'Orders exported',
                    description: `${data.length.toLocaleString('en-IN')} orders were downloaded as CSV.`,
                    variant: 'success',
                })
            } else {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/customers?limit=100`, { cache: 'no-store' })
                const payload = await response.json().catch(() => null)
                if (!response.ok) throw new Error(getErrorMessage(payload, 'Unable to export customers'))

                const data = Array.isArray(payload?.data) ? payload.data : []
                if (data.length === 0) {
                    notify({
                        title: 'No customers to export',
                        description: 'Customer records will be available after checkout or account activity.',
                        variant: 'warning',
                    })
                    return
                }

                const headers = ['email', 'name', 'phone', 'created_at']
                const rows = [
                    toCsvRow(headers),
                    ...data.map((customer: Record<string, unknown>) => toCsvRow([
                        customer.customer_email as string,
                        customer.customer_name as string,
                        customer.customer_phone as string,
                        customer.created_at as string,
                    ])),
                ]
                downloadCsv(rows.join('\n'), `customers-${today}.csv`)
                notify({
                    title: 'Customers exported',
                    description: `${data.length.toLocaleString('en-IN')} customers were downloaded as CSV.`,
                    variant: 'success',
                })
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Export failed. Please try again.'
            notify({
                title: 'Export failed',
                description: message,
                variant: 'critical',
            })
        } finally {
            setExporting(null)
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
        if (!file || importing) return
        setSelectedImportFile(file)
        setImportResult(null)
        event.target.value = ''
    }

    const handleImportSelectedFile = async () => {
        if (!selectedImportFile || importing) return
        setImporting(true)
        setImportResult(null)

        try {
            const text = await selectedImportFile.text()
            const lines = text.split(/\r?\n/).filter((line) => line.trim())
            if (lines.length < 2) {
                const message = 'CSV must have headers and at least one product row.'
                setImportResult({ tone: 'critical', message })
                notify({ title: 'Import file is incomplete', description: message, variant: 'critical' })
                clearImportFile()
                return
            }

            const headers = parseCsvRow(lines[0]).map((header) => header.toLowerCase())
            if (!headers.includes('name')) {
                const message = 'CSV must include a name column.'
                setImportResult({ tone: 'critical', message })
                notify({ title: 'Import file needs a name column', description: message, variant: 'critical' })
                clearImportFile()
                return
            }

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv: text }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to import products'))
            }

            const jobId = typeof payload?.data?.job?.id === 'string' ? payload.data.job.id : null
            const message = jobId
                ? `Product import queued. Job ${jobId.slice(0, 8)} will finish in the background.`
                : 'Product import queued and will finish in the background.'
            clearImportFile()
            setImportResult({ tone: 'success', message })
            notify({
                title: 'Import queued',
                description: message,
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to parse CSV file.'
            clearImportFile()
            setImportResult({ tone: 'critical', message })
            notify({
                title: 'Import failed',
                description: message,
                variant: 'critical',
            })
        } finally {
            setImporting(false)
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
                                        disabled={Boolean(exporting)}
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
                    {importResult && (
                        <Banner
                            variant={importResult.tone === 'success' ? 'success' : 'critical'}
                            title={importResult.tone === 'success' ? 'Import complete' : 'Import needs attention'}
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
                                disabled={importing}
                            >
                                <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                {importing ? 'Importing...' : selectedImportFile ? 'Change CSV file' : 'Choose CSV file'}
                            </Button>
                        </div>
                        <input
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
