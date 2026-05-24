'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface MediaItem {
    id: string
    filename?: string | null
    original_name?: string | null
    url?: string | null
    mime_type?: string | null
    size_bytes?: number | null
    file_name?: string | null
    file_url?: string | null
    file_type?: string | null
    file_size?: number | null
    alt_text: string | null
    created_at: string
}

export default function GalleryPage() {
    const { store } = useParams<{ store: string }>()
    const [items, setItems] = useState<MediaItem[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/media?limit=100`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setItems(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this file?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/media/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        load()
    }

    const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
    const isImage = (t: string) => t.startsWith('image/')

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Gallery</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Gallery</h1>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{items.length} files</span>
            </div>

            {items.length === 0 ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No media yet</h2><p>Upload images, videos, and documents to your media library. Files uploaded through products, blog posts, and other sections will also appear here.</p></div></div></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {items.map(m => {
                        const fileName = m.filename || m.original_name || m.file_name || 'Untitled file'
                        const fileUrl = m.url || m.file_url || ''
                        const fileType = m.mime_type || m.file_type || 'application/octet-stream'
                        const fileSize = m.size_bytes ?? m.file_size ?? 0

                        return (
                            <div key={m.id} className="products-list-card" style={{ overflow: 'hidden' }}>
                                <div style={{ width: '100%', height: 140, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {fileUrl && isImage(fileType) ? (
                                        <img src={fileUrl} alt={m.alt_text || fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--text-hint)' }}>
                                            {fileType.includes('video') ? 'movie' : fileType.includes('pdf') ? 'picture_as_pdf' : 'insert_drive_file'}
                                        </span>
                                    )}
                                </div>
                                <div style={{ padding: '10px 12px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>{fileName}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{fmtSize(fileSize)}</span>
                                        <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span></button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
