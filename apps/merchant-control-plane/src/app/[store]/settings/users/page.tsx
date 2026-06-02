'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface Employee {
    id: string
    email: string
    role: string
    status: string
    created_at: string
}

const ROLES = [
    { value: 'manager', label: 'Manager', desc: 'Full access to store management' },
    { value: 'editor', label: 'Editor', desc: 'Can manage products, pages, and blog' },
    { value: 'viewer', label: 'Viewer', desc: 'Read-only access to all data' },
    { value: 'fulfillment', label: 'Fulfillment', desc: 'Can manage orders and shipping' },
]

export default function UsersSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [showAdd, setShowAdd] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newRole, setNewRole] = useState('editor')
    const [saving, setSaving] = useState(false)
    const loadData = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setEmployees(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { loadData() }, [loadData])

    const handleAdd = async () => {
        if (!newEmail.trim() || !newEmail.includes('@')) return
        setSaving(true)
        await fetch(`/api/stores/${encodeURIComponent(store)}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            email: newEmail.trim().toLowerCase(),
            role: newRole,
            status: 'invited',
            }),
        })
        setShowAdd(false)
        setNewEmail('')
        setNewRole('editor')
        setSaving(false)
        await loadData()
    }

    const handleRemove = async (id: string) => {
        if (!confirm('Remove this staff member?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/users/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        setEmployees(prev => prev.filter(e => e.id !== id))
    }

    const handleRoleChange = async (id: string, role: string) => {
        await fetch(`/api/stores/${encodeURIComponent(store)}/users/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        })
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, role } : e))
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 80, height: 28 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 100 }} /></div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Users and permissions</h1>
            </div>

            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Store owner</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
                        O
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Owner</div>
                        <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Full access to all settings</div>
                    </div>
                </div>
            </div>

            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Staff</h2>
                    {!showAdd && (
                        <button className="settings-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setShowAdd(true)}>
                            <MaterialIcon name="add" style={{ fontSize: 16 }} />
                            Add staff
                        </button>
                    )}
                </div>

                {showAdd && (
                    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16 }}>
                        <div className="settings-form-group" style={{ marginBottom: 12 }}>
                            <label>Email address</label>
                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="staff@example.com" />
                        </div>
                        <div className="settings-form-group" style={{ marginBottom: 12 }}>
                            <label>Role</label>
                            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                                {ROLES.map(r => (
                                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="settings-btn-primary" onClick={handleAdd} disabled={saving || !newEmail.includes('@')} style={{ padding: '7px 14px', fontSize: 12 }}>
                                {saving ? 'Sending invite...' : 'Send invite'}
                            </button>
                            <button className="settings-btn-secondary" onClick={() => { setShowAdd(false); setNewEmail(''); setNewRole('editor') }} style={{ padding: '7px 14px', fontSize: 12 }}>Cancel</button>
                        </div>
                    </div>
                )}

                {employees.length === 0 && !showAdd ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <MaterialIcon name="group_add" style={{ fontSize: 40, color: 'var(--text-hint)', display: 'block', marginBottom: 8 }} />
                        <p>No staff members added yet.</p>
                    </div>
                ) : (
                    employees.map(emp => (
                        <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-tertiary, #e2e8f0)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                                    {emp.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{emp.email}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                                        Added {new Date(emp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <select
                                    value={emp.role}
                                    onChange={(e) => handleRoleChange(emp.id, e.target.value)}
                                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                >
                                    {ROLES.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                                <span className={`settings-badge ${emp.status === 'active' ? 'connected' : 'pending'}`}>
                                    {emp.status}
                                </span>
                                <button className="settings-btn-secondary" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--danger, #e53e3e)' }} onClick={() => handleRemove(emp.id)}>
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
