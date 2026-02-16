'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PageItem {
    id: string
    title: string
    slug: string
    status: 'draft' | 'published' | 'archived'
    page_type: string
    show_in_nav: boolean
    updated_at: string
}

export default function PagesPage() {
    const params = useParams()
    const store = params.store as string
    const [pages, setPages] = useState<PageItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [saving, setSaving] = useState(false)

    const supabase = createClient()

    const fetchPages = async () => {
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .or(`store_name.eq.${store},subdomain.eq.${store}`)
            .single()

        if (!storeData) { setLoading(false); return }

        const { data } = await supabase
            .from('pages')
            .select('*')
            .eq('site_id', storeData.id)
            .order('display_order', { ascending: true })

        setPages(data || [])
        setLoading(false)
    }

    useEffect(() => { fetchPages() }, [store])

    const handleAdd = async () => {
        if (!newTitle.trim()) return
        setSaving(true)

        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .or(`store_name.eq.${store},subdomain.eq.${store}`)
            .single()

        if (!storeData) { setSaving(false); return }

        const slug = newTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

        await supabase.from('pages').insert({
            site_id: storeData.id,
            title: newTitle.trim(),
            slug,
            page_type: 'custom',
            status: 'draft',
        })

        setNewTitle('')
        setShowAdd(false)
        setSaving(false)
        fetchPages()
    }

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        })
    }

    return (
        <div className="online-store-page">
            <div className="os-page-header">
                <h1 className="os-page-title">Pages</h1>
                <button className="os-btn os-btn-primary" onClick={() => setShowAdd(true)}>
                    Add page
                </button>
            </div>

            {/* Add Page Inline Form */}
            {showAdd && (
                <div className="os-inline-form-card">
                    <h3>Create a new page</h3>
                    <div className="os-inline-form-row">
                        <input
                            type="text"
                            className="os-input"
                            placeholder="Page title"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            autoFocus
                        />
                        <button className="os-btn os-btn-primary" onClick={handleAdd} disabled={saving || !newTitle.trim()}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="os-btn os-btn-outline" onClick={() => { setShowAdd(false); setNewTitle('') }}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Pages Table */}
            {loading ? (
                <div className="os-loading">
                    <span className="material-symbols-outlined os-spin">progress_activity</span>
                    Loading pages...
                </div>
            ) : pages.length === 0 && !showAdd ? (
                <div className="os-empty-state">
                    <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>article</span>
                    <h3>Create your first page</h3>
                    <p>Build custom pages for your storefront — like About, FAQ, or policies.</p>
                    <button className="os-btn os-btn-primary" onClick={() => setShowAdd(true)}>Add page</button>
                </div>
            ) : pages.length > 0 ? (
                <div className="os-table-card">
                    <table className="os-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Visibility</th>
                                <th>Last updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map((page) => (
                                <tr key={page.id}>
                                    <td>
                                        <div className="os-table-page-title">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px', opacity: 0.5 }}>article</span>
                                            {page.title}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`os-status-badge os-status-${page.status}`}>
                                            {page.status.charAt(0).toUpperCase() + page.status.slice(1)}
                                        </span>
                                    </td>
                                    <td>{page.show_in_nav ? 'Visible in nav' : 'Hidden'}</td>
                                    <td>{formatDate(page.updated_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    )
}
