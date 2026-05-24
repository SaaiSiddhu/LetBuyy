'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface StorePage {
    id: string
    title: string
    slug: string
    status: string
    updated_at: string
}

export default function PagesPage() {
    const { store } = useParams<{ store: string }>()
    const [pages, setPages] = useState<StorePage[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [newPage, setNewPage] = useState({ title: '', slug: '', body: '' })
    const [saving, setSaving] = useState(false)

    const loadPages = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/pages?limit=100`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setPages(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { loadPages() }, [loadPages])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        const slug = newPage.slug || newPage.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

        await fetch(`/api/stores/${encodeURIComponent(store)}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            title: newPage.title,
            slug,
            body: newPage.body,
            status: 'draft',
            }),
        })

        setNewPage({ title: '', slug: '', body: '' })
        setShowAdd(false)
        setSaving(false)
        loadPages()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this page?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        loadPages()
    }

    const handleTogglePublish = async (page: StorePage) => {
        const newStatus = page.status === 'published' ? 'draft' : 'published'
        await fetch(`/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(page.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        })
        loadPages()
    }

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Pages</h1>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {pages.length} page{pages.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                    Create Page
                </button>
            </div>

            {/* Add Page Form */}
            {showAdd && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950/30">
                    <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">New Page</h3>
                    <form onSubmit={handleAdd} className="space-y-3">
                        <input
                            type="text"
                            placeholder="Page title"
                            value={newPage.title}
                            onChange={(e) => setNewPage(p => ({ ...p, title: e.target.value }))}
                            required
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <input
                            type="text"
                            placeholder="Slug (auto-generated if empty)"
                            value={newPage.slug}
                            onChange={(e) => setNewPage(p => ({ ...p, slug: e.target.value }))}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <textarea
                            placeholder="Page content (HTML or markdown)..."
                            value={newPage.body}
                            onChange={(e) => setNewPage(p => ({ ...p, body: e.target.value }))}
                            rows={6}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <div className="flex gap-2">
                            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                                {saving ? 'Saving...' : 'Create'}
                            </button>
                            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Pages List */}
            {pages.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">No pages yet</p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Create pages like About, Contact, or FAQ for your storefront.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {pages.map((page) => (
                        <div key={page.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                            <div>
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{page.title}</h3>
                                <p className="text-xs text-zinc-500">/{page.slug} · Updated {new Date(page.updated_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${page.status === 'published'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                    }`}>
                                    {page.status}
                                </span>
                                <button onClick={() => handleTogglePublish(page)} className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                                    {page.status === 'published' ? 'Unpublish' : 'Publish'}
                                </button>
                                <button onClick={() => handleDelete(page.id)} className="rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
