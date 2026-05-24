'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

type ExportType = 'products' | 'orders' | 'customers'

export default function ExportPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState<ExportType | null>(null)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState('')

    useEffect(() => {
        setLoading(false)
    }, [])

    const downloadCsv = (csv: string, filename: string) => {
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    const toCsvRow = (values: (string | number | boolean | null | undefined)[]) =>
        values.map(v => {
            if (v == null) return ''
            const s = String(v)
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
        }).join(',')

    const handleExport = async (type: ExportType) => {
        setExporting(type)
        try {
            if (type === 'products') {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products?limit=100`, { cache: 'no-store' })
                const payload = await response.json()
                const data = payload.data || []
                if (!data?.length) { alert('No products to export'); setExporting(null); return }
                const headers = ['id', 'name', 'description', 'price', 'compare_price', 'category', 'stock', 'is_active', 'tags', 'images', 'created_at']
                const rows = [toCsvRow(headers), ...data.map((p: Record<string, unknown>) => toCsvRow([p.id as string, p.name as string, p.description as string, Number(p.price || 0), Number(p.compare_price || 0), p.category as string, Number(p.stock || 0), Boolean(p.is_active), ((p.tags as string[]) || []).join(';'), ((p.images as string[]) || []).join(';'), p.created_at as string]))]
                downloadCsv(rows.join('\n'), `products-${new Date().toISOString().slice(0, 10)}.csv`)
            } else if (type === 'orders') {
                const query = new URLSearchParams({ limit: '100' })
                if (statusFilter) query.set('status', statusFilter)
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders?${query.toString()}`, { cache: 'no-store' })
                const payload = await response.json()
                const data = payload.data || []
                if (!data?.length) { alert('No orders to export'); setExporting(null); return }
                const headers = ['order_number', 'status', 'customer_name', 'customer_email', 'customer_phone', 'subtotal', 'shipping_cost', 'discount', 'total', 'payment_method', 'payment_status', 'tracking_number', 'carrier', 'created_at']
                const rows = [toCsvRow(headers), ...data.map((o: Record<string, unknown>) => toCsvRow([o.order_number as string, o.status as string, o.customer_name as string, o.customer_email as string, o.customer_phone as string, Number(o.subtotal || 0), Number(o.shipping_cost || 0), Number(o.discount || 0), Number(o.total || 0), o.payment_method as string, o.payment_status as string, o.tracking_number as string, o.carrier as string, o.created_at as string]))]
                downloadCsv(rows.join('\n'), `orders-${new Date().toISOString().slice(0, 10)}.csv`)
            } else if (type === 'customers') {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/customers?limit=100`, { cache: 'no-store' })
                const payload = await response.json()
                const data = payload.data || []
                if (!data?.length) { alert('No customers to export'); setExporting(null); return }
                const headers = ['email', 'name', 'phone', 'created_at']
                const rows = [toCsvRow(headers), ...data.map((c: Record<string, unknown>) => toCsvRow([c.customer_email as string, c.customer_name as string, c.customer_phone as string, c.created_at as string]))]
                downloadCsv(rows.join('\n'), `customers-${new Date().toISOString().slice(0, 10)}.csv`)
            }
        } catch (error) {
            console.error('Export error:', error)
            alert('Export failed. Please try again.')
        }
        setExporting(null)
    }

    const handleImportProducts = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.csv'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            setImporting(true)
            setImportResult(null)

            try {
                const text = await file.text()
                const lines = text.split(/\r?\n/).filter(l => l.trim())
                if (lines.length < 2) { setImportResult('CSV must have headers + at least one row'); setImporting(false); return }

                // Parse CSV
                const parseRow = (line: string) => {
                    const result: string[] = []
                    let field = '', inQ = false
                    for (let i = 0; i < line.length; i++) {
                        const c = line[i]
                        if (inQ) { if (c === '"' && line[i + 1] === '"') { field += '"'; i++ } else if (c === '"') { inQ = false } else { field += c } }
                        else { if (c === '"') { inQ = true } else if (c === ',') { result.push(field.trim()); field = '' } else { field += c } }
                    }
                    result.push(field.trim())
                    return result
                }

                const headers = parseRow(lines[0]).map(h => h.toLowerCase())
                const nameIdx = headers.indexOf('name')
                if (nameIdx === -1) { setImportResult('CSV must have a "name" column'); setImporting(false); return }

                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csv: text }),
                })
                const payload = await response.json()

                if (!response.ok) { setImportResult(`Import failed: ${payload.error || 'Unable to import products'}`); }
                else { setImportResult(`Successfully imported ${payload.data?.imported || 0} products!`) }
            } catch (error) {
                setImportResult('Failed to parse CSV file')
            }
            setImporting(false)
        }
        input.click()
    }

    if (loading) {
        return (
            <div style={{ padding: 32 }}>
                <div className="settings-skeleton" style={{ width: 200, height: 28, marginBottom: 24 }} />
                <div className="settings-skeleton" style={{ width: '100%', height: 200 }} />
            </div>
        )
    }

    const exportCards: { type: ExportType; title: string; desc: string; icon: string }[] = [
        { type: 'products', title: 'Products', desc: 'Export all products with name, price, stock, images, tags', icon: 'inventory_2' },
        { type: 'orders', title: 'Orders', desc: 'Export order history with customer details and payment info', icon: 'receipt_long' },
        { type: 'customers', title: 'Customers', desc: 'Export customer list with contact and purchase data', icon: 'group' },
    ]

    return (
        <div style={{ padding: 32, maxWidth: 960 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Export & Import</h1>
            <p style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 24 }}>Download your store data as CSV files, or bulk import products</p>

            {/* Export section */}
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                Export data
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
                {exportCards.map(card => (
                    <div key={card.type} style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--primary)' }}>{card.icon}</span>
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{card.title}</h3>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 16, lineHeight: 1.5 }}>{card.desc}</p>
                        {card.type === 'orders' && (
                            <div style={{ marginBottom: 12 }}>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)' }}
                                >
                                    <option value="">All statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="processing">Processing</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        )}
                        <button
                            onClick={() => handleExport(card.type)}
                            disabled={exporting === card.type}
                            style={{
                                width: '100%', padding: '8px 16px', fontSize: 12, fontWeight: 500,
                                background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
                                opacity: exporting === card.type ? 0.6 : 1,
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }}>download</span>
                            {exporting === card.type ? 'Exporting...' : 'Export CSV'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Import section */}
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload</span>
                Import data
            </h2>

            <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--primary)' }}>inventory_2</span>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Import products</h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 8, lineHeight: 1.5 }}>
                    Upload a CSV file with product data. Required column: <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>name</code>.
                    Optional: <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>price</code>, <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>description</code>, <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>category</code>, <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>stock</code>, <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>tags</code> (semicolon-separated), <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>images</code> (semicolon-separated URLs).
                </p>
                {importResult && (
                    <div style={{ padding: '8px 12px', fontSize: 12, borderRadius: 6, marginBottom: 12, background: importResult.startsWith('Successfully') ? 'rgba(72, 187, 120, 0.1)' : 'rgba(229, 62, 62, 0.1)', color: importResult.startsWith('Successfully') ? '#38a169' : '#e53e3e' }}>
                        {importResult}
                    </div>
                )}
                <button
                    onClick={handleImportProducts}
                    disabled={importing}
                    style={{
                        padding: '8px 16px', fontSize: 12, fontWeight: 500,
                        background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 6, cursor: 'pointer',
                        opacity: importing ? 0.6 : 1,
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }}>upload_file</span>
                    {importing ? 'Importing...' : 'Choose CSV file'}
                </button>
            </div>
        </div>
    )
}
