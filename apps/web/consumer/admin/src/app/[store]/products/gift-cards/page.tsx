'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface GiftCard {
    id: string
    code: string
    initial_value: number
    balance: number
    status: string
    expires_at: string | null
    created_at: string
}

export default function GiftCardsPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()

    const [giftCards, setGiftCards] = useState<GiftCard[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [newValue, setNewValue] = useState('')
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        loadGiftCards()
    }, [])

    async function loadGiftCards() {
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', store)
            .single()

        if (!storeData) { setLoading(false); return }

        const { data } = await supabase
            .from('gift_cards')
            .select('*')
            .eq('store_id', storeData.id)
            .order('created_at', { ascending: false })

        setGiftCards(data || [])
        setLoading(false)
    }

    function generateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let code = ''
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) code += '-'
            code += chars[Math.floor(Math.random() * chars.length)]
        }
        return code
    }

    async function handleCreate() {
        const value = parseFloat(newValue)
        if (!value || value <= 0) return
        setCreating(true)

        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', store)
            .single()

        if (storeData) {
            await supabase.from('gift_cards').insert({
                store_id: storeData.id,
                code: generateCode(),
                initial_value: value,
                balance: value,
                status: 'active',
            })

            setNewValue('')
            setShowCreate(false)
            loadGiftCards()
        }
        setCreating(false)
    }

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
                <div className="products-page-header"><h1>Gift cards</h1></div>
                <div className="admin-skeleton" style={{ height: 200, borderRadius: 14 }} />
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Gift cards</h1>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{
                        background: 'var(--text-primary)', color: 'var(--bg)',
                        padding: '8px 18px', borderRadius: 8, fontSize: 13,
                        fontWeight: 600, border: 'none', cursor: 'pointer'
                    }}
                >
                    Issue gift card
                </button>
            </div>

            {showCreate && (
                <div className="product-form-card" style={{ marginBottom: 20 }}>
                    <h3>Issue a new gift card</h3>
                    <div className="product-field">
                        <label className="product-label">Initial value (₹)</label>
                        <input
                            type="number"
                            className="product-input"
                            placeholder="500"
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            min="1"
                        />
                    </div>
                    <p className="product-hint" style={{ marginBottom: 12 }}>
                        A unique gift card code will be generated automatically.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleCreate}
                            disabled={creating || !newValue}
                            style={{
                                background: 'var(--text-primary)', color: 'var(--bg)',
                                padding: '8px 18px', borderRadius: 8, fontSize: 13,
                                fontWeight: 600, border: 'none', cursor: 'pointer',
                                opacity: creating ? 0.6 : 1
                            }}
                        >
                            {creating ? 'Issuing...' : 'Issue'}
                        </button>
                        <button
                            onClick={() => { setShowCreate(false); setNewValue('') }}
                            style={{
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                border: '1px solid var(--border)', padding: '8px 16px',
                                borderRadius: 8, fontSize: 13, cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {giftCards.length === 0 && !showCreate ? (
                <div className="products-empty-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 48, color: 'var(--text-hint)', marginBottom: 16
                    }}>card_giftcard</span>
                    <h2 style={{
                        fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px'
                    }}>Sell or issue gift cards</h2>
                    <p style={{
                        fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px',
                        maxWidth: 400, marginInline: 'auto', lineHeight: 1.6
                    }}>
                        Gift cards are a great way to drive sales and attract new customers.
                        Issue codes with a set balance that customers can redeem at checkout.
                    </p>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{
                            background: 'var(--text-primary)', color: 'var(--bg)',
                            padding: '9px 20px', borderRadius: 8, fontSize: 13,
                            fontWeight: 600, border: 'none', cursor: 'pointer'
                        }}
                    >
                        Issue gift card
                    </button>
                </div>
            ) : giftCards.length > 0 && (
                <div className="products-list-card">
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Initial Value</th>
                                <th>Balance</th>
                                <th>Status</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {giftCards.map(gc => (
                                <tr key={gc.id}>
                                    <td>
                                        <code style={{
                                            fontSize: 12, padding: '3px 8px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 4, fontFamily: 'monospace'
                                        }}>
                                            •••• {gc.code.split('-').pop()}
                                        </code>
                                    </td>
                                    <td>₹{gc.initial_value.toLocaleString()}</td>
                                    <td>₹{gc.balance.toLocaleString()}</td>
                                    <td>
                                        <span className={`product-status-badge ${gc.status === 'active' ? 'active' : 'archived'}`}>
                                            <span className="product-status-dot" />
                                            {gc.status.charAt(0).toUpperCase() + gc.status.slice(1)}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                        {new Date(gc.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
