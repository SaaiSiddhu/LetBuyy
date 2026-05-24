'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface AiUsage { id: string; feature: string; input_tokens: number; output_tokens: number; credits_used: number; created_at: string }

const AI_FEATURES = [
    { key: 'product_description', icon: 'description', label: 'Product Descriptions', desc: 'Auto-generate compelling product descriptions' },
    { key: 'seo_content', icon: 'search', label: 'SEO Content', desc: 'Generate meta titles, descriptions, and keywords' },
    { key: 'blog_draft', icon: 'edit_note', label: 'Blog Drafts', desc: 'Create blog post outlines and first drafts' },
    { key: 'social_media', icon: 'share', label: 'Social Posts', desc: 'Write social media captions and posts' },
    { key: 'email_copy', icon: 'mail', label: 'Email Copy', desc: 'Draft marketing emails and newsletters' },
    { key: 'image_alt', icon: 'image', label: 'Image Alt Text', desc: 'Generate accessible alt text for images' },
]

export default function AiStudioPage() {
    const { store } = useParams<{ store: string }>()
    const [credits, setCredits] = useState<{ total: number; used: number; remaining: number }>({ total: 0, used: 0, remaining: 0 })
    const [usage, setUsage] = useState<AiUsage[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/ai`, { cache: 'no-store' })
        const payload = await response.json()
        const creditData = payload.data?.credits
        if (creditData) {
            const total = Number(creditData.total_credits ?? creditData.plan_credits ?? creditData.balance ?? 0)
            const used = Number(creditData.used_credits ?? creditData.total_used ?? 0)
            setCredits({ total, used, remaining: Math.max(0, total - used) })
        }
        setUsage(payload.data?.usage || [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const fD = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const pct = credits.total > 0 ? Math.round((credits.used / credits.total) * 100) : 0

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>AI Studio</h1></div><div className="admin-skeleton" style={{ height: 400, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header"><h1>AI Studio</h1></div>

            {/* Credits Overview */}
            <div className="products-list-card" style={{ padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>AI Credits</h3>
                    <span style={{ fontSize: 24, fontWeight: 700 }}>{credits.remaining.toLocaleString()}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-hint)' }}> / {credits.total.toLocaleString()}</span></span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 6 }}>{pct}% used • {credits.used.toLocaleString()} credits consumed</div>
            </div>

            {/* Feature Cards */}
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>AI Tools</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
                {AI_FEATURES.map(f => (
                    <div key={f.key} className="products-list-card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-secondary)' }}>{f.icon}</span>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>{f.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Usage History */}
            {usage.length > 0 && (
                <>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Usage</h3>
                    <div className="products-list-card">
                        <table className="products-table">
                            <thead><tr><th>Feature</th><th>Tokens</th><th>Credits</th><th>Date</th></tr></thead>
                            <tbody>
                                {usage.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{u.feature.replace(/_/g, ' ')}</td>
                                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.input_tokens + u.output_tokens}</td>
                                        <td>{u.credits_used}</td>
                                        <td style={{ fontSize: 13, color: 'var(--text-hint)' }}>{fD(u.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    )
}
